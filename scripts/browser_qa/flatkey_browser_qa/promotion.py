import copy
import hashlib
import hmac
import json
import re
import unicodedata
import urllib.parse

from . import fixed_cases, report


KINDS = {"finding", "coverage"}
STATES = {"candidate_draft", "awaiting_product_fix", "ready_for_review", "blocked", "flaky"}
DECISIONS = {"incomplete", "ready_for_review", "awaiting_product_fix", "blocked", "flaky"}
ATTEMPTS_REQUIRED = 3
MAX_OBJECT_BYTES = 64 * 1024
MAX_STRING = 512
MAX_ATTEMPTS = 3
FINGERPRINT_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
SAFE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
CASE_ID_RE = re.compile(r"^FQA-[0-9]{12,78}$")
RUN_ID_RE = re.compile(r"^[0-9]{1,32}$")
GCS_COMPONENT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
RESULT_FIELDS = {"status", "case_id", "attempt_id", "evidence_dir", "steps", "assertions", "failure"}
ATTEMPT_FIELDS = {"attempt_id", "evidence_dir", "result", "cleanup", "runtime"}
STEP_RESULT_FIELDS = {"index", "action", "status"}
ASSERTION_RESULT_FIELDS = {"index", "assertion", "status"}


def canonical_fingerprint(kind, target_url, proposed_case):
    _validate_kind(kind)
    target = _normalize_target_url(target_url)
    semantic_case = _semantic_proposed_case(proposed_case)
    material = {
        "kind": kind,
        "target_url": target,
        "proposed_case": semantic_case,
    }
    encoded = json.dumps(material, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return "sha256:" + hashlib.sha256(encoded).hexdigest()


def qualify_candidate(kind, observation, *, allowed_origins, existing_fingerprints):
    _validate_kind(kind)
    try:
        if not isinstance(observation, dict):
            return None
        _bounded_json(observation)
        if kind == "finding":
            report._validate_finding(observation, 0)
        else:
            report._validate_coverage_candidate(observation, 0)
        target_url = _normalize_target_url(observation.get("target_url"))
        if _origin(target_url) not in _allowed_origin_set(allowed_origins):
            return None
        proposed = observation.get("proposed_case")
        if proposed is None:
            return None
        if observation.get("confidence") != "high":
            return None
        if kind == "finding":
            if observation.get("severity") not in report.SEVERITIES or observation.get("severity") == "info":
                return None
        else:
            if observation.get("mutates_state") is not False or observation.get("cleanup_requirement") != "not_required":
                return None
        _validate_proposed_case(proposed)
        fp = canonical_fingerprint(kind, target_url, proposed)
        if fp in _existing_fingerprint_set(existing_fingerprints):
            return None
        return {
            "kind": kind,
            "fingerprint": fp,
            "target_url": target_url,
            "proposed_case": _semantic_proposed_case(proposed),
        }
    except (TypeError, ValueError, report.ResultValidationError):
        return None


def aggregate_attempts(kind, current_state, attempts):
    _validate_kind(kind)
    if current_state not in STATES:
        raise ValueError("invalid promotion state")
    if not isinstance(attempts, list) or len(attempts) > MAX_ATTEMPTS:
        raise ValueError("invalid promotion attempts")
    seen_attempts = set()
    seen_evidence = set()
    counted = []
    infrastructure_seen = False
    case_id = None
    for attempt in copy.deepcopy(attempts):
        _validate_attempt_shell(attempt)
        attempt_id = attempt["attempt_id"]
        evidence_dir = attempt["evidence_dir"]
        if attempt_id in seen_attempts or evidence_dir in seen_evidence:
            raise ValueError("invalid promotion attempts")
        seen_attempts.add(attempt_id)
        seen_evidence.add(evidence_dir)
        cleanup_status = attempt["cleanup"]["status"]
        if cleanup_status == "failed":
            return _summary("blocked", "blocked", 0, 0, 0, None, "cleanup_failed")
        classification = attempt["runtime"]["classification"]
        if classification is not None:
            infrastructure_seen = True
            continue
        result = _complete_result(attempt["result"], attempt_id, evidence_dir)
        if cleanup_status not in {"passed", "not_required"}:
            infrastructure_seen = True
            continue
        if case_id is None:
            case_id = result["case_id"]
        elif result["case_id"] != case_id:
            raise ValueError("invalid promotion attempts")
        counted.append(result)

    passed = sum(1 for result in counted if result["status"] == "passed")
    failed = sum(1 for result in counted if result["status"] == "failed")
    signature = _common_failure_signature(counted)

    if passed and failed:
        return _summary("flaky", "flaky", len(counted), passed, failed, signature, "mixed_results")
    if kind == "finding" and failed and signature is None:
        return _summary("flaky", "flaky", len(counted), passed, failed, None, "mismatched_failure_signature")
    if kind == "coverage" and failed:
        return _summary("flaky", "flaky", len(counted), passed, failed, signature, "business_failure")
    if len(counted) < ATTEMPTS_REQUIRED:
        reason = "infrastructure" if infrastructure_seen and not counted else "pending"
        return _summary(current_state, "incomplete", len(counted), passed, failed, signature, reason)
    if kind == "coverage" and current_state == "candidate_draft" and passed == ATTEMPTS_REQUIRED:
        return _summary("ready_for_review", "ready_for_review", len(counted), passed, failed, None, None)
    if kind == "finding" and current_state == "candidate_draft" and failed == ATTEMPTS_REQUIRED and signature:
        return _summary("awaiting_product_fix", "awaiting_product_fix", len(counted), passed, failed, signature, None)
    if kind == "finding" and current_state == "awaiting_product_fix" and passed == ATTEMPTS_REQUIRED:
        return _summary("ready_for_review", "ready_for_review", len(counted), passed, failed, None, None)
    return _summary(current_state, "incomplete", len(counted), passed, failed, signature, "pending")


def build_candidate_bundle(qualified, *, run_id, evidence_uri):
    if not isinstance(qualified, dict) or set(qualified) != {"kind", "fingerprint", "target_url", "proposed_case"}:
        raise ValueError("invalid qualified candidate")
    _validate_kind(qualified["kind"])
    _validate_fingerprint(qualified["fingerprint"])
    target_url = _normalize_target_url(qualified["target_url"])
    proposed = _semantic_proposed_case(qualified["proposed_case"])
    expected_fingerprint = canonical_fingerprint(qualified["kind"], target_url, proposed)
    if not hmac.compare_digest(qualified["fingerprint"], expected_fingerprint):
        raise ValueError("invalid qualified candidate")
    _validate_run_id(run_id)
    _validate_gcs_uri(evidence_uri, run_id)
    return {
        "schema_version": 1,
        "kind": qualified["kind"],
        "fingerprint": qualified["fingerprint"],
        "target_url": target_url,
        "proposed_case": proposed,
        "source": {"run_id": run_id, "evidence_uri": evidence_uri},
        "promotion": {
            "state": "candidate_draft",
            "attempts_required": ATTEMPTS_REQUIRED,
            "attempts_passed": 0,
        },
    }


def deterministic_case_id(fingerprint, occupied):
    _validate_fingerprint(fingerprint)
    if not isinstance(occupied, dict):
        raise ValueError("invalid occupied case map")
    for case_id, current in occupied.items():
        if not isinstance(case_id, str) or not CASE_ID_RE.fullmatch(case_id):
            raise ValueError("invalid occupied case map")
        _validate_fingerprint(current)
    digest = fingerprint.removeprefix("sha256:")
    decimal = str(int(digest, 16)).zfill(78)
    for length in range(12, len(decimal) + 1):
        case_id = "FQA-" + decimal[:length]
        if case_id not in occupied:
            return case_id
        if occupied[case_id] == fingerprint:
            return case_id
    raise ValueError("case id collision exhausted")


def candidate_branch(case_id, fingerprint):
    if not isinstance(case_id, str) or not CASE_ID_RE.fullmatch(case_id):
        raise ValueError("invalid case id")
    _validate_fingerprint(fingerprint)
    branch = f"browser-qa/candidates/{case_id.lower()}-{fingerprint[7:19]}"
    if len(branch) > 160 or not re.fullmatch(r"[a-z0-9][a-z0-9._/-]*[a-z0-9]", branch):
        raise ValueError("invalid candidate branch")
    if branch.endswith(".lock") or any(part in {"", ".", ".."} or part.endswith(".lock") for part in branch.split("/")):
        raise ValueError("invalid candidate branch")
    return branch


def _semantic_proposed_case(proposed_case):
    if not isinstance(proposed_case, dict):
        raise ValueError("invalid proposed case")
    semantic = {
        "fixture": copy.deepcopy(proposed_case.get("fixture")),
        "start": copy.deepcopy(proposed_case.get("start")),
        "steps": copy.deepcopy(proposed_case.get("steps")),
        "assertions": copy.deepcopy(proposed_case.get("assertions")),
        "cleanup": copy.deepcopy(proposed_case.get("cleanup", "not_required")),
    }
    _bounded_json(semantic)
    _validate_proposed_case(semantic)
    return semantic


def _validate_proposed_case(proposed_case):
    report._validate_proposed_case(proposed_case, "proposed_case")


def _normalize_target_url(value):
    if not isinstance(value, str) or len(value) > MAX_STRING or _has_control(value):
        raise ValueError("invalid target url")
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme.lower() != "https" or not parsed.netloc or parsed.username or parsed.password:
        raise ValueError("invalid target url")
    host = _normalize_dns_host(parsed)
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("invalid target url") from exc
    if port is not None and (port < 1 or port > 65535):
        raise ValueError("invalid target url")
    netloc = host if port in {None, 443} else f"{host}:{port}"
    path = _normalize_path(parsed.path)
    return urllib.parse.urlunsplit(("https", netloc, path, "", ""))


def _normalize_path(path):
    if not isinstance(path, str) or not path or not path.startswith("/") or _has_control(path) or "\\" in path:
        raise ValueError("invalid target url")
    normalized = _normalize_percent_path(path)
    if normalized == "/":
        raise ValueError("invalid target url")
    segments = normalized.split("/")
    if any(segment in {"", ".", ".."} for segment in segments[1:]):
        raise ValueError("invalid target url")
    return normalized


def _normalize_percent_path(path):
    output = []
    index = 0
    while index < len(path):
        char = path[index]
        if char == "%":
            escaped, index = _normalize_percent_byte_run(path, index)
            output.append(escaped)
            continue
        if char == "/":
            output.append("/")
        elif char in "-._~" or char.isascii() and char.isalnum():
            output.append(char)
        else:
            _validate_decoded_path_text(char)
            output.append(urllib.parse.quote(char, safe=""))
        index += 1
    return "".join(output)


def _normalize_percent_byte_run(path, index):
    escaped = []
    encoded = bytearray()
    while index < len(path) and path[index] == "%":
        if index + 2 >= len(path) or not re.fullmatch(r"[0-9A-Fa-f]{2}", path[index + 1:index + 3]):
            raise ValueError("invalid target url")
        byte = int(path[index + 1:index + 3], 16)
        if byte in {0x2E, 0x2F, 0x5C}:
            raise ValueError("invalid target url")
        encoded.append(byte)
        escaped.append("%" + path[index + 1:index + 3].upper())
        index += 3
    try:
        decoded = encoded.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise ValueError("invalid target url") from exc
    _validate_decoded_path_text(decoded)
    return "".join(escaped), index


def _validate_decoded_path_text(value):
    if any(ord(ch) < 32 or ord(ch) == 127 or unicodedata.category(ch).startswith("C") for ch in value):
        raise ValueError("invalid target url")


def _origin(target_url):
    parsed = urllib.parse.urlsplit(target_url)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))


