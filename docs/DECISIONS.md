# Decisions

## 2026-10-24 — Limit this session to M0a initialization

Decision: split the plan's M0 into M0a (starter/documentation/tooling) and M0b (minimal persistence before tasks). No database packages, schema, seeds or product features in M0a.
Reason: the explicit initialization request is narrower than the original M0 checklist. Keep the original plan unchanged and track the difference here.
Alternative: implement all original M0 work now; rejected because it exceeds the current request. M0 stays incomplete until both parts are verified.

## 2026-10-24 — Canonical documentation lives in docs/

Decision: docs/PROGRESS.md is the single progress journal, accompanied by TASKS, ARCHITECTURE and DECISIONS. Original plan references to PROGRESS.md mean this file.
Reason: follow the requested folder organization without duplicating trackers or rewriting the user specification.

## 2026-10-24 — One Next.js application; npm and Node 22

Decision: Next.js App Router, React, strict TypeScript, Tailwind; npm with exact direct versions and a lockfile. Node 22 is the local runtime line. SQLite/Drizzle remains the planned persistence stack.
Reason: matches the plan and existing local tooling, with no separate backend to maintain. Native SQLite driver compatibility is verified at M0b and again for the home-server architecture before deployment.
Alternative: hosted database/separate API; unnecessary for this single-user app.

## 2026-10-24 — Minimal local UI components

Decision: semantic HTML and Tailwind with small local components, using system fonts. Do not install a component kit yet.
Reason: no complex interaction is being implemented. Add an accessible primitive library only when a concrete feature benefits from it.

## 2026-10-24 — Verification grows with behavior

Decision: initialize lint/typecheck/build and formatting checks now. Introduce the test runner with the first database/domain slice; no placeholder tests or test script claiming absent coverage.
Reason: initialization has no domain behavior. First meaningful tests must exercise migration/seed reruns and task persistence.

## 2026-10-24 — Pin the compatible lint toolchain

Decision: use ESLint 9.39.5 with eslint-config-next 16.4.3.
Reason: ESLint 10 installs but the bundled import, accessibility and React plugins declare peer support only through 9; npm ls reports an invalid tree with 10. Version 9 is deprecated upstream, so track an upgrade once those plugins support 10. Do not suppress peer checks or force an invalid install. This is development tooling, not application runtime.

## 2026-10-24 — Sprint 1 scope and UI primitives

The latest user request authorizes phases A–F, beyond initialization. Use local Geist and Lucide; small Radix-backed dialog composition rather than a large component catalog. No suggested clock times in seeded routines. Preserve original plan; fixed events and completion event history extend its initial model.

## 2026-10-26 — Sprint persistence and origin verification

Use better-sqlite3/Drizzle with transactions and database constraints for single-timer and occurrence identity guarantees. Keep completion history separate from time. Reject a second running timer rather than silently switching; atomic switch and existing-log correction remain later work.

Browser testing exposed Next's internal localhost URL normalization when the browser uses 127.0.0.1. Validate the actual Host and Origin pair (or explicit APP_ORIGIN), not the normalized request URL hostname. Regression tests cover foreign hosts/origins and configured proxy origins.

Retry the same payload with its original mutation key after uncertain network/server failure. A fresh key after failure could duplicate saved manual logs. Browser test data uses a separate temporary database.

## 2026-10-26 — New daily-use priorities and Home completion

Latest user instructions supersede milestone order: Home, Habits, deployment, Learning/Projects, Jobs/integrations. Preserve the original specification rather than deleting later requirements. Basic workout rotation now belongs to the Habits sequence; richer analytics remains later. No Habits implementation during Home verification.

Home follow-up now supports atomic confirmed timer switching and saved-session correction. Corrections compare original values under an immediate transaction, preserving identity and source; no schema migration required. Planned minutes include optional and skipped activities to match the original reporting definition. Actual minutes are allocated to worked dates, not a moved task's date.

## 2026-10-26 — Habits Foundation: daily records and immutable settings

