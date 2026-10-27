# Progress

Current phase: **Sprint 5 — deployment preparation complete, pending operational acceptance.**
Last verified: 2026-10-27. No commit, push or deployment performed.

## Sprint 5 — recovery and completed preparation

Before interruption: created Dockerfile, Compose, .dockerignore, standalone output, health endpoint, PWA manifest/icons/metadata, initial migration/backup/restore tool, deployment guide and two operational tests (46 total). Tests/build checks passed after correcting the tool to ESM. The standalone smoke test stopped on an outdated metadata assertion: installed Next emits `mobile-web-app-capable`, not the older Apple-prefixed name. Subsequent verification was blocked by exhausted approval-review credits, not a code rejection. Tracking docs were still at Sprint 4.

After resuming: re-read instructions and reviewed all changes; preserved the user's separate uncommitted Home toolbar edit. Added automatic verified backup before pending migrations, fail-closed behavior on backup failure, explicit backup verification, checksum checks before restore and atomic exclusive publication into a new destination. Added a third operational test. Updated environment example, build exclusions and guide with the supplied x86_64/Docker 29.2.1/Compose 5.1.0/RAM details and missing-Tailscale installation steps, without enabling Tailscale SSH or changing any actual server.

Final verification: **47/47 tests passed**, lint, typecheck, formatting, production build, Compose config validation and whitespace checks passed. Tests cover live WAL backup, migration reruns/no seeds, restore preservation and overwrite rejection, corrupt/checksum failures, backup failure blocking migrations, and missing DB health without accidental creation. Standalone artifact staged outside the repository with synthetic DB: entrypoint migration succeeded; HTTP health, manifest, all PNG assets, emitted standalone/Apple/viewport metadata, database API and foreign-origin rejection passed. Icon inspected visually. No application data or schema changes; no package/lockfile changes.

Docker CLI/Compose are installed locally, but daemon connection fails. **Linux image build/start, non-root bind permissions, container restart/recreation persistence and image filesystem inspection were not run.** Static build-context/Git checks found no tracked runtime DB/backups or production environment files; this is not a container-image audit. Actual Ubuntu, Tailscale, HTTPS, access denial and Mac/iPhone PWA installation were not tested. No server connection, commit, push or deployment occurred. No backup schedule/retention deletion was installed.

Next: review configuration, commit/push when ready, verify exact Ubuntu release and free local disk, then follow DEPLOYMENT.md. Supplied server resources are user-reported, not independently measured. Review owner-only tailnet policy before real data; APP_ORIGIN is not authentication. Perform target image build, restore/recreation and two-device acceptance checks. Keep existing services untouched. Node 22 remains supported through April 2027; schedule a tested upgrade before EOL.

## Home UI follow-up — 2026-10-27

Preserved all uncommitted Sprint 4 work. Added danger styling only for exceeded Avoid goals; explicit zero still uses success and absent records remain neutral. Mobile below 768px ignores saved desktop Week preference and hides the toggle; desktop controls and existing swipe handlers remain. Replaced daily required-count text with four partially fillable task progress pills and a thin recorded/planned time bar in both weekly columns and the day agenda. Uses existing server metrics, preserves actual totals above plan, caps visual fill at 100%, and shows empty progress for zero denominators. No persistence or business-rule changes.

Verification: all 44 automated tests passed (updated rendered Avoid regression), lint, typecheck, production build, formatting and whitespace checks passed. An additional rendered-component check verified one-third partial segments, 50% time, time above plan capped at 100%, and zero-plan/zero-required handling without invalid numbers. Browser verified desktop toggle, mobile forced Day after saving Week, no mobile toggle or overflow, task completion updating 25% to 50%, and red Avoid occurrence. Screenshot inspected using synthetic data only. Physical-device swipe remains a manual check; handler unchanged. No commit or push. Next recommended task remains deployment preparation.

## Sprint 4 work and evidence

Started from clean commit `1ad7f84`, read the Sprint 4 request and project instructions, and verified the existing 38-test baseline. Preserved existing data/services and calendar behavior. Compacted the Home shell, toolbar, cards and task-only summary; removed motivational copy. Tasks and habits now share filled success checks, subtle teal borders/surfaces and readable muted text.

Added separate quick controls for binary completion/undo, known current workout completion with visibly explicit rotation advancement, optional configurable quantity steps, and explicit zero for negative quantities. Card titles still open existing detail dialogs. Missing totals, historical/ambiguous/rest workouts and unsafe older undo use the detail flow. Quick steps update daily totals, not a separate increment ledger. No schema migration, dependency change or personal database write was needed.