def _allowed_origin_set(allowed_origins):
    if not isinstance(allowed_origins, (set, frozenset)) or len(allowed_origins) > 20:
        raise ValueError("invalid allowed origins")
    origins = set()
    for origin in allowed_origins:
        if not isinstance(origin, str) or len(origin) > MAX_STRING or _has_control(origin):
            raise ValueError("invalid allowed origins")
        parsed = urllib.parse.urlsplit(origin)
        if parsed.scheme.lower() != "https" or not parsed.netloc or parsed.path not in {"", "/"} or parsed.query or parsed.fragment or parsed.username or parsed.password:
            raise ValueError("invalid allowed origins")
        host = _normalize_dns_host(parsed)
        try:
            port = parsed.port
        except ValueError as exc:
            raise ValueError("invalid allowed origins") from exc
        netloc = host if port in {None, 443} else f"{host}:{port}"
        origins.add(urllib.parse.urlunsplit(("https", netloc, "", "", "")))
    return origins


def _normalize_dns_host(parsed):
    hostname = parsed.hostname
    if hostname is None or _has_control(hostname):
        raise ValueError("invalid host")
    host = hostname.rstrip(".").lower()
    if not host or host == "." or ":" in host or not re.fullmatch(r"[a-z0-9.-]+", host):
        raise ValueError("invalid host")
    if any(part == "" for part in host.split(".")):
        raise ValueError("invalid host")
    return host


