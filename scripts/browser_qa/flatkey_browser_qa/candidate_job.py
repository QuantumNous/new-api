import base64
import binascii
import copy
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile
import time
import urllib.parse

from .api import StagingApiClient
from .cleanup import CleanupResult
from .cleanup import CleanupRunner
from .fixed_case_runner import FixedCaseRunner
from .gcp import GcpClient
from .gcp import upload_gcs_object
from .identity import derive_identity
from .redaction import Redactor
from . import fixed_cases
from . import promotion
from . import report
from . import supervisor


MAX_CANDIDATE_B64_BYTES = 96 * 1024
PAYLOAD_FIELDS = {"schema_version", "kind", "target_url", "proposed_case", "fingerprint", "case_id", "case"}
ATTEMPT_ID_RE = re.compile(r"^attempt-[A-Za-z0-9][A-Za-z0-9._-]{0,55}$")
FINGERPRINT_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
RELATED_ENV_PREFIXES = ("FLATKEY_QA_", "FLATKEY_BROWSER_QA_", "BROWSER_QA_")
ALLOWED_CANDIDATE_ENV_KEYS = frozenset({
    "BROWSER_QA_ATTEMPT_ID",
    "BROWSER_QA_CANDIDATE_B64",
    "FLATKEY_BROWSER_QA_BROKER_URL",
    "FLATKEY_BROWSER_QA_CHROMIUM_STARTUP_STDERR_BYTES",
    "FLATKEY_BROWSER_QA_EXECUTION_ID",
    "FLATKEY_BROWSER_QA_GCS_BUCKET",
    "FLATKEY_BROWSER_QA_RUNTIME_ROOT",
    "FLATKEY_QA_CONSOLE_ORIGIN",
    "FLATKEY_QA_DOCS_ORIGIN",
    "FLATKEY_QA_GMAIL_BASE",
    "FLATKEY_QA_IDENTITY_SEED_B64",
    "FLATKEY_QA_RUN_ID",
    "FLATKEY_QA_WEBSITE_ORIGIN",
})
GCS_BUCKET_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$")
RUN_APP_HOST_RE = re.compile(r"^[a-z0-9-]+-[a-z0-9-]+-[a-z0-9-]+-[a-z]{2}\.a\.run\.app$")
ALLOWED_RUNTIME_CLASSIFICATIONS = frozenset({
    "invalid_payload",
    "proxy_failed",
    "browser_failed",
    "browser_helper_failed",
    "fixed_case_infrastructure_failed",
    "browser_evidence_failed",
    "upload_failed",
})
SECRET_RE = re.compile(
    r"\bsk-[A-Za-z0-9_-]{8,}\b|\b(?:authorization|cookie)\s*:\s*\S+|\b(?:password|token|api[_-]?key|client[_-]?secret|secret)\b\s*[:=]\s*\S+",
    re.IGNORECASE,
)


class CandidateOutcome:
    def __init__(self, status, manifest_path, events):
        self.status = status
        self.manifest_path = manifest_path
        self.events = events


