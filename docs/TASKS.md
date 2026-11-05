# Development tasks

Current phase: **Sprint 7 deployed (user reported); CI/CD release workflow prepared locally, awaiting manual GitHub/Ubuntu setup.**

User reports successful Ubuntu deployment and Mac/iPhone PWA installation (2026-10-28). Prior operational checklist items below remain historical agent verification limits, not a claim that deployment has not occurred.

## Sprint 7 release — CI/CD

- [x] Preserve clean deployed baseline `82cb9ea`; inspect existing deployment, backup and migration procedures.
- [x] Add PR/main/manual CI using Node 22, locked install, cached npm and all existing verification scripts; stable `Planner verification` check, read-only permissions and pinned actions.
- [x] Add installed server-side controller and disabled-by-default systemd definitions: lock, exact CI/merged-PR gate, clean fast-forward checkout, isolated image build and versioned deployment state.
- [x] Preserve previous image, verify live/quiesced SQLite backups, reuse migration tool and replace only Planner; fail closed with a recovery latch after migration/startup failure.
- [x] Document feature branches, GitHub protection/plan limitations, read-only credentials, installation, adoption, check-only/no-change/failure tests and database-compatible rollback in [CI_CD.md](CI_CD.md).
- [x] 124/124 repository tests (including 16 isolated controller scenarios), lint, typecheck, formatting and production build; no schema or application changes.
- [ ] Manually configure GitHub protections/credentials and confirm an actual Actions run.
- [ ] Manually install reviewed files on Ubuntu with timer disabled; verify systemd/credentials, exact baseline, restored-copy rehearsal and controlled deployment/no-change test before enabling.

No application/database migration, production access, installation, commit, push or deployment in this change. Controller/units are explicitly installed policy; future versions require manual review/reinstallation.

## Sprint 7 — incremental Analytics and Calendar work

Full requirements: [SPRINT_7.md](SPRINT_7.md), refined by [SPRINT_7_RESUME.md](SPRINT_7_RESUME.md). This milestone does not claim completion of the full sprint.

### 7A.1 — Analytics foundations

- [x] Audit clean Git baseline and existing 79-test implementation before changes.
- [x] Dedicated Analytics page in desktop navigation and mobile More menu.
- [x] Shared validated Monday-start/local-date ranges, presets, previous/next and custom ranges up to 93 days.
- [x] Saved study time, all tracked time, completed/required task counts and study-session cards.
- [x] Daily study bars, grouped planned/recorded bars, eight-week trend and roadmap-color distributions.
- [x] Roadmap selection reveals module durations and explicit current mastery with Learning links.
- [x] Preserve archived attribution; exclude running time; split durations at local midnight/DST; distinguish missing comparison data.
- [x] Reuse recurrence generation and occurrence identities; no parallel scheduling or time ledger.
- [x] Nine regression tests added; 88 tests passing, lint, typecheck and production build.
- [x] Final desktop/375px verification, responsive control fixes, formatting and documentation review.
- [ ] Physical Safari/iPhone date-picker, VoiceOver and target-container release checks.

### 7A.2 — Learning and Habit Analytics

- [x] Preserve 7A.1 charts and extend the existing Analytics service.
- [x] Roadmap monthly study heatmaps, saved-color trends, consistency and current mastery; reuse module totals and last studied.
- [x] Habit monthly heatmaps, eligible-day adherence, period-bounded verified runs and weekly trends/quotas.
- [x] Quantity/goal lines with explicit zero, missing gaps and separate historical units; actual workout distribution.
- [x] Distinguish below-goal, unlogged, unscheduled, future, rest and unknown history.
- [x] 98 automated tests, lint, typecheck, production build; desktop and 375px browser verification with isolated synthetic data.
- [x] Formatting, documentation and preservation review.
- [ ] Real iPhone Safari/VoiceOver and target-container/restored-copy release checks.

### 7A.3 — Weekly Review

