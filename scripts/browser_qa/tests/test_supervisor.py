import json
import importlib.metadata
import os
import signal
import subprocess
import socket
import sys
import tempfile
import tomllib
import unittest
from unittest import mock
import io
import urllib.request

from scripts.browser_qa.flatkey_browser_qa.cleanup import CleanupResult
from scripts.browser_qa.flatkey_browser_qa import control_mcp
from scripts.browser_qa.flatkey_browser_qa import mcp_budget_wrapper
from scripts.browser_qa.flatkey_browser_qa import supervisor


class FakeClock:
    def __init__(self):
        self.now = 100.0

    def monotonic(self):
        return self.now

    def time(self):
        return 1700000000

    def advance(self, seconds):
        self.now += seconds


class ReadableAfterCloseStringIO(io.StringIO):
    def close(self):
        self.closed_flag = True


class BrokenPipeOnWriteStringIO(io.StringIO):
    def __init__(self, message):
        super().__init__()
        self.message = message

    def write(self, _value):
        raise BrokenPipeError(self.message)


class FakeProcess:
    def __init__(self, returncode=0, stdout="", stderr="", finish_after=0, write_result=None, on_communicate=None):
        self.returncode = returncode
        self.stdout = io.StringIO(stdout)
        self.stderr = io.StringIO(stderr)
        self.finish_after = finish_after
        self.write_result = write_result
        self.on_communicate = on_communicate
        self.terminated = False
        self.killed = False
        self.communicated_input = None
        self.stdin = ReadableAfterCloseStringIO()
        self.wait_calls = 0
        self.wait_timeouts = []

    def poll(self):
        return self.returncode if self.wait_calls >= self.finish_after else None

    def wait(self, timeout=None):
        self.wait_timeouts.append(timeout)
        self.wait_calls += 1
        if self.wait_calls >= self.finish_after:
            return self.returncode
        raise TimeoutError("still running")

    def terminate(self):
        self.terminated = True
        self.returncode = -15

    def kill(self):
        self.killed = True

    def communicate(self, input=None, timeout=None):
        raise AssertionError("supervisor must stream stdout/stderr instead of communicate()")

    def finish_streams(self):
        if self.on_communicate:
            self.on_communicate()
        if self.write_result:
            self.write_result()


class RecordingThread:
    join_timeouts = []
    clock = None
    elapsed = 0.0

    def __init__(self, target):
        self.target = target
        self.started = False
        self._alive = False

    def start(self):
        self.started = True
        self._alive = True

    def join(self, timeout=None):
        self.join_timeouts.append(timeout)
        if isinstance(timeout, (int, float)):
            self.elapsed += timeout
            if self.clock is not None:
                self.clock.advance(timeout)

    def is_alive(self):
        return self._alive


class FakeSubprocess:
    def __init__(self, process):
        self.process = process
        self.calls = []
        self.run_calls = []

    def popen(self, args, **kwargs):
        self.calls.append((args, kwargs))
        return self.process

    def run(self, args, **kwargs):
        self.run_calls.append((args, kwargs))
        executable = os.path.basename(args[0])
        return FakeVersionProcess(f"{executable} 1.0.0\n")


class FakeVersionProcess:
    def __init__(self, text):
        self.stdout = text
        self.stderr = ""
        self.returncode = 0


class FakeVersionRunner:
    PIPE = subprocess.PIPE
    DEVNULL = subprocess.DEVNULL

    def __init__(self, process, versions=None):
        self.process = process
        self.calls = []
        self.run_calls = []
        self.versions = versions or {}

    def popen(self, args, **kwargs):
        self.calls.append((args, kwargs))
        return self.process

    def run(self, args, **kwargs):
        self.run_calls.append((args, kwargs))
        key = tuple(args)
        value = self.versions.get(key)
        if isinstance(value, BaseException):
            raise value
        if value is None:
            value = f"{os.path.basename(args[0])} 1.0.0"
        return FakeVersionProcess(value)


class RecordingPopenFactory:
    def __init__(self):
        self.calls = []
        self.run_calls = []

    def __call__(self, args, **kwargs):
        self.calls.append((args, kwargs))
        process = FakeProcess(0)
        process.pid = 4321 + len(self.calls)
        return process

    def run(self, args, **kwargs):
        self.run_calls.append((args, kwargs))
        executable = os.path.basename(args[0])
        return FakeVersionProcess(f"{executable} 1.0.0\n")


class FakeSignals:
    SIGTERM = signal.SIGTERM
    SIGINT = signal.SIGINT

    def __init__(self):
        self.handlers = {}
        self.installed = []

    def signal(self, signum, handler):
        previous = self.handlers.get(signum, "previous")
        self.handlers[signum] = handler
        self.installed.append((signum, handler))
        return previous


class FakeUploader:
    def __init__(self, fail=False):
        self.fail = fail
        self.uploaded = []

    def upload(self, manifest_path, artifact_paths):
        self.uploaded.append((manifest_path, list(artifact_paths)))
        if self.fail:
            raise RuntimeError("Authorization: Bearer sk-uploadSECRET")
        return {"uploaded": True}


class DefiniteFailUploader:
    def __init__(self):
        self.attempted = []
        self.cloud_objects = []

    def upload(self, manifest_path, artifact_paths):
        self.attempted.append((manifest_path, list(artifact_paths)))
        raise RuntimeError("definite manifest upload failure")


