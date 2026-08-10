import json
import copy
import re
import sys
import time
import unicodedata
import urllib.parse

from .api import StagingApiClient
from .cleanup import CleanupRunner
from .config import load_cleanup_config
from .gcp import GcpClient, GcsObjectAlreadyExists, GcsUploadUncertain, read_gcs_json_object, upload_gcs_object
from .identity import derive_identity
from . import report
from . import promotion


ROOT_MANIFEST_SCHEMA_VERSION = 1
_SAFE_GCS_COMPONENT = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
_EMAIL_ADDRESS = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_OPENAI_SECRET_KEY = re.compile(r"\bsk-[A-Za-z0-9_-]{6,}\b")
_SECRET_TERMS = re.compile(
    r"\b("
    r"verification|verification code|verify code|captcha|password|passcode|cookie|authorization|"
    r"webhook|signing secret|secret"
    r")\b",
    re.IGNORECASE,
)
_LOCALIZED_SECRET_TERMS = ("验证码", "密码", "口令", "授权", "签名密钥", "机器人地址")
_SIX_DIGIT_CODE = re.compile(r"(?<!\d)\d{6}(?!\d)")
_SENSITIVE_TITLE_OMITTED = "Sensitive finding details omitted"
_STATUS_PRIORITY = {
    "passed": 0,
    "findings_detected": 1,
    "replay_failed": 2,
    "infrastructure_failed": 3,
    "cleanup_failed": 4,
}
_CANDIDATE_FIELDS = {"schema_version", "kind", "fingerprint", "target_url", "proposed_case", "source", "promotion"}
_CANDIDATE_SOURCE_FIELDS = {"run_id", "evidence_uri"}
_CANDIDATE_PROMOTION_FIELDS = {"state", "attempts_required", "attempts_passed"}
_CANDIDATE_EVENT_FIELDS = {"kind", "candidate_kind"}
_MAX_CANDIDATES = 20


def main(argv=None):
    argv = [] if argv is None else argv
    if argv:
        raise SystemExit("cleanup_job does not accept command line arguments")
    cfg = load_cleanup_config()
    identity = derive_identity(cfg.identity_seed, cfg.run_id)
    client = StagingApiClient(cfg.console_origin)
    result = CleanupRunner(client).run(identity)
    cleanup_payload = _build_cleanup_payload(cfg, result, int(time.time()))
    persistence_failed = False
    try:
        cleanup_payload = _persist_cleanup(cfg, cleanup_payload)
    except Exception as exc:
        persistence_failed = True
        cleanup_payload = dict(cleanup_payload)
        cleanup_payload["persistence_error"] = type(exc).__name__
    print(json.dumps(cleanup_payload["cleaned"], sort_keys=True))
    return 1 if cleanup_payload["cleaned"]["cleanup_failed"] or persistence_failed else 0


def _persist_cleanup(cfg, cleanup_payload):
    access_token = GcpClient().access_token()
    cleanup_object = f"runs/{cfg.run_id}/cleanup/{cfg.cleanup_execution_id}/cleanup.json"
    root_object = f"runs/{cfg.run_id}/manifest.json"
    cleanup_payload = _write_or_read_cleanup_payload(cfg, cleanup_object, cleanup_payload, access_token)
    cleanup_record = _execution_record(
        "cleanup",
        cfg.cleanup_execution_id,
        cleanup_object,
        cleanup_payload["status"],
        cleanup_payload["created_at"],
        summary=_cleanup_summary(cleanup_payload),
    )
    for _attempt in range(3):
        root, generation = _read_root_or_bootstrap(cfg, access_token)
        merged = _merge_root_manifest(root, cfg, cleanup_record, access_token)
        try:
            upload_gcs_object(
                cfg.gcs_bucket,
                root_object,
                _json_bytes(merged),
                "application/json",
                access_token,
                if_generation_match=generation,
            )
            return cleanup_payload
        except GcsUploadUncertain:
            if _root_matches_desired_state(cfg, root_object, merged, access_token):
                return cleanup_payload
        except GcsObjectAlreadyExists:
            pass
    raise RuntimeError("root manifest CAS failed")