- [x] Dedicated Analytics → Weekly Review report with Monday–Sunday navigation and saved-week history.
- [x] Reuse Analytics for study, roadmap, task, learning occurrence, habit and previous-period statistics.
- [x] Seven-day chart, roadmap colors, compact task/habit progress, most active day and honest empty/future states.
- [x] Save/edit Wins, Challenges and Next Week’s Priorities; unique week, optimistic version checks and retry receipts.
- [x] Unsaved indicators, week-change confirmation, leave warning and tab-local draft recovery; no empty review on navigation.
- [x] Additive migration 0009; isolated upgrade from 0008 preserves existing records.
- [x] 106 tests, lint, typecheck, formatting, production build, desktop and 375px browser verification.
- [ ] Real Safari/iPhone reload/close confirmation, VoiceOver and target-container/restored-copy release checks.

### 7B.1 — Monthly Calendar

- [x] Monday-first desktop Month grid, adjacent dates, Today and month navigation.
- [x] Preserve selected dates across Day/Week/Month; date cells open existing Day actions.
- [x] Real roadmap/one-off/generic occurrences with saved roadmap colors, completed/skipped/past unfinished states and overflow counts.
- [x] Habit indicators reuse dated goal/schedule rules; explicit zero retained, future indicators neutral.
- [x] Reuse occurrence engine and extend existing habit range to 42 days; no schema or dependency changes.
- [x] 110 tests, lint, typecheck, formatting and production build; desktop and 375px browser verification on synthetic data.
- [x] Mobile stays Day; existing navigation and swipe handler preserved.
- [ ] Physical iPhone swipe/VoiceOver verification before release. Optional mobile month picker deferred to mobile polish.

### 7B.2 — Quick Add and Rescheduling

- [x] Visible Home Quick Add with selected-date defaults, one-off general tasks, weekly general tasks and existing-roadmap study activities.
- [x] Optional description/time/duration, roadmap-saved name/color and optional module/step selection; explicit additional-study choice and existing open-activity reuse.
- [x] Focused Move to Date confirmation for one occurrence, preserving identity, status, history and running timers.
- [x] Separate future general schedule editor with an effective date; roadmap schedules stay in their existing roadmap editor.
- [x] Dated general-template revisions reuse existing recurrence generation; preserve all past and protected future exceptions.
- [x] Additive migration 0010 and isolated upgrade from 0009, preserving existing records.
- [x] 118 tests, lint, typecheck, formatting, production build; desktop and 375px browser creation/move/schedule verification.
- [x] Save feedback, validation/conflict errors, double-submit guards, Quick Add/schedule discard confirmation and responsive dialogs.
- [ ] Drag-and-drop deliberately deferred: confirmed dialog-based moves provide the reliable keyboard/touch path.
- [ ] Physical Safari/iPhone/VoiceOver and target-container release checks.

### 7B.3 — Mobile Calendar Polish

- [x] Retain mobile Day and desktop Day/Week/Month; compact date picker trigger, Today and button alternatives.
- [x] Tab-local selected date survives page navigation/reload; validated recovery, no server data stored in browser preferences.
- [x] Agenda swipes reject controls, vertical intent, multi-touch, cancellation, short movement and long holds.
- [x] Monday-first compact month picker with adjacent dates, month controls, Today/selected states and existing roadmap-colored activity indicators.
- [x] Calendar dialogs fit the visual viewport, use 16px mobile fields and retain a sticky title/close control; existing Radix focus trapping and reduced-motion rules retained.
- [x] Task completion/undo, shortcut to existing timer/manual logs, separate occurrence/future controls and unsaved task/move dismissal protection.
- [x] Use refreshed task versions for status/move after timer changes; preserve optimistic checks for edited fields.
- [x] 123 tests, lint, typecheck, formatting and production build; desktop, actual 375px and 320px browser checks.
- [x] Review Analytics/Weekly Review and Day/Week/Month coexistence; rehearse 0009/0010 on an isolated populated 0008 copy, preserving 19 existing tables.
- [x] Compose configuration validates; Dockerfile/standalone packaging reviewed, no dependencies or new migration in 7B.3.
- [ ] Physical iPhone Safari/PWA swipe, keyboard, safe areas, VoiceOver and two-device checks.
- [ ] Target Docker image build, container restart/persistence and rehearsal on a separately authorized restored production backup (local daemon unavailable).