The latest phase asks for three types, editable type/unit/target/schedule, duplicate daily prevention and simple workout rotation. Implement one daily total/state record per habit/date, with a unique index and optimistic version, rather than the original multi-increment model. Store quantity as integer thousandths; allow zero, optional minimum/maximum targets and awareness-only. No maximizing assumption. Multi-increment logging remains a future deliberate extension.

Use three additive tables: stable habits, immutable effective-date configuration revisions, and daily records referencing their original revision. Configuration JSON is validated server-side; no separate tables are needed for every small setting or rotation step in this version. This supports editing type/unit without silently converting historical data, superseding the earlier immutable-unit UI proposal. Existing recorded dates keep their old definition; new dates use the latest eligible revision.

Reuse the same guarded planner endpoint and transactional mutation receipts. Explicit expected versions protect updates and rotation changes. Missed/rest days do not advance; alternate actual workout is saved separately; advancement requires an explicit choice. Undo only the latest unchanged pointer effect; reject earlier rewind rather than implementing event replay. Manual next-step/date changes are independent of historical records.

Migration is additive and was preceded by a consistent verified backup. No Home integration or changes to Home's data model in this phase.

## 2026-10-27 — Goal direction and calendar-first habit logging

Keep measurement and goal direction separate. Extend validated configuration JSON with build/limit/avoid; interpret older revisions with safe read-time defaults instead of rewriting history. Retain awareness-only quantities and normalize new limits/avoid targets. The existing three-table schema is sufficient; no migration/reset needed.

The clarified resume request supersedes the interrupted separate Home Habits section. Derive date-specific habit cards and render them through the existing agenda, with a small dedicated card rather than adding habit branches to task-specific timer controls. Do not create task copies. Reuse the existing services, command transport and Radix dialog; keep a captured versioned draft until saved or explicitly discarded.

Flexible weekly habits are available on any day and labeled flexible. An explicit workout date overrides unrecorded future schedule placement. Archived and unscheduled recorded history stays visible, while new archived/unscheduled instances do not appear. Future rotation labels show the current pending step only; no date-based advance. Monthly analytics and deployment stay outside this sprint.

## 2026-10-28 — Learning roadmap management milestone

Use the requested Roadmap → Sections → Learning Steps hierarchy. Manual step completion is mastery; time and current-topic selection remain separate. Reuse existing task-category identifiers with user-facing learning labels. Category time sums existing closed sessions, clearly labeled; per-roadmap/session attribution waits for explicit associations. Soft deletion and archive preserve records. Version checks and existing command receipts protect stale edits and retries. Finish this independently tested management milestone before adding optional session links and Home controls; long-term requirements remain unchanged.

## 2026-10-29 — explicit study attribution

Use two additive association tables instead of altering existing task/time rows. Activity topic is an optional per-occurrence default; session topic is the actual attribution and can differ. Snapshot labels when a link is created or deliberately changed; roadmap renames never rewrite historical labels. Keep null-link version rows for concurrency protection. Inactive defaults do not break time logging. Attach links within existing transactions, including timer switches. No automatic category-wide roadmap choice, inferred mastery, template editor or duplicate time ledger.

## 2026-10-30 — module schedule identities and reporting

Keep one optional weekly schedule per roadmap or module. Reuse stable weekday activity-template IDs plus immutable effective-date configuration revisions, rather than replacing templates on each edit. Existing template/date uniqueness and retained cancelled occurrence rows prevent regeneration duplicates. Version-based exception detection preserves manually edited/moved, started/logged, completed/skipped and explicitly linked tasks. This refines the original plan's replacement-template proposal without changing its history-preservation requirement.

Linking an existing template adopts one weekday activity; other selected days create new templates. The form discloses this rather than silently merging potentially unrelated existing activities. Schedule removal is reversible configuration, not physical deletion. Archive pauses schedules; restore does not unexpectedly resume them.

Add stable section attribution to session links, backfilled from existing steps, so module history survives renames/reordering/archive and module-only time remains possible when no next step exists. Keep original session duration authoritative. Monthly consistency measures completed elapsed scheduled days, independently of recorded study and mastery; today/future/rest days are excluded. Counts use local start date, while actual time splits at local midnight/DST.

