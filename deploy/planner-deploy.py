#!/usr/bin/env python3
"""Installed, operator-reviewed controller. Never run this from an unreviewed ref."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
import urllib.request

REPOSITORY = "Virain6/personal-productivity-app"
REPO = Path("/home/virain/planner")
STATE = Path("/home/virain/.local/state/planner-deploy")
HEALTH = "http://127.0.0.1:3100/api/health"
SHA = re.compile(r"[0-9a-f]{40}\Z")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def log(message):
    print(f"{datetime.now(timezone.utc).isoformat()} {message}", flush=True)


def run(*args, cwd=None, env=None, stream=False):
    result = subprocess.run(args, cwd=cwd or REPO, env=env, text=True,
                            stdout=None if stream else subprocess.PIPE,
                            stderr=None if stream else subprocess.PIPE,
                            timeout=2400)
    require(result.returncode == 0, f"Command failed: {args[0]} {args[1]} (exit {result.returncode})")
    return (result.stdout or "").strip()


def git(*args):
    return run("git", "-c", "core.hooksPath=/dev/null", *args)


def write_json(path, value):
    # Atomic durable record before any outage/migration; retain records on failure.
    with tempfile.NamedTemporaryFile(mode="w", dir=path.parent, delete=False) as f:
        json.dump(value, f, indent=2)
        f.write("\n")
        f.flush()
        os.fsync(f.fileno())
        temporary = f.name
    os.replace(temporary, path)
    fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def api(path):
    headers = {"Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28",
               "User-Agent": "planner-deploy"}
    credentials = os.environ.get("CREDENTIALS_DIRECTORY")
    if credentials:
        token = (Path(credentials) / "github-token").read_text().strip()
        require(bool(token), "Empty GitHub API credential")
        headers["Authorization"] = "Bearer " + token
    # Fixed host/repository; tokens never go into command arguments or logs.
    request = urllib.request.Request(f"https://api.github.com/repos/{REPOSITORY}/{path}", headers=headers)
    class RejectRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            raise RuntimeError("GitHub API redirect refused; review repository configuration")
    with urllib.request.build_opener(RejectRedirect).open(request, timeout=30) as response:
        return json.load(response)


def approved_commit(target, get=api):
    runs = get(f"actions/workflows/ci.yml/runs?branch=main&event=push&head_sha={target}&per_page=100")["workflow_runs"]
    runs = [r for r in runs if r.get("head_sha") == target and r.get("head_branch") == "main"
            and r.get("event") == "push" and r.get("path") == ".github/workflows/ci.yml"]
    require(bool(runs), "Exact main commit has no push CI run; wait for CI")
    latest = max(runs, key=lambda r: (r["id"], r.get("run_attempt", 1)))
    require(latest.get("status") == "completed" and latest.get("conclusion") == "success",
            "Latest push CI is not successful; refusing deployment")
    jobs = get(f"actions/runs/{latest['id']}/jobs?filter=latest&per_page=100")["jobs"]
    require(any(j.get("name") == "Planner verification" and j.get("conclusion") == "success"
                and j.get("status") == "completed" for j in jobs), "Required verification job did not succeed")
    prs = get(f"commits/{target}/pulls?per_page=100")
    require(any(p.get("merged_at") and p.get("merge_commit_sha") == target
                and p.get("base", {}).get("ref") == "main"
                and p.get("base", {}).get("repo", {}).get("full_name") == REPOSITORY
                for p in prs), "Main tip is not the merge result of a merged PR; direct pushes are not deployed")
    return latest["id"]


def clean_checkout():
    require(Path(git("rev-parse", "--show-toplevel")).resolve() == REPO.resolve(), "Unexpected checkout root")
    require(git("branch", "--show-current") == "main", "Production checkout must be on main")
    require(not git("status", "--porcelain", "--untracked-files=all"), "Dirty checkout; preserve and resolve changes manually")
    for marker in ("MERGE_HEAD", "CHERRY_PICK_HEAD", "REVERT_HEAD", "rebase-merge", "rebase-apply"):
        marker_path = Path(git("rev-parse", "--git-path", marker))
        require(not (REPO / marker_path).exists(), "Git operation in progress")
    require(git("remote", "get-url", "origin") in (
        f"git@github.com:{REPOSITORY}.git", f"https://github.com/{REPOSITORY}.git"), "Unexpected origin URL")
    require(git("rev-parse", "--is-shallow-repository") == "false", "Use a full checkout, not a shallow clone")
    return git("rev-parse", "HEAD")


def compose(image, *args):
    env = os.environ.copy()
    env["PLANNER_IMAGE_TAG"] = image
    # Explicit files/project/service prevent inherited compose overrides or other stacks.
    return run("docker", "--host", "unix:///var/run/docker.sock", "compose", "--project-name", "planner",
               "--project-directory", str(REPO), "--env-file", str(REPO / ".env"),
               "-f", str(REPO / "compose.yaml"), *args, env=env)


def docker(*args, stream=False):
    return run("docker", "--host", "unix:///var/run/docker.sock", *args, stream=stream)


def environment_fingerprint():
    return hashlib.sha256((REPO / ".env").read_bytes()).hexdigest()


def current_container():
    ids = docker("ps", "-aq", "--filter", "label=com.docker.compose.project=planner",
                 "--filter", "label=com.docker.compose.service=planner").splitlines()
    require(len(ids) == 1, "Expected exactly one existing Planner container")
    container = json.loads(docker("inspect", ids[0]))[0]
    require(container["State"].get("Running") and container["State"].get("Health", {}).get("Status") == "healthy",
            "Existing Planner container is not healthy; operator attention required")
    return container


def validate_mounts(container, config):
    service = config["services"]["planner"]
    mounts = {v["target"]: v for v in service["volumes"]}
    actual = {v["Destination"]: v for v in container["Mounts"]}
    for target in ("/app/data", "/app/backups"):
        expected = mounts.get(target, {})
        require(expected.get("type") == "bind" and target in actual
                and actual[target]["Type"] == "bind"
                and Path(expected["source"]).resolve() == Path(actual[target]["Source"]).resolve(),
                "Configured persistence mounts differ from the running container")
        require(Path(expected["source"]).is_dir(), "Persistent directory missing")
    require(service.get("environment", {}).get("DATABASE_PATH") == "/app/data/planner.db",
            "Unexpected database path")
    require(any(p.get("host_ip") == "127.0.0.1" and str(p.get("published")) == "3100"
                and p.get("target") == 3000 for p in service.get("ports", [])), "Unexpected health port binding")


def health():
    run("curl", "--fail", "--silent", "--show-error", "--max-time", "10", "--noproxy", "*", HEALTH)


def backup(image):
    snapshot = compose(image, "run", "--rm", "--no-deps", "--pull", "never", "--entrypoint", "node", "planner",
                       "scripts/deploy-db.mjs", "backup", "/app/backups")
    require(re.fullmatch(r"/app/backups/backup-[A-Za-z0-9_.:-]+/planner\.db", snapshot) is not None,
            "Backup did not return a valid snapshot path")
    compose(image, "run", "--rm", "--no-deps", "--pull", "never", "--entrypoint", "node", "planner",
            "scripts/deploy-db.mjs", "verify", snapshot)
    return snapshot


def deploy(check=False, adopt=None):
    pending_path = STATE / "pending.json"
    state_path = STATE / "deployed.json"
    require(not pending_path.exists(), "Interrupted/failed deployment: inspect pending.json and recover manually first")
    head = clean_checkout()
    current = current_container()
    health()
    config = json.loads(compose("inspection", "config", "--format", "json"))
    validate_mounts(current, config)
    fingerprint = environment_fingerprint()
    if adopt:
        require(not state_path.exists(), "Deployment state already exists")
        require(SHA.fullmatch(adopt) and adopt == head, "Adoption requires the exact currently deployed checkout SHA")
        write_json(state_path, {"commit": head, "image": current["Image"], "environment": fingerprint,
                               "adopted_at": datetime.now(timezone.utc).isoformat()})
        log(f"Operator-attested baseline adopted: {head}")
        return
    require(state_path.exists(), "First attest the running release with --adopt EXACT_SHA")
    previous = json.loads(state_path.read_text())
    require(head == previous["commit"] and current["Image"] == previous["image"], "Checkout/container differs from deployed state")
    require(fingerprint == previous["environment"], ".env changed since adoption/deployment; review and re-adopt manually")
    # Fetch never moves the checkout; the explicit ancestry check below rejects divergence.
    git("fetch", "--no-tags", "origin", "refs/heads/main:refs/remotes/origin/main")
    target = git("rev-parse", "refs/remotes/origin/main")
    require(SHA.fullmatch(target), "Invalid target commit")
    git("merge-base", "--is-ancestor", head, target)
    if target == head:
        log(f"No change: {head}; no build or replacement")
        return
    require(not git("ls-tree", "--name-only", target, "--", ".env", "data", "backups"), "Target tracks protected runtime files")
    run_id = approved_commit(target)
    require(not git("diff", "--name-only", head, target, "--", "compose.yaml"),
            "Compose infrastructure changed; requires a manual reviewed deployment")
    if check:
        log(f"Eligible main commit {target}, CI run {run_id}; check-only, no build or deployment")
        return
    # Detached source without .env/data/backups, kept for audit; never move production HEAD to build.
    releases = STATE / "releases"
    releases.mkdir(exist_ok=True)
    source = Path(tempfile.mkdtemp(prefix=target + "-", dir=releases))
    git("worktree", "add", "--detach", str(source), target)
    image = "git-" + target
    docker("build", "--pull", "--label", "org.opencontainers.image.revision=" + target,
           "--tag", "planner:" + image, str(source), stream=True)
    built = json.loads(docker("image", "inspect", "planner:" + image))[0]["Id"]
    rollback = "rollback-" + head + "-" + datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    docker("tag", previous["image"], "planner:" + rollback)
    snapshot = backup(rollback)  # Old, known-compatible helper and image, before any outage.
    require(clean_checkout() == head and environment_fingerprint() == fingerprint, "Local state changed during build")
    require(current_container()["Image"] == previous["image"], "Running image changed during build")
    # Recheck CI immediately before downtime; fetch races are harmless: target remains pinned.
    approved_commit(target)
    pending = {"previous": previous, "target": target, "image": built, "rollback_tag": rollback,
               "backup": snapshot, "ci_run": run_id, "source": str(source), "phase": "prepared"}
    write_json(pending_path, pending)
    log(f"Prepared {target}; previous image retained as planner:{rollback}; backup {snapshot}")
    compose(rollback, "stop", "planner")
    pending["phase"] = "stopped"
    write_json(pending_path, pending)
    pending["backup"] = backup(rollback)  # Final quiesced snapshot: no intervening application writes.
    write_json(pending_path, pending)
    git("merge", "--ff-only", target)
    pending["phase"] = "migrating"
    write_json(pending_path, pending)
    compose(image, "run", "--rm", "--no-deps", "--pull", "never", "--entrypoint", "node", "planner", "scripts/deploy-db.mjs", "migrate")
    pending["phase"] = "starting"
    write_json(pending_path, pending)
    try:
        compose(image, "up", "-d", "--no-deps", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "120", "planner")
        require(current_container()["Image"] == built, "Unexpected image running after replacement")
        health()
    except Exception:
        # Contain a failed new application; never restart old code against an unknown new schema.
        compose(image, "stop", "planner")
        raise
    write_json(state_path, {"commit": target, "image": built, "image_tag": image, "environment": fingerprint,
                           "ci_run": run_id, "deployed_at": datetime.now(timezone.utc).isoformat(),
                           "previous": previous["commit"], "rollback_tag": rollback, "backup": pending["backup"]})
    pending["phase"] = "successful"
    write_json(STATE / ("release-" + target + ".json"), pending)
    pending_path.unlink()
    log(f"Deployment healthy: {target}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="Fetch/check eligibility only; never build or stop")
    mode.add_argument("--adopt", metavar="SHA", help="Explicitly attest the already-running release; no deployment")
    args = parser.parse_args()
    os.umask(0o077)
    STATE.mkdir(parents=True, exist_ok=True)
    with (STATE / "deploy.lock").open("a") as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            log("Another deployment holds the lock; skipping")
            return
        deploy(args.check, args.adopt)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # Do not retry after entering the outage/migration section. Never infer rollback compatibility.
        log(f"FAILED: {error}. Preserve state/data/images; inspect pending.json before retrying.")
        sys.exit(1)