class FakeStatusResponse:
    status = 200

    def __init__(self, payload):
        self.payload = payload

    def read(self, _limit=-1):
        return json.dumps(self.payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class FakeStatusOpener:
    def __init__(self, response):
        self.response = response
        self.requests = []

    def open(self, request, timeout=0):
        self.requests.append((request, timeout))
        return self.response


class FakeCleanup:
    def __init__(self, result=None):
        self.result = result or CleanupResult(0, True, True, False, "cleanup verified")
        self.calls = []

    def run(self, identity):
        self.calls.append(identity)
        return self.result


class FakeResourceGuard:
    def __init__(self, *, checkpoint_captured=False, capture_error=None, verify_error=None):
        self.checkpoint_captured = checkpoint_captured
        self.capture_error = capture_error
        self.verify_error = verify_error
        self.capture_calls = []
        self.verify_calls = []

    def capture(self, identity):
        self.capture_calls.append(identity)
        if self.capture_error is not None:
            raise self.capture_error
        self.checkpoint_captured = True

    def verify(self, identity):
        self.verify_calls.append(identity)
        if self.verify_error is not None:
            raise self.verify_error


class FakeProxy:
    def __init__(self):
        self.started = False
        self.stopped = False
        self.host = "127.0.0.1"
        self.port = 4567
        self.events = []

    def start(self):
        self.started = True
        return self

    def stop(self):
        self.stopped = True


class RecordingBrowserProcess:
    def __init__(self, *, returncode=None, stderr=b""):
        self.terminated = False
        self.killed = False
        self.wait_calls = 0
        self.returncode = returncode
        self.stderr = io.BytesIO(stderr)

    def poll(self):
        return self.returncode

    def wait(self, timeout=None):
        self.wait_calls += 1
        return 0 if self.returncode is None else self.returncode

    def terminate(self):
        self.terminated = True

    def kill(self):
        self.killed = True


class StopFailEvidenceSink:
    runtime_classification = None
    url = "http://127.0.0.1:1/runtime-evidence"

    def __init__(self, _redactor, **_kwargs):
        self.started = False

    def start(self):
        self.started = True

    def stop(self):
        raise RuntimeError("evidence sink stop failed")


class FakeBrowserEvidenceHelper:
    def __init__(self, *, browser, runtime_root, redactor, popen_factory, docs_proxy_url=None):
        self.browser = browser
        self.runtime_root = runtime_root
        self.redactor = redactor
        self.popen_factory = popen_factory
        self.docs_proxy_url = docs_proxy_url
        self.started = False
        self.stopped = False
        self.flushed = False

    def start(self):
        self.started = True
        return self

    def capture_screenshot(self, name):
        return f"screenshots/{name}.png"

    def register_sensitive_value(self, value):
        self.redactor.register_code(value)

    def flush(self):
        self.flushed = True
        return {
            "console": [{"type": "log", "text": "console secret sk-12345678"}],
            "network": [{
                "url": "https://staging-console.flatkey.ai/api?token=network-secret",
                "method": "POST",
                "status": 200,
                "timing": {"startTime": 1},
                "headers": {"cookie": "raw-cookie"},
            }],
        }

    def execute_fixed_case(self, *, case, attempt, evidence_dir):
        return fixed_case_result(case["id"], attempt["id"])

    def stop(self):
        self.stopped = True


def env():
    return {
        "CODEX_API_KEY": "sk-parentSECRET",
        "FLATKEY_QA_RUN_ID": "12345",
        "FLATKEY_QA_IDENTITY_SEED_B64": "c2VlZC13aXRoLTMyLWJ5dGVzLW1pbmltdW0tdmFsdWU=",
        "FLATKEY_QA_GMAIL_BASE": "owner@gmail.com",
        "FLATKEY_QA_WEBSITE_ORIGIN": "https://staging-website.flatkey.ai",
        "FLATKEY_QA_CONSOLE_ORIGIN": "https://staging-console.flatkey.ai",
        "FLATKEY_QA_DOCS_ORIGIN": "https://docs.flatkey.ai",
        "FLATKEY_BROWSER_QA_BROKER_URL": "https://flatkey-staging-browser-qa-broker-abc-uw.a.run.app/",
        "FLATKEY_BROWSER_QA_EXECUTION_ID": "exec-1",
    }


def valid_result(**overrides):
    payload = {
        "replay": {"status": "passed", "checkpoint_reached": True},
        "exploration": {"status": "passed", "actions_used": 0},
        "budgets": {"replay_seconds": 300, "exploration_seconds": 300, "max_actions": 30},
        "findings": [],
        "coverage_candidates": [],
        "fixed_cases": {"status": "not_started", "cases": []},
        "phase_trace": [],
    }
    payload.update(overrides)
    return payload


def fixed_case(case_id):
    return {
        "schema_version": 1,
        "id": case_id,
        "kind": "coverage_baseline",
        "name": f"{case_id} baseline",
        "enabled": True,
        "severity": "low",
        "owner": "browser-qa",
        "fixture": "anonymous",
        "start": {"origin": "staging_website", "path": "/"},
        "steps": [{"navigate": {"path": "/"}}],
        "assertions": [{"page_status_not": 500}],
        "evidence": {"screenshot_on_failure": True, "capture_console": True, "capture_network": True},
        "cleanup": "not_required",
        "source": {"run_id": "seed", "finding_fingerprint": "fp", "evidence_uri": "gs://bucket/object"},
        "promotion": {"state": "ready_for_review", "attempts_required": 3, "attempts_passed": 3},
    }


def fixed_case_result(case_id, attempt_id, status="passed"):
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


class RecordingFixedCaseRunner:
    def __init__(self, helper, *, evidence_dir, results=None, calls=None, fail_on=None):
        self.helper = helper
        self.evidence_dir = os.path.realpath(evidence_dir)
        self.results = results or {}
        self.calls = calls if calls is not None else []
        self.fail_on = fail_on

    def run(self, case, attempt):
        self.calls.append((self.helper, self.evidence_dir, case["id"], dict(attempt)))
        if self.fail_on == case["id"]:
            raise RuntimeError("runner protocol failed sk-runner-secret")
        return self.results.get(case["id"], fixed_case_result(case["id"], attempt["id"]))


class SupervisorTests(unittest.TestCase):
    def setUp(self):
        self._playwright_runtime = tempfile.TemporaryDirectory()
        self.addCleanup(self._playwright_runtime.cleanup)
        package_dir = os.path.join(self._playwright_runtime.name, "node_modules", "playwright")
        os.makedirs(package_dir)
        with open(os.path.join(package_dir, "package.json"), "w", encoding="utf-8") as handle:
            json.dump({"name": "playwright", "version": "1.50.0"}, handle)
        self._playwright_root_patch = mock.patch.object(supervisor, "PLAYWRIGHT_RUNTIME_ROOT", self._playwright_runtime.name)
        self._playwright_root_patch.start()
        self.addCleanup(self._playwright_root_patch.stop)

    def test_chromium_executable_uses_container_env_path_before_path_lookup(self):
        with tempfile.TemporaryDirectory() as runtime_root:
            executable = os.path.join(runtime_root, "chrome")
            with open(executable, "w", encoding="utf-8") as handle:
                handle.write("#!/bin/sh\n")
            os.chmod(executable, 0o755)
            with (
                mock.patch.dict(supervisor.os.environ, {"CHROMIUM_EXECUTABLE_PATH": executable}, clear=True),
                mock.patch.object(supervisor.shutil, "which", return_value=None),
            ):
                self.assertEqual(supervisor._chromium_executable(), executable)

    def test_chromium_executable_rejects_invalid_explicit_path_before_path_lookup(self):
        with tempfile.TemporaryDirectory() as runtime_root:
            fallback = os.path.join(runtime_root, "chromium")
            with open(fallback, "w", encoding="utf-8") as handle:
                handle.write("#!/bin/sh\n")
            os.chmod(fallback, 0o755)
            explicit = os.path.join(runtime_root, "missing-chrome")
            with (
                mock.patch.dict(supervisor.os.environ, {"CHROMIUM_EXECUTABLE_PATH": explicit}, clear=True),
                mock.patch.object(supervisor.shutil, "which", return_value=fallback),
            ):
                with self.assertRaisesRegex(RuntimeError, "CHROMIUM_EXECUTABLE_PATH"):
                    supervisor._chromium_executable()

    def test_prompt_file_declares_skill_policy_runtime_contract_and_forbidden_scope(self):
        prompt_path = os.path.join(os.path.dirname(__file__), "..", "config", "qa-prompt.md")
        with open(prompt_path, encoding="utf-8") as handle:
            prompt = handle.read()
        self.assertNotIn("Before taking any browser action, read", prompt)
        for required in [
            "$flatkey-new-user-onboarding",
            "staging-cloud-qa-policy.md",
            "run id",
            "core_body = recorded replay -> qa_replay_checkpoint (synchronously completes runtime fixed cases)",
            "core = core_body -> no exploration -> terminal cleanup/report",
            "normal = core_body -> qa_start_exploration -> bounded exploration -> terminal cleanup/report",
            "normal includes the complete core replay",
            "qa_replay_checkpoint",
            "qa_start_exploration",
            "core mode must not call qa_start_exploration",
            "normal mode must call qa_start_exploration exactly once after qa_replay_checkpoint succeeds",
            "Do not explore before qa_replay_checkpoint",
            "Do not register a second account",
            "Do not create an extra API key",
            "Use only the temporary account created by this replay",
            "Post-checkpoint exploration allows only navigation, read-only inspection, and non-submitting field, dialog, or client-side validation checks",
            "Do not submit, confirm, save, create, delete, resend, register, logout, or trigger any server state change after qa_replay_checkpoint",
            "Recorded replay and independent runtime cleanup are the only server-write exceptions",
            "form validation/repeat actions/loading states are limited to non-submitting client-side observation",
            "hypothesis queue",
            "5 minutes",
            "30 actions",
            "observe -> propose one reproducible hypothesis -> take the smallest low-risk action -> collect evidence",
            "replay-adjacent recovery/navigation",
            "form validation/repeat actions/loading states",
            "same-origin API/frontend exceptions",
            "locale/empty-state/UI consistency",
            "low-risk adjacent allowed paths",
            "browser/console.jsonl",
            "browser/network.jsonl",
            "environment observation/info",
            "production",
            "payment",
            "subscription",
            "invite",
            "admin",
            "global settings",
            "real model calls",
            "CAPTCHA",
            "runtime cleanup",
            "cookie-free docs",
            "proposed_case",
            "high confidence",
            "staging-only",
            "closed fixed-case dsl",
            "credential",
            "secret",
            "css",
            "xpath",
            "javascript",
            "shell",
            "file transfer",
            "arbitrary network",
        ]:
            self.assertIn(required.lower(), prompt.lower())
        self.assertNotIn(
            "core = complete recorded replay -> qa_replay_checkpoint -> no exploration -> runtime cleanup -> report",
            prompt.lower(),
        )
        self.assertNotIn(
            "normal = complete recorded replay -> qa_replay_checkpoint -> qa_start_exploration -> bounded exploration -> runtime cleanup -> report",
            prompt.lower(),
        )

    def test_runtime_prompt_injects_only_authorized_staging_origins_and_read_only_docs_origin(self):
        process = FakeProcess(0)

        self.run_supervisor(process, result_payload=valid_result())

        prompt = process.stdin.getvalue()
        runtime_prompt_prefix, rest = prompt.split("-----BEGIN TRUSTED STAGING CLOUD QA POLICY-----", 1)
        _policy, runtime_prompt_suffix = rest.split("-----END TRUSTED STAGING CLOUD QA POLICY-----", 1)
        runtime_prompt = runtime_prompt_prefix + runtime_prompt_suffix
        self.assertIn("Authorized staging website origin: https://staging-website.flatkey.ai", prompt)
        self.assertIn("Authorized staging console origin: https://staging-console.flatkey.ai", prompt)
        self.assertIn("Read-only cookie-free docs origin: https://docs.flatkey.ai", prompt)
        self.assertIn("Begin replay by navigating to the authorized staging website origin.", prompt)
        self.assertIn("core_body = recorded replay -> qa_replay_checkpoint (synchronously completes runtime fixed cases)", prompt)
        self.assertIn("core = core_body -> no exploration -> terminal cleanup/report", prompt)
        self.assertIn("normal = core_body -> qa_start_exploration -> bounded exploration -> terminal cleanup/report", prompt)
        self.assertIn("`qa_replay_checkpoint` takes no arguments", prompt)
        self.assertIn("`qa_start_exploration` takes no arguments", prompt)
        for forbidden in [
            r"call `qa_replay_checkpoint` with\b.*\brun id\b",
            r"call `qa_replay_checkpoint` with\b.*\bcurrent url\b",
            r"call `qa_start_exploration` with\b.*\brun id\b",
            r"call `qa_start_exploration` with\b.*\bcurrent url\b",
        ]:
            self.assertNotRegex(prompt.lower(), forbidden)
        self.assertNotIn("core = complete recorded replay -> qa_replay_checkpoint -> no exploration -> runtime cleanup -> report", prompt)
        self.assertNotIn("normal = complete recorded replay -> qa_replay_checkpoint -> qa_start_exploration -> bounded exploration -> runtime cleanup -> report", prompt)
        self.assertNotIn("https://flatkey.ai", runtime_prompt)
        self.assertNotIn("https://console.flatkey.ai", runtime_prompt)
        self.assertNotIn("https://router.flatkey.ai", runtime_prompt)

    def test_supervisor_normalizes_after_browser_evidence_before_public_result_and_manifest(self):
        denied_proxy = FakeProxy()
        denied_proxy.events = [{"host": "mixpanel.example:443", "status": 403, "reason": "denied"}]
        proxies = [denied_proxy, FakeProxy()]

        raw_finding = {
            "severity": "medium",
            "title": " Registration accepts weak confirmation state ",
            "target_url": "https://staging-console.flatkey.ai/register?email=secret#form",
            "steps": ["Open registration", "Submit form"],
            "expected": "The core registration flow should remain available.",
            "actual": "The page reported that mixpanel.example was blocked.",
            "evidence_paths": ["browser/network.jsonl"],
            "confidence": "high",
            "proposed_case": None,
        }
        duplicate = {
            **raw_finding,
            "title": "registration accepts weak confirmation state",
            "target_url": "https://staging-console.flatkey.ai/register?other=value#other",
        }

        outcome, sup = self.run_supervisor(
            FakeProcess(0),
            result_payload=valid_result(findings=[raw_finding, duplicate]),
            proxy_factory=lambda policy=None: proxies.pop(0),
        )

        self.assertEqual(outcome.status, "passed")
        self.assertTrue(os.path.exists(os.path.join(sup.runtime_root, "browser", "network.jsonl")))
        with open(os.path.join(sup.runtime_root, "result.json"), encoding="utf-8") as handle:
            result_payload = json.load(handle)
        with open(os.path.join(sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(len(result_payload["findings"]), 1)
        self.assertEqual(result_payload["findings"][0]["severity"], "info")
        self.assertEqual(
            result_payload["findings"][0]["target_url"],
            "https://staging-console.flatkey.ai/register",
        )
        self.assertEqual(manifest["result"], result_payload)

    def test_supervisor_maps_normalization_errors_to_invalid_result_infrastructure_failure(self):
        with mock.patch.object(supervisor.report, "normalize_findings", side_effect=supervisor.report.ResultValidationError("bad normalized result")):
            outcome, sup = self.run_supervisor(FakeProcess(0), result_payload=valid_result())

        self.assertEqual(outcome.status, "infrastructure_failed")
        with open(os.path.join(sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["infrastructure"]["classification"], "invalid_result")
        self.assertEqual(manifest["result"], valid_result(phase_trace=["finalization_started"]))

    def run_supervisor(self, process, *, result_payload=None, cleanup=None, uploader=None, preflight=None, clock=None, input_env=None, thread_factory=None, proxy_factory=None, subprocess_runner=None, resource_guard_factory=None, fixed_cases_loader=None, fixed_case_runner_factory=None, fixed_cases_dir=None):
        tmp = tempfile.mkdtemp()
        supervisor_kwargs = {}
        if thread_factory is not None:
            supervisor_kwargs["thread_factory"] = thread_factory
        if resource_guard_factory is not None:
            supervisor_kwargs["resource_guard_factory"] = resource_guard_factory
        if fixed_cases_loader is not None:
            supervisor_kwargs["fixed_cases_loader"] = fixed_cases_loader
        if fixed_case_runner_factory is not None:
            supervisor_kwargs["fixed_case_runner_factory"] = fixed_case_runner_factory
        if fixed_cases_dir is not None:
            supervisor_kwargs["fixed_cases_dir"] = fixed_cases_dir
        supervisor_kwargs["evidence_helper_factory"] = FakeBrowserEvidenceHelper
        supervisor_kwargs["browser_factory"] = lambda **_kwargs: type(
            "FakeBrowser",
            (),
            {"cdp_endpoint": "http://127.0.0.1:9222", "start": lambda self: self, "stop": lambda self: None},
        )()
        sup = supervisor.Supervisor(
            env=input_env or env(),
            runtime_root=tmp,
            subprocess_runner=subprocess_runner or FakeSubprocess(process),
            uploader=uploader or FakeUploader(),
            cleanup_runner=cleanup or FakeCleanup(),
            proxy_factory=proxy_factory or (lambda policy=None: FakeProxy()),
            preflight=preflight or (lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}}),
            clock=clock or FakeClock(),
            **supervisor_kwargs,
        )
        self._last_supervisor = sup
        outcome = sup.run(initial_result=result_payload)
        return outcome, sup

    def test_supervisor_hashes_installed_skill_and_passes_same_runtime_provenance_to_all_report_writes(self):
        calls = []
        version_runner = FakeVersionRunner(
            FakeProcess(0),
            versions={
                ("codex", "--version"): "codex 9.9.9\n",
                ("playwright-mcp", "--version"): "playwright-mcp 1.2.3\n",
                ("chromium", "--version"): "Chromium 123.0.0.0\n",
            },
        )

        def recording_write_report(*args, **kwargs):
            calls.append(kwargs)
            return original_write_report(*args, **kwargs)

        original_write_report = supervisor.report.write_report
        with mock.patch.object(supervisor.report, "write_report", recording_write_report), \
            mock.patch.object(supervisor.shutil, "which", lambda name, path=None: name):
            _outcome, sup = self.run_supervisor(
                FakeProcess(0),
                result_payload=valid_result(),
                uploader=FakeUploader(fail=True),
                input_env={**env(), "PATH": "C:\\tools"},
                proxy_factory=lambda policy=None: FakeProxy(),
                subprocess_runner=version_runner,
            )

        self.assertEqual(len(calls), 2)
        first = calls[0]["provenance"]
        self.assertIs(first, calls[1]["provenance"])
        self.assertEqual(first["skill_name"], "flatkey-new-user-onboarding")
        self.assertRegex(first["skill_content_sha256"], r"^[0-9a-f]{64}$")
        self.assertEqual(first["skill_content_sha256"], supervisor._hash_skill_tree(os.path.join(sup.home_dir, ".agents", "skills", "flatkey-new-user-onboarding")))
        self.assertEqual(first["model_config"], {"model": "gpt-5.4", "sandbox": "workspace-write", "network_access": False})
        self.assertEqual(first["codex_version"], "codex 9.9.9")
        self.assertEqual(first["playwright_mcp_version"], "playwright-mcp 1.2.3")
        self.assertEqual(first["playwright_package_version"], "1.50.0")
        self.assertEqual(first["chromium_version"], "Chromium 123.0.0.0")
        self.assertEqual([tuple(call[0]) for call in version_runner.run_calls], [
            ("codex", "--version"),
            ("playwright-mcp", "--version"),
            ("chromium", "--version"),
        ])

    def test_version_collection_uses_fixed_argv_bounded_env_and_failure_still_cleans_up_as_infrastructure(self):
        cleanup = FakeCleanup()
        version_runner = FakeVersionRunner(
            FakeProcess(0),
            versions={("codex", "--version"): RuntimeError("probe failed")},
        )
        calls = []

        def recording_write_report(*args, **kwargs):
            calls.append(kwargs)
            return original_write_report(*args, **kwargs)

        original_write_report = supervisor.report.write_report
        with mock.patch.object(supervisor.report, "write_report", recording_write_report), \
            mock.patch.object(supervisor.shutil, "which", lambda name, path=None: name):
            outcome, sup = self.run_supervisor(
                FakeProcess(0),
                result_payload=valid_result(),
                cleanup=cleanup,
                input_env={**env(), "PATH": "C:\\tools"},
                subprocess_runner=version_runner,
            )

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(len(cleanup.calls), 1)
        self.assertEqual(calls[0]["runtime_classification"], "provenance_failed")
        for args, kwargs in version_runner.run_calls:
            self.assertIn(tuple(args), {("codex", "--version"), ("playwright-mcp", "--version"), ("chromium", "--version")})
            self.assertEqual(kwargs["timeout"], supervisor.PROVENANCE_VERSION_TIMEOUT_SECONDS)
            self.assertEqual(kwargs["env"], {"PATH": "C:\\tools"})
            self.assertEqual(kwargs["stdin"], subprocess.DEVNULL)
            self.assertEqual(kwargs["stderr"], subprocess.DEVNULL)

    def test_runtime_provenance_preserves_path_from_os_environ_mapping(self):
        runner = FakeVersionRunner(
            FakeProcess(0),
            versions={
                ("codex", "--version"): "codex 9.9.9\n",
                ("playwright-mcp", "--version"): "playwright-mcp 1.2.3\n",
                ("chromium", "--version"): "Chromium 123.0.0.0\n",
            },
        )
        with tempfile.TemporaryDirectory() as skill_dir, \
            mock.patch.dict(supervisor.os.environ, {"PATH": "C:\\tools"}, clear=True):
            with open(os.path.join(skill_dir, "SKILL.md"), "w", encoding="utf-8") as handle:
                handle.write("# Skill\n")

            provenance = supervisor.collect_runtime_provenance(
                subprocess_runner=runner,
                env=supervisor.os.environ,
                skill_dir=skill_dir,
            )

        self.assertEqual(provenance["codex_version"], "codex 9.9.9")
        for _args, kwargs in runner.run_calls:
            self.assertEqual(kwargs["env"], {"PATH": "C:\\tools"})

    def test_playwright_package_version_reads_fixed_npm_package_json_when_python_distribution_is_absent(self):
        with tempfile.TemporaryDirectory() as tmp:
            package_dir = os.path.join(tmp, "node_modules", "playwright")
            os.makedirs(package_dir)
            with open(os.path.join(package_dir, "package.json"), "w", encoding="utf-8") as handle:
                json.dump({"name": "playwright", "version": "1.62.0-alpha-1783623505000"}, handle)

            self.assertEqual(
                supervisor._playwright_package_version(runtime_root=tmp),
                "1.62.0-alpha-1783623505000",
            )

    def test_playwright_package_version_ignores_ambient_python_distribution_metadata(self):
        with tempfile.TemporaryDirectory() as tmp:
            package_dir = os.path.join(tmp, "node_modules", "playwright")
            os.makedirs(package_dir)
            with open(os.path.join(package_dir, "package.json"), "w", encoding="utf-8") as handle:
                json.dump({"name": "playwright", "version": "1.62.0-alpha-1783623505000"}, handle)

            with mock.patch.object(importlib.metadata, "version", return_value="999.0.0") as metadata_version:
                self.assertEqual(
                    supervisor._playwright_package_version(runtime_root=tmp),
                    "1.62.0-alpha-1783623505000",
                )
            metadata_version.assert_not_called()

    def test_playwright_package_version_rejects_malformed_fixed_package_json_without_unrelated_fallbacks(self):
        cases = []
        with tempfile.TemporaryDirectory() as tmp:
            missing_root = tmp
            unrelated = os.path.join(tmp, "node_modules", "@playwright", "test")
            os.makedirs(unrelated)
            with open(os.path.join(unrelated, "package.json"), "w", encoding="utf-8") as handle:
                json.dump({"version": "9.9.9"}, handle)
            cases.append(missing_root)

            for payload in [
                {"name": "playwright", "version": ""},
                {"name": "playwright", "version": "bad\nversion"},
                {"name": "playwright", "version": "x" * (supervisor.MAX_PROVENANCE_VERSION_BYTES + 1)},
                {"name": "not-playwright", "version": "1.0.0"},
                {"version": "1.0.0"},
            ]:
                root = tempfile.mkdtemp()
                package_dir = os.path.join(root, "node_modules", "playwright")
                os.makedirs(package_dir)
                with open(os.path.join(package_dir, "package.json"), "w", encoding="utf-8") as handle:
                    json.dump(payload, handle)
                cases.append(root)

            bad_json_root = tempfile.mkdtemp()
            os.makedirs(os.path.join(bad_json_root, "node_modules", "playwright"))
            with open(os.path.join(bad_json_root, "node_modules", "playwright", "package.json"), "w", encoding="utf-8") as handle:
                handle.write("{not json")
            cases.append(bad_json_root)

            too_large_root = tempfile.mkdtemp()
            os.makedirs(os.path.join(too_large_root, "node_modules", "playwright"))
            with open(os.path.join(too_large_root, "node_modules", "playwright", "package.json"), "w", encoding="utf-8") as handle:
                handle.write(" " * 65537)
            cases.append(too_large_root)

            directory_root = tempfile.mkdtemp()
            os.makedirs(os.path.join(directory_root, "node_modules", "playwright", "package.json"))
            cases.append(directory_root)

            if hasattr(os, "symlink"):
                symlink_root = tempfile.mkdtemp()
                package_dir = os.path.join(symlink_root, "node_modules", "playwright")
                os.makedirs(package_dir)
                target = os.path.join(symlink_root, "target.json")
                with open(target, "w", encoding="utf-8") as handle:
                    json.dump({"name": "playwright", "version": "1.0.0"}, handle)
                try:
                    os.symlink(target, os.path.join(package_dir, "package.json"))
                except (OSError, NotImplementedError):
                    symlink_root = None
                if symlink_root is not None:
                    cases.append(symlink_root)

            for root in cases:
                with self.subTest(root=root):
                    with self.assertRaises(RuntimeError):
                        supervisor._playwright_package_version(runtime_root=root)

    def test_normal_run_uses_owner_only_codex_home_profile_schema_proxy_cleanup_upload_and_pops_api_key(self):
        process = FakeProcess(0)
        outcome, sup = self.run_supervisor(process, result_payload=valid_result())

        self.assertEqual(outcome.status, "passed")
        self.assertEqual(len(sup.cleanup_runner.calls), 1)
        self.assertEqual(len(sup.uploader.uploaded), 1)
        args, kwargs = sup.subprocess_runner.calls[0]
        self.assertIn("--strict-config", args)
        self.assertIn("--skip-git-repo-check", args)
        self.assertIn("--profile", args)
        self.assertIn("qa", args)
        self.assertNotIn("--ignore-user-config", args)
        self.assertIn("--output-last-message", args)
        last_message_path = args[args.index("--output-last-message") + 1]
        self.assertTrue(os.path.realpath(last_message_path).startswith(os.path.realpath(sup.runtime_root) + os.sep))
        self.assertFalse(os.path.exists(last_message_path))
        self.assertIn("--output-schema", args)
        self.assertIn("--sandbox", args)
        self.assertIn("workspace-write", args)
        self.assertIn("--model", args)
        self.assertIn("gpt-5.4", args)
        self.assertEqual(kwargs["env"]["CODEX_API_KEY"], "sk-parentSECRET")
        self.assertNotIn("HTTP_PROXY", kwargs["env"])
        self.assertNotIn("HTTPS_PROXY", kwargs["env"])
        self.assertNotIn("ALL_PROXY", kwargs["env"])
        self.assertIs(kwargs["stdin"], subprocess.PIPE)
        prompt = process.stdin.getvalue()
        self.assertIn("$flatkey-new-user-onboarding", prompt)
        self.assertIn("staging-cloud-qa-policy.md", prompt)
        self.assertIn("Run ID: 12345", prompt)
        self.assertIn("Disposable email:", prompt)
        self.assertIn("Disposable password:", prompt)
        self.assertNotIn("CODEX_API_KEY", prompt)
        self.assertNotIn("owner@gmail.com", config_text if "config_text" in locals() else "")
        self.assertNotIn("CODEX_API_KEY", sup.env)
        self.assertEqual(kwargs["env"]["HOME"], sup.home_dir)
        if os.name == "nt":
            self.assertEqual(kwargs["env"]["USERPROFILE"], sup.home_dir)
        skill_dir = os.path.join(sup.home_dir, ".agents", "skills", "flatkey-new-user-onboarding")
        self.assertTrue(os.path.isdir(skill_dir))
        self.assertFalse(os.path.realpath(skill_dir).startswith(os.path.realpath(kwargs["cwd"]) + os.sep))
        if os.name != "nt":
            self.assertEqual(oct(os.stat(sup.codex_home).st_mode & 0o777), "0o700")
        else:
            self.assertTrue(os.path.isdir(sup.codex_home))
        config_text = ""
        for path in [os.path.join(sup.codex_home, "config.toml"), os.path.join(sup.codex_home, "qa.config.toml")]:
            if os.name != "nt":
                self.assertEqual(oct(os.stat(path).st_mode & 0o777), "0o600")
            else:
                self.assertTrue(os.path.isfile(path))
            with open(path, encoding="utf-8") as handle:
                data = handle.read()
            config_text += data
        self.assertNotIn("proxy_bypass", config_text)
        with open(os.path.join(sup.codex_home, "config.toml"), encoding="utf-8") as handle:
            self.assertEqual(handle.read(), "")
        with open(os.path.join(sup.codex_home, "qa.config.toml"), encoding="utf-8") as handle:
            qa_config_text = handle.read()
        self.assertIn("network_access = false", qa_config_text)
        self.assertIn("[shell_environment_policy]", config_text)
        self.assertIn("inherit = \"none\"", config_text)
        self.assertIn("web_search = \"disabled\"", config_text)
        self.assertNotIn("[profiles.qa]", config_text)
        self.assertNotIn("config = \"qa.config.toml\"", config_text)
        self.assertNotIn("disable_response_storage", config_text)
        self.assertIn("FLATKEY_BROWSER_QA_RUNTIME_DIR", config_text)
        self.assertIn("FLATKEY_BROWSER_QA_BROKER_URL", config_text)
        playwright_env = config_text.split("[mcp_servers.playwright.env]", 1)[1].split("[mcp_servers.broker]", 1)[0]
        broker_env = config_text.split("[mcp_servers.broker.env]", 1)[1].split("[mcp_servers.control]", 1)[0]
        self.assertIn("FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL", playwright_env)
        self.assertIn("FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL", broker_env)
        control_env = config_text.split("[mcp_servers.control.env]", 1)[1].split("[sandbox_workspace_write]", 1)[0]
        self.assertIn("FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL", control_env)
        self.assertIn("qa_read_docs", config_text)
        self.assertIn("PATH", config_text)
        self.assertIn("PYTHONPATH", config_text)
        self.assertNotIn("${FLATKEY_BROWSER_QA_RUN_ID}", config_text)
        self.assertIn(sys.executable.replace("\\", "\\\\"), config_text)
        self.assertNotIn("owner+", config_text)
        self.assertNotIn(sup._identity.password, config_text)
        for data in [config_text]:
            self.assertNotIn("browser_evaluate", data)
            self.assertNotIn("plugins = false", data)

    def test_noninteractive_qa_preapproves_each_allowlisted_mcp_server(self):
        _, sup = self.run_supervisor(FakeProcess(0), result_payload=valid_result())

        with open(os.path.join(sup.codex_home, "qa.config.toml"), "rb") as handle:
            qa_config = tomllib.load(handle)

        mcp_servers = qa_config["mcp_servers"]
        expected_tools = {
            "playwright": [
                "browser_navigate",
                "browser_navigate_back",
                "browser_tabs",
                "browser_click",
                "browser_type",
                "browser_fill_form",
                "browser_select_option",
                "browser_snapshot",
                "browser_find",
                "browser_wait_for",
                "browser_console_messages",
                "browser_network_requests",
                "browser_network_request",
                "qa_read_docs",
            ],
            "evidence": ["qa_capture_screenshot"],
            "broker": ["get_current_verification_code"],
            "control": ["qa_replay_checkpoint", "qa_start_exploration"],
        }
        self.assertEqual(set(mcp_servers), set(expected_tools))
        for server_name, server_config in mcp_servers.items():
            with self.subTest(server=server_name):
                self.assertEqual(server_config["default_tools_approval_mode"], "approve")
                self.assertNotIn("*", server_config["enabled_tools"])
                self.assertEqual(server_config["enabled_tools"], expected_tools[server_name])

    def test_prompt_embeds_installed_policy_content_instead_of_requiring_model_file_reads(self):
        process = FakeProcess(0)
        _, sup = self.run_supervisor(process, result_payload=valid_result())

        args, kwargs = sup.subprocess_runner.calls[0]
        workspace = args[args.index("--cd") + 1]
        prompt = process.stdin.getvalue()
        self.assertIn("The runtime has already loaded the exact `staging-cloud-qa-policy.md` content below;", prompt)
        self.assertNotIn("Before taking any browser action, read", prompt)
        self.assertNotIn("read and follow the absolute `staging-cloud-qa-policy.md` file", prompt)
        policy_line = next(line for line in prompt.splitlines() if line.startswith("Policy: "))
        policy_path = policy_line.removeprefix("Policy: ")

        self.assertTrue(os.path.isabs(policy_path))
        self.assertTrue(os.path.isfile(policy_path))
        with open(policy_path, encoding="utf-8") as handle:
            policy = handle.read()
        self.assertIn("-----BEGIN TRUSTED STAGING CLOUD QA POLICY-----", prompt)
        self.assertIn(policy, prompt)
        self.assertIn("# Staging Cloud QA Policy", prompt)
        self.assertIn("Replay the recorded signup, email verification, starting credit, API key creation", prompt)
        self.assertIn("-----END TRUSTED STAGING CLOUD QA POLICY-----", prompt)
        self.assertTrue(
            os.path.realpath(policy_path).startswith(os.path.realpath(kwargs["env"]["HOME"]) + os.sep)
        )
        self.assertFalse(
            os.path.realpath(policy_path).startswith(os.path.realpath(workspace) + os.sep)
        )

    def test_supervisor_passes_explicit_manifest_identity_to_report_writer(self):
        original_write_report = supervisor.report.write_report
        calls = []

        def recording_write_report(*args, **kwargs):
            calls.append(kwargs)
            return original_write_report(*args, **kwargs)

        with mock.patch.object(supervisor.report, "write_report", recording_write_report):
            self.run_supervisor(FakeProcess(0), result_payload=valid_result())

        self.assertEqual(calls[0]["run_id"], "12345")
        self.assertEqual(calls[0]["execution_id"], "exec-1")

    def test_supervisor_accepts_stdlib_style_subprocess_runner_with_capital_popen(self):
        process = FakeProcess(0)

        class StdlibStyleRunner:
            def __init__(self):
                self.calls = []
                self.run_calls = []

            def Popen(self, args, **kwargs):
                self.calls.append((args, kwargs))
                return process

            def run(self, args, **kwargs):
                self.run_calls.append((args, kwargs))
                executable = os.path.basename(args[0])
                return FakeVersionProcess(f"{executable} 1.0.0\n")

        runner = StdlibStyleRunner()
        outcome, _sup = self.run_supervisor(
            process,
            result_payload=valid_result(),
            subprocess_runner=runner,
        )

        self.assertEqual(outcome.status, "passed")
        self.assertEqual(len(runner.calls), 1)
        self.assertEqual(runner.calls[0][0][1], "exec")

    def test_qa_config_uses_explicit_child_path_not_ambient_path(self):
        input_env = env()
        input_env["PATH"] = "C:\\explicit-tools"
        input_env["SystemRoot"] = "C:\\explicit-windows"

        with mock.patch.dict(supervisor.os.environ, {"PATH": "C:\\poison-tools", "SystemRoot": "C:\\poison-windows"}, clear=True):
            outcome, sup = self.run_supervisor(FakeProcess(0), result_payload=valid_result(), input_env=input_env)

        self.assertEqual(outcome.status, "passed")
        popen_env = sup.subprocess_runner.calls[0][1]["env"]
        self.assertEqual(popen_env["PATH"], "C:\\explicit-tools")
        self.assertEqual(popen_env["SystemRoot"], "C:\\explicit-windows")

        config_text = ""
        for path in [os.path.join(sup.codex_home, "config.toml"), os.path.join(sup.codex_home, "qa.config.toml")]:
            with open(path, encoding="utf-8") as handle:
                config_text += handle.read()
        self.assertIn('PATH = "C:\\\\explicit-tools"', config_text)
        self.assertNotIn("poison-tools", config_text)

    def test_qa_config_removes_builtin_screenshot_and_exposes_restricted_evidence_mcp(self):
        outcome, sup = self.run_supervisor(FakeProcess(0), result_payload=valid_result())

        self.assertEqual(outcome.status, "passed")
        with open(os.path.join(sup.codex_home, "qa.config.toml"), encoding="utf-8") as handle:
            config_text = handle.read()
        self.assertNotIn("browser_take_screenshot", config_text)
        self.assertIn("[mcp_servers.evidence]", config_text)
        self.assertIn("qa_capture_screenshot", config_text)

    def test_qa_profile_uses_flatkey_model_provider_without_secret_or_openai_fallback(self):
        outcome, sup = self.run_supervisor(FakeProcess(0), result_payload=valid_result())

        self.assertEqual(outcome.status, "passed")
        with open(os.path.join(sup.codex_home, "config.toml"), encoding="utf-8") as handle:
            self.assertEqual(handle.read(), "")
        with open(os.path.join(sup.codex_home, "qa.config.toml"), encoding="utf-8") as handle:
            config_text = handle.read()
        self.assertIn('model = "gpt-5.4"', config_text)
        self.assertIn('model_provider = "flatkey"', config_text)
        self.assertIn("[model_providers.flatkey]", config_text)
        self.assertIn('name = "Flatkey"', config_text)
        self.assertIn('base_url = "https://router.flatkey.ai/v1"', config_text)
        self.assertIn('env_key = "CODEX_API_KEY"', config_text)
        self.assertIn('wire_api = "responses"', config_text)
        self.assertIn("supports_websockets = false", config_text)
        self.assertNotIn("sk-parentSECRET", config_text)
        self.assertNotIn("api.openai.com", config_text)

    def test_core_mode_prompt_and_mcp_env_require_replay_only_without_exploration(self):
        input_env = env()
        input_env["FLATKEY_BROWSER_QA_MODE"] = "core"

        outcome, sup = self.run_supervisor(
            FakeProcess(0),
            result_payload=valid_result(exploration={"status": "not_started", "actions_used": 0}),
            input_env=input_env,
        )

        self.assertEqual(outcome.status, "passed")
        prompt = sup.subprocess_runner.process.stdin.getvalue()
        self.assertIn("Core mode", prompt)
        self.assertIn("qa_replay_checkpoint", prompt)
        self.assertIn("must not call qa_start_exploration", prompt)
        self.assertIn('"exploration": {"status": "not_started", "actions_used": 0}', prompt)
        with open(os.path.join(sup.codex_home, "qa.config.toml"), encoding="utf-8") as handle:
            config_text = handle.read()
        playwright_env = config_text.split("[mcp_servers.playwright.env]", 1)[1].split("[mcp_servers.evidence]", 1)[0]
        control_env = config_text.split("[mcp_servers.control.env]", 1)[1].split("[sandbox_workspace_write]", 1)[0]
        self.assertIn('FLATKEY_BROWSER_QA_MODE = "core"', playwright_env)
        self.assertIn('FLATKEY_BROWSER_QA_MODE = "core"', control_env)

    def test_supervisor_resource_drift_is_infrastructure_and_cleanup_still_runs(self):
        cleanup = FakeCleanup()
        guard = FakeResourceGuard(
            checkpoint_captured=True,
            verify_error=RuntimeError("exploration resource drift detected token 999"),
        )

        outcome, sup = self.run_supervisor(
            FakeProcess(0),
            result_payload=valid_result(),
            cleanup=cleanup,
            resource_guard_factory=lambda _origin: guard,
        )

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(len(guard.verify_calls), 1)
        self.assertIs(guard.verify_calls[0], sup._identity)
        self.assertEqual(len(cleanup.calls), 1)
        with open(os.path.join(sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["infrastructure"]["classification"], "exploration_resource_drift")
        self.assertNotIn("999", json.dumps(manifest["result"]))
        self.assertNotIn("999", json.dumps(outcome.events))

    def _notify_replay_checkpoint(self, sup, clock=None):
        clock = clock or FakeClock()

        def notify(event):
            request = urllib.request.Request(
                sup._evidence_url,
                data=json.dumps(event).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            urllib.request.urlopen(request, timeout=2).close()

        return control_mcp._replay_checkpoint(sup.runtime_root, clock, notify)

    def test_checkpoint_runs_enabled_fixed_cases_before_resource_baseline(self):
        order = []
        calls = []
        cases = [fixed_case("FQA-0001"), fixed_case("FQA-0002")]
        guard = FakeResourceGuard()

        def loader(directory):
            order.append(("load", directory))
            return cases

        def runner_factory(helper, *, evidence_dir):
            return RecordingFixedCaseRunner(helper, evidence_dir=evidence_dir, calls=calls)

        def checkpoint():
            order.append(("checkpoint", self._notify_replay_checkpoint(self._last_supervisor)))

        process = FakeProcess(0, on_communicate=checkpoint)
        outcome, sup = self.run_supervisor(
            process,
            result_payload=valid_result(),
            resource_guard_factory=lambda _origin: guard,
            fixed_cases_loader=loader,
            fixed_case_runner_factory=runner_factory,
            fixed_cases_dir="fixed-dir",
        )

        self.assertEqual(outcome.status, "passed")
        self.assertEqual([entry[0] for entry in sup.phase_trace], ["replay_done", "fixed_cases_done", "finalization_started"])
        self.assertEqual([call[2] for call in calls], ["FQA-0001", "FQA-0002"])
        self.assertEqual([call[3]["id"] for call in calls], ["run-12345", "run-12345"])
        self.assertTrue(all(call[0].__class__ is FakeBrowserEvidenceHelper for call in calls))
        self.assertTrue(all(call[1] == os.path.realpath(os.path.join(sup.runtime_root, "fixed-cases")) for call in calls))
        self.assertEqual(order, [("load", "fixed-dir"), ("checkpoint", {"status": "ok", "phase": "replay_checkpoint"})])
        self.assertEqual(len(guard.capture_calls), 1)
        self.assertEqual(sup.fixed_case_results["status"], "passed")
        self.assertEqual([case["case_id"] for case in sup.fixed_case_results["cases"]], ["FQA-0001", "FQA-0002"])

    def test_business_failed_fixed_case_is_aggregated_without_blocking_checkpoint(self):
        calls = []
        cases = [fixed_case("FQA-0001"), fixed_case("FQA-0002")]
        results = {"FQA-0001": fixed_case_result("FQA-0001", "run-12345", "failed")}

        def runner_factory(helper, *, evidence_dir):
            return RecordingFixedCaseRunner(helper, evidence_dir=evidence_dir, results=results, calls=calls)

        process = FakeProcess(0, on_communicate=lambda: self._notify_replay_checkpoint(self._last_supervisor))
        outcome, sup = self.run_supervisor(
            process,
            result_payload=valid_result(),
            resource_guard_factory=lambda _origin: FakeResourceGuard(),
            fixed_cases_loader=lambda _directory: cases,
            fixed_case_runner_factory=runner_factory,
        )

        self.assertEqual(outcome.status, "replay_failed")
        self.assertEqual([call[2] for call in calls], ["FQA-0001", "FQA-0002"])
        self.assertEqual(sup.fixed_case_results["status"], "failed")
        self.assertEqual([case["status"] for case in sup.fixed_case_results["cases"]], ["failed", "passed"])
        self.assertEqual(control_mcp.read_control_state(sup.runtime_root)["phase"], "replay_checkpoint")

    def test_supervisor_overwrites_model_fixed_cases_and_phase_trace_in_public_result(self):
        cases = [fixed_case("FQA-0001")]
        model_claim = valid_result(
            fixed_cases={"status": "passed", "cases": [{"status": "passed", "case_id": "MODEL"}]},
            phase_trace=["finalization_started"],
        )
        process = FakeProcess(0, on_communicate=lambda: self._notify_replay_checkpoint(self._last_supervisor))

        outcome, sup = self.run_supervisor(
            process,
            result_payload=model_claim,
            resource_guard_factory=lambda _origin: FakeResourceGuard(),
            fixed_cases_loader=lambda _directory: cases,
        )

        self.assertEqual(outcome.status, "passed")
        with open(os.path.join(sup.runtime_root, "result.json"), encoding="utf-8") as handle:
            result = json.load(handle)
        with open(os.path.join(sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(result["fixed_cases"]["status"], "passed")
        self.assertEqual(result["fixed_cases"]["cases"][0]["case_id"], "FQA-0001")
        self.assertEqual(result["phase_trace"], ["replay_done", "fixed_cases_done", "finalization_started"])
        self.assertEqual(manifest["result"]["fixed_cases"], result["fixed_cases"])
        self.assertEqual(manifest["result"]["phase_trace"], result["phase_trace"])

    def test_normal_manifest_writes_sanitized_qualified_candidate_bundles_and_core_writes_none(self):
        candidate = {
            "title": "注册页服务器错误",
            "target_url": "https://staging-console.flatkey.ai/register?trace=probe",
            "steps": ["Open register"],
            "expected": "No 500",
            "observed": "500",
            "business_value": "Catches regressions",
            "evidence_paths": ["browser/network.jsonl"],
            "confidence": "high",
            "mutates_state": False,
            "cleanup_requirement": "not_required",
            "proposed_case": {
                "fixture": "anonymous",
                "start": {"origin": "staging_console", "path": "/register"},
                "steps": [{"navigate": {"path": "/register"}}],
                "assertions": [{"page_status_not": 500}],
                "cleanup": "not_required",
            },
        }
        outcome, sup = self.run_supervisor(FakeProcess(0), result_payload=valid_result(coverage_candidates=[candidate]))
        self.assertEqual(outcome.status, "passed")
        with open(os.path.join(sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(len(manifest["candidates"]), 1)
        bundle = manifest["candidates"][0]
        self.assertEqual(bundle["schema_version"], 1)
        self.assertEqual(bundle["kind"], "coverage")
        self.assertRegex(bundle["fingerprint"], r"^sha256:[0-9a-f]{64}$")
        self.assertEqual(bundle["target_url"], "https://staging-console.flatkey.ai/register")
        self.assertEqual(bundle["proposed_case"], candidate["proposed_case"])
        self.assertNotIn("probe-secret", json.dumps(bundle))

        core_outcome, core_sup = self.run_supervisor(
            FakeProcess(0),
            result_payload=valid_result(
                exploration={"status": "not_started", "actions_used": 0},
                coverage_candidates=[candidate],
            ),
            input_env={**env(), "FLATKEY_BROWSER_QA_MODE": "core"},
        )
        self.assertEqual(core_outcome.status, "passed")
        with open(os.path.join(core_sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            core_manifest = json.load(handle)
        self.assertEqual(core_manifest["candidates"], [])

    def test_candidate_bundle_build_failure_is_visible_without_raw_model_or_secret_details(self):
        candidate = {
            "title": "candidate with sensitive model text password=model-secret",
            "target_url": "https://staging-console.flatkey.ai/register",
            "steps": ["Open register"],
            "expected": "No 500",
            "observed": "500",
            "business_value": "Catches regressions",
            "evidence_paths": ["browser/network.jsonl"],
            "confidence": "high",
            "mutates_state": False,
            "cleanup_requirement": "not_required",
            "proposed_case": {
                "fixture": "anonymous",
                "start": {"origin": "staging_console", "path": "/register"},
                "steps": [{"navigate": {"path": "/register"}}],
                "assertions": [{"page_status_not": 500}],
                "cleanup": "not_required",
            },
        }
        with mock.patch(
            "scripts.browser_qa.flatkey_browser_qa.supervisor.promotion.build_candidate_bundle",
            side_effect=ValueError("bundle failed password=exception-secret"),
        ):
            outcome, sup = self.run_supervisor(FakeProcess(0), result_payload=valid_result(coverage_candidates=[candidate]))

        self.assertEqual(outcome.status, "passed")
        with open(os.path.join(sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["candidates"], [])
        self.assertEqual(manifest["candidate_events"], [{"kind": "candidate_bundle_failed", "candidate_kind": "coverage"}])
        rendered = json.dumps({"candidate_events": manifest["candidate_events"], "candidates": manifest["candidates"]})
        self.assertNotIn("model-secret", rendered)
        self.assertNotIn("exception-secret", rendered)

    def test_supervisor_invalid_internal_phase_trace_fails_infrastructure_not_filtered(self):
        process = FakeProcess(0)

        outcome, sup = self.run_supervisor(process, result_payload=valid_result())
        sup.phase_trace[:] = [("finalization_started", 0), ("replay_done", 1)]

        payload = supervisor._with_trusted_result_contract(
            valid_result(),
            fixed_case_results=sup.fixed_case_results,
            phase_trace=sup.phase_trace,
        )

        with self.assertRaises(supervisor.report.ResultValidationError):
            supervisor.report.validate_result(payload)

    def test_empty_result_uses_runtime_budget_constants(self):
        self.assertEqual(
            supervisor._empty_result()["budgets"],
            {
                "replay_seconds": mcp_budget_wrapper.EXPLORATION_SECONDS,
                "exploration_seconds": mcp_budget_wrapper.EXPLORATION_SECONDS,
                "max_actions": mcp_budget_wrapper.EXPLORATION_MAX_ACTIONS,
            },
        )

    def test_trusted_result_contract_does_not_mask_unrelated_invalid_fields(self):
        payload = supervisor._with_trusted_result_contract(
            valid_result(replay={"status": "maybe", "checkpoint_reached": True}),
            fixed_case_results={"status": "passed", "cases": []},
            phase_trace=[("finalization_started", 0)],
        )

        with self.assertRaises(supervisor.report.ResultValidationError):
            supervisor.report.validate_result(payload)

    def test_supervisor_invalid_trusted_contract_falls_back_to_minimal_manifest(self):
        def poison_trusted_state():
            sup = self._last_supervisor
            sup.fixed_case_results = {"status": "passed", "cases": [{"bad": True}]}
            sup.phase_trace[:] = [("replay_done", 0), ("replay_done", 1)]

        process = FakeProcess(0, on_communicate=poison_trusted_state)

        outcome, sup = self.run_supervisor(process, result_payload=valid_result())

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertIn("trusted_result_contract_invalid", [event["kind"] for event in outcome.events])
        with open(os.path.join(sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["infrastructure"]["classification"], "invalid_result")
        self.assertEqual(manifest["result"], supervisor._empty_result())

    def test_fixed_case_infra_error_fails_checkpoint_without_state_or_attempt_reuse(self):
        calls = []
        errors = []
        cases = [fixed_case("FQA-0001"), fixed_case("FQA-0002")]

        def runner_factory(helper, *, evidence_dir):
            return RecordingFixedCaseRunner(helper, evidence_dir=evidence_dir, calls=calls, fail_on="FQA-0001")

        def checkpoint_twice():
            for _index in range(2):
                try:
                    self._notify_replay_checkpoint(self._last_supervisor)
                except control_mcp.ToolExecutionError as exc:
                    errors.append(str(exc))

        process = FakeProcess(0, on_communicate=checkpoint_twice)
        cleanup = FakeCleanup()
        outcome, sup = self.run_supervisor(
            process,
            result_payload=valid_result(),
            cleanup=cleanup,
            fixed_cases_loader=lambda _directory: cases,
            fixed_case_runner_factory=runner_factory,
        )

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(errors, ["replay checkpoint baseline unavailable", "replay checkpoint baseline unavailable"])
        self.assertIsNone(control_mcp.read_control_state(sup.runtime_root))
        self.assertEqual([call[2] for call in calls], ["FQA-0001"])
        self.assertEqual(sup.fixed_case_results, {"status": "not_started", "cases": []})
        self.assertEqual(len(cleanup.calls), 1)
        with open(os.path.join(sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["infrastructure"]["classification"], "fixed_case_checkpoint_failed")
        self.assertEqual([event["kind"] for event in outcome.events], ["fixed_case_checkpoint_failed"])
        self.assertNotIn("sk-runner-secret", json.dumps(outcome.events))

        loader_errors = []

        def failing_loader(_directory):
            raise RuntimeError("loader protocol failed sk-loader-secret")

        def checkpoint_loader_twice():
            for _index in range(2):
                try:
                    self._notify_replay_checkpoint(self._last_supervisor)
                except control_mcp.ToolExecutionError as exc:
                    loader_errors.append(str(exc))

        loader_process = FakeProcess(0, on_communicate=checkpoint_loader_twice)
        loader_cleanup = FakeCleanup()
        loader_outcome, loader_sup = self.run_supervisor(
            loader_process,
            result_payload=valid_result(),
            cleanup=loader_cleanup,
            fixed_cases_loader=failing_loader,
            fixed_case_runner_factory=runner_factory,
        )

        self.assertEqual(loader_outcome.status, "infrastructure_failed")
        self.assertEqual(loader_errors, ["replay checkpoint baseline unavailable", "replay checkpoint baseline unavailable"])
        self.assertIsNone(control_mcp.read_control_state(loader_sup.runtime_root))
        self.assertEqual(loader_sup.fixed_case_results, {"status": "not_started", "cases": []})
        self.assertEqual(len(loader_cleanup.calls), 1)
        with open(os.path.join(loader_sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            loader_manifest = json.load(handle)
        self.assertEqual(loader_manifest["infrastructure"]["classification"], "fixed_case_checkpoint_failed")
        self.assertEqual([event["kind"] for event in loader_outcome.events], ["fixed_case_checkpoint_failed"])
        self.assertNotIn("sk-loader-secret", json.dumps(loader_outcome.events))

    def test_no_enabled_fixed_cases_passes_and_captures_checkpoint(self):
        guard = FakeResourceGuard()
        process = FakeProcess(0, on_communicate=lambda: self._notify_replay_checkpoint(self._last_supervisor))

        outcome, sup = self.run_supervisor(
            process,
            result_payload=valid_result(),
            resource_guard_factory=lambda _origin: guard,
            fixed_cases_loader=lambda _directory: [],
        )

        self.assertEqual(outcome.status, "passed")
        self.assertEqual(sup.fixed_case_results, {"status": "passed", "cases": []})
        self.assertEqual([entry[0] for entry in sup.phase_trace], ["replay_done", "fixed_cases_done", "finalization_started"])
        self.assertEqual(len(guard.capture_calls), 1)

    def test_supervisor_phase_trace_core_and_normal_order_cleanup_only_at_finalization(self):
        cleanup = FakeCleanup()

        def core_checkpoint():
            self._notify_replay_checkpoint(self._last_supervisor)

        core_process = FakeProcess(0, on_communicate=core_checkpoint)
        _core_outcome, core_sup = self.run_supervisor(
            core_process,
            result_payload=valid_result(exploration={"status": "not_started", "actions_used": 0}),
            cleanup=cleanup,
            input_env={**env(), "FLATKEY_BROWSER_QA_MODE": "core"},
            resource_guard_factory=lambda _origin: FakeResourceGuard(),
            fixed_cases_loader=lambda _directory: [],
        )

        self.assertEqual([entry[0] for entry in core_sup.phase_trace], ["replay_done", "fixed_cases_done", "finalization_started"])
        self.assertEqual(len(cleanup.calls), 1)

        normal_cleanup = FakeCleanup()

        def normal_checkpoint_and_explore():
            current = self._last_supervisor
            self._notify_replay_checkpoint(current)
            control_mcp._start_exploration(current.runtime_root, FakeClock(), "normal")

        normal_process = FakeProcess(0, on_communicate=normal_checkpoint_and_explore)
        _normal_outcome, normal_sup = self.run_supervisor(
            normal_process,
            result_payload=valid_result(),
            cleanup=normal_cleanup,
            resource_guard_factory=lambda _origin: FakeResourceGuard(),
            fixed_cases_loader=lambda _directory: [],
        )

        self.assertEqual([entry[0] for entry in normal_sup.phase_trace], ["replay_done", "fixed_cases_done", "exploration_started", "finalization_started"])
        self.assertEqual(len(normal_cleanup.calls), 1)

    def test_live_supervisor_uses_control_markers_instead_of_model_checkpoint_claims(self):
        claimed = valid_result(
            replay={"status": "passed", "checkpoint_reached": True},
            exploration={"status": "passed", "actions_used": 9},
        )

        def write_last_message():
            args, _kwargs = runner.calls[0]
            path = args[args.index("--output-last-message") + 1]
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(claimed, handle)

        process = FakeProcess(
            0,
            stdout=json.dumps({
                "type": "item.completed",
                "item": {"type": "agent_message", "text": json.dumps(claimed)},
            }) + "\n",
            write_result=write_last_message,
        )
        runner = FakeSubprocess(process)

        outcome, sup = self.run_supervisor(process, subprocess_runner=runner)

        self.assertEqual(outcome.status, "replay_failed")
        with open(os.path.join(sup.runtime_root, "result.json"), encoding="utf-8") as handle:
            result = json.load(handle)
        self.assertEqual(result["replay"], {"status": "passed", "checkpoint_reached": False})
        self.assertEqual(result["exploration"], {"status": "not_started", "actions_used": 0})

    def test_live_supervisor_overwrites_model_budgets_before_validation(self):
        claimed = valid_result(
            budgets={"replay_seconds": 0, "exploration_seconds": 999, "max_actions": 999},
            replay={"status": "passed", "checkpoint_reached": True},
            exploration={"status": "passed", "actions_used": 4},
        )
        runner = FakeSubprocess(FakeProcess(0))

        def checkpoint_and_explore():
            self._notify_replay_checkpoint(self._last_supervisor)
            control_mcp._start_exploration(self._last_supervisor.runtime_root, FakeClock(), "normal")
            control_mcp.write_control_state(
                self._last_supervisor.runtime_root,
                {
                    "phase": "exploration",
                    "updated_at": 1700000000,
                    "monotonic_started_at": 100.0,
                    "actions_used": 4,
                },
            )

        def write_last_message():
            args, _kwargs = runner.calls[0]
            path = args[args.index("--output-last-message") + 1]
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(claimed, handle)

        process = FakeProcess(
            0,
            stdout=json.dumps({
                "type": "item.completed",
                "item": {"type": "agent_message", "text": json.dumps(claimed)},
            }) + "\n",
            on_communicate=checkpoint_and_explore,
            write_result=write_last_message,
        )
        runner.process = process

        outcome, sup = self.run_supervisor(
            process,
            subprocess_runner=runner,
            resource_guard_factory=lambda _origin: FakeResourceGuard(),
            fixed_cases_loader=lambda _directory: [],
        )

        self.assertEqual(outcome.status, "passed")
        with open(os.path.join(sup.runtime_root, "result.json"), encoding="utf-8") as handle:
            result = json.load(handle)
        with open(os.path.join(sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(result["budgets"], {"replay_seconds": 300, "exploration_seconds": 300, "max_actions": 30})
        self.assertEqual(manifest["result"]["budgets"], result["budgets"])
        self.assertEqual(result["replay"], {"status": "passed", "checkpoint_reached": True})
        self.assertEqual(result["exploration"], {"status": "passed", "actions_used": 4})
        self.assertEqual(result["findings"], [])
        self.assertNotIn("infrastructure", manifest)

    def test_live_supervisor_preserves_finding_when_optional_proposed_case_is_invalid(self):
        invalid_proposed_case = {
            "fixture": "anonymous",
            "start": {
                "origin": "staging_website",
                "path": "/_next/image?url=%2Fassets%2Fhero.png&w=828&q=75",
            },
            "steps": [],
            "assertions": [{"page_status_not": 400}],
            "cleanup": "not_required",
        }
        claimed = valid_result(
            replay={"status": "passed", "checkpoint_reached": True},
            exploration={"status": "passed", "actions_used": 1},
            findings=[{
                "severity": "high",
                "title": "Homepage hero image request returns 400",
                "target_url": "https://staging-website.flatkey.ai/",
                "steps": ["Open the staging homepage"],
                "expected": "The hero image should load.",
                "actual": "The image optimizer returned 400.",
                "evidence_paths": ["browser/network.jsonl"],
                "confidence": "high",
                "proposed_case": invalid_proposed_case,
            }],
            coverage_candidates=[{
                "title": "Cookie-free documentation entry is readable",
                "target_url": "https://docs.flatkey.ai/quickstart",
                "steps": ["Open the documentation entry"],
                "expected": "The documentation should be readable.",
                "observed": "The documentation was readable.",
                "business_value": "Protects onboarding documentation availability.",
                "evidence_paths": [],
                "confidence": "medium",
                "mutates_state": False,
                "cleanup_requirement": "not_required",
                "proposed_case": None,
            }],
        )
        runner = FakeSubprocess(FakeProcess(0))

        def checkpoint_and_explore():
            self._notify_replay_checkpoint(self._last_supervisor)
            control_mcp._start_exploration(self._last_supervisor.runtime_root, FakeClock(), "normal")
            control_mcp.write_control_state(
                self._last_supervisor.runtime_root,
                {
                    "phase": "exploration",
                    "updated_at": 1700000000,
                    "monotonic_started_at": 100.0,
                    "actions_used": 1,
                },
            )

        def write_last_message():
            args, _kwargs = runner.calls[0]
            path = args[args.index("--output-last-message") + 1]
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(claimed, handle)

        process = FakeProcess(
            0,
            stdout=json.dumps({
                "type": "item.completed",
                "item": {"type": "agent_message", "text": json.dumps(claimed)},
            }) + "\n",
            on_communicate=checkpoint_and_explore,
            write_result=write_last_message,
        )
        runner.process = process

        outcome, sup = self.run_supervisor(
            process,
            subprocess_runner=runner,
            resource_guard_factory=lambda _origin: FakeResourceGuard(),
            fixed_cases_loader=lambda _directory: [],
        )

        self.assertEqual(outcome.status, "findings_detected")
        with open(os.path.join(sup.runtime_root, "result.json"), encoding="utf-8") as handle:
            result = json.load(handle)
        with open(os.path.join(sup.runtime_root, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(result["replay"], {"status": "passed", "checkpoint_reached": True})
        self.assertEqual(result["exploration"], {"status": "passed", "actions_used": 1})
        self.assertEqual(len(result["findings"]), 1)
        self.assertIsNone(result["findings"][0]["proposed_case"])
        self.assertEqual(result["coverage_candidates"], [])
        self.assertNotIn("infrastructure", manifest)

    def test_live_normal_checkpoint_without_exploration_is_infrastructure_failed(self):
        claimed = valid_result(exploration={"status": "passed", "actions_used": 9})

        def mark_checkpoint():
            control_mcp.write_control_state(
                sup.runtime_root,
                {"phase": "replay_checkpoint", "updated_at": 1700000000},
            )

        def write_last_message():
            args, _kwargs = runner.calls[0]
            path = args[args.index("--output-last-message") + 1]
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(claimed, handle)

        process = FakeProcess(
            0,
            stdout=json.dumps({
                "type": "item.completed",
                "item": {"type": "agent_message", "text": json.dumps(claimed)},
            }) + "\n",
            on_communicate=mark_checkpoint,
            write_result=write_last_message,
        )
        runner = FakeSubprocess(process)
        tmp = tempfile.mkdtemp()
        sup = supervisor.Supervisor(
            env=env(),
            runtime_root=tmp,
            subprocess_runner=runner,
            uploader=FakeUploader(),
            cleanup_runner=FakeCleanup(),
            proxy_factory=lambda policy=None: FakeProxy(),
            preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
            clock=FakeClock(),
            evidence_helper_factory=FakeBrowserEvidenceHelper,
            browser_factory=lambda **_kwargs: type("FakeBrowser", (), {"cdp_endpoint": "http://127.0.0.1:9222", "start": lambda self: self, "stop": lambda self: None})(),
        )

        outcome = sup.run()

        self.assertEqual(outcome.status, "infrastructure_failed")
        with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
            manifest = json.load(handle)
        self.assertEqual(manifest["infrastructure"]["classification"], "exploration_not_started")
        self.assertEqual(manifest["result"]["exploration"], {"status": "not_started", "actions_used": 0})

    def test_output_last_message_file_is_private_parsed_and_removed_on_success_and_invalid_result(self):
        with tempfile.TemporaryDirectory() as tmp:
            valid_payload = valid_result()

            def write_last_message():
                args, _kwargs = sup.subprocess_runner.calls[0]
                path = args[args.index("--output-last-message") + 1]
                with open(path, "w", encoding="utf-8") as handle:
                    json.dump(valid_payload, handle)
                control_mcp.write_control_state(
                    tmp,
                    {
                        "phase": "exploration",
                        "updated_at": 1700000000,
                        "monotonic_started_at": 100.0,
                        "actions_used": 0,
                    },
                )

            process = FakeProcess(0, write_result=write_last_message)
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=tmp,
                subprocess_runner=FakeSubprocess(process),
                uploader=FakeUploader(),
                cleanup_runner=FakeCleanup(),
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                evidence_helper_factory=FakeBrowserEvidenceHelper,
                browser_factory=lambda **_kwargs: type("FakeBrowser", (), {"cdp_endpoint": "http://127.0.0.1:9222", "start": lambda self: self, "stop": lambda self: None})(),
            )
            outcome = sup.run()

            self.assertEqual(outcome.status, "passed")
            args, _kwargs = sup.subprocess_runner.calls[0]
            self.assertFalse(os.path.exists(args[args.index("--output-last-message") + 1]))

    def test_output_last_message_path_ignores_interim_agent_message_progress(self):
        with tempfile.TemporaryDirectory() as tmp:
            valid_payload = valid_result()

            def write_last_message():
                args, _kwargs = sup.subprocess_runner.calls[0]
                path = args[args.index("--output-last-message") + 1]
                with open(path, "w", encoding="utf-8") as handle:
                    json.dump(valid_payload, handle)
                control_mcp.write_control_state(
                    tmp,
                    {
                        "phase": "exploration",
                        "updated_at": 1700000000,
                        "monotonic_started_at": 100.0,
                        "actions_used": 0,
                    },
                )

            process = FakeProcess(
                0,
                stdout=json.dumps({
                    "type": "item.completed",
                    "item": {"type": "agent_message", "text": "正在检查页面状态"},
                }) + "\n",
                write_result=write_last_message,
            )
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=tmp,
                subprocess_runner=FakeSubprocess(process),
                uploader=FakeUploader(),
                cleanup_runner=FakeCleanup(),
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                evidence_helper_factory=FakeBrowserEvidenceHelper,
                browser_factory=lambda **_kwargs: type("FakeBrowser", (), {"cdp_endpoint": "http://127.0.0.1:9222", "start": lambda self: self, "stop": lambda self: None})(),
            )

            outcome = sup.run()

            self.assertEqual(outcome.status, "passed")
            self.assertTrue(any(
                event.get("kind") == "codex_event"
                and event.get("text", {}).get("item", {}).get("text") == "正在检查页面状态"
                for event in sup.events
            ))

        with tempfile.TemporaryDirectory() as tmp:
            def write_bad_last_message():
                args, _kwargs = sup.subprocess_runner.calls[0]
                path = args[args.index("--output-last-message") + 1]
                with open(path, "w", encoding="utf-8") as handle:
                    handle.write("{bad")

            process = FakeProcess(0, write_result=write_bad_last_message)
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=tmp,
                subprocess_runner=FakeSubprocess(process),
                uploader=FakeUploader(),
                cleanup_runner=FakeCleanup(),
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                evidence_helper_factory=FakeBrowserEvidenceHelper,
                browser_factory=lambda **_kwargs: type("FakeBrowser", (), {"cdp_endpoint": "http://127.0.0.1:9222", "start": lambda self: self, "stop": lambda self: None})(),
            )
            outcome = sup.run()

            self.assertEqual(outcome.status, "infrastructure_failed")
            args, _kwargs = sup.subprocess_runner.calls[0]
            self.assertFalse(os.path.exists(args[args.index("--output-last-message") + 1]))

    def test_output_last_message_path_is_precreated_private_before_codex_launch(self):
        checks = []
        outer = self

        class CheckingSubprocess(FakeSubprocess):
            def popen(self, args, **kwargs):
                path = args[args.index("--output-last-message") + 1]
                parent = os.path.dirname(path)
                checks.append((path, parent, os.path.exists(path), os.path.isdir(parent)))
                self.assert_private_path(path, parent)
                return super().popen(args, **kwargs)

            def assert_private_path(self, path, parent):
                outer.assertTrue(os.path.realpath(parent).startswith(os.path.realpath(tmp) + os.sep))
                outer.assertNotEqual(os.path.realpath(parent), os.path.realpath(tmp))
                outer.assertTrue(os.path.exists(path))
                if os.name != "nt":
                    outer.assertEqual(oct(os.stat(parent).st_mode & 0o777), "0o700")
                    outer.assertEqual(oct(os.stat(path).st_mode & 0o777), "0o600")
                else:
                    outer.assertTrue(os.path.basename(parent))
                    outer.assertTrue(os.path.isfile(path))

        with tempfile.TemporaryDirectory() as tmp:
            process = FakeProcess(0)
            runner = CheckingSubprocess(process)
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=tmp,
                subprocess_runner=runner,
                uploader=FakeUploader(),
                cleanup_runner=FakeCleanup(),
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                evidence_helper_factory=FakeBrowserEvidenceHelper,
                browser_factory=lambda **_kwargs: type("FakeBrowser", (), {"cdp_endpoint": "http://127.0.0.1:9222", "start": lambda self: self, "stop": lambda self: None})(),
            )
            outcome = sup.run(initial_result=valid_result())

            self.assertEqual(outcome.status, "passed")
            self.assertTrue(checks)
            self.assertFalse(os.path.exists(checks[0][0]))

    def test_docs_proxy_factory_type_error_fails_closed_without_writable_fallback(self):
        calls = []

        def proxy_factory(policy=None):
            calls.append(policy)
            if policy is not None:
                raise TypeError("internal docs proxy construction failure")
            return FakeProxy()

        outcome, _sup = self.run_supervisor(
            FakeProcess(0),
            result_payload=valid_result(),
            proxy_factory=proxy_factory,
        )

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(len(calls), 2)
        self.assertIsNotNone(calls[1])

    def test_supervisor_starts_chromium_with_proxy_cdp_runtime_profile_then_stops_after_evidence(self):
        browser_process = RecordingBrowserProcess()
        popen_factory = RecordingPopenFactory()
        ordering = []

        class OrderedEvidenceSink:
            runtime_classification = None
            url = "http://127.0.0.1:1/runtime-evidence"

            def __init__(self, _redactor, **_kwargs):
                pass

            def start(self):
                ordering.append("evidence-start")

            def stop(self):
                ordering.append("evidence-stop")

        def browser_popen(args, **kwargs):
            popen_factory(args, **kwargs)
            user_arg = next(arg for arg in args if arg.startswith("--user-data-dir="))
            profile_dir = user_arg.split("=", 1)[1]
            os.makedirs(profile_dir, exist_ok=True)
            with open(os.path.join(profile_dir, "DevToolsActivePort"), "w", encoding="utf-8") as handle:
                handle.write("9222\n/devtools/browser/id\n")
            return browser_process

        class OrderedBrowser(supervisor.ChromiumRuntime):
            def start(self):
                ordering.append("browser-start")
                return super().start()

            def stop(self):
                ordering.append("browser-stop")
                super().stop()

        class Runner:
            def popen(self, args, **kwargs):
                return popen_factory(args, **kwargs)

            def run(self, args, **kwargs):
                executable = os.path.basename(args[0])
                return FakeVersionProcess(f"{executable} 1.0.0\n")

        with tempfile.TemporaryDirectory() as runtime_root, mock.patch.object(supervisor, "RuntimeEvidenceSink", OrderedEvidenceSink):
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=runtime_root,
                subprocess_runner=Runner(),
                uploader=FakeUploader(),
                cleanup_runner=FakeCleanup(),
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                evidence_helper_factory=FakeBrowserEvidenceHelper,
                browser_factory=lambda **kwargs: OrderedBrowser(**{**kwargs, "popen_factory": browser_popen, "executable": "chromium", "clock": FakeClock()}),
            )
            outcome = sup.run(initial_result=valid_result())

            self.assertEqual(outcome.status, "passed")
            browser_args = popen_factory.calls[0][0]
            browser_kwargs = popen_factory.calls[0][1]
            self.assertIn("--remote-debugging-port=0", browser_args)
            self.assertIn("--headless=new", browser_args)
            self.assertIn("--no-sandbox", browser_args)
            self.assertEqual(browser_args.count("--no-sandbox"), 1)
            self.assertIn("--disable-quic", browser_args)
            self.assertIn("--force-webrtc-ip-handling-policy=disable_non_proxied_udp", browser_args)
            self.assertIn("--proxy-server=http://127.0.0.1:4567", browser_args)
            self.assertIn("--proxy-bypass-list=<-loopback>", browser_args)
            if os.name == "nt":
                self.assertEqual(browser_kwargs["creationflags"], subprocess.CREATE_NEW_PROCESS_GROUP)
                self.assertFalse(browser_kwargs["start_new_session"])
            else:
                self.assertEqual(browser_kwargs["creationflags"], 0)
                self.assertTrue(browser_kwargs["start_new_session"])
            user_arg = next(arg for arg in browser_args if arg.startswith("--user-data-dir="))
            self.assertTrue(os.path.realpath(user_arg.split("=", 1)[1]).startswith(os.path.realpath(runtime_root) + os.sep))
            codex_config = os.path.join(sup.codex_home, "qa.config.toml")
            with open(codex_config, encoding="utf-8") as handle:
                config_text = handle.read()
            self.assertIn('FLATKEY_BROWSER_QA_CDP_ENDPOINT = "http://127.0.0.1:9222"', config_text)
            self.assertEqual(ordering, ["browser-start", "evidence-start", "evidence-stop", "browser-stop"])
            self.assertTrue(browser_process.terminated)

    def test_browser_start_timeout_after_launch_terminates_browser_cleanup_runs_and_codex_never_starts(self):
        browser_process = RecordingBrowserProcess()

        def browser_popen(args, **kwargs):
            return browser_process

        class TimeoutClock(FakeClock):
            def monotonic(self):
                self.now += 1
                return self.now

        cleanup = FakeCleanup()
        with tempfile.TemporaryDirectory() as runtime_root:
            runner = FakeSubprocess(FakeProcess(0))
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=runtime_root,
                subprocess_runner=runner,
                uploader=FakeUploader(),
                cleanup_runner=cleanup,
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                evidence_helper_factory=FakeBrowserEvidenceHelper,
                browser_factory=lambda **kwargs: supervisor.ChromiumRuntime(
                    **{**kwargs, "popen_factory": browser_popen, "executable": "chromium", "clock": TimeoutClock(), "timeout_seconds": 0}
                ),
            )
            outcome = sup.run(initial_result=valid_result())

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(runner.calls, [])
        self.assertEqual(len(cleanup.calls), 1)
        self.assertTrue(browser_process.terminated)
        self.assertGreaterEqual(browser_process.wait_calls, 1)

    def test_browser_start_waits_for_devtools_active_port_file_contents(self):
        browser_process = RecordingBrowserProcess()
        active_port_path = None

        def browser_popen(args, **_kwargs):
            nonlocal active_port_path
            user_arg = next(arg for arg in args if arg.startswith("--user-data-dir="))
            profile_dir = user_arg.split("=", 1)[1]
            os.makedirs(profile_dir, exist_ok=True)
            active_port_path = os.path.join(profile_dir, "DevToolsActivePort")
            with open(active_port_path, "w", encoding="utf-8"):
                pass
            return browser_process

        def finish_devtools_active_port(_seconds):
            with open(active_port_path, "w", encoding="utf-8") as handle:
                handle.write("9222\n/devtools/browser/id\n")

        with tempfile.TemporaryDirectory() as runtime_root:
            runtime = supervisor.ChromiumRuntime(
                runtime_root=runtime_root,
                proxy=FakeProxy(),
                popen_factory=browser_popen,
                executable="chromium",
                clock=FakeClock(),
                timeout_seconds=1,
            )

            with mock.patch.object(supervisor.time, "sleep", side_effect=finish_devtools_active_port) as sleep:
                runtime.start()

            self.assertEqual(runtime.cdp_endpoint, "http://127.0.0.1:9222")
            sleep.assert_called_once_with(0.05)
            runtime.stop()

    def test_browser_start_failure_can_report_bounded_sanitized_chromium_stderr_tail(self):
        noisy_stderr = (
            b"first line\n"
            + (b"x" * 128)
            + b"\n[123:456:ERROR:sandbox_linux.cc(377)] \x1b[31mNo usable sandbox!\x1b[0m\n"
            + b"final reason\n"
        )
        browser_process = RecordingBrowserProcess(returncode=127, stderr=noisy_stderr)

        with tempfile.TemporaryDirectory() as runtime_root:
            runtime = supervisor.ChromiumRuntime(
                runtime_root=runtime_root,
                proxy=FakeProxy(),
                popen_factory=lambda *_args, **_kwargs: browser_process,
                executable="chromium",
                clock=FakeClock(),
                timeout_seconds=1,
                startup_stderr_limit_bytes=96,
            )

            with self.assertRaises(RuntimeError) as caught:
                runtime.start()

        message = str(caught.exception)
        self.assertIn("chromium exited before cdp endpoint was ready", message)
        self.assertIn("returncode=127", message)
        self.assertIn("chromium stderr tail:", message)
        self.assertIn("No usable sandbox!", message)
        self.assertIn("final reason", message)
        self.assertNotIn("\x1b", message)
        self.assertNotIn("first line", message)

    def test_chromium_stderr_tail_sanitizer_removes_secrets_and_action_commands(self):
        raw = (
            "::warning:: owner@gmail.com\r Authorization: Bearer sk-liveSECRET123\r\n"
            "Cookie: session=raw-cookie\r\n"
            "Set-Cookie: sid=raw-set-cookie\r\n"
            "plain bearer token sk-plainSECRET123\n"
            "plain bearer Bearer opaque-token-value\n"
            "https://example.test/path?token=query-secret&ok=value#access_token=fragment-secret\n"
            "password=pw-secret access_token=access-secret refresh_token=refresh-secret "
            "api_key=api-secret apikey=apikey-secret secret=secret-value code=123456\x07\n"
        )

        cleaned = supervisor._sanitize_chromium_stderr_tail(raw)

        for leaked in [
            "owner@gmail.com",
            "Authorization: Bearer sk-liveSECRET123",
            "session=raw-cookie",
            "sid=raw-set-cookie",
            "sk-plainSECRET123",
            "Bearer opaque-token-value",
            "query-secret",
            "fragment-secret",
            "pw-secret",
            "access-secret",
            "refresh-secret",
            "api-secret",
            "apikey-secret",
            "secret-value",
            "123456",
        ]:
            self.assertNotIn(leaked, cleaned)
        self.assertIn("[REDACTED_EMAIL]", cleaned)
        self.assertIn("Authorization: [REDACTED_AUTHORIZATION]", cleaned)
        self.assertIn("Cookie: [REDACTED_COOKIE]", cleaned)
        self.assertIn("Set-Cookie: [REDACTED_COOKIE]", cleaned)
        self.assertIn("[REDACTED_API_KEY]", cleaned)
        self.assertIn("Bearer [REDACTED_TOKEN]", cleaned)
        self.assertIn("token=[REDACTED_SECRET]", cleaned)
        self.assertIn("access_token=[REDACTED_SECRET]", cleaned)
        self.assertIn("password=[REDACTED_SECRET]", cleaned)
        self.assertIn("api_key=[REDACTED_SECRET]", cleaned)
        self.assertIn("[REDACTED_GITHUB_ACTION_COMMAND]warning::", cleaned)
        self.assertNotIn("\r", cleaned)
        self.assertNotIn("\x07", cleaned)
        self.assertFalse(cleaned.startswith("::"))

    def test_browser_start_default_stderr_capture_stays_disabled(self):
        browser_process = RecordingBrowserProcess(returncode=127, stderr=b"No usable sandbox!\n")

        with tempfile.TemporaryDirectory() as runtime_root:
            runtime = supervisor.ChromiumRuntime(
                runtime_root=runtime_root,
                proxy=FakeProxy(),
                popen_factory=lambda *_args, **_kwargs: browser_process,
                executable="chromium",
                clock=FakeClock(),
                timeout_seconds=1,
            )

            with self.assertRaises(RuntimeError) as caught:
                runtime.start()

        message = str(caught.exception)
        self.assertIn("chromium exited before cdp endpoint was ready", message)
        self.assertNotIn("chromium stderr tail", message)
        self.assertNotIn("No usable sandbox", message)

    def test_browser_start_failure_still_runs_cleanup_and_does_not_start_codex(self):
        class FailingBrowser:
            def start(self):
                raise RuntimeError("chromium missing")

            def stop(self):
                raise AssertionError("browser stop should not be required before start")

        cleanup = FakeCleanup()
        with tempfile.TemporaryDirectory() as runtime_root:
            runner = FakeSubprocess(FakeProcess(0))
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=runtime_root,
                subprocess_runner=runner,
                uploader=FakeUploader(),
                cleanup_runner=cleanup,
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                browser_factory=lambda **_kwargs: FailingBrowser(),
            )
            outcome = sup.run(initial_result=valid_result())

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(len(cleanup.calls), 1)
        self.assertEqual(runner.calls, [])

    def test_playwright_output_is_cleaned_and_not_uploaded(self):
        with tempfile.TemporaryDirectory() as runtime_root:
            output_dir = os.path.join(runtime_root, "playwright-output")
            os.makedirs(output_dir)
            with open(os.path.join(output_dir, "raw-secret.txt"), "w", encoding="utf-8") as handle:
                handle.write("Cookie: secret")
            uploader = FakeUploader()
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=runtime_root,
                subprocess_runner=FakeSubprocess(FakeProcess(0)),
                uploader=uploader,
                cleanup_runner=FakeCleanup(),
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                evidence_helper_factory=FakeBrowserEvidenceHelper,
                browser_factory=lambda **_kwargs: type("StartedBrowser", (), {"cdp_endpoint": "http://127.0.0.1:9222", "start": lambda self: self, "stop": lambda self: None})(),
            )
            outcome = sup.run(initial_result=valid_result())

        self.assertEqual(outcome.status, "passed")
        self.assertFalse(os.path.exists(output_dir))
        uploaded = [path for _manifest, paths in uploader.uploaded for path in paths]
        self.assertTrue(all("playwright-output" not in path for path in uploaded))

    def test_cleanup_runtime_child_dir_rejects_symlink_without_deleting_target(self):
        if not hasattr(os, "symlink"):
            self.skipTest("symlink creation unavailable")
        with tempfile.TemporaryDirectory() as runtime_root:
            target = os.path.join(runtime_root, "screenshots")
            os.mkdir(target)
            marker = os.path.join(target, "keep.txt")
            with open(marker, "w", encoding="utf-8") as handle:
                handle.write("keep")
            link = os.path.join(runtime_root, "playwright-output")
            try:
                os.symlink(target, link, target_is_directory=True)
            except (OSError, NotImplementedError):
                self.skipTest("symlink creation unavailable")

            with self.assertRaises(RuntimeError):
                supervisor._cleanup_runtime_child_dir(runtime_root, "playwright-output")

            self.assertTrue(os.path.exists(marker))
            self.assertTrue(os.path.islink(link))

    def test_cleanup_runtime_child_dir_lstats_and_rejects_symlink_before_rmtree(self):
        with tempfile.TemporaryDirectory() as runtime_root:
            target = os.path.join(runtime_root, "playwright-output")
            os.mkdir(target)
            with mock.patch.object(supervisor.os.path, "islink", return_value=True), \
                mock.patch.object(supervisor.shutil, "rmtree") as rmtree:
                with self.assertRaises(RuntimeError):
                    supervisor._cleanup_runtime_child_dir(runtime_root, "playwright-output")
            rmtree.assert_not_called()

    def test_supervisor_writes_flushed_browser_evidence_buffers_not_empty_placeholders(self):
        with tempfile.TemporaryDirectory() as runtime_root:
            process = FakeProcess(0)
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=runtime_root,
                subprocess_runner=FakeSubprocess(process),
                uploader=FakeUploader(),
                cleanup_runner=FakeCleanup(),
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                evidence_helper_factory=FakeBrowserEvidenceHelper,
                browser_factory=lambda **_kwargs: type("FakeBrowser", (), {"cdp_endpoint": "http://127.0.0.1:9222", "start": lambda self: self, "stop": lambda self: None})(),
            )
            outcome = sup.run(initial_result=valid_result())

            with open(os.path.join(runtime_root, "browser", "console.jsonl"), encoding="utf-8") as handle:
                console_lines = [json.loads(line) for line in handle]
            with open(os.path.join(runtime_root, "browser", "network.jsonl"), encoding="utf-8") as handle:
                network_lines = [json.loads(line) for line in handle]

        self.assertEqual(outcome.status, "passed")
        self.assertEqual(console_lines[0]["text"], "console secret [REDACTED_API_KEY]")
        self.assertEqual(set(network_lines[0]), {"url", "method", "status", "timing"})
        self.assertNotIn("network-secret", json.dumps(network_lines))

    def test_browser_evidence_flush_timeout_marks_infrastructure_and_cleanup_still_runs(self):
        class TimeoutFlushHelper(FakeBrowserEvidenceHelper):
            def flush(self):
                raise TimeoutError("browser helper response timed out")

        cleanup = FakeCleanup()
        with tempfile.TemporaryDirectory() as runtime_root:
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=runtime_root,
                subprocess_runner=FakeSubprocess(FakeProcess(0)),
                uploader=FakeUploader(),
                cleanup_runner=cleanup,
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                evidence_helper_factory=TimeoutFlushHelper,
                browser_factory=lambda **_kwargs: type("FakeBrowser", (), {"cdp_endpoint": "http://127.0.0.1:9222", "start": lambda self: self, "stop": lambda self: None})(),
            )
            outcome = sup.run(initial_result=valid_result())

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(len(cleanup.calls), 1)
        self.assertTrue(any(event["kind"] == "browser_evidence_flush_failed" for event in sup.events))

    def test_nonzero_invalid_timeout_sigterm_upload_and_cleanup_failures_still_cleanup_then_upload_with_priority(self):
        self.assertEqual(self.run_supervisor(FakeProcess(7), result_payload=valid_result())[0].status, "infrastructure_failed")
        self.assertEqual(self.run_supervisor(FakeProcess(0), result_payload={"bad": "shape"})[0].status, "infrastructure_failed")

        clock = FakeClock()
        process = FakeProcess(0, finish_after=100)
        outcome, sup = self.run_supervisor(process, result_payload=valid_result(), clock=clock)
        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertTrue(process.terminated)
        self.assertEqual(len(sup.cleanup_runner.calls), 1)
        self.assertEqual(len(sup.uploader.uploaded), 1)

        outcome, sup = self.run_supervisor(FakeProcess(0), result_payload=valid_result(), uploader=FakeUploader(fail=True))
        self.assertEqual(outcome.status, "infrastructure_failed")

        cleanup = FakeCleanup(CleanupResult(0, False, False, True, "password cleanup failed"))
        outcome, sup = self.run_supervisor(FakeProcess(7), result_payload=valid_result(), cleanup=cleanup)
        self.assertEqual(outcome.status, "cleanup_failed")
        self.assertEqual(len(sup.uploader.uploaded), 1)

    def test_definite_manifest_upload_failure_creates_no_cloud_main_manifest_and_cannot_report_passed(self):
        uploader = DefiniteFailUploader()
        outcome, sup = self.run_supervisor(FakeProcess(0), result_payload=valid_result(), uploader=uploader)

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(len(uploader.attempted), 1)
        self.assertEqual(uploader.cloud_objects, [])
        self.assertEqual(len(sup.cleanup_runner.calls), 1)

    def test_teardown_and_proxy_construction_failures_do_not_skip_cleanup(self):
        cleanup = FakeCleanup()
        with mock.patch.object(supervisor, "RuntimeEvidenceSink", StopFailEvidenceSink):
            outcome, sup = self.run_supervisor(FakeProcess(0), result_payload=valid_result(), cleanup=cleanup)
        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(len(cleanup.calls), 1)
        self.assertTrue(any(event["kind"] == "evidence_sink_stop_failed" for event in sup.events))

        cleanup = FakeCleanup()
        with tempfile.TemporaryDirectory() as runtime_root:
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=runtime_root,
                subprocess_runner=FakeSubprocess(FakeProcess(0)),
                uploader=FakeUploader(),
                cleanup_runner=cleanup,
                proxy_factory=lambda policy=None: (_ for _ in ()).throw(RuntimeError("proxy construction failed")),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
            )
            outcome = sup.run(initial_result=valid_result())
        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(len(cleanup.calls), 1)

    def test_preflight_and_alias_restriction_classification_are_precise(self):
        bad_status = lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": False, "turnstile_check": False}}
        self.assertEqual(self.run_supervisor(FakeProcess(0), result_payload=valid_result(), preflight=bad_status)[0].status, "infrastructure_failed")

        alias_self_report = valid_result(
            replay={"status": "failed", "checkpoint_reached": False},
            alias_restriction=True,
        )
        self.assertEqual(self.run_supervisor(FakeProcess(0), result_payload=alias_self_report)[0].status, "infrastructure_failed")

        missing_broker_env = env()
        del missing_broker_env["FLATKEY_BROWSER_QA_BROKER_URL"]
        self.assertEqual(self.run_supervisor(FakeProcess(0), result_payload=valid_result(), input_env=missing_broker_env)[0].status, "infrastructure_failed")

    def test_default_preflight_client_uses_exact_staging_status_contract(self):
        payload = {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}}
        opener = FakeStatusOpener(FakeStatusResponse(payload))
        preflight = supervisor.StagingStatusPreflight("https://staging-console.flatkey.ai", opener=opener)

        self.assertEqual(preflight(), payload)
        request, timeout = opener.requests[0]
        self.assertEqual(request.full_url, "https://staging-console.flatkey.ai/api/status")
        self.assertEqual(request.get_method(), "GET")
        self.assertEqual(timeout, 5)

        with self.assertRaises(ValueError):
            supervisor.StagingStatusPreflight("https://flatkey.ai", opener=opener)
        with self.assertRaises(RuntimeError):
            supervisor.StagingStatusPreflight(
                "https://staging-console.flatkey.ai",
                opener=FakeStatusOpener(FakeStatusResponse({"data": {"registration": True, "password_login": True}})),
            )()

    def test_stdout_stderr_artifacts_and_outcome_do_not_leak_secrets(self):
        process = FakeProcess(
            1,
            stdout=json.dumps({"type": "item.completed", "item": {"type": "agent_message", "text": json.dumps(valid_result())}}) + "\n",
            stderr="Cookie: secret Authorization: Bearer sk-xSECRET\n",
        )
        outcome, sup = self.run_supervisor(process, result_payload=valid_result())
        rendered = json.dumps(outcome.to_dict()) + json.dumps(sup.events)

        for secret in ["owner@gmail.com", "password", "sk-parentSECRET", "sk-xSECRET", "Cookie: secret", "Authorization: Bearer"]:
            self.assertNotIn(secret, rendered)
        artifact_names = {os.path.basename(path) for _manifest, paths in sup.uploader.uploaded for path in paths}
        self.assertIn("codex-events.jsonl", artifact_names)
        self.assertIn("codex-stderr.txt", artifact_names)

    def test_early_broken_pipe_preserves_codex_stderr_returncode_and_classification(self):
        process = FakeProcess(
            42,
            stderr="startup failed Authorization: Bearer sk-xSECRET\n",
        )
        process.stdin = BrokenPipeOnWriteStringIO("cannot write prompt sk-parentSECRET")
        calls = []

        def recording_write_report(*args, **kwargs):
            calls.append(kwargs)
            return original_write_report(*args, **kwargs)

        original_write_report = supervisor.report.write_report
        with mock.patch.object(supervisor.report, "write_report", recording_write_report):
            outcome, sup = self.run_supervisor(process, result_payload=valid_result())

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertEqual(calls[0]["codex_returncode"], 42)
        self.assertEqual(calls[0]["runtime_classification"], "codex_nonzero")
        with open(os.path.join(sup.runtime_root, "codex-stderr.txt"), encoding="utf-8") as handle:
            stderr = handle.read()
        self.assertIn("startup failed", stderr)
        self.assertNotIn("sk-xSECRET", stderr)
        self.assertNotIn("Authorization: Bearer", stderr)

    def test_events_artifact_appends_supervisor_diagnostics_without_duplicating_codex_events(self):
        with tempfile.TemporaryDirectory() as tmp:
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=tmp,
                subprocess_runner=FakeSubprocess(FakeProcess(0)),
                uploader=FakeUploader(),
                cleanup_runner=FakeCleanup(),
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
            )
            codex_events_path = os.path.join(tmp, "codex-events.jsonl")
            codex_stderr_path = os.path.join(tmp, "codex-stderr.txt")
            with open(codex_events_path, "w", encoding="utf-8") as handle:
                handle.write(json.dumps({"type": "item.completed", "text": "from codex"}) + "\n")
            sup.events = [
                {"kind": "codex_event", "text": {"type": "item.completed", "text": "from codex"}},
                {"kind": "infrastructure_error", "text": "failed sk-parentSECRET"},
                {"kind": "provenance_failed", "text": "missing codex"},
            ]

            sup._write_events_artifacts(
                codex_events_path,
                codex_stderr_path,
                supervisor.Redactor(extra_secrets=("sk-parentSECRET",)),
            )

            with open(codex_events_path, encoding="utf-8") as handle:
                lines = [json.loads(line) for line in handle]

        self.assertEqual(len(lines), 3)
        self.assertEqual(lines[0], {"type": "item.completed", "text": "from codex"})
        self.assertEqual(lines[1]["kind"], "infrastructure_error")
        self.assertEqual(lines[1]["text"], "failed [REDACTED_API_KEY]")
        self.assertEqual(lines[2]["kind"], "provenance_failed")

    def test_events_artifact_includes_diagnostics_from_late_local_artifact_failures(self):
        with mock.patch.object(
            supervisor,
            "write_browser_evidence_artifacts",
            side_effect=RuntimeError("evidence failed sk-parentSECRET"),
        ), mock.patch.object(
            supervisor,
            "_cleanup_runtime_child_dir",
            side_effect=RuntimeError("cleanup failed sk-parentSECRET"),
        ):
            outcome, sup = self.run_supervisor(FakeProcess(0), result_payload=valid_result())

        self.assertEqual(outcome.status, "infrastructure_failed")
        with open(os.path.join(sup.runtime_root, "codex-events.jsonl"), encoding="utf-8") as handle:
            events = [json.loads(line) for line in handle]
        self.assertEqual(
            [event["kind"] for event in events],
            ["browser_evidence_failed", "playwright_output_cleanup_failed"],
        )
        self.assertNotIn("sk-parentSECRET", json.dumps(events))

    def test_final_result_is_extracted_from_jsonl_redacted_and_no_raw_quarantine_is_written(self):
        raw_alias = "owner+flatkey-qa-12345-secret@gmail.com"
        code = "654321"

        with tempfile.TemporaryDirectory() as tmp:
            process_holder = {}
            raw_result = valid_result(findings=[{
                "severity": "low",
                "title": "leak",
                "target_url": "https://staging-console.flatkey.ai",
                "steps": [raw_alias],
                "expected": "no leak",
                "actual": code,
                "evidence_paths": ["browser/network.jsonl"],
                "confidence": "high",
                "proposed_case": None,
            }], exploration={"status": "passed", "actions_used": 999})
            def notify_code():
                control_mcp.write_control_state(
                    tmp,
                    {"phase": "exploration", "monotonic_started_at": 100.0, "actions_used": 7},
                )
                request = urllib.request.Request(
                    process_holder["sup"]._evidence_url,
                    data=json.dumps({"type": "verification_code", "code": code}).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                urllib.request.urlopen(request, timeout=2).close()

            process = FakeProcess(
                0,
                stdout=json.dumps({"type": "item.completed", "item": {"type": "agent_message", "text": json.dumps(raw_result)}}) + "\n",
                on_communicate=notify_code,
            )
            uploader = FakeUploader()
            runner = FakeSubprocess(process)

            def write_last_message():
                args, _kwargs = runner.calls[0]
                path = args[args.index("--output-last-message") + 1]
                with open(path, "w", encoding="utf-8") as handle:
                    json.dump(raw_result, handle)

            process.write_result = write_last_message
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=tmp,
                subprocess_runner=runner,
                uploader=uploader,
                cleanup_runner=FakeCleanup(),
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                evidence_helper_factory=FakeBrowserEvidenceHelper,
                browser_factory=lambda **_kwargs: type("FakeBrowser", (), {"cdp_endpoint": "http://127.0.0.1:9222", "start": lambda self: self, "stop": lambda self: None})(),
            )
            process_holder["sup"] = sup
            outcome = sup.run()

            self.assertEqual(outcome.status, "findings_detected")
            uploaded = json.dumps(uploader.uploaded)
            self.assertNotIn("quarantine", uploaded)
            with open(os.path.join(tmp, "result.json"), encoding="utf-8") as handle:
                final_result = json.load(handle)
            rendered = json.dumps(final_result) + json.dumps(outcome.to_dict())
            for secret in [raw_alias, sup._identity.password, code, "owner@gmail.com", "flatkey-qa-12345-secret"]:
                self.assertNotIn(secret, rendered)
            self.assertEqual(final_result["exploration"]["actions_used"], 7)
            with open(os.path.join(tmp, "manifest.json"), encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["result"]["exploration"]["actions_used"], 7)
            self.assertFalse(os.path.exists(os.path.join(tmp, "quarantine-result.json")))

    def test_invalid_or_oversized_codex_jsonl_is_infrastructure_and_kills_process(self):
        process = FakeProcess(0, stdout="{bad-json}\n")
        outcome, _sup = self.run_supervisor(process)
        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertTrue(process.terminated)

        process = FakeProcess(0, stdout="x" * (supervisor.MAX_CODEX_STDOUT_LINE_BYTES + 1))
        outcome, _sup = self.run_supervisor(process)
        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertTrue(process.terminated)

        process = FakeProcess(0, stderr="x" * (supervisor.MAX_CODEX_STDERR_LINE_BYTES + 1))
        outcome, _sup = self.run_supervisor(process, result_payload=valid_result())
        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertTrue(process.terminated)

    def test_wait_for_codex_uses_one_shared_deadline_for_streams_and_process_wait(self):
        process = FakeProcess(0, finish_after=100)
        clock = FakeClock()
        RecordingThread.join_timeouts = []
        RecordingThread.elapsed = 0.0
        RecordingThread.clock = clock
        outcome, _sup = self.run_supervisor(process, result_payload=valid_result(), clock=clock, thread_factory=RecordingThread)

        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertTrue(process.terminated)
        self.assertTrue(RecordingThread.join_timeouts)
        self.assertLessEqual(RecordingThread.elapsed, supervisor.INTERNAL_DEADLINE_SECONDS + 2)

        process = FakeProcess(0, stdout=("x" * (supervisor.MAX_CODEX_STDOUT_LINE_BYTES + 1)) + "\n")
        outcome, _sup = self.run_supervisor(process)
        self.assertEqual(outcome.status, "infrastructure_failed")
        self.assertTrue(process.terminated)

    def test_signal_handler_terminates_active_codex_then_cleanup_upload_and_restores_handlers(self):
        signals = FakeSignals()
        cleanup = FakeCleanup()
        uploader = FakeUploader()
        with tempfile.TemporaryDirectory() as tmp:
            process = FakeProcess(0, on_communicate=lambda: signals.handlers[signal.SIGTERM](signal.SIGTERM, None))
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=tmp,
                subprocess_runner=FakeSubprocess(process),
                uploader=uploader,
                cleanup_runner=cleanup,
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
                evidence_helper_factory=FakeBrowserEvidenceHelper,
                signal_module=signals,
                browser_factory=lambda **_kwargs: type("FakeBrowser", (), {"cdp_endpoint": "http://127.0.0.1:9222", "start": lambda self: self, "stop": lambda self: None})(),
            )
            outcome = sup.run(initial_result=valid_result())

            self.assertEqual(outcome.status, "infrastructure_failed")
            self.assertTrue(process.terminated)
            self.assertEqual(len(cleanup.calls), 1)
            self.assertEqual(len(uploader.uploaded), 1)
            self.assertEqual(signals.handlers[signal.SIGTERM], "previous")
            self.assertEqual(signals.handlers[signal.SIGINT], "previous")

    def test_main_rejects_arguments(self):
        with self.assertRaises(SystemExit):
            supervisor.main(["--unexpected"])

    def test_gcs_uploader_uses_run_execution_prefix_and_manifest_last(self):
        calls = []

        def upload(bucket, object_name, data, content_type, token, **_kwargs):
            calls.append((bucket, object_name, data, content_type, token))
            return {"name": object_name}

        with tempfile.TemporaryDirectory() as tmp:
            result_path = os.path.join(tmp, "result.json")
            events_path = os.path.join(tmp, "codex-events.jsonl")
            screenshot_dir = os.path.join(tmp, "screenshots")
            browser_dir = os.path.join(tmp, "browser")
            os.mkdir(screenshot_dir)
            os.mkdir(browser_dir)
            screenshot_path = os.path.join(screenshot_dir, "checkpoint.png")
            console_path = os.path.join(browser_dir, "console.jsonl")
            network_path = os.path.join(browser_dir, "network.jsonl")
            manifest_path = os.path.join(tmp, "manifest.json")
            for path, data in [
                (result_path, "{}"),
                (events_path, "{}\n"),
                (screenshot_path, b"\x89PNG\r\n\x1a\n"),
                (console_path, "{}\n"),
                (network_path, "{}\n"),
                (manifest_path, "{}"),
            ]:
                mode = "wb" if isinstance(data, bytes) else "w"
                with open(path, mode, encoding=None if isinstance(data, bytes) else "utf-8") as handle:
                    handle.write(data)

            uploader = supervisor.GcsArtifactUploader(
                bucket="browser-qa-bucket",
                run_id="run-1",
                execution_id="exec-1",
                runtime_root=tmp,
                token_provider=lambda: "access-token",
                upload_func=upload,
            )
            uploader.upload("manifest.json", [
                "result.json",
                "codex-events.jsonl",
                "screenshots/checkpoint.png",
                "browser/console.jsonl",
                "browser/network.jsonl",
                "manifest.json",
            ])

        self.assertEqual([call[1] for call in calls], [
            "runs/run-1/main/exec-1/result.json",
            "runs/run-1/main/exec-1/codex-events.jsonl",
            "runs/run-1/main/exec-1/screenshots/checkpoint.png",
            "runs/run-1/main/exec-1/browser/console.jsonl",
            "runs/run-1/main/exec-1/browser/network.jsonl",
            "runs/run-1/main/exec-1/manifest.json",
        ])
        self.assertEqual([call[3] for call in calls], [
            "application/json",
            "application/x-ndjson",
            "image/png",
            "application/x-ndjson",
            "application/x-ndjson",
            "application/json",
        ])

    def test_gcs_uploader_rejects_bad_nested_artifacts_absolute_dotdot_symlink_bad_ext_and_duplicates(self):
        with tempfile.TemporaryDirectory() as tmp:
            result_path = os.path.join(tmp, "result.json")
            manifest_path = os.path.join(tmp, "manifest.json")
            screenshot_dir = os.path.join(tmp, "screenshots")
            browser_dir = os.path.join(tmp, "browser")
            os.mkdir(screenshot_dir)
            os.mkdir(browser_dir)
            screenshot_path = os.path.join(screenshot_dir, "safe.png")
            duplicate_path = os.path.join(screenshot_dir, "copy.png")
            bad_ext = os.path.join(screenshot_dir, "safe.jpg")
            console_path = os.path.join(browser_dir, "console.jsonl")
            for path in [result_path, manifest_path, screenshot_path, duplicate_path, bad_ext, console_path]:
                with open(path, "w", encoding="utf-8") as handle:
                    handle.write("{}")
            uploader = supervisor.GcsArtifactUploader(
                bucket="browser-qa-bucket",
                run_id="run-1",
                execution_id="exec-1",
                runtime_root=tmp,
                token_provider=lambda: "access-token",
                upload_func=lambda *_args, **_kwargs: {},
            )

            for artifact in [
                os.path.abspath(os.path.join(tmp, "screenshots", "..", "result.json")),
                "screenshots\\safe.png",
                "screenshots/../result.json",
                "screenshots/./safe.png",
                "screenshots/safe.jpg",
                "browser/bad.jsonl",
            ]:
                with self.subTest(artifact=artifact):
                    with self.assertRaises(ValueError):
                        uploader.upload("manifest.json", [artifact, "manifest.json"])
            with self.assertRaises(ValueError):
                uploader.upload("manifest.json", ["screenshots/safe.png", "screenshots/safe.png", "manifest.json"])
            if hasattr(os, "symlink"):
                symlink_path = os.path.join(screenshot_dir, "link.png")
                try:
                    os.symlink(screenshot_path, symlink_path)
                except (OSError, NotImplementedError):
                    symlink_path = None
                if symlink_path is not None:
                    with self.assertRaises(ValueError):
                        uploader.upload("manifest.json", ["screenshots/link.png", "manifest.json"])
                linked_parent = os.path.join(tmp, "linked-screenshots")
                try:
                    os.symlink(screenshot_dir, linked_parent)
                except (OSError, NotImplementedError):
                    linked_parent = None
                if linked_parent is not None:
                    original = uploader.runtime_root
                    try:
                        uploader.runtime_root = tmp
                        os.rename(screenshot_dir, os.path.join(tmp, "screenshots-real"))
                        os.rename(linked_parent, screenshot_dir)
                        with self.assertRaises(ValueError):
                            uploader.upload("manifest.json", ["screenshots/safe.png", "manifest.json"])
                    finally:
                        uploader.runtime_root = original

    def test_gcs_uploader_rejects_unsafe_artifacts_and_lazy_token_failure_happens_after_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp:
            result_path = os.path.join(tmp, "result.json")
            manifest_path = os.path.join(tmp, "manifest.json")
            outside = os.path.join(tempfile.gettempdir(), "outside-browser-qa-artifact.txt")
            for path in [result_path, manifest_path, outside]:
                with open(path, "w", encoding="utf-8") as handle:
                    handle.write("{}")
            uploader = supervisor.GcsArtifactUploader(
                bucket="browser-qa-bucket",
                run_id="run-1",
                execution_id="exec/../bad",
                runtime_root=tmp,
                token_provider=lambda: "access-token",
                upload_func=lambda *_args, **_kwargs: {},
            )
            with self.assertRaises(ValueError):
                uploader.upload("manifest.json", ["result.json", "manifest.json"])

            duplicate_dir = os.path.join(tmp, "duplicate")
            os.mkdir(duplicate_dir)
            duplicate_result_path = os.path.join(duplicate_dir, "result.json")
            with open(duplicate_result_path, "w", encoding="utf-8") as handle:
                handle.write("{}")
            uploader = supervisor.GcsArtifactUploader(
                bucket="browser-qa-bucket",
                run_id="run-1",
                execution_id="exec-1",
                runtime_root=tmp,
                token_provider=lambda: "access-token",
                upload_func=lambda *_args, **_kwargs: {},
            )
            try:
                with self.assertRaises(ValueError):
                    uploader.upload("manifest.json", ["result.json", outside, "manifest.json"])

                unexpected_path = os.path.join(tmp, "unexpected.txt")
                with open(unexpected_path, "w", encoding="utf-8") as handle:
                    handle.write("unexpected")
                with self.assertRaises(ValueError):
                    uploader.upload("manifest.json", ["result.json", "unexpected.txt", "manifest.json"])

                with self.assertRaises(ValueError):
                    uploader.upload("manifest.json", ["result.json", "duplicate/result.json", "manifest.json"])

                if hasattr(os, "symlink"):
                    symlink_path = os.path.join(tmp, "codex-stderr.txt")
                    try:
                        os.symlink(result_path, symlink_path)
                    except (OSError, NotImplementedError):
                        symlink_path = None
                    if symlink_path is not None:
                        with self.assertRaises(ValueError):
                            uploader.upload("manifest.json", ["result.json", "codex-stderr.txt", "manifest.json"])

                small_limit_uploader = supervisor.GcsArtifactUploader(
                    bucket="browser-qa-bucket",
                    run_id="run-1",
                    execution_id="exec-1",
                    runtime_root=tmp,
                    token_provider=lambda: "access-token",
                    upload_func=lambda *_args, **_kwargs: {},
                    max_total_bytes=1,
                )
                with self.assertRaises(ValueError):
                    small_limit_uploader.upload("manifest.json", ["result.json", "manifest.json"])
            finally:
                try:
                    os.remove(outside)
                except FileNotFoundError:
                    pass

        with tempfile.TemporaryDirectory() as runtime_root:
            process = FakeProcess(0)
            cleanup = FakeCleanup()
            lazy_uploader = supervisor.GcsArtifactUploader(
                bucket="browser-qa-bucket",
                run_id="run-1",
                execution_id="exec-1",
                runtime_root=runtime_root,
                token_provider=lambda: (_ for _ in ()).throw(RuntimeError("lazy token unavailable")),
                upload_func=lambda *_args, **_kwargs: {},
            )
            sup = supervisor.Supervisor(
                env=env(),
                runtime_root=runtime_root,
                subprocess_runner=FakeSubprocess(process),
                uploader=lazy_uploader,
                cleanup_runner=cleanup,
                proxy_factory=lambda policy=None: FakeProxy(),
                preflight=lambda: {"data": {"register_enabled": True, "password_register_enabled": True, "email_verification": True, "turnstile_check": False}},
                clock=FakeClock(),
            )
            outcome = sup.run(initial_result=valid_result())
            self.assertEqual(outcome.status, "infrastructure_failed")
            self.assertEqual(len(cleanup.calls), 1)

    def test_main_defers_gcp_access_token_until_after_supervisor_construction(self):
        calls = []
        instances = []

        class FakeGcp:
            def access_token(self):
                calls.append("access_token")
                return "access-token"

        class FakeSupervisor:
            def __init__(self, **kwargs):
                calls.append("supervisor_init")
                self.kwargs = kwargs
                instances.append(self)

            def run(self):
                calls.append("run")
                return supervisor.Outcome("passed", "manifest.json", [])

        fake_env = env()
        fake_env.update({
            "FLATKEY_BROWSER_QA_GCS_BUCKET": "browser-qa-bucket",
            "FLATKEY_BROWSER_QA_EXECUTION_ID": "exec-1",
            "FLATKEY_BROWSER_QA_CHROMIUM_STARTUP_STDERR_BYTES": "8192",
        })
        with mock.patch.object(supervisor, "GcpClient", return_value=FakeGcp()), \
            mock.patch.object(supervisor, "Supervisor", FakeSupervisor), \
            mock.patch.object(supervisor, "CleanupRunner", lambda _client: FakeCleanup()), \
            mock.patch.object(supervisor, "StagingApiClient", lambda _origin: object()), \
            mock.patch.object(supervisor.os, "environ", fake_env):
            self.assertEqual(supervisor.main([]), 0)

        self.assertEqual(calls, ["supervisor_init", "run"])
        self.assertEqual(instances[0].kwargs["chromium_startup_stderr_limit_bytes"], 8192)

    def test_runtime_evidence_sink_registers_exact_code_and_rejects_bad_events(self):
        redactor = supervisor.Redactor(email="owner+flatkey-qa-1-x@gmail.com")
        checkpoints = []
        sink = supervisor.RuntimeEvidenceSink(redactor, checkpoint_handler=lambda: checkpoints.append("captured"))
        sink.start()
        try:
            request = urllib.request.Request(
                sink.url,
                data=json.dumps({"type": "verification_code", "code": "654321"}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(request, timeout=2) as response:
                self.assertEqual(response.status, 204)
            self.assertEqual(redactor.clean("123456 654321"), "123456 [REDACTED_CODE]")

            checkpoint = urllib.request.Request(
                sink.url,
                data=json.dumps({"type": "replay_checkpoint"}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(checkpoint, timeout=2) as response:
                self.assertEqual(response.status, 204)
            self.assertEqual(checkpoints, ["captured"])

            bad = urllib.request.Request(
                sink.url,
                data=json.dumps({"type": "verification_code", "code": "12345"}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(bad, timeout=2)

            alias = urllib.request.Request(
                sink.url,
                data=json.dumps({
                    "type": "alias_restriction",
                    "failed": True,
                    "text": "管理员已启用邮箱地址别名限制，您的邮箱地址由于包含特殊符号而被拒绝。",
                }).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(alias, timeout=2) as response:
                self.assertEqual(response.status, 204)
            self.assertEqual(sink.runtime_classification, "alias_restriction")

            wrong_path = urllib.request.Request(
                sink.url.replace("/runtime-evidence", "/wrong"),
                data=json.dumps({"type": "verification_code", "code": "111111"}).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with self.assertRaises(urllib.error.HTTPError):
                urllib.request.urlopen(wrong_path, timeout=2)

            with socket.create_connection((sink.host, sink.port), timeout=2) as sock:
                sock.sendall(
                    b"POST /runtime-evidence HTTP/1.1\r\n"
                    b"Host: 127.0.0.1\r\n"
                    b"Content-Type: application/json\r\n"
                    b"Transfer-Encoding: chunked\r\n\r\n0\r\n\r\n"
                )
                self.assertIn(b"400", sock.recv(256))

            body = json.dumps({"type": "verification_code", "code": "222222"}).encode("utf-8")
            with socket.create_connection((sink.host, sink.port), timeout=2) as sock:
                sock.sendall(
                    b"POST /runtime-evidence HTTP/1.1\r\n"
                    b"Host: 127.0.0.1\r\n"
                    b"Content-Type: application/json\r\n"
                    b"Content-Length: 1\r\n"
                    b"Content-Length: " + str(len(body)).encode("ascii") + b"\r\n\r\n" + body
                )
                self.assertIn(b"400", sock.recv(256))
        finally:
            sink.stop()

    def test_runtime_evidence_sink_wrong_path_consumes_bounded_body_before_404(self):
        redactor = supervisor.Redactor(email="owner+flatkey-qa-1-x@gmail.com")
        sink = supervisor.RuntimeEvidenceSink(redactor)
        sink.start()
        try:
            body = json.dumps({
                "type": "verification_code",
                "code": "333333",
                "padding": "x" * (sink.max_bytes - 75),
            }).encode("utf-8")
            self.assertGreaterEqual(len(body), sink.max_bytes - 16)
            self.assertLessEqual(len(body), sink.max_bytes)

            for attempt in range(100):
                request = urllib.request.Request(
                    sink.url.replace("/runtime-evidence", "/wrong"),
                    data=body,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                try:
                    urllib.request.urlopen(request, timeout=2).close()
                except urllib.error.HTTPError as exc:
                    self.assertEqual(exc.code, 404, f"attempt {attempt}")
                except ConnectionAbortedError as exc:
                    self.fail(f"attempt {attempt} aborted instead of returning HTTP 404: {exc!r}")
                else:
                    self.fail(f"attempt {attempt} unexpectedly succeeded")
        finally:
            sink.stop()


if __name__ == "__main__":
    unittest.main()