Next: release review and the outstanding device/container gates. No automatic deployment. General recurrence remains one weekday per weekly activity; multi-day/complex recurrence and drag-and-drop remain deferred. Existing archive/rest history limitations remain unchanged.

## Sprint 6.6 correction — roadmap-only calendar sources (2026-10-31)

This supersedes the earlier additive module-schedule decision below.

- [x] Only roadmap schedules recur; reject module recurrence and remove its UI controls.
- [x] Optional weekly days/duration/time during roadmap creation, atomically saved with the roadmap.
- [x] Study Anytime supports immediate timer start and one-off date, optional step/duration, open-activity reuse and explicit additional sessions.
- [x] Keep roadmap attribution when logging without a step; preserve timer transactions and mastery independence.
- [x] Add non-destructive retirement markers and explicit preview/backup/apply tool.
- [x] Locally retire 15 legacy templates and 74 untouched occurrences; preserve four historical/edited occurrences, saved sessions, completed tasks, habits and roadmaps.
- [x] Verify zero default learning activities in the next 29 local Home days after generation.
- [x] 79 tests, lint, typecheck, formatting, build and desktop/mobile browser checks.
- [ ] Separately authorized production rehearsal, reviewed cleanup and device checks; no production changes in this task.

## Sprint 6.6 — roadmap-first Learning

- [x] Preserve staged/uncommitted Learning, Home, Habits and timer work.
- [x] Remove Learning category inputs, labels and filters; permit category-free creation and editing.
- [x] Persist curated roadmap colors with additive migration 0007 and purple legacy default.
- [x] Apply accents to roadmap cards, progress/path markers, Home activities and session indicators.
- [x] Stop seeding learning activities; retain existing records and unrelated Project/Applications initialization.
- [x] Configure schedules directly without selecting templates; preserve optional module schedules with explicit additive-session wording.
- [x] Use roadmap names for new/untouched managed occurrences; preserve completed/edited/logged snapshots.
- [x] Verify 73 tests, lint, typecheck, formatting and production build; isolated desktop/mobile browser flow.
- [x] Document opt-in legacy preset retirement and migration requirements.
- [ ] Separate release review: target image, restored-backup rehearsal and real Mac/iPhone checks. No automatic deployment.

Markdown import and structured DSA problems are explicitly outside Sprint 6.6. Earlier milestone sections remain historical records.

## Active priority order

1. Home completion and polish (current phase completed within the verification limits in PROGRESS.md).
2. Habits integrated directly into Home: binary/quantity first, then flexible workouts and history.
3. Home-server deployment for daily Mac/iPhone use, with private access and verified backups.
4. Learning Roadmaps and Projects.
5. Job Application Tracker and integrations.

This order supersedes the original milestone ordering and release gate, not the long-term requirements. Milestone IDs below remain stable references. The daily-use MVP gate is Home + Habits + deployment; Learning/Projects no longer block deployment. Home calendar logging and the separate Habits management/history page are functional. Monthly statistics remain future work.

## Sprint 6.5 — flexible roadmap workspace and visual redesign

The user authorized completing a tested milestone if the combined sprint is too large. This milestone covers priorities 1–2 and reuses existing session linking for the step panel. Do not describe the whole sprint as complete or deploy automatically.