Verification: **44/44 automated tests passed**, including six new tests covering quick decisions, decimal arithmetic, existing missing/zero semantics, legacy/no-step fallback, historical unit changes, safe rotation, stale/double requests, lost-response retry and shared completion markup. Lint, typecheck, formatting check, production build and Git whitespace checks passed.

Production browser preview used only synthetic `/private/tmp/planner-sprint4-preview.db` on port 3130. Desktop: binary complete/undo; known Push completion with actual label, next Pull and undo back to Push; explicit zero success, increment to exceeded and decrement back; Water double-click increments exactly once (1000 to 1250), refresh persistence and decrement; title opens independent details; unlogged historical plus opens a blank total dialog. Mobile 375px: automatic day layout, quantity action, task completion updating daily summary, next/previous day and disabled future logging. Content width matched viewport client width (360px with scrollbar). Desktop/mobile screenshots inspected. Existing scheduling, timers, manual time and summary regression tests passed; not every pre-existing workflow was repeated in the browser this sprint.

Remaining: physical iPhone Safari swipe, keyboard, lock/reconnect, VoiceOver and two-device checks. No offline queue. Ambiguous quick actions intentionally open details; older rotation undo restrictions remain. Narrow desktop week columns wrap long titles; day view and sidebar collapse remain available. Network-loss retry was verified through an automated transport test, not browser network simulation.

**Ready for deployment preparation**, not deployed: next establish home-server OS/CPU/storage and private access, prepare Docker and persistent storage, verify backup/restore and real-device use. Monthly statistics and other modules remain future work.

## Historical Phase 3 record

Current phase: **Phase 3 — goal directions and in-calendar habit logging complete.**
Last verified: 2026-10-27. No commit or push performed.

## Recovery and completed work

Read the resume attachment, AGENTS, plan, design/tasks/progress/architecture/decisions; inspected Git status, recent history, schema/migrations and actual code. Prior uncommitted Home and Habits work is preserved. Documentation was still at Phase 2.

Before interruption: goal directions, safe legacy defaults, zero/missing semantics, shared outcome/weekly observation helpers, and a separate Home Habits section were implemented. All 36 tests and lint/typecheck/format/build passed. Browser checks had exercised goals and shared Home logging, but final mobile checks and docs were unfinished.

After resuming: retained goal logic and replaced that separate section according to the clarified request. Added bounded date-range calendar reads; compact teal habit cards inside the existing weekly/daily agendas; date-specific binary, quantity and workout dialogs; versioned save-and-close; retained errors/drafts; explicit unsaved discard; future read-only states; recorded archived history and explicit workout date placement. Study tasks, timers and task metrics remain separate. Updated PROJECT_PLAN.md without removing long-term features.

## Verification evidence

- **38/38 tests pass**. The 36-test baseline passed before resume. Added calendar projection tests for weekdays, no task copies/empty records, pre-creation/future dates, schedule edits, historical names/records, archives/corrections, invalid ranges and workout rescheduling without rotation advancement.
- Existing tests cover build/limit/avoid across all measurement types, zero versus absent, inclusive limits, legacy JSON unchanged, historical corrections, daily/weekly counts, timezone/week/DST boundaries, persistence/retries/stale writes, Home metrics isolation and all scheduling/timer/manual-log regressions.
- Lint, typecheck, formatting, production build and git diff whitespace check passed. Earlier draft fixture and punctuation failures were fixed before the 36-test checkpoint; no outstanding failures.
- Final production preview: port 3129 with synthetic `/private/tmp/planner-phase3-preview.db`; no personal database writes or schema changes. Goal directions are compatible through read-time defaults, not a destructive data migration.
- Browser: weekly habit placement; historical quantity correction October 26 from zero to one updates only that date; October 27 starts unlogged and explicit zero saves Within limit; binary completion saves; avoid confirmation saves; workout actual Cardio with explicit advance, then neutral rest/undo; older rotation undo rejected while keeping edits. Unsaved-close/Keep editing/Discard verified. Future controls disabled. Day/week navigation and refresh persistence checked.
- Mobile 375px: single-day agenda and date-specific popup, no horizontal overflow (360px content/client width with scrollbar); readable scrollable dialog. Viewport restored. Desktop screenshot inspected. Browser warning/error log empty.
- Home browser regression: complete/undo study task; start timer, reload, and pause via global controls. Scheduling/reschedule/skip/manual-time and summary regressions passed automated tests; those workflows were not all re-entered manually this turn.

## Limits and next task

