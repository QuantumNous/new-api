"""Operator collection with an explicitly bound durable session."""

import copy
import hashlib
import json
from pathlib import Path

from modeltrace_runtime import bank_validation, engine, numeric_rows
from modeltrace_runtime.operations import Operations, _identity, _view
from modeltrace_runtime.transport import (
    OneShotTransport, _request, _validate_target, request_once,
)
from third_party.modeltrace import challenge_suite, fingerprint


class _CollectionSession:
    def __init__(self, operations, operation_id, transport, *, model_label,
                 family_id=None, family_name=None, bank_bytes=None):
        if not isinstance(operations, Operations) or not callable(transport):
            raise ValueError("invalid_session")
        _identity(operation_id)
        if (family_id is None) != (family_name is None):
            raise ValueError("invalid_session")
        labels = {"source": model_label}
        if family_id is not None:
            labels.update({"family_id": family_id, "family_name": family_name})
        numeric_rows.normalize_row({
            "row_id": "validation", "condition_id": "validation",
            "challenge_id": "validation", "expected_count": 0, "numbers": [],
            **labels,
        })
        self.bank_revision = None
        self.bank = None
        if bank_bytes is not None:
            if type(bank_bytes) is not bytes or not 0 < len(bank_bytes) <= 16 * 1024 * 1024:
                raise ValueError("invalid_bank")
            try:
                snapshot = json.loads(bank_bytes)
                bank_validation.validate_bank(snapshot)
            except (ValueError, TypeError, KeyError):
                raise ValueError("invalid_bank") from None
            self.bank_revision = hashlib.sha256(bank_bytes).hexdigest()
            self.bank = snapshot
        self.operations = operations
        self.operation_id = operation_id
        self.transport = transport
        self.labels = labels

    def _probe_once(self, target, challenge):
        capability = (
            self.transport._capability if isinstance(self.transport, OneShotTransport) else None
        )
        try:
            target = _validate_target(target, capability)
        except (ValueError, TypeError, KeyError):
            return {"status": "invalid_target"}
        try:
            if (
                type(challenge) is not dict
                or not {"id", "prompt", "expected_count"} <= set(challenge)
                or set(challenge) - {"id", "prompt", "expected_count", "system", "user_prefix"}
            ):
                raise ValueError("invalid_request")
            challenge = copy.deepcopy(challenge)
            _request(target, challenge)
        except (ValueError, TypeError, KeyError, OverflowError):
            return {"status": "invalid_request"}
        record = _collect(target, self, "probe", 1, challenge)
        return {**record, "complete": record["status"] == "succeeded"}


