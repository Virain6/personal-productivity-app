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

Docker/Compose configuration now prepares one standalone Next.js container for frontend and backend. SQLite and backups use persistent host bind directories. Tailscale/private HTTPS, owner access restrictions, a backup schedule and target container/restore rehearsal still require deployment acceptance. The user reports successful Ubuntu deployment and Mac/iPhone PWA installation; target operational checks remain distinct from local development verification.

Roadmaps are implemented below. Projects/goals, jobs/import, advanced analytics and Apple Calendar remain future modules. Habits and simple workout rotation are implemented below. Import will use validation preview and explicit commit. Calendar starts with ICS export; private subscriptions may not be reachable by Apple infrastructure and refresh asynchronously. Two-way sync is not promised.

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

## Sprint 5 — operational boundary

Docker uses supported Node 22 Debian slim and npm ci, checks the Linux native SQLite binding during build, and ships standalone output/static/public assets plus migration tools and SQL. Non-root UID/GID 10001 owns runtime storage; Compose publishes only 127.0.0.1:3100, drops capabilities and bounds logs. One replica, local-disk SQLite WAL, restart unless stopped. No additional service or schema changes.

The startup tool reads the migration journal and backs up an existing database before pending migrations, failing startup if verification or backup fails. Fresh databases migrate without seeds; no-op restarts create no extra backups. The existing application retains idempotent default initialization on first API use. Use the deployment tool for production migrations, not the development-only db:migrate script. Stop the app for upgrades. Backup uses SQLite's online API, records checksum/time/migration metadata, and verifies integrity/FKs. Restore validates checksum and DB before atomically publishing to a new empty destination; it cannot overwrite active data. Health opens an existing DB read-only and returns minimal 200/503 without seeding.

PWA uses a root-scoped standalone manifest and PNG/Apple icons with Midnight Focus metadata. No service worker or offline mutation queue. Tailnet policy is the authentication boundary; HTTP origin guards do not authenticate users. Tailscale Serve owns private TLS on a reviewed dedicated listener; no Funnel/public binding or Tailscale SSH configuration. DEPLOYMENT.md records operational commands and unverified target checks.

## Learning roadmap management — Sprint 6 milestone 1

Implemented `/learning` and `/learning/[id]` are thin routes around a client feature. Shared `usePlannerQuery` provides the existing abort/sequence guards, focus/online/event refresh and visible polling to Habits and Learning. `GET /api/planner?view=learning` reads a consistent snapshot; roadmap mutations reuse the existing validated command, immediate transaction and idempotency receipt pipeline.

`roadmaps` stores title, existing activity category, optimistic version, archive state and optional current-step ID. `roadmap_sections` and `learning_steps` store parent references and sibling positions; steps store completion and an optional validated HTTP/S resource URL. Deletions are soft; current selection is cleared when its step/section is removed. Services validate selection ownership and exact sibling membership during reorder. Archived roadmap metadata can be edited; module/step mutations require restore. Migration 0003 only adds these three tables and indexes.

Progress counts active completed steps against active steps, with zero for an empty roadmap. Next is the first incomplete step in section/step order. Current selection is independent of completion. Category study totals reuse closed time sessions joined to existing task categories, with last-study date in the configured timezone; running sessions do not contribute. Time is not attributed to a particular roadmap.

### Implemented session and Home integration (migration 0004)

`task_learning` stores an optional step and independent optimistic version keyed by existing task ID. This is an explicit per-occurrence default; it does not silently select among category roadmaps or change future templates. Home projects its active topic as one muted line. The task detail selector lists all active roadmaps/sections/steps (including completed steps for revisiting), marks the roadmap current step and provides a detail link. A draft can be used for a session without saving an activity default.

`session_learning` is keyed by existing session ID with nullable step/roadmap references, label snapshots and version. A cleared link retains its version row to prevent stale relinks. Foreign keys plus retained roadmap records preserve history. Changing the same historical link is a no-op and does not rewrite names. Changing to a different active step refreshes snapshots; clearing removes attribution only. Existing time rows, intervals, summaries and completion are never mutated by link operations.