- [x] Inspect and preserve staged Sprint 6 implementation and all existing Home/Habits/timer behavior.
- [x] Custom roadmap names/categories (including DSA), multiple roadmaps per category, descriptions, goals, optional target dates, edit/archive/restore.
- [x] Module/step descriptions and objectives, validated resource URLs, CRUD/reordering, four explicit statuses, current topic and next incomplete recommendation.
- [x] Real overview summaries, responsive category cards, search/filter and empty states.
- [x] Connected collapsible learning path with current/completed module indicators and accessible step actions.
- [x] Desktop side panel/mobile full-screen sheet: details, status, resources, saved study time/history, editing/reordering, start studying through an existing activity and timer.
- [x] Additive migration 0005 preserves previous columns and maps completed steps to Completed.
- [x] 61 tests; lint, typecheck, formatting, production build; desktop/390px browser interaction checks against isolated synthetic data.
- [x] Update architecture, design, progress and deployment considerations.
- [x] Recurring activity template → roadmap/module links, generation/inheritance and current/next topic projection; preserve occurrence identity, explicit overrides and session snapshots.
- [x] Schedule an additional study activity from a roadmap/module step through the existing task service.
- [ ] Markdown import preview, explicit save and duplicate handling; no progress overwrite or automatic completion.
- [ ] Optional DSA problem associations beyond the existing resource URL and session summary.
- [ ] Physical iPhone keyboard/VoiceOver and Mac/iPhone PWA verification; target-container/restored-copy migration rehearsal before a separately authorized deployment.

Resource support currently remains one HTTP/S URL per module/step. Category names are reusable text labels, not a separate category-admin system. Occurrence/session links can reference any active roadmap. Template linking and extra-task scheduling are implemented in the module milestone below. Progress remains explicit and independent of study hours. No Markdown importer is exposed yet.

## Sprint 6.5 — module pages and study schedules (2026-10-30)

- [x] Dedicated module route, editable steps/resources, current/next topic, mastery progress, saved time/session count, last studied and historical records.
- [x] Separate roadmap-wide and module-specific weekly schedules: weekdays, optional suggested time, duration, existing-template link or new schedule, edit/pause/remove/restore.
- [x] Reuse recurrence engine with stable template/date identities; preserve past, moved, edited, started, logged and explicitly linked exceptions.
- [x] Monthly calendar with actual study markers, completed/missed/future/rest states, selected-day records and eligible-day consistency.
- [x] Module archive/restore, retained session/module attribution and additive migration 0006.
- [x] 69 tests, lint, typecheck, formatting and production build; isolated desktop/mobile schedule, extra-session and timer checks.
- [ ] Next milestone: Markdown import preview and explicit deduplicated save, with editable output and no inferred completion.

One weekly schedule per scope is supported. Linking an existing activity reuses one weekday template; other selected weekdays create new templates, as disclosed in the form. It does not merge a family of pre-existing daily activities. Restore does not automatically resume archived schedules. Saved-session totals exclude running time; consistency counts fully completed elapsed scheduled days, not mastery or recorded hours. Physical-device and target-container release checks remain outstanding.

## Sprint 6 — Learning Roadmaps

- [x] Inspect existing schema, scheduling, timers and working UI; preserve existing data.
- [x] Add versioned additive roadmap/section/step migration, validation and retry-safe services.
- [x] Category overview with current topic, step progress, next incomplete step and existing category study time/last studied date.
- [x] Roadmap detail, collapsible sections, create/edit/reorder/delete, resource links, explicit completion/undo and archive/restore.
- [x] Test migration against populated previous schema including a running timer; verify desktop/mobile and all checks.
- [x] Add optional study-session-to-step associations and historical title snapshots; test corrections, timer switching, retries and deleted/archived topic history.
- [x] Add optional task-detail topic selection, roadmap access and lightweight Home topic display without requiring selection or changing completion rules.
- [ ] Verify integrated flows on actual Mac/iPhone PWAs after a separately authorized release.

Sprint 6 implementation is complete locally. Category time includes existing closed sessions; roadmap/step time uses explicit session links only. DSA remains a simple Home activity. No sample roadmaps are seeded. Task topic defaults apply to a single occurrence; future template-wide defaults remain outside this sprint.

- [x] 57 tests including link corrections, timer switch rollback, historical labels, rendered controls and upgrades from both pre-roadmap and roadmap schemas.
- [x] Desktop and 375px browser flow: optional topic, start/pause, manual logs, change/remove/relink, persisted Home topic, step totals and unchanged mastery.
- [x] Lint, typecheck, formatting and production build; update release instructions for migration 0004.
- [ ] Separately authorized target-container build, restored-copy rehearsal and Mac/iPhone PWA smoke checks before declaring the deployed release verified.

