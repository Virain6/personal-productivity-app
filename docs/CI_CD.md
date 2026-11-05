# Planner CI and server-initiated deployment

Status: implemented locally; **not installed or enabled on Ubuntu**. The user reports Sprint 7 is deployed. Nothing in this change connects to production. Follow the manual acceptance gates below before enabling automation. No new application schema or runtime service is introduced.

## Development and GitHub

Start each change from an up-to-date, clean local `main`:

```sh
git switch main
git pull --ff-only origin main
git switch -c feat/describe-the-change
```

Develop, run all checks, review `git diff`, then intentionally commit and push that feature branch. Open a PR targeting `main` in GitHub; do not push feature work directly to `main`. Review SQL migrations and operational changes explicitly. Merge with **Squash and merge** after `Planner verification` passes. The server deploys only the exact resulting `main` commit after its separate **push** CI succeeds; a successful PR test or manual dispatch alone does not authorize deployment. Check GitHub Actions, the server journal, the health endpoint and a few real app actions after the release. Do not edit tracked files in the production checkout.

`.github/workflows/ci.yml` runs on PRs to `main`, pushes to `main`, and manual dispatch. One uniquely named job, **Planner verification**, uses Node 22 (matching package engines and Docker), npm lockfile caching, `npm ci`, tests, lint, typecheck, formatting and build. Python 3, already available on the Ubuntu runner, runs the deployment controller tests through `npm test`. Actions are pinned to full reviewed commit IDs. Permissions are `contents: read`; checkout does not persist credentials. There are no production secrets, deployment steps, privileged runners or database service dependencies in CI. Earlier runs for the same branch/PR may be cancelled; a cancelled run never qualifies for deployment.

Configure repository Settings → Branches (or an equivalent branch ruleset) for `main`:

- Require a pull request and the **Planner verification** status check; require the branch to be up to date. Run the workflow once if GitHub has not yet offered the check name.
- Block force pushes and deletion; apply restrictions to administrators/bypass users where your plan permits. Do not configure a bypass for routine development.
- Prefer squash merges only, disable rebase merging and automatic merge unless intentionally needed, and delete merged feature branches. The controller requires the exact tip to be the merge result of a merged PR; it fails closed for ambiguous merge histories/direct pushes.
- For a solo repository, do not require an approval you cannot supply yourself. When another reviewer is available, require one approval and dismiss stale approvals. CI checks still remain required.
- Review changes to workflow files, Dockerfile, migrations and deployment tools especially carefully: merged code is trusted build/runtime code.

Private-repository branch protection requires GitHub Pro for a personal repository, or Team/Enterprise for an organization. Public repositories can use protection on Free. Confirm your account's available settings; do not claim enforced protection if the UI/plan does not provide it. Upgrade or use a public repository only if disclosure is acceptable; otherwise keep manual deployment until you have an enforceable policy. The controller's exact CI/merged-PR gate is useful defense in depth, not a replacement for repository access controls. See [GitHub protected branch availability](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches) and [branch protection settings](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule).

## Deployment contract

The installed, operator-reviewed `planner-deploy.py` runs as `virain`, the existing checkout owner, rather than root. It only uses the local Docker socket and Compose project/service `planner`, with explicit checkout, `.env` and compose paths. Immich/Jellyfin are not restarted, stopped or pruned. Building still consumes shared CPU/disk/RAM; schedule large upgrades appropriately and monitor available space.

The timer checks five minutes after boot and five minutes after the previous check completes. It never overlaps deployment: a nonblocking OS file lock also covers manual invocations. It fetches `origin/main`, explicitly verifies checkout ancestry, and rejects dirty/detached/wrong-branch/divergent checkouts, unfinished Git operations, shallow clones, changed `.env`, changed container identity and inconsistent persistent mounts. It never resets Git or overwrites runtime files. Target commits containing tracked `.env`, `data` or `backups` are rejected. Changes to `compose.yaml` require a manually reviewed deployment instead of unattended infrastructure changes.

For a new eligible commit:

1. Require the newest exact-SHA push run of `ci.yml` and its `Planner verification` job to have succeeded, and the exact SHA to be a merged PR result for this repository's `main`. API failures, rate limits, pending CI or a direct push fail closed. Credentials are not command arguments or log output; API redirects are rejected.
2. Build a detached worktree under `/home/virain/.local/state/planner-deploy/releases/` into `planner:git-<full SHA>`, labeled with the revision. Production HEAD/container/data remain unchanged while building. Builds use no production environment file.
3. Tag the actual running image `planner:rollback-<old SHA>-<timestamp>`. Use that old image's existing SQLite online-backup tool and verify checksum, integrity and foreign keys before stopping anything.
4. Persist `pending.json`, stop **only Planner**, then take another verified, quiesced backup to include writes made during the build/first backup. Record its exact path. Fast-forward the clean production checkout, run the new image's existing backup-aware migrator, then start only Planner with `--no-deps --no-build --pull never` and wait up to 120 seconds for container health.
5. Verify the running image ID and `http://127.0.0.1:3100/api/health`. Record `deployed.json` and a versioned release receipt, then remove the pending latch. Running entrypoint migration is idempotent after the explicit migration.

Before the pending latch, failures leave the original service running. Once the latch exists, subsequent attempts refuse to deploy until an operator investigates. Migration failures leave Planner stopped. Startup/health failures attempt to stop the new Planner container and preserve all data, snapshots and images; if Docker is unavailable, inspect the actual container state rather than assuming it stopped. The controller never automatically starts an old image against a possibly upgraded schema. A process/server crash also leaves the latch for investigation; a crash after successful state recording but before latch removal is deliberately conservative.

An unchanged commit exits without building, backing up or replacing anything. No automatic deletion/retention cleanup is performed. Worktrees, images, receipts and backups accumulate; review and prune only specific obsolete Planner artifacts manually after retaining a known compatible image/snapshot pair. Never use global Docker prune or volume removal commands.

The controller deliberately leaves `PLANNER_IMAGE_TAG` in `.env` unchanged. After an automated release, any **manual Compose up/run** must explicitly select `PLANNER_IMAGE_TAG=git-<deployed full SHA>` from `deployed.json` (`image_tag`), or the recorded rollback tag during recovery. Otherwise the old `.env` default could select the wrong image. `docker compose restart planner` restarts the existing container without selecting a different image, but still follow the maintenance procedure when migrations are involved.

The controller is installed outside the checkout. New commits do **not** silently replace its policy or systemd units; manually review and reinstall those files for future controller updates.

## Ubuntu installation — manual only, timer initially disabled

Prerequisites: existing healthy Planner deployment at `/home/virain/planner`, full clean Git checkout on `main`, Git, Python 3, curl, Docker and Compose v2 supporting `--wait`. Preserve existing `.env`, database and backups. Existing runtime UID 10001 must retain access to the configured bind directories. Do not recursively chown the database to the deployment identity.

Use a repo-specific read-only SSH deploy key, with no passphrase for unattended operation, mode 600 and its parent mode 700. Add its **public** key in GitHub repository Settings → Deploy keys, **without write access**. Keep other applications' keys intact:

```sh
install -d -m 700 /home/virain/.ssh
ssh-keygen -t ed25519 -f /home/virain/.ssh/planner_deploy -C planner-read-only-deploy
```

Do not overwrite an existing key at that path. Verify GitHub's SSH host key fingerprint through [GitHub's published fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints) before adding it to `known_hosts`; never disable strict host checking or trust unverified `ssh-keyscan` output. Set the expected remote explicitly after checking its current value:

```sh
git -C /home/virain/planner remote -v
git -C /home/virain/planner remote set-url origin git@github.com:Virain6/personal-productivity-app.git
GIT_SSH_COMMAND='ssh -i /home/virain/.ssh/planner_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o BatchMode=yes' git -C /home/virain/planner ls-remote origin refs/heads/main
```

Private-repository REST checks also need a fine-grained GitHub token limited to **this repository**, with **Actions: read** and **Pull requests: read** (Metadata read is automatic). Do not grant write/admin permissions. Set an expiry and arrange rotation; expired tokens stop deployments safely. The deploy key does not authenticate REST requests. See [workflow run API permissions](https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28) and [deploy key guidance](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys).

Create the root-only credential file using an editor, never a token in command history, Git or `.env`:

```sh
sudo install -d -m 700 /etc/planner-deploy
sudo install -m 600 /dev/null /etc/planner-deploy/github-token
sudoedit /etc/planner-deploy/github-token
```

The `install /dev/null` command is **first-install only**; for rotation edit the existing file, do not truncate it first. systemd `LoadCredential` gives only this service a runtime credential copy. For a public repository an unauthenticated API is possible with lower rate limits, but the supplied service expects this credential file; keep the documented setup consistent.

