"""No Docker/GitHub/server access: exercise the real controller with boundary doubles."""
import importlib.util
import json
from pathlib import Path
import tempfile
import subprocess
import fcntl
import sys
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("planner_deploy", Path(__file__).with_name("planner-deploy.py"))
d = importlib.util.module_from_spec(spec)
spec.loader.exec_module(d)
OLD, NEW = "a" * 40, "b" * 40


class GateTests(unittest.TestCase):
    def fixture(self, conclusion="success", event="push", merged=True):
        return [
            {"workflow_runs": [{"id": 10, "run_attempt": 1, "head_sha": NEW, "head_branch": "main", "path": ".github/workflows/ci.yml", "event": event, "status": "completed", "conclusion": conclusion}]},
            {"jobs": [{"name": "Planner verification", "status": "completed", "conclusion": "success"}]},
            [{"merged_at": "today" if merged else None, "merge_commit_sha": NEW, "base": {"ref": "main", "repo": {"full_name": d.REPOSITORY}}}],
        ]

    def check(self, data):
        calls = iter(data)
        return d.approved_commit(NEW, lambda _: next(calls))

    def test_exact_ci_and_merged_pr(self):
        self.assertEqual(self.check(self.fixture()), 10)

    def test_no_failed_cancelled_manual_or_pr_run(self):
        for status in ["failure", "cancelled", "skipped", None]:
            with self.subTest(status=status), self.assertRaises(RuntimeError):
                self.check(self.fixture(conclusion=status))
        for event in ["pull_request", "workflow_dispatch"]:
            with self.subTest(event=event), self.assertRaises(RuntimeError):
                self.check(self.fixture(event=event))

    def test_newest_failure_overrides_old_success(self):
        data = self.fixture()
        data[0]["workflow_runs"].append({**data[0]["workflow_runs"][0], "id": 11, "conclusion": "failure"})
        with self.assertRaises(RuntimeError):
            self.check(data)

    def test_no_direct_push_or_wrong_commit(self):
        for update in [{"merged_at": None}, {"merge_commit_sha": OLD}, {"base": {"ref": "feature"}}]:
            data = self.fixture()
            data[2][0].update(update)
            with self.assertRaises(RuntimeError):
                self.check(data)

    def test_required_job_must_actually_run(self):
        data = self.fixture()
        data[1]["jobs"][0]["conclusion"] = "skipped"
        with self.assertRaises(RuntimeError):
            self.check(data)


class DeploymentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.state = Path(self.temp.name)
        self.events = []
        self.target = NEW
        self.failure = None
        self.health_calls = 0
        self.container_calls = 0
        for name, replacement in {
            "STATE": self.state, "clean_checkout": self.clean, "current_container": self.container,
            "health": self.health, "compose": self.compose, "validate_mounts": lambda *a: None,
            "environment_fingerprint": lambda: "hash", "git": self.git, "docker": self.docker,
            "backup": self.backup, "approved_commit": self.gate,
        }.items():
            patcher = patch.object(d, name, replacement)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.previous = {"commit": OLD, "image": "old-image", "environment": "hash"}
        d.write_json(self.state / "deployed.json", self.previous)

    def clean(self):
        if self.failure == "dirty":
            raise RuntimeError("dirty")
        return OLD

    def container(self):
        self.container_calls += 1
        return {"Image": "new-image" if self.container_calls >= 3 else "old-image"}

    def health(self):
        self.health_calls += 1
        if self.failure == "health" and self.health_calls > 1:
            raise RuntimeError("health failed")

    def git(self, *args):
        self.events.append(("git", *args))
        if args[0] == "rev-parse":
            return self.target
        if args[0] == "merge-base" and self.failure == "divergent":
            raise RuntimeError("divergent")
        if args[0] == "diff" and self.failure == "compose-change":
            return "compose.yaml"
        if args[0] == "ls-tree" and self.failure == "runtime-files":
            return ".env"
        return ""

    def docker(self, *args, **kwargs):
        self.events.append(("docker", *args))
        if args[0] == "build" and self.failure == "build":
            raise RuntimeError("build failed")
        return json.dumps([{"Id": "new-image"}]) if args[:2] == ("image", "inspect") else ""

    def compose(self, image, *args):
        self.events.append(("compose", image, *args))
        if args[0] == "config":
            return "{}"
        if "migrate" in args and self.failure == "migration":
            raise RuntimeError("migration failed")
        return ""

    def backup(self, image):
        self.events.append(("backup", image))
        if self.failure == "backup":
            raise RuntimeError("backup failed")
        return "/app/backups/backup-test/planner.db"

    def gate(self, target):
        if self.failure == "ci":
            raise RuntimeError("CI failed")
        return 10

    def test_no_change_does_not_build(self):
        self.target = OLD
        d.deploy()
        self.assertFalse(any(e[0] in ("backup", "docker") for e in self.events))

    def test_check_only_does_not_build_or_stop(self):
        d.deploy(check=True)
        self.assertFalse(any(e[0] in ("backup", "docker") for e in self.events))
        self.assertFalse((self.state / "pending.json").exists())

    def test_success_order_and_record(self):
        d.deploy()
        actions = [e[2] if e[0] == "compose" else e[1] if e[0] in ("git", "docker") else e[0] for e in self.events]
        self.assertLess(actions.index("build"), actions.index("backup"))
        self.assertLess(actions.index("backup"), actions.index("stop"))
        self.assertLess(actions.index("stop"), actions.index("merge"))
        self.assertEqual(actions.count("backup"), 2)
        self.assertFalse((self.state / "pending.json").exists())
        self.assertEqual(json.loads((self.state / "deployed.json").read_text())["commit"], NEW)
        self.assertTrue((self.state / f"release-{NEW}.json").exists())
        for e in self.events:
            if e[0] == "compose" and e[2] in ("stop", "up"):
                self.assertEqual(e[-1], "planner")

    def test_pre_outage_failures_never_stop_existing_service(self):
        for failure in ["dirty", "divergent", "ci", "compose-change", "runtime-files", "build", "backup"]:
            self.events.clear()
            self.container_calls = 0
            self.failure = failure
            with self.subTest(failure=failure), self.assertRaises(RuntimeError):
                d.deploy()
            self.assertFalse(any(e[0] == "compose" and e[2] == "stop" for e in self.events))
            self.assertFalse((self.state / "pending.json").exists())

    def test_migration_failure_latches_and_preserves_previous_state(self):
        self.failure = "migration"
        with self.assertRaises(RuntimeError):
            d.deploy()
        self.assertEqual(json.loads((self.state / "deployed.json").read_text()), self.previous)
        self.assertEqual(json.loads((self.state / "pending.json").read_text())["phase"], "migrating")
        self.events.clear()
        with self.assertRaises(RuntimeError):
            d.deploy()
        self.assertFalse(self.events)

    def test_health_failure_stops_only_new_planner_and_latches(self):
        self.failure = "health"
        with self.assertRaises(RuntimeError):
            d.deploy()
        self.assertEqual(self.events[-1], ("compose", "git-" + NEW, "stop", "planner"))
        self.assertTrue((self.state / "pending.json").exists())
        self.assertEqual(json.loads((self.state / "deployed.json").read_text()), self.previous)

    def test_adoption_is_explicit_and_never_replaces_existing_state(self):
        with self.assertRaises(RuntimeError):
            d.deploy(adopt=OLD)
        (self.state / "deployed.json").unlink()
        self.container_calls = 0
        d.deploy(adopt=OLD)
        self.assertEqual(json.loads((self.state / "deployed.json").read_text())["commit"], OLD)
        self.assertFalse(any(e[0] == "docker" for e in self.events))