## Sprint 5 — deployment preparation

- [x] Preserve existing Home edit; inspect Docker, database, metadata and project docs.
- [x] Multi-stage standalone Dockerfile, non-root UID 10001, loopback Compose binding and persistent data/backup mounts.
- [x] Startup migrations with verified backup before pending changes; read-only health endpoint.
- [x] SQLite-safe backup, checksum/integrity verification and restore to new destinations only.
- [x] PWA manifest, 192/512 icons, Apple icon and viewport metadata; no offline writes.
- [x] Server-specific deployment, Tailscale installation/access, update, backup/restore and rollback guide.
- [x] 47 tests, lint, typecheck, formatting, production build, Compose validation and isolated standalone HTTP smoke test.
- [ ] Docker image build/start/recreation persistence — local daemon unavailable.
- [ ] Confirm Ubuntu version and free local disk, install Tailscale, review owner access policy and actual HTTPS URL.
- [ ] Authorized server deployment, restore rehearsal, denied-access test and Mac/iPhone installation.
- [ ] Install backup schedule/off-host copies after deployment review; no scheduler changed here.

## Home UI follow-up — completed 2026-10-27

- [x] Avoid occurrences use subtle danger red; explicit zero stays success and unlogged stays neutral.
- [x] Mobile below 768px always uses Day view with no toggle, preserving desktop preferences and swipe handling.
- [x] Shared daily progress: four proportional task segments and recorded/planned time bar capped at 100%.
- [x] Verify 44 tests, lint, typecheck, build, formatting, progress boundary checks and responsive browser behavior.

## Sprint 4 — Home refinement and quick actions

- [x] Compact Home header, navigation, cards and summary; remove motivational filler.
- [x] Shared task/habit success check, teal surface and border; neutral missing/rest states.
- [x] Separate title/detail controls from binary complete/undo and safe workout complete/advance.
- [x] Optional configurable quantity steps, explicit Log 0, integer arithmetic and historical-unit safety.
- [x] Preserve existing dialogs for corrections and ambiguous workouts/starting totals.
- [x] Pending/error/retry feedback, rapid-click guard, version checks and idempotent receipts.
- [x] 44 tests plus lint, typecheck, formatting, production build and desktop/mobile browser verification.
- [x] Update architecture, design and progress documentation.
- [ ] Physical iPhone swipe/keyboard/VoiceOver and two-device checks during deployment preparation.

## Phase 3 — goal directions and Home calendar integration

- [x] Verify interrupted goal-direction implementation and safe legacy defaults.
- [x] Build/limit/avoid with explicit zero, historical corrections and neutral rest.
- [x] Replace the separate Home controls section with compact clickable habit items inside both calendar views.
- [x] Derive date-range items without task copies; weekday/flexible schedules, explicit workout moves, archives and recorded history.
- [x] Binary/quantity/workout date-specific popup with Save and close, version protection, retained errors and unsaved-change confirmation.
- [x] Calendar refresh after writes; shared focus/reconnect polling and separate task metrics.
- [x] Automated regression suite, lint, typecheck, formatting, build and desktop/mobile browser checks.
- [x] Update the product plan, architecture and design decisions to reflect calendar-first logging.
- [ ] Physical iPhone swipe, lock/reconnect, VoiceOver and two-device verification.
- [ ] Optional later: monthly indicators, selected-period consistency and unit-safe totals/averages (not part of this resumed sprint).
- [ ] Next: deployment preparation with server/access details, Docker, private HTTPS and verified backup/restore. Do not deploy automatically.

## Phase 2 — Habits Foundation

