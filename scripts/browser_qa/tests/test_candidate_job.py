import base64
import json
import os
import tempfile
import unittest
from unittest import mock

from scripts.browser_qa.flatkey_browser_qa.cleanup import CleanupResult
from scripts.browser_qa.flatkey_browser_qa import candidate_job
from scripts.browser_qa.flatkey_browser_qa import promotion


def proposed_case(*, origin="staging_console", cleanup="not_required"):
    return {
        "fixture": "anonymous",
        "start": {"origin": origin, "path": "/register"},
        "steps": [{"navigate": {"path": "/register"}}],
        "assertions": [{"page_status_not": 500}],
        "cleanup": cleanup,
    }


def fixed_case(case_id="FQA-0001", *, origin="staging_console", cleanup="not_required", fingerprint=None, attempt_id="attempt-0001"):
    fingerprint = fingerprint or promotion.canonical_fingerprint(
        "coverage",
        "https://staging-console.flatkey.ai/register",
        proposed_case(origin=origin, cleanup=cleanup),
    )
    return {
        "schema_version": 1,
        "id": case_id,
        "kind": "coverage_baseline",
        "name": f"Candidate {case_id}",
        "enabled": True,
        "severity": "low",
        "owner": "browser-qa",
        "fixture": "anonymous",
        "start": {"origin": origin, "path": "/register"},
        "steps": [{"navigate": {"path": "/register"}}],
        "assertions": [{"page_status_not": 500}],
        "evidence": {"screenshot_on_failure": True, "capture_console": True, "capture_network": True},
        "cleanup": cleanup,
        "source": {
            "run_id": "12345",
            "finding_fingerprint": fingerprint,
            "evidence_uri": f"gs://browser-qa/runs/12345/candidates/{fingerprint[7:19]}/{attempt_id}/manifest.json",
        },
        "promotion": {"state": "ready_for_review", "attempts_required": 3, "attempts_passed": 3},
    }


def b64(payload):
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def fixed_case_result(case_id="FQA-0001", attempt_id="attempt-0001", status="passed"):
    failure = None
    if status == "failed":
        failure = {
            "phase": "assertion",
            "index": 0,
            "assertion": "page_status_not",
            "code": "assertion_failed",
            "evidence": {"console": [], "network": []},
        }
    return {
        "status": status,
        "case_id": case_id,
        "attempt_id": attempt_id,
        "evidence_dir": f"{case_id}/{attempt_id}",
        "steps": [{"index": 0, "action": "navigate", "status": "passed"}],
        "assertions": [] if status == "failed" else [{"index": 0, "assertion": "page_status_not", "status": "passed"}],
        "failure": failure,
    }


class FakeBrowser:
    cdp_endpoint = "http://127.0.0.1:9222"

    def __init__(self):
        self.started = False
        self.stopped = False

    def start(self):
        self.started = True
        return self

    def stop(self):
        self.stopped = True


class FakeHelper:
    def __init__(self, *, browser, runtime_root, redactor, popen_factory=None, docs_proxy_url=None):
        self.browser = browser
        self.runtime_root = runtime_root
        self.redactor = redactor
        self.started = False
        self.stopped = False
        self.flushed = False

    def start(self):
        self.started = True
        return self

    def execute_fixed_case(self, *, case, attempt, evidence_dir):
        return fixed_case_result(case["id"], attempt["id"])

    def flush(self):
        self.flushed = True
        return {
            "console": [{"type": "log", "text": "browser diagnostic"}],
            "network": [{"url": "https://staging-console.flatkey.ai/api?trace=probe", "method": "GET", "status": 200}],
        }

    def stop(self):
        self.stopped = True


class FakeCleanup:
    def __init__(self, result):
        self.result = result
        self.calls = []

    def run(self, identity):
        self.calls.append(identity)
        return self.result


class FakeUploader:
    def __init__(self):
        self.uploaded = []

    def upload(self, manifest_path, artifact_paths):
        self.uploaded.append((manifest_path, list(artifact_paths)))
        return {"ok": True}


class FakeProxy:
    def __init__(self, calls):
        self.calls = calls

    def start(self):
        self.calls.append("proxy.start")

    def stop(self):
        self.calls.append("proxy.stop")


