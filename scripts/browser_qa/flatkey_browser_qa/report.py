import copy
import hashlib
import json
import os
import re
import time
import urllib.parse

from .cleanup import CleanupResult
from .redaction import Redactor


class ResultValidationError(ValueError):
    pass


SEVERITIES = {"critical", "high", "medium", "low", "info"}
CONFIDENCE = {"low", "medium", "high"}
PROPOSED_CASE_FIELDS = {"fixture", "start", "steps", "assertions", "cleanup"}
PROPOSED_CASE_ORIGINS = {"staging_website", "staging_console"}
FIXED_CASE_STATUSES = {"not_started", "passed", "failed"}
CLEANUP_STATUSES = {"passed", "not_required", "failed"}
PHASE_TRACE_ORDER = ("replay_done", "fixed_cases_done", "exploration_started", "finalization_started")
PHASE_TRACE_SEQUENCES = {
    (),
    ("finalization_started",),
    ("exploration_started", "finalization_started"),
    ("replay_done", "finalization_started"),
    ("replay_done", "fixed_cases_done", "finalization_started"),
    ("replay_done", "fixed_cases_done", "exploration_started", "finalization_started"),
}
MANIFEST_SCHEMA_VERSION = 1
_SAFE_GCS_COMPONENT = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
_SHA256_HEX = re.compile(r"^[0-9a-f]{64}$")
_OPENAI_STYLE_SECRET = re.compile(r"\bsk-[A-Za-z0-9_-]{8,}\b")
_AUTHORIZATION_SECRET = re.compile(r"\bauthorization\s*:\s*(?:bearer|basic)\s+\S+", re.IGNORECASE)
_CREDENTIAL_ASSIGNMENT = re.compile(
    r"\b(?:password|passwd|token|api[_-]?key|client[_-]?secret|cookie|secret)\b\s*[:=]\s*\S+",
    re.IGNORECASE,
)
_PROVENANCE_FIELDS = {
    "skill_name",
    "skill_content_sha256",
    "codex_version",
    "model_config",
    "playwright_mcp_version",
    "playwright_package_version",
    "chromium_version",
}
_MODEL_CONFIG = {"model": "gpt-5.4", "sandbox": "workspace-write", "network_access": False}
_BROWSER_EVIDENCE_PATHS = {"browser/console.jsonl", "browser/network.jsonl"}
MAX_EVIDENCE_FILE_BYTES = 16 * 1024 * 1024
_EVIDENCE_READ_CHUNK_BYTES = 64 * 1024


def validate_result(payload, *, legacy=False):
    required = {"replay", "exploration", "budgets", "findings"}
    runtime_fields = {"coverage_candidates", "fixed_cases", "phase_trace"}
    if legacy:
        if isinstance(payload, dict) and (set(payload) & runtime_fields):
            missing = runtime_fields - set(payload)
            if missing:
                raise ResultValidationError(f"result missing required fields: {', '.join(sorted(missing))}")
            required |= runtime_fields
    else:
        required |= runtime_fields
    _require_object(payload, required, set())
    _require_object(payload["replay"], {"status", "checkpoint_reached"}, set())
    _enum(payload["replay"]["status"], {"passed", "failed"}, "replay.status")
    _boolean(payload["replay"]["checkpoint_reached"], "replay.checkpoint_reached")

    _require_object(payload["exploration"], {"status", "actions_used"}, set())
    _enum(payload["exploration"]["status"], {"passed", "failed", "not_started"}, "exploration.status")
    _integer(payload["exploration"]["actions_used"], "exploration.actions_used", minimum=0)

    _require_object(payload["budgets"], {"replay_seconds", "exploration_seconds", "max_actions"}, set())
    for key in ("replay_seconds", "exploration_seconds", "max_actions"):
        _integer(payload["budgets"][key], f"budgets.{key}", minimum=1)

    if not isinstance(payload["findings"], list):
        raise ResultValidationError("findings must be an array")
    for index, item in enumerate(payload["findings"]):
        _validate_finding(item, index)

    if "coverage_candidates" in payload:
        if not isinstance(payload["coverage_candidates"], list):
            raise ResultValidationError("coverage_candidates must be an array")
        for index, item in enumerate(payload["coverage_candidates"]):
            _validate_coverage_candidate(item, index)
    if "fixed_cases" in payload:
        _validate_fixed_cases(payload["fixed_cases"])
    if "phase_trace" in payload:
        _validate_phase_trace(payload["phase_trace"])

    return payload