- [x] Preserve existing Home changes and verify the existing migration/data path.
- [x] Add binary, quantity and workout types with create/edit/archive/restore.
- [x] Add daily, selected-weekday and flexible N-days-per-week schedules.
- [x] Add optional minimum/maximum quantity targets and awareness-only tracking.
- [x] Persist one versioned daily record; edit/clear/undo without duplicate records.
- [x] Preserve old type/unit/target/schedule through immutable settings revisions.
- [x] Record actual versus planned workout; explicit rotation advance, latest undo, rest and manual next-step/date controls.
- [x] Build responsive Habits page with date selection, quick logging and weekly history.
- [x] Back up database, apply additive migration and compare pre-existing tables unchanged.
- [x] Pass all tests, lint, typecheck, formatting and production build; verify browser flows and Home regression.
- [ ] Physical iPhone Safari, voiceover and two real devices (manual verification).
- [x] Selected-date habit logging on Home using the same services and records (Phase 3 calendar dialogs).

Phase 2 scope: daily totals (not multiple increments), three-decimal quantities, no records before creation/future dates, and no replay of older rotation advances. Historical actual workout labels remain editable. See PROGRESS.md for evidence and limits.

## Home completion follow-up

- [x] Audit actual UI, services, schema, commands and existing tests.
- [x] Sort fixed/suggested activities by local start; show daily summaries on desktop and mobile.
- [x] Preserve optional/skipped planned time; disclose overlap and separate completion from time.
- [x] Confirm atomic timer switch and stop-with-completion/skip from Home.
- [x] Correct saved timer/manual sessions with stale-edit and overlap protection.
- [x] Keep finish dialogs attached to their original session; retain mutation errors during polling.
- [x] Automated regression checks and production-browser interactions.
- [x] Document minimum Habits architecture and preserve future requirements.
- [ ] Real iPhone Safari swipe/lock/reconnect and full assistive-technology testing.

Legend: `[x]` verified complete; `[ ]` pending; `[ ] BLOCKED — reason` requires a missing dependency/decision. Future phases are pending, not currently blocked. Never check a task merely because code was written.

## M0a — initialization

Dependency: None. Verified 2026-10-24; see PROGRESS.md.

- [x] Create AGENTS.md and the four requested docs files.
- [x] Initialize Next.js, strict TypeScript, Tailwind and minimal welcome shell.
- [x] Configure ESLint, formatting, typecheck/build/dev scripts, ignore rules and README.
- [x] Install dependencies and commit-ready lockfile; verify lint, typecheck, formatting and build.
- [x] Start development server and verify the welcome route; record actual outcomes.

Acceptance: Fresh install and local startup work; lint/typecheck/build pass; no product feature or user file overwritten.

## M0b — minimal persistence prerequisites

Dependency: After M0a; completed during Sprint 1.

- [x] Verify SQLite driver compatibility with Node 22; add Drizzle and a focused test runner.
- [x] Create server-only connection, settings, typed categories and task schema.
- [x] Add versioned migrations and idempotent settings/category seeds; ignore local data.
- [x] Test fresh migration, rerun safety, constraints and seed reruns in a temporary database.

Acceptance: Database survives reconnect; migration/seed reruns preserve rows; tests use isolated synthetic data.

## M1 — Home and basic tasks

Dependency: After M0b. First product feature.

- [x] First slice: validated create/list API and simple Home list with persisted one-off tasks.
- [x] Add edit, done, skip, reopen and move actions with clear server errors.
- [x] Add laptop week and phone day views, date buttons, optional/required labels and suggested times.
- [ ] Physical-phone verification of implemented day swipe; date buttons verified at 375px.
- [x] Add loading, empty and save-failed states; test persistence and core lifecycle.

Acceptance: Create/move/refresh retains one task. Controls work at 375px and laptop widths. Keyboard navigation works; optional tasks distinct. Recurrence and timers were authorized together by Sprint 1.

## M2 — weekly recurrence

Dependency: After M1.

- [x] Seed exact plan schedule with editable times and optional Sunday.
- [x] Implement bounded transactional instance generation and uniqueness.
- [ ] Future template editing/version UI and deletion suppression (occurrence edits, moves and skips already implemented).
- [ ] Test concurrent generation, moved instances, preserved history and effective-date boundaries.