Complete and verify the module/scheduling milestone before beginning Markdown import, as permitted by the resume request and repository milestone workflow. Preserve all original long-term requirements and staged work; no automatic deployment.

## 2026-10-30 — Sprint 6.6 removes user-facing learning categories

Roadmap → Modules → Steps is the sole Learning hierarchy. Retain legacy category columns and optional command fields to avoid destructive migration, but remove category controls and presets from new learning workflows. Roadmap color is a validated palette key with a purple migration default. Fresh seed stops inserting learning templates; existing installations are never cleaned automatically.

Keep roadmap/module schedules explicitly additive, with one stable series per scope. Do not silently merge sessions on matching weekdays: their durations/topics may differ. Both schedule panels disclose the consequence. Existing deduplication protects occurrence identities; renamed roadmaps update only untouched managed tasks, preserving historical titles and saved session snapshots. Legacy preset retirement requires separately reviewed IDs and a verified backup.

## 2026-10-31 — correction: modules never own recurrence

The user's explicit correction supersedes the October 30 additive module-schedule decision. Only roadmaps recur; modules/steps organize content and attribute study. Preserve legacy module schedule rows for history, block their generation, and retire eligible future instances explicitly. Study Anytime uses the same task/timer transaction, reusing an open date activity unless the user requests an additional one.

Use additive retirement markers rather than deleting old unworked tasks. Close exact identified seed templates to prevent regeneration; preserve meaningful history and edits. Cleanup is an explicit backup-first tool, never a startup migration. The user authorized applying it to the local development database only. Production requires a separately reviewed run and remains untouched.

## 2026-11-02 — Sprint 7A.1 first, with explicit metric contracts

Complete Analytics foundations as one tested milestone before habit reporting/reflections or calendar interaction changes, following the user's allowed milestones and AGENTS workflow. Preserve the complete Sprint 7 request in docs/SPRINT_7.md. The later weekly reflection fields are specifically authorized without expanding into a standalone notes feature.

Use the existing saved-session and occurrence tables as sources; no schema change or new event ledger for this milestone. Label all time as tracked time rather than claiming every activity is productive. Time is additive per saved record, clipped at timezone-aware boundaries; overlapping records explicitly accepted by the user remain additive. Task completion is current state on planned dates; mastery is current step state. Both are disclosed rather than presented as historical event counts.

Use Recharts 3.10.1 with matching react-is 19.3.1, pinned in the lockfile, for responsive axes and accessible interactive tooltips. Load it only on Analytics and retain exact-value tables. Simple selectable roadmap distribution rows reuse existing colors. Do not add a heavyweight chart dependency to Home or replace its existing progress components.

The subsequent resume request refines the remaining order: 7A.2 learning/habit analytics, 7A.3 saved Weekly Review, 7B.1 Month view, 7B.2 rescheduling/Quick Add and 7B.3 mobile polish. Finish and verify the existing 7A.1 work before starting these; no completed implementation is restarted.

## 2026-11-03 — evidence-based learning and habit analytics

Derive 7A.2 from existing records and historical habit rules without schema changes. Keep daily adherence, flexible weekly quotas, current mastery and recorded time separate. Show period-bounded verified runs instead of claiming all-time streaks. Preserve historical quantity units/targets. Unknown archive/rest history is disclosed rather than reconstructed from current flags/cursors. Stop at 7A.2; Weekly Review and Calendar milestones remain pending.

## 2026-11-03 — Weekly Review stores reflections, not statistical snapshots

Reuse Analytics over Monday–Sunday ranges and persist only the three expressly authorized reflection fields. Dynamic statistics reflect later corrections. One primary-key week plus optimistic versions and existing retry receipts protects edits. Keep browser-session recovery drafts distinct from server-saved reviews; no automatic empty records or offline mutation queue. Limit each reflection field to 3000 characters. Stop after verified 7A.3; 7B requires a later request.