def sanitize_untrusted_proposed_cases(payload):
    sanitized = copy.deepcopy(payload)
    groups = (
        ("findings", _validate_finding),
        ("coverage_candidates", _validate_coverage_candidate),
    )
    for field, validator in groups:
        items = sanitized.get(field) if isinstance(sanitized, dict) else None
        if not isinstance(items, list):
            continue
        for index, item in enumerate(items):
            if not isinstance(item, dict) or item.get("proposed_case") is None:
                continue
            try:
                validator(item, index)
                continue
            except ResultValidationError:
                without_proposal = copy.deepcopy(item)
                without_proposal["proposed_case"] = None
            try:
                validator(without_proposal, index)
            except ResultValidationError:
                continue
            items[index] = without_proposal
    return sanitized


def sanitize_untrusted_coverage_candidates(payload):
    sanitized = copy.deepcopy(payload)
    candidates = sanitized.get("coverage_candidates") if isinstance(sanitized, dict) else None
    if not isinstance(candidates, list):
        return sanitized
    valid_candidates = []
    for index, candidate in enumerate(candidates):
        try:
            _validate_coverage_candidate(candidate, index)
        except ResultValidationError:
            continue
        valid_candidates.append(candidate)
    sanitized["coverage_candidates"] = valid_candidates
    return sanitized


def normalize_findings(payload, *, runtime_root, proxy_events):
    validate_result(payload)
    normalized = copy.deepcopy(payload)
    validate_result(normalized)
    runtime_real = os.path.realpath(runtime_root)
    denied_hosts = _denied_proxy_hosts(proxy_events)
    findings = []
    seen = set()
    for finding in normalized["findings"]:
        finding["target_url"] = _strip_url_query_fragment(finding["target_url"])
        evidence = _finding_evidence(runtime_real, finding["evidence_paths"])
        if not evidence["usable"]:
            finding["severity"] = "info"
            finding["proposed_case"] = None
        if (
            finding["severity"] != "info"
            and _matches_denied_proxy_host(finding, denied_hosts)
            and not _has_independent_product_evidence(finding, evidence)
        ):
            finding["severity"] = "info"
            finding["proposed_case"] = None
        dedupe_key = (
            finding["target_url"],
            _normalized_title(finding["title"]),
            tuple(sorted(evidence["hashes"])),
        )
        if dedupe_key in seen:
            continue
        seen.add(dedupe_key)
        findings.append(finding)
    normalized["findings"] = findings
    candidates = []
    for candidate in normalized.get("coverage_candidates", []):
        candidate["target_url"] = _strip_url_query_fragment(candidate["target_url"])
        evidence = _finding_evidence(runtime_real, candidate["evidence_paths"])
        if not evidence["usable"]:
            candidate["confidence"] = "low"
        candidates.append(candidate)
    if "coverage_candidates" in normalized:
        normalized["coverage_candidates"] = candidates
    validate_result(normalized)
    return normalized


def classify_status(payload, *, cleanup_result=None, codex_returncode=0, upload_failed=False, invalid_result=False, runtime_classification=None):
    if cleanup_result is not None and cleanup_result.cleanup_failed:
        return "cleanup_failed"
    if codex_returncode != 0 or upload_failed or invalid_result or runtime_classification:
        return "infrastructure_failed"
    if (
        payload["replay"]["status"] == "failed"
        or not payload["replay"]["checkpoint_reached"]
        or payload.get("fixed_cases", {}).get("status") == "failed"
    ):
        return "replay_failed"
    if any(item["severity"] != "info" for item in payload["findings"]):
        return "findings_detected"
    return "passed"


def build_manifest(
    payload,
    *,
    cleanup_result,
    run_id,
    execution_id,
    provenance,
    redactor=None,
    codex_returncode=0,
    upload_failed=False,
    invalid_result=False,
    runtime_classification=None,
):
    redactor = redactor or Redactor()
    validate_result(payload)
    validate_provenance(provenance)
    cleanup = _cleanup_to_dict(cleanup_result)
    status = classify_status(
        payload,
        cleanup_result=cleanup_result,
        codex_returncode=codex_returncode,
        upload_failed=upload_failed,
        invalid_result=invalid_result,
        runtime_classification=runtime_classification,
    )
    manifest = {
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "kind": "main",
        "run_id": run_id,
        "execution_id": execution_id,
        "status": status,
        "created_at": int(time.time()),
        "result": redactor.clean(payload),
        "cleanup": redactor.clean(cleanup),
        "provenance": redactor.clean(provenance),
    }
    _validate_manifest_identity(run_id, execution_id)
    if runtime_classification:
        manifest["infrastructure"] = {"status": "failed", "classification": runtime_classification}
    return manifest


