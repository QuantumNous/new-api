"""Durable operator admission and one-shot slot intents."""

from contextlib import contextmanager
import copy
import fcntl
import json
import os
from pathlib import Path
import re
import secrets
import stat
import threading

from modeltrace_runtime.numeric_rows import normalize_row


_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\Z")
_STATUSES = {"running", "succeeded", "partial", "failed", "write_unknown"}
_RESULT_STATUSES = {"ok", "invalid_target", "invalid_request", "invalid_response",
                    "http_error", "write_unknown"}
_MAX_BYTES = 16 * 1024 * 1024
_MAX_OPERATIONS = 128


def _identity(value):
    if type(value) is not str or not _ID.fullmatch(value):
        raise ValueError("invalid_identity")
    return value


def _plan_projection(plan):
    if type(plan) is not list or not 1 <= len(plan) <= 36:
        raise ValueError("invalid_plan")
    seen = set()
    projected = []
    for item in plan:
        if type(item) is not dict or set(item) != {"slot_id", "expected_count"}:
            raise ValueError("invalid_plan")
        slot = _identity(item["slot_id"])
        count = item["expected_count"]
        if slot in seen or type(count) is not int or not 0 <= count <= 4096:
            raise ValueError("invalid_plan")
        seen.add(slot)
        projected.append({"slot_id": slot, "expected_count": count})
    return projected


def _result_projection(result):
    if type(result) is not dict or result.get("status") not in _RESULT_STATUSES:
        raise ValueError("invalid_result")
    count = result.get("expected_count")
    numbers = result.get("numbers")
    calls = result.get("transport_calls")
    submitted = result.get("submitted")
    response = result.get("response_received")
    if (type(count) is not int or not 0 <= count <= 4096
            or type(numbers) is not list or len(numbers) > 4096
            or any(type(number) is not int or not 1 <= number <= 355 for number in numbers)
            or (calls is not None and (type(calls) is not int or calls not in (0, 1)))
            or (submitted is not None and type(submitted) is not bool)
            or type(response) is not bool or type(result.get("eligible")) is not bool):
        raise ValueError("invalid_result")
    output = {
        "status": result["status"], "numbers": list(numbers),
        "expected_count": count, "challenge_id": _identity(result.get("challenge_id")),
        "eligible": result["status"] == "ok" and result["eligible"],
        "transport_calls": calls, "submitted": submitted,
        "response_received": response,
    }
    if "row" in result:
        row = normalize_row(result["row"])
        for field in ("row_id", "condition_id", "challenge_id", "nuisance_condition_id"):
            if field in row:
                _identity(row[field])
        if (row["numbers"] != numbers or row["expected_count"] != count
                or row["challenge_id"] != output["challenge_id"]):
            raise ValueError("invalid_result")
        # Protocol failures may preserve numbers, but never enter an enrollable row.
        if output["eligible"]:
            output["row"] = row
    return output