def _write_or_read_cleanup_payload(cfg, cleanup_object, cleanup_payload, access_token):
    try:
        upload_gcs_object(
            cfg.gcs_bucket,
            cleanup_object,
            _json_bytes(cleanup_payload),
            "application/json",
            access_token,
            if_generation_match=0,
        )
        return cleanup_payload
    except (GcsObjectAlreadyExists, GcsUploadUncertain):
        persisted, _generation = read_gcs_json_object(cfg.gcs_bucket, cleanup_object, access_token)
        _validate_cleanup_manifest(persisted, cfg)
        return persisted


def _root_matches_desired_state(cfg, root_object, desired, access_token):
    current, _generation = read_gcs_json_object(cfg.gcs_bucket, root_object, access_token)
    _validate_root_manifest(current, cfg.run_id, expected_bucket=cfg.gcs_bucket)
    return current == desired


def _read_root_or_bootstrap(cfg, access_token):
    root_object = f"runs/{cfg.run_id}/manifest.json"
    try:
        root, generation = read_gcs_json_object(cfg.gcs_bucket, root_object, access_token)
    except FileNotFoundError:
        root = {
            "schema_version": ROOT_MANIFEST_SCHEMA_VERSION,
            "run_id": cfg.run_id,
            "status": "passed",
            "latest": {"main_execution_id": cfg.main_execution_id, "cleanup_execution_id": None},
            "executions": [],
            "candidates": [],
        }
        generation = 0
    _validate_root_manifest(root, cfg.run_id, expected_bucket=cfg.gcs_bucket)
    return root, generation


def _merge_root_manifest(root, cfg, cleanup_record, access_token):
    records = list(root["executions"])
    existing_main = _find_execution_record(records, "main", cfg.main_execution_id)
    candidate_fields = None
    try:
        manifest = _read_validated_main_manifest(cfg, access_token)
        main_record = _main_record_from_manifest(manifest)
        candidate_fields = _candidate_root_fields_from_main(manifest)
    except FileNotFoundError:
        if existing_main is not None and not _is_missing_main_placeholder(existing_main):
            main_record = existing_main
            candidate_fields = _candidate_root_fields_from_existing_root(root)
        else:
            main_record = _missing_main_record(cfg)
            candidate_fields = {"candidates": []}
    records = _append_or_validate_record(records, main_record)
    target_is_latest_main = _latest_by_kind(records)["main_execution_id"] == cfg.main_execution_id
    if not target_is_latest_main:
        candidate_fields = _candidate_root_fields_from_existing_root(root)
    records = _append_or_validate_record(records, cleanup_record)
    latest = _latest_by_kind(records)
    if not target_is_latest_main:
        latest = copy.deepcopy(root["latest"])
    status = _latest_status(records, latest)
    merged = {
        "schema_version": ROOT_MANIFEST_SCHEMA_VERSION,
        "run_id": cfg.run_id,
        "status": status,
        "latest": latest,
        "executions": records,
    }
    merged.update(candidate_fields or {"candidates": []})
    return merged


def _main_record(cfg, access_token):
    return _main_record_from_manifest(_read_validated_main_manifest(cfg, access_token))


def _read_validated_main_manifest(cfg, access_token):
    object_name = f"runs/{cfg.run_id}/main/{cfg.main_execution_id}/manifest.json"
    manifest, _generation = read_gcs_json_object(cfg.gcs_bucket, object_name, access_token)
    _validate_main_manifest(manifest, cfg.run_id, cfg.main_execution_id, expected_bucket=cfg.gcs_bucket)
    return manifest


def _main_record_from_manifest(manifest):
    object_name = f"runs/{manifest['run_id']}/main/{manifest['execution_id']}/manifest.json"
    summary = _main_summary(manifest["result"])
    status = manifest.get("status")
    created_at = manifest.get("created_at", 0)
    return _execution_record("main", manifest["execution_id"], object_name, status, created_at, summary=summary)


def _missing_main_record(cfg):
    return _execution_record(
        "main",
        cfg.main_execution_id,
        f"runs/{cfg.run_id}/main/{cfg.main_execution_id}/manifest.json",
        "infrastructure_failed",
        0,
        summary={
            "replay_status": "failed",
            "exploration_status": "not_started",
            "exploration_actions": 0,
            "finding_count": 0,
            "finding_summaries": [],
        },
    )


def _find_execution_record(records, kind, execution_id):
    for record in records:
        if record["kind"] == kind and record["execution_id"] == execution_id:
            return record
    return None