class PersistenceBoundaryTests(unittest.TestCase):
    def test_backup_requires_snapshot_path_and_verification(self):
        with patch.object(d, "compose", side_effect=["/app/backups/backup-test/planner.db", "verified"]) as compose:
            self.assertEqual(d.backup("old"), "/app/backups/backup-test/planner.db")
            self.assertEqual(compose.call_args.args[-2:], ("verify", "/app/backups/backup-test/planner.db"))
        with patch.object(d, "compose", return_value="unexpected output"), self.assertRaises(RuntimeError):
            d.backup("old")
        with patch.object(d, "compose", side_effect=["/app/backups/backup-test/planner.db", RuntimeError("checksum mismatch")]), self.assertRaises(RuntimeError):
            d.backup("old")

    def test_mounts_must_match_real_container_and_persistent_directories(self):
        with tempfile.TemporaryDirectory() as folder:
            config = {"services": {"planner": {
                "volumes": [{"type": "bind", "target": target, "source": folder} for target in ["/app/data", "/app/backups"]],
                "environment": {"DATABASE_PATH": "/app/data/planner.db"},
                "ports": [{"host_ip": "127.0.0.1", "published": "3100", "target": 3000}],
            }}}
            container = {"Mounts": [{"Type": "bind", "Destination": target, "Source": folder} for target in ["/app/data", "/app/backups"]]}
            d.validate_mounts(container, config)
            container["Mounts"][0]["Source"] = folder + "/wrong"
            with self.assertRaisesRegex(RuntimeError, "mounts differ"):
                d.validate_mounts(container, config)


class CheckoutAndLockTests(unittest.TestCase):
    def test_real_git_rejects_dirty_and_wrong_branch(self):
        with tempfile.TemporaryDirectory() as folder:
            repo = Path(folder)
            def git(*args):
                subprocess.run(["git", *args], cwd=repo, check=True, capture_output=True)
            git("init", "-b", "main")
            git("config", "user.email", "test@example.invalid")
            git("config", "user.name", "Deployment test")
            git("commit", "--allow-empty", "-m", "baseline")
            git("remote", "add", "origin", f"git@github.com:{d.REPOSITORY}.git")
            with patch.object(d, "REPO", repo):
                self.assertRegex(d.clean_checkout(), r"^[0-9a-f]{40}$")
                (repo / "untracked.txt").write_text("preserve me")
                with self.assertRaisesRegex(RuntimeError, "Dirty"):
                    d.clean_checkout()
                self.assertEqual((repo / "untracked.txt").read_text(), "preserve me")
                git("add", "untracked.txt")
                git("commit", "-m", "fixture")
                git("checkout", "-b", "feature")
                with self.assertRaisesRegex(RuntimeError, "must be on main"):
                    d.clean_checkout()

    def test_overlapping_invocation_does_nothing(self):
        with tempfile.TemporaryDirectory() as folder, patch.object(d, "STATE", Path(folder)), patch.object(sys, "argv", ["deploy"]), patch.object(d, "deploy") as deploy:
            with (Path(folder) / "deploy.lock").open("a") as lock:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                old_umask = d.os.umask(0o077)
                try:
                    d.main()
                finally:
                    d.os.umask(old_umask)
                deploy.assert_not_called()


if __name__ == "__main__":
    unittest.main()
