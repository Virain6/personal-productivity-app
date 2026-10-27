# Development tasks

Current phase: **Sprint 4 Home refinement and safe quick actions complete; ready for deployment preparation.**

## Active priority order

1. Home completion and polish (current phase completed within the verification limits in PROGRESS.md).
2. Habits integrated directly into Home: binary/quantity first, then flexible workouts and history.
3. Home-server deployment for daily Mac/iPhone use, with private access and verified backups.
4. Learning Roadmaps and Projects.
5. Job Application Tracker and integrations.

This order supersedes the original milestone ordering and release gate, not the long-term requirements. Milestone IDs below remain stable references. The daily-use MVP gate is Home + Habits + deployment; Learning/Projects no longer block deployment. Home calendar logging and the separate Habits management/history page are functional. Monthly statistics remain future work.

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
- [ ] Create Docker/Compose with persistent local storage and startup migrations.
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
