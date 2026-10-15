from concurrent.futures import ThreadPoolExecutor
import errno
import fcntl
import hashlib
import inspect
import json
import os
from pathlib import Path
import select
import signal
import stat
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from unittest.mock import patch

from modeltrace_runtime.operations import Operations


DIGEST = "a" * 64
PLAN = [{"slot_id": "query-01", "expected_count": 100}]
RESULT = {"status": "ok", "numbers": [3, 2, 3] * 30, "eligible": True,
          "expected_count": 100, "challenge_id": "query-01",
          "transport_calls": 1, "submitted": True, "response_received": True}

LEASE_PROBE = """import fcntl, json, os, sys
descriptor = os.open(sys.argv[1], os.O_RDWR | os.O_NOFOLLOW)
try:
    try:
        fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        available = True
    except BlockingIOError:
        available = False
finally:
    os.close(descriptor)
print(json.dumps({"lock_available": available, "descriptor_closed": True}))
"""


def _finalization_evidence(label):
    output = Path(os.environ["TMPDIR"]).parent / "finalization-observations" / label
    output.mkdir(parents=True, exist_ok=False)
    return output


def _lease_available(root, output, label):
    helper = output / (label + "-lease_probe.py")
    helper.write_text(LEASE_PROBE)
    environment = {"PATH": "/usr/bin:/bin", "LANG": "C", "PYTHONNOUSERSITE": "1",
                   "PYTHONDONTWRITEBYTECODE": "1"}
    argv = [sys.executable, "-I", "-B", str(helper), str(root / "active.lock")]
    (output / (label + "-command.json")).write_text(json.dumps({
        "argv": argv, "cwd": str(output), "environment": environment,
        "helper_sha256": hashlib.sha256(helper.read_bytes()).hexdigest(),
    }, sort_keys=True, indent=2) + "\n")
    child = subprocess.Popen(argv, cwd=output, env=environment,
                             stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    try:
        stdout, stderr = child.communicate(timeout=10)
    finally:
        if child.poll() is None:
            child.kill()
        child.wait(timeout=10)
        child.stdout.close()
        child.stderr.close()
        (output / (label + "-reap.json")).write_text(json.dumps({
            "pid": child.pid, "returncode": child.returncode, "waited_and_reaped": True,
            "wait_timeout_seconds": 10,
        }, sort_keys=True, indent=2) + "\n")
    (output / (label + "-stdout.log")).write_bytes(stdout)
    (output / (label + "-stderr.log")).write_bytes(stderr)
    if child.returncode != 0 or stderr:
        raise AssertionError("separate-process lease probe failed")
    return json.loads(stdout)["lock_available"]


class OperationsTest(unittest.TestCase):
    def test_owned_finalization_native_thread_lock_cancellation_releases_before_escape(self):
        cases = [(kind, foreign) for kind in ("KeyboardInterrupt", "SystemExit")
                 for foreign in (False, True)]
        for kind, foreign in cases:
            with self.subTest(kind=kind, foreign=foreign), tempfile.TemporaryDirectory() as temp:
                output = _finalization_evidence(
                    "native-thread-lock-" + kind + ("-foreign" if foreign else "-owned"))
                root = Path(temp) / "ledger"
                with Operations(root) as owner:
                    owner.begin("operation-1", DIGEST)
                    owner._attach_plan("operation-1", PLAN + [
                        {"slot_id": "query-02", "expected_count": 100}])
                    owner.claim_slot("operation-1", "query-01")
                    owner.finish_slot("operation-1", "query-01", RESULT)
                    owner.claim_slot("operation-1", "query-02")
                    sync, close = os.fsync, os.close
                    lease = owner._lease
                    raised, closes, waiting, holder_errors = [], [], [], []
                    ready, release = threading.Event(), threading.Event()
                    cancellation = SystemExit("controlled-native-thread-lock")
                    signum = signal.SIGINT if kind == "KeyboardInterrupt" else signal.SIGUSR1
                    old_handler = signal.getsignal(signum)
                    code = owner._finalize.__func__.__code__
                    source, first_line = inspect.getsourcelines(owner._finalize)
                    lock_line = first_line + next(
                        index for index, line in enumerate(source)
                        if line.strip() == "with self._thread_lock:")
                    main_id = threading.get_ident()

                    def handler(number, frame):
                        try:
                            if kind == "KeyboardInterrupt":
                                signal.default_int_handler(number, frame)
                            else:
                                raise cancellation
                        except (KeyboardInterrupt, SystemExit) as error:
                            raised.append(error)
                            raise

                    def hold_and_interrupt():
                        try:
                            with owner._thread_lock:
                                ready.set()
                                deadline = time.monotonic() + 5
                                while time.monotonic() < deadline:
                                    frame = sys._current_frames()[main_id]
                                    if frame.f_code is code and frame.f_lineno == lock_line:
                                        waiting.append(frame.f_lineno)
                                        os.kill(os.getpid(), signum)
                                        if not release.wait(timeout=10):
                                            raise AssertionError("native lock holder release timeout")
                                        return
                                    release.wait(timeout=0.001)
                                raise AssertionError("owned native lock wait not observed")
                        except BaseException as error:
                            holder_errors.append(type(error).__name__ + ":" + str(error))

                    def failing_sync(descriptor):
                        if stat.S_ISREG(os.fstat(descriptor).st_mode):
                            raise OSError("controlled-native-history-fsync")
                        return sync(descriptor)

                    def counted_close(descriptor):
                        if descriptor == lease:
                            closes.append(descriptor)
                        return close(descriptor)

                    with patch("modeltrace_runtime.operations.os.fsync",
                               side_effect=failing_sync):
                        with self.assertRaises(OSError):
                            owner.finish_slot("operation-1", "query-02", {
                                **RESULT, "challenge_id": "query-02"})
                        self.assertTrue(owner._poisoned)
                        signal.signal(signum, handler)
                        holder = threading.Thread(target=hold_and_interrupt)
                        holder.start()
                        try:
                            self.assertTrue(ready.wait(timeout=5))
                            with patch("modeltrace_runtime.operations.os.close",
                                       side_effect=counted_close):
                                with self.assertRaises(KeyboardInterrupt if kind == "KeyboardInterrupt"
                                                       else SystemExit) as caught:
                                    owner._finalize("foreign-1" if foreign else "operation-1",
                                                    "write_unknown")
                            self.assertEqual(len(raised), 1)
                            self.assertIs(caught.exception, raised[0])
                            self.assertTrue(waiting)
                            available = _lease_available(root, output, "before-holder-release")
                            try:
                                os.fstat(lease)
                                closed = False
                            except OSError as error:
                                self.assertEqual(error.errno, errno.EBADF)
                                closed = True
                            (output / "observation.json").write_text(json.dumps({
                                "owner": owner._owner, "lease": owner._lease,
                                "lock_available": available, "lease_closed": closed,
                                "lease_close_count": len(closes), "poisoned": owner._poisoned,
                                "waiting_source_lines": waiting, "holder_alive": holder.is_alive(),
                                "same_exception_object": caught.exception is raised[0],
                                "foreign_finalization": foreign,
                            }, sort_keys=True, indent=2) + "\n")
                            expected = ((lease, "operation-1", False, False, 0) if foreign
                                        else (None, None, True, True, 1))
                            self.assertEqual(
                                (owner._lease, owner._owner, available, closed, len(closes)),
                                expected,
                                "native lock cancellation must release only this finalization's owned lease")
                        finally:
                            release.set()
                            holder.join(timeout=10)
                            signal.signal(signum, old_handler)
                            (output / "thread-reap.json").write_text(json.dumps({
                                "joined": not holder.is_alive(), "errors": holder_errors,
                                "join_timeout_seconds": 10,
                            }, sort_keys=True, indent=2) + "\n")
                            self.assertFalse(holder.is_alive())
                            self.assertEqual(holder_errors, [])
                        if foreign:
                            with self.assertRaises(OSError):
                                owner._finalize("operation-1", "write_unknown")
                            self.assertTrue(_lease_available(root, output, "after-owned-finalization"))
                        record = owner.begin("operation-1", DIGEST)
                        self.assertNotIn("_created", record)
                        self.assertEqual(record["counts"]["accepted"], 1)
                        self.assertEqual(record["counts"]["unknown"], 1)
                        self.assertEqual(record["slots"]["query-01"]["result"], RESULT)
                        self.assertFalse(owner.claim_slot("operation-1", "query-02"))
                        self.assertIsNone(owner._lease)
                        (output / "replay.json").write_text(
                            json.dumps(record, sort_keys=True, indent=2) + "\n")

    def test_foreign_finalization_never_releases_live_owner_or_reaches_read_write(self):
        with tempfile.TemporaryDirectory() as temp:
            output = _finalization_evidence("foreign-boundary-guard")
            root = Path(temp) / "ledger"
            with Operations(root) as owner:
                owner.begin("operation-1", DIGEST)
                owner._attach_plan("operation-1", PLAN)
                lease = owner._lease
                ledger = (root / "ledger.json").read_bytes()
                fault = SystemExit("controlled-foreign-boundary")

                with patch("modeltrace_runtime.operations.fcntl.flock",
                           side_effect=fault) as locked, patch.object(
                        owner, "_read", side_effect=fault) as read, patch.object(
                        owner, "_write", side_effect=fault) as write:
                    with self.assertRaisesRegex(ValueError, "not_operation_owner") as caught:
                        owner._finalize("foreign-1", "succeeded")
                    self.assertEqual(locked.call_count, 0)
                    self.assertEqual(read.call_count, 0)
                    self.assertEqual(write.call_count, 0)
                self.assertEqual((owner._owner, owner._lease), ("operation-1", lease))
                self.assertFalse(owner._poisoned)
                self.assertTrue(stat.S_ISREG(os.fstat(lease).st_mode))
                self.assertFalse(_lease_available(root, output, "after-foreign"))
                self.assertEqual((root / "ledger.json").read_bytes(), ledger)
                (output / "observation.json").write_text(json.dumps({
                    "owner": owner._owner, "lease": owner._lease, "lock_available": False,
                    "poisoned": owner._poisoned, "lock_calls": locked.call_count,
                    "read_calls": read.call_count,
                    "write_calls": write.call_count, "exception": type(caught.exception).__name__,
                }, sort_keys=True, indent=2) + "\n")
                self.assertTrue(owner.claim_slot("operation-1", "query-01"))
                owner.finish_slot("operation-1", "query-01", RESULT)
                result = owner._finalize("operation-1", "succeeded")
                self.assertEqual(result["status"], "succeeded")
                self.assertEqual(result["counts"]["accepted"], 1)
                self.assertTrue(_lease_available(root, output, "after-owned-success"))

    def test_owned_record_validation_releases_but_invalid_status_preserves_lease(self):
        with tempfile.TemporaryDirectory() as temp:
            output = _finalization_evidence("owned-record-validation")
            root = Path(temp) / "ledger"
            with Operations(root) as owner:
                owner.begin("operation-1", DIGEST)
                owner._attach_plan("operation-1", PLAN)
                lease = owner._lease
                with self.assertRaisesRegex(ValueError, "invalid_operation_status"):
                    owner._finalize("operation-1", "running")
                self.assertEqual((owner._owner, owner._lease), ("operation-1", lease))
                self.assertFalse(_lease_available(root, output, "after-invalid-status"))
                ledger = (root / "ledger.json").read_bytes()
                with self.assertRaisesRegex(ValueError, "incomplete_operation"):
                    owner._finalize("operation-1", "succeeded")
                self.assertIsNone(owner._owner)
                self.assertIsNone(owner._lease)
                self.assertTrue(_lease_available(root, output, "after-record-validation"))
                self.assertEqual((root / "ledger.json").read_bytes(), ledger)
                with self.assertRaises(OSError) as caught:
                    os.fstat(lease)
                self.assertEqual(caught.exception.errno, errno.EBADF)
                replay = owner.begin("operation-1", DIGEST)
                self.assertEqual(replay["status"], "write_unknown")
                self.assertNotIn("_created", replay)
                self.assertFalse(owner.claim_slot("operation-1", "query-01"))
                (output / "replay.json").write_text(
                    json.dumps(replay, sort_keys=True, indent=2) + "\n")

    def seed_interrupted_history(self, root, operation_id="operation-1"):
        with Operations(root) as owner:
            owner.begin(operation_id, DIGEST)
            owner._attach_plan(operation_id, PLAN + [
                {"slot_id": "query-02", "expected_count": 100}])
            self.assertTrue(owner.claim_slot(operation_id, "query-01"))
            owner.finish_slot(operation_id, "query-01", RESULT)
            self.assertTrue(owner.claim_slot(operation_id, "query-02"))
        return json.loads((root / "ledger.json").read_bytes())

    def test_readable_recovery_faults_never_grant_admission_or_ownership(self):
        for boundary in ("file", "replace"):
            with self.subTest(boundary=boundary), tempfile.TemporaryDirectory() as temp:
                root = Path(temp) / "ledger"
                self.seed_interrupted_history(root)
                ledger = (root / "ledger.json").read_bytes()
                guard = (root / "pending.json").read_bytes()
                sync, replace = os.fsync, os.replace

                def failing_sync(descriptor):
                    if boundary == "file" and stat.S_ISREG(os.fstat(descriptor).st_mode):
                        raise OSError("synthetic-recovery-secret")
                    return sync(descriptor)

                def failing_replace(source, destination, **options):
                    if boundary == "replace":
                        raise OSError("synthetic-recovery-secret")
                    return replace(source, destination, **options)

                with Operations(root) as operations:
                    with patch("modeltrace_runtime.operations.os.fsync",
                               side_effect=failing_sync), patch(
                            "modeltrace_runtime.operations.os.replace",
                            side_effect=failing_replace):
                        saved = operations.begin("operation-1", DIGEST)
                        self.assertEqual(saved["counts"], {
                            "requested": 2, "intents": 2, "transport_calls": None,
                            "known_responses": 1, "accepted": 1, "rejected": 0,
                            "unknown": 1, "unattempted": 0,
                        })
                        self.assertEqual(saved["status"], "write_unknown")
                        self.assertEqual(saved["slots"]["query-01"]["result"], RESULT)
                        self.assertNotIn("_created", saved)
                        for operation_id in ("operation-1", "operation-2"):
                            self.assertFalse(operations.claim_slot(operation_id, "query-02"))
                            with self.assertRaisesRegex(ValueError, "not_operation_owner"):
                                operations._attach_plan(operation_id, PLAN)
                            with self.assertRaisesRegex(ValueError, "not_operation_owner"):
                                operations.finish_slot(operation_id, "query-01", RESULT)
                        self.assertTrue(operations._poisoned)
                        self.assertIsNone(operations._owner)
                        self.assertIsNone(operations._lease)
                        self.assertEqual(operations.begin("operation-1", DIGEST), saved)
                        saved["slots"]["query-01"]["result"]["numbers"].clear()
                        self.assertEqual(
                            operations.begin("operation-1", DIGEST)["slots"][
                                "query-01"]["result"], RESULT)
                        self.assertEqual(operations.begin(
                            "operation-1", "b" * 64), {"status": "conflict"})
                        with self.assertRaisesRegex(OSError, "ledger_persistence_failed"):
                            operations.begin("operation-2", DIGEST)
                        self.assertIsNone(operations._lease)
                        # A fresh, initially unpoisoned instance also cannot admit work.
                        with Operations(root) as other:
                            with self.assertRaisesRegex(OSError, "ledger_persistence_failed"):
                                other.begin("operation-2", DIGEST)
                            self.assertTrue(other._poisoned)
                            self.assertIsNone(other._lease)
                            self.assertIsNone(other._owner)
                        self.assertEqual((root / "ledger.json").read_bytes(), ledger)
                        self.assertEqual((root / "pending.json").read_bytes(), guard)
                    with self.assertRaisesRegex(ValueError, "ledger_capacity"):
                        operations.begin("operation-2", DIGEST)
                    self.assertIsNone(operations._lease)
                with Operations(root) as healthy:
                    self.assertTrue(healthy.begin("operation-2", DIGEST)["_created"])
                    self.assertEqual(healthy.begin(
                        "operation-1", DIGEST)["counts"]["accepted"], 1)

    def test_recovery_of_multiple_historical_operations_preserves_safe_samples(self):
        with tempfile.TemporaryDirectory() as temp:
            parent = Path(temp)
            records = {}
            for operation_id in ("history-1", "history-2"):
                state = self.seed_interrupted_history(parent / operation_id, operation_id)
                records.update(state["operations"])
            with Operations(parent / "completed") as complete:
                complete.begin("history-0", DIGEST)
                complete._attach_plan("history-0", PLAN)
                complete.claim_slot("history-0", "query-01")
                complete.finish_slot("history-0", "query-01", RESULT)
                complete._finalize("history-0", "succeeded")
            records.update(json.loads((parent / "completed/ledger.json").read_bytes())[
                "operations"])
            # Model an imported version-1 snapshot with multiple unfinished owners,
            # using actual persisted histories rather than invented terminal samples.
            root = parent / "ledger"
            root.mkdir(mode=0o700)
            ledger = root / "ledger.json"
            ledger.write_text(json.dumps({"version": 1, "operations": records}))
            ledger.chmod(0o600)
            original = ledger.read_bytes()
            with Operations(root) as operations:
                with patch("modeltrace_runtime.operations.os.replace",
                           side_effect=OSError("synthetic-multi-history")):
                    completed = operations.begin("history-0", DIGEST)
                    self.assertEqual(completed["status"], "succeeded")
                    self.assertEqual(completed["slots"]["query-01"]["result"], RESULT)
                    for operation_id in ("history-1", "history-2"):
                        recovered = operations.begin(operation_id, DIGEST)
                        self.assertEqual(recovered["status"], "write_unknown")
                        self.assertEqual(recovered["counts"]["accepted"], 1)
                        self.assertEqual(recovered["counts"]["unknown"], 1)
                        self.assertEqual(recovered["slots"]["query-01"]["result"], RESULT)
                        uncertain = recovered["slots"]["query-02"]["result"]
                        self.assertEqual(uncertain["numbers"], [])
                        self.assertFalse(uncertain["eligible"])
                        self.assertNotIn("row", uncertain)
                        self.assertEqual(operations.begin(operation_id, DIGEST), recovered)
                        self.assertIsNone(operations._lease)
                    with self.assertRaises(OSError):
                        operations.begin("new-history", DIGEST)
                    self.assertEqual(ledger.read_bytes(), original)
            with Operations(root) as healthy:
                self.assertEqual(healthy.begin("history-0", DIGEST), completed)
                self.assertEqual(healthy._read()["operations"]["history-2"]["status"],
                                 "write_unknown")
                self.assertEqual(healthy.begin("history-1", DIGEST)["counts"]["accepted"], 1)

    def test_replay_does_not_hide_validation_projection_or_interruption_errors(self):
        faults = (
            ("_read", OSError), ("_read", ValueError), ("_recover", OSError),
            ("_write", ValueError), ("_write", KeyboardInterrupt), ("_write", SystemExit),
        )
        for method, error in faults:
            with self.subTest(method=method, error=error.__name__):
                with tempfile.TemporaryDirectory() as temp:
                    root = Path(temp) / "ledger"
                    self.seed_interrupted_history(root)
                    with Operations(root) as operations:
                        with patch.object(operations, method, side_effect=error("controlled")):
                            with self.assertRaises(error):
                                operations.begin("operation-1", DIGEST)
                        self.assertIsNone(operations._lease)
                        self.assertIsNone(operations._owner)
                        self.assertFalse(operations._poisoned)
                        self.assertEqual(operations.begin(
                            "operation-1", DIGEST)["counts"]["accepted"], 1)

    def test_failed_lease_acquisition_closes_descriptor_and_propagates(self):
        for error in (OSError, KeyboardInterrupt, SystemExit):
            with self.subTest(error=error.__name__), tempfile.TemporaryDirectory() as temp:
                root = Path(temp) / "ledger"
                self.seed_interrupted_history(root)
                with Operations(root) as operations:
                    descriptors = []
                    original_open, original_flock = operations._open, fcntl.flock

                    def capture_open(name, flags):
                        descriptor = original_open(name, flags)
                        if name == "active.lock":
                            descriptors.append(descriptor)
                        return descriptor

                    def failing_flock(descriptor, flags):
                        if flags & fcntl.LOCK_NB:
                            raise error("controlled-lease")
                        return original_flock(descriptor, flags)

                    with patch.object(operations, "_open", side_effect=capture_open), patch(
                            "modeltrace_runtime.operations.fcntl.flock",
                            side_effect=failing_flock):
                        with self.assertRaises(error):
                            operations.begin("operation-1", DIGEST)
                    self.assertEqual(len(descriptors), 1)
                    self.assertIsNone(operations._lease)
                    self.assertIsNone(operations._owner)
                    self.assertFalse(operations._poisoned)
                    try:
                        with self.assertRaises(OSError) as raised:
                            os.fstat(descriptors[0])
                        self.assertEqual(raised.exception.errno, errno.EBADF)
                    finally:
                        try:
                            os.close(descriptors[0])
                        except OSError:
                            pass

    def test_corrupt_historical_ledger_or_guard_never_uses_recovery_fallback(self):
        for destination in ("ledger.json", "pending.json"):
            with self.subTest(destination=destination), tempfile.TemporaryDirectory() as temp:
                root = Path(temp) / "ledger"
                self.seed_interrupted_history(root)
                (root / destination).write_bytes(b"{broken")
                with Operations(root) as operations:
                    with patch("modeltrace_runtime.operations.os.replace",
                               side_effect=OSError("controlled-corrupt-write")) as replacement:
                        with self.assertRaisesRegex(ValueError, "invalid_ledger_state"):
                            operations.begin("operation-1", DIGEST)
                        with self.assertRaisesRegex(ValueError, "invalid_ledger_state"):
                            operations.begin("new-history", DIGEST)
                        self.assertEqual(replacement.call_count, 0)
                    self.assertFalse(operations._poisoned)
                    self.assertIsNone(operations._lease)
                    self.assertIsNone(operations._owner)

    def test_readable_guarded_terminal_row_is_never_accepted_under_write_failure(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "ledger"
            row = {
                "row_id": "row-01", "condition_id": "baseline",
                "challenge_id": "query-01", "expected_count": 100,
                "numbers": RESULT["numbers"], "source": "sample-model",
            }
            with Operations(root) as owner:
                owner.begin("operation-1", DIGEST)
                owner._attach_plan("operation-1", PLAN + [
                    {"slot_id": "query-02", "expected_count": 100}])
                owner.claim_slot("operation-1", "query-01")
                owner.finish_slot("operation-1", "query-01", {**RESULT, "row": row})
                prior = owner._read()["operations"]["operation-1"]["slots"]["query-01"]
                owner.claim_slot("operation-1", "query-02")
                sync = os.fsync

                def failing_directory_sync(descriptor):
                    if descriptor == owner._root_fd:
                        raise OSError("controlled-guarded-terminal")
                    return sync(descriptor)

                with patch("modeltrace_runtime.operations.os.fsync",
                           side_effect=failing_directory_sync):
                    with self.assertRaises(OSError):
                        owner.finish_slot("operation-1", "query-02", {
                            **RESULT, "challenge_id": "query-02",
                            "row": {**row, "row_id": "row-02", "challenge_id": "query-02"},
                        })
            raw = json.loads((root / "ledger.json").read_bytes())
            self.assertTrue(raw["operations"]["operation-1"]["slots"][
                "query-02"]["result"]["eligible"])
            self.assertTrue((root / "pending.json").exists())
            with Operations(root) as reopened:
                with patch("modeltrace_runtime.operations.os.replace",
                           side_effect=OSError("controlled-guarded-recovery")):
                    result = reopened.begin("operation-1", DIGEST)
                    self.assertEqual(result["status"], "write_unknown")
                    self.assertEqual(result["slots"]["query-01"], prior)
                    self.assertEqual(result["counts"]["accepted"], 1)
                    self.assertEqual(result["counts"]["unknown"], 1)
                    uncertain = result["slots"]["query-02"]["result"]
                    self.assertFalse(uncertain["eligible"])
                    self.assertNotIn("row", uncertain)
                    self.assertFalse(reopened.claim_slot("operation-1", "query-02"))
                    self.assertEqual(reopened.begin("operation-1", DIGEST), result)
                    with self.assertRaises(OSError):
                        reopened.begin("new-history", DIGEST)
                    self.assertIsNone(reopened._lease)
                    self.assertIsNone(reopened._owner)

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