The existing start/manual/switch commands accept an optional stepId: omitted inherits the active task default, null explicitly logs without a topic, a supplied ID is validated. The mutation orchestrator attaches the newly created session inside the original immediate transaction and receipt; failure rolls back timer switching and task status too. Stale/archived/deleted task defaults do not block ordinary logging. New explicit links require an active step, with no category restriction (Sprint 6.5). Historical links remain readable and removable after archival/deletion/category edits.

Learning reads linked actual time sessions and displays per-step closed duration plus roadmap history with stored labels, summaries and planner-timezone dates. Running time is excluded from totals; corrections update totals by reading the original session row, with no duplicated duration. Category totals remain separate, encompassing linked and unlinked category sessions. Task details support independent link correction for both closed and running sessions. Existing global timer, rescheduling, task completion, Habits and recurrence semantics remain unchanged.

## Sprint 6.5 — flexible Learning workspace (implemented milestone)

`LearningPage` owns query/mutation/editor state. `LearningOverview` renders cards and filters using shared pure summary/filter helpers. `RoadmapPath` renders collapsible modules and delegates mutations; `StepPanel` uses the shared Dialog's optional panel layout, existing planner query and TimerProvider. Default dialog behavior for Home/Habits is unchanged. The panel loads today's existing open activities using the configured planner timezone, rechecking the local date every 30 seconds. It starts an explicit session-step link through the same transaction; switching timers retains the existing confirmation flow. Additional activities are now scheduled by ModuleWorkspace through the existing task service (see the module milestone below).

Migration 0005 adds roadmap description/goal/nullable date, module description/objective/resource URL, and step description/objective/status. Category is a trimmed nonempty string of at most 80 characters; old labels remain unchanged. Status is validated as not_started/in_progress/needs_review/completed. A data backfill converts completed=true rows to completed status. The server synchronizes legacy completed and status atomically, so existing progress calculations remain valid; uncompleting resets status to not_started. Optional omitted metadata preserves existing values. Optimistic roadmap versions and mutation receipts still protect editing/retries. Dates are validated calendar dates, not inferred UTC instants.

Overview active/completed counts exclude archived roadmaps. Its linked-time total includes all saved closed linked sessions, including archived/deleted topics; the label explains this scope. Card totals use roadmap IDs and step totals use step IDs, independent of category names. Running time is excluded. Study time never changes mastery. Existing category totals remain available in the API but are not misrepresented as custom-roadmap attribution.

The original workspace milestone did not include recurrence or extra scheduling; the module milestone below now implements both. Markdown import and structured DSA problem associations remain unimplemented. Single-occurrence defaults remain explicit overrides.

### Proposed Markdown import format — future milestone

No importer is available yet. Plan to accept a single `# Roadmap title`, `## Module` headings, plain descriptions, and nested bullet lists for topics/steps with `[resource](https://...)` links. Import must preview a deterministic parsed structure, expose ambiguous/unrecognized content, and save only explicitly accepted content. Checkbox syntax must not mark steps complete. Repeated submission must not duplicate the same import; do not merge into or overwrite existing progress without explicit confirmation. No supplied content means no invented topics. Final supported nesting/duplicate rules must be tested and documented when implemented.

## Sprint 6.5 — module scheduling and activity (migration 0006)

`/learning/[id]/modules/[moduleId]` is a thin route into the existing LearningPage controller. RoadmapPath supports a focused module view; ModuleWorkspace supplies schedule forms, extra-session action, saved statistics and monthly activity. Roadmap detail uses the same workspace with a null module scope. Existing StepPanel and TimerProvider own study starts and timer behavior.

`study_schedules` identifies a roadmap-wide (section_id null) or module-specific scope. The service permits one schedule per scope under the existing immediate transaction. Immutable `study_schedule_versions` contain validated weekdays/time/minutes/paused/removed configuration and an effective local date. Highest eligible version wins. `study_template_links` binds stable existing activity-template IDs to schedule weekdays (unique schedule/weekday); one selected existing weekday template can be reused. Other weekdays receive new templates, not a second recurrence engine. No implicit merge of other existing weekday activities occurs.

