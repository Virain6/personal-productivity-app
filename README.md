# Planner

Private personal productivity app. Sprint 1 implements the Midnight Focus Home, recurring learning activities, persistent timers and manual time logs. Future modules have clearly labelled placeholders. See [progress](docs/PROGRESS.md) and [tasks](docs/TASKS.md).

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

## Project map and deployment

`src/features` contains Home/timer UI; `src/server/services` contains domain rules; `src/server/db` contains schema/connection; `drizzle` contains versioned migrations. `PROJECT_PLAN.md` remains the original specification; `docs` records current scope, architecture, decisions and verification.

Deployment remains future work: one Next.js container serves both frontend and backend, with SQLite on persistent local storage and private HTTPS through Tailscale. No separate frontend, backend or database service is needed. Authentication/access policy, Docker, scheduled backups and restore rehearsal are not yet implemented. APP_ORIGIN is an origin guard, not authentication; keep this local until the private deployment gate is completed.
