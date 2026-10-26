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

Roadmaps, milestones, projects/goals, habits, jobs/import, workout rotation, analytics and Apple Calendar are future modules. Import will use validation preview and explicit commit. Calendar starts with ICS export; private subscriptions may not be reachable by Apple infrastructure and refresh asynchronously. Two-way sync is not promised.