class CandidateJob:
    def __init__(
        self,
        *,
        env,
        runtime_root,
        browser_factory=supervisor.ChromiumRuntime,
        evidence_helper_factory=supervisor.BrowserEvidenceHelperProcess,
        cleanup_runner,
        uploader=None,
        uploader_factory=None,
        popen_factory=subprocess.Popen,
        fixed_case_runner_factory=FixedCaseRunner,
        proxy_factory=supervisor.EgressProxy,
        clock=time,
    ):
        self.env = dict(env)
        self.runtime_root = os.path.realpath(runtime_root)
        self.browser_factory = browser_factory
        self.evidence_helper_factory = evidence_helper_factory
        self.cleanup_runner = cleanup_runner
        self.uploader = uploader
        self.uploader_factory = uploader_factory
        self.popen_factory = popen_factory
        self.fixed_case_runner_factory = fixed_case_runner_factory
        self.proxy_factory = proxy_factory
        self.clock = clock
        self.events = []

    def run(self):
        os.makedirs(self.runtime_root, mode=0o700, exist_ok=True)
        supervisor._ensure_owner_only_directory(self.runtime_root)
        redactor = _redactor_from_env(self.env)
        manifest_path = os.path.join(self.runtime_root, "manifest.json")
        browser = None
        helper = None
        proxy = None
        payload = None
        case = None
        fingerprint = "sha256:" + "0" * 64
        case_id = "FQA-0000"
        attempt_id = self.env.get("BROWSER_QA_ATTEMPT_ID", "")
        result = None
        cleanup_status = "not_required"
        runtime_classification = None
        upload_failed = False
        config = None
        try:
            config = validate_candidate_config(self.env)
            payload = parse_candidate_payload(self.env, redactor=redactor, config=config)
            fingerprint = payload["fingerprint"]
            case_id = payload["case_id"]
            case = payload["case"]
            attempt_id = config["attempt_id"]
        except Exception as exc:
            runtime_classification = "invalid_payload"
            self._event("invalid_payload", str(exc), redactor)
        if runtime_classification is None:
            try:
                try:
                    proxy = self.proxy_factory()
                    proxy.start()
                except Exception as exc:
                    runtime_classification = "proxy_failed"
                    self._event("proxy_failed", str(exc), redactor)
                    raise _CandidateInfrastructureError from None
                try:
                    browser = self.browser_factory(
                        runtime_root=self.runtime_root,
                        proxy=proxy,
                        popen_factory=self.popen_factory,
                        startup_stderr_limit_bytes=0,
                    )
                    browser.start()
                except Exception as exc:
                    runtime_classification = "browser_failed"
                    self._event("browser_failed", str(exc), redactor)
                    raise _CandidateInfrastructureError from None
                try:
                    helper = self.evidence_helper_factory(
                        browser=browser,
                        runtime_root=self.runtime_root,
                        redactor=redactor,
                        popen_factory=self.popen_factory,
                        docs_proxy_url=None,
                    ).start()
                except Exception as exc:
                    runtime_classification = "browser_helper_failed"
                    self._event("browser_helper_failed", str(exc), redactor)
                    raise _CandidateInfrastructureError from None
                try:
                    runner = self.fixed_case_runner_factory(
                        helper,
                        evidence_dir=os.path.join(self.runtime_root, "fixed-cases"),
                    )
                    result = redactor.clean(runner.run(case, {"id": attempt_id, "retry": 0}))
                except Exception as exc:
                    runtime_classification = "fixed_case_infrastructure_failed"
                    self._event("fixed_case_infrastructure_failed", str(exc), redactor)
                    raise _CandidateInfrastructureError from None
                cleanup_status = self._cleanup_status(case, redactor)
            except _CandidateInfrastructureError:
                pass
        if helper is not None:
            try:
                supervisor.write_browser_evidence_artifacts(self.runtime_root, helper.flush(), redactor)
            except Exception as exc:
                runtime_classification = runtime_classification or "browser_evidence_failed"
                self._event("browser_evidence_failed", str(exc), redactor)
            try:
                helper.stop()
            except Exception as exc:
                runtime_classification = runtime_classification or "browser_helper_failed"
                self._event("browser_helper_stop_failed", str(exc), redactor)
        if browser is not None:
            try:
                browser.stop()
            except Exception as exc:
                runtime_classification = runtime_classification or "browser_failed"
                self._event("browser_stop_failed", str(exc), redactor)
        if proxy is not None:
            try:
                proxy.stop()
            except Exception as exc:
                runtime_classification = runtime_classification or "browser_failed"
                self._event("proxy_stop_failed", str(exc), redactor)
        if result is None:
            result = _empty_candidate_result(case_id, attempt_id if _safe_attempt_id(attempt_id) else "attempt-invalid")
        manifest = _candidate_manifest(
            fingerprint=fingerprint,
            case_id=case_id,
            attempt_id=attempt_id if _safe_attempt_id(attempt_id) else "attempt-invalid",
            result=result,
            cleanup_status=cleanup_status,
            runtime_classification=runtime_classification,
            redactor=redactor,
        )
        supervisor._write_private_json(manifest_path, manifest)
        uploader = self.uploader
        if uploader is None and self.uploader_factory is not None and config is not None:
            uploader = self.uploader_factory(config=config, fingerprint=fingerprint)
        if uploader is not None:
            try:
                uploader.upload("manifest.json", _collect_candidate_artifacts(self.runtime_root))
            except Exception as exc:
                upload_failed = True
                runtime_classification = "upload_failed"
                self._event("upload_failed", str(exc), redactor)
                manifest["runtime"]["classification"] = "upload_failed"
                supervisor._write_private_json(manifest_path, manifest)
                try:
                    uploader.upload("manifest.json", ["manifest.json"])
                except Exception as retry_exc:
                    self._event("upload_manifest_failed", str(retry_exc), redactor)
        if cleanup_status == "failed":
            status = "cleanup_failed"
        elif runtime_classification is not None or upload_failed:
            status = "infrastructure_failed"
        else:
            status = "passed"
        return CandidateOutcome(status, manifest_path, self.events)

    def _cleanup_status(self, case, redactor):
        if case["cleanup"] == "not_required":
            return "not_required"
        try:
            run_id = self.env["FLATKEY_QA_RUN_ID"]
            identity_seed = base64.b64decode(self.env["FLATKEY_QA_IDENTITY_SEED_B64"], validate=True)
            identity = derive_identity(identity_seed, run_id)
            result = self.cleanup_runner.run(identity)
        except Exception as exc:
            self._event("cleanup_failed", str(exc), redactor)
            return "failed"
        return "failed" if result.cleanup_failed else "passed"

    def _event(self, kind, message, redactor):
        self.events.append({"kind": kind, "message": _sanitize_diagnostic(message, redactor)})