def _is_missing_main_placeholder(record):
    return (
        record.get("kind") == "main"
        and record.get("status") == "infrastructure_failed"
        and record.get("created_at") == 0
        and record.get("summary")
        == {
            "replay_status": "failed",
            "exploration_status": "not_started",
            "exploration_actions": 0,
            "finding_count": 0,
            "finding_summaries": [],
        }
    )


def _append_or_validate_record(records, record):
    updated = []
    found = False
    for existing in records:
        if existing["kind"] == record["kind"] and existing["execution_id"] == record["execution_id"]:
            found = True
            if existing != record:
                if _is_missing_main_placeholder(existing) and record["kind"] == "main":
                    updated.append(record)
                    continue
                if _is_legacy_main_summary_upgrade(existing, record):
                    updated.append(record)
                    continue
                if _is_legacy_cleanup_summary_upgrade(existing, record):
                    updated.append(record)
                    continue
                legacy_record = dict(record)
                legacy_record.pop("summary", None)
                if existing == legacy_record:
                    updated.append(record)
                    continue
                raise ValueError("conflicting execution record")
            updated.append(existing)
        else:
            updated.append(existing)
    if found:
        return updated
    return [*records, record]


def _is_legacy_main_summary_upgrade(existing, record):
    if existing.get("kind") != "main" or record.get("kind") != "main":
        return False
    summary = existing.get("summary")
    if not isinstance(summary, dict) or set(summary) != {
        "replay_status",
        "exploration_status",
        "exploration_actions",
        "finding_count",
    }:
        return False
    upgraded = dict(existing)
    upgraded["summary"] = record.get("summary")
    if upgraded != record:
        return False
    return all(summary[key] == record["summary"].get(key) for key in summary)


def _is_legacy_cleanup_summary_upgrade(existing, record):
    if existing.get("kind") != "cleanup" or record.get("kind") != "cleanup":
        return False
    summary = existing.get("summary")
    if not isinstance(summary, dict) or set(summary) != {"cleanup_failed"}:
        return False
    upgraded = dict(existing)
    upgraded["summary"] = record.get("summary")
    if upgraded != record:
        return False
    return summary["cleanup_failed"] == record["summary"].get("cleanup_failed")


def _aggregate_status(records):
    status = "passed"
    for record in records:
        candidate = record["status"]
        if _STATUS_PRIORITY[candidate] > _STATUS_PRIORITY[status]:
            status = candidate
    return status


def _latest_status(records, latest):
    latest_records = [
        record
        for record in records
        if record["execution_id"] == latest[f"{record['kind']}_execution_id"]
    ]
    return _aggregate_status(latest_records)


def _latest_by_kind(records):
    latest = {"main": None, "cleanup": None}
    for record in records:
        current = latest[record["kind"]]
        if current is None or (record["created_at"], record["execution_id"]) > (current["created_at"], current["execution_id"]):
            latest[record["kind"]] = record
    return {
        "main_execution_id": latest["main"]["execution_id"],
        "cleanup_execution_id": None if latest["cleanup"] is None else latest["cleanup"]["execution_id"],
    }


def _build_cleanup_payload(cfg, result, created_at):
    status = "cleanup_failed" if result.cleanup_failed else "passed"
    cleanup_status = report.cleanup_status(result)
    return {
        "schema_version": ROOT_MANIFEST_SCHEMA_VERSION,
        "kind": "cleanup",
        "run_id": cfg.run_id,
        "execution_id": cfg.cleanup_execution_id,
        "main_execution_id": cfg.main_execution_id,
        "created_at": created_at,
        "status": status,
        "cleaned": {
            "cleanup_failed": result.cleanup_failed,
            "deleted_token_count": result.deleted_token_count,
            "account_deleted": result.account_deleted,
            "login_rejected_after_delete": result.login_rejected_after_delete,
            "cleanup_status": cleanup_status,
            "reason": result.reason,
        },
    }


def _execution_record(kind, execution_id, manifest, status, created_at, *, summary=None):
    record = {
        "kind": kind,
        "execution_id": execution_id,
        "manifest": manifest,
        "status": status,
        "created_at": created_at,
    }
    if summary is not None:
        record["summary"] = summary
    return record


