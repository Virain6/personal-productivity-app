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