def _existing_fingerprint_set(value):
    if isinstance(value, dict):
        candidates = value.values()
    elif isinstance(value, (set, frozenset, list, tuple)):
        candidates = value
    else:
        raise ValueError("invalid fingerprint collection")
    fingerprints = set()
    for fp in candidates:
        _validate_fingerprint(fp)
        fingerprints.add(fp)
    return fingerprints


def _validate_attempt_shell(attempt):
    if not isinstance(attempt, dict) or set(attempt) != ATTEMPT_FIELDS:
        raise ValueError("invalid promotion attempt")
    if not _safe_id(attempt["attempt_id"]):
        raise ValueError("invalid promotion attempt")
    if not _safe_relative_path(attempt["evidence_dir"]):
        raise ValueError("invalid promotion attempt")
    if not isinstance(attempt["cleanup"], dict) or set(attempt["cleanup"]) != {"status"} or attempt["cleanup"]["status"] not in {"passed", "not_required", "failed"}:
        raise ValueError("invalid promotion attempt")
    if not isinstance(attempt["runtime"], dict) or set(attempt["runtime"]) != {"classification"}:
        raise ValueError("invalid promotion attempt")
    classification = attempt["runtime"]["classification"]
    if classification is not None and (not isinstance(classification, str) or not _safe_id(classification)):
        raise ValueError("invalid promotion attempt")