def write_report(
    result_path,
    manifest_path,
    *,
    cleanup_result,
    run_id,
    execution_id,
    provenance,
    redactor=None,
    codex_returncode=0,
    upload_failed=False,
    invalid_result=False,
    runtime_classification=None,
):
    with open(result_path, encoding="utf-8") as handle:
        payload = json.load(handle)
    manifest = build_manifest(
        payload,
        cleanup_result=cleanup_result,
        run_id=run_id,
        execution_id=execution_id,
        provenance=provenance,
        redactor=redactor,
        codex_returncode=codex_returncode,
        upload_failed=upload_failed,
        invalid_result=invalid_result,
        runtime_classification=runtime_classification,
    )
    os.makedirs(os.path.dirname(manifest_path), exist_ok=True)
    _write_json_private(manifest_path, manifest)
    return manifest


def validate_provenance(provenance):
    _require_object(provenance, _PROVENANCE_FIELDS, set(), path="provenance")
    if provenance["skill_name"] != "flatkey-new-user-onboarding":
        raise ResultValidationError("provenance.skill_name has invalid value")
    if not isinstance(provenance["skill_content_sha256"], str) or not _SHA256_HEX.fullmatch(provenance["skill_content_sha256"]):
        raise ResultValidationError("provenance.skill_content_sha256 must be lowercase sha256 hex")
    _version_string(provenance["codex_version"], "provenance.codex_version")
    _version_string(provenance["playwright_mcp_version"], "provenance.playwright_mcp_version")
    _version_string(provenance["playwright_package_version"], "provenance.playwright_package_version")
    _version_string(provenance["chromium_version"], "provenance.chromium_version")
    model_config = provenance["model_config"]
    if not isinstance(model_config, dict) or model_config != _MODEL_CONFIG:
        raise ResultValidationError("provenance.model_config has invalid value")
    return provenance


def _cleanup_to_dict(cleanup_result):
    if not isinstance(cleanup_result, CleanupResult):
        raise TypeError("cleanup_result must be CleanupResult")
    return {
        "deleted_token_count": cleanup_result.deleted_token_count,
        "account_deleted": cleanup_result.account_deleted,
        "login_rejected_after_delete": cleanup_result.login_rejected_after_delete,
        "cleanup_failed": cleanup_result.cleanup_failed,
        "cleanup_status": cleanup_status(cleanup_result),
        "reason": cleanup_result.reason,
    }


def cleanup_status(cleanup_result):
    if not isinstance(cleanup_result, CleanupResult):
        raise TypeError("cleanup_result must be CleanupResult")
    if cleanup_result.cleanup_failed:
        return "failed"
    if (
        cleanup_result.deleted_token_count == 0
        and cleanup_result.account_deleted is False
        and cleanup_result.login_rejected_after_delete is False
    ):
        return "not_required"
    return "passed"


def _strip_url_query_fragment(url):
    parsed = urllib.parse.urlsplit(url)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path, "", ""))


def _normalized_title(title):
    return " ".join(title.casefold().split())


def _denied_proxy_hosts(proxy_events):
    hosts = set()
    if not isinstance(proxy_events, list):
        return hosts
    for event in proxy_events:
        if not isinstance(event, dict) or event.get("reason") != "denied":
            continue
        host = _host_without_port(event.get("host"))
        if host:
            hosts.add(host)
    return hosts


def _matches_denied_proxy_host(finding, denied_hosts):
    if not denied_hosts:
        return False
    target_host = _url_host(finding["target_url"])
    text = " ".join([finding["title"], finding["expected"], finding["actual"]]).casefold()
    for host in denied_hosts:
        if host != target_host and _host_appears_in_text(host, text):
            return True
    return False


def _finding_evidence(runtime_root, paths):
    hashes = []
    network_events = []
    console_events = []
    usable = True
    for path in paths:
        evidence_path = _resolve_evidence_path(runtime_root, path)
        if evidence_path is None:
            usable = False
            continue
        evidence = _read_evidence(
            evidence_path,
            event_stream=_event_stream_for_evidence_path(path),
        )
        if evidence is None:
            usable = False
            continue
        hashes.append(evidence["sha256"])
        network_events.extend(evidence["network_events"])
        console_events.extend(evidence["console_events"])
    return {
        "usable": usable,
        "hashes": hashes,
        "network_events": network_events,
        "console_events": console_events,
    }