def _validate_root_manifest(root, run_id, expected_bucket=None):
    if not isinstance(root, dict):
        raise ValueError("root manifest must be an object")
    allowed = {"schema_version", "run_id", "status", "latest", "executions", "candidates", "candidate_events"}
    if set(root) - allowed:
        raise ValueError("root manifest fields are invalid")
    if root.get("schema_version") != ROOT_MANIFEST_SCHEMA_VERSION or root.get("run_id") != run_id:
        raise ValueError("root manifest identity mismatch")
    latest = root.get("latest")
    if not isinstance(latest, dict) or set(latest) != {"main_execution_id", "cleanup_execution_id"}:
        raise ValueError("root manifest latest is invalid")
    if not _safe_gcs_component(latest["main_execution_id"]):
        raise ValueError("root manifest latest main execution is invalid")
    if latest["cleanup_execution_id"] is not None and not _safe_gcs_component(latest["cleanup_execution_id"]):
        raise ValueError("root manifest latest cleanup execution is invalid")
    executions = root.get("executions")
    if not isinstance(executions, list):
        raise ValueError("root manifest executions is invalid")
    seen = set()
    seen_by_kind = {"main": set(), "cleanup": set()}
    for record in executions:
        _validate_record(record, run_id)
        identity = (record["kind"], record["execution_id"])
        if identity in seen:
            raise ValueError("root manifest contains duplicate execution record")
        seen.add(identity)
        seen_by_kind[record["kind"]].add(record["execution_id"])
    status = root.get("status")
    if not isinstance(status, str) or status not in _STATUS_PRIORITY:
        raise ValueError("root manifest status is invalid")
    if seen_by_kind["main"] and latest["main_execution_id"] not in seen_by_kind["main"]:
        raise ValueError("root manifest latest main execution is inconsistent")
    if (
        latest["cleanup_execution_id"] is not None
        and seen_by_kind["cleanup"]
        and latest["cleanup_execution_id"] not in seen_by_kind["cleanup"]
    ):
        raise ValueError("root manifest latest cleanup execution is inconsistent")
    if "candidates" in root:
        _validate_candidates(root["candidates"], run_id=run_id, expected_bucket=expected_bucket)
    if "candidate_events" in root:
        _validate_candidate_events(root["candidate_events"])


def _validate_record(record, run_id):
    if not isinstance(record, dict):
        raise ValueError("execution record must be an object")
    if not {"kind", "execution_id", "manifest", "status", "created_at"} <= set(record):
        raise ValueError("execution record fields are invalid")
    if set(record) - {"kind", "execution_id", "manifest", "status", "created_at", "summary"}:
        raise ValueError("execution record fields are invalid")
    if record["kind"] not in {"main", "cleanup"}:
        raise ValueError("execution record kind is invalid")
    if not _safe_gcs_component(record["execution_id"]):
        raise ValueError("execution record execution_id is invalid")
    if record["manifest"] != _canonical_manifest_path(run_id, record["kind"], record["execution_id"]):
        raise ValueError("execution record manifest path is invalid")
    if not isinstance(record["status"], str) or not record["status"]:
        raise ValueError("execution record status is invalid")
    if record["status"] not in _STATUS_PRIORITY:
        raise ValueError("execution record status is invalid")
    if not isinstance(record["created_at"], int) or isinstance(record["created_at"], bool) or record["created_at"] < 0:
        raise ValueError("execution record created_at is invalid")
    if "summary" in record:
        _validate_record_summary(record["kind"], record["summary"])


