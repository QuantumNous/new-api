import json
import os
import subprocess
import sys
import tempfile
import unittest
from unittest import mock
import io
import time

from scripts.browser_qa.flatkey_browser_qa import browser_evidence_mcp
from scripts.browser_qa.flatkey_browser_qa import supervisor


class BrowserEvidenceTests(unittest.TestCase):
    def test_evidence_mcp_initialize_list_call_and_unknown_method_are_jsonrpc_compliant(self):
        stdin = io.StringIO(
            "\n".join([
                json.dumps({"jsonrpc": "2.0", "id": "init", "method": "initialize", "params": {"protocolVersion": "2025-06-18"}}),
                json.dumps({"jsonrpc": "2.0", "id": "list", "method": "tools/list"}),
                json.dumps({
                    "jsonrpc": "2.0",
                    "id": "call",
                    "method": "tools/call",
                    "params": {"name": "qa_capture_screenshot", "arguments": {"name": "checkpoint"}},
                }),
                json.dumps({"jsonrpc": "2.0", "id": "missing", "method": "missing/method"}),
            ])
            + "\n"
        )
        stdout = io.StringIO()
        with mock.patch.dict(os.environ, {"FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL": "http://127.0.0.1:1/runtime-evidence"}, clear=True), \
            mock.patch.object(sys, "stdin", stdin), \
            mock.patch.object(sys, "stdout", stdout), \
            mock.patch.object(browser_evidence_mcp, "_request_capture", return_value="screenshots/checkpoint.png"):
            browser_evidence_mcp.main()

        responses = [json.loads(line) for line in stdout.getvalue().splitlines()]
        self.assertEqual(responses[0]["result"]["protocolVersion"], "2025-06-18")
        self.assertEqual(responses[0]["result"]["capabilities"], {"tools": {}})
        self.assertEqual(responses[0]["result"]["serverInfo"]["name"], "flatkey-browser-evidence")
        self.assertEqual([tool["name"] for tool in responses[1]["result"]["tools"]], ["qa_capture_screenshot"])
        self.assertEqual(responses[2]["result"]["content"][0]["text"], "screenshots/checkpoint.png")
        self.assertEqual(responses[3]["error"]["code"], -32601)

    def test_evidence_mcp_silences_notifications_and_no_id_requests_without_side_effects(self):
        stdin = io.StringIO(
            "\n".join([
                json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}),
                json.dumps({"jsonrpc": "2.0", "method": "unknown/method"}),
                json.dumps({
                    "jsonrpc": "2.0",
                    "method": "tools/call",
                    "params": {"name": "qa_capture_screenshot", "arguments": {"name": "checkpoint"}},
                }),
            ])
            + "\n"
        )
        stdout = io.StringIO()
        with mock.patch.dict(os.environ, {"FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL": "http://127.0.0.1:1/runtime-evidence"}, clear=True), \
            mock.patch.object(sys, "stdin", stdin), \
            mock.patch.object(sys, "stdout", stdout), \
            mock.patch.object(browser_evidence_mcp, "_request_capture", return_value="screenshots/checkpoint.png") as capture:
            browser_evidence_mcp.main()

        self.assertEqual(stdout.getvalue(), "")
        capture.assert_not_called()

    def test_evidence_mcp_rejects_invalid_frames_and_extra_screenshot_arguments(self):
        stdin = io.StringIO(
            "\n".join([
                json.dumps("not-object"),
                json.dumps({
                    "jsonrpc": "2.0",
                    "id": "extra",
                    "method": "tools/call",
                    "params": {"name": "qa_capture_screenshot", "arguments": {"name": "checkpoint", "filename": "leak.png"}},
                }),
                json.dumps({
                    "jsonrpc": "2.0",
                    "id": "ok",
                    "method": "tools/call",
                    "params": {"name": "qa_capture_screenshot", "arguments": {"name": "checkpoint"}},
                }),
            ])
            + "\n"
        )
        stdout = io.StringIO()
        with mock.patch.dict(os.environ, {"FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL": "http://127.0.0.1:1/runtime-evidence"}, clear=True), \
            mock.patch.object(sys, "stdin", stdin), \
            mock.patch.object(sys, "stdout", stdout), \
            mock.patch.object(browser_evidence_mcp, "_request_capture", return_value="screenshots/checkpoint.png") as capture:
            browser_evidence_mcp.main()

        responses = [json.loads(line) for line in stdout.getvalue().splitlines()]
        self.assertEqual(responses[0]["error"]["code"], -32600)
        self.assertEqual(responses[1]["id"], "extra")
        self.assertEqual(responses[1]["error"]["code"], -32602)
        self.assertEqual(responses[2]["id"], "ok")
        self.assertEqual(responses[2]["result"]["content"][0]["text"], "screenshots/checkpoint.png")
        capture.assert_called_once_with("http://127.0.0.1:1/runtime-evidence", "checkpoint")

    def test_evidence_mcp_uses_runtime_control_url_not_cdp_or_secret_argv(self):
        stdout = io.StringIO()
        stdin = io.StringIO(json.dumps({
            "jsonrpc": "2.0",
            "id": "shot",
            "method": "tools/call",
            "params": {"name": "qa_capture_screenshot", "arguments": {"name": "checkpoint"}},
        }) + "\n")
        calls = []

        def fake_request(url, name):
            calls.append((url, name))
            return "screenshots/checkpoint.png"

        with mock.patch.dict(os.environ, {
            "FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL": "http://127.0.0.1:7777/runtime-evidence",
            "FLATKEY_BROWSER_QA_CDP_ENDPOINT": "http://127.0.0.1:9222",
            "FLATKEY_BROWSER_QA_EMAIL": "owner+secret@gmail.com",
            "FLATKEY_BROWSER_QA_PASSWORD": "pw-secret",
        }, clear=True), \
            mock.patch.object(sys, "stdin", stdin), \
            mock.patch.object(sys, "stdout", stdout), \
            mock.patch.object(browser_evidence_mcp, "_request_capture", fake_request):
            browser_evidence_mcp.main()

        self.assertEqual(calls, [("http://127.0.0.1:7777/runtime-evidence", "checkpoint")])
        self.assertNotIn("9222", stdout.getvalue())
        self.assertNotIn("pw-secret", stdout.getvalue())

    def test_evidence_mcp_request_capture_uses_strict_loopback_url_and_no_proxy_opener(self):
        class FakeResponse:
            def read(self, _limit=-1):
                return b'{"path":"screenshots/checkpoint.png"}'

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

        class FakeOpener:
            def __init__(self):
                self.requests = []

            def open(self, request, timeout=0):
                self.requests.append((request, timeout))
                return FakeResponse()

        opener = FakeOpener()
        self.assertEqual(
            browser_evidence_mcp._request_capture("http://127.0.0.1:7777/runtime-evidence", "checkpoint", opener=opener),
            "screenshots/checkpoint.png",
        )
        self.assertEqual(opener.requests[0][0].full_url, "http://127.0.0.1:7777/runtime-evidence")

        for bad in [
            "https://127.0.0.1:7777/runtime-evidence",
            "http://localhost:7777/runtime-evidence",
            "http://127.0.0.1/runtime-evidence",
            "http://127.0.0.1:0/runtime-evidence",
            "http://127.0.0.1:7777/runtime-evidence/extra",
            "http://127.0.0.1:7777/x/runtime-evidence",
            "http://user:pass@127.0.0.1:7777/runtime-evidence",
            "http://127.0.0.1:7777/runtime-evidence?proxy=1",
        ]:
            with self.subTest(bad=bad):
                with self.assertRaises(RuntimeError):
                    browser_evidence_mcp._request_capture(bad, "checkpoint", opener=opener)

    def test_node_helper_contract_rejects_paths_masks_buffer_screenshot_and_projects_events(self):
        helper_test = os.path.join(
            os.path.dirname(__file__),
            "..",
            "flatkey_browser_qa",
            "browser_evidence_helper.test.cjs",
        )
        result = subprocess.run(
            ["node", helper_test],
            cwd=os.path.realpath(os.path.join(os.path.dirname(__file__), "..", "..", "..")),
            text=True,
            capture_output=True,
            timeout=20,
        )
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_browser_event_writer_redacts_projects_and_fails_closed_on_unbounded_input(self):
        with tempfile.TemporaryDirectory() as runtime_root:
            browser_dir = os.path.join(runtime_root, "browser")
            raw = {
                "console": [{"type": "log", "text": "code 654321 sk-12345678"}],
                "network": [{
                    "url": "https://staging-console.flatkey.ai/api?token=secret",
                    "method": "POST",
                    "status": 200,
                    "headers": {"cookie": "secret"},
                    "postData": "secret",
                    "timing": {"startTime": 1},
                }],
            }
            redactor = supervisor.Redactor(extra_secrets=("654321",))
            supervisor.write_browser_evidence_artifacts(runtime_root, raw, redactor)

            with open(os.path.join(browser_dir, "console.jsonl"), encoding="utf-8") as handle:
                console_event = json.loads(handle.readline())
            with open(os.path.join(browser_dir, "network.jsonl"), encoding="utf-8") as handle:
                network_event = json.loads(handle.readline())
            self.assertNotIn("654321", json.dumps(console_event))
            self.assertNotIn("sk-12345678", json.dumps(console_event))
            self.assertEqual(set(network_event), {"url", "method", "status", "timing"})
            self.assertNotIn("secret", json.dumps(network_event))

            too_many = {"console": [{"text": "x"}] * (supervisor.MAX_BROWSER_EVIDENCE_EVENTS + 1), "network": []}
            with self.assertRaises(RuntimeError):
                supervisor.write_browser_evidence_artifacts(runtime_root, too_many, redactor)

    def test_browser_evidence_helper_protocol_rejects_malformed_and_oversized_frames(self):
        helper = supervisor.BrowserEvidenceHelperProcess(
            browser=type("Browser", (), {"cdp_endpoint": "http://127.0.0.1:9222"})(),
            runtime_root="runtime",
            redactor=supervisor.Redactor(email="owner+alias@gmail.com", password="pw-secret"),
            popen_factory=lambda *_args, **_kwargs: None,
        )
        self.assertEqual(helper._protocol_secrets(), [
            "owner+alias@gmail.com",
            "owner@gmail.com",
            "alias",
            "pw-secret",
        ])
        with self.assertRaises(RuntimeError):
            helper._validate_response("x" * (supervisor.MAX_BROWSER_HELPER_FRAME_BYTES + 1))
        with self.assertRaises(RuntimeError):
            helper._validate_response(json.dumps({"ok": True, "extra": "bad"}))

        for error in (None, {}, [], "untrusted owner+alias@gmail.com pw-secret sk-12345678 654321"):
            with self.subTest(error=error), self.assertRaisesRegex(RuntimeError, "response malformed"):
                helper._validate_response(json.dumps({"id": 1, "ok": False, "error": error}))

        with self.assertRaisesRegex(RuntimeError, "response malformed"):
            helper._validate_response(json.dumps({"id": 1, "ok": False}))

        expected_error_codes = {
            "init_connect_failed",
            "init_context_failed",
            "init_websocket_block_failed",
            "init_download_block_failed",
            "init_service_worker_block_failed",
            "init_page_failed",
            "init_service_worker_bypass_failed",
            "init_failed",
            "command_failed",
        }
        self.assertEqual(supervisor.BROWSER_HELPER_ERROR_CODES, expected_error_codes)
        self.assertIn("executeFixedCase", supervisor.BROWSER_HELPER_COMMANDS)
        for error_code in expected_error_codes:
            with self.subTest(error_code=error_code):
                payload = helper._validate_response(json.dumps({
                    "id": 1,
                    "ok": False,
                    "error": error_code,
                }))
                self.assertEqual(payload["error"], error_code)

    def test_browser_evidence_helper_failed_response_preserves_only_actionable_fixed_code(self):
        class FailedResponseProcess:
            def __init__(self):
                self.stdin = io.StringIO()
                self.stdout = io.StringIO(json.dumps({
                    "id": 1,
                    "ok": False,
                    "error": "init_download_block_failed",
                }) + "\n")

        helper = supervisor.BrowserEvidenceHelperProcess(
            browser=type("Browser", (), {"cdp_endpoint": "http://127.0.0.1:9222"})(),
            runtime_root="runtime",
            redactor=supervisor.Redactor(email="owner+alias@gmail.com", password="pw-secret"),
            popen_factory=lambda *_args, **_kwargs: None,
        )
        helper.process = FailedResponseProcess()

        with self.assertRaisesRegex(
            RuntimeError,
            r"^browser helper init failed: init_download_block_failed$",
        ) as raised:
            helper._request("init", {})

        message = str(raised.exception)
        self.assertLessEqual(len(message), 128)
        for secret in ("owner+alias@gmail.com", "owner@gmail.com", "alias", "pw-secret", "sk-12345678", "654321"):
            self.assertNotIn(secret, message)

    def test_browser_evidence_helper_start_failure_terminates_launched_node(self):
        class FailingInitProcess:
            def __init__(self):
                self.pid = 2468
                self.stdin = io.StringIO()
                self.stdout = io.StringIO("")
                self.terminated = False
                self.killed = False
                self.waited = False

            def terminate(self):
                self.terminated = True

            def wait(self, timeout=None):
                self.waited = True
                return 0

            def kill(self):
                self.killed = True

        launched = []
        popen_calls = []

        def popen_factory(*args, **kwargs):
            popen_calls.append((args, kwargs))
            process = FailingInitProcess()
            launched.append(process)
            return process

        helper = supervisor.BrowserEvidenceHelperProcess(
            browser=type("Browser", (), {"cdp_endpoint": "http://127.0.0.1:9222"})(),
            runtime_root="runtime",
            redactor=supervisor.Redactor(email="owner+alias@gmail.com", password="pw-secret"),
            popen_factory=popen_factory,
        )
        with self.assertRaises(RuntimeError):
            helper.start()

        self.assertEqual(len(launched), 1)
        self.assertTrue(launched[0].terminated)
        self.assertTrue(launched[0].waited)
        if os.name == "nt":
            self.assertEqual(popen_calls[0][1]["creationflags"], subprocess.CREATE_NEW_PROCESS_GROUP)
            self.assertFalse(popen_calls[0][1]["start_new_session"])
        else:
            self.assertEqual(popen_calls[0][1]["creationflags"], 0)
            self.assertTrue(popen_calls[0][1]["start_new_session"])

    def test_browser_evidence_helper_hung_init_times_out_and_terminates_launched_node(self):
        class BlockingStdout:
            def readline(self):
                time.sleep(5)
                return ""

        class HungInitProcess:
            def __init__(self):
                self.stdin = io.StringIO()
                self.stdout = BlockingStdout()
                self.terminated = False
                self.waited = False
                self.killed = False

            def terminate(self):
                self.terminated = True

            def wait(self, timeout=None):
                self.waited = True
                return 0

            def kill(self):
                self.killed = True

        launched = []

        def popen_factory(*_args, **_kwargs):
            process = HungInitProcess()
            launched.append(process)
            return process

        helper = supervisor.BrowserEvidenceHelperProcess(
            browser=type("Browser", (), {"cdp_endpoint": "http://127.0.0.1:9222"})(),
            runtime_root="runtime",
            redactor=supervisor.Redactor(),
            popen_factory=popen_factory,
            response_timeout_seconds=0.01,
        )
        with self.assertRaises(TimeoutError):
            helper.start()

        self.assertEqual(len(launched), 1)
        self.assertTrue(launched[0].terminated)
        self.assertTrue(launched[0].waited)

    def test_runtime_evidence_sink_start_failure_closes_bound_server(self):
        class FakeServer:
            server_address = ("127.0.0.1", 8123)

            def __init__(self):
                self.shutdown_called = False
                self.closed = False

            def serve_forever(self):
                return None

            def shutdown(self):
                self.shutdown_called = True

            def server_close(self):
                self.closed = True

        class FailingThread:
            def __init__(self, target, daemon=False):
                self.target = target
                self.daemon = daemon

            def start(self):
                raise RuntimeError("thread failed")

        fake_server = FakeServer()
        with mock.patch.object(supervisor, "_ThreadingHttpServer", lambda *_args, **_kwargs: fake_server), \
            mock.patch.object(supervisor.threading, "Thread", FailingThread):
            sink = supervisor.RuntimeEvidenceSink(supervisor.Redactor())
            with self.assertRaises(RuntimeError):
                sink.start()

        self.assertTrue(fake_server.shutdown_called)
        self.assertTrue(fake_server.closed)


if __name__ == "__main__":
    unittest.main()