def env_for(payload, *, attempt_id="attempt-0001"):
    return {
        "BROWSER_QA_CANDIDATE_B64": b64(payload),
        "BROWSER_QA_ATTEMPT_ID": attempt_id,
        "FLATKEY_QA_RUN_ID": "12345",
        "FLATKEY_QA_IDENTITY_SEED_B64": "c2VlZC13aXRoLTMyLWJ5dGVzLW1pbmltdW0tdmFsdWU=",
        "FLATKEY_QA_GMAIL_BASE": "owner@example.com",
        "FLATKEY_QA_WEBSITE_ORIGIN": "https://staging-website.flatkey.ai",
        "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai",
        "FLATKEY_BROWSER_QA_GCS_BUCKET": "browser-qa",
    }


class CandidateJobTests(unittest.TestCase):
    def valid_payload(self, *, kind="coverage", target_url="https://staging-console.flatkey.ai/register", case_id="FQA-0001", proposed=None, case=None, attempt_id="attempt-0001"):
        proposed = proposed or proposed_case()
        fingerprint = promotion.canonical_fingerprint(kind, target_url, proposed)
        case = case or fixed_case(case_id=case_id, origin=proposed["start"]["origin"], cleanup=proposed["cleanup"], fingerprint=fingerprint, attempt_id=attempt_id)
        return {
            "schema_version": 1,
            "kind": kind,
            "target_url": target_url,
            "proposed_case": proposed,
            "fingerprint": fingerprint,
            "case_id": case_id,
            "case": case,
        }

    def run_job(self, *, payload=None, attempt_id="attempt-0001", helper_factory=FakeHelper, cleanup=None, uploader=None, browser_factory=None, proxy_factory=None, fixed_case_runner_factory=None, env_overrides=None):
        tmp = tempfile.mkdtemp()
        payload = payload or self.valid_payload(attempt_id=attempt_id)
        env = env_for(payload, attempt_id=attempt_id)
        if env_overrides:
            env.update(env_overrides)
        uploader = uploader or FakeUploader()
        cleanup = cleanup or FakeCleanup(CleanupResult(0, False, False, False, "not required"))
        job = candidate_job.CandidateJob(
            env=env,
            runtime_root=tmp,
            browser_factory=browser_factory or (lambda **_kwargs: FakeBrowser()),
            evidence_helper_factory=helper_factory,
            cleanup_runner=cleanup,
            uploader=uploader,
            popen_factory=lambda *_args, **_kwargs: None,
            proxy_factory=proxy_factory or (lambda: FakeProxy([])),
            fixed_case_runner_factory=fixed_case_runner_factory or candidate_job.FixedCaseRunner,
        )
        outcome = job.run()
        return outcome, tmp, uploader, cleanup

    def test_valid_payload_runs_one_fixed_case_writes_bound_manifest_uploads_candidate_prefix_and_never_starts_codex(self):
        case = fixed_case()
        payload = self.valid_payload(case=case)

        helper_calls = []

        class RecordingHelper(FakeHelper):
            def execute_fixed_case(self, *, case, attempt, evidence_dir):
                helper_calls.append((case["id"], dict(attempt), os.path.realpath(evidence_dir), case["source"]["evidence_uri"]))
                return fixed_case_result(case["id"], attempt["id"])

        outcome, tmp, uploader, cleanup = self.run_job(payload=payload, helper_factory=RecordingHelper)
        self.assertEqual(outcome.status, "passed")
        with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest, {
            "schema_version": 1,
            "kind": "candidate_attempt",
            "fingerprint": payload["fingerprint"],
            "case_id": "FQA-0001",
            "attempt_id": "attempt-0001",
            "result": fixed_case_result("FQA-0001", "attempt-0001"),
            "cleanup": {"status": "not_required"},
            "runtime": {"classification": None},
        })
        self.assertEqual(helper_calls, [(
            "FQA-0001",
            {"id": "attempt-0001", "retry": 0},
            os.path.realpath(os.path.join(tmp, "fixed-cases")),
            f"gs://browser-qa/runs/12345/candidates/{payload['fingerprint'][7:19]}/attempt-0001/manifest.json",
        )])
        self.assertEqual(uploader.uploaded, [("manifest.json", ["browser/console.jsonl", "browser/network.jsonl", "manifest.json"])])
        self.assertEqual(len(cleanup.calls), 0)
        self.assertFalse(hasattr(candidate_job.CandidateJob, "_start_codex"))

    def test_rejects_unsafe_candidate_env_before_proxy_browser_helper_or_runner_side_effects(self):
        bad_envs = [
            {"FLATKEY_QA_RUN_ID": "../bad"},
            {"FLATKEY_QA_RUN_ID": "１２３"},
            {"FLATKEY_BROWSER_QA_GCS_BUCKET": "../bucket"},
            {"FLATKEY_BROWSER_QA_GCS_BUCKET": "Bad_Bucket"},
            {"BROWSER_QA_ATTEMPT_ID": "../attempt"},
        ]
        for env_overrides in bad_envs:
            calls = []

            def browser_factory(**_kwargs):
                calls.append("browser.factory")
                return FakeBrowser()

            def helper_factory(**kwargs):
                calls.append("helper.factory")
                return FakeHelper(**kwargs)

            def runner_factory(*_args, **_kwargs):
                calls.append("runner.factory")
                raise AssertionError("runner must not be constructed")

            with self.subTest(env=env_overrides):
                outcome, tmp, _uploader, _cleanup = self.run_job(
                    env_overrides=env_overrides,
                    browser_factory=browser_factory,
                    helper_factory=helper_factory,
                    proxy_factory=lambda: FakeProxy(calls),
                    fixed_case_runner_factory=runner_factory,
                )
                self.assertEqual(outcome.status, "infrastructure_failed")
                self.assertEqual(calls, [])
                with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
                    manifest = json.load(handle)
                self.assertEqual(manifest["runtime"]["classification"], "invalid_payload")

    def test_rejects_malformed_oversize_noncanonical_unknown_and_unsafe_payload_values(self):
        case = fixed_case()
        valid = self.valid_payload(case=case)
        bad_envs = [
            {"BROWSER_QA_CANDIDATE_B64": "%%%"},
            {"BROWSER_QA_CANDIDATE_B64": b64(valid) + "="},
            {"BROWSER_QA_CANDIDATE_B64": "A" * (candidate_job.MAX_CANDIDATE_B64_BYTES + 1)},
            {"BROWSER_QA_CANDIDATE_B64": b64({**valid, "extra": True})},
            {"BROWSER_QA_CANDIDATE_B64": b64({**valid, "attempt_id": "attempt-0001"})},
            {"BROWSER_QA_CANDIDATE_B64": b64({**valid, "case_id": "bad"})},
            {"BROWSER_QA_CANDIDATE_B64": b64({**valid, "fingerprint": "sha256:" + "0" * 64})},
            {"BROWSER_QA_ATTEMPT_ID": "../attempt"},
        ]
        for env_overrides in bad_envs:
            with self.subTest(env=env_overrides):
                outcome, tmp, _uploader, _cleanup = self.run_job(payload=valid, env_overrides=env_overrides)
                self.assertEqual(outcome.status, "infrastructure_failed")
                with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
                    manifest = json.load(handle)
                self.assertIsNotNone(manifest["runtime"]["classification"])

    def test_rejects_tampered_kind_target_proposed_case_and_materialized_case(self):
        valid = self.valid_payload()
        changed_proposed = {**valid["proposed_case"], "steps": [{"navigate": {"path": "/settings"}}]}
        changed_case = json.loads(json.dumps(valid["case"]))
        changed_case["id"] = "FQA-9999"
        payloads = [
            {**valid, "kind": "finding"},
            {**valid, "target_url": "https://staging-console.flatkey.ai/settings"},
            {**valid, "proposed_case": changed_proposed},
            {**valid, "case": changed_case},
        ]
        for payload in payloads:
            with self.subTest(payload=payload):
                outcome, tmp, _uploader, _cleanup = self.run_job(payload=payload)
                self.assertEqual(outcome.status, "infrastructure_failed")
                with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
                    manifest = json.load(handle)
                self.assertEqual(manifest["runtime"]["classification"], "invalid_payload")

    def test_candidate_fingerprint_matches_promotion_canonical_fingerprint_directly(self):
        payload = self.valid_payload()

        parsed = candidate_job.parse_candidate_payload(env_for(payload))

        self.assertEqual(
            parsed["fingerprint"],
            promotion.canonical_fingerprint(payload["kind"], payload["target_url"], payload["proposed_case"]),
        )

    def test_rejects_unknown_related_env_and_non_staging_origin_values(self):
        payload = self.valid_payload()
        bad_envs = [
            {"FLATKEY_QA_EXTRA_TOKEN": "not-secret-but-unknown"},
            {"FLATKEY_BROWSER_QA_MODE": "candidate"},
            {"BROWSER_QA_DEBUG": "1"},
            {"FLATKEY_QA_CONSOLE_ORIGIN": "https://console.flatkey.ai"},
            {"FLATKEY_QA_WEBSITE_ORIGIN": "https://flatkey.ai"},
        ]
        for env_overrides in bad_envs:
            with self.subTest(env=env_overrides):
                outcome, tmp, _uploader, _cleanup = self.run_job(payload=payload, env_overrides=env_overrides)
                self.assertEqual(outcome.status, "infrastructure_failed")
                with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
                    manifest = json.load(handle)
                self.assertEqual(manifest["runtime"]["classification"], "invalid_payload")

        inherited_env = {
            "PATH": os.environ.get("PATH", ""),
            "HOME": os.path.expanduser("~"),
            "CODEX_API_KEY": "codex-api-key-redacted",
            "FLATKEY_QA_DOCS_ORIGIN": "https://docs.flatkey.ai",
            "FLATKEY_BROWSER_QA_BROKER_URL": "https://flatkey-staging-browser-qa-broker-abc-uw.a.run.app/",
            "FLATKEY_BROWSER_QA_CHROMIUM_STARTUP_STDERR_BYTES": "8192",
            "FLATKEY_BROWSER_QA_EXECUTION_ID": "exec-1",
        }
        outcome, _tmp, _uploader, _cleanup = self.run_job(payload=payload, env_overrides=inherited_env)
        self.assertEqual(outcome.status, "passed")

    def test_rejects_origin_mismatch_production_url_and_secret_shape(self):
        cases = [
            fixed_case(),
            fixed_case(),
            fixed_case(),
        ]
        cases[0]["start"] = {**cases[0]["start"], "origin": "docs"}
        cases[1]["source"] = {**cases[1]["source"], "evidence_uri": "gs://browser-qa/runs/12345/main/exec-1/manifest.json?token=secret"}
        cases[2]["steps"] = [{"fill": {"locator": {"by": "label", "label": "Password"}, "value": "password=probe-secret"}}]
        for case in cases:
            with self.subTest(case=case):
                outcome, _tmp, _uploader, _cleanup = self.run_job(payload=self.valid_payload(case=case))
                self.assertEqual(outcome.status, "infrastructure_failed")

    def test_classifies_helper_browser_and_business_failures_without_secret_leakage(self):
        class FailingHelper(FakeHelper):
            def start(self):
                raise RuntimeError("helper failed password=helper-secret")

        outcome, tmp, _uploader, _cleanup = self.run_job(helper_factory=FailingHelper)
        self.assertEqual(outcome.status, "infrastructure_failed")
        with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["runtime"]["classification"], "browser_helper_failed")
        self.assertNotIn("helper-secret", json.dumps(manifest))
        self.assertNotIn("helper-secret", json.dumps(outcome.events))

        class FailingBrowser(FakeBrowser):
            def start(self):
                raise RuntimeError("browser failed password=browser-secret")

        outcome, tmp, _uploader, _cleanup = self.run_job(browser_factory=lambda **_kwargs: FailingBrowser())
        self.assertEqual(outcome.status, "infrastructure_failed")
        with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["runtime"]["classification"], "browser_failed")
        self.assertNotIn("browser-secret", json.dumps(manifest))
        self.assertNotIn("browser-secret", json.dumps(outcome.events))

        def failing_proxy_factory():
            proxy = FakeProxy([])
            proxy.start = mock.Mock(side_effect=RuntimeError("proxy failed password=proxy-secret"))
            return proxy

        outcome, tmp, _uploader, _cleanup = self.run_job(proxy_factory=failing_proxy_factory)
        self.assertEqual(outcome.status, "infrastructure_failed")
        with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["runtime"]["classification"], "proxy_failed")
        self.assertNotIn("proxy-secret", json.dumps(manifest))
        self.assertNotIn("proxy-secret", json.dumps(outcome.events))

        def failing_browser_factory(**_kwargs):
            raise RuntimeError("browser factory failed password=browser-factory-secret")

        outcome, tmp, _uploader, _cleanup = self.run_job(browser_factory=failing_browser_factory)
        self.assertEqual(outcome.status, "infrastructure_failed")
        with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["runtime"]["classification"], "browser_failed")
        self.assertNotIn("browser-factory-secret", json.dumps(manifest))
        self.assertNotIn("browser-factory-secret", json.dumps(outcome.events))

        def failing_runner_factory(*_args, **_kwargs):
            raise RuntimeError("runner failed password=runner-secret")

        outcome, tmp, _uploader, _cleanup = self.run_job(fixed_case_runner_factory=failing_runner_factory)
        self.assertEqual(outcome.status, "infrastructure_failed")
        with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["runtime"]["classification"], "fixed_case_infrastructure_failed")
        self.assertNotIn("runner-secret", json.dumps(manifest))
        self.assertNotIn("runner-secret", json.dumps(outcome.events))

        class BusinessFailureHelper(FakeHelper):
            def execute_fixed_case(self, *, case, attempt, evidence_dir):
                return fixed_case_result(case["id"], attempt["id"], "failed")

        outcome, tmp, _uploader, _cleanup = self.run_job(helper_factory=BusinessFailureHelper)
        self.assertEqual(outcome.status, "passed")
        with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["result"]["status"], "failed")
        self.assertIsNone(manifest["runtime"]["classification"])

    def test_rewrites_upload_failed_manifest_and_retries_manifest_only_to_candidate_prefix(self):
        class FailFirstUploader(FakeUploader):
            def upload(self, manifest_path, artifact_paths):
                self.uploaded.append((manifest_path, list(artifact_paths)))
                if len(self.uploaded) == 1:
                    raise RuntimeError("upload failed password=upload-secret")
                return {"ok": True}

        uploader = FailFirstUploader()
        outcome, tmp, uploader, _cleanup = self.run_job(uploader=uploader)

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(uploader.uploaded, [
            ("manifest.json", ["browser/console.jsonl", "browser/network.jsonl", "manifest.json"]),
            ("manifest.json", ["manifest.json"]),
        ])
        with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["runtime"]["classification"], "upload_failed")
        self.assertNotIn("upload-secret", json.dumps(manifest))
        self.assertNotIn("upload-secret", json.dumps(outcome.events))

    def test_candidate_gcs_uploader_uses_exact_prefix_and_rejects_bad_artifacts(self):
        calls = []
        with tempfile.TemporaryDirectory() as tmp:
            os.makedirs(os.path.join(tmp, "browser"))
            for logical in ["browser/console.jsonl", "browser/network.jsonl", "manifest.json"]:
                with open(os.path.join(tmp, *logical.split("/")), "w", encoding="utf-8") as handle:
                    handle.write("{}\n")
            uploader = candidate_job.CandidateGcsArtifactUploader(
                bucket="browser-qa",
                run_id="12345",
                fingerprint="sha256:" + "a" * 64,
                attempt_id="attempt-0001",
                runtime_root=tmp,
                token_provider=lambda: "token",
                upload_func=lambda bucket, object_name, data, content_type, token: calls.append((bucket, object_name, content_type, token)),
            )
            uploader.upload("manifest.json", ["browser/console.jsonl", "browser/network.jsonl", "manifest.json"])
            self.assertEqual([call[1] for call in calls], [
                "runs/12345/candidates/aaaaaaaaaaaa/attempt-0001/browser/console.jsonl",
                "runs/12345/candidates/aaaaaaaaaaaa/attempt-0001/browser/network.jsonl",
                "runs/12345/candidates/aaaaaaaaaaaa/attempt-0001/manifest.json",
            ])
            with self.assertRaises(ValueError):
                uploader.upload("manifest.json", ["result.json", "manifest.json"])

    def test_main_invalid_config_writes_invalid_payload_manifest_without_starting_runtime(self):
        with tempfile.TemporaryDirectory() as tmp:
            payload = self.valid_payload()
            env = env_for(payload)
            env["FLATKEY_BROWSER_QA_RUNTIME_ROOT"] = tmp
            env["FLATKEY_QA_RUN_ID"] = "../bad"
            with mock.patch.dict(os.environ, env, clear=True), mock.patch.object(candidate_job, "GcpClient"):
                status = candidate_job.main([])

            self.assertEqual(status, 1)
            with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["runtime"]["classification"], "invalid_payload")


if __name__ == "__main__":
    unittest.main()