def _validate_main_manifest(manifest, run_id, execution_id, expected_bucket=None):
    if not isinstance(manifest, dict):
        raise ValueError("main manifest must be an object")
    allowed = {
        "schema_version",
        "kind",
        "run_id",
        "execution_id",
        "status",
        "created_at",
        "result",
        "cleanup",
        "provenance",
        "infrastructure",
        "candidates",
        "candidate_events",
    }
    required = allowed - {"infrastructure", "candidates", "candidate_events"}
    if set(manifest) - allowed or required - set(manifest):
        raise ValueError("main manifest fields are invalid")
    if manifest["schema_version"] != ROOT_MANIFEST_SCHEMA_VERSION:
        raise ValueError("main manifest schema is invalid")
    if manifest["kind"] != "main" or manifest["run_id"] != run_id or manifest["execution_id"] != execution_id:
        raise ValueError("main manifest identity is invalid")
    if not _safe_gcs_component(manifest["execution_id"]):
        raise ValueError("main manifest execution_id is invalid")
    if not isinstance(manifest["status"], str) or manifest["status"] not in _STATUS_PRIORITY:
        raise ValueError("main manifest status is invalid")
    if not isinstance(manifest["created_at"], int) or isinstance(manifest["created_at"], bool) or manifest["created_at"] < 0:
        raise ValueError("main manifest created_at is invalid")
    if not isinstance(manifest["result"], dict) or not isinstance(manifest["cleanup"], dict):
        raise ValueError("main manifest payload is invalid")
    try:
        report.validate_result(manifest["result"], legacy=True)
        report.validate_provenance(manifest["provenance"])
    except report.ResultValidationError as exc:
        raise ValueError("main manifest payload is invalid") from exc
    if "infrastructure" in manifest and not isinstance(manifest["infrastructure"], dict):
        raise ValueError("main manifest infrastructure is invalid")
    if "candidates" in manifest:
        _validate_candidates(
            manifest["candidates"],
            run_id=run_id,
            expected_bucket=expected_bucket,
            expected_main_execution_id=execution_id,
        )
    if "candidate_events" in manifest:
        _validate_candidate_events(manifest["candidate_events"])


def _main_summary(result):
    try:
        validated = report.validate_result(result, legacy=True)
    except report.ResultValidationError as exc:
        raise ValueError("main manifest result is invalid") from exc
    summary = {
        "replay_status": validated["replay"]["status"],
        "exploration_status": validated["exploration"]["status"],
        "exploration_actions": validated["exploration"]["actions_used"],
        "finding_count": len(validated["findings"]),
        "finding_summaries": _finding_summaries(validated["findings"]),
    }
    if "coverage_candidates" in validated:
        summary["coverage_candidate_count"] = len(validated["coverage_candidates"])
    if "fixed_cases" in validated:
        fixed = validated["fixed_cases"]
        summary["fixed_case_status"] = fixed["status"]
        summary["fixed_case_count"] = len(fixed["cases"])
        summary["fixed_case_failed_count"] = sum(1 for case in fixed["cases"] if case["status"] == "failed")
    if "phase_trace" in validated:
        summary["phase_trace"] = list(validated["phase_trace"])
    return summary


def _cleanup_summary(cleanup_payload):
    summary = {"cleanup_failed": cleanup_payload["cleaned"]["cleanup_failed"]}
    if "cleanup_status" in cleanup_payload["cleaned"]:
        summary["cleanup_status"] = cleanup_payload["cleaned"]["cleanup_status"]
    return summary


def _validate_record_summary(kind, summary):
    if not isinstance(summary, dict):
        raise ValueError("execution record summary is invalid")
    if kind == "main":
        if set(summary) == {"replay_status", "exploration_status", "exploration_actions", "finding_count"}:
            _validate_main_summary_counts(summary)
            return
        legacy_with_findings = {
            "replay_status",
            "exploration_status",
            "exploration_actions",
            "finding_count",
            "finding_summaries",
        }
        new_summary = legacy_with_findings | {
            "coverage_candidate_count",
            "fixed_case_status",
            "fixed_case_count",
            "fixed_case_failed_count",
            "phase_trace",
        }
        if set(summary) == legacy_with_findings:
            _validate_main_summary_counts(summary)
            _validate_finding_summaries(summary["finding_summaries"])
            return
        if set(summary) != new_summary:
            raise ValueError("main execution summary fields are invalid")
        _validate_main_summary_counts(summary)
        _validate_finding_summaries(summary["finding_summaries"])
        _validate_new_main_summary(summary)
        return
    if set(summary) == {"cleanup_failed"} and isinstance(summary["cleanup_failed"], bool):
        return
    if (
        set(summary) != {"cleanup_failed", "cleanup_status"}
        or not isinstance(summary["cleanup_failed"], bool)
        or summary["cleanup_status"] not in report.CLEANUP_STATUSES
        or (summary["cleanup_status"] == "failed") is not summary["cleanup_failed"]
    ):
        raise ValueError("cleanup execution summary is invalid")