def _event_stream_for_evidence_path(path):
    if path == "browser/network.jsonl":
        return "network"
    if path == "browser/console.jsonl":
        return "console"
    return None


def _read_evidence(path, *, event_stream):
    digest = hashlib.sha256()
    total = 0
    pending = b""
    network_events = []
    console_events = []
    with open(path, "rb") as handle:
        while True:
            read_size = (
                min(_EVIDENCE_READ_CHUNK_BYTES, MAX_EVIDENCE_FILE_BYTES - total)
                if total < MAX_EVIDENCE_FILE_BYTES
                else 1
            )
            chunk = handle.read(read_size)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_EVIDENCE_FILE_BYTES:
                return None
            digest.update(chunk)
            if event_stream:
                pending = _parse_jsonl_chunk(pending + chunk, _events_for_stream(event_stream, network_events, console_events))
    if event_stream and pending.strip():
        _append_jsonl_event(pending, _events_for_stream(event_stream, network_events, console_events))
    return {
        "sha256": digest.hexdigest(),
        "network_events": network_events,
        "console_events": console_events,
    }


def _events_for_stream(event_stream, network_events, console_events):
    return network_events if event_stream == "network" else console_events


def _parse_jsonl_chunk(data, events):
    lines = data.splitlines(keepends=True)
    if lines and not lines[-1].endswith((b"\n", b"\r")):
        pending = lines.pop()
    else:
        pending = b""
    for line in lines:
        _append_jsonl_event(line, events)
    return pending


def _resolve_evidence_path(runtime_root, logical_path):
    if (
        not isinstance(logical_path, str)
        or not logical_path
        or os.path.isabs(logical_path)
        or "\\" in logical_path
        or logical_path.startswith("/")
        or logical_path.startswith("//")
    ):
        return None
    parts = logical_path.split("/")
    if any(part in ("", ".", "..") for part in parts):
        return None
    if not _allowed_evidence_logical_path(logical_path):
        return None
    current = runtime_root
    for part in parts:
        current = os.path.join(current, part)
        try:
            os.lstat(current)
        except OSError:
            return None
        if os.path.islink(current):
            return None
    real = os.path.realpath(os.path.join(runtime_root, *parts))
    if real != runtime_root and not real.startswith(runtime_root + os.sep):
        return None
    if not os.path.isfile(real):
        return None
    return real


def _allowed_evidence_logical_path(logical_path):
    if logical_path in _BROWSER_EVIDENCE_PATHS:
        return True
    if logical_path.startswith("screenshots/") and logical_path.count("/") == 1:
        return logical_path.endswith(".png")
    return False


def _append_jsonl_event(line, events):
    text = line.decode("utf-8", "replace").strip()
    if not text:
        return
    try:
        event = json.loads(text)
    except json.JSONDecodeError:
        return
    if isinstance(event, dict):
        events.append(event)


def _has_independent_product_evidence(finding, evidence):
    return (
        _has_same_origin_console_error_evidence(finding, evidence)
        or _has_same_origin_5xx_network_evidence(finding, evidence)
    )


def _has_same_origin_console_error_evidence(finding, evidence):
    target_host = _url_host(finding["target_url"])
    if not target_host:
        return False
    for event in evidence["console_events"]:
        event_type = event.get("type")
        if event_type not in {"error", "assert"}:
            continue
        location = event.get("location")
        if isinstance(location, dict) and _url_host(location.get("url")) == target_host:
            return True
    return False


def _has_same_origin_5xx_network_evidence(finding, evidence):
    target_host = _url_host(finding["target_url"])
    if not target_host:
        return False
    for event in evidence["network_events"]:
        status = event.get("status")
        if isinstance(status, int) and 500 <= status <= 599 and _url_host(event.get("url")) == target_host:
            return True
    return False


def _url_host(url):
    if not isinstance(url, str):
        return ""
    return (urllib.parse.urlsplit(url).hostname or "").casefold()