class _CandidateInfrastructureError(RuntimeError):
    pass


class CandidateGcsArtifactUploader:
    def __init__(
        self,
        *,
        bucket,
        run_id,
        fingerprint,
        attempt_id,
        runtime_root,
        token_provider,
        upload_func=upload_gcs_object,
        max_total_bytes=supervisor.MAX_GCS_ARTIFACT_TOTAL_BYTES,
    ):
        self.bucket = bucket
        self.run_id = run_id
        self.fingerprint = fingerprint
        self.attempt_id = attempt_id
        self.runtime_root = os.path.realpath(runtime_root)
        self.token_provider = token_provider
        self.upload_func = upload_func
        self.max_total_bytes = max_total_bytes

    def upload(self, manifest_path, artifact_paths):
        if not _safe_gcs_bucket(self.bucket) or not _safe_run_id(self.run_id) or not FINGERPRINT_RE.fullmatch(self.fingerprint) or not _safe_attempt_id(self.attempt_id):
            raise ValueError("unsafe candidate gcs prefix")
        ordered = self._validated_artifacts(manifest_path, artifact_paths)
        access_token = self.token_provider()
        uploaded = []
        prefix = f"runs/{self.run_id}/candidates/{self.fingerprint[7:19]}/{self.attempt_id}"
        for logical_path, real_path, content_type in ordered:
            with open(real_path, "rb") as handle:
                data = handle.read()
            uploaded.append(self.upload_func(self.bucket, f"{prefix}/{logical_path}", data, content_type, access_token))
        return {"uploaded": uploaded}

    def _validated_artifacts(self, manifest_path, artifact_paths):
        manifest = _validated_candidate_artifact_path(self.runtime_root, manifest_path)
        ordered = []
        seen_logical = set()
        seen_real = set()
        total = 0
        for path in artifact_paths:
            logical, real, content_type = _validated_candidate_artifact_path(self.runtime_root, path)
            if logical == manifest[0]:
                continue
            if logical in seen_logical or real in seen_real:
                raise ValueError("duplicate artifact path")
            seen_logical.add(logical)
            seen_real.add(real)
            total += os.path.getsize(real)
            ordered.append((logical, real, content_type))
        if manifest[0] in seen_logical or manifest[1] in seen_real:
            raise ValueError("duplicate artifact path")
        total += os.path.getsize(manifest[1])
        if total > self.max_total_bytes:
            raise ValueError("artifact upload too large")
        ordered.append(manifest)
        return ordered