def _validate_main_summary_counts(summary):
    if summary["replay_status"] not in {"passed", "failed"}:
        raise ValueError("main execution replay summary is invalid")
    if summary["exploration_status"] not in {"passed", "failed", "not_started"}:
        raise ValueError("main execution exploration summary is invalid")
    for key in ("exploration_actions", "finding_count"):
        if not isinstance(summary[key], int) or isinstance(summary[key], bool) or summary[key] < 0:
            raise ValueError("main execution summary count is invalid")


def _validate_new_main_summary(summary):
    for key in ("coverage_candidate_count", "fixed_case_count", "fixed_case_failed_count"):
        if not isinstance(summary[key], int) or isinstance(summary[key], bool) or summary[key] < 0:
            raise ValueError("main execution summary count is invalid")
    if summary["fixed_case_status"] not in report.FIXED_CASE_STATUSES:
        raise ValueError("main execution fixed case summary is invalid")
    if summary["fixed_case_failed_count"] > summary["fixed_case_count"]:
        raise ValueError("main execution fixed case summary is invalid")
    try:
        report._validate_phase_trace(summary["phase_trace"])
    except report.ResultValidationError as exc:
        raise ValueError("main execution phase trace summary is invalid") from exc


def _candidate_root_fields_from_main(manifest):
    fields = {"candidates": copy.deepcopy(manifest.get("candidates", []))}
    if "candidate_events" in manifest:
        fields["candidate_events"] = copy.deepcopy(manifest["candidate_events"])
    return fields


def _candidate_root_fields_from_existing_root(root):
    fields = {"candidates": copy.deepcopy(root.get("candidates", []))}
    if "candidate_events" in root:
        fields["candidate_events"] = copy.deepcopy(root["candidate_events"])
    return fields


def _validate_candidates(candidates, *, run_id, expected_bucket=None, expected_main_execution_id=None):
    if not isinstance(candidates, list) or len(candidates) > _MAX_CANDIDATES:
        raise ValueError("candidate list is invalid")
    seen = set()
    for candidate in candidates:
        normalized = _validate_candidate(
            candidate,
            run_id=run_id,
            expected_bucket=expected_bucket,
            expected_main_execution_id=expected_main_execution_id,
        )
        fingerprint = normalized["fingerprint"]
        if fingerprint in seen:
            raise ValueError("duplicate candidate fingerprint")
        seen.add(fingerprint)


def _validate_candidate(candidate, *, run_id, expected_bucket=None, expected_main_execution_id=None):
    if not isinstance(candidate, dict) or set(candidate) != _CANDIDATE_FIELDS:
        raise ValueError("candidate fields are invalid")
    if candidate["schema_version"] != ROOT_MANIFEST_SCHEMA_VERSION:
        raise ValueError("candidate schema is invalid")
    kind = candidate["kind"]
    if kind not in promotion.KINDS:
        raise ValueError("candidate kind is invalid")
    fingerprint = candidate["fingerprint"]
    promotion._validate_fingerprint(fingerprint)
    target_url = promotion._normalize_target_url(candidate["target_url"])
    if promotion._origin(target_url) not in {"https://staging-console.flatkey.ai", "https://staging-website.flatkey.ai"}:
        raise ValueError("candidate target origin is invalid")
    proposed = promotion._semantic_proposed_case(candidate["proposed_case"])
    if promotion.canonical_fingerprint(kind, target_url, proposed) != fingerprint:
        raise ValueError("candidate fingerprint is invalid")
    source = candidate["source"]
    if not isinstance(source, dict) or set(source) != _CANDIDATE_SOURCE_FIELDS:
        raise ValueError("candidate source is invalid")
    if source["run_id"] != run_id:
        raise ValueError("candidate source run is invalid")
    _validate_candidate_source_uri(
        source["evidence_uri"],
        run_id=run_id,
        expected_bucket=expected_bucket,
        expected_main_execution_id=expected_main_execution_id,
    )
    candidate_promotion = candidate["promotion"]
    if (
        not isinstance(candidate_promotion, dict)
        or set(candidate_promotion) != _CANDIDATE_PROMOTION_FIELDS
        or candidate_promotion["state"] not in promotion.STATES
        or candidate_promotion["attempts_required"] != promotion.ATTEMPTS_REQUIRED
        or not isinstance(candidate_promotion["attempts_passed"], int)
        or isinstance(candidate_promotion["attempts_passed"], bool)
        or candidate_promotion["attempts_passed"] < 0
        or candidate_promotion["attempts_passed"] > promotion.ATTEMPTS_REQUIRED
    ):
        raise ValueError("candidate promotion is invalid")
    _reject_sensitive_candidate(candidate)
    return candidate