def _host_without_port(value):
    if not isinstance(value, str) or not value:
        return ""
    host = value.strip().casefold()
    if host.startswith("["):
        end = host.find("]")
        return host[1:end] if end >= 0 else ""
    if ":" in host:
        host = host.rsplit(":", 1)[0]
    return host.rstrip(".")


def _host_appears_in_text(host, text):
    pattern = rf"(?<![A-Za-z0-9.-]){re.escape(host)}(?![A-Za-z0-9.-])"
    return re.search(pattern, text) is not None


def _validate_finding(item, index):
    required = {"severity", "title", "target_url", "steps", "expected", "actual", "evidence_paths", "confidence", "proposed_case"}
    _require_object(item, required, set(), path=f"findings[{index}]")
    _enum(item["severity"], SEVERITIES, f"findings[{index}].severity")
    _string(item["title"], f"findings[{index}].title")
    _string(item["target_url"], f"findings[{index}].target_url")
    _string_list(item["steps"], f"findings[{index}].steps")
    _string(item["expected"], f"findings[{index}].expected")
    _string(item["actual"], f"findings[{index}].actual")
    _string_list(item["evidence_paths"], f"findings[{index}].evidence_paths")
    _enum(item["confidence"], CONFIDENCE, f"findings[{index}].confidence")
    if item["proposed_case"] is not None:
        if item["severity"] == "info":
            raise ResultValidationError(f"findings[{index}].proposed_case requires actionable severity")
        if item["confidence"] != "high":
            raise ResultValidationError(f"findings[{index}].proposed_case requires high confidence")
    _validate_proposed_case(item["proposed_case"], f"findings[{index}].proposed_case")


def _validate_coverage_candidate(item, index):
    required = {
        "title",
        "target_url",
        "steps",
        "expected",
        "observed",
        "business_value",
        "evidence_paths",
        "confidence",
        "mutates_state",
        "cleanup_requirement",
        "proposed_case",
    }
    path = f"coverage_candidates[{index}]"
    _require_object(item, required, set(), path=path)
    for field in ("title", "target_url", "expected", "observed", "business_value"):
        _string(item[field], f"{path}.{field}")
    _string_list(item["steps"], f"{path}.steps")
    _string_list(item["evidence_paths"], f"{path}.evidence_paths")
    _enum(item["confidence"], CONFIDENCE, f"{path}.confidence")
    _boolean(item["mutates_state"], f"{path}.mutates_state")
    _enum(item["cleanup_requirement"], {"required", "not_required"}, f"{path}.cleanup_requirement")
    if item["proposed_case"] is not None:
        if item["confidence"] != "high":
            raise ResultValidationError(f"{path}.proposed_case requires high confidence")
        if item["mutates_state"] is not False:
            raise ResultValidationError(f"{path}.proposed_case requires non-mutating coverage")
        if item["cleanup_requirement"] != "not_required":
            raise ResultValidationError(f"{path}.proposed_case requires no cleanup")
    _validate_proposed_case(item["proposed_case"], f"{path}.proposed_case")


def _validate_proposed_case(value, path):
    if value is None:
        return
    try:
        from . import fixed_cases

        fixed_cases._require_object(value, PROPOSED_CASE_FIELDS, path)
        fixed_cases._enum(value["fixture"], fixed_cases.FIXTURES, f"{path}.fixture")
        fixed_cases._validate_start(value["start"])
        fixed_cases._enum(value["start"]["origin"], PROPOSED_CASE_ORIGINS, f"{path}.start.origin")
        capture_count = fixed_cases._validate_steps(value["steps"])
        fixed_cases._validate_assertions(value["assertions"], capture_count)
        fixed_cases._literal(value["cleanup"], "not_required", f"{path}.cleanup")
    except fixed_cases.FixedCaseValidationError as exc:
        raise ResultValidationError(str(exc)) from exc
    _validate_no_sensitive_proposed_case_content(value, path)


def _validate_no_sensitive_proposed_case_content(value, path):
    if isinstance(value, dict):
        for child in value.values():
            _validate_no_sensitive_proposed_case_content(child, path)
    elif isinstance(value, list):
        for child in value:
            _validate_no_sensitive_proposed_case_content(child, path)
    elif isinstance(value, str) and (
        _OPENAI_STYLE_SECRET.search(value)
        or _AUTHORIZATION_SECRET.search(value)
        or _CREDENTIAL_ASSIGNMENT.search(value)
    ):
        raise ResultValidationError(f"{path} contains sensitive content")


