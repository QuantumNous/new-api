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


if __name__ == "__main__":
    unittest.main()