Copy the three reviewed files from this change to a separate staging directory `/home/virain/planner-release-setup` on the server using your existing private access. This is a later manual step, not performed here. Do not advance the production checkout just to obtain installer files: its current HEAD must still identify the currently running release.

```sh
sudo install -d -m 755 /usr/local/lib/planner-deploy
sudo install -m 755 /home/virain/planner-release-setup/planner-deploy.py /usr/local/lib/planner-deploy/planner-deploy.py
sudo install -m 644 /home/virain/planner-release-setup/planner-deploy.service /etc/systemd/system/planner-deploy.service
sudo install -m 644 /home/virain/planner-release-setup/planner-deploy.timer /etc/systemd/system/planner-deploy.timer
sudo install -d -o virain -g virain -m 700 /home/virain/.local/state/planner-deploy
sudo systemd-analyze verify /etc/systemd/system/planner-deploy.service /etc/systemd/system/planner-deploy.timer
sudo systemctl daemon-reload
sudo systemctl disable --now planner-deploy.timer
```

The existing `virain` user and `docker` group must exist. The supplied service requests Docker group membership for its process; do not run the service as root or grant passwordless sudo. Docker-socket access is nevertheless effectively host-root access, including through a malicious approved image. systemd filesystem restrictions reduce mistakes but **cannot sandbox the Docker daemon**. This is a trusted personal server identity, not an isolation boundary. A genuinely isolated rootless deployment would require a separate, deliberately planned migration and is outside this change. Keep GitHub collaborators, main merges, the server identity and root-owned installed controller tightly controlled. No inbound port or SSH exposure is added; Git/REST/image downloads are outbound.

## Initial adoption, check-only and manual test

First confirm the running app really corresponds to the checkout SHA (from your successful release record), healthy data and mounts. Adoption is an explicit operator attestation because the pre-existing image may not have a Git label. It does not infer a revision from an image tag. Get the full SHA:

```sh
git -C /home/virain/planner status --short
git -C /home/virain/planner rev-parse HEAD
curl --fail http://127.0.0.1:3100/api/health
```

Use a temporary systemd override to run the same identity, environment, lock and credentials as deployment. Replace `FULL_DEPLOYED_SHA` with that verified 40-character SHA:

```sh
sudo install -d -m 755 /etc/systemd/system/planner-deploy.service.d
sudoedit /etc/systemd/system/planner-deploy.service.d/manual-mode.conf
```

For initial adoption put exactly:

```ini
[Service]
ExecStart=
ExecStart=/usr/bin/python3 /usr/local/lib/planner-deploy/planner-deploy.py --adopt FULL_DEPLOYED_SHA
```

```sh
sudo systemctl daemon-reload
sudo systemctl start planner-deploy.service
sudo journalctl -u planner-deploy.service -n 80 --no-pager
```

After successful adoption, edit **that same override** to check-only:

```ini
[Service]
ExecStart=
ExecStart=/usr/bin/python3 /usr/local/lib/planner-deploy/planner-deploy.py --check
```

Reload systemd and start the service again. It fetches/checks eligibility but never builds or stops Planner. An unchanged main produces `No change`; a newer tested PR commit produces `Eligible main commit ... check-only`. Verify a no-change result after the first controlled successful release if main already contains the CI setup commit. Check-only does change Git's fetched refs but not checkout HEAD or application data.

A safe failure-handling test: while the timer is disabled and no deployment is running, temporarily create an untracked text file in the checkout, run **check-only**, and confirm a dirty-checkout failure and unchanged Planner health. Remove only the probe you just created:

```sh
planner_probe=$(mktemp /home/virain/planner/planner-cicd-probe.XXXXXX)
sudo systemctl start planner-deploy.service
# Expected nonzero failure while the --check override is active.
sudo journalctl -u planner-deploy.service -n 40 --no-pager
curl --fail http://127.0.0.1:3100/api/health
rm -- "$planner_probe"
sudo systemctl reset-failed planner-deploy.service
```

Do not test migration failures against the live database. Automated tests cover build/backup/migration/health failure order and retries without Docker, network or production data:

```sh
cd /home/virain/planner
# Run the test from a reviewed source checkout containing this change, not an old deployed checkout:
python3 -B -m unittest discover -s deploy -p 'test_*.py' -v
```

For the first real manual deployment, arrange a short maintenance window, review the target PR/migrations and available disk space, verify backup permissions, and rehearse on a separate restored database/container first. Then remove **only this override**, leaving the timer disabled:

```sh
sudo rm /etc/systemd/system/planner-deploy.service.d/manual-mode.conf
sudo systemctl daemon-reload
sudo systemctl start planner-deploy.service
sudo journalctl -u planner-deploy.service -n 150 --no-pager
sudo systemctl status planner-deploy.service --no-pager
curl --fail http://127.0.0.1:3100/api/health
```

A successful oneshot service becomes `inactive (dead)` with exit status 0; that is normal. Verify the deployed JSON SHA matches the intended merged commit, inspect Planner health/UI/data, and start it once again to demonstrate `No change` with no new image/backup. Only after all acceptance gates pass:

```sh
sudo systemctl enable --now planner-deploy.timer
systemctl list-timers planner-deploy.timer
systemctl status planner-deploy.timer --no-pager
journalctl -u planner-deploy.service -n 100 --no-pager
```

Pause future deployment checks with:

```sh
sudo systemctl disable --now planner-deploy.timer
```

Disabling the timer does not cancel an already running service. Inspect its status and let a safe operation finish; do not kill a migration merely to disable automation. No manual test or enablement above was executed during development.

## Recovery and database-compatible rollback

Keep the timer disabled throughout recovery. Inspect `pending.json`, `deployed.json`, versioned release receipts, the journal and actual Planner container state. The pending phase can lag the last operation after a crash; inspect before assuming what ran. Record the target SHA, previous SHA, exact retained rollback image tag and verified backup path. Never delete the latch just to retry a failed migration.

- Failure before `pending.json`: original container/checkout/data are untouched; resolve CI, disk, build or backup error and retry. Some source worktrees/images/backups may remain as audit artifacts.
- Failure in `prepared`/`stopped`: confirm migrations never began and current schema is still compatible. An operator can restart the retained old image against the unchanged data using the existing Compose command with `PLANNER_IMAGE_TAG=<rollback tag>`. Reconcile checkout/state explicitly before future automation.
- Failure in `migrating`/`starting`, or uncertainty: assume schema may have changed. An old image alone is **not** a database rollback. Stop only Planner, preserve the failed/new database directory, verify the recorded pre-migration snapshot, and follow [the existing restore procedure](DEPLOYMENT.md) into a **new empty data directory** with the matching retained old image. Point `PLANNER_DATA_DIR` at that restored directory only through an explicit operator configuration change. Never copy an old database over active SQLite/WAL files.

Restore rolls data back to snapshot time; writes made by a new release are not automatically merged. Preserve the failed database for investigation/export. For an application-only regression with a proven backward-compatible schema, explicitly review compatibility before using old code with the new database.

Prefer a corrective/revert PR that keeps main history forward-moving. If immediate old-code recovery requires aligning the checkout to an older commit, first ensure it is clean, preserve the current commit on a recovery branch, then deliberately move the local `main` branch only after confirming the exact rollback version; never discard local edits or force-push GitHub. An alternative is a separate known-good checkout following the existing manual restore guide. The timer must stay disabled until `/home/virain/planner` again has a clean main, the intended healthy running release and correct `.env`/mounts.

After recovery is fully verified, archive (rename, do not destroy) both old `deployed.json` and any `pending.json` to timestamped audit filenames. Run the explicit adoption procedure again with the actual healthy checkout SHA. This acknowledges the new image/mount/environment baseline; do not adopt merely to bypass an unresolved failure. Remove the temporary adoption override, run check-only, and deliberately re-enable only after a successful controlled release. Never reinstall units or enable the timer as a substitute for recovery.

## Verification boundary

Local verification: **124/124 repository tests pass**, including 16 isolated Python controller scenarios. Lint, typecheck, formatting and production build pass. Controller tests exercise exact CI/PR gating, real temporary Git dirty/branch checks, lock contention, unchanged/check-only paths, backup verification, persistence mount checks, ordered backups/build/replacement, failure latches and health-failure containment. The local Docker daemon is unavailable, so no container deployment test was run. The existing deployment tests exercise real SQLite WAL backup/restore and isolated migration preservation. The full application regression suite still runs in CI.

Actual GitHub Actions execution, branch-protection enforcement, token permissions, systemd sandbox/credentials, Docker image build/Compose runtime and recovery on the Ubuntu host are **manual acceptance gates**, not claims made by local mocked controller tests. No server was contacted, timer enabled or production data modified. No additional migration is required by this CI/CD change.