`task_study` stores occurrence scope, optional schedule, cancellation state and the last managed task version. Existing template_id/occurrence_date uniqueness remains authoritative. Generation uses the dated schedule, creates the existing task shape and attaches scope. Schedule changes affect untouched pending occurrences today onward only; past, moved/edited, started/logged, done/skipped and explicit-topic exceptions retain their records. Cancellation hides untouched occurrences from Home/planned metrics and rejects stale task commands, while retaining identity for restore. Extra study tasks use saveTask and an explicit step association. Existing command receipts protect retries.

Explicit task_learning rows (including null) override dynamic scope recommendations. Otherwise an active current step within scope wins, then the first incomplete step. New session links snapshot selected labels and section_id; existing links never follow later current-topic changes. When a module has no recommended step, implicit logging can still record module-only attribution. Explicit null stays unlinked. Clearing attribution preserves time. Archive pauses affected schedules; restore requires an explicit resume. Modules/steps are retained for historical references.

`GET /api/planner?view=module&roadmap=…&module=…&month=YYYY-MM` validates ownership, generates that bounded month through the existing engine, and reports saved session_learning scope and task_study occurrences. Closed actual intervals split using timezone-aware day boundaries; session counts use local start dates. Running sessions are excluded. Renames/reorders/archive preserve ID-based attribution and snapshot history. Task completion, study time and mastery remain independent.

Monthly consistency = days before today with every scheduled occurrence completed / days before today with any scheduled occurrence. No eligible days yields unavailable, not fabricated 0% success. Future/today/rest days are not missed. A recorded-study dot is independent of scheduled completion and also appears on unscheduled study days. Selected-day durations are clipped to that day. Cancelled untouched occurrences do not enter schedule counts; preserved exceptions still do.

## Sprint 6.6 — roadmap-first compatibility layer

Roadmaps remain the main learning identity; category is now an optional legacy command field and a retained database column. New category-free roadmaps store Other internally, while edits that omit category preserve the old value. No Learning UI selector/filter/group depends on it. Existing ordinary task categories and legacy API category summaries remain compatible; they do not constrain roadmap creation.

Migration 0007 adds roadmaps.color (purple default). Commands validate eight palette keys; shared roadmap-colors resolves safe theme values with a purple fallback. Learning CSS variables scope accents to a roadmap. Home receives studyRoadmap identity/color from task_study even without a recommended step. Session indicators resolve current roadmap color without changing saved attribution labels or time.

The production seed now inserts only settings and unrelated Project/Applications defaults. Historical learning seed data exists solely in tests/legacy-seed.ts to exercise populated installations; production code never imports it. No migration deletes or archives old presets automatically.

Schedule forms create the existing internal templates automatically, hiding template choice. The legacy template-link command remains compatible for existing installations. One schedule per scope and existing template/date uniqueness remain authoritative. scheduleContext resolves roadmap/module names; generation and safe managed updates use these names. Past/edited/completed/logged tasks retain snapshot titles. Roadmap and module schedules intentionally add separate sessions; the UI explains overlapping days rather than silently cancelling one scope or reassigning history.

## Sprint 6.6 correction — authoritative roadmap recurrence

This section supersedes earlier module-schedule coexistence. New studyScheduleSave commands require sectionId=null; legacy module schedules may only be paused/removed. scheduleContext excludes module scopes and archived roadmaps from generation. Module pages retain step-linked actual history, but do not own recurrence. No separate recurrence engine was added.

roadmapCreate accepts optional validated schedule configuration. The orchestrator creates roadmap and schedule in one receipt-backed immediate transaction. studyTask accepts roadmapId and optional stepId, date, optional minutes (60 default), startNow and additional. It validates step ownership, generates that day's existing recurrence, and normally reuses an open non-retired roadmap activity. additional=true requests a distinct task; retries with the same operation key return the same task. startNow starts the existing timer and attaches attribution inside that same transaction, so conflicts roll back new tasks. One-offs preserve schedule configuration. Explicit no-step logs on roadmap tasks retain roadmap-only attribution; deliberate session unlink still clears attribution without touching time.