def _complete_result(result, attempt_id, evidence_dir):
    try:
        report._validate_fixed_case_result(result, 0)
    except report.ResultValidationError as exc:
        raise ValueError("invalid fixed case result") from exc
    if result.get("attempt_id") != attempt_id or result.get("evidence_dir") != evidence_dir:
        raise ValueError("invalid fixed case result")
    if not isinstance(result.get("case_id"), str) or not fixed_cases.ID_RE.fullmatch(result["case_id"]):
        raise ValueError("invalid fixed case result")
    if not _validate_result_steps(result.get("steps")) or not _validate_result_assertions(result.get("assertions")):
        raise ValueError("invalid fixed case result")
    failure = result.get("failure")
    if result["status"] == "failed" and not _failure_signature(failure):
        raise ValueError("invalid fixed case result")
    return result


def _validate_result_steps(steps):
    if not isinstance(steps, list) or len(steps) > 50:
        return False
    for index, step in enumerate(steps):
        if not isinstance(step, dict) or set(step) != STEP_RESULT_FIELDS:
            return False
        if step.get("index") != index or not _safe_id(step.get("action")) or step.get("status") != "passed":
            return False
    return True


def _validate_result_assertions(assertions):
    if not isinstance(assertions, list) or len(assertions) > 50:
        return False
    for index, assertion in enumerate(assertions):
        if not isinstance(assertion, dict) or set(assertion) != ASSERTION_RESULT_FIELDS:
            return False
        if assertion.get("index") != index or not _safe_id(assertion.get("assertion")) or assertion.get("status") != "passed":
            return False
    return True