Physical iPhone Safari swipe/keyboard/lock/reconnect, VoiceOver and two physical devices still need manual verification. The swipe handlers are unchanged; date buttons were browser-verified. No offline write queue. Dialogs retain stale drafts and reject conflicts; close/reopen to load fresh values after reviewing the error.

Flexible weekly habits appear on any day labeled flexible, not on invented fixed weekdays. Recorded voluntary/archived dates remain visible as history. Workout future labels show the current pending step; they do not predict rotation movement. Older rotation undo restrictions and three-decimal daily totals remain. No monthly calendar statistics, advanced analytics, Apple integration, other modules or deployment were started.

**Ready for deployment preparation**, not deployment-ready: next confirm server OS/CPU/storage and private access model, prepare Docker/persistent storage, and verify backup/restore plus real-device access. Optional monthly habit statistics can follow daily use. Do not automatically commit, push or deploy.

## Historical Phase 2 record

Current phase: **Phase 2 — Habits Foundation complete; ready for scoped Home integration.**
Last verified: 2026-10-26. No commit or push performed.

## Recovery checkpoint

Read the resume attachment and reviewed AGENTS.md, PROJECT_PLAN.md, design/tasks/progress/architecture/decisions, Git status and the uncommitted implementation. Preserved all earlier Home work. The working tree still contains the earlier Home changes as well as this phase; do not overwrite or discard them.

Before the Habits interruption, schema/services/commands, migration, responsive management/history UI and eight Habits tests were implemented. The migration had already been applied after a backup, 27 total tests and build checks passed, and browser interactions covered all three habit types, archive/restore and mobile layout. Documentation still described Habits as future work.

After resume, added two focused tests for past-day correction following unit changes and safe rejection of older rotation undo; inspected remaining paths; refined long-label wrapping and compact desktop columns; verified Home in the final production build; and updated tracking, decisions, architecture and README.

## Implemented

- Binary completion/undo/correction; quantities with configurable units and optional minimum/maximum targets or awareness only; workout actual type independent of planned type.
- Create/edit/archive/restore, daily/selected-weekday/flexible weekly schedules, date navigation and weekly history. Quantity Save replaces the daily total, with zero distinct from not logged.
- One unique, versioned record per habit/local date. Settings revisions preserve original historical names/types/units/targets/schedules. Archived records remain readable/correctable.
- Simple workout rotation: explicit advancement after completion, no movement on missed/rest days, manual next-step/date selection, safe latest-advance undo, retained planned and actual labels.
- Loading/empty/error states, server validation, request retry receipts, stale-write conflicts and 15-second/focus/reconnect refresh. Midnight Focus components and responsive layout reused.

## Database and preservation

Added `habits`, `habit_revisions` and `habit_records` in `0002_curvy_warlock.sql`; no existing table was rebuilt or reset. Backup: `backups/before-habits-20261026T191311Z.db`, created with SQLite backup API and checked successfully. After migration, all rows in the six existing application tables matched their pre-migration values; integrity was `ok` and foreign-key checks returned zero violations.

## Verification

- **29/29 automated tests pass**: 19 existing Home/timer/origin tests plus 10 Habits tests. Habits coverage includes creation/edit, binary undo, quantity corrections/validation/zero, actual workouts/rest/rotation/manual plan, archive/restore, local dates and future rejection, duplicate daily constraint/retries/stale versions, reconnect, past settings preservation and old-schema upgrade retaining a running timer.
- `npm run lint`, `npm run typecheck`, `npm run build`, `npm run format:check` and `git diff --check` passed. Production output includes `/habits`.
- Browser tested against an isolated database on port 3127: create binary and complete/reload/undo; create reduction quantity habit, correct 3 to 1.5 and observe Within target/history without duplicates; create flexible weekly workout, record Cardio while plan stays Push, record Rest without advancement, choose Pull and move it to October 28; archive/restore Reading and reload saved values.
- 375px viewport: no horizontal overflow, readable single-column controls and mobile navigation. Viewport restored afterward. Desktop layout inspected. Final browser error/warning query returned none.
- Home regression: seeded schedule rendered; quick complete and undo worked; timer survived reload and paused successfully. Existing automated scheduling, rescheduling and summaries checks also pass.
- No personal habits were created by verification. Browser data is synthetic in `/private/tmp/planner-habits-browser-20261026.db`.

## Limits and next task

The first version edits a daily total rather than maintaining multiple quantity increments. Values allow three decimal places. Past records retain their original settings even after same-day edits; only new records use the latest eligible revision. Records before creation and future progress are rejected. History is week-at-a-time, with date navigation.