Migration 0008 adds retired_study_tasks(task_id, reason, retired_at), leaving source rows intact. Home excludes marked occurrences from tasks/planned metrics, and stale mutation requests are rejected. Actual sessions remain authoritative and are never removed by retirement. Module reports also honor markers.

The explicit retirement service identifies known seed templates by exact ID, weekday and original category/title and excludes templates adopted by roadmap schedules. It closes obsolete templates before their effective start, preventing future or previously ungenerated historical defaults. Untouched pending instances with no logs, completion events or topic overrides receive retirement markers. Manually changed, completed, skipped, running/logged instances remain. Managed module versions are distinguished from manual edits; eligible future module occurrences are marked while past/module session history survives. Paused/removed revisions retain old schedule configuration history. No cleanup runs automatically at startup.

## Sprint 7A.1 — bounded Analytics projection

`GET /api/planner?view=analytics&from=YYYY-MM-DD&to=YYYY-MM-DD` returns no-store aggregate data. Omitting both dates selects the current Monday–Sunday week using saved settings.timezone. Invalid, reversed, partial or >93-day ranges are rejected before recurrence generation. Shared analytics-range helpers also drive presets and calendar-month navigation in the UI.

The analytics service reuses ensureOccurrences for the requested range only, then reads a consistent SQLite snapshot. It filters closed sessions by interval overlap in SQL, with a one-to-one session_learning join, and sends daily/weekly/roadmap/module aggregates rather than raw history to the browser. The extra query window is bounded by the prior equal-length period and eight-week trend. No stored counters, new tables or migrations are introduced. Session rows remain unchanged; Home's existing lazy occurrence generation may materialize tasks for the requested dates. This is not a new recurrence engine.

Calculation contract:

- Study = actual closed sessions with roadmap attribution, including roadmap-only and archived links. All tracked time also includes unlinked sessions. Each saved record contributes once; deliberately confirmed overlapping records both contribute. Running sessions contribute nothing until saved.
- Duration is clipped to the requested interval and split at local midnight with timezone/DST-aware day bounds. Session counts use local start dates; a carry-over session can contribute time without adding a count.
- Planned study uses target durations of roadmap-owned task_study occurrences, including one-offs; cancelled and retired rows are excluded. Past legacy unlinked tasks are not guessed to be study. Unmaterialized archived historical schedules are not reconstructed beyond what the existing engine supports.
- Completed tasks use current status and planned date, not completion-event date. Required rate excludes optional and future tasks, but keeps skipped required tasks in the denominator; no eligible tasks yields null. Study statuses separate completed, skipped, unfinished past, open and upcoming; optional past tasks are open, not missed.
- Roadmap/module time uses stable attribution IDs; renames/archive never rewrite session snapshots. Module mastery uses current non-deleted step statuses and is explicitly not historical mastery for the selected range. Retired/deleted module time remains visible with a parent-roadmap link.
- Previous comparison shifts by selected-period length and truncates to matching elapsed local days for a current period. It is omitted if no prior saved records exist; study comparison additionally requires prior linked study. Comparisons are by days, not elapsed hours within today.
- Trend buckets start Monday and end at the selected final date. Zero means no saved study, not proof of inactivity. Future weeks and partial final weeks remain explicitly labeled as potentially incomplete.

The client uses the existing abort-safe query/poll/focus/change-event refresh hook. Recharts is dynamically loaded only for Analytics; the shared application shell does not import it. Presets, chart tooltips, exact-value tables and roadmap selection operate on aggregate data. Habits analytics/reflections and calendar Month/interaction work remain separate pending milestones.

## Sprint 7A.2 — learning and habit activity

