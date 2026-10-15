from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import select
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from modeltrace_runtime.operations import Operations


DIGEST = "a" * 64
PLAN = [{"slot_id": "query-01", "expected_count": 100}]
RESULT = {"status": "ok", "numbers": [3, 2, 3] * 30, "eligible": True,
          "expected_count": 100, "challenge_id": "query-01",
          "transport_calls": 1, "submitted": True, "response_received": True}


class OperationsTest(unittest.TestCase):
    def test_durable_replay_conflict_success_and_claim_once(self):
        with tempfile.TemporaryDirectory() as temp:
            with Operations(Path(temp) / "ledger") as operations:
                first = operations.begin("operation-1", DIGEST)
                self.assertEqual(first["status"], "running")
                operations._attach_plan("operation-1", PLAN)
                with ThreadPoolExecutor(max_workers=2) as pool:
                    claimed = list(pool.map(
                        lambda _: operations.claim_slot("operation-1", "query-01"),
                        range(2)))
                self.assertEqual(sorted(claimed), [False, True])
                operations.finish_slot("operation-1", "query-01", RESULT)
                operations._finalize("operation-1", "succeeded")
                saved = operations.begin("operation-1", DIGEST)
                self.assertEqual(saved["status"], "succeeded")
                self.assertFalse(saved.get("_created", False))
                self.assertEqual(
                    operations.begin("operation-1", "b" * 64)["status"], "conflict")
            with Operations(Path(temp) / "ledger") as reopened:
                self.assertEqual(reopened.begin("operation-1", DIGEST), saved)

    def test_live_owner_is_not_recovered_and_other_operation_is_busy(self):
        with tempfile.TemporaryDirectory() as temp:
            with Operations(Path(temp) / "ledger") as owner:
                self.assertEqual(owner.begin("operation-1", DIGEST)["status"], "running")
                owner._attach_plan("operation-1", PLAN)
                self.assertTrue(owner.claim_slot("operation-1", "query-01"))
                with Operations(Path(temp) / "ledger") as other:
                    self.assertEqual(other.begin("operation-1", DIGEST)["status"], "running")
                    self.assertFalse(other.claim_slot("operation-1", "query-01"))
                    self.assertEqual(other.begin("operation-2", DIGEST)["status"], "busy")
                owner.finish_slot("operation-1", "query-01", RESULT)
                owner._finalize("operation-1", "succeeded")

    def test_unknown_survives_restart_without_resuming_intent(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "ledger"
            with Operations(root) as owner:
                self.assertEqual(owner.begin("operation-1", DIGEST)["status"], "running")
                owner._attach_plan("operation-1", PLAN)
                self.assertTrue(owner.claim_slot("operation-1", "query-01"))
            with Operations(root) as reopened:
                result = reopened.begin("operation-1", DIGEST)
                self.assertEqual(result["status"], "write_unknown")
                self.assertEqual(result["slots"]["query-01"]["status"], "write_unknown")
                self.assertIsNone(result["slots"]["query-01"]["result"]["submitted"])
                self.assertFalse(reopened.claim_slot("operation-1", "query-01"))

    def test_actual_cross_process_busy_and_crash_after_intent(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "ledger"
            code = (
                "import os,sys; from modeltrace_runtime.operations import Operations; "
                "o=Operations(sys.argv[1]); o.begin('operation-1','a'*64); "
                "o._attach_plan('operation-1',[{'slot_id':'query-01','expected_count':100}]); "
                "o.claim_slot('operation-1','query-01'); print('ready',flush=True); "
                "sys.stdin.readline(); os._exit(0)"
            )
            child = subprocess.Popen(
                [sys.executable, "-B", "-c", code, str(root)],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                env={"PATH": "/usr/bin:/bin", "LANG": "C", "PYTHONDONTWRITEBYTECODE": "1",
                     "OPENBLAS_NUM_THREADS": "1"})
            try:
                ready, _, _ = select.select([child.stdout], [], [], 5)
                self.assertTrue(ready, "owned ledger child readiness timeout")
                self.assertEqual(child.stdout.readline(), b"ready\n")
                with Operations(root) as other:
                    self.assertEqual(other.begin("operation-2", DIGEST)["status"], "busy")
                    self.assertEqual(other.begin("operation-1", DIGEST)["status"], "running")
                output, errors = child.communicate(b"exit\n", timeout=5)
                self.assertEqual(child.returncode, 0)
                self.assertEqual(errors, b"")
                with Operations(root) as restarted:
                    result = restarted.begin("operation-1", DIGEST)
                    self.assertEqual(result["status"], "write_unknown")
                    self.assertFalse(restarted.claim_slot("operation-1", "query-01"))
            finally:
                if child.poll() is None:
                    child.kill()
                child.wait()
                for stream in (child.stdin, child.stdout, child.stderr):
                    stream.close()

    def test_safe_bounded_plan_and_symlink_containment(self):
        with tempfile.TemporaryDirectory() as temp:
            with Operations(Path(temp) / "ledger") as operations:
                self.assertEqual(operations.begin("operation-1", DIGEST)["status"], "running")
                for plan in (
                    PLAN * 2,
                    [{"slot_id": f"query-{index}", "expected_count": 100}
                     for index in range(37)],
                    [{"slot_id": "../escape", "expected_count": 100}],
                    [{"slot_id": "query-01", "expected_count": True}],
                    [{"slot_id": "query-01", "expected_count": 100, "prompt": "secret"}],
                ):
                    with self.subTest(size=len(plan)), self.assertRaises(ValueError):
                        operations._attach_plan("operation-1", plan)
            link = Path(temp) / "link"
            link.symlink_to(Path(temp) / "ledger")
            with self.assertRaises(ValueError):
                Operations(link)

    def test_preclaim_persistence_failure_does_not_authorize(self):
        with tempfile.TemporaryDirectory() as temp:
            with Operations(Path(temp) / "ledger") as operations:
                self.assertEqual(operations.begin("operation-1", DIGEST)["status"], "running")
                operations._attach_plan("operation-1", PLAN)
                with patch("modeltrace_runtime.operations.os.replace",
                           side_effect=OSError("synthetic-key")):
                    with self.assertRaises(OSError):
                        operations.claim_slot("operation-1", "query-01")
                self.assertFalse(operations.claim_slot("operation-1", "query-01"))

    def test_terminal_commit_failure_preserves_intent_and_poison(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "ledger"
            with Operations(root) as operations:
                self.assertEqual(operations.begin("operation-1", DIGEST)["status"], "running")
                operations._attach_plan("operation-1", PLAN)
                self.assertTrue(operations.claim_slot("operation-1", "query-01"))
                with patch("modeltrace_runtime.operations.os.replace",
                           side_effect=OSError("synthetic-key")):
                    with self.assertRaises(OSError):
                        operations.finish_slot("operation-1", "query-01", RESULT)
                self.assertFalse(operations.claim_slot("operation-1", "query-01"))
                state = json.loads((root / "ledger.json").read_bytes())
                self.assertEqual(
                    state["operations"]["operation-1"]["slots"]["query-01"]["status"],
                    "intent")
                self.assertNotIn("synthetic-key", (root / "ledger.json").read_text())
            with Operations(root) as restarted:
                self.assertEqual(
                    restarted.begin("operation-1", DIGEST)["status"], "write_unknown")

    def test_result_whitelist_and_permissions(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "ledger"
            with Operations(root) as operations:
                self.assertEqual(operations.begin("operation-1", DIGEST)["status"], "running")
                operations._attach_plan("operation-1", PLAN)
                self.assertTrue(operations.claim_slot("operation-1", "query-01"))
                operations.finish_slot("operation-1", "query-01", {
                    **RESULT, "body": "synthetic-body", "api_key": "synthetic-key",
                    "url": "https://synthetic.invalid", "prompt": "synthetic-prompt",
                })
                operations._finalize("operation-1", "succeeded")
            data = (root / "ledger.json").read_bytes()
            for sentinel in (b"synthetic-body", b"synthetic-key",
                             b"synthetic.invalid", b"synthetic-prompt"):
                self.assertNotIn(sentinel, data)
            self.assertEqual((root / "ledger.json").stat().st_mode & 0o777, 0o600)
            self.assertEqual(root.stat().st_mode & 0o777, 0o700)

    def test_legacy_migration_hides_only_ambiguous_last_terminal_slot(self):
        for status in ("running", "write_unknown", "succeeded", "partial", "failed"):
            with self.subTest(status=status), tempfile.TemporaryDirectory() as temp:
                root = Path(temp) / "ledger"
                root.mkdir(mode=0o700)
                state = {"version": 1, "operations": {"operation-1": {
                    "operation_id": "operation-1", "parameter_digest": DIGEST,
                    "status": status,
                    "plan": PLAN + [{"slot_id": "query-02", "expected_count": 100}],
                    "slots": {
                        "query-01": {"status": "ok", "result": RESULT},
                        "query-02": {"status": "ok", "result": {
                            **RESULT, "challenge_id": "query-02"}},
                    },
                }}}
                ledger = root / "ledger.json"
                ledger.write_text(json.dumps(state))
                ledger.chmod(0o600)
                with Operations(root) as operations:
                    result = operations.begin("operation-1", DIGEST)
                    ambiguous = status in ("running", "write_unknown")
                    self.assertEqual(result["counts"]["accepted"], 1 if ambiguous else 2)
                    self.assertEqual(result["counts"]["unknown"], int(ambiguous))
                    self.assertTrue(result["slots"]["query-01"]["result"]["eligible"])
                    self.assertEqual(
                        result["slots"]["query-02"]["result"]["eligible"], not ambiguous)
                    self.assertFalse(operations.claim_slot("operation-1", "query-02"))
                    self.assertEqual(operations._read()["version"], 2)
                with Operations(root) as reopened:
                    self.assertEqual(reopened.begin("operation-1", DIGEST), result)

    def test_guard_validation_is_bounded_contained_and_matches_last_slot(self):
        variants = ("oversize", "extra", "version", "digest", "identity",
                    "operation", "slot", "earlier", "mode", "symlink")
        for variant in variants:
            with self.subTest(variant=variant), tempfile.TemporaryDirectory() as temp:
                root = Path(temp) / "ledger"
                with Operations(root) as operations:
                    operations.begin("operation-1", DIGEST)
                    operations._attach_plan(
                        "operation-1", PLAN + [{"slot_id": "query-02", "expected_count": 100}])
                    operations.claim_slot("operation-1", "query-01")
                    operations.finish_slot("operation-1", "query-01", RESULT)
                    operations.claim_slot("operation-1", "query-02")
                    guard = root / "pending.json"
                    self.assertEqual(guard.stat().st_mode & 0o777, 0o600)
                    original = guard.read_bytes()
                    payload = json.loads(original)
                    if variant == "oversize":
                        guard.write_bytes(b" " * 1025)
                    elif variant == "mode":
                        guard.chmod(0o644)
                    elif variant == "symlink":
                        outside = Path(temp) / "outside"
                        outside.write_text("synthetic-outside-sentinel")
                        guard.unlink()
                        guard.symlink_to(outside)
                    else:
                        field, value = {
                            "extra": ("prompt", "synthetic-guard-secret"),
                            "version": ("version", True),
                            "digest": ("parameter_digest", "b" * 64),
                            "identity": ("slot_id", "../escape"),
                            "operation": ("operation_id", "absent-operation"),
                            "slot": ("slot_id", "absent-slot"),
                            "earlier": ("slot_id", "query-01"),
                        }[variant]
                        payload[field] = value
                        guard.write_text(json.dumps(payload))
                    with self.assertRaises((ValueError, OSError)) as raised:
                        operations.begin("operation-1", DIGEST)
                    self.assertNotIn("synthetic-", str(raised.exception))
                    self.assertFalse(operations._poisoned)
                    if variant == "symlink":
                        self.assertEqual(outside.read_text(), "synthetic-outside-sentinel")

    def test_result_commit_failure_boundaries_preserve_prior_sample(self):
        for boundary in ("file", "replace", "directory", "retirement"):
            for sustained in (False, True):
                with self.subTest(boundary=boundary, sustained=sustained):
                    with tempfile.TemporaryDirectory() as temp:
                        root = Path(temp) / "ledger"
                        with Operations(root) as operations:
                            operations.begin("operation-1", DIGEST)
                            operations._attach_plan("operation-1", PLAN + [
                                {"slot_id": "query-02", "expected_count": 100}])
                            operations.claim_slot("operation-1", "query-01")
                            operations.finish_slot("operation-1", "query-01", RESULT)
                            operations.claim_slot("operation-1", "query-02")
                            sync, replace, unlink = os.fsync, os.replace, os.unlink
                            failures = []

                            def reject():
                                if sustained or not failures:
                                    failures.append(1)
                                    raise OSError("synthetic-commit-secret")

                            def failing_sync(descriptor):
                                directory = descriptor == operations._root_fd
                                if boundary == ("directory" if directory else "file"):
                                    reject()
                                return sync(descriptor)

                            def failing_replace(source, destination, **options):
                                if boundary == "replace":
                                    reject()
                                return replace(source, destination, **options)

                            def failing_unlink(name, **options):
                                if boundary == "retirement" and name == "pending.json":
                                    reject()
                                return unlink(name, **options)

                            with patch("modeltrace_runtime.operations.os.fsync",
                                       side_effect=failing_sync), patch(
                                    "modeltrace_runtime.operations.os.replace",
                                    side_effect=failing_replace), patch(
                                    "modeltrace_runtime.operations.os.unlink",
                                    side_effect=failing_unlink):
                                with self.assertRaises(OSError) as raised:
                                    operations.finish_slot("operation-1", "query-02", {
                                        **RESULT, "challenge_id": "query-02"})
                                self.assertEqual(str(raised.exception), "ledger_persistence_failed")
                                try:
                                    operations._finalize("operation-1", "write_unknown")
                                except OSError:
                                    pass
                            self.assertGreaterEqual(len(failures), 1)
                            same = operations.begin("operation-1", DIGEST)
                            self.assertFalse(operations.claim_slot("operation-1", "query-02"))
                        with Operations(root) as reopened:
                            restarted = reopened.begin("operation-1", DIGEST)
                            self.assertFalse(reopened.claim_slot("operation-1", "query-02"))
                        for label, result in (("same", same), ("reopened", restarted)):
                            with self.subTest(projection=label):
                                self.assertEqual(result["status"], "write_unknown")
                                self.assertEqual(result["counts"]["accepted"], 1)
                                self.assertEqual(result["counts"]["unknown"], 1)
                                self.assertTrue(result["slots"]["query-01"]["result"]["eligible"])
                                self.assertFalse(
                                    result["slots"].get("query-02", {}).get("result", {}).get(
                                        "eligible", False))
                                if label == "reopened":
                                    self.assertEqual(
                                        result["slots"]["query-02"]["status"], "write_unknown")
                        self.assertNotIn("synthetic-commit-secret",
                                         (root / "ledger.json").read_text())

    def test_guard_creation_failure_never_authorizes_dispatch(self):
        for boundary in ("file", "replace", "directory"):
            with self.subTest(boundary=boundary), tempfile.TemporaryDirectory() as temp:
                root = Path(temp) / "ledger"
                with Operations(root) as operations:
                    operations.begin("operation-1", DIGEST)
                    operations._attach_plan("operation-1", PLAN)
                    sync, replace = os.fsync, os.replace
                    guard_phase = []
                    original = operations._persist

                    def persist(destination, state):
                        if destination == "pending.json":
                            guard_phase.append(1)
                        return original(destination, state)

                    def failing_sync(descriptor):
                        if guard_phase and boundary == (
                                "directory" if descriptor == operations._root_fd else "file"):
                            raise OSError("synthetic-guard-secret")
                        return sync(descriptor)

                    def failing_replace(source, destination, **options):
                        if guard_phase and boundary == "replace":
                            raise OSError("synthetic-guard-secret")
                        return replace(source, destination, **options)

                    with patch.object(operations, "_persist", side_effect=persist), patch(
                            "modeltrace_runtime.operations.os.fsync",
                            side_effect=failing_sync), patch(
                            "modeltrace_runtime.operations.os.replace",
                            side_effect=failing_replace):
                        with self.assertRaises(OSError) as raised:
                            operations.claim_slot("operation-1", "query-01")
                    self.assertEqual(str(raised.exception), "ledger_persistence_failed")
                    self.assertEqual(len(guard_phase), 1)
                    self.assertFalse(operations.claim_slot("operation-1", "query-01"))
                with Operations(root) as reopened:
                    result = reopened.begin("operation-1", DIGEST)
                    self.assertEqual(result["counts"]["accepted"], 0)
                    self.assertEqual(result["counts"]["unknown"], 1)
                    self.assertEqual(result["slots"]["query-01"]["status"], "write_unknown")
                    self.assertFalse(reopened.claim_slot("operation-1", "query-01"))

    def test_legacy_intent_and_next_operation_preserve_prior_valid_sample(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "ledger"
            with Operations(root) as operations:
                operations.begin("operation-1", DIGEST)
                operations._attach_plan(
                    "operation-1", PLAN + [{"slot_id": "query-02", "expected_count": 100}])
                operations.claim_slot("operation-1", "query-01")
                operations.finish_slot("operation-1", "query-01", RESULT)
                operations.claim_slot("operation-1", "query-02")
            # Model an existing unguarded B intent, not a new-format crash.
            ledger = root / "ledger.json"
            state = json.loads(ledger.read_bytes())
            state["version"] = 1
            ledger.write_text(json.dumps(state))
            (root / "pending.json").unlink()
            with Operations(root) as reopened:
                prior = reopened.begin("operation-1", DIGEST)
                self.assertEqual(prior["counts"]["accepted"], 1)
                self.assertEqual(prior["counts"]["unknown"], 1)
                self.assertTrue(prior["slots"]["query-01"]["result"]["eligible"])
                self.assertEqual(json.loads(ledger.read_bytes())["version"], 2)
                self.assertTrue(reopened.begin("operation-2", DIGEST)["_created"])
                reopened._attach_plan("operation-2", PLAN)
                self.assertTrue(reopened.claim_slot("operation-2", "query-01"))
                reopened.finish_slot("operation-2", "query-01", RESULT)
                fresh = reopened._finalize("operation-2", "succeeded")
                self.assertEqual(fresh["counts"]["accepted"], 1)
                self.assertEqual(reopened.begin("operation-1", DIGEST), prior)
            with Operations(root) as again:
                self.assertEqual(again.begin("operation-1", DIGEST), prior)
                self.assertEqual(again.begin("operation-2", DIGEST), fresh)

    def test_actual_crash_cuts_keep_guarded_slot_unknown_and_prior_committed(self):
        code = """
import os, sys
from modeltrace_runtime.operations import Operations
root, cut = sys.argv[1:]
o = Operations(root)
o.begin("operation-1", "a" * 64)
o._attach_plan("operation-1", [
    {"slot_id": "query-01", "expected_count": 100},
    {"slot_id": "query-02", "expected_count": 100},
])
result = {"status": "ok", "numbers": [3] * 90, "eligible": True,
          "expected_count": 100, "challenge_id": "query-01",
          "transport_calls": 1, "submitted": True, "response_received": True}
o.claim_slot("operation-1", "query-01")
o.finish_slot("operation-1", "query-01", result)
o.claim_slot("operation-1", "query-02")
if cut == "intent":
    os._exit(23)
sync, replace, unlink = os.fsync, os.replace, os.unlink
def crash_sync(descriptor):
    sync(descriptor)
    if cut == ("directory" if descriptor == o._root_fd else "file"):
        os._exit(23)
def crash_replace(source, destination, **options):
    replace(source, destination, **options)
    if cut == "replace":
        os._exit(23)
def crash_unlink(name, **options):
    unlink(name, **options)
    if cut == "retired" and name == "pending.json":
        os._exit(23)
os.fsync, os.replace, os.unlink = crash_sync, crash_replace, crash_unlink
o.finish_slot("operation-1", "query-02", {**result, "challenge_id": "query-02"})
os._exit(64)
"""
        for cut in ("intent", "file", "replace", "directory", "retired"):
            with self.subTest(cut=cut), tempfile.TemporaryDirectory() as temp:
                root = Path(temp) / "ledger"
                child = subprocess.Popen(
                    [sys.executable, "-B", "-c", code, str(root), cut],
                    stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                    env={"PATH": "/usr/bin:/bin", "LANG": "C",
                         "PYTHONDONTWRITEBYTECODE": "1", "PYTHONNOUSERSITE": "1",
                         "TMPDIR": temp, "OPENBLAS_NUM_THREADS": "1"})
                try:
                    output, errors = child.communicate(timeout=10)
                    self.assertEqual(child.returncode, 23)
                    self.assertEqual(output, b"")
                    self.assertEqual(errors, b"")
                finally:
                    if child.poll() is None:
                        child.kill()
                    child.wait()
                    child.stdout.close()
                    child.stderr.close()
                self.assertEqual((root / "pending.json").exists(), cut != "retired")
                with Operations(root) as reopened:
                    result = reopened.begin("operation-1", DIGEST)
                    self.assertEqual(result["status"], "write_unknown")
                    self.assertEqual(result["counts"]["accepted"], 2 if cut == "retired" else 1)
                    self.assertEqual(result["counts"]["unknown"], int(cut != "retired"))
                    self.assertTrue(result["slots"]["query-01"]["result"]["eligible"])
                    self.assertEqual(
                        result["slots"]["query-02"]["result"]["eligible"], cut == "retired")
                    self.assertFalse(reopened.claim_slot("operation-1", "query-02"))
                with Operations(root) as again:
                    self.assertEqual(again.begin("operation-1", DIGEST), result)


if __name__ == "__main__":
    unittest.main()
