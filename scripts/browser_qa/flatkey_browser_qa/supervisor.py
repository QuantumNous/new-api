import json
import hashlib
import http.server
import os
import queue
import re
import signal
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from collections.abc import Mapping

from . import report
from .api import StagingApiClient
from .cleanup import CleanupResult
from .cleanup import CleanupRunner
from .config import load_config
from .egress_proxy import EgressPolicy
from .egress_proxy import EgressProxy
from . import fixed_cases
from .fixed_case_runner import FixedCaseRunner
from .gcp import GcpClient
from .gcp import upload_gcs_object
from .identity import derive_identity
from .mcp_budget_wrapper import EXPLORATION_MAX_ACTIONS
from .mcp_budget_wrapper import EXPLORATION_SECONDS
from .mcp_budget_wrapper import ProcessTreeTerminator
from . import promotion
from .redaction import Redactor
from .resource_guard import CheckpointResourceGuard


INTERNAL_DEADLINE_SECONDS = 840
MAX_CODEX_STDOUT_LINE_BYTES = 1024 * 1024
MAX_CODEX_STDOUT_TOTAL_BYTES = 8 * 1024 * 1024
MAX_CODEX_STDERR_LINE_BYTES = 256 * 1024
MAX_CODEX_STDERR_TOTAL_BYTES = 1024 * 1024
MAX_CODEX_EVENTS = 10000
MAX_GCS_ARTIFACT_TOTAL_BYTES = 16 * 1024 * 1024
MAX_BROWSER_EVIDENCE_EVENTS = 1000
MAX_BROWSER_EVIDENCE_EVENT_BYTES = 64 * 1024
MAX_BROWSER_EVIDENCE_TOTAL_BYTES = 2 * 1024 * 1024
MAX_BROWSER_HELPER_FRAME_BYTES = 256 * 1024
BROWSER_HELPER_COMMANDS = frozenset({"init", "captureScreenshot", "addSensitiveValues", "flush", "readDocs", "executeFixedCase", "close"})
BROWSER_HELPER_ERROR_CODES = frozenset({
    "init_connect_failed",
    "init_context_failed",
    "init_websocket_block_failed",
    "init_download_block_failed",
    "init_service_worker_block_failed",
    "init_page_failed",
    "init_service_worker_bypass_failed",
    "init_failed",
    "command_failed",
})
MAX_PLAYWRIGHT_PACKAGE_JSON_BYTES = 65536
MAX_CHROMIUM_STARTUP_STDERR_BYTES = 64 * 1024
ROOT_GCS_ARTIFACT_NAMES = frozenset({"result.json", "codex-events.jsonl", "codex-stderr.txt", "manifest.json"})
EXACT_NESTED_GCS_ARTIFACT_NAMES = frozenset({"browser/console.jsonl", "browser/network.jsonl"})
SAFE_GCS_COMPONENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
SAFE_SCREENSHOT_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*\.png$")
PROMPT_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "qa-prompt.md")
POLICY_PATH = ".agents/skills/flatkey-new-user-onboarding/references/staging-cloud-qa-policy.md"
SKILL_NAME = "flatkey-new-user-onboarding"
PLAYWRIGHT_RUNTIME_ROOT = "/opt/flatkey-browser-qa"
PROVENANCE_VERSION_TIMEOUT_SECONDS = 2
MAX_PROVENANCE_VERSION_BYTES = 256
MAX_POLICY_BYTES = 64 * 1024
PROVENANCE_MODEL_CONFIG = {"model": "gpt-5.4", "sandbox": "workspace-write", "network_access": False}
FLATKEY_MODEL_PROVIDER_CONFIG = """[model_providers.flatkey]
name = "Flatkey"
base_url = "https://router.flatkey.ai/v1"
env_key = "CODEX_API_KEY"
wire_api = "responses"
supports_websockets = false"""


class _SignalAbort(RuntimeError):
    pass


class Outcome:
    def __init__(self, status, manifest_path, events):
        self.status = status
        self.manifest_path = manifest_path
        self.events = events

    def to_dict(self):
        return {"status": self.status, "manifest_path": self.manifest_path, "events": self.events}


