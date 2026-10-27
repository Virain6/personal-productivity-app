# Architecture

## Implemented in Sprint 1

One Next.js App Router application serves React UI and same-origin Node route handlers. Strict TypeScript, Tailwind Midnight Focus tokens, locally bundled Geist, Lucide icons and Radix dialogs. No external runtime AI or hosted service.

`src/features/home` handles calendar/task interactions; `src/features/timer` handles the persistent timer and logs. `src/lib` contains shared date/types and retry-safe command transport. `src/app/api/planner` validates requests and delegates to `src/server/services`. Only server code opens SQLite.

SQLite uses better-sqlite3 with Drizzle, foreign keys, WAL and busy timeout. Versioned SQL migrations apply on connection; seed reruns preserve user records. Six tables separate settings, activity templates, dated tasks, time sessions, completion history and mutation receipts. Categories are a typed validated enum rather than a separate table.

Generation is transactional and bounded, covers a rolling 28-day horizon plus the requested week, and never generates before onboarding. Unique template/original-date identity preserves moved and skipped occurrences. Edits affect only that occurrence; future template editing is deferred.

Task writes use optimistic versions. Commands use idempotency keys and saved receipts. A partial unique index plus immediate transactions permits one open timer across processes. Timestamps are UTC milliseconds; local dates and midnight allocation use the stored IANA timezone. Pause closes a session, resume opens another, and completion remains independent. Manual logs reject future/invalid intervals and require explicit overlap confirmation. DST gaps are rejected; manual repeated times require an offset selection. Fixed-event repeated local times are rejected pending an offset UI.

Home and timer state refresh on focus, reconnect and every 15 seconds. Elapsed display advances from a server snapshot using a monotonic clock. No offline write queue. Weekly/daily metrics use closed sessions and explicit completions, excluding optional tasks from required completion and future days from through-today percentages.

Host and Origin checks protect browser writes; local defaults allow loopback only. APP_ORIGIN supports an exact configured proxy origin. These checks are not authentication.

## Deployment and later work

One Docker container will serve frontend and backend on the home server. SQLite will use a persistent local volume. Tailscale/private HTTPS, owner access restrictions, consistent scheduled backups and a restore rehearsal are required before deployment. No deployment exists yet.

Roadmaps, milestones, projects/goals, jobs/import, advanced analytics and Apple Calendar are future modules. Habits and simple workout rotation are implemented below. Import will use validation preview and explicit commit. Calendar starts with ICS export; private subscriptions may not be reachable by Apple infrastructure and refresh asynchronously. Two-way sync is not promised.

## Home completion follow-up

Atomic switch closes the expected segment and starts the next task inside the existing immediate mutation transaction; any failure rolls back both. Finish dialogs capture the original session ID and task version, so a later poll cannot redirect a save to another timer. Stop-and-complete/skip requires a visible choice. Saved session corrections compare the original interval, summary and overlap flag inside that transaction, excluding the edited session itself from overlap checks. Receipts make retries safe. No schema migration was needed; no data reset.

Daily/weekly planned minutes include all activities planned in the selected dates, including optional and skipped activities. Actual time is closed-session overlap with the reporting dates, independent of a task's rescheduled date; per-task totals instead follow that task across dates. Required completion excludes optional tasks and includes required skips. Weekly through-today progress excludes future days. Intentional overlap is disclosed. Desktop day columns and mobile agenda share these server totals. Mutable dialog fields keep their original optimistic version while read-only status/time reflects refreshed data.

## Phase 2 — implemented Habits foundation

The dedicated `/habits` route renders `src/features/habits` (page, editor, card/logging controls). It uses the existing guarded `/api/planner?view=habits&date=YYYY-MM-DD` GET and validated mutation envelope for create/edit/archive/next-workout/daily-record commands. The same immediate transactions, mutation receipts, focus/reconnect polling and optimistic conflicts protect both Home and Habits. Home calendar integration is described below; no new service deployment or dependency.

Migration `0002_curvy_warlock.sql` only adds three tables and their indexes/constraints:

- `habits`: stable identity, archive flag, creation date, optimistic version and current workout pointer/planned date/cursor version.
- `habit_revisions`: immutable validated JSON configuration with habit/version uniqueness and local effective date. Configuration contains name, binary/quantity/workout type, unit, optional target/direction, schedule and ordered rotation. A new edit creates a revision from today. The latest eligible revision supplies an unrecorded date; a recorded date retains its original revision.
- `habit_records`: unique habit/local-date identity, revision FK, version, explicit unlogged/done/notDone/rest state, quantity in integer thousandths, actual/planned workout labels and optional rotation before/after markers. Clearing keeps the row as unlogged rather than deleting identity. Corrections update the same record.

This small first version deliberately follows the latest daily-record requirement rather than implementing the original multi-increment entry model. Quantities are **daily totals**, with at most three decimal places, nonnegative values and a fixed internal scale of 1000. Zero is explicitly recorded; missing is not zero. Awareness-only has no performance score. Minimum and maximum targets compare against the original day's target. Type/unit edits affect new records only and never convert old quantities. Separate revisions preserve historical rules without materializing empty habit-day rows on reads.