def parse_candidate_payload(env, *, redactor=None, config=None):
    redactor = redactor or Redactor()
    config = config or validate_candidate_config(env)
    encoded = env.get("BROWSER_QA_CANDIDATE_B64")
    if not isinstance(encoded, str) or not encoded:
        raise ValueError("BROWSER_QA_CANDIDATE_B64 is required")
    if len(encoded.encode("ascii", "ignore")) > MAX_CANDIDATE_B64_BYTES:
        raise ValueError("candidate payload is too large")
    if not re.fullmatch(r"[A-Za-z0-9_-]+", encoded) or "=" in encoded:
        raise ValueError("candidate payload must be canonical base64url")
    padded = encoded + "=" * (-len(encoded) % 4)
    try:
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
    except (binascii.Error, UnicodeEncodeError) as exc:
        raise ValueError("candidate payload must be canonical base64url") from exc
    if base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=") != encoded:
        raise ValueError("candidate payload must be canonical base64url")
    if len(raw) > fixed_cases.MAX_CASE_BYTES:
        raise ValueError("candidate payload is too large")
    try:
        payload = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError("candidate payload must be json") from exc
    if not isinstance(payload, dict) or set(payload) != PAYLOAD_FIELDS:
        raise ValueError("candidate payload has invalid fields")
    if payload["schema_version"] != 1:
        raise ValueError("candidate payload schema invalid")
    if payload["kind"] not in promotion.KINDS:
        raise ValueError("candidate kind invalid")
    if not isinstance(payload["fingerprint"], str) or not FINGERPRINT_RE.fullmatch(payload["fingerprint"]):
        raise ValueError("candidate fingerprint invalid")
    if not isinstance(payload["case_id"], str) or not fixed_cases.ID_RE.fullmatch(payload["case_id"]):
        raise ValueError("candidate case id invalid")
    target_url = promotion._normalize_target_url(payload["target_url"])
    proposed_case = promotion._semantic_proposed_case(payload["proposed_case"])
    if not _origin_allowed(proposed_case["start"]["origin"], config) or _url_origin(target_url) not in _allowed_origin_values(config):
        raise ValueError("candidate origin mismatch")
    expected = promotion.canonical_fingerprint(payload["kind"], target_url, proposed_case)
    if not _constant_equal(payload["fingerprint"], expected):
        raise ValueError("candidate fingerprint mismatch")
    case = fixed_cases.validate_case(payload["case"])
    materialized = _materialize_candidate_case(
        kind=payload["kind"],
        proposed_case=proposed_case,
        fingerprint=payload["fingerprint"],
        case_id=payload["case_id"],
        config=config,
    )
    if _canonical_json(case) != _canonical_json(materialized):
        raise ValueError("candidate case binding mismatch")
    _reject_untrusted_urls_and_secrets(materialized, env)
    return {
        "schema_version": 1,
        "kind": payload["kind"],
        "target_url": target_url,
        "proposed_case": proposed_case,
        "fingerprint": payload["fingerprint"],
        "case_id": payload["case_id"],
        "case": materialized,
    }


def validate_candidate_config(env):
    _validate_candidate_env_keys(env)
    run_id = _validate_run_id(env.get("FLATKEY_QA_RUN_ID"))
    bucket = _validate_gcs_bucket(env.get("FLATKEY_BROWSER_QA_GCS_BUCKET"))
    attempt_id = _validate_attempt_id(env.get("BROWSER_QA_ATTEMPT_ID"))
    website_origin = _validate_exact_origin(env.get("FLATKEY_QA_WEBSITE_ORIGIN"), "https://staging-website.flatkey.ai")
    console_origin = _validate_exact_origin(env.get("FLATKEY_QA_CONSOLE_ORIGIN"), "https://staging-console.flatkey.ai")
    docs_origin = env.get("FLATKEY_QA_DOCS_ORIGIN")
    if docs_origin not in {None, "", "https://docs.flatkey.ai"}:
        raise ValueError("candidate docs origin invalid")
    broker_url = env.get("FLATKEY_BROWSER_QA_BROKER_URL")
    if broker_url not in {None, ""}:
        _validate_broker_url(broker_url)
    _validate_chromium_stderr_limit(env.get("FLATKEY_BROWSER_QA_CHROMIUM_STARTUP_STDERR_BYTES"))
    return {
        "run_id": run_id,
        "bucket": bucket,
        "attempt_id": attempt_id,
        "FLATKEY_QA_WEBSITE_ORIGIN": website_origin,
        "FLATKEY_QA_CONSOLE_ORIGIN": console_origin,
    }


