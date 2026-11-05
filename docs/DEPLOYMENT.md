# Planner deployment — mblx-home-server

Prepared configuration; actual Ubuntu/Tailscale/iPhone deployment has not been performed. One container serves UI and API; SQLite stays on host local disk. Do not run commands until their preflight conditions pass. These commands affect only the `planner` Compose project; never run global Docker prune, restart Docker, reset Serve, or change another application's mounts/ports.

Known from your server check (not independently verified): x86_64, Docker 29.2.1, Compose 5.1.0, 7.7 GiB RAM with approximately 4.9 GiB available, 4 GiB swap with 2.4 GiB used, port 3100 apparently free, and Tailscale not installed. Verify disk space/filesystem and exact Ubuntu release. Existing swap use makes a quiet build window advisable; do not tune or restart other services.

## 1. Server preflight (read-only)

Run these yourself on the server; this sprint does not authorize the agent to connect:

```sh
ssh virain@mblx-home-server
hostname
cat /etc/os-release
uname -m
free -h
df -h /home/virain
findmnt -T /home/virain
docker version
docker compose version
docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
sudo ss -ltnp 'sport = :3100'
command -v tailscale || true
```

Confirm supported Ubuntu LTS, local disk (not SMB/NFS), architecture `x86_64` or `aarch64`, Docker daemon access and modern Compose with `up --wait`/long bind syntax. The locked SQLite package includes Linux x64/arm64 native binaries, and the image build explicitly loads the target binary; do not copy Mac node_modules or select an unrelated platform. Allow several GB free for build layers and at least roughly 2 GB spare memory for compilation; measure actual pressure alongside Immich and media workloads. Build during a quiet period. If Docker/Tailscale is missing, stop and follow the official installation guide for that Ubuntu version; do not replace existing installations or restart the shared daemon blindly. Docker group access is root-equivalent.

Port 3100 must be free. If occupied, choose an unused port in `.env` via `PLANNER_PORT`, keep the loopback binding and update the Serve target. Check that the Compose project name `planner` is not already used. If it is, inspect it before proceeding. Preserve the current Serve configuration in a private file outside Git before changing anything. Never use `tailscale serve reset` or Funnel.

## Install Tailscale when absent

Keep the existing SSH session open. These commands install only Tailscale; do not enable Tailscale SSH, advertise routes, select an exit node, modify sshd, or replace host firewall rules. Review the vendor installer before running it. It selects the repository for the detected Ubuntu release. Skip installation if Tailscale is already present and inspect it instead.

```sh
curl -fsSL https://tailscale.com/install.sh -o /tmp/planner-tailscale-install.sh
less /tmp/planner-tailscale-install.sh
sudo sh /tmp/planner-tailscale-install.sh
sudo tailscale up
tailscale status
tailscale status --json
tailscale serve status
tailscale serve status --json
sudo ss -ltnp 'sport = :8443'
```