def _common_failure_signature(results):
    signatures = [_failure_signature(result.get("failure")) for result in results if result.get("status") == "failed"]
    if not signatures:
        return None
    first = signatures[0]
    if all(signature == first for signature in signatures):
        return first
    return None


def _failure_signature(failure):
    if not isinstance(failure, dict):
        return None
    phase = failure.get("phase")
    code = failure.get("code")
    index = failure.get("index")
    if phase not in {"start", "step", "assertion"} or not _safe_id(code):
        return None
    if index is not None and (not isinstance(index, int) or isinstance(index, bool) or index < 0 or index > 100):
        return None
    signature = {"phase": phase, "index": index, "code": code}
    if phase == "step":
        action = failure.get("action")
        if not _safe_id(action):
            return None
        signature["action"] = action
    if phase == "assertion":
        assertion = failure.get("assertion")
        if not _safe_id(assertion):
            return None
        signature["assertion"] = assertion
    required = set(signature) | {"evidence"}
    if set(failure) != required:
        return None
    if not isinstance(failure.get("evidence"), dict) or len(failure["evidence"]) > 8:
        return None
    return signature


def _summary(state, decision, counted, passed, failed, failure_signature, reason):
    if state not in STATES or decision not in DECISIONS:
        raise ValueError("invalid promotion summary")
    return {
        "state": state,
        "decision": decision,
        "attempts_required": ATTEMPTS_REQUIRED,
        "attempts_counted": counted,
        "attempts_passed": passed,
        "attempts_failed": failed,
        "failure_signature": copy.deepcopy(failure_signature),
        "reason": reason,
    }


def _validate_kind(kind):
    if kind not in KINDS:
        raise ValueError("invalid promotion kind")


def _validate_fingerprint(fingerprint):
    if not isinstance(fingerprint, str) or not FINGERPRINT_RE.fullmatch(fingerprint):
        raise ValueError("invalid fingerprint")


def _validate_run_id(run_id):
    if not isinstance(run_id, str) or not RUN_ID_RE.fullmatch(run_id):
        raise ValueError("invalid run id")


def _validate_gcs_uri(uri, run_id):
    if not isinstance(uri, str) or len(uri) > MAX_STRING or _has_control(uri) or "@" in uri or "\\" in uri:
        raise ValueError("invalid evidence uri")
    parsed = urllib.parse.urlsplit(uri)
    if parsed.scheme != "gs" or not parsed.netloc or parsed.query or parsed.fragment or parsed.username or parsed.password:
        raise ValueError("invalid evidence uri")
    if not GCS_COMPONENT_RE.fullmatch(parsed.netloc):
        raise ValueError("invalid evidence uri")
    if not parsed.path.startswith("/") or parsed.path.startswith("//") or parsed.path.endswith("/"):
        raise ValueError("invalid evidence uri")
    parts = parsed.path[1:].split("/")
    if len(parts) < 3 or parts[0] != "runs" or parts[1] != run_id:
        raise ValueError("invalid evidence uri")
    if any(part in {"", ".", ".."} or not GCS_COMPONENT_RE.fullmatch(part) for part in parts):
        raise ValueError("invalid evidence uri")


def _safe_id(value):
    return isinstance(value, str) and SAFE_ID_RE.fullmatch(value) is not None


def _safe_relative_path(value):
    if not isinstance(value, str) or len(value) > MAX_STRING or _has_control(value) or "\\" in value:
        return False
    if value.startswith("/") or "://" in value:
        return False
    parts = value.split("/")
    return bool(parts) and all(part not in {"", ".", ".."} and _safe_id(part) for part in parts)


def _bounded_json(value):
    try:
        encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise ValueError("invalid bounded object") from exc
    if len(encoded) > MAX_OBJECT_BYTES:
        raise ValueError("invalid bounded object")


def _has_control(value):
    return any(ord(ch) < 32 or ord(ch) == 127 for ch in value)