def _validate_candidate_env_keys(env):
    unknown = sorted(
        key for key in env
        if isinstance(key, str)
        and key.startswith(RELATED_ENV_PREFIXES)
        and key not in ALLOWED_CANDIDATE_ENV_KEYS
    )
    if unknown:
        raise ValueError("candidate env contains unsupported related keys")


def _materialize_candidate_case(*, kind, proposed_case, fingerprint, case_id, config):
    source = {
        "run_id": config["run_id"],
        "finding_fingerprint": fingerprint,
        "evidence_uri": f"gs://{config['bucket']}/runs/{config['run_id']}/candidates/{fingerprint[7:19]}/{config['attempt_id']}/manifest.json",
    }
    case = {
        "schema_version": 1,
        "id": case_id,
        "kind": "coverage_baseline" if kind == "coverage" else "bug_regression",
        "name": f"Candidate {case_id}",
        "enabled": True,
        "severity": "low" if kind == "coverage" else "medium",
        "owner": "browser-qa",
        "fixture": copy.deepcopy(proposed_case["fixture"]),
        "start": copy.deepcopy(proposed_case["start"]),
        "steps": copy.deepcopy(proposed_case["steps"]),
        "assertions": copy.deepcopy(proposed_case["assertions"]),
        "evidence": {"screenshot_on_failure": True, "capture_console": True, "capture_network": True},
        "cleanup": proposed_case["cleanup"],
        "source": source,
        "promotion": {"state": "ready_for_review", "attempts_required": 3, "attempts_passed": 3},
    }
    fixed_cases.validate_case(case)
    return case


def _canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def _origin_allowed(origin, env):
    origins = {
        "staging_website": env.get("FLATKEY_QA_WEBSITE_ORIGIN"),
        "staging_console": env.get("FLATKEY_QA_CONSOLE_ORIGIN"),
    }
    allowed = origins.get(origin)
    return isinstance(allowed, str) and _trusted_staging_origin(allowed)


def _allowed_origin_values(env):
    return {
        origin.rstrip("/")
        for origin in (env.get("FLATKEY_QA_WEBSITE_ORIGIN"), env.get("FLATKEY_QA_CONSOLE_ORIGIN"))
        if isinstance(origin, str) and _trusted_staging_origin(origin)
    }


def _url_origin(value):
    parsed = urllib.parse.urlsplit(value)
    return urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "", "", "")).rstrip("/")


def _trusted_staging_origin(value):
    if not isinstance(value, str):
        return False
    parsed = urllib.parse.urlsplit(value)
    return parsed.scheme == "https" and parsed.netloc in {"staging-website.flatkey.ai", "staging-console.flatkey.ai"} and parsed.path in {"", "/"} and not parsed.query and not parsed.fragment


def _validate_exact_origin(value, expected):
    if value != expected:
        raise ValueError("candidate env origin invalid")
    return value


def _validate_run_id(value):
    if not _safe_run_id(value):
        raise ValueError("candidate run id invalid")
    return value


def _validate_gcs_bucket(value):
    if not _safe_gcs_bucket(value):
        raise ValueError("candidate gcs bucket invalid")
    return value


def _safe_gcs_bucket(value):
    return isinstance(value, str) and GCS_BUCKET_RE.fullmatch(value) is not None and ".." not in value


def _validate_broker_url(value):
    parsed = urllib.parse.urlsplit(value)
    if (
        parsed.scheme != "https"
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or parsed.path not in {"", "/"}
        or not RUN_APP_HOST_RE.fullmatch(parsed.netloc)
    ):
        raise ValueError("candidate broker url invalid")
    return value