class Supervisor:
    def __init__(
        self,
        *,
        env,
        runtime_root,
        subprocess_runner,
        uploader,
        cleanup_runner,
        proxy_factory=EgressProxy,
        preflight=None,
        clock,
        signal_module=signal,
        thread_factory=None,
        browser_factory=None,
        evidence_helper_factory=None,
        resource_guard_factory=None,
        fixed_cases_loader=None,
        fixed_case_runner_factory=None,
        fixed_cases_dir=None,
        chromium_startup_stderr_limit_bytes=0,
    ):
        self.env = dict(env)
        self.runtime_root = runtime_root
        self.subprocess_runner = subprocess_runner
        self.popen_factory = getattr(subprocess_runner, "popen", None) or getattr(subprocess_runner, "Popen", None)
        if not callable(self.popen_factory):
            raise TypeError("subprocess runner must provide popen or Popen")
        self.uploader = uploader
        self.cleanup_runner = cleanup_runner
        self.proxy_factory = proxy_factory
        self.preflight = preflight
        self.clock = clock
        self.signal_module = signal_module
        self.thread_factory = thread_factory or threading.Thread
        self.browser_factory = browser_factory or ChromiumRuntime
        self.evidence_helper_factory = evidence_helper_factory or BrowserEvidenceHelperProcess
        self.resource_guard_factory = resource_guard_factory or (
            lambda origin: CheckpointResourceGuard(lambda: StagingApiClient(origin))
        )
        self.fixed_cases_loader = fixed_cases_loader or fixed_cases.enabled_cases
        self.fixed_case_runner_factory = fixed_case_runner_factory or FixedCaseRunner
        self.fixed_cases_dir = fixed_cases_dir or os.path.join(os.path.dirname(os.path.dirname(__file__)), "fixed-cases")
        if not isinstance(chromium_startup_stderr_limit_bytes, int) or isinstance(chromium_startup_stderr_limit_bytes, bool) or chromium_startup_stderr_limit_bytes < 0:
            raise ValueError("chromium startup stderr limit must be a non-negative integer")
        self.chromium_startup_stderr_limit_bytes = chromium_startup_stderr_limit_bytes
        self.events = []
        self.codex_home = None
        self.home_dir = None
        self._active_process = None
        self._evidence_url = None
        self._codex_output_last_message_path = None
        self.fixed_case_results = {"status": "not_started", "cases": []}
        self.phase_trace = []
        self._checkpoint_lock = threading.Lock()
        self._checkpoint_completed = False
        self._checkpoint_failed = False

    def run(self, *, initial_result=None):
        os.makedirs(self.runtime_root, exist_ok=True)
        cfg = load_config({
            key: value
            for key, value in self.env.items()
            if key.startswith("FLATKEY_QA_") or key == "FLATKEY_BROWSER_QA_MODE"
        })
        identity = derive_identity(cfg.identity_seed, cfg.run_id)
        redactor = Redactor(
            email=f"{cfg.gmail_base.split('@', 1)[0]}+{identity.email_tag}@{cfg.gmail_base.split('@', 1)[1]}",
            password=identity.password,
            extra_secrets=(
                self.env.get("CODEX_API_KEY", ""),
                cfg.gmail_base,
                identity.username,
                identity.email_tag,
                "password",
                "Cookie: secret",
                "Authorization: Bearer",
                "sk-xSECRET",
            ),
        )
        self._identity = identity
        result_path = os.path.join(self.runtime_root, "result.json")
        manifest_path = os.path.join(self.runtime_root, "manifest.json")
        codex_events_path = os.path.join(self.runtime_root, "codex-events.jsonl")
        codex_stderr_path = os.path.join(self.runtime_root, "codex-stderr.txt")
        execution_id = getattr(self.uploader, "execution_id", None) or self.env.get("FLATKEY_BROWSER_QA_EXECUTION_ID")
        proxy = None
        docs_proxy = None
        browser = None
        evidence_helper = None
        evidence_sink = None
        browser_evidence = {"console": [], "network": []}
        cleanup_result = CleanupResult(0, False, False, True, "cleanup was not attempted")
        upload_failed = False
        invalid_result = False
        codex_returncode = 0
        provenance = None
        resource_guard = None

        payload = initial_result if initial_result is not None else _empty_result()
        runtime_classification = None if initial_result is not None else "invalid_result"
        try:
            selected_preflight = self.preflight or StagingStatusPreflight(cfg.console_origin)
            preflight_payload = selected_preflight()
            if not _preflight_ok(preflight_payload):
                payload = _empty_result()
                runtime_classification = "preflight_failed"
                invalid_result = False
            else:
                resource_guard = self.resource_guard_factory(cfg.console_origin)
                proxy = self.proxy_factory()
                proxy.start()
                docs_proxy = _build_docs_proxy(self.proxy_factory)
                docs_proxy.start()
                browser = self.browser_factory(
                    runtime_root=self.runtime_root,
                    proxy=proxy,
                    popen_factory=self.popen_factory,
                    startup_stderr_limit_bytes=self.chromium_startup_stderr_limit_bytes,
                )
                try:
                    browser.start()
                except Exception:
                    if getattr(browser, "process", None) is not None:
                        try:
                            browser.stop()
                        except Exception:
                            pass
                    browser = None
                    raise
                evidence_helper = self.evidence_helper_factory(
                    browser=browser,
                    runtime_root=self.runtime_root,
                    redactor=redactor,
                    popen_factory=self.popen_factory,
                    docs_proxy_url=f"http://{docs_proxy.host}:{docs_proxy.port}",
                ).start()
                evidence_sink = RuntimeEvidenceSink(
                    redactor,
                    evidence_helper=evidence_helper,
                    checkpoint_handler=lambda: self._handle_replay_checkpoint(
                        identity=identity,
                        evidence_helper=evidence_helper,
                        resource_guard=resource_guard,
                        redactor=redactor,
                    ),
                )
                evidence_sink.start()
                self._evidence_url = evidence_sink.url
                process = self._start_codex(proxy, browser.cdp_endpoint, cfg.mode)
                prompt = build_prompt(
                    cfg,
                    identity,
                    policy_path=os.path.realpath(os.path.join(self.home_dir, POLICY_PATH)),
                )
                previous_handlers = self._install_signal_handlers(process)
                try:
                    codex_returncode, model_payload = self._wait_for_codex(
                        process,
                        redactor,
                        prompt,
                        codex_events_path=codex_events_path,
                        codex_stderr_path=codex_stderr_path,
                        output_last_message_path=self._codex_output_last_message_path,
                    )
                finally:
                    self._restore_signal_handlers(previous_handlers)
                if initial_result is None and model_payload is not None:
                    payload = redactor.clean(model_payload)
                    runtime_classification = None
                if evidence_sink.runtime_classification == "alias_restriction":
                    runtime_classification = "alias_restriction"
                if codex_returncode != 0:
                    payload = _empty_result()
                    runtime_classification = "codex_nonzero"
        except TimeoutError:
            payload = _empty_result()
            runtime_classification = "codex_timeout"
            codex_returncode = -15
        except _SignalAbort:
            payload = _empty_result()
            runtime_classification = "codex_signal"
            codex_returncode = -15
        except Exception as exc:
            payload = _empty_result()
            runtime_classification = "invalid_result"
            self._event("infrastructure_error", str(exc), redactor)
            invalid_result = True
        finally:
            self._record_terminal_phases()
            if self._checkpoint_failed:
                runtime_classification = "fixed_case_checkpoint_failed"
                invalid_result = True
            if evidence_helper is not None:
                try:
                    browser_evidence = evidence_helper.flush()
                except Exception as exc:
                    self._event("browser_evidence_flush_failed", str(exc), redactor)
                    runtime_classification = runtime_classification or "invalid_result"
                    invalid_result = True
            if evidence_sink is not None:
                try:
                    evidence_sink.stop()
                except Exception as exc:
                    self._event("evidence_sink_stop_failed", str(exc), redactor)
                    runtime_classification = runtime_classification or "invalid_result"
                    invalid_result = True
            if evidence_helper is not None:
                try:
                    evidence_helper.stop()
                except Exception as exc:
                    self._event("browser_evidence_helper_stop_failed", str(exc), redactor)
                    runtime_classification = runtime_classification or "invalid_result"
                    invalid_result = True
            if browser is not None:
                try:
                    browser.stop()
                except Exception as exc:
                    self._event("browser_stop_failed", str(exc), redactor)
                    runtime_classification = runtime_classification or "invalid_result"
                    invalid_result = True
            if proxy is not None:
                try:
                    proxy.stop()
                except Exception as exc:
                    self._event("proxy_stop_failed", str(exc), redactor)
                    runtime_classification = runtime_classification or "invalid_result"
                    invalid_result = True
            if docs_proxy is not None:
                try:
                    docs_proxy.stop()
                except Exception as exc:
                    self._event("docs_proxy_stop_failed", str(exc), redactor)
                    runtime_classification = runtime_classification or "invalid_result"
                    invalid_result = True
            if resource_guard is not None and resource_guard.checkpoint_captured:
                try:
                    resource_guard.verify(identity)
                except Exception:
                    runtime_classification = runtime_classification or "exploration_resource_drift"
                    invalid_result = True
                    self._event("exploration_resource_drift", "checkpoint resources changed", redactor)
            try:
                cleanup_result = self.cleanup_runner.run(identity)
            except Exception as exc:
                cleanup_result = CleanupResult(0, False, False, True, redactor.clean(str(exc)))
            try:
                provenance = collect_runtime_provenance(
                    subprocess_runner=self.subprocess_runner,
                    env=self.env,
                    chromium_executable=getattr(browser, "executable", None) if browser is not None else None,
                    skill_dir=_fixed_skill_source(),
                )
            except Exception as exc:
                provenance = _failed_runtime_provenance()
                runtime_classification = runtime_classification or "provenance_failed"
                invalid_result = True
                self._event("provenance_failed", str(exc), redactor)
            payload = _with_trusted_runtime_state(
                payload,
                self.runtime_root,
                strict=initial_result is None,
            )
            payload = _with_trusted_result_contract(
                payload,
                fixed_case_results=self.fixed_case_results,
                phase_trace=self.phase_trace,
            )
            payload = report.sanitize_untrusted_proposed_cases(payload)
            payload = report.sanitize_untrusted_coverage_candidates(payload)
            if (
                initial_result is None
                and cfg.mode == "normal"
                and isinstance(payload, dict)
                and isinstance(payload.get("replay"), dict)
                and payload["replay"].get("checkpoint_reached") is True
                and isinstance(payload.get("exploration"), dict)
                and payload["exploration"].get("status") == "not_started"
            ):
                runtime_classification = runtime_classification or "exploration_not_started"
                invalid_result = True
            try:
                report.validate_result(payload)
            except Exception:
                fallback_payload = _with_trusted_result_contract(
                    _empty_result(),
                    fixed_case_results=self.fixed_case_results,
                    phase_trace=self.phase_trace,
                )
                try:
                    report.validate_result(fallback_payload)
                    payload = fallback_payload
                except Exception as exc:
                    self._event("trusted_result_contract_invalid", str(exc), redactor)
                    payload = _empty_result()
                runtime_classification = runtime_classification or "invalid_result"
                invalid_result = True
            try:
                write_browser_evidence_artifacts(self.runtime_root, browser_evidence, redactor)
            except Exception as exc:
                self._event("browser_evidence_failed", str(exc), redactor)
                runtime_classification = runtime_classification or "invalid_result"
                invalid_result = True
            try:
                proxy_events = []
                for candidate in (proxy, docs_proxy):
                    proxy_events.extend(getattr(candidate, "events", []) or [])
                payload = report.normalize_findings(
                    payload,
                    runtime_root=self.runtime_root,
                    proxy_events=proxy_events,
                )
            except Exception as exc:
                self._event("normalization_failed", str(exc), redactor)
                runtime_classification = runtime_classification or "invalid_result"
                invalid_result = True
            _write_private_json(result_path, redactor.clean(payload))
            try:
                _cleanup_runtime_child_dir(self.runtime_root, "playwright-output")
            except Exception as exc:
                self._event("playwright_output_cleanup_failed", str(exc), redactor)
                runtime_classification = runtime_classification or "invalid_result"
                invalid_result = True
            self._write_events_artifacts(codex_events_path, codex_stderr_path, redactor)
            manifest = report.write_report(
                result_path,
                manifest_path,
                cleanup_result=cleanup_result,
                run_id=cfg.run_id,
                execution_id=execution_id,
                provenance=provenance,
                redactor=redactor,
                codex_returncode=codex_returncode,
                upload_failed=upload_failed,
                invalid_result=invalid_result,
                runtime_classification=runtime_classification,
            )
            manifest = _write_candidate_bundles(
                manifest,
                manifest_path,
                payload,
                mode=cfg.mode,
                allowed_origins={cfg.website_origin, cfg.console_origin},
                run_id=cfg.run_id,
                bucket=getattr(self.uploader, "bucket", "browser-qa"),
                execution_id=execution_id,
                redactor=redactor,
            )
            try:
                self.uploader.upload("manifest.json", _collect_artifact_paths(self.runtime_root))
            except Exception as exc:
                upload_failed = True
                self._event("upload_failed", str(exc), redactor)
                manifest = report.write_report(
                    result_path,
                    manifest_path,
                    cleanup_result=cleanup_result,
                    run_id=cfg.run_id,
                    execution_id=execution_id,
                    provenance=provenance,
                    redactor=redactor,
                    codex_returncode=codex_returncode,
                    upload_failed=True,
                    invalid_result=invalid_result,
                    runtime_classification="upload_failed",
                )
                manifest = _write_candidate_bundles(
                    manifest,
                    manifest_path,
                    payload,
                    mode=cfg.mode,
                    allowed_origins={cfg.website_origin, cfg.console_origin},
                    run_id=cfg.run_id,
                    bucket=getattr(self.uploader, "bucket", "browser-qa"),
                    execution_id=execution_id,
                    redactor=redactor,
                )
        return Outcome(manifest["status"], manifest_path, self.events)

    def _handle_replay_checkpoint(self, *, identity, evidence_helper, resource_guard, redactor):
        with self._checkpoint_lock:
            if self._checkpoint_completed:
                return
            if self._checkpoint_failed:
                raise RuntimeError("fixed case checkpoint unavailable")
            try:
                self.phase_trace.append(("replay_done", len(self.phase_trace)))
                cases = self.fixed_cases_loader(self.fixed_cases_dir)
                results = []
                if cases:
                    attempt = {"id": _fixed_case_attempt_id(getattr(identity, "run_id", self.env.get("FLATKEY_QA_RUN_ID", "")))}
                    runner = self.fixed_case_runner_factory(
                        evidence_helper,
                        evidence_dir=os.path.join(self.runtime_root, "fixed-cases"),
                    )
                    for case in cases:
                        results.append(runner.run(case, attempt))
                self.fixed_case_results = {
                    "status": "failed" if any(result.get("status") == "failed" for result in results) else "passed",
                    "cases": results,
                }
                self.phase_trace.append(("fixed_cases_done", len(self.phase_trace)))
                resource_guard.capture(identity)
                self._checkpoint_completed = True
            except Exception:
                self._checkpoint_failed = True
                self.fixed_case_results = {"status": "not_started", "cases": []}
                self._event("fixed_case_checkpoint_failed", "fixed case checkpoint failed", redactor)
                raise RuntimeError("fixed case checkpoint unavailable") from None

    def _record_terminal_phases(self):
        if any(entry[0] == "finalization_started" for entry in self.phase_trace):
            return
        state_path = os.path.join(self.runtime_root, "control_state.json")
        try:
            with open(state_path, encoding="utf-8") as handle:
                state = json.load(handle)
        except (FileNotFoundError, OSError, json.JSONDecodeError):
            state = None
        if (
            isinstance(state, dict)
            and state.get("phase") == "exploration"
            and not any(entry[0] == "exploration_started" for entry in self.phase_trace)
        ):
            self.phase_trace.append(("exploration_started", len(self.phase_trace)))
        self.phase_trace.append(("finalization_started", len(self.phase_trace)))

    def _start_codex(self, proxy, cdp_endpoint, mode):
        self.codex_home = os.path.join(self.runtime_root, "codex-home")
        self.home_dir = os.path.join(self.runtime_root, "home")
        os.makedirs(self.codex_home, mode=0o700, exist_ok=True)
        os.makedirs(self.home_dir, mode=0o700, exist_ok=True)
        os.chmod(self.codex_home, 0o700)
        os.chmod(self.home_dir, 0o700)
        _install_fixed_skill(self.home_dir)
        config_path = os.path.join(self.codex_home, "config.toml")
        qa_config_path = os.path.join(self.codex_home, "qa.config.toml")
        self._codex_output_last_message_path = _prepare_output_last_message_path(self.runtime_root)
        _write_private_text(config_path, _codex_config(proxy))
        runtime_dir = os.path.realpath(self.runtime_root)
        empty_workspace = tempfile.mkdtemp(prefix="empty-workspace-", dir=self.runtime_root)
        api_key = self.env.pop("CODEX_API_KEY")
        repo_root = _repo_root()
        child_env = {
            "CODEX_HOME": self.codex_home,
            "HOME": self.home_dir,
            "CODEX_API_KEY": api_key,
            "PYTHONPATH": repo_root,
            "FLATKEY_BROWSER_QA_RUNTIME_DIR": runtime_dir,
            "FLATKEY_BROWSER_QA_RUN_ID": self.env["FLATKEY_QA_RUN_ID"],
            "FLATKEY_BROWSER_QA_EMAIL_TAG": self._identity.email_tag,
            "FLATKEY_BROWSER_QA_START_TIME": str(int(self.clock.time())),
            "FLATKEY_BROWSER_QA_BROKER_URL": self.env["FLATKEY_BROWSER_QA_BROKER_URL"],
            "FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL": self._evidence_url,
            "FLATKEY_BROWSER_QA_PROXY_URL": f"http://{proxy.host}:{proxy.port}",
            "FLATKEY_BROWSER_QA_CDP_ENDPOINT": cdp_endpoint,
            "FLATKEY_BROWSER_QA_MODE": mode,
        }
        if os.name == "nt":
            child_env["USERPROFILE"] = self.home_dir
        if self.env.get("SystemRoot"):
            child_env["SystemRoot"] = self.env["SystemRoot"]
        if self.env.get("PATH"):
            child_env["PATH"] = self.env["PATH"]
        _write_private_text(qa_config_path, _qa_config(proxy, runtime_dir, child_env))
        args = [
            shutil.which("codex", path=child_env.get("PATH")) or "codex",
            "exec",
            "--strict-config",
            "--ignore-rules",
            "--profile",
            "qa",
            "--ephemeral",
            "--json",
            "--output-last-message",
            self._codex_output_last_message_path,
            "--output-schema",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "result.schema.json"),
            "--sandbox",
            "workspace-write",
            "--skip-git-repo-check",
            "--model",
            "gpt-5.4",
            "--cd",
            empty_workspace,
            "-",
        ]
        process = self.popen_factory(args, env=child_env, cwd=repo_root, stdin=subprocess.PIPE, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self._active_process = process
        return process

    def _wait_for_codex(self, process, redactor, prompt, *, codex_events_path, codex_stderr_path, output_last_message_path=None):
        state = {"payload": None, "error": None}
        stderr_state = {"total": 0, "error": None}
        deadline = self.clock.monotonic() + INTERNAL_DEADLINE_SECONDS

        def stdout_reader():
            total = 0
            try:
                with _private_text_writer(codex_events_path) as events_file:
                    for line in _iter_bounded_lines(process.stdout, MAX_CODEX_STDOUT_LINE_BYTES):
                        total += len(line.encode("utf-8", "replace"))
                        if total > MAX_CODEX_STDOUT_TOTAL_BYTES:
                            raise RuntimeError("codex stdout exceeded limit")
                        try:
                            event = json.loads(line)
                        except json.JSONDecodeError as exc:
                            raise RuntimeError("codex stdout jsonl malformed") from exc
                        cleaned = redactor.clean(event)
                        events_file.write(json.dumps(cleaned, sort_keys=True) + "\n")
                        if len(self.events) < MAX_CODEX_EVENTS:
                            self.events.append({"kind": "codex_event", "text": cleaned})
                        if not output_last_message_path and _is_final_agent_message(event):
                            state["payload"] = _parse_agent_message_result(event)
            except Exception as exc:
                state["error"] = exc
                _terminate_process(process)

        def stderr_reader():
            try:
                with _private_text_writer(codex_stderr_path) as stderr_file:
                    for line in _iter_bounded_lines(process.stderr, MAX_CODEX_STDERR_LINE_BYTES):
                        stderr_state["total"] += len(line.encode("utf-8", "replace"))
                        if stderr_state["total"] > MAX_CODEX_STDERR_TOTAL_BYTES:
                            raise RuntimeError("codex stderr exceeded limit")
                        stderr_file.write(redactor.clean(line))
            except Exception as exc:
                stderr_state["error"] = exc
                _terminate_process(process)

        stdout_thread = self.thread_factory(target=stdout_reader)
        stderr_thread = self.thread_factory(target=stderr_reader)
        stderr_thread.start()
        prompt_error = None
        try:
            process.stdin.write(prompt)
        except OSError as exc:
            prompt_error = exc
        try:
            process.stdin.close()
        except OSError as exc:
            prompt_error = prompt_error or exc
        if hasattr(process, "finish_streams"):
            process.finish_streams()
        stdout_thread.start()
        threads = [stdout_thread, stderr_thread]
        for thread in threads:
            if thread.is_alive():
                thread.join(timeout=_remaining_deadline_seconds(self.clock, deadline))
        try:
            if any(thread.is_alive() for thread in threads):
                _terminate_process(process)
                raise TimeoutError("codex internal deadline exceeded")
            if state["error"] or stderr_state["error"]:
                raise RuntimeError("codex stream invalid")
            try:
                process.wait(timeout=_remaining_deadline_seconds(self.clock, deadline))
            except Exception as exc:
                _terminate_process(process)
                raise TimeoutError("codex internal deadline exceeded") from exc
            if output_last_message_path and os.path.exists(output_last_message_path):
                output_payload = _parse_output_last_message_file(output_last_message_path, redactor)
                if output_payload is not None:
                    state["payload"] = output_payload
            if prompt_error is not None and process.returncode == 0:
                raise RuntimeError("codex prompt delivery failed") from prompt_error
        finally:
            if output_last_message_path:
                try:
                    os.remove(output_last_message_path)
                except FileNotFoundError:
                    pass
        return process.returncode, state["payload"]

    def _install_signal_handlers(self, process):
        self._active_process = process
        return {
            self.signal_module.SIGTERM: self.signal_module.signal(self.signal_module.SIGTERM, self._handle_signal),
            self.signal_module.SIGINT: self.signal_module.signal(self.signal_module.SIGINT, self._handle_signal),
        }

    def _restore_signal_handlers(self, previous):
        for signum, handler in previous.items():
            self.signal_module.signal(signum, handler)

    def _handle_signal(self, _signum, _frame):
        if self._active_process is not None:
            _terminate_process(self._active_process)
        raise _SignalAbort("codex interrupted by signal")

    def _event(self, kind, text, redactor):
        cleaner = redactor or Redactor(extra_secrets=(self.env.get("CODEX_API_KEY", ""),))
        self.events.append({"kind": kind, "text": cleaner.clean(str(text))})

    def _write_events_artifacts(self, codex_events_path, codex_stderr_path, redactor):
        diagnostics = [redactor.clean(event) for event in self.events if event.get("kind") != "codex_event"]
        if diagnostics:
            fd = os.open(codex_events_path, os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o600)
            with os.fdopen(fd, "a", encoding="utf-8") as events_file:
                for event in diagnostics:
                    events_file.write(json.dumps(event, sort_keys=True) + "\n")
        elif not os.path.exists(codex_events_path):
            with _private_text_writer(codex_events_path):
                pass
        if not os.path.exists(codex_stderr_path):
            with _private_text_writer(codex_stderr_path):
                pass


def _empty_result():
    return {
        "replay": {"status": "failed", "checkpoint_reached": False},
        "exploration": {"status": "not_started", "actions_used": 0},
        "budgets": _trusted_runtime_budgets(),
        "findings": [],
        "coverage_candidates": [],
        "fixed_cases": {"status": "not_started", "cases": []},
        "phase_trace": [],
    }


def _fixed_case_attempt_id(run_id):
    value = str(run_id or "")
    candidate = "run-" + re.sub(r"[^A-Za-z0-9._-]", "-", value)
    if re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._-]{0,63}", candidate):
        return candidate
    digest = hashlib.sha256(value.encode("utf-8", "replace")).hexdigest()
    return "run-" + digest[:60]


