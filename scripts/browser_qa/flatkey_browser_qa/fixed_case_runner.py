import os
import re

from .fixed_cases import validate_case


SAFE_FIXED_ID = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
RESULT_FIELDS = {"status", "case_id", "attempt_id", "evidence_dir", "steps", "assertions", "failure"}
STEP_RESULT_FIELDS = {"index", "action", "status"}
ASSERTION_RESULT_FIELDS = {"index", "assertion", "status"}
FAILURE_FIELDS = {"phase", "index", "action", "assertion", "code", "evidence"}
EVIDENCE_FIELDS = {"screenshot", "screenshot_error", "console", "network", "flush_error"}


class FixedCaseRunner:
    def __init__(self, helper, *, evidence_dir):
        self.helper = helper
        self.evidence_dir = os.path.realpath(evidence_dir)

    def run(self, case, attempt):
        validate_case(case)
        _validate_attempt(attempt)
        os.makedirs(self.evidence_dir, mode=0o700, exist_ok=True)
        case_id = _safe_id(case.get("id") if isinstance(case, dict) else None)
        attempt_id = _safe_id(attempt.get("id") if isinstance(attempt, dict) else None)
        result = self.helper.execute_fixed_case(
            case=case,
            attempt=attempt,
            evidence_dir=self.evidence_dir,
        )
        _validate_result(result, case, case_id, attempt_id)
        return result


def _safe_id(value):
    if not isinstance(value, str) or not SAFE_FIXED_ID.fullmatch(value):
        raise ValueError("invalid fixed case id")
    return value


def _validate_attempt(attempt):
    if not isinstance(attempt, dict) or set(attempt) - {"id", "retry"}:
        raise ValueError("invalid fixed case attempt")
    _safe_id(attempt.get("id"))
    if (
        "retry" in attempt
        and (
            not isinstance(attempt["retry"], int)
            or isinstance(attempt["retry"], bool)
            or attempt["retry"] < 0
            or attempt["retry"] > 100
        )
    ):
        raise ValueError("invalid fixed case attempt")


def _validate_result(result, case, case_id, attempt_id):
    if not isinstance(result, dict) or set(result) != RESULT_FIELDS:
        raise RuntimeError("browser helper fixed case response invalid")
    if result.get("status") not in {"passed", "failed"}:
        raise RuntimeError("browser helper fixed case response invalid")
    if result.get("case_id") != case_id or result.get("attempt_id") != attempt_id:
        raise RuntimeError("browser helper fixed case response invalid")
    if result.get("evidence_dir") != f"{case_id}/{attempt_id}":
        raise RuntimeError("browser helper fixed case response invalid")
    _validate_step_results(result.get("steps"), case["steps"], result["status"])
    _validate_assertion_results(result.get("assertions"), case["assertions"], result["status"])
    failure = result.get("failure")
    if result["status"] == "passed" and failure is not None:
        raise RuntimeError("browser helper fixed case response invalid")
    if result["status"] == "failed" and not isinstance(failure, dict):
        raise RuntimeError("browser helper fixed case response invalid")
    if isinstance(failure, dict):
        _validate_failure(failure, case, result["steps"], result["assertions"])


def _validate_step_results(steps, expected_steps, status):
    if not isinstance(steps, list) or len(steps) > len(expected_steps):
        raise RuntimeError("browser helper fixed case response invalid")
    if status == "passed" and len(steps) != len(expected_steps):
        raise RuntimeError("browser helper fixed case response invalid")
    for index, step in enumerate(steps):
        if not isinstance(step, dict) or set(step) != STEP_RESULT_FIELDS:
            raise RuntimeError("browser helper fixed case response invalid")
        expected_action = next(iter(expected_steps[index]))
        if step.get("index") != index or step.get("action") != expected_action or step.get("status") != "passed":
            raise RuntimeError("browser helper fixed case response invalid")