Rotation advancement is explicit. Rest never advances; manually choose the next step after a Rest step. Undo of an older advancement is blocked once a later completion or manual plan change exists, preventing the current plan from being silently rewound; actual workout labels remain editable. No replay of older rotation history, advanced analytics, notifications, health/calendar integration, deployment or full Home integration in this phase.

Physical iPhone Safari, VoiceOver and simultaneous real-device verification remain manual checks. Desktop responsive testing is not native-device certification. No offline write queue.

**Next:** add a compact selected-date Habits section to Home using these same services/records and quick controls, then verify edits from Home and Habits stay consistent. Keep task/habit completion and time metrics independent. Foundation is ready for that integration; do not rebuild Habits or begin deployment in this phase.

## Historical Home completion record

Current phase: **Home completion finished for the current daily-use scope; ready to begin Habits.**
Last verified: 2026-10-26.

## Recovery and audit

Reviewed AGENTS.md, the original PROJECT_PLAN.md, task/progress/design/architecture docs, Git status and every interrupted source change. Base commit was `08d9c9d`; the earlier Home work was still uncommitted. Preserved it rather than scaffolding again. No commit or push performed.

Already working before interruption: Monday–Sunday desktop week, mobile day/date controls, exact recurring study schedule, optional Sunday, flexible suggested times, occurrence create/edit/move/skip/restore, completion/undo, persistent timer, manual logs, loading/empty/error states and Midnight Focus styling. Existing 14 tests had passed.

Partially implemented at interruption: atomic timer switching, correction UI/services, original-session finish targeting, persistent save errors, fixed-time ordering, desktop daily summaries and inclusive planned totals. These lacked regression tests, browser validation and current documentation. Priority changes and Habits preparation were not yet documented.

## Completed after resume

- Reviewed and retained the interrupted implementation; added focused regression coverage for timer switching/rollback/retries/stale targeting, correction conflicts/overlap/future rejection, summary denominators and fixed-time ordering.
- Browser-verified switch and stop-and-complete. Found and fixed stale read-only recorded totals inside an open task dialog after a correction; editable fields still retain optimistic-version protection.
- Verified correction preserves the session and task completion, with totals refreshed from saved data. Corrected one synthetic session to 25 minutes, then moved its task to the following day: recorded time correctly remained on the day worked.
- Updated the priority order: Home → Habits → private deployment → Learning/Projects → Jobs/integrations. Documented minimal Habits schema/services/Home integration and workout rotation design without implementing Habits.

## Verification

- 19/19 automated tests pass, using synthetic databases. Existing tests additionally cover persistence/restart, schedule generation/moved occurrence identity, completion undo, input validation, cross-midnight/DST and competing timer processes.
- Lint, typecheck and production build pass; final formatting checked at completion.
- Isolated production preview on port 3126 with `/private/tmp/planner-home-verification-20261026.db`; personal database untouched. Browser verified seeded week, switch confirmation, stop-and-complete, persisted completion after reload, session correction, reschedule with source/destination identity, skipped activity, and mobile next-day navigation.
- Final-build browser recheck: correcting the synthetic session from 25 to 20 minutes immediately updated the open dialog total; browser error/warning log was empty.
- At 375px, no horizontal overflow; responsive single-day agenda and summary visible. Desktop seven-column summaries inspected. Native iPhone touch/Safari is not covered by desktop viewport testing.
- No database schema changes, dependency upgrades or migrations in this follow-up. Original long-term plan remains unchanged.

## Readiness and limits

Home's current checklist is functional for local daily use: schedule, completion/undo, move/skip, timers, manual logs/corrections and honest daily/weekly summaries are available directly on Home. Running time remains separate from closed-session totals. No claim that the entire long-term Home/product plan is complete.

Manual gates: real iPhone Safari swipe/scroll, phone lock/reconnect, two actual devices and full screen-reader/keyboard audit. Offline writes are not queued; reconnect before saving. Fixed events reject ambiguous DST local times. Future template editor/deletion suppression, a dedicated unfinished-earlier section, completed-task collapsing and timezone settings UI remain long-term polish; date navigation and per-occurrence editing work now. Habit/deadline sections depend on their future modules. These do not block the basic Habits foundation.

Not deployed: local loopback only until owner-only access, Docker/persistent storage, consistent backups and restore rehearsal are verified. Prior development-tool audit/ESLint compatibility caveats remain documented in DECISIONS.md and the historical sprint record.

## Next task

Begin the binary/quantity Habits persistence slice: back up the existing database, add the four habit tables and migration, implement validated retry-safe entries/target snapshots, and test history invariants. Then integrate daily controls into Home, followed by history/statistics and flexible workout rotation. Do not start Learning/Projects before the new deployment priority.