def _with_trusted_runtime_state(payload, runtime_root, *, strict=False):
    if not isinstance(payload, dict):
        return payload
    state_path = os.path.join(runtime_root, "control_state.json")
    try:
        with open(state_path, encoding="utf-8") as handle:
            state = json.load(handle)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        state = None
    phase = state.get("phase") if isinstance(state, dict) else None
    actions_used = state.get("actions_used") if isinstance(state, dict) else None
    updated = dict(payload)
    replay = dict(updated.get("replay", {}))
    exploration = dict(updated.get("exploration", {}))
    if strict:
        checkpoint_reached = phase in {"replay_checkpoint", "exploration"}
        replay["checkpoint_reached"] = checkpoint_reached
        if phase != "exploration":
            exploration["status"] = "not_started"
            exploration["actions_used"] = 0
        elif isinstance(actions_used, int) and not isinstance(actions_used, bool) and actions_used >= 0:
            exploration["actions_used"] = actions_used
        else:
            exploration["actions_used"] = 0
    elif isinstance(actions_used, int) and not isinstance(actions_used, bool) and actions_used >= 0:
        exploration["actions_used"] = actions_used
    else:
        return payload
    updated["replay"] = replay
    updated["exploration"] = exploration
    return updated


def _with_trusted_result_contract(payload, *, fixed_case_results, phase_trace):
    if not isinstance(payload, dict):
        payload = _empty_result()
    updated = dict(payload)
    updated.setdefault("coverage_candidates", [])
    updated["budgets"] = _trusted_runtime_budgets()
    updated["fixed_cases"] = _trusted_fixed_case_results(fixed_case_results)
    updated["phase_trace"] = _trusted_phase_trace(phase_trace)
    return updated