def _validate_fixed_cases(value):
    _require_object(value, {"status", "cases"}, set(), path="fixed_cases")
    _enum(value["status"], FIXED_CASE_STATUSES, "fixed_cases.status")
    cases = value["cases"]
    if not isinstance(cases, list):
        raise ResultValidationError("fixed_cases.cases must be an array")
    failed = False
    for index, case in enumerate(cases):
        _validate_fixed_case_result(case, index)
        failed = failed or case["status"] == "failed"
    if value["status"] == "not_started" and cases:
        raise ResultValidationError("fixed_cases status is inconsistent")
    if value["status"] == "failed" and not failed:
        raise ResultValidationError("fixed_cases status is inconsistent")
    if value["status"] == "passed" and failed:
        raise ResultValidationError("fixed_cases status is inconsistent")


def _validate_fixed_case_result(item, index):
    required = {"status", "case_id", "attempt_id", "evidence_dir", "steps", "assertions", "failure"}
    path = f"fixed_cases.cases[{index}]"
    _require_object(item, required, set(), path=path)
    _enum(item["status"], {"passed", "failed"}, f"{path}.status")
    _safe_fixed_id(item["case_id"], f"{path}.case_id")
    _safe_fixed_id(item["attempt_id"], f"{path}.attempt_id")
    if item["evidence_dir"] != f"{item['case_id']}/{item['attempt_id']}":
        raise ResultValidationError(f"{path}.evidence_dir has invalid value")
    _safe_evidence_path(item["evidence_dir"], f"{path}.evidence_dir")
    _validate_fixed_case_step_results(item["steps"], f"{path}.steps", {"index", "action", "status"}, "action")
    _validate_fixed_case_step_results(item["assertions"], f"{path}.assertions", {"index", "assertion", "status"}, "assertion")
    failure = item["failure"]
    if item["status"] == "passed" and failure is not None:
        raise ResultValidationError(f"{path}.failure has invalid value")
    if item["status"] == "failed":
        _validate_fixed_case_failure(failure, f"{path}.failure")


def _validate_fixed_case_step_results(value, path, fields, label_field):
    if not isinstance(value, list):
        raise ResultValidationError(f"{path} must be an array")
    for index, item in enumerate(value):
        _require_object(item, fields, set(), path=f"{path}[{index}]")
        _integer(item["index"], f"{path}[{index}].index", minimum=0)
        _string(item[label_field], f"{path}[{index}].{label_field}")
        _enum(item["status"], {"passed"}, f"{path}[{index}].status")


def _validate_fixed_case_failure(value, path):
    if not isinstance(value, dict):
        raise ResultValidationError(f"{path} must be an object")
    allowed = {"phase", "index", "action", "assertion", "code", "evidence"}
    fields = set(value)
    if fields - allowed:
        raise ResultValidationError(f"{path} contains extra fields: {', '.join(sorted(set(value) - allowed))}")
    _enum(value.get("phase"), {"start", "step", "assertion"}, f"{path}.phase")
    if value["phase"] == "start" and fields != {"phase", "index", "code", "evidence"}:
        raise ResultValidationError(f"{path} fields are invalid")
    if value["phase"] == "step" and fields != {"phase", "index", "action", "code", "evidence"}:
        raise ResultValidationError(f"{path} fields are invalid")
    if value["phase"] == "assertion" and fields != {"phase", "index", "assertion", "code", "evidence"}:
        raise ResultValidationError(f"{path} fields are invalid")
    if value["phase"] == "start":
        if value.get("index") is not None or value.get("code") != "navigation_failed":
            raise ResultValidationError(f"{path} fields are invalid")
    elif value["phase"] == "step":
        _integer(value.get("index"), f"{path}.index", minimum=0)
        if value.get("code") != "step_failed":
            raise ResultValidationError(f"{path}.code has invalid value")
    elif value["phase"] == "assertion":
        _integer(value.get("index"), f"{path}.index", minimum=0)
        if value.get("code") != "assertion_failed":
            raise ResultValidationError(f"{path}.code has invalid value")
    _string(value.get("code"), f"{path}.code")
    if "action" in value:
        _string(value["action"], f"{path}.action")
    if "assertion" in value:
        _string(value["assertion"], f"{path}.assertion")
    evidence = value.get("evidence")
    if not isinstance(evidence, dict):
        raise ResultValidationError(f"{path}.evidence must be an object")
    allowed_evidence = {"screenshot", "screenshot_error", "console", "network", "flush_error"}
    if set(evidence) - allowed_evidence:
        raise ResultValidationError(f"{path}.evidence contains extra fields")
    if "screenshot" in evidence:
        _safe_evidence_path(evidence["screenshot"], f"{path}.evidence.screenshot")
    if "screenshot_error" in evidence and evidence["screenshot_error"] != "capture_failed":
        raise ResultValidationError(f"{path}.evidence.screenshot_error has invalid value")
    if "flush_error" in evidence and evidence["flush_error"] != "flush_failed":
        raise ResultValidationError(f"{path}.evidence.flush_error has invalid value")
    for key in ("console", "network"):
        if key in evidence and (not isinstance(evidence[key], list) or len(evidence[key]) > 1000):
            raise ResultValidationError(f"{path}.evidence.{key} must be a bounded array")