Schedules support every day, chosen ISO weekdays and a flexible number of days per Monday–Sunday week. Flexible schedules show days logged versus the chosen goal; no individual day is labeled missed. Unscheduled dates may be recorded voluntarily. The initial history view shows the selected week's records; navigate any local date to correct it. Current archive state hides habits from the active list, but history is retained and existing entries remain correctable while archived. Restore permits new records again. New logs are limited to creation date through the current date in the stored settings timezone.

Workout history preserves actual workout text separately from the planned step. Recording completion advances only with the explicit checkbox; recording rest or missing a date never advances. The manual plan editor selects any next step or changes its planned date. Latest completion undo restores the prior pointer only if no later workout/plan change happened. Earlier rotation undo is rejected atomically; actual workout text can still be corrected. This intentionally avoids replay machinery. Rotation edits create a new revision and reset the next pointer; historical labels remain unchanged. No exercise programming or timer linkage is added.

A consistent SQLite backup preceded migration. Existing six application tables were compared before/after and were unchanged. The migration passed synthetic old-schema upgrade tests, fresh/rerun tests, integrity and foreign-key checks. No reset or destructive migration.

## Phase 3 — goal directions and calendar projection

Measurement (binary, quantity, workout) is independent of direction (build, limit, avoid). New configuration revisions store direction and a normalized legacy goal field. A read-time compatibility adapter maps old maximum quantities to limit, other legacy habits to build, and keeps awareness-only quantities unscored. Existing immutable JSON and daily rows are not rewritten. Avoid normalizes its threshold to zero; limits are inclusive. Binary/workout limits can represent 0 or 1 occurrence per day; use quantity for larger thresholds. No schema migration, new dependency or personal-data change was required in this phase.

Shared `habitOutcome`, `habitResult` and `summarizeHabitDays` evaluate original dated settings. Null/unlogged is unknown, explicit zero is recorded, rest is neutral. Daily/weekly observation counts distinguish logged, goal, exceeded, rest and scheduled-unlogged days; they are not an adherence percentage. Voluntary logs count as observations; flexible weekly schedules do not invent missed individual days. No unit-mixing quantity aggregate is added.

`GET /api/planner?view=habitCalendar&from=…&to=…` returns a validated range of one to seven local dates under one SQLite read transaction. It reuses `getHabits` and filters the dated views. No task copies or empty daily record rows are persisted. Daily and weekday schedules use their dated configuration. Flexible N-per-week habits appear on any day labeled flexible; the target does not advance the calendar or mark missing days successful. Explicit next-workout dates override unrecorded schedule items from today forward; recorded history is retained. The current pending workout is a suggestion, never a prediction of completed future rotations.

Archived habits have no new scheduled items, but real recorded days stay visible and correctable. Voluntary unscheduled logs are shown as history; unlogged unscheduled days are absent. Recorded dates retain their revision after edits; unrecorded dates use the latest eligible revision. Thus a schedule edit changes future placement without rewriting past recorded facts.

Home's existing `agenda(day)` renders task cards and small `CalendarHabit` cards in the same list on desktop and mobile. Tasks retain their sorting, controls, timers and metrics. `useHabitCalendar` and `useHabits` share a single query hook with abort/sequence guards, no-store fetches, 15-second polling and focus/reconnect/change refresh. The old separate Home Habits section has been removed.

`HabitLogDialog` captures the clicked habit/date/version. It prepopulates binary observation, quantity daily total or actual workout and uses existing `habitRecord` commands, receipts and rotation rules. Save and close waits for success; errors retain the draft, and background refresh never replaces it. Close/Escape/outside-click/Cancel with changes require explicit discard; beforeunload warns on page exit. Future dates are read-only. A stale-write conflict requires closing/reopening after reviewing the error; it never overwrites another device silently. The existing Radix dialog supplies focus trapping and keyboard dismissal.

All original workout limitations remain: only an explicit current-day completion advances, rest/missed days never do, and undo of an older advancement after another pointer change is rejected. Monthly indicators, advanced statistics and deployment are not implemented here. Physical iPhone verification remains a gate before claiming device readiness.

Deployment preparation follows this phase, then Learning/Projects and Jobs/integrations. The long-term requirements remain in PROJECT_PLAN.md.

## Sprint 4 — safe calendar quick actions

`habit-quick.ts` defines shared pure quick-action decisions. The new `habitQuick` command loads the authoritative dated habit, checks versions, then delegates to existing `habitRecord` inside the same transaction and receipt handling. Home does not duplicate outcome, persistence or rotation rules. The response refreshes the existing shared queries. Pending controls are disabled; a synchronous gate and short cooldown suppress rapid clicks. A lost response retains the exact command for Retry save, preserving its receipt key. Review entry opens the existing correction dialog. Saved controls wait for authoritative refresh rather than claiming an optimistic final state.

Optional `quickStep` lives in existing immutable configuration JSON, so old configurations need no migration and default to no step. Current step settings apply to historical records only when measurement type and unit match; otherwise the historical step is used. Arithmetic uses scaled integers and existing bounds. Unlogged is never implicitly zero; plus opens the total dialog until a starting value is recorded. Negative quantities expose explicit Log 0. Binary negative quick confirmation records no occurrence; undo clears that observation.

Known current-day build workouts can record the displayed pending step and explicitly advance once. The control names advancement before saving. Rest, historical/ambiguous plans and protected older undo fall back to the existing dialog. Actual labels, manual plan moves and historical revisions retain their existing rules. Shared `CalendarStatus` and card classes give tasks and habits the same success treatment without mixing metrics.