Authenticate with your owner account using the URL shown by `tailscale up`. Do not use `--ssh`. Confirm ordinary SSH still works in a second terminal. Install the official Tailscale app on Mac/iPhone and sign in to the same approved tailnet. Review the access policy in section 5 before enabling Serve. See the [official Linux setup](https://tailscale.com/docs/install/linux) and [device downloads](https://tailscale.com/download).

## 2. Checkout and environment

The files must first be reviewed, committed and pushed by you; this sprint does not push. Use your existing GitHub credentials, never a token embedded in a URL. If `/home/virain/planner` already exists, inspect its Git status/remotes instead of cloning over it.

```sh
cd /home/virain
git clone https://github.com/Virain6/personal-productivity-app.git planner
cd /home/virain/planner
git status --short
git log -1 --oneline
test -e .env || cp .env.example .env
chmod 600 .env
```

Edit `.env` (do not commit it). Replace the example origin with the actual Tailscale DNS name and chosen HTTPS port. Obtain DNSName from `tailscale status --json` under `Self`; remove its trailing dot. Example configuration:

```dotenv
APP_ORIGIN=https://mblx-home-server.ACTUAL-TAILNET.ts.net:8443
PLANNER_PORT=3100
PLANNER_IMAGE_TAG=initial
PLANNER_DATA_DIR=/home/virain/planner/data
PLANNER_BACKUP_DIR=/home/virain/planner/backups
```

Port 8443 is a suggested dedicated Serve HTTPS listener only if free in both `ss` and Serve status. Use 443 only when it is entirely unassigned; never overwrite an existing root handler or host another app at Planner's root. Planner is built for `/`, not a `/planner` subpath. Keep the exact scheme/host/port in APP_ORIGIN, without a trailing slash/path. It is an origin check, **not authentication**. Compose sets DATABASE_PATH inside the container; a local DATABASE_PATH line in `.env.example` does not override it.

## 3. Storage and permissions

Create these new directories only. If they already contain data, inspect ownership and back up before changing permissions. Do not recursively chown another service's directory.

```sh
sudo install -d -o 10001 -g 10001 -m 0700 /home/virain/planner/data
sudo install -d -o 10001 -g 10001 -m 0700 /home/virain/planner/backups
docker compose config --quiet
```

Container UID/GID is 10001:10001. The database plus WAL/SHM live together in `/app/data`. Backups live in `/app/backups`. Bind mounts refuse to create missing host directories; startup will fail visibly if ownership is wrong. Keep one replica. `docker compose down`/container recreation preserves these bind-mounted directories; deleting the directories does not.

To move existing Mac data, make a safe snapshot with the tool below and transfer the snapshot privately. Restore into a new empty server data directory before first startup. Never copy just an actively used database or overwrite a live database.

## 4. Build, migrate, start and inspect

```sh
cd /home/virain/planner
docker compose build --pull planner
docker compose run --rm --no-deps --entrypoint node planner scripts/deploy-db.mjs migrate
docker compose up -d --no-deps --wait planner
docker compose ps
docker compose logs --tail=100 planner
curl --fail http://127.0.0.1:3100/api/health
```

The entrypoint also checks migrations on every startup before accepting requests. If an existing database has pending migrations, it first creates and verifies a SQLite snapshot in the persistent backup directory; backup failure prevents migration. No extra snapshot is created when there are no pending migrations. Fresh empty databases have nothing to back up. Stop Planner before upgrade migrations to avoid concurrent schema use. A failed migration exits with a clear log and does not start Next. Drizzle transactions and its journal avoid repeating applied migrations. The migration command does **not** seed data. The existing application initializes its idempotent real default schedule on first API access, inserting missing defaults without overwriting existing rows; no development/test fixtures are shipped or run. Production health is read-only and returns 503 for missing/unmigrated databases. Docker marks unhealthy containers but does not automatically restart a merely unhealthy process; inspect logs instead of assuming restart policy repairs it.

The image uses current patches of supported Node 22 Maintenance LTS, compatible with the lockfile/engines, on Debian glibc. Node 22 support ends April 2027; plan a tested runtime upgrade before then. Build compilers are absent from runtime. Rebuild with `--pull` for patches, record the final image ID, and retain the prior tested image for rollback. No separate database/frontend/backend services are needed.

## 5. Private HTTPS and authorization

Before enabling access, review the existing tailnet policy. Every identity/device able to reach Planner can read and change all app data: there is no app login. Tailnet membership alone is not owner-only authorization. Add a narrow grant for your actual owner identity/device group to this server's selected HTTPS port, and verify no broader existing grant/ACL permits other users. Grants are additive: adding a narrow rule does not cancel an existing allow-all. Do not replace the entire policy or disturb permissions for Immich/other services. If owner-only policy cannot be enforced, stop before loading personal data and design authentication separately.

Example fragment to adapt and merge after review (not a complete policy):

```json
{
  "grants": [
    {
      "src": ["YOUR-OWNER-IDENTITY"],
      "dst": ["SERVER-TAILSCALE-IP"],
      "ip": ["tcp:8443"]
    }
  ]
}
```

Also audit node sharing, authorized devices, account protection, and any existing Funnel configuration. Local host users and Docker administrators can access loopback/backups and are trusted. Do not forward router ports, publish port 3100 on LAN, or grant access using forwarded identity headers.

Only after confirming HTTPS 8443 is unused and owner access is restricted:

```sh
sudo tailscale serve --bg --https=8443 http://127.0.0.1:3100
tailscale serve status
```

Follow Tailscale's HTTPS/MagicDNS enablement flow if required. Read the actual private HTTPS URL from status; do not guess the tailnet suffix. If it differs from `.env`, correct APP_ORIGIN and recreate only Planner:

```sh
docker compose up -d --no-deps --force-recreate --wait planner
```

On an authorized Mac/iPhone connected to Tailscale, visit that URL and verify Home, Habits and a reversible test log. Check persistence after refresh and another device's refresh. Verify denied access from an unauthorized tailnet identity and from outside Tailscale before personal use. If writes return 403, compare exact browser origin and upstream Host with APP_ORIGIN. Do not remove the origin guard as a workaround.

To remove **only this newly created dedicated listener**, use `sudo tailscale serve --https=8443 off` after verifying it still belongs to Planner. Never reset shared Serve configuration.

## 6. Install on iPhone and Mac

On iPhone: connect Tailscale, open the actual HTTPS URL in Safari, Share → Add to Home Screen, enable Open as Web App if offered, name it Planner, Add. On Mac (macOS Sonoma or later): open the same URL in Safari, File → Add to Dock (or Share → Add to Dock), name Planner, Add. Verify icon, standalone window, safe-area spacing, keyboard, swipe and timer lock/resume on the real devices.

Manifest: `/manifest.webmanifest`, root start URL/scope, standalone mode, charcoal theme and 192/512 PNG icons plus Apple 180px icon. Existing in-app navigation remains necessary. No service worker, offline write cache, push or background sync is added. Server/Tailscale must be reachable; installation does not make the app offline-capable. Existing server timestamps keep timers persistent. Offline/reconnect and real installation remain device acceptance tests, not verified by a manifest alone.

## 7. Consistent backups and isolated restore

Back up online using SQLite's backup API, including committed WAL data:

```sh
cd /home/virain/planner
docker compose exec -T planner node scripts/deploy-db.mjs backup /app/backups
```

Verify any snapshot again before transfer/restore:

```sh
docker compose exec -T planner node scripts/deploy-db.mjs verify /app/backups/BACKUP-DIRECTORY/planner.db
```

The tool prints a unique snapshot path with `metadata.json` beside it (UTC timestamp, SHA-256, migration journal). It checks integrity and foreign keys. Files are private, and existing backups are never overwritten. Record the matching image ID/revision with each release backup. Copy complete snapshot directories to a separate protected device/location; a backup on the same disk is not disaster recovery.

Schedule the backup command daily using the user's existing host scheduler. A crontab example (add one line, do not replace existing jobs):

```cron
15 3 * * * cd /home/virain/planner && /usr/bin/docker compose exec -T planner node scripts/deploy-db.mjs backup /app/backups >> /home/virain/planner-backup.log 2>&1
```

Check Docker's absolute path first, restrict the log permissions, inspect failures and rotate that log. Keep at least seven daily and four weekly verified snapshots; rotate only after verifying off-host copies and a restore. This sprint deliberately does not install a schedule or automatically delete backups.

Restore requires the matching metadata.json (checksum is checked before restore) and a **new empty destination** and rejects any existing DB/WAL/SHM. For a rehearsal, substitute the printed snapshot directory below; the original data directory stays untouched:

```sh
sudo install -d -o 10001 -g 10001 -m 0700 /home/virain/planner/restore-test
PLANNER_DATA_DIR=/home/virain/planner/restore-test docker compose run --rm --no-deps --entrypoint node planner scripts/deploy-db.mjs restore /app/backups/BACKUP-DIRECTORY/planner.db
PLANNER_DATA_DIR=/home/virain/planner/restore-test docker compose run --rm --no-deps --entrypoint node planner scripts/deploy-db.mjs migrate
```

For an isolated HTTP rehearsal, use a different project/port and data mount, never production data:

```sh
PLANNER_DATA_DIR=/home/virain/planner/restore-test PLANNER_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p planner-restore up -d --no-deps --wait planner
curl --fail http://127.0.0.1:3101/api/health
PLANNER_DATA_DIR=/home/virain/planner/restore-test PLANNER_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p planner-restore restart planner
PLANNER_DATA_DIR=/home/virain/planner/restore-test PLANNER_PORT=3101 APP_ORIGIN=http://127.0.0.1:3101 docker compose -p planner-restore up -d --no-deps --force-recreate --wait planner
```

Verify sample tasks, habits, logs and timer state before/after through an SSH tunnel to 3101 or local browser. Run `down` for **planner-restore only**, with the same variables, after verification; its bind data remains. Confirm port 3101 is unused first. This process is also the required container persistence acceptance test; it has not yet been run here because the local Docker daemon is unavailable.

## 8. Updates and rollback

Before updating, note the running image ID and create a matching backup; stop only Planner while changing schema. Build before downtime where possible. Use a unique image tag for each reviewed revision in `.env`:

```sh
cd /home/virain/planner
git status --short
docker inspect --format '{{.Image}}' "$(docker compose ps -q planner)"
docker compose exec -T planner node scripts/deploy-db.mjs backup /app/backups
git pull --ff-only
```

If Git reports local changes/conflicts, resolve them without resetting data or configuration. Set PLANNER_IMAGE_TAG to the new short commit ID, then:

```sh
docker compose build --pull planner
docker compose stop planner
docker compose run --rm --no-deps --entrypoint node planner scripts/deploy-db.mjs backup /app/backups
docker compose run --rm --no-deps --entrypoint node planner scripts/deploy-db.mjs migrate
docker compose up -d --no-deps --wait planner
docker compose logs --tail=100 planner
curl --fail http://127.0.0.1:3100/api/health
```

Stop if any command fails; do not blindly run the next one. Verify the private URL and writes. Never `down -v`, prune images globally, or overwrite bind data. Preserve the old image tag. For code-only rollback with confirmed schema compatibility, select the old tag and `docker compose up -d --no-build --no-deps --wait planner`.

If migrations changed schema, stop Planner and restore the pre-update backup to a new directory with the backup's matching image. Update PLANNER_DATA_DIR and PLANNER_IMAGE_TAG in `.env` together, then start with `--no-build`. Preserve the failed database directory for diagnosis; do not overwrite it. Restoring a snapshot loses subsequent writes from the active view, so choose the snapshot deliberately and keep the newer database. There is no automatic down-migration.

## 9. Troubleshooting and remaining gates

- Native module error: rebuild on target Linux architecture; never reuse host node_modules. The locked package supplies Linux x64/arm64 binaries; the build fails early if the target binary cannot load. Unsupported architectures require a separately tested native build.
- EACCES: check only Planner's data/backup path ownership (10001:10001), local filesystem and space. Do not use world-writable permissions.
- Migration failure/restart loop: inspect Planner logs; stop Planner, preserve data, restore a verified snapshot into a new directory if necessary. Never delete the migration journal.
- Unhealthy: inspect `/api/health`, DB permissions and logs; health reveals no personal data. Restart policy handles process exit, not arbitrary unhealthy status.
- 403 writes: exact APP_ORIGIN including nondefault HTTPS port; proxy must preserve Host. Health bypasses origin checks but exposes only status.
- Serve conflict: inspect status and choose an unused dedicated HTTPS port; preserve other root handlers. Never reset Serve or enable Funnel.
- Missing app icon/install option: use HTTPS Safari, confirm manifest/icons return 200, supported OS, then reinstall only the app shortcut if necessary.
- Offline: reconnect Tailscale and server; no offline writes are promised.

Required before calling production verified: exact Ubuntu version and disk space/filesystem, confirmation of the supplied architecture/resources, free host/Serve ports, actual DNS/origin, reviewed owner-only policy, successful target image build and native module load, restart/recreation persistence, restore rehearsal, Mac/iPhone install and unauthorized-device denial. No actual server was contacted in this sprint.

## References checked for this preparation

- [Node release schedule](https://github.com/nodejs/Release): Node 22 Maintenance LTS through April 2027.
- [Tailscale Serve CLI](https://tailscale.com/docs/reference/tailscale-cli/serve): private HTTPS listener, status inspection and per-listener removal.
- [Tailscale grants](https://tailscale.com/docs/features/access-control/grants): review additive access policy, not just tailnet membership.
- [Apple Mac web apps](https://support.apple.com/en-ie/104996) and [iPhone Add to Home Screen](https://support.apple.com/en-mide/guide/iphone/iph42ab2f3a7/27/ios/27).

## Sprint 6 roadmap migration (0003)

The user reports the server and Mac/iPhone PWAs are live. Sprint 6 development does not authorize a deployment. Migration `0003_stiff_leopardon.sql` adds only `roadmaps`, `roadmap_sections`, `learning_steps` and their indexes; it seeds no roadmap or replacement data. The upgrade has been tested against a populated isolated previous schema, including a running timer. Session/Home associations are added by migration 0004 below.

For a separately authorized release, follow the update sequence above: retain the running image ID/tag, build the reviewed new image, stop only Planner, take and verify a fresh SQLite backup, run the migration tool, then start and check health and existing Home/Habits plus Learning writes. Startup also backs up before pending migrations and fails closed on backup failure. Do not run development seeds on production. No manual SQL or database reset is needed. Preserve the backup, metadata and old image. For rollback use the documented matching image/snapshot restored to a new directory; there is no down-migration. Rehearse this release with a restored copy before using the live database.

## Sprint 6 integration migration (0004)

`0004_funny_garia.sql` adds only `task_learning`, `session_learning` and a step index, with foreign keys to existing tasks/sessions/roadmap records. Existing data remains untouched and initially unlinked. An upgrade from Sprint 5 applies 0003 then 0004 in journal order; a database already on 0003 receives only 0004. Keep both SQL files, snapshots and the complete migration journal in the release. Do not regenerate, edit or delete old migration history. Both upgrade paths were tested with populated isolated records; no production database was accessed.

Before an authorized release, review/commit the complete Sprint 6 work, retain the deployed image tag and verify a restorable backup. Follow section 8 exactly: build the reviewed image, stop only Planner, create a fresh backup using deploy-db.mjs, run its migrate command and start with Compose. The migration tool verifies its automatic pre-migration snapshot and fails closed. Never seed/reset production. Rehearse against a restored copy first. No separate frontend/backend service or additional environment variable is required.

Acceptance: verify health, old Home/Habits data, a persisted running timer, roadmap creation, optional activity topic, timer/manual session attribution, correction/unlink with unchanged duration, Home topic after refresh, and Learning totals/mastery separation. Check both Mac and iPhone PWAs after refreshing to the new client. For rollback retain the new database and restore the verified pre-update snapshot to a new directory with its matching old image, following section 8; no down-migration is provided. Writes made after the snapshot require deliberate reconciliation. Target image/device validation was not performed during local integration development.

## Sprint 6.5 workspace migration (0005; not deployed)

`0005_daily_donald_blake.sql` adds optional metadata and explicit step status, then backfills Completed for existing completed steps. Include its generated snapshot and updated journal together with all previous migrations. Upgrade tests cover populated databases through 0002, 0003 and 0004; original columns, active timer data and integrity remain intact. Runtime dependencies and environment variables are unchanged.

Do not deploy this sprint automatically. The later module milestone implements template/scheduling integration; Markdown import remains unfinished. When a release is separately approved, follow the existing stop/verified-backup/restored-copy-rehearsal/migrate/start procedure. All pending migrations apply in journal order; never run seeds or edit old migration files. Stop the old app during upgrade and refresh clients before writes: the old version only understands the completion boolean, while the new service synchronizes that boolean and status. Roll back only with the matching old image and pre-upgrade snapshot in a new directory; preserve the newer database for reconciliation.

Rehearsal checks: legacy completed/uncompleted statuses, custom-category roadmap edit/archive/restore, objective/date persistence, existing session labels and durations, timer start/switch/pause, Home/Habits logging, and Mac/iPhone Learning sheet behavior. Target Docker and physical-device checks remain outstanding. No production database was accessed during development.

## Sprint 6.5 module migration (0006; not deployed)

Include 0006_funny_outlaw_kid.sql, its snapshot and the complete journal with prior migrations. It adds four schedule/occurrence association tables, module archive state, and nullable session_learning.section_id; existing step-linked sessions are backfilled with their module ID. No task/time rows are replaced. Populated isolated upgrades through 0002, 0003, 0004 and 0005 pass original-column preservation, integrity and foreign-key checks.

For a separately authorized release: retain the deployed image, build/review the new target image, rehearse migrations and smoke checks on a verified restored copy, then stop Planner, take a fresh verified backup, run the existing deployment migration tool and restart. Apply all pending journal migrations in order. Do not seed/reset data or run old and new app versions concurrently. Refresh Mac/iPhone clients before writes. Rollback requires a matching old image and pre-update snapshot restored to a new location; retain newer data for reconciliation.

Smoke-test existing Home/Habits and running timers, existing session labels/time, new module attribution, linking one existing weekday activity, schedule edit/pause/resume without duplicate occurrences, dynamic Home topics, extra-session date/time, archived history and monthly counts. No new environment variables or services are needed. This milestone is ready for local release review; target Docker/restored-production-copy and physical-device validation are not claimed. Full Sprint 6.5 still has Markdown import outstanding. No production access or deployment occurred.

## Sprint 6.6 migration and optional legacy preset retirement

0007_strong_tana_nile.sql adds only roadmaps.color with default purple. Include its snapshot and journal; retain all previous migrations. No category columns are dropped and no tasks/templates/sessions are removed. Use the existing stop/verified-backup/restored-copy rehearsal/migrate/start procedure, then refresh clients. No new service or environment variable is needed. Target image and physical-device verification remain outstanding.

Fresh initialization no longer inserts learning presets, but existing default-* templates intentionally remain active until explicitly retired. Do not assume a default-looking ID or title means unused data. Safe opt-in cleanup procedure (not executed):

1. On an isolated restored backup, inventory exact candidate template IDs, all generated tasks, task edits/status, time sessions and any study_template_links. Include only learning presets, never Project/Applications or arbitrary custom templates.
2. Review the chosen IDs with the user. If a template belongs to a roadmap schedule, use its reversible Pause/Remove controls instead of changing the underlying template independently.
3. For approved unlinked presets, close the template's effective_until at the chosen cutoff in a reviewed transaction. Retain template/task/session rows. Do not delete time, completion events, moved tasks or edited occurrences.
4. Review already generated future occurrences separately; explicitly skip unwanted pending tasks through existing task controls. Do not bulk-delete them or rewrite historical records. Keep legitimate edited/logged occurrences.
5. Verify repeated generation creates no new post-cutoff occurrences and all historical totals/IDs remain intact. Only then consider a separately authorized live cleanup after another verified backup. Production seed does not re-open retired templates.

This strategy is documented, not an automatic cleanup migration or new archive UI. New roadmap schedules may coexist with retained legacy routines until the user deliberately retires those routines.

## Roadmap-only correction: migration 0008 and explicit retirement

This supersedes the earlier proposed manual preset-retirement strategy. 0008_condemned_guardsmen.sql adds retired_study_tasks only. Ship its snapshot/journal with all prior migrations. Migration alone does not retire presets. New code blocks module recurrence; retirement separately hides eligible pre-generated occurrences and closes legacy seed templates. Existing roadmap colors and all saved time/mastery/history remain unchanged.

Rehearse on a restored backup first. Stop Planner before the production upgrade, preserve the old image, take a verified backup, apply pending migrations with deploy-db.mjs, then preview cleanup. scripts/retire-learning.ts requires explicit DATABASE_PATH; without --apply it opens read-only and prints candidate template/schedule/task IDs plus preserved exceptions. --apply makes another verified SQLite backup before opening/migrating the database and applying the retirement transaction. Review exceptions rather than deleting them. Four meaningful past local occurrences were retained intentionally.

From a reviewed source checkout with Node 22 and npm ci dependencies (not the minimal standalone runtime):

```sh
DATABASE_PATH=/absolute/path/to/restored/planner.db node --import tsx scripts/retire-learning.ts
DATABASE_PATH=/absolute/path/to/restored/planner.db node --import tsx scripts/retire-learning.ts --apply
```

The database must have the Learning schema before preview; use the existing backup-aware migration tool first for older deployments. The source tool is not bundled in the minimal runtime image. For the Ubuntu Docker workflow, build a separate maintenance image from the existing build stage after review (`docker build --target build -t planner-maintenance .`). With Planner stopped, mount the reviewed database at /app/data and backups at /app/backups, run as UID/GID 10001 with no network, and execute the same node --import tsx command against /app/data/planner.db. Use the maintenance image's deploy-db.mjs migrate first if needed. Never run the cleanup against an assumed path or an active production instance.

Afterward verify integrity/FKs, saved session and completion counts, no legacy future learning activities, roadmap recurrence, roadmap-only timer logs, one-off reuse/explicit extras, module history, Home and Habits. Refresh clients. Keep the verified backup and matching previous image; rollback requires restoring that pair to a new location, not deleting retirement markers blindly. Target Docker and actual device rehearsal remain unperformed here.

Local application completed 2026-10-31 only: 15 templates closed, 74 unworked occurrences marked, zero module schedules, four past edited/logged occurrences preserved. Verified backup: backups/backup-2026-10-31T04-05-00-249Z-e3Qyyp/planner.db. No production access or deployment occurred.

## Sprint 7A.1 release considerations

This milestone adds Analytics UI/server aggregation and pinned Recharts/react-is dependencies. It adds **no migration**; the existing migration head remains 0008. Use the updated lockfile with npm ci when building the reviewed image. Existing backup, private-origin and persistent-volume procedures still apply; never reset the database or rerun retirement cleanup just to enable Analytics.

Analytics lazily materializes the requested date range through the same occurrence engine as Home. Saved sessions/habits/mastery are not rewritten. Before a separately authorized release, rehearse the image on a restored copy, inspect a known week against saved logs, and check Mac/iPhone Safari/PWA behavior. Local browser verification is not a target-container or physical-device deployment rehearsal. The full Sprint 7 is not a release-complete claim while 7A.2 and 7B remain pending. No production connection, migration, cleanup or deployment was performed here.

## Sprint 7A.2 release considerations

Read-time analytics/UI only: no new migration (head remains 0008), dependency or cleanup operation beyond 7A.1. Existing backup, build and restored-copy rehearsal instructions apply. Check zero/limit/rest records, archived history and roadmap time against a restored copy before separately authorized deployment. No production access occurred during development.

## Sprint 7A.3 migration — 0009

0009_volatile_falcon.sql creates weekly_reviews only (Monday week primary key, three text fields, version and updated timestamp). Include its Drizzle snapshot/journal in the release. No dependency changes or existing-row backfill. Rehearsed only on isolated test databases, including upgrade from 0008 with existing records. No personal/production migration was applied.

Before opening a used local database with the new build, create and verify a SQLite backup including WAL data; the development connection auto-applies pending migrations and is not the backup-first deployment wrapper. For a separately authorized production upgrade, stop the app and use the existing scripts/deploy-db.mjs migrate workflow (section 4), which verifies a backup before pending migrations. Rehearse on a restored copy first. Verify review save/edit/history, existing timers and Analytics after migration. Do not reset or seed replacement data. Reflection text is personal data and is included in normal database backups.

## Sprint 7B.2 migration — 0010

`0010_small_wrecking_crew.sql` adds only general_template_versions and its template/version unique index. Include its snapshot and the complete journal with earlier migrations. It does not modify existing rows, seed activities or perform cleanup. Isolated upgrades from 0009 preserved existing tasks, a running session, habits, roadmaps and reflection text; no personal/production migration was applied by verification.

Before opening a used local database with this build, take and verify a SQLite backup including WAL data: the development connection applies pending migrations automatically. For a separately authorized release, follow the existing stop/verified-backup/restored-copy rehearsal/migrate/start procedure with scripts/deploy-db.mjs. Stop the old app before enabling new schedule revisions; old code cannot honor them. Refresh clients after upgrade. No new dependencies, services or environment variables are needed.

Rehearsal checks: one-off/weekly Quick Add, roadmap reuse/explicit extra, occurrence-only move with a running timer, completed/skipped/logged exceptions, effective-date general schedule edit, Home Month/Day/Week, Analytics and Mac/iPhone controls. Retain the previous image and verified pre-upgrade snapshot. Rollback uses that matching pair restored into a new directory, preserving the newer database for reconciliation; no down-migration or reset.

## Sprint 7 completion — local release review (2026-11-05)

7B.3 adds no migration/dependency/environment changes. The Sprint 7 schema sequence is 0009_volatile_falcon.sql (weekly_reviews), then 0010_small_wrecking_crew.sql (general_template_versions); no later migration exists in this release. Ship the complete SQL/snapshot/journal history, including both files. Actual pending migrations depend on the deployed journal; it was not queried because production access is prohibited. Do not manually assume either has already run.

Local rehearsal used a SQLite-consistent copy of an existing synthetic 0008 database and the existing backup-aware deploy-db.mjs migrate command. It created a verified pre-upgrade backup, applied 0009/0010, preserved all 19 prior tables/rows, and passed integrity/FKs. Existing tests also cover populated older upgrade paths, active timers and 0009 reflections. This is not a restored production-data rehearsal. No user database was migrated during this verification.

Compose config validates and the unchanged Dockerfile still builds the standalone Next output and includes the complete migration/native packages. The local desktop-linux Unix-socket Docker daemon is unavailable; image/native Linux runtime, restart/recreation persistence and target architecture are unverified. Before a separately authorized release, build the image, rehearse on a verified restored backup, run the existing stop/backup/migrate/start procedure, refresh clients and test Mac/iPhone. Do not use a database reset, reseed or repeat learning-retirement cleanup for this release.

Smoke checks: mobile month/Today/date retention; vertical scroll versus horizontal swipe; Quick Add general/weekly/roadmap plus topic; occurrence move while timing; future schedule exceptions; manual logs/completion; habit zero/rest; Analytics and saved Weekly Review. Physical Safari/PWA keyboard/native date controls, VoiceOver, safe areas and two-device behavior remain manual gates. Existing matching-image/backup rollback procedure is unchanged. Sprint 7 is ready for release review, not automatically deployed or production-verified.
