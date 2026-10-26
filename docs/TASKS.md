# Development tasks

Current phase: **Sprint 1 A–F implemented; verification and limits in PROGRESS.md**. The broader release backlog below is not the sprint completion checklist. See SPRINT_1.md.

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
- [ ] Atomic timer switching (retry-safe start, pause/resume and stop already implemented).
- [x] Add persistent timer display and multi-device reconciliation.
- [ ] Existing-log correction (manual addition and overlap confirmation already implemented).
- [x] Test restart recovery, concurrent starts, retried stops, midnight and DST.

Acceptance: Closing browser/restarting app preserves timer; one running segment; completion never invents time.

## M4 — learning and projects

Dependency: After M3.

- [ ] Create roadmap/milestone/item CRUD, ordering, progress and resource links.
- [ ] Create projects/goals/deadlines using shared tasks.
- [ ] Link session to learning item/project goal; explicit independent completions.
- [ ] Preserve archived links and show next goals/deadlines on Home.

Acceptance: Task completion does not auto-complete learning items/goals; archives retain history and deadlines do not duplicate tasks.

## M5 — habits and MVP summary

Dependency: After M4.

- [ ] Add boolean/quantity habits, effective rules and daily target snapshots.
- [ ] Add retry-safe entry controls, correction and weekly history.
- [ ] Add Home month circles, quantity averages and weekly time/completion summary.
- [ ] Test target changes, units, future/optional exclusion and documented five-day average fixture.

Acceptance: History remains stable; entries aggregate correctly; Home displays distinct daily states and correct averages.

## M6 — deploy and use MVP

Dependency: After M0–M5; server details/access decisions required.

- [ ] Confirm server OS/CPU, storage and owner-only access model.
- [ ] Create Docker/Compose with persistent local storage and startup migrations.
- [ ] Configure private HTTPS/Tailscale and verify unauthorized access denied.
- [ ] Implement consistent backup schedule/retention and perform restore rehearsal.
- [ ] Smoke-test phone/laptop and container replacement; use for seven days and fix friction.

Acceptance: Data survives replacement; verified restore; authorized devices connect; MVP gates pass before expansion.

## M7 — applications and import

Dependency: After MVP gate.

- [ ] Add application records, status history and linked follow-up tasks.
- [ ] Add CSV/XLSX sheet/header mapping and validation preview.
- [ ] Handle ambiguous/serial dates, formulas, duplicates and invalid rows.
- [ ] Add explicit atomic/idempotent commit, result counts and safe CSV export.
- [ ] Test synthetic fixtures and a copy of user spreadsheet before actual import.

Acceptance: Only accepted rows commit; retry creates no duplicates; dangerous export cells remain text.

## M8 — workout rotation and analytics

Dependency: After MVP gate; M7 precedes application analytics.

- [ ] Add versioned workout steps and completion/rest/override/undo.
- [ ] Protect concurrent/double completions and preserve historical step labels.
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
