import argparse
import base64
import copy
import json
import re
import sys
import urllib.parse

from . import candidate_job
from . import fixed_cases
from . import promotion


MAX_CANDIDATES = 20
ROOT_CANDIDATE_FIELDS = {"schema_version", "kind", "fingerprint", "target_url", "proposed_case", "source", "promotion"}
SOURCE_FIELDS = {"run_id", "evidence_uri"}
PROMOTION_FIELDS = {"state", "attempts_required", "attempts_passed"}
EXECUTION_RECORD_FIELDS = {"kind", "execution_id", "manifest", "status", "created_at"}
EXECUTION_RECORD_ALLOWED_FIELDS = EXECUTION_RECORD_FIELDS | {"summary"}
PLAN_CANDIDATE_FIELDS = {"kind", "fingerprint", "target_url", "proposed_case", "source", "promotion", "case_id", "attempts"}
PLAN_ATTEMPT_FIELDS = {"attempt_id", "candidate_b64", "manifest_uri", "manifest_object", "fingerprint", "case_id"}
SAFE_COMPONENT_RE = re.compile(r"^[A-Za-z0-9._-]{1,128}$")
SAFE_B64_RE = re.compile(r"^[A-Za-z0-9_-]+$")
STAGING_ORIGINS = {"https://staging-console.flatkey.ai", "https://staging-website.flatkey.ai"}
ROOT_STATUSES = {"passed", "findings_detected", "replay_failed", "infrastructure_failed", "cleanup_failed"}


def build_execution_plan(root_manifest, *, expected_bucket, run_id, occupied=None):
    expected_bucket = candidate_job._validate_gcs_bucket(expected_bucket)
    run_id = candidate_job._validate_run_id(run_id)
    occupied = {} if occupied is None else dict(occupied)
    candidates = _root_candidates(root_manifest)
    expected_source_uri = None
    if candidates:
        expected_source_uri = _latest_main_manifest_uri(root_manifest, expected_bucket=expected_bucket, run_id=run_id)
    seen = set()
    planned = []
    for index, candidate in enumerate(candidates):
        normalized = _validate_root_candidate(candidate, expected_bucket=expected_bucket, run_id=run_id, expected_source_uri=expected_source_uri)
        fingerprint = normalized["fingerprint"]
        if fingerprint in seen:
            raise ValueError("duplicate candidate fingerprint")
        seen.add(fingerprint)
        case_id = promotion.deterministic_case_id(fingerprint, occupied)
        occupied[case_id] = fingerprint
        planned.append(_plan_candidate(normalized, expected_bucket=expected_bucket, run_id=run_id, case_id=case_id))
    return {"schema_version": 1, "kind": "candidate_execution_plan", "run_id": run_id, "bucket": expected_bucket, "candidates": planned}


def exact_attempt_manifest_uris(candidate):
    return [attempt["manifest_uri"] for attempt in _validate_plan_candidate(candidate)["attempts"]]


def aggregate_candidate_attempts(candidate, attempt_manifests):
    candidate = _validate_plan_candidate(candidate)
    if not isinstance(attempt_manifests, list) or len(attempt_manifests) > promotion.ATTEMPTS_REQUIRED:
        raise ValueError("invalid candidate attempt manifests")
    by_attempt = {attempt["attempt_id"]: attempt for attempt in candidate["attempts"]}
    attempts = []
    for manifest in attempt_manifests:
        if not isinstance(manifest, dict) or set(manifest) != {"schema_version", "kind", "fingerprint", "case_id", "attempt_id", "result", "cleanup", "runtime"}:
            raise ValueError("candidate attempt manifest invalid")
        candidate_job._validate_candidate_manifest(manifest)
        attempt_id = manifest["attempt_id"]
        expected = by_attempt.get(attempt_id)
        if expected is None:
            raise ValueError("candidate attempt id mismatch")
        if manifest["fingerprint"] != candidate["fingerprint"] or manifest["case_id"] != candidate["case_id"]:
            raise ValueError("candidate attempt identity mismatch")
        attempts.append({
            "attempt_id": attempt_id,
            "evidence_dir": manifest["result"]["evidence_dir"],
            "result": copy.deepcopy(manifest["result"]),
            "cleanup": copy.deepcopy(manifest["cleanup"]),
            "runtime": copy.deepcopy(manifest["runtime"]),
        })
    return promotion.aggregate_attempts(candidate["kind"], candidate["promotion"]["state"], attempts)