def _validate_assertion_results(assertions, expected_assertions, status):
    if not isinstance(assertions, list) or len(assertions) > len(expected_assertions):
        raise RuntimeError("browser helper fixed case response invalid")
    if status == "passed" and len(assertions) != len(expected_assertions):
        raise RuntimeError("browser helper fixed case response invalid")
    for index, assertion in enumerate(assertions):
        if not isinstance(assertion, dict) or set(assertion) != ASSERTION_RESULT_FIELDS:
            raise RuntimeError("browser helper fixed case response invalid")
        expected_assertion = next(iter(expected_assertions[index]))
        if assertion.get("index") != index or assertion.get("assertion") != expected_assertion or assertion.get("status") != "passed":
            raise RuntimeError("browser helper fixed case response invalid")


def _validate_failure(failure, case, steps, assertions):
    if set(failure) - FAILURE_FIELDS:
        raise RuntimeError("browser helper fixed case response invalid")
    phase = failure.get("phase")
    if phase not in {"start", "step", "assertion"}:
        raise RuntimeError("browser helper fixed case response invalid")
    if not isinstance(failure.get("code"), str) or not failure["code"]:
        raise RuntimeError("browser helper fixed case response invalid")
    if "index" not in failure or not (failure["index"] is None or isinstance(failure["index"], int)):
        raise RuntimeError("browser helper fixed case response invalid")
    if phase == "start":
        if set(failure) != {"phase", "index", "code", "evidence"}:
            raise RuntimeError("browser helper fixed case response invalid")
        if failure["index"] is not None or failure["code"] != "navigation_failed" or steps or assertions:
            raise RuntimeError("browser helper fixed case response invalid")
    elif phase == "step":
        if set(failure) != {"phase", "index", "action", "code", "evidence"}:
            raise RuntimeError("browser helper fixed case response invalid")
        index = failure["index"]
        if not isinstance(index, int) or index < 0 or index >= len(case["steps"]):
            raise RuntimeError("browser helper fixed case response invalid")
        expected_action = next(iter(case["steps"][index]))
        if failure["action"] != expected_action or failure["code"] != "step_failed" or assertions or len(steps) > index:
            raise RuntimeError("browser helper fixed case response invalid")
    elif phase == "assertion":
        if set(failure) != {"phase", "index", "assertion", "code", "evidence"}:
            raise RuntimeError("browser helper fixed case response invalid")
        index = failure["index"]
        if not isinstance(index, int) or index < 0 or index >= len(case["assertions"]):
            raise RuntimeError("browser helper fixed case response invalid")
        expected_assertion = next(iter(case["assertions"][index]))
        if failure["assertion"] != expected_assertion or failure["code"] != "assertion_failed":
            raise RuntimeError("browser helper fixed case response invalid")
        if len(steps) != len(case["steps"]) or len(assertions) > index:
            raise RuntimeError("browser helper fixed case response invalid")
    _validate_evidence(failure.get("evidence"))


def _validate_evidence(evidence):
    if not isinstance(evidence, dict) or set(evidence) - EVIDENCE_FIELDS:
        raise RuntimeError("browser helper fixed case response invalid")
    if "screenshot" in evidence and not _safe_relative_path(evidence["screenshot"]):
        raise RuntimeError("browser helper fixed case response invalid")
    if "screenshot_error" in evidence and evidence["screenshot_error"] != "capture_failed":
        raise RuntimeError("browser helper fixed case response invalid")
    if "flush_error" in evidence and evidence["flush_error"] != "flush_failed":
        raise RuntimeError("browser helper fixed case response invalid")
    for key in ("console", "network"):
        if key in evidence and (not isinstance(evidence[key], list) or len(evidence[key]) > 1000):
            raise RuntimeError("browser helper fixed case response invalid")


def _safe_relative_path(value):
    if not isinstance(value, str) or not value or os.path.isabs(value) or "\\" in value:
        return False
    parts = value.split("/")
    return all(part not in {"", ".", ".."} for part in parts)