Reuse the existing Analytics endpoint, session query, local-day clipping and recurrence identities. Roadmap projections add daily activity, study trends, elapsed required-day consistency and current active-module mastery. Consistency means elapsed scheduled dates with any saved roadmap time divided by elapsed required scheduled dates. Today/future/unscheduled dates are excluded; skipped dates remain eligible. This does not measure duration targets or task completion. Mastery excludes archived/deleted modules and deleted steps, independently of retained study history.

Habit reporting reads bounded records plus immutable revisions, reusing habitOutcome/habitResult and sharing expectedHabitDate with Habits. Saved records use their original revision; absent entries use the dated configuration. Quantity series retain historical units/targets; different units are never added together. Explicit zero is a value, missing is a chart gap, and averages use logged values only. Workout distribution uses actual performed labels, excluding rest.

Daily adherence divides met elapsed expected days by eligible elapsed expected days. Today/future, unscheduled, rest, awareness-only and flexible-weekly days are excluded. Weekly quotas require a complete elapsed Monday–Sunday week in the selected period with unchanged settings; partial/changed/archived/awareness weeks are not rated. Verified runs are bounded to the selected period, not all-time streaks. Unknown expected days and goal changes break runs; rest/unscheduled days do not.

Historical limitation: no dated archive/restore or workout-cursor timeline exists. Missing dates for currently archived habits, or workouts with a Rest rotation option, are unknown and excluded from adherence. Explicit rest remains rest. Former archive intervals of restored habits cannot be reconstructed; absent-day expectations reflect retained schedule revisions, not proof of behavior. No new storage, migrations or reporting counters are introduced.

## Sprint 7A.3 — Weekly Review

/analytics/review is a focused report within Analytics. GET view=weeklyReview validates a Monday week, calls the existing getAnalytics over seven local dates and adds saved reflection/history data. Weekly highlights are reductions of those existing aggregates; daily saved time, optional/required tasks, archived attribution, DST and habit zero/rest rules are not reimplemented. A current-week study comparison uses the service’s matched elapsed-day prior period. Scheduled learning counts refer to planned occurrences (recurring plus one-off), not saved time segments. Most active day uses saved study time and preserves ties. Statistics are derived on read, not historical snapshots.

Migration 0009 adds weekly_reviews: week primary key, wins/challenges/priorities text, positive version, updated_at. Week validation requires a valid Monday local date; database uniqueness enforces one row. weeklyReviewSave runs through the existing guarded mutation transaction/receipt machinery. Creation expects version 0, edits require the current version, and conflicting requests retain the caller’s draft. Empty new reviews are rejected; existing rows may be explicitly cleared without losing week identity. No read creates a reflection row.

The editor keeps working text separate from saved metadata. Polling never replaces a draft. A newer server version is announced and can be explicitly loaded. Week navigation uses the shared accessible dialog; app links/reloads warn while dirty. Session storage holds only an explicitly unsaved recovery draft keyed by week, including its expected version; it is cleared after save or explicit discard and never substitutes for SQLite. Browser Back may recover via this draft rather than block navigation. Storage failures are shown; closing the tab/device does not guarantee draft retention.

## Home monthly calendar — Sprint 7B.1

`lib/month-calendar.ts` supplies Monday-first padded month ranges and date-only navigation using the existing local-date conventions. Calendar arithmetic uses date strings in UTC (no instant conversion); today/status boundaries come from the existing America/Toronto dashboard. Home requests the same occurrence/dashboard service for 28–42 dates and keys responses by both endpoints. Day/Week retain their seven-day request and existing actions. No parallel occurrence store or recurrence engine is introduced.

`features/home/month-calendar.tsx` renders compact read-only previews; selecting a cell opens existing Day controls. Roadmap colors come from the existing saved color mapping. Done/skipped take precedence over required past-unfinished indicators; future dates are never inferred missed. The existing habit calendar service now accepts up to 42 days and continues its dated revision, explicit-entry, quota and workout rules. Future habits are neutral. Mobile resolves to Day regardless of saved desktop mode. Padded month totals are not mislabeled as a week summary. No migration is needed for 7B.1; 0009 remains the migration head.