def load_json(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle)


def dump_json(path, value):
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(value, handle, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
        handle.write("\n")


def _root_candidates(root_manifest):
    if not isinstance(root_manifest, dict):
        raise ValueError("root manifest invalid")
    if root_manifest.get("schema_version") != 1:
        raise ValueError("root manifest invalid")
    candidates = root_manifest.get("candidates", [])
    if not isinstance(candidates, list) or len(candidates) > MAX_CANDIDATES:
        raise ValueError("root manifest candidates invalid")
    return candidates


def _latest_main_manifest_uri(root_manifest, *, expected_bucket, run_id):
    if root_manifest.get("run_id") != run_id:
        raise ValueError("root manifest run mismatch")
    latest = root_manifest.get("latest")
    if not isinstance(latest, dict) or set(latest) != {"main_execution_id", "cleanup_execution_id"}:
        raise ValueError("root manifest latest invalid")
    main_execution_id = latest["main_execution_id"]
    if not _safe_component(main_execution_id):
        raise ValueError("root manifest latest main execution invalid")
    cleanup_execution_id = latest["cleanup_execution_id"]
    if cleanup_execution_id is not None and not _safe_component(cleanup_execution_id):
        raise ValueError("root manifest latest cleanup execution invalid")
    executions = root_manifest.get("executions")
    if not isinstance(executions, list):
        raise ValueError("root manifest executions invalid")
    expected_manifest = f"runs/{run_id}/main/{main_execution_id}/manifest.json"
    matches = []
    for record in executions:
        if not isinstance(record, dict) or set(record) - EXECUTION_RECORD_ALLOWED_FIELDS or EXECUTION_RECORD_FIELDS - set(record):
            raise ValueError("root manifest execution record invalid")
        if not _safe_component(record["execution_id"]):
            raise ValueError("root manifest execution id invalid")
        if record["kind"] not in {"main", "cleanup"}:
            raise ValueError("root manifest execution kind invalid")
        if record["status"] not in ROOT_STATUSES:
            raise ValueError("root manifest execution status invalid")
        if not isinstance(record["created_at"], int) or isinstance(record["created_at"], bool) or record["created_at"] < 0:
            raise ValueError("root manifest execution created_at invalid")
        if record["kind"] == "main" and record["execution_id"] == main_execution_id:
            matches.append(record)
    if len(matches) != 1:
        raise ValueError("root manifest latest main execution inconsistent")
    if matches[0]["manifest"] != expected_manifest:
        raise ValueError("root manifest latest main manifest invalid")
    return f"gs://{expected_bucket}/{expected_manifest}"


def _safe_component(value):
    return isinstance(value, str) and SAFE_COMPONENT_RE.fullmatch(value) is not None


def _validate_root_candidate(candidate, *, expected_bucket, run_id, expected_source_uri):
    if not isinstance(candidate, dict) or set(candidate) != ROOT_CANDIDATE_FIELDS:
        raise ValueError("candidate fields invalid")
    if candidate["schema_version"] != 1:
        raise ValueError("candidate schema invalid")
    kind = candidate["kind"]
    if kind not in promotion.KINDS:
        raise ValueError("candidate kind invalid")
    fingerprint = candidate["fingerprint"]
    promotion._validate_fingerprint(fingerprint)
    target_url = promotion._normalize_target_url(candidate["target_url"])
    if promotion._origin(target_url) not in STAGING_ORIGINS:
        raise ValueError("candidate target origin invalid")
    proposed = promotion._semantic_proposed_case(candidate["proposed_case"])
    if promotion.canonical_fingerprint(kind, target_url, proposed) != fingerprint:
        raise ValueError("candidate fingerprint mismatch")
    source = candidate["source"]
    if not isinstance(source, dict) or set(source) != SOURCE_FIELDS:
        raise ValueError("candidate source invalid")
    if source["run_id"] != run_id:
        raise ValueError("candidate source run mismatch")
    _validate_exact_source_uri(source["evidence_uri"], expected_bucket=expected_bucket, run_id=run_id, expected_source_uri=expected_source_uri)
    promo = candidate["promotion"]
    if not isinstance(promo, dict) or set(promo) != PROMOTION_FIELDS:
        raise ValueError("candidate promotion invalid")
    if promo["state"] not in promotion.STATES or promo["attempts_required"] != promotion.ATTEMPTS_REQUIRED:
        raise ValueError("candidate promotion invalid")
    if not isinstance(promo["attempts_passed"], int) or isinstance(promo["attempts_passed"], bool) or promo["attempts_passed"] < 0 or promo["attempts_passed"] > promotion.ATTEMPTS_REQUIRED:
        raise ValueError("candidate promotion invalid")
    _reject_sensitive_candidate(candidate)
    return {
        "kind": kind,
        "fingerprint": fingerprint,
        "target_url": target_url,
        "proposed_case": proposed,
        "source": copy.deepcopy(source),
        "promotion": copy.deepcopy(promo),
    }


def _plan_candidate(candidate, *, expected_bucket, run_id, case_id):
    attempts = []
    for index in range(1, promotion.ATTEMPTS_REQUIRED + 1):
        attempt_id = f"attempt-{run_id}-{candidate['fingerprint'][7:19]}-{index}"
        if not candidate_job._safe_attempt_id(attempt_id):
            raise ValueError("generated attempt id invalid")
        manifest_object = f"runs/{run_id}/candidates/{candidate['fingerprint'][7:19]}/{attempt_id}/manifest.json"
        manifest_uri = f"gs://{expected_bucket}/{manifest_object}"
        config = {
            "run_id": run_id,
            "bucket": expected_bucket,
            "attempt_id": attempt_id,
            "FLATKEY_QA_WEBSITE_ORIGIN": "https://staging-website.flatkey.ai",
            "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai",
        }
        case = candidate_job._materialize_candidate_case(
            kind=candidate["kind"],
            proposed_case=candidate["proposed_case"],
            fingerprint=candidate["fingerprint"],
            case_id=case_id,
            config=config,
        )
        payload = {
            "schema_version": 1,
            "kind": candidate["kind"],
            "target_url": candidate["target_url"],
            "proposed_case": copy.deepcopy(candidate["proposed_case"]),
            "fingerprint": candidate["fingerprint"],
            "case_id": case_id,
            "case": case,
        }
        encoded = _canonical_b64(payload)
        if not SAFE_B64_RE.fullmatch(encoded):
            raise ValueError("candidate payload encoding invalid")
        attempts.append({
            "attempt_id": attempt_id,
            "candidate_b64": encoded,
            "manifest_uri": manifest_uri,
            "manifest_object": manifest_object,
            "fingerprint": candidate["fingerprint"],
            "case_id": case_id,
        })
    return {
        **copy.deepcopy(candidate),
        "case_id": case_id,
        "attempts": attempts,
    }


def _validate_plan_candidate(candidate):
    if not isinstance(candidate, dict) or set(candidate) != PLAN_CANDIDATE_FIELDS:
        raise ValueError("plan candidate invalid")
    promotion._validate_fingerprint(candidate["fingerprint"])
    if candidate["kind"] not in promotion.KINDS:
        raise ValueError("plan candidate invalid")
    if not isinstance(candidate["case_id"], str) or not fixed_cases.ID_RE.fullmatch(candidate["case_id"]):
        raise ValueError("plan candidate invalid")
    if not isinstance(candidate["promotion"], dict) or set(candidate["promotion"]) != PROMOTION_FIELDS or candidate["promotion"]["state"] not in promotion.STATES:
        raise ValueError("plan candidate invalid")
    attempts = candidate["attempts"]
    if not isinstance(attempts, list) or len(attempts) != promotion.ATTEMPTS_REQUIRED:
        raise ValueError("plan candidate invalid")
    seen = set()
    for attempt in attempts:
        if not isinstance(attempt, dict) or set(attempt) != PLAN_ATTEMPT_FIELDS:
            raise ValueError("plan attempt invalid")
        if attempt["fingerprint"] != candidate["fingerprint"] or attempt["case_id"] != candidate["case_id"]:
            raise ValueError("plan attempt invalid")
        if not candidate_job._safe_attempt_id(attempt["attempt_id"]) or attempt["attempt_id"] in seen:
            raise ValueError("plan attempt invalid")
        seen.add(attempt["attempt_id"])
        if not isinstance(attempt["candidate_b64"], str) or not SAFE_B64_RE.fullmatch(attempt["candidate_b64"]):
            raise ValueError("plan attempt invalid")
        _validate_manifest_object(attempt["manifest_object"], candidate["fingerprint"], attempt["attempt_id"])
        uri = urllib.parse.urlsplit(attempt["manifest_uri"])
        if uri.scheme != "gs" or uri.path[1:] != attempt["manifest_object"]:
            raise ValueError("plan attempt invalid")
    return candidate


def _validate_exact_source_uri(uri, *, expected_bucket, run_id, expected_source_uri):
    promotion._validate_gcs_uri(uri, run_id)
    parsed = urllib.parse.urlsplit(uri)
    if parsed.netloc != expected_bucket:
        raise ValueError("candidate source bucket mismatch")
    parts = parsed.path[1:].split("/")
    if len(parts) != 5 or parts[0] != "runs" or parts[1] != run_id or parts[2] != "main" or parts[4] != "manifest.json":
        raise ValueError("candidate source run mismatch")
    if not _safe_component(parts[3]):
        raise ValueError("candidate source path invalid")
    if uri != expected_source_uri:
        raise ValueError("candidate source manifest mismatch")


def _validate_manifest_object(path, fingerprint, attempt_id):
    expected = f"runs/"
    if not isinstance(path, str) or not path.startswith(expected):
        raise ValueError("manifest object invalid")
    parts = path.split("/")
    if len(parts) != 6 or parts[0] != "runs" or parts[2] != "candidates" or parts[3] != fingerprint[7:19] or parts[4] != attempt_id or parts[5] != "manifest.json":
        raise ValueError("manifest object invalid")
    if not candidate_job._safe_run_id(parts[1]):
        raise ValueError("manifest object invalid")


def _reject_sensitive_candidate(candidate):
    for text in _walk_strings(candidate):
        if candidate_job.SECRET_RE.search(text):
            raise ValueError("candidate contains sensitive content")
        if text in {"result.json", "codex-events.jsonl", "codex-stderr.txt"} or "screenshots/" in text:
            raise ValueError("candidate contains raw evidence path")


def _walk_strings(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_strings(child)
    elif isinstance(value, str):
        yield value


def _canonical_b64(payload):
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def _plan_cmd(args):
    plan = build_execution_plan(load_json(args.root_manifest), expected_bucket=args.bucket, run_id=args.run_id)
    dump_json(args.output, plan)
    print(json.dumps({"candidate_count": len(plan["candidates"])}, sort_keys=True, separators=(",", ":")))
    return 0


def _aggregate_cmd(args):
    candidate = load_json(args.candidate)
    manifests = [load_json(path) for path in args.attempt_manifest]
    summary = aggregate_candidate_attempts(candidate, manifests)
    dump_json(args.output, summary)
    print(json.dumps(summary, sort_keys=True, separators=(",", ":")))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)
    plan = subparsers.add_parser("plan")
    plan.add_argument("--root-manifest", required=True)
    plan.add_argument("--bucket", required=True)
    plan.add_argument("--run-id", required=True)
    plan.add_argument("--output", required=True)
    aggregate = subparsers.add_parser("aggregate")
    aggregate.add_argument("--candidate", required=True)
    aggregate.add_argument("--attempt-manifest", action="append", required=True)
    aggregate.add_argument("--output", required=True)
    args = parser.parse_args(sys.argv[1:] if argv is None else argv)
    if args.command == "plan":
        return _plan_cmd(args)
    if args.command == "aggregate":
        return _aggregate_cmd(args)
    raise SystemExit(2)


if __name__ == "__main__":
    raise SystemExit(main())