Acceptance: No duplicates or regenerated moved/deleted occurrences; preserved exceptions survive revisions.

## M3 — timers and manual logs

Dependency: After M2.

- [x] Add time-entry schema and unique open-segment constraint.
- [x] Atomic timer switching with explicit confirmation, expected session and retry safety.
- [x] Add persistent timer display and multi-device reconciliation.
- [x] Existing-log correction with stale-edit checks and overlap confirmation.
- [x] Test restart recovery, concurrent starts, retried stops, midnight and DST.

Acceptance: Closing browser/restarting app preserves timer; one running segment; completion never invents time.

## M4 — learning and projects

Dependency: After Habits and deployment (new priority 4).

- [ ] Create roadmap/milestone/item CRUD, ordering, progress and resource links.
- [ ] Create projects/goals/deadlines using shared tasks.
- [ ] Link session to learning item/project goal; explicit independent completions.
- [ ] Preserve archived links and show next goals/deadlines on Home.

Acceptance: Task completion does not auto-complete learning items/goals; archives retain history and deadlines do not duplicate tasks.

## M5 — habits and MVP summary

Dependency: After verified Home (new priority 2); Learning/Projects are not prerequisites.

- [x] Add boolean/quantity/workout habits, dated settings revisions and daily record snapshots.
- [x] Add retry-safe daily controls, correction and weekly history on Habits.
- [ ] Add Home month circles, quantity averages and weekly time/completion summary.
- [x] Test settings/unit changes, historical corrections, future rejection and local dates.
- [ ] Add monthly adherence/quantity averages and the documented five-day average fixture during Home integration.

Acceptance: History remains stable; entries aggregate correctly; Home displays distinct daily states and correct averages.

## M6 — deploy and use MVP

Dependency: Verified Home and Habits; server details/access decisions required (new priority 3).

- [ ] Confirm server OS/CPU, storage and owner-only access model.
- [x] Prepare Docker/Compose with persistent local storage and startup migrations (container execution still pending).
- [ ] Configure private HTTPS/Tailscale and verify unauthorized access denied.
- [ ] Implement consistent backup schedule/retention and perform restore rehearsal.
- [ ] Smoke-test phone/laptop and container replacement; use for seven days and fix friction.

Acceptance: Data survives replacement; verified restore; authorized devices connect; MVP gates pass before expansion.

## M7 — applications and import

Dependency: After daily-use MVP and Learning/Projects (new priority 5).

- [ ] Add application records, status history and linked follow-up tasks.
- [ ] Add CSV/XLSX sheet/header mapping and validation preview.
- [ ] Handle ambiguous/serial dates, formulas, duplicates and invalid rows.
- [ ] Add explicit atomic/idempotent commit, result counts and safe CSV export.
- [ ] Test synthetic fixtures and a copy of user spreadsheet before actual import.

Acceptance: Only accepted rows commit; retry creates no duplicates; dangerous export cells remain text.

## M8 — workout rotation and analytics

Dependency: Basic flexible workout rotation joins Habits priority 2; broader analytics stays later and application analytics follows M7.

- [x] Add simple revision-preserved rotation with explicit completion advance/rest/manual next/latest undo.
- [ ] Add older rotation-event replay if needed after daily use.
- [x] Protect retry/stale/double completions and preserve historical planned/actual labels.
- [ ] Add date-filtered analytics with accessible tables and exports.
- [ ] Compare time/habit/workout totals against hand-calculated fixtures.

Acceptance: Rest/missed days do not advance; completion advances once; undo restores prior state; charts match fixtures.

## M9 — Apple Calendar

Dependency: After daily workflow is reliable.

- [ ] Implement one-time ICS export with stable UIDs, timezone and all-day semantics.
- [ ] Test optional private subscription on actual devices before promising support.
- [ ] Add revocable read-only feed tokens and cancellation tombstones if viable.
- [ ] Document refresh/private-network limits; defer two-way sync to separate design.

Acceptance: Rescheduling/cancellation/DST tested, tokens revocable and summaries private; file export remains usable if private subscription fails.