def _validate_phase_trace(value):
    if not isinstance(value, list):
        raise ResultValidationError("phase_trace must be an array")
    if any(not isinstance(phase, str) or phase not in PHASE_TRACE_ORDER for phase in value):
        raise ResultValidationError("phase_trace has invalid value")
    if len(set(value)) != len(value) or tuple(value) not in PHASE_TRACE_SEQUENCES:
        raise ResultValidationError("phase_trace order is invalid")


def _safe_relative_string(value, path):
    _string(value, path)
    if os.path.isabs(value) or "\\" in value or value.startswith("/") or "//" in value:
        raise ResultValidationError(f"{path} must be a safe relative path component")


def _safe_fixed_id(value, path):
    from .fixed_case_runner import SAFE_FIXED_ID

    if not isinstance(value, str) or not SAFE_FIXED_ID.fullmatch(value):
        raise ResultValidationError(f"{path} has invalid value")


def _safe_evidence_path(value, path):
    _string(value, path)
    if os.path.isabs(value) or "\\" in value or value.startswith("/"):
        raise ResultValidationError(f"{path} must be a safe relative path")
    parts = value.split("/")
    if any(part in {"", ".", ".."} for part in parts):
        raise ResultValidationError(f"{path} must be a safe relative path")


def _require_object(value, required, optional, path="result"):
    if not isinstance(value, dict):
        raise ResultValidationError(f"{path} must be an object")
    keys = set(value)
    missing = required - keys
    extra = keys - required - optional
    if missing:
        raise ResultValidationError(f"{path} missing required fields: {', '.join(sorted(missing))}")
    if extra:
        raise ResultValidationError(f"{path} contains extra fields: {', '.join(sorted(extra))}")


def _enum(value, allowed, path):
    if not isinstance(value, str) or value not in allowed:
        raise ResultValidationError(f"{path} has invalid value")


def _string(value, path):
    if not isinstance(value, str) or not value:
        raise ResultValidationError(f"{path} must be a non-empty string")


def _string_list(value, path):
    if not isinstance(value, list) or not value:
        raise ResultValidationError(f"{path} must be a non-empty string array")
    for item in value:
        _string(item, path)


def _integer(value, path, *, minimum):
    if not isinstance(value, int) or isinstance(value, bool) or value < minimum:
        raise ResultValidationError(f"{path} must be an integer >= {minimum}")


def _boolean(value, path):
    if not isinstance(value, bool):
        raise ResultValidationError(f"{path} must be boolean")


def _version_string(value, path):
    if not isinstance(value, str) or not value or "\n" in value or "\r" in value:
        raise ResultValidationError(f"{path} must be a non-empty single-line string")
    if len(value.encode("utf-8", "replace")) > 256:
        raise ResultValidationError(f"{path} must be at most 256 bytes")


def _write_json_private(path, payload):
    flags = os.O_WRONLY | os.O_CREAT | os.O_TRUNC
    fd = os.open(path, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, sort_keys=True)


def _validate_manifest_identity(run_id, execution_id):
    if not isinstance(run_id, str) or not run_id.isascii() or not run_id.isdecimal():
        raise ResultValidationError("FLATKEY_QA_RUN_ID must contain only ASCII decimal digits")
    if (
        not isinstance(execution_id, str)
        or not _SAFE_GCS_COMPONENT.fullmatch(execution_id)
        or execution_id in {".", ".."}
        or ".." in execution_id
        or "/" in execution_id
        or "\\" in execution_id
    ):
        raise ResultValidationError("FLATKEY_BROWSER_QA_EXECUTION_ID must be a safe GCS object path component")