def _collect(target, session, action, count, fixed_challenge=None):
    operation_id = session.operation_id
    operations = session.operations
    raw_transport = session.transport
    labels = dict(session.labels)
    parameters = {
        "action": action, "target": target, "labels": labels,
        "sample_count": count, "bank_revision": session.bank_revision,
        "fixed_challenge": fixed_challenge,
        "challenge_program": {
            module.__name__: hashlib.sha256(Path(module.__file__).read_bytes()).hexdigest()
            for module in (fingerprint, challenge_suite)
        },
    }
    parameter_digest = hashlib.sha256(json.dumps(
        parameters, sort_keys=True, allow_nan=False,
    ).encode()).hexdigest()
    try:
        record = operations.begin(operation_id, parameter_digest)
    except (OSError, ValueError):
        return {"status": "ledger_unavailable"}
    if not record.get("_created", False):
        return record
    record.pop("_created")
    record.pop("counts")
    status = "failed"
    try:
        if action == "probe":
            challenges = [fixed_challenge]
        elif action == "test":
            challenges = fingerprint.generate_challenges(3)
        else:
            suite = challenge_suite.fingerprint_suite()
            challenges = [
                {**suite[(index * len(suite)) // count],
                 "id": suite[(index * len(suite)) // count]["challenge_id"]}
                for index in range(count)
            ]
        if type(challenges) is not list or len(challenges) != count:
            raise ValueError("invalid_challenge_plan")
        plan = [
            {"slot_id": challenge["id"], "expected_count": challenge["expected_count"]}
            for challenge in challenges
        ]
        # Plan validation and persistence both precede the first provider child.
        operations._attach_plan(operation_id, plan)
        record["plan"] = plan
        for challenge in challenges:
            slot = challenge["id"]
            if not operations.claim_slot(operation_id, slot):
                status = "write_unknown"
                break
            record["slots"][slot] = {"status": "intent"}
            result = {
                **request_once(target, challenge, raw_transport),
                "challenge_id": slot, "expected_count": challenge["expected_count"],
            }
            if action == "enroll" and result["eligible"]:
                result["row"] = numeric_rows.normalize_row({
                    "row_id": hashlib.sha256(
                        (operation_id + "\0" + slot).encode(),
                    ).hexdigest(),
                    "condition_id": challenge["condition"],
                    "nuisance_condition_id": challenge["condition"],
                    "challenge_id": slot, "expected_count": result["expected_count"],
                    "numbers": result["numbers"], **labels,
                })
            record["slots"][slot] = {
                "status": result["status"], "result": copy.deepcopy(result),
            }
            try:
                operations.finish_slot(operation_id, slot, result)
            except (Exception, KeyboardInterrupt, SystemExit):
                unknown = record["slots"][slot]["result"]
                unknown.update({"status": "write_unknown", "eligible": False})
                unknown.pop("row", None)
                record["slots"][slot]["status"] = "write_unknown"
                raise
            if result["status"] in ("write_unknown", "invalid_target"):
                break
        counts = _view(record)["counts"]
        if counts["unknown"]:
            status = "write_unknown"
        elif counts["accepted"] == count:
            status = "succeeded"
        elif counts["accepted"]:
            status = "partial"
    except (Exception, KeyboardInterrupt, SystemExit):
        # Persistence uncertainty poisons this owner before any further dispatch.
        operations._poisoned = True
        status = "write_unknown"
    record["status"] = status
    try:
        return operations._finalize(operation_id, status)
    except (OSError, ValueError):
        operations._poisoned = True
        operations._release()
        record["status"] = "write_unknown"
        return _view(record)


def test_model(target: dict, transport, bank: dict) -> dict:
    if not isinstance(transport, _CollectionSession):
        return {"status": "invalid_session"}
    session = transport
    snapshot = copy.deepcopy(session.bank)
    if snapshot is None or bank != snapshot:
        return {"status": "invalid_bank"}
    capability = (
        session.transport._capability
        if isinstance(session.transport, OneShotTransport) else None
    )
    try:
        target = _validate_target(target, capability)
    except (ValueError, TypeError, KeyError):
        return {"status": "invalid_target"}
    record = _collect(target, session, "test", 3)
    result = {**record, "complete": False, "bank_revision": session.bank_revision}
    samples = [
        {"challenge_id": slot,
         "numbers": entry["result"]["numbers"] if entry["result"]["eligible"] else [],
         "expected_count": entry["result"]["expected_count"]}
        for slot, entry in record.get("slots", {}).items() if "result" in entry
    ]
    if record.get("counts", {}).get("accepted", 0):
        analysis = engine.analyze_samples(samples, snapshot)
        result["analysis"] = analysis
        result["complete"] = record["status"] == "succeeded" and analysis["complete"]
    return result


def collect_rows(target: dict, transport, sample_count: int) -> dict:
    if not isinstance(transport, _CollectionSession):
        return {"status": "invalid_session"}
    if type(sample_count) is not int or not 3 <= sample_count <= 36:
        return {"status": "invalid_request"}
    capability = (
        transport.transport._capability
        if isinstance(transport.transport, OneShotTransport) else None
    )
    try:
        target = _validate_target(target, capability)
    except (ValueError, TypeError, KeyError):
        return {"status": "invalid_target"}
    record = _collect(target, transport, "enroll", sample_count)
    rows = [
        entry["result"]["row"] for entry in record.get("slots", {}).values()
        if "result" in entry and entry["result"].get("row", {}).get("strict_valid")
    ]
    return {**record, "rows": rows, "complete": record["status"] == "succeeded"}
