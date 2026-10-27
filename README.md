# Planner

Private personal productivity app. Sprint 1 implements the Midnight Focus Home, recurring learning activities, persistent timers and manual time logs. Phase 2 adds a functional Habits page and Phase 3 adds goal directions and in-calendar habit logging; other future modules have clearly labelled placeholders. See [progress](docs/PROGRESS.md) and [tasks](docs/TASKS.md).

## Run locally

Use Node 22 (see .nvmrc) and npm. From this folder:

```sh
npm ci
npm run dev -- --port 3123
```

Open http://127.0.0.1:3123. The app binds to loopback. SQLite migrations and idempotent defaults run automatically on first database access. Existing data is preserved. Initial timezone is America/Toronto; no routine clock times are assumed.

The default database is `./data/planner.db`. Optional server settings are in `.env.example`; Next loads `.env.local`. Standalone database scripts use exported environment variables, not `.env.local`:

```sh
DATABASE_PATH=./data/planner.db npm run db:migrate
DATABASE_PATH=./data/planner.db npm run db:seed
```

Keep databases, backups and environment files out of Git. Before schema changes, make a consistent SQLite backup using the SQLite backup API (copying only the live .db file can omit WAL changes).

## Checks and production preview

```sh
npm test
npm run lint
npm run typecheck
npm run format:check
npm run build
npm start -- --port 3124
```

Run type generation/build sequentially. Tests use temporary synthetic databases, including concurrent process checks. For an isolated preview, prefix start with `DATABASE_PATH=/private/tmp/planner-preview.db`. A local production preview is not a server deployment.

## Working behavior

- Home defaults to laptop week / phone day, with a saved view preference, date controls and phone swipe handling.
- Flexible routines can be moved, skipped, edited or completed; one-off fixed events have explicit start/end. Sunday is optional. Quick completion records no time.
- One timer runs globally. Pause closes a segment; resume starts another. Refresh or browser closure does not stop it. Finish can optionally complete the activity.
- Manual logs require valid past intervals and explicit overlap confirmation. Closed sessions drive time metrics; a running timer stays separate until saved.
- Version checks protect concurrent edits. Updates refresh every 15 seconds and on focus/reconnection. Writes require a matching browser origin and JSON.

## Habits

Open `/habits` from the navigation. Create a binary, quantity or workout habit; choose daily, selected weekdays or a flexible weekly count. Select a date to log/correct progress or review that week's history. Quantity values are daily totals (up to three decimal places), with awareness-only, minimum or maximum targets. Saving again replaces the same day's value.

Edit creates new settings without changing recorded history. Archived habits and their entries remain available under Archived; restore to resume new logs. Workout actual type is independent of the plan. Advance the rotation explicitly, or use Plan next workout to choose a step/date. Rest/missed days never advance it. Older rotation undo after a later plan change is intentionally blocked; its actual workout label can still be corrected.

The Habits migration is applied automatically when the database opens, or with the migration command above. Restart a long-running development server after pulling schema changes. Home shows clickable habit cards inside its weekly/day calendar. Open a card to log or correct that date, then Save and close. Build, limit and avoid goals distinguish explicit zero from missing data. Older revisions retain safe compatibility defaults without rewriting saved history.

## Project map and deployment

`src/features` contains Home/timer UI; `src/server/services` contains domain rules; `src/server/db` contains schema/connection; `drizzle` contains versioned migrations. `PROJECT_PLAN.md` preserves the long-term specification with the latest calendar-first habit clarification; `docs` records current scope, architecture, decisions and verification.

Deployment remains future work: one Next.js container serves both frontend and backend, with SQLite on persistent local storage and private HTTPS through Tailscale. No separate frontend, backend or database service is needed. Authentication/access policy, Docker, scheduled backups and restore rehearsal are not yet implemented. APP_ORIGIN is an origin guard, not authentication; keep this local until the private deployment gate is completed.