def _validate_candidate_source_uri(uri, *, run_id, expected_bucket=None, expected_main_execution_id=None):
    if not isinstance(uri, str) or _has_control_character(uri):
        raise ValueError("candidate source uri is invalid")
    parsed = urllib.parse.urlsplit(uri)
    if parsed.scheme != "gs" or not parsed.netloc or parsed.query or parsed.fragment:
        raise ValueError("candidate source uri is invalid")
    if expected_bucket is not None and parsed.netloc != expected_bucket:
        raise ValueError("candidate source bucket is invalid")
    parts = parsed.path[1:].split("/")
    if len(parts) != 5 or parts[0] != "runs" or parts[1] != run_id or parts[2] != "main" or parts[4] != "manifest.json":
        raise ValueError("candidate source uri is invalid")
    if not _safe_gcs_component(parts[3]):
        raise ValueError("candidate source execution is invalid")
    if expected_main_execution_id is not None and parts[3] != expected_main_execution_id:
        raise ValueError("candidate source execution is invalid")


def _validate_candidate_events(events):
    if not isinstance(events, list) or len(events) > _MAX_CANDIDATES:
        raise ValueError("candidate events are invalid")
    for event in events:
        if (
            not isinstance(event, dict)
            or set(event) != _CANDIDATE_EVENT_FIELDS
            or event["kind"] != "candidate_bundle_failed"
            or event["candidate_kind"] not in promotion.KINDS
        ):
            raise ValueError("candidate event is invalid")


def _reject_sensitive_candidate(candidate):
    for text in _walk_strings(candidate):
        if (
            _OPENAI_SECRET_KEY.search(text) is not None
            or _SECRET_TERMS.search(text) is not None
            or any(term in text for term in _LOCALIZED_SECRET_TERMS)
            or "screenshots/" in text
            or text in {"result.json", "codex-events.jsonl", "codex-stderr.txt"}
        ):
            raise ValueError("candidate contains sensitive content")


