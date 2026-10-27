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