def _validate_chromium_stderr_limit(value):
    if value in {None, ""}:
        return 0
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("candidate chromium stderr limit invalid") from exc
    if parsed < 0:
        raise ValueError("candidate chromium stderr limit invalid")
    return parsed


def _reject_untrusted_urls_and_secrets(value, env):
    allowed_origins = {
        env.get("FLATKEY_QA_WEBSITE_ORIGIN"),
        env.get("FLATKEY_QA_CONSOLE_ORIGIN"),
    }
    allowed_origins = {origin.rstrip("/") for origin in allowed_origins if isinstance(origin, str)}
    for text in _walk_strings(value):
        if SECRET_RE.search(text):
            raise ValueError("candidate contains sensitive content")
        parsed = urllib.parse.urlsplit(text)
        if parsed.scheme in {"http", "https"}:
            origin = urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, "", "", "")).rstrip("/")
            if origin not in allowed_origins:
                raise ValueError("candidate url origin is not allowed")


def _walk_strings(value):
    if isinstance(value, dict):
        for child in value.values():
            yield from _walk_strings(child)
    elif isinstance(value, list):
        for child in value:
            yield from _walk_strings(child)
    elif isinstance(value, str):
        yield value


def _redactor_from_env(env):
    secrets = [
        env.get("CODEX_API_KEY", ""),
        env.get("FLATKEY_QA_GMAIL_BASE", ""),
        env.get("BROWSER_QA_CANDIDATE_B64", ""),
    ]
    return Redactor(extra_secrets=secrets)


def _sanitize_diagnostic(message, redactor):
    cleaned = redactor.clean(str(message))
    return SECRET_RE.sub("[REDACTED_SECRET]", cleaned)


def _validate_attempt_id(value):
    if not _safe_attempt_id(value):
        raise ValueError("candidate attempt id invalid")
    return value


def _safe_attempt_id(value):
    return isinstance(value, str) and ATTEMPT_ID_RE.fullmatch(value) is not None and ".." not in value


def _safe_run_id(value):
    return isinstance(value, str) and value.isascii() and value.isdecimal() and 1 <= len(value) <= 32


def _constant_equal(left, right):
    return len(left) == len(right) and hashlib.sha256(left.encode()).digest() == hashlib.sha256(right.encode()).digest()


def _candidate_manifest(*, fingerprint, case_id, attempt_id, result, cleanup_status, runtime_classification, redactor):
    if runtime_classification is not None and runtime_classification not in ALLOWED_RUNTIME_CLASSIFICATIONS:
        runtime_classification = "invalid_payload"
    manifest = {
        "schema_version": 1,
        "kind": "candidate_attempt",
        "fingerprint": fingerprint if isinstance(fingerprint, str) and FINGERPRINT_RE.fullmatch(fingerprint) else "sha256:" + "0" * 64,
        "case_id": case_id if isinstance(case_id, str) and fixed_cases.ID_RE.fullmatch(case_id) else "FQA-0000",
        "attempt_id": attempt_id if _safe_attempt_id(attempt_id) else "attempt-invalid",
        "result": redactor.clean(result),
        "cleanup": {"status": cleanup_status if cleanup_status in {"passed", "not_required", "failed"} else "failed"},
        "runtime": {"classification": runtime_classification},
    }
    _validate_candidate_manifest(manifest)
    return manifest


def _validate_candidate_manifest(manifest):
    if set(manifest) != {"schema_version", "kind", "fingerprint", "case_id", "attempt_id", "result", "cleanup", "runtime"}:
        raise ValueError("candidate manifest invalid")
    if manifest["schema_version"] != 1 or manifest["kind"] != "candidate_attempt":
        raise ValueError("candidate manifest invalid")
    if not FINGERPRINT_RE.fullmatch(manifest["fingerprint"]):
        raise ValueError("candidate manifest invalid")
    if not fixed_cases.ID_RE.fullmatch(manifest["case_id"]) or not _safe_attempt_id(manifest["attempt_id"]):
        raise ValueError("candidate manifest invalid")
    report._validate_fixed_case_result(manifest["result"], 0)
    if set(manifest["cleanup"]) != {"status"} or manifest["cleanup"]["status"] not in {"passed", "not_required", "failed"}:
        raise ValueError("candidate manifest invalid")
    classification = manifest["runtime"].get("classification") if isinstance(manifest["runtime"], dict) else "bad"
    if set(manifest["runtime"]) != {"classification"} or (classification is not None and classification not in ALLOWED_RUNTIME_CLASSIFICATIONS):
        raise ValueError("candidate manifest invalid")