def _walk_strings(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_strings(child)
    elif isinstance(value, str):
        yield value


def _validate_cleanup_manifest(manifest, cfg):
    if not isinstance(manifest, dict):
        raise ValueError("cleanup manifest must be an object")
    if set(manifest) != {
        "schema_version",
        "kind",
        "run_id",
        "execution_id",
        "main_execution_id",
        "created_at",
        "status",
        "cleaned",
    }:
        raise ValueError("cleanup manifest fields are invalid")
    if manifest["schema_version"] != ROOT_MANIFEST_SCHEMA_VERSION:
        raise ValueError("cleanup manifest schema is invalid")
    if (
        manifest["kind"] != "cleanup"
        or manifest["run_id"] != cfg.run_id
        or manifest["execution_id"] != cfg.cleanup_execution_id
        or manifest["main_execution_id"] != cfg.main_execution_id
    ):
        raise ValueError("cleanup manifest identity is invalid")
    if not _safe_gcs_component(manifest["execution_id"]) or not _safe_gcs_component(manifest["main_execution_id"]):
        raise ValueError("cleanup manifest execution_id is invalid")
    if not isinstance(manifest["created_at"], int) or isinstance(manifest["created_at"], bool) or manifest["created_at"] < 0:
        raise ValueError("cleanup manifest created_at is invalid")
    if not isinstance(manifest["status"], str) or manifest["status"] not in {"passed", "cleanup_failed"}:
        raise ValueError("cleanup manifest status is invalid")
    cleaned = manifest["cleaned"]
    legacy_fields = {
        "cleanup_failed",
        "deleted_token_count",
        "account_deleted",
        "login_rejected_after_delete",
        "reason",
    }
    new_fields = legacy_fields | {"cleanup_status"}
    if not isinstance(cleaned, dict) or set(cleaned) not in (legacy_fields, new_fields):
        raise ValueError("cleanup manifest cleaned payload is invalid")
    if cleaned["cleanup_failed"] is not (manifest["status"] == "cleanup_failed"):
        raise ValueError("cleanup manifest status is inconsistent")
    if "cleanup_status" in cleaned:
        if cleaned["cleanup_status"] not in report.CLEANUP_STATUSES:
            raise ValueError("cleanup manifest cleanup status is invalid")
        if (cleaned["cleanup_status"] == "failed") is not cleaned["cleanup_failed"]:
            raise ValueError("cleanup manifest status is inconsistent")
    if not isinstance(cleaned["deleted_token_count"], int) or isinstance(cleaned["deleted_token_count"], bool) or cleaned["deleted_token_count"] < 0:
        raise ValueError("cleanup manifest deleted token count is invalid")
    if not isinstance(cleaned["account_deleted"], bool) or not isinstance(cleaned["login_rejected_after_delete"], bool):
        raise ValueError("cleanup manifest booleans are invalid")
    if not isinstance(cleaned["reason"], str) or not cleaned["reason"]:
        raise ValueError("cleanup manifest reason is invalid")


def _json_bytes(payload):
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")


def _finding_summaries(findings):
    summaries = []
    for finding in findings:
        if finding["severity"] == "info":
            continue
        summaries.append(
            {
                "severity": finding["severity"],
                "title": _summary_title(finding["title"]),
                "confidence": finding["confidence"],
                "page_path": _summary_page_path(finding["target_url"]),
            }
        )
        if len(summaries) == 3:
            break
    return summaries


def _validate_finding_summaries(summaries):
    if not isinstance(summaries, list) or len(summaries) > 3:
        raise ValueError("main execution finding summaries are invalid")
    for item in summaries:
        if not isinstance(item, dict) or set(item) != {"severity", "title", "confidence", "page_path"}:
            raise ValueError("main execution finding summary fields are invalid")
        if item["severity"] not in (report.SEVERITIES - {"info"}):
            raise ValueError("main execution finding summary severity is invalid")
        if item["confidence"] not in report.CONFIDENCE:
            raise ValueError("main execution finding summary confidence is invalid")
        title = item["title"]
        if (
            not isinstance(title, str)
            or not title
            or len(title) > 160
            or title != " ".join(title.split())
            or _has_control_character(title)
            or _is_sensitive_finding_title(title)
        ):
            raise ValueError("main execution finding summary title is invalid")
        page_path = item["page_path"]
        if (
            not isinstance(page_path, str)
            or not page_path.startswith("/")
            or "?" in page_path
            or "#" in page_path
            or _has_control_character(page_path)
        ):
            raise ValueError("main execution finding summary page path is invalid")


def _summary_title(title):
    folded = "".join(" " if _is_control_character(char) else char for char in title).split()
    summary = " ".join(folded)[:160]
    if not summary:
        return _SENSITIVE_TITLE_OMITTED
    if _is_sensitive_finding_title(summary):
        return _SENSITIVE_TITLE_OMITTED
    return summary


def _summary_page_path(target_url):
    path = _strip_category_c(urllib.parse.urlsplit(target_url).path)
    return path if path.startswith("/") else "/"


def _has_control_character(value):
    return any(_is_category_c_character(char) for char in value)


def _is_sensitive_finding_title(title):
    return (
        _OPENAI_SECRET_KEY.search(title) is not None
        or _EMAIL_ADDRESS.search(title) is not None
        or _SECRET_TERMS.search(title) is not None
        or any(term in title for term in _LOCALIZED_SECRET_TERMS)
        or _SIX_DIGIT_CODE.search(title) is not None
    )


def _strip_category_c(value):
    return "".join(char for char in value if not _is_category_c_character(char))


def _is_control_character(char):
    return _is_category_c_character(char)


def _is_category_c_character(char):
    return unicodedata.category(char).startswith("C")


def _canonical_manifest_path(run_id, kind, execution_id):
    filename = "cleanup.json" if kind == "cleanup" else "manifest.json"
    return f"runs/{run_id}/{kind}/{execution_id}/{filename}"


def _safe_gcs_component(value):
    return (
        isinstance(value, str)
        and _SAFE_GCS_COMPONENT.fullmatch(value) is not None
        and value not in {".", ".."}
        and ".." not in value
        and "/" not in value
        and "\\" not in value
    )


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