def _trusted_runtime_budgets():
    return {
        "replay_seconds": EXPLORATION_SECONDS,
        "exploration_seconds": EXPLORATION_SECONDS,
        "max_actions": EXPLORATION_MAX_ACTIONS,
    }


def _trusted_fixed_case_results(value):
    if not isinstance(value, dict):
        return {"status": "not_started", "cases": []}
    return {
        "status": value.get("status", "not_started"),
        "cases": list(value.get("cases", [])) if isinstance(value.get("cases"), list) else [],
    }


def _trusted_phase_trace(entries):
    names = []
    for entry in entries if isinstance(entries, list) else []:
        name = entry[0] if isinstance(entry, (list, tuple)) and entry else entry
        names.append(name)
    return names


def _codex_config(_proxy):
    return ""


def _qa_config(proxy, runtime_dir, child_env):
    escaped_runtime_dir = _toml_escape(runtime_dir)
    escaped_repo_root = _toml_escape(_repo_root())
    return f"""model = "gpt-5.4"
model_provider = "flatkey"
approval_policy = "never"
web_search = "disabled"

{FLATKEY_MODEL_PROVIDER_CONFIG}

[mcp_servers.playwright]
command = "{_toml_escape(sys.executable)}"
args = ["-m", "scripts.browser_qa.flatkey_browser_qa.mcp_budget_wrapper"]
required = true
default_tools_approval_mode = "approve"
enabled_tools = ["browser_navigate", "browser_navigate_back", "browser_tabs", "browser_click", "browser_type", "browser_fill_form", "browser_select_option", "browser_snapshot", "browser_find", "browser_wait_for", "browser_console_messages", "browser_network_requests", "browser_network_request", "qa_read_docs"]
[mcp_servers.playwright.env]
PYTHONPATH = "{escaped_repo_root}"
PATH = "{_toml_escape(child_env.get("PATH", ""))}"
FLATKEY_BROWSER_QA_RUNTIME_DIR = "{escaped_runtime_dir}"
FLATKEY_BROWSER_QA_PROXY_URL = "http://{proxy.host}:{proxy.port}"
FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL"])}"
FLATKEY_BROWSER_QA_CDP_ENDPOINT = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_CDP_ENDPOINT"])}"
FLATKEY_BROWSER_QA_MODE = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_MODE"])}"

[mcp_servers.evidence]
command = "{_toml_escape(sys.executable)}"
args = ["-m", "scripts.browser_qa.flatkey_browser_qa.browser_evidence_mcp"]
required = true
default_tools_approval_mode = "approve"
enabled_tools = ["qa_capture_screenshot"]
[mcp_servers.evidence.env]
PYTHONPATH = "{escaped_repo_root}"
PATH = "{_toml_escape(child_env.get("PATH", ""))}"
FLATKEY_BROWSER_QA_RUNTIME_DIR = "{escaped_runtime_dir}"
FLATKEY_BROWSER_QA_MODE = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_MODE"])}"
FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL"])}"

[mcp_servers.broker]
command = "{_toml_escape(sys.executable)}"
args = ["-m", "scripts.browser_qa.flatkey_browser_qa.broker_mcp"]
required = true
default_tools_approval_mode = "approve"
enabled_tools = ["get_current_verification_code"]
[mcp_servers.broker.env]
PYTHONPATH = "{escaped_repo_root}"
PATH = "{_toml_escape(child_env.get("PATH", ""))}"
FLATKEY_BROWSER_QA_RUNTIME_DIR = "{escaped_runtime_dir}"
FLATKEY_BROWSER_QA_RUN_ID = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_RUN_ID"])}"
FLATKEY_BROWSER_QA_EMAIL_TAG = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_EMAIL_TAG"])}"
FLATKEY_BROWSER_QA_START_TIME = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_START_TIME"])}"
FLATKEY_BROWSER_QA_BROKER_URL = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_BROKER_URL"])}"
FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL"])}"

[mcp_servers.control]
command = "{_toml_escape(sys.executable)}"
args = ["-m", "scripts.browser_qa.flatkey_browser_qa.control_mcp"]
required = true
default_tools_approval_mode = "approve"
enabled_tools = ["qa_replay_checkpoint", "qa_start_exploration"]
[mcp_servers.control.env]
PYTHONPATH = "{escaped_repo_root}"
PATH = "{_toml_escape(child_env.get("PATH", ""))}"
FLATKEY_BROWSER_QA_RUNTIME_DIR = "{escaped_runtime_dir}"
FLATKEY_BROWSER_QA_MODE = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_MODE"])}"
FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL = "{_toml_escape(child_env["FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL"])}"

[sandbox_workspace_write]
network_access = false

[shell_environment_policy]
inherit = "none"
"""