def _empty_candidate_result(case_id, attempt_id):
    return {
        "status": "failed",
        "case_id": case_id if isinstance(case_id, str) and fixed_cases.ID_RE.fullmatch(case_id) else "FQA-0000",
        "attempt_id": attempt_id if _safe_attempt_id(attempt_id) else "attempt-invalid",
        "evidence_dir": f"{case_id if isinstance(case_id, str) and fixed_cases.ID_RE.fullmatch(case_id) else 'FQA-0000'}/{attempt_id if _safe_attempt_id(attempt_id) else 'attempt-invalid'}",
        "steps": [],
        "assertions": [],
        "failure": {"phase": "start", "index": None, "code": "navigation_failed", "evidence": {}},
    }


def _collect_candidate_artifacts(runtime_root):
    candidates = ["browser/console.jsonl", "browser/network.jsonl"]
    screenshots_dir = os.path.join(runtime_root, "screenshots")
    if os.path.isdir(screenshots_dir) and not os.path.islink(screenshots_dir):
        for name in sorted(os.listdir(screenshots_dir)):
            candidates.append(f"screenshots/{name}")
    candidates.append("manifest.json")
    return [item for item in candidates if os.path.exists(os.path.join(runtime_root, *item.split("/")))]


def _validated_candidate_artifact_path(runtime_root, path):
    logical = supervisor._normalize_artifact_logical_path(path)
    if not _allowed_candidate_artifact(logical):
        raise ValueError("unexpected candidate artifact name")
    runtime_real = os.path.realpath(runtime_root)
    supervisor._reject_symlinked_artifact_components(runtime_real, logical)
    filesystem_path = os.path.join(runtime_real, *logical.split("/"))
    real = os.path.realpath(filesystem_path)
    if not real.startswith(runtime_real + os.sep):
        raise ValueError("artifact outside runtime root")
    if not os.path.isfile(real):
        raise ValueError("artifact must be a regular file")
    return logical, real, supervisor._artifact_content_type(logical)


def _allowed_candidate_artifact(logical):
    if logical in {"manifest.json", "browser/console.jsonl", "browser/network.jsonl"}:
        return True
    if logical.startswith("screenshots/") and logical.count("/") == 1:
        return supervisor.SAFE_SCREENSHOT_NAME.fullmatch(logical.split("/", 1)[1]) is not None
    return False


def _payload_fingerprint_from_env(env, *, config=None):
    try:
        return parse_candidate_payload(env, config=config)["fingerprint"]
    except Exception:
        return "sha256:" + "0" * 64


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv:
        raise SystemExit(2)
    env = os.environ
    runtime_root = env.get("FLATKEY_BROWSER_QA_RUNTIME_ROOT") or tempfile.mkdtemp(prefix="flatkey-browser-qa-candidate-")
    gcp = GcpClient()

    def uploader_factory(*, config, fingerprint):
        return CandidateGcsArtifactUploader(
            bucket=config["bucket"],
            run_id=config["run_id"],
            fingerprint=fingerprint,
            attempt_id=config["attempt_id"],
            runtime_root=runtime_root,
            token_provider=gcp.access_token,
        )

    job = CandidateJob(
        env=env,
        runtime_root=runtime_root,
        browser_factory=supervisor.ChromiumRuntime,
        evidence_helper_factory=supervisor.BrowserEvidenceHelperProcess,
        cleanup_runner=CleanupRunner(StagingApiClient(env.get("FLATKEY_QA_CONSOLE_ORIGIN", ""))),
        uploader_factory=uploader_factory,
        popen_factory=subprocess.Popen,
    )
    outcome = job.run()
    return 0 if outcome.status == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