def _view(record):
    output = copy.deepcopy(record)
    entries = list(record["slots"].values())
    results = [item["result"] for item in entries if "result" in item]
    unknown_calls = any(item["status"] == "intent" for item in entries) or any(
        result["transport_calls"] is None for result in results)
    calls = None if unknown_calls else sum(result["transport_calls"] for result in results)
    output["counts"] = {
        "requested": len(record["plan"]), "intents": len(entries),
        "transport_calls": calls,
        "known_responses": sum(result["response_received"] for result in results),
        "accepted": sum(result["eligible"] and len(result["numbers"]) >= max(
            80, (result["expected_count"] * 55 + 99) // 100) for result in results),
        "rejected": sum(result["status"] != "write_unknown" and not (
            result["eligible"] and len(result["numbers"]) >= max(
                80, (result["expected_count"] * 55 + 99) // 100)) for result in results),
        "unknown": sum(item["status"] in ("intent", "write_unknown") for item in entries),
        "unattempted": len(record["plan"]) - len(entries),
    }
    return output


def _hide_uncertain(record, slot):
    entry = record["slots"][slot]
    entry["result"].update({"status": "write_unknown", "eligible": False})
    entry["result"].pop("row", None)
    entry["status"] = record["status"] = "write_unknown"


class Operations:
    def __init__(self, root):
        self._root_fd = None
        self._lease = None
        self._owner = None
        self._pid = os.getpid()
        self._poisoned = False
        self._thread_lock = threading.RLock()
        path = Path(root)
        if not path.is_absolute() or ".." in path.parts:
            raise ValueError("invalid_ledger_root")
        descriptor = os.open("/", os.O_RDONLY | os.O_DIRECTORY)
        try:
            for index, component in enumerate(path.parts[1:]):
                if index == len(path.parts) - 2:
                    try:
                        os.mkdir(component, mode=0o700, dir_fd=descriptor)
                        os.fsync(descriptor)
                    except FileExistsError:
                        pass
                child = os.open(component, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW,
                                dir_fd=descriptor)
                os.close(descriptor)
                descriptor = child
            metadata = os.fstat(descriptor)
            if metadata.st_uid != os.getuid() or metadata.st_mode & 0o077:
                raise ValueError("invalid_ledger_root")
            self._root_fd = descriptor
            descriptor = None
        except (OSError, TypeError):
            raise ValueError("invalid_ledger_root") from None
        finally:
            if descriptor is not None:
                os.close(descriptor)

    def _open(self, name, flags):
        if self._root_fd is None or self._pid != os.getpid():
            raise ValueError("closed_ledger")
        descriptor = os.open(name, flags | os.O_NOFOLLOW | os.O_NONBLOCK,
                             mode=0o600, dir_fd=self._root_fd)
        metadata = os.fstat(descriptor)
        if (not stat.S_ISREG(metadata.st_mode) or metadata.st_nlink != 1
                or metadata.st_uid != os.getuid() or metadata.st_mode & 0o077):
            os.close(descriptor)
            raise ValueError("invalid_ledger_file")
        return descriptor

    @contextmanager
    def _locked(self):
        with self._thread_lock:
            descriptor = self._open("store.lock", os.O_RDWR | os.O_CREAT)
            try:
                fcntl.flock(descriptor, fcntl.LOCK_EX)
                yield
            finally:
                os.close(descriptor)

    def _read_guard(self):
        try:
            descriptor = self._open("pending.json", os.O_RDONLY)
        except FileNotFoundError:
            return None
        try:
            with os.fdopen(descriptor, "rb") as stream:
                payload = stream.read(1025)
            if len(payload) > 1024:
                raise ValueError
            guard = json.loads(payload)
            if (type(guard) is not dict or set(guard) != {
                    "version", "operation_id", "slot_id", "parameter_digest"}
                    or type(guard["version"]) is not int or guard["version"] != 1
                    or type(guard["parameter_digest"]) is not str
                    or not re.fullmatch("[0-9a-f]{64}", guard["parameter_digest"])):
                raise ValueError
            _identity(guard["operation_id"])
            _identity(guard["slot_id"])
            return guard
        except (ValueError, TypeError, KeyError, OverflowError):
            raise ValueError("invalid_ledger_guard") from None

    def _read(self):
        try:
            descriptor = self._open("ledger.json", os.O_RDONLY)
        except FileNotFoundError:
            if self._read_guard() is not None:
                raise ValueError("invalid_ledger_guard")
            return {"version": 2, "operations": {}}
        try:
            with os.fdopen(descriptor, "rb") as stream:
                payload = stream.read(_MAX_BYTES + 1)
            if len(payload) > _MAX_BYTES:
                raise ValueError
            state = json.loads(payload)
            if (type(state) is not dict or set(state) != {"version", "operations"}
                    or type(state["version"]) is not int or state["version"] not in (1, 2)
                    or type(state["operations"]) is not dict
                    or len(state["operations"]) > _MAX_OPERATIONS):
                raise ValueError
            for operation_id, record in state["operations"].items():
                _identity(operation_id)
                if (type(record) is not dict or set(record) != {
                        "operation_id", "parameter_digest", "status", "plan", "slots"}
                        or record["operation_id"] != operation_id
                        or not re.fullmatch("[0-9a-f]{64}", record["parameter_digest"])
                        or record["status"] not in _STATUSES):
                    raise ValueError
                plan = _plan_projection(record["plan"]) if record["plan"] else []
                if record["plan"] != plan or type(record["slots"]) is not dict:
                    raise ValueError
                planned = {item["slot_id"]: item["expected_count"] for item in plan}
                for slot, entry in record["slots"].items():
                    if slot not in planned or type(entry) is not dict:
                        raise ValueError
                    if entry == {"status": "intent"}:
                        continue
                    if (set(entry) != {"status", "result"}
                            or entry["result"] != _result_projection(entry["result"])
                            or entry["status"] != entry["result"]["status"]
                            or entry["result"]["challenge_id"] != slot
                            or entry["result"]["expected_count"] != planned[slot]):
                        raise ValueError
                # Version 1 had no commit veto. Only the last attempted terminal
                # slot of an interrupted operation is ambiguous; prior slots were
                # committed before the next intent could authorize dispatch.
                attempted = [slot for slot in planned if slot in record["slots"]]
                if (state["version"] == 1 and attempted
                        and record["status"] in ("running", "write_unknown")
                        and record["slots"][attempted[-1]]["status"] != "intent"):
                    _hide_uncertain(record, attempted[-1])
            guard = self._read_guard()
            if guard is not None:
                record = state["operations"][guard["operation_id"]]
                attempted = [item["slot_id"] for item in record["plan"]
                             if item["slot_id"] in record["slots"]]
                if (record["parameter_digest"] != guard["parameter_digest"]
                        or not attempted or attempted[-1] != guard["slot_id"]):
                    raise ValueError
                entry = record["slots"][guard["slot_id"]]
                # Readability after replace is not proof that terminal fsync succeeded.
                if entry["status"] != "intent":
                    _hide_uncertain(record, guard["slot_id"])
            state["version"] = 2
            return state
        except (ValueError, TypeError, KeyError, OverflowError):
            raise ValueError("invalid_ledger_state") from None

    def _write(self, state):
        self._persist("ledger.json", state)

    def _persist(self, destination, state):
        payload = json.dumps(state, sort_keys=True, allow_nan=False,
                             separators=(",", ":")).encode()
        if len(payload) > _MAX_BYTES:
            self._poisoned = True
            raise OSError("ledger_capacity")
        name = ".txn-" + secrets.token_hex(16)
        descriptor = None
        try:
            descriptor = self._open(name, os.O_WRONLY | os.O_CREAT | os.O_EXCL)
            with os.fdopen(descriptor, "wb") as stream:
                descriptor = None
                stream.write(payload)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(name, destination, src_dir_fd=self._root_fd,
                       dst_dir_fd=self._root_fd)
            os.fsync(self._root_fd)
        except OSError:
            self._poisoned = True
            raise OSError("ledger_persistence_failed") from None
        finally:
            if descriptor is not None:
                os.close(descriptor)
            try:
                os.unlink(name, dir_fd=self._root_fd)
            except OSError:
                pass

    def _release(self):
        if self._lease is not None:
            os.close(self._lease)
            self._lease = None
        self._owner = None

    def _owned(self, operation_id):
        return (self._pid == os.getpid() and self._owner == operation_id
                and self._lease is not None and not self._poisoned)

    def _recover(self, state):
        changed = False
        for record in state["operations"].values():
            if (record["status"] != "running"
                    and not any(entry["status"] == "intent"
                                for entry in record["slots"].values())):
                continue
            record["status"] = "write_unknown"
            expected = {item["slot_id"]: item["expected_count"] for item in record["plan"]}
            for slot, entry in record["slots"].items():
                if entry["status"] == "intent":
                    entry.update({"status": "write_unknown", "result": {
                        "status": "write_unknown", "numbers": [], "eligible": False,
                        "challenge_id": slot, "expected_count": expected[slot],
                        "transport_calls": None, "submitted": None,
                        "response_received": False,
                    }})
            changed = True
        return changed

    def begin(self, operation_id: str, parameter_digest: str) -> dict:
        _identity(operation_id)
        if type(parameter_digest) is not str or not re.fullmatch("[0-9a-f]{64}", parameter_digest):
            raise ValueError("invalid_parameter_digest")
        with self._locked():
            state = self._read()
            record = state["operations"].get(operation_id)
            if record is not None and record["parameter_digest"] != parameter_digest:
                return {"status": "conflict"}
            if self._owner is None:
                lease = self._open("active.lock", os.O_RDWR | os.O_CREAT)
                try:
                    fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
                except BlockingIOError:
                    os.close(lease)
                    return _view(record) if record is not None else {"status": "busy"}
                except BaseException:
                    os.close(lease)
                    raise
                self._lease = lease
                try:
                    if self._recover(state):
                        try:
                            self._write(state)
                        except OSError:
                            self._poisoned = True
                            # Validated history remains readable, never executable.
                            if record is None:
                                raise
                except BaseException:
                    self._release()
                    raise
            if record is not None:
                if self._owner is None:
                    self._release()
                return _view(record)
            if self._owner is not None:
                return {"status": "busy"}
            if self._poisoned or len(state["operations"]) >= _MAX_OPERATIONS:
                self._release()
                raise ValueError("ledger_capacity")
            record = {"operation_id": operation_id, "parameter_digest": parameter_digest,
                      "status": "running", "plan": [], "slots": {}}
            state["operations"][operation_id] = record
            try:
                self._write(state)
            except BaseException:
                self._release()
                raise
            self._owner = operation_id
            return {**_view(record), "_created": True}

    def claim_slot(self, operation_id: str, slot_id: str) -> bool:
        _identity(operation_id)
        _identity(slot_id)
        with self._locked():
            if not self._owned(operation_id):
                return False
            state = self._read()
            record = state["operations"][operation_id]
            if record["status"] != "running" or slot_id in record["slots"]:
                return False
            slots = record["slots"]
            unclaimed = [item["slot_id"] for item in record["plan"]
                         if item["slot_id"] not in slots]
            if (not unclaimed or unclaimed[0] != slot_id
                    or any(entry["status"] in ("intent", "write_unknown") for entry in slots.values())):
                return False
            slots[slot_id] = {"status": "intent"}
            self._write(state)
            # This immutable veto is durable before dispatch, not after the response.
            self._persist("pending.json", {
                "version": 1, "operation_id": operation_id, "slot_id": slot_id,
                "parameter_digest": record["parameter_digest"],
            })
            return True

    def finish_slot(self, operation_id: str, slot_id: str, result: dict) -> None:
        _identity(operation_id)
        _identity(slot_id)
        projected = _result_projection(result)
        with self._locked():
            if not self._owned(operation_id):
                raise ValueError("not_operation_owner")
            state = self._read()
            record = state["operations"][operation_id]
            if record["slots"].get(slot_id) != {"status": "intent"}:
                raise ValueError("not_slot_owner")
            expected = next(item["expected_count"] for item in record["plan"]
                            if item["slot_id"] == slot_id)
            if projected["challenge_id"] != slot_id or projected["expected_count"] != expected:
                raise ValueError("invalid_result")
            if self._read_guard() != {
                "version": 1, "operation_id": operation_id, "slot_id": slot_id,
                "parameter_digest": record["parameter_digest"],
            }:
                raise ValueError("missing_slot_guard")
            record["slots"][slot_id] = {"status": projected["status"], "result": projected}
            if projected["status"] == "write_unknown":
                record["status"] = "write_unknown"
            self._write(state)
            # Only a fully fsynced result may retire the veto. Retirement need not
            # survive a crash: a restored guard hides only this last slot. The next
            # claim syncs the namespace before dispatch, preserving earlier results.
            try:
                os.unlink("pending.json", dir_fd=self._root_fd)
            except OSError:
                self._poisoned = True
                raise OSError("ledger_persistence_failed") from None

    def _attach_plan(self, operation_id, plan):
        projected = _plan_projection(plan)
        with self._locked():
            if not self._owned(operation_id):
                raise ValueError("not_operation_owner")
            state = self._read()
            record = state["operations"][operation_id]
            if record["plan"] or record["slots"]:
                raise ValueError("plan_already_attached")
            record["plan"] = projected
            self._write(state)

    def _finalize(self, operation_id, status):
        if status not in _STATUSES - {"running"}:
            raise ValueError("invalid_operation_status")
        try:
            with self._thread_lock:
                if self._owner != operation_id:
                    raise ValueError("not_operation_owner")
                with self._locked():
                    state = self._read()
                    record = state["operations"][operation_id]
                    if self._poisoned or record["status"] == "write_unknown":
                        status = "write_unknown"
                    if status == "succeeded" and (
                        len(record["slots"]) != len(record["plan"]) or not record["plan"]
                        or any(item["status"] != "ok" for item in record["slots"].values())
                    ):
                        raise ValueError("incomplete_operation")
                    record["status"] = status
                    self._write(state)
                    return _view(record)
        finally:
            if self._owner == operation_id:
                self._release()

    def close(self):
        with self._thread_lock:
            self._release()
            if self._root_fd is not None:
                os.close(self._root_fd)
                self._root_fd = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