def _write_private_json(path, payload):
    directory = os.path.dirname(path)
    os.makedirs(directory, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(prefix=".result.", suffix=".tmp", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, sort_keys=True)
        os.replace(tmp_path, path)
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
    finally:
        try:
            os.remove(tmp_path)
        except FileNotFoundError:
            pass


def _write_private_text(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as handle:
        handle.write(text)


def _prepare_output_last_message_path(runtime_root):
    directory = os.path.join(os.path.realpath(runtime_root), "codex-last-message")
    os.makedirs(directory, mode=0o700, exist_ok=True)
    _ensure_owner_only_directory(directory)
    path = os.path.join(directory, "codex-last-message.json")
    _write_private_text(path, "")
    _ensure_owner_only_file(path)
    return path


def _ensure_owner_only_directory(path):
    if os.name != "nt":
        os.chmod(path, 0o700)
    elif not os.path.isdir(path):
        raise RuntimeError("private runtime directory unavailable")


def _ensure_owner_only_file(path):
    if os.name != "nt":
        os.chmod(path, 0o600)
    elif not os.path.isfile(path):
        raise RuntimeError("private runtime file unavailable")


def _private_text_writer(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    return os.fdopen(fd, "w", encoding="utf-8")


def _remaining_deadline_seconds(clock, deadline):
    return max(0.0, deadline - clock.monotonic())


def _iter_bounded_lines(stream, max_line_bytes):
    pending = ""
    while True:
        chunk = stream.read(4096)
        if chunk == "":
            if pending:
                _ensure_line_within_limit(pending, max_line_bytes)
                yield pending
            return
        pending += chunk
        while True:
            newline_index = pending.find("\n")
            if newline_index < 0:
                _ensure_line_within_limit(pending, max_line_bytes)
                break
            line = pending[: newline_index + 1]
            pending = pending[newline_index + 1 :]
            _ensure_line_within_limit(line, max_line_bytes)
            yield line


def _ensure_line_within_limit(line, max_line_bytes):
    if len(line.encode("utf-8", "replace")) > max_line_bytes:
        raise RuntimeError("stream line exceeded limit")


def _is_final_agent_message(event):
    item = event.get("item") if isinstance(event, dict) else None
    return event.get("type") == "item.completed" and isinstance(item, dict) and item.get("type") == "agent_message"


def _parse_agent_message_result(event):
    item = event["item"]
    text = item.get("text")
    if not isinstance(text, str):
        content = item.get("content")
        if isinstance(content, list):
            text = "".join(part.get("text", "") for part in content if isinstance(part, dict))
    if not isinstance(text, str) or not text:
        raise RuntimeError("codex final agent message missing text")
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError("codex final agent message is not json") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("codex final agent message is not an object")
    return payload


def _parse_output_last_message_file(path, redactor):
    try:
        _ensure_owner_only_file(path)
        size = os.path.getsize(path)
        if size == 0:
            return None
        if size > MAX_CODEX_STDOUT_LINE_BYTES:
            raise RuntimeError("codex last message exceeded limit")
        with open(path, encoding="utf-8") as handle:
            raw = handle.read(MAX_CODEX_STDOUT_LINE_BYTES + 1)
    except OSError as exc:
        raise RuntimeError("codex last message unavailable") from exc
    if len(raw.encode("utf-8", "replace")) > MAX_CODEX_STDOUT_LINE_BYTES:
        raise RuntimeError("codex last message exceeded limit")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise RuntimeError("codex last message is not json") from exc
    if not isinstance(payload, dict):
        raise RuntimeError("codex last message is not an object")
    return redactor.clean(payload)


def _install_fixed_skill(home_dir):
    source = _fixed_skill_source()
    if not os.path.isdir(source):
        raise RuntimeError("fixed skill source missing")
    target_parent = os.path.join(home_dir, ".agents", "skills")
    target = os.path.join(target_parent, SKILL_NAME)
    os.makedirs(target_parent, mode=0o700, exist_ok=True)
    if os.path.exists(target):
        shutil.rmtree(target)
    shutil.copytree(source, target)
    for root, dirs, files in os.walk(target):
        try:
            os.chmod(root, 0o500)
        except OSError:
            pass
        for name in files:
            try:
                os.chmod(os.path.join(root, name), 0o400)
            except OSError:
                pass
        for name in dirs:
            try:
                os.chmod(os.path.join(root, name), 0o500)
            except OSError:
                pass


def collect_runtime_provenance(*, subprocess_runner, env, chromium_executable=None, skill_dir=None):
    path = env.get("PATH", "") if isinstance(env, Mapping) else ""
    probe_env = {"PATH": path}
    codex = _probe_version(subprocess_runner, ["codex", "--version"], probe_env)
    playwright_mcp = _probe_version(subprocess_runner, ["playwright-mcp", "--version"], probe_env)
    chromium = _probe_version(subprocess_runner, [chromium_executable or "chromium", "--version"], probe_env)
    provenance = {
        "skill_name": SKILL_NAME,
        "skill_content_sha256": _hash_skill_tree(skill_dir or _fixed_skill_source()),
        "codex_version": codex,
        "model_config": dict(PROVENANCE_MODEL_CONFIG),
        "playwright_mcp_version": playwright_mcp,
        "playwright_package_version": _playwright_package_version(),
        "chromium_version": chromium,
    }
    report.validate_provenance(provenance)
    return provenance


def _failed_runtime_provenance():
    return {
        "skill_name": SKILL_NAME,
        "skill_content_sha256": "0" * 64,
        "codex_version": "unavailable",
        "model_config": dict(PROVENANCE_MODEL_CONFIG),
        "playwright_mcp_version": "unavailable",
        "playwright_package_version": "unavailable",
        "chromium_version": "unavailable",
    }


def _probe_version(subprocess_runner, args, env):
    runner = getattr(subprocess_runner, "run", subprocess.run)
    completed = runner(
        list(args),
        env=dict(env),
        cwd=_repo_root(),
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=PROVENANCE_VERSION_TIMEOUT_SECONDS,
    )
    if getattr(completed, "returncode", 1) != 0:
        raise RuntimeError(f"version probe failed: {args[0]}")
    output = getattr(completed, "stdout", "")
    if not isinstance(output, str):
        raise RuntimeError("version probe output invalid")
    if len(output.encode("utf-8", "replace")) > MAX_PROVENANCE_VERSION_BYTES:
        raise RuntimeError("version probe output too large")
    lines = output.splitlines()
    if len(lines) != 1 or not lines[0]:
        raise RuntimeError("version probe output must be one non-empty line")
    return lines[0]


def _playwright_package_version(*, runtime_root=None):
    return _read_playwright_package_json_version(runtime_root or PLAYWRIGHT_RUNTIME_ROOT)


def _read_playwright_package_json_version(runtime_root):
    root = os.path.realpath(runtime_root)
    package_path = os.path.join(root, "node_modules", "playwright", "package.json")
    _reject_symlinked_existing_path(root, ("node_modules", "playwright", "package.json"))
    real = os.path.realpath(package_path)
    if real != package_path or not real.startswith(root + os.sep):
        raise RuntimeError("playwright package path invalid")
    try:
        stat_result = os.stat(real)
    except OSError as exc:
        raise RuntimeError("playwright package.json unavailable") from exc
    if not os.path.isfile(real):
        raise RuntimeError("playwright package.json must be a regular file")
    if stat_result.st_size < 1 or stat_result.st_size > MAX_PLAYWRIGHT_PACKAGE_JSON_BYTES:
        raise RuntimeError("playwright package.json size invalid")
    try:
        with open(real, encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        raise RuntimeError("playwright package.json invalid") from exc
    if not isinstance(payload, dict) or payload.get("name") != "playwright":
        raise RuntimeError("playwright package.json identity invalid")
    version = payload.get("version")
    if not _valid_single_line_version(version):
        raise RuntimeError("playwright package version invalid")
    return version


def _reject_symlinked_existing_path(root, parts):
    current = root
    for part in parts:
        current = os.path.join(current, part)
        try:
            os.lstat(current)
        except OSError as exc:
            raise RuntimeError("playwright package path unavailable") from exc
        if os.path.islink(current):
            raise RuntimeError("playwright package symlink rejected")


def _valid_single_line_version(value):
    return (
        isinstance(value, str)
        and bool(value)
        and "\n" not in value
        and "\r" not in value
        and len(value.encode("utf-8", "replace")) <= MAX_PROVENANCE_VERSION_BYTES
    )


def _fixed_skill_source():
    candidates = [
        os.path.join(_repo_root(), ".agents", "skills", SKILL_NAME),
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "skills", SKILL_NAME),
    ]
    for source in candidates:
        if os.path.isdir(source) and not os.path.islink(source):
            return source
    raise RuntimeError("fixed skill source missing")


def _hash_skill_tree(skill_dir):
    root = os.path.realpath(skill_dir)
    if os.path.islink(skill_dir) or not os.path.isdir(root):
        raise RuntimeError("skill source invalid")
    entries = []
    for current, dirs, files in os.walk(root):
        for name in list(dirs):
            path = os.path.join(current, name)
            if os.path.islink(path):
                raise RuntimeError("skill symlink rejected")
        for name in files:
            path = os.path.join(current, name)
            if os.path.islink(path):
                raise RuntimeError("skill symlink rejected")
            real = os.path.realpath(path)
            if not real.startswith(root + os.sep):
                raise RuntimeError("skill path escaped root")
            rel = os.path.relpath(real, root).replace(os.sep, "/")
            entries.append((rel, real))
    digest = hashlib.sha256()
    for rel, path in sorted(entries):
        digest.update(rel.encode("utf-8"))
        digest.update(b"\0")
        with open(path, "rb") as handle:
            for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                digest.update(chunk)
        digest.update(b"\0")
    return digest.hexdigest()


def build_prompt(cfg, identity, *, policy_path):
    with open(PROMPT_PATH, encoding="utf-8") as handle:
        prompt = handle.read()
    policy = _read_installed_policy(policy_path)
    mode_contract = ""
    if cfg.mode == "core":
        mode_contract = (
            "Core mode: after the replay checkpoint, stop. You must not call qa_start_exploration. "
            'The final result must set "exploration": {"status": "not_started", "actions_used": 0}.\n'
        )
    return (
        prompt
        + "\n\nSkill: $flatkey-new-user-onboarding\n"
        + f"Policy: {policy_path}\n"
        + "-----BEGIN TRUSTED STAGING CLOUD QA POLICY-----\n"
        + policy.rstrip()
        + "\n-----END TRUSTED STAGING CLOUD QA POLICY-----\n"
        + f"Run ID: {cfg.run_id}\n"
        + f"Authorized staging website origin: {cfg.website_origin}\n"
        + f"Authorized staging console origin: {cfg.console_origin}\n"
        + f"Read-only cookie-free docs origin: {cfg.docs_origin}\n"
        + "Begin replay by navigating to the authorized staging website origin.\n"
        + f"Disposable username: {identity.username}\n"
        + f"Disposable email: {cfg.gmail_base.split('@', 1)[0]}+{identity.email_tag}@{cfg.gmail_base.split('@', 1)[1]}\n"
        + f"Disposable password: {identity.password}\n"
        + mode_contract
        + "The runtime owns verification code, cleanup, result redaction, and upload.\n"
    )


def _read_installed_policy(policy_path):
    if os.path.islink(policy_path):
        raise RuntimeError("policy symlink rejected")
    try:
        stat_result = os.stat(policy_path)
    except OSError as exc:
        raise RuntimeError("installed policy unavailable") from exc
    if not os.path.isfile(policy_path):
        raise RuntimeError("installed policy must be a regular file")
    if stat_result.st_size < 1 or stat_result.st_size > MAX_POLICY_BYTES:
        raise RuntimeError("installed policy size invalid")
    with open(policy_path, encoding="utf-8") as handle:
        policy = handle.read(MAX_POLICY_BYTES + 1)
    if len(policy.encode("utf-8", "replace")) > MAX_POLICY_BYTES:
        raise RuntimeError("installed policy size invalid")
    return policy


def _preflight_ok(payload):
    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, dict):
        return False
    return (
        data.get("register_enabled") is True
        and data.get("password_register_enabled") is True
        and data.get("email_verification") is True
        and data.get("turnstile_check") is False
    )


def _terminate_process(process):
    try:
        process.terminate()
        process.wait(timeout=2)
    except Exception:
        try:
            process.kill()
        except Exception:
            pass


class _DirectProcessTerminator:
    def terminate_tree(self, child):
        child.terminate()

    def kill_tree(self, child):
        child.kill()

    def close(self):
        return None


def _attach_process_tree_or_direct(process):
    if isinstance(getattr(process, "pid", None), int) and process.pid > 0:
        return ProcessTreeTerminator.attach(process)
    return _DirectProcessTerminator()


def _build_docs_proxy(proxy_factory):
    return proxy_factory(policy=EgressPolicy.from_file(mode="read_only"))


def _start_new_tree_popen_kwargs():
    return {
        "start_new_session": os.name != "nt",
        "creationflags": subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
    }


def _terminate_process_tree(process, terminator):
    try:
        terminator.terminate_tree(process)
    except Exception:
        try:
            process.terminate()
        except Exception:
            pass
    try:
        process.wait(timeout=2)
    except Exception:
        try:
            terminator.kill_tree(process)
        except Exception:
            try:
                process.kill()
            except Exception:
                pass
    try:
        terminator.close()
    except Exception:
        pass


def _repo_root():
    return os.path.realpath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def _toml_escape(value):
    return str(value).replace("\\", "\\\\").replace('"', '\\"')


class StagingStatusPreflight:
    def __init__(self, origin, *, opener=None):
        if origin != "https://staging-console.flatkey.ai":
            raise ValueError("preflight origin must be staging console")
        self.origin = origin
        self.opener = opener or urllib.request.build_opener(_NoRedirectHandler(), urllib.request.ProxyHandler({}))

    def __call__(self):
        request = urllib.request.Request(self.origin + "/api/status", headers={"Accept": "application/json"}, method="GET")
        with self.opener.open(request, timeout=5) as response:
            raw = response.read(65537)
            if len(raw) > 65536:
                raise RuntimeError("status response too large")
            payload = json.loads(raw.decode("utf-8"))
        if not _preflight_ok(payload):
            raise RuntimeError("staging preflight failed")
        return payload


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class ChromiumRuntime:
    def __init__(
        self,
        *,
        runtime_root,
        proxy,
        popen_factory=subprocess.Popen,
        executable=None,
        clock=time,
        timeout_seconds=10,
        startup_stderr_limit_bytes=0,
    ):
        self.runtime_root = os.path.realpath(runtime_root)
        self.proxy = proxy
        self.popen_factory = popen_factory
        self.executable = executable
        self.clock = clock
        self.timeout_seconds = timeout_seconds
        if not isinstance(startup_stderr_limit_bytes, int) or isinstance(startup_stderr_limit_bytes, bool) or startup_stderr_limit_bytes < 0:
            raise ValueError("startup stderr limit must be a non-negative integer")
        self.startup_stderr_limit_bytes = min(startup_stderr_limit_bytes, MAX_CHROMIUM_STARTUP_STDERR_BYTES)
        self.user_data_dir = os.path.join(self.runtime_root, "chromium-profile")
        self.process = None
        self.tree_terminator = None
        self.cdp_endpoint = None
        self._startup_stderr_tail = None
        self._stderr_drain_thread = None

    def start(self):
        os.makedirs(self.user_data_dir, mode=0o700, exist_ok=True)
        try:
            os.chmod(self.user_data_dir, 0o700)
        except OSError:
            pass
        executable = self.executable or _chromium_executable()
        self.executable = executable
        args = [
            executable,
            "--remote-debugging-port=0",
            f"--user-data-dir={self.user_data_dir}",
            f"--proxy-server=http://{self.proxy.host}:{self.proxy.port}",
            "--proxy-bypass-list=<-loopback>",
            "--disable-quic",
            "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
            "--headless=new",
            "--no-sandbox",
            "--disable-gpu",
            "about:blank",
        ]
        try:
            stderr_target = subprocess.DEVNULL
            if self.startup_stderr_limit_bytes > 0:
                stderr_target = subprocess.PIPE
                self._startup_stderr_tail = _BoundedStartupStderrTail(self.startup_stderr_limit_bytes)
            self.process = self.popen_factory(
                args,
                stdout=subprocess.DEVNULL,
                stderr=stderr_target,
                stdin=subprocess.DEVNULL,
                text=False,
                **_start_new_tree_popen_kwargs(),
            )
            self._start_stderr_drain_if_enabled()
            self.tree_terminator = _attach_process_tree_or_direct(self.process)
            self.cdp_endpoint = self._wait_for_devtools_endpoint()
            if self._startup_stderr_tail is not None:
                self._startup_stderr_tail.discard()
        except Exception:
            self.stop()
            raise
        return self

    def stop(self):
        if self.process is None:
            return
        _terminate_process_tree(self.process, self.tree_terminator or _DirectProcessTerminator())
        if self._stderr_drain_thread is not None:
            self._stderr_drain_thread.join(timeout=2)
            self._stderr_drain_thread = None
        self.process = None
        self.tree_terminator = None
        self._startup_stderr_tail = None

    def _start_stderr_drain_if_enabled(self):
        stderr = getattr(self.process, "stderr", None)
        if self._startup_stderr_tail is None or stderr is None:
            return
        thread = threading.Thread(target=self._drain_stderr, args=(stderr,), daemon=True)
        thread.start()
        self._stderr_drain_thread = thread

    def _drain_stderr(self, stderr):
        try:
            while True:
                chunk = stderr.read(4096)
                if not chunk:
                    return
                tail = self._startup_stderr_tail
                if tail is not None:
                    tail.append(chunk)
        except Exception:
            return

    def _wait_for_devtools_endpoint(self):
        active_port_path = os.path.realpath(os.path.join(self.user_data_dir, "DevToolsActivePort"))
        if not active_port_path.startswith(os.path.realpath(self.user_data_dir) + os.sep):
            raise RuntimeError("devtools active port path escaped profile")
        deadline = self.clock.monotonic() + self.timeout_seconds
        while self.clock.monotonic() <= deadline:
            if os.path.exists(active_port_path):
                try:
                    return _read_devtools_endpoint(active_port_path)
                except _DevtoolsActivePortNotReady:
                    pass
            poll = getattr(self.process, "poll", None)
            if poll is not None:
                returncode = poll()
                if returncode is not None:
                    raise RuntimeError(self._startup_failure_message(returncode))
            time.sleep(0.05)
        raise TimeoutError("chromium cdp endpoint timed out")

    def _startup_failure_message(self, returncode):
        message = f"chromium exited before cdp endpoint was ready (returncode={returncode})"
        if self._stderr_drain_thread is not None:
            self._stderr_drain_thread.join(timeout=1)
        if self._startup_stderr_tail is not None:
            tail = self._startup_stderr_tail.text()
            if tail:
                message += f"; chromium stderr tail: {tail}"
        return message


class _BoundedStartupStderrTail:
    def __init__(self, limit_bytes):
        self.limit_bytes = limit_bytes
        self._buffer = bytearray()
        self._enabled = True
        self._lock = threading.Lock()

    def append(self, chunk):
        if isinstance(chunk, str):
            chunk = chunk.encode("utf-8", "replace")
        with self._lock:
            if not self._enabled:
                return
            self._buffer.extend(chunk)
            overflow = len(self._buffer) - self.limit_bytes
            if overflow > 0:
                del self._buffer[:overflow]

    def discard(self):
        with self._lock:
            self._buffer.clear()
            self._enabled = False

    def text(self):
        with self._lock:
            raw = bytes(self._buffer)
        return _sanitize_chromium_stderr_tail(raw.decode("utf-8", "replace")).strip()


_GENERIC_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_SENSITIVE_HEADER_RE = re.compile(r"(?im)\b(authorization|cookie|set-cookie)\s*:\s*[^\n]*")
_BEARER_TOKEN_RE = re.compile(r"\b(Bearer)\s+(?!\[REDACTED_)[^\s,;]+")
_SECRET_ASSIGNMENT_RE = re.compile(
    r"(?i)\b(password|token|access_token|refresh_token|api_key|apikey|secret|code)\s*=\s*[^\s&;]+"
)


def _sanitize_chromium_stderr_tail(value):
    value = re.sub(r"\x1b\[[0-?]*[ -/]*[@-~]", "", value)
    value = value.replace("\r\n", "\n").replace("\r", "\n")
    value = "".join(char if char in "\n\t" or ord(char) >= 32 else "" for char in value)
    value = Redactor().clean(value)
    value = _GENERIC_EMAIL_RE.sub("[REDACTED_EMAIL]", value)
    value = _SENSITIVE_HEADER_RE.sub(_redact_stderr_header, value)
    value = _BEARER_TOKEN_RE.sub(lambda match: f"{match.group(1)} [REDACTED_TOKEN]", value)
    value = _SECRET_ASSIGNMENT_RE.sub(lambda match: f"{match.group(1)}=[REDACTED_SECRET]", value)
    return re.sub(r"(?m)^::", "[REDACTED_GITHUB_ACTION_COMMAND]", value)


def _redact_stderr_header(match):
    name = match.group(1)
    placeholder = "[REDACTED_AUTHORIZATION]" if name.lower() == "authorization" else "[REDACTED_COOKIE]"
    return f"{name}: {placeholder}"


class BrowserEvidenceHelperProcess:
    def __init__(self, *, browser, runtime_root, redactor, popen_factory=subprocess.Popen, response_timeout_seconds=30, docs_proxy_url=None):
        self.browser = browser
        self.runtime_root = os.path.realpath(runtime_root)
        self.redactor = redactor
        self.popen_factory = popen_factory
        self.response_timeout_seconds = response_timeout_seconds
        self.docs_proxy_url = docs_proxy_url
        self.process = None
        self.tree_terminator = None
        self._next_id = 0
        self._lock = threading.Lock()

    def start(self):
        script = os.path.join(os.path.dirname(__file__), "browser_evidence_helper.cjs")
        try:
            self.process = self.popen_factory(
                ["node", script],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL,
                text=True,
                encoding="utf-8",
                errors="strict",
                bufsize=1,
                **_start_new_tree_popen_kwargs(),
            )
            self.tree_terminator = _attach_process_tree_or_direct(self.process)
            self._request(
                "init",
                {
                    "runtimeDir": self.runtime_root,
                    "cdpEndpoint": self.browser.cdp_endpoint,
                    "sensitiveValues": self._protocol_secrets(),
                    "docsProxyUrl": self.docs_proxy_url,
                },
            )
        except Exception:
            _terminate_process_tree(self.process, self.tree_terminator or _DirectProcessTerminator())
            raise
        return self

    def capture_screenshot(self, name):
        response = self._request("captureScreenshot", {"name": name})
        path = response.get("path") if isinstance(response, dict) else None
        if not isinstance(path, str) or not path.startswith("screenshots/"):
            raise RuntimeError("browser helper screenshot response invalid")
        return path

    def register_sensitive_value(self, value):
        if not isinstance(value, str) or not value:
            return
        self._request("addSensitiveValues", {"values": [value]})

    def flush(self):
        response = self._request("flush", {})
        if not isinstance(response, dict):
            raise RuntimeError("browser helper evidence response invalid")
        return response

    def read_docs(self, url):
        response = self._request("readDocs", {"url": url})
        if not isinstance(response, dict) or not isinstance(response.get("url"), str) or not isinstance(response.get("text"), str):
            raise RuntimeError("browser helper docs response invalid")
        return response

    def execute_fixed_case(self, *, case, attempt, evidence_dir):
        response = self._request("executeFixedCase", {"case": case, "attempt": attempt, "evidenceDir": evidence_dir})
        if not isinstance(response, dict):
            raise RuntimeError("browser helper fixed case response invalid")
        return response

    def stop(self):
        if self.process is None:
            return
        try:
            self._request("close", {})
        except Exception:
            pass
        _terminate_process_tree(self.process, self.tree_terminator or _DirectProcessTerminator())
        self.process = None
        self.tree_terminator = None

    def _request(self, command, params):
        if self.process is None:
            raise RuntimeError("browser helper not started")
        with self._lock:
            self._next_id += 1
            frame = {"id": self._next_id, "command": command, "params": params}
            encoded = json.dumps(frame, sort_keys=True)
            if len(encoded.encode("utf-8")) > MAX_BROWSER_HELPER_FRAME_BYTES:
                raise RuntimeError("browser helper request too large")
            self.process.stdin.write(encoded + "\n")
            self.process.stdin.flush()
            line = self._read_response_line()
            payload = self._validate_response(line)
            if payload.get("id") != self._next_id:
                raise RuntimeError("browser helper response id mismatch")
            if payload.get("ok") is not True:
                command_label = command if command in BROWSER_HELPER_COMMANDS else "command"
                raise RuntimeError(f"browser helper {command_label} failed: {payload['error']}")
            return payload.get("result", {})

    def _read_response_line(self):
        result_queue = queue.Queue(maxsize=1)

        def read_line():
            try:
                result_queue.put(("line", self.process.stdout.readline()), block=False)
            except Exception as exc:
                try:
                    result_queue.put(("error", exc), block=False)
                except queue.Full:
                    pass

        thread = threading.Thread(target=read_line, daemon=True)
        thread.start()
        try:
            kind, value = result_queue.get(timeout=self.response_timeout_seconds)
        except queue.Empty as exc:
            _terminate_process(self.process)
            raise TimeoutError("browser helper response timed out") from exc
        if kind == "error":
            raise RuntimeError("browser helper response read failed") from value
        return value

    def _validate_response(self, line):
        if not isinstance(line, str) or line == "":
            raise RuntimeError("browser helper response missing")
        if len(line.encode("utf-8", "replace")) > MAX_BROWSER_HELPER_FRAME_BYTES:
            raise RuntimeError("browser helper response too large")
        try:
            payload = json.loads(line)
        except json.JSONDecodeError as exc:
            raise RuntimeError("browser helper response malformed") from exc
        if not isinstance(payload, dict) or set(payload) - {"id", "ok", "result", "error"}:
            raise RuntimeError("browser helper response malformed")
        if not isinstance(payload.get("id"), int) or not isinstance(payload.get("ok"), bool):
            raise RuntimeError("browser helper response malformed")
        if payload.get("ok") is True and "error" in payload:
            raise RuntimeError("browser helper response malformed")
        if payload.get("ok") is False:
            if "result" in payload or set(payload) != {"id", "ok", "error"}:
                raise RuntimeError("browser helper response malformed")
            error_code = payload.get("error")
            if not isinstance(error_code, str) or error_code not in BROWSER_HELPER_ERROR_CODES:
                raise RuntimeError("browser helper response malformed")
        return payload

    def _protocol_secrets(self):
        values = []
        email = getattr(self.redactor, "email", None)
        if email:
            values.append(email)
            local, _, domain = email.partition("@")
            base_local, plus, tag = local.partition("+")
            if base_local and domain:
                values.append(f"{base_local}@{domain}")
            if plus and tag:
                values.append(tag)
        password = getattr(self.redactor, "password", None)
        if password:
            values.append(password)
        for secret in getattr(self.redactor, "extra_secrets", ()):
            if secret:
                values.append(secret)
        return _dedupe_strings(values)


def _dedupe_strings(values):
    seen = set()
    result = []
    for value in values:
        if isinstance(value, str) and value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def _chromium_executable():
    for env_name in ("CHROMIUM_EXECUTABLE_PATH", "CHROMIUM_PATH"):
        candidate = os.environ.get(env_name)
        if not candidate:
            continue
        if os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
        raise RuntimeError(f"{env_name} does not point to an executable file")

    candidates = [
        shutil.which("chromium"),
        shutil.which("chromium-browser"),
        shutil.which("google-chrome"),
        shutil.which("google-chrome-stable"),
        shutil.which("msedge"),
    ]
    for candidate in candidates:
        if candidate and os.path.isfile(candidate) and os.access(candidate, os.X_OK):
            return candidate
    raise RuntimeError("chromium executable not found")


class _DevtoolsActivePortNotReady(RuntimeError):
    pass


def _read_devtools_endpoint(path):
    if os.path.islink(path):
        raise RuntimeError("devtools active port symlink rejected")
    with open(path, encoding="utf-8") as handle:
        lines = handle.read(256).splitlines()
    if len(lines) < 1:
        raise _DevtoolsActivePortNotReady("devtools active port missing port")
    try:
        port = int(lines[0])
    except ValueError as exc:
        raise RuntimeError("devtools port invalid") from exc
    if port <= 0 or port > 65535:
        raise RuntimeError("devtools port invalid")
    return f"http://127.0.0.1:{port}"


def _chromium_startup_stderr_limit_bytes_from_env(env):
    raw_value = env.get("FLATKEY_BROWSER_QA_CHROMIUM_STARTUP_STDERR_BYTES")
    if raw_value is None or raw_value == "":
        return 0
    try:
        value = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise ValueError("FLATKEY_BROWSER_QA_CHROMIUM_STARTUP_STDERR_BYTES must be a non-negative integer") from exc
    if value < 0:
        raise ValueError("FLATKEY_BROWSER_QA_CHROMIUM_STARTUP_STDERR_BYTES must be a non-negative integer")
    return value


class RuntimeEvidenceSink:
    def __init__(
        self,
        redactor,
        *,
        evidence_helper=None,
        checkpoint_handler=None,
        host="127.0.0.1",
        port=0,
        max_bytes=1024,
    ):
        self.redactor = redactor
        self.evidence_helper = evidence_helper
        self.checkpoint_handler = checkpoint_handler
        self.host = host
        self.port = port
        self.max_bytes = max_bytes
        self._server = None
        self._thread = None
        self.url = None
        self.runtime_classification = None

    def start(self):
        if self.host not in {"127.0.0.1", "::1"}:
            raise ValueError("runtime evidence sink must be loopback")
        owner = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def do_POST(self):
                if self.client_address[0] not in {"127.0.0.1", "::1"}:
                    self.send_error(403)
                    return
                if self.headers.get("Transfer-Encoding") is not None:
                    self.send_error(400)
                    return
                lengths = self.headers.get_all("Content-Length", [])
                if len(lengths) != 1:
                    self.send_error(400)
                    return
                try:
                    length = int(lengths[0])
                except ValueError:
                    self.send_error(411)
                    return
                if length < 1 or length > owner.max_bytes:
                    self.send_error(413)
                    return
                raw = self.rfile.read(length)
                if self.path != "/runtime-evidence":
                    self.send_error(404)
                    return
                if self.headers.get("Content-Type") != "application/json":
                    self.send_error(415)
                    return
                try:
                    event = json.loads(raw.decode("utf-8"))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    self.send_error(400)
                    return
                if not isinstance(event, dict):
                    self.send_error(400)
                    return
                event_type = event.get("type")
                try:
                    if event_type == "verification_code":
                        code = event.get("code")
                        owner.redactor.register_code(code)
                        if owner.evidence_helper is not None:
                            owner.evidence_helper.register_sensitive_value(code)
                        self.send_response(204)
                        self.send_header("Content-Length", "0")
                        self.end_headers()
                        return
                    elif event_type == "alias_restriction":
                        if not _is_alias_restriction_evidence(event):
                            raise ValueError("invalid alias restriction evidence")
                        owner.runtime_classification = "alias_restriction"
                        self.send_response(204)
                        self.send_header("Content-Length", "0")
                        self.end_headers()
                        return
                    elif event_type == "replay_checkpoint":
                        if set(event) != {"type"} or owner.checkpoint_handler is None:
                            raise ValueError("invalid replay checkpoint request")
                        owner.checkpoint_handler()
                        self.send_response(204)
                        self.send_header("Content-Length", "0")
                        self.end_headers()
                        return
                    elif event_type == "screenshot":
                        if owner.evidence_helper is None:
                            raise ValueError("browser evidence helper unavailable")
                        name = event.get("name")
                        if not isinstance(name, str):
                            raise ValueError("invalid screenshot request")
                        logical_path = owner.evidence_helper.capture_screenshot(name)
                        response = json.dumps({"path": logical_path}, sort_keys=True).encode("utf-8")
                        self.send_response(200)
                        self.send_header("Content-Type", "application/json")
                        self.send_header("Content-Length", str(len(response)))
                        self.end_headers()
                        self.wfile.write(response)
                        return
                    elif event_type == "docs_read":
                        if owner.evidence_helper is None:
                            raise ValueError("browser evidence helper unavailable")
                        url = event.get("url")
                        if not isinstance(url, str):
                            raise ValueError("invalid docs request")
                        result = owner.evidence_helper.read_docs(url)
                        response = json.dumps(result, sort_keys=True).encode("utf-8")
                        if len(response) > 65536:
                            raise ValueError("docs response too large")
                        self.send_response(200)
                        self.send_header("Content-Type", "application/json")
                        self.send_header("Content-Length", str(len(response)))
                        self.end_headers()
                        self.wfile.write(response)
                        return
                    else:
                        raise ValueError("invalid event type")
                except (TypeError, ValueError, RuntimeError):
                    self.send_error(400)
                    return

            def log_message(self, _format, *args):
                return

        try:
            self._server = _ThreadingHttpServer((self.host, self.port), Handler)
            self.host, self.port = self._server.server_address[:2]
            self.url = f"http://{self.host}:{self.port}/runtime-evidence"
            self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
            self._thread.start()
        except Exception:
            if self._server is not None:
                try:
                    self._server.shutdown()
                except Exception:
                    pass
                self._server.server_close()
            raise
        return self

    def stop(self):
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
        if self._thread is not None:
            self._thread.join(timeout=2)


class _ThreadingHttpServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def _is_alias_restriction_evidence(event):
    text = event.get("text")
    failed = event.get("failed")
    marker = "\u7ba1\u7406\u5458\u5df2\u542f\u7528\u90ae\u7bb1\u5730\u5740\u522b\u540d\u9650\u5236\uff0c\u60a8\u7684\u90ae\u7bb1\u5730\u5740\u7531\u4e8e\u5305\u542b\u7279\u6b8a\u7b26\u53f7\u800c\u88ab\u62d2\u7edd\u3002"
    return failed is True and isinstance(text, str) and marker in text


def write_browser_evidence_artifacts(runtime_root, raw_events, redactor):
    if not isinstance(raw_events, dict):
        raise RuntimeError("browser evidence must be an object")
    console = raw_events.get("console", [])
    network = raw_events.get("network", [])
    if not isinstance(console, list) or not isinstance(network, list):
        raise RuntimeError("browser evidence streams must be arrays")
    if len(console) + len(network) > MAX_BROWSER_EVIDENCE_EVENTS:
        raise RuntimeError("browser evidence exceeded event limit")
    browser_dir = os.path.join(runtime_root, "browser")
    os.makedirs(browser_dir, mode=0o700, exist_ok=True)
    _write_jsonl_private(os.path.join(browser_dir, "console.jsonl"), (_project_console_event(item, redactor) for item in console))
    _write_jsonl_private(os.path.join(browser_dir, "network.jsonl"), (_project_network_event(item, redactor) for item in network))


def _write_jsonl_private(path, items):
    total = 0
    with _private_text_writer(path) as handle:
        for item in items:
            line = json.dumps(item, sort_keys=True) + "\n"
            size = len(line.encode("utf-8"))
            if size > MAX_BROWSER_EVIDENCE_EVENT_BYTES:
                raise RuntimeError("browser evidence event exceeded limit")
            total += size
            if total > MAX_BROWSER_EVIDENCE_TOTAL_BYTES:
                raise RuntimeError("browser evidence exceeded total limit")
            handle.write(line)


def _project_console_event(item, redactor):
    if not isinstance(item, dict):
        raise RuntimeError("browser console event invalid")
    projected = {}
    for key in ("type", "text", "location"):
        if key in item:
            projected[key] = item[key]
    return redactor.clean(projected)


def _project_network_event(item, redactor):
    if not isinstance(item, dict):
        raise RuntimeError("browser network event invalid")
    projected = {}
    for key in ("url", "method", "status", "timing", "error"):
        if key in item:
            projected[key] = item[key]
    return redactor.clean(projected)


def _cleanup_runtime_child_dir(runtime_root, name):
    if name in ("", ".", "..") or os.path.sep in name or (os.path.altsep and os.path.altsep in name):
        raise RuntimeError("unsafe runtime child name")
    runtime_real = os.path.realpath(runtime_root)
    child_path = os.path.join(runtime_real, name)
    if os.path.exists(child_path):
        try:
            child_stat = os.lstat(child_path)
        except OSError as exc:
            raise RuntimeError("runtime cleanup child unavailable") from exc
        if os.path.islink(child_path) or _is_reparse_point(child_stat):
            raise RuntimeError("runtime cleanup symlink rejected")
    target = os.path.realpath(child_path)
    if not target.startswith(runtime_real + os.sep):
        raise RuntimeError("runtime cleanup path escaped root")
    if os.path.exists(target):
        shutil.rmtree(target)


def _is_reparse_point(stat_result):
    return bool(getattr(stat_result, "st_file_attributes", 0) & getattr(os.stat_result, "FILE_ATTRIBUTE_REPARSE_POINT", 0))


def _collect_artifact_paths(runtime_root):
    candidates = [
        "result.json",
        "codex-events.jsonl",
        "codex-stderr.txt",
        "browser/console.jsonl",
        "browser/network.jsonl",
    ]
    screenshots_dir = os.path.join(runtime_root, "screenshots")
    if os.path.isdir(screenshots_dir) and not os.path.islink(screenshots_dir):
        for name in sorted(os.listdir(screenshots_dir)):
            candidates.append(f"screenshots/{name}")
    candidates.append("manifest.json")
    return [item for item in candidates if os.path.exists(os.path.join(runtime_root, item.replace("/", os.sep)))]


def _write_candidate_bundles(manifest, manifest_path, payload, *, mode, allowed_origins, run_id, bucket, execution_id, redactor):
    updated = dict(manifest)
    updated["candidates"] = []
    candidate_events = []
    if mode != "normal":
        _write_private_json(manifest_path, redactor.clean(updated))
        return updated
    evidence_uri = f"gs://{bucket}/runs/{run_id}/main/{execution_id}/manifest.json"
    existing = set()
    bundles = []
    for kind, observations in (
        ("finding", payload.get("findings", []) if isinstance(payload, dict) else []),
        ("coverage", payload.get("coverage_candidates", []) if isinstance(payload, dict) else []),
    ):
        if not isinstance(observations, list):
            continue
        for observation in observations:
            qualified = promotion.qualify_candidate(
                kind,
                observation,
                allowed_origins=set(allowed_origins),
                existing_fingerprints=existing,
            )
            if qualified is None:
                continue
            try:
                bundle = promotion.build_candidate_bundle(qualified, run_id=run_id, evidence_uri=evidence_uri)
            except ValueError:
                candidate_events.append({"kind": "candidate_bundle_failed", "candidate_kind": kind})
                continue
            existing.add(bundle["fingerprint"])
            bundles.append(redactor.clean(bundle))
    updated["candidates"] = bundles
    if candidate_events:
        updated["candidate_events"] = candidate_events
    _write_private_json(manifest_path, redactor.clean(updated))
    return updated


class GcsArtifactUploader:
    def __init__(
        self,
        *,
        bucket,
        run_id,
        execution_id,
        runtime_root,
        token_provider,
        upload_func=upload_gcs_object,
        max_total_bytes=MAX_GCS_ARTIFACT_TOTAL_BYTES,
    ):
        self.bucket = bucket
        self.run_id = run_id
        self.execution_id = execution_id
        self.runtime_root = os.path.realpath(runtime_root)
        self.token_provider = token_provider
        self.upload_func = upload_func
        self.max_total_bytes = max_total_bytes

    def upload(self, manifest_path, artifact_paths):
        if not _safe_gcs_component(self.run_id) or not _safe_gcs_component(self.execution_id):
            raise ValueError("unsafe gcs object prefix")
        ordered = self._validated_artifacts(manifest_path, artifact_paths)
        access_token = self.token_provider()
        uploaded = []
        for logical_path, real_path, content_type in ordered:
            object_name = f"runs/{self.run_id}/main/{self.execution_id}/{logical_path}"
            with open(real_path, "rb") as handle:
                data = handle.read()
            uploaded.append(
                self.upload_func(self.bucket, object_name, data, content_type, access_token)
            )
        return {"uploaded": uploaded}

    def _validated_artifacts(self, manifest_path, artifact_paths):
        manifest = _validated_artifact_path(self.runtime_root, manifest_path)
        ordered = []
        seen_logical = set()
        seen_real = set()
        total = 0
        for path in artifact_paths:
            logical, real, content_type = _validated_artifact_path(self.runtime_root, path)
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


def _safe_gcs_component(value):
    return isinstance(value, str) and SAFE_GCS_COMPONENT.fullmatch(value) is not None and ".." not in value


def _validated_artifact_path(runtime_root, path):
    logical = _normalize_artifact_logical_path(path)
    if not _allowed_artifact_logical_path(logical):
        raise ValueError("unexpected artifact name")
    runtime_real = os.path.realpath(runtime_root)
    _reject_symlinked_artifact_components(runtime_real, logical)
    filesystem_path = os.path.join(runtime_real, *logical.split("/"))
    real = os.path.realpath(filesystem_path)
    if not real.startswith(runtime_real + os.sep):
        raise ValueError("artifact outside runtime root")
    if not os.path.isfile(real):
        raise ValueError("artifact must be a regular file")
    return logical, real, _artifact_content_type(logical)


def _reject_symlinked_artifact_components(runtime_root, logical):
    current = runtime_root
    for part in logical.split("/"):
        current = os.path.join(current, part)
        try:
            os.lstat(current)
        except FileNotFoundError as exc:
            raise ValueError("artifact must exist") from exc
        if os.path.islink(current):
            raise ValueError("artifact symlink rejected")


def _normalize_artifact_logical_path(path):
    if not isinstance(path, str) or not path:
        raise ValueError("artifact path invalid")
    if os.path.isabs(path) or "\\" in path or path.startswith("/") or path.startswith("//"):
        raise ValueError("artifact path must be relative POSIX")
    parts = path.split("/")
    if any(part in ("", ".", "..") for part in parts):
        raise ValueError("artifact path must be relative POSIX")
    return "/".join(parts)


def _allowed_artifact_logical_path(logical):
    if logical in ROOT_GCS_ARTIFACT_NAMES or logical in EXACT_NESTED_GCS_ARTIFACT_NAMES:
        return True
    if logical.startswith("screenshots/") and logical.count("/") == 1:
        return SAFE_SCREENSHOT_NAME.fullmatch(logical.split("/", 1)[1]) is not None
    return False


def _artifact_content_type(logical):
    if logical.endswith(".png"):
        return "image/png"
    if logical.endswith(".jsonl"):
        return "application/x-ndjson"
    if logical.endswith(".json"):
        return "application/json"
    return "text/plain"


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    if argv:
        raise SystemExit(2)
    env = os.environ
    runtime_root = env.get("FLATKEY_BROWSER_QA_RUNTIME_ROOT") or tempfile.mkdtemp(prefix="flatkey-browser-qa-")
    gcp = GcpClient()
    bucket = env["FLATKEY_BROWSER_QA_GCS_BUCKET"]
    execution_id = env["FLATKEY_BROWSER_QA_EXECUTION_ID"]
    run_id = env["FLATKEY_QA_RUN_ID"]
    uploader = GcsArtifactUploader(
        bucket=bucket,
        run_id=run_id,
        execution_id=execution_id,
        runtime_root=runtime_root,
        token_provider=gcp.access_token,
    )
    sup = Supervisor(
        env=env,
        runtime_root=runtime_root,
        subprocess_runner=subprocess,
        uploader=uploader,
        cleanup_runner=CleanupRunner(StagingApiClient(env["FLATKEY_QA_CONSOLE_ORIGIN"])),
        clock=time,
        chromium_startup_stderr_limit_bytes=_chromium_startup_stderr_limit_bytes_from_env(env),
    )
    outcome = sup.run()
    return 0 if outcome.status == "passed" else 1


if __name__ == "__main__":
    raise SystemExit(main())
