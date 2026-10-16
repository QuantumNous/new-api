import inspect
import copy
import hashlib
import hmac
import os
from http.server import BaseHTTPRequestHandler, HTTPServer
import json
from pathlib import Path
import socket
import threading
import unittest
from unittest.mock import patch

from modeltrace_runtime import export, workbench


KEY = b"synthetic-independent-ingest-fixture-000"
BINDING = "bnd_" + "A" * 24


def evidence_fixture():
    return {
        "schema_version": 1, "probe_id": "numeric-probe-1", "binding_id": BINDING,
        "claimed_model": "GPT-4o", "protocol": "chat", "bank_revision": "a" * 64,
        "samples": [{"challenge_id": "slot-1", "expected_count": 80,
                     "numbers": [2, 1, 2, 355] * 20}],
    }


class SignedDaemonFixture:
    def __init__(self):
        self.requests = []
        self.mode = "ok"
        self.release = threading.Event()
        self.received = threading.Event()
        fixture = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def do_POST(self):
                self.exchange()

            def do_GET(self):
                self.exchange()

            def exchange(self):
                payload = self.rfile.read(int(self.headers.get("Content-Length", 0)))
                fixture.requests.append((self.command, self.path, dict(self.headers), payload))
                fixture.received.set()
                if fixture.mode == "disconnect":
                    self.connection.shutdown(socket.SHUT_RDWR)
                    self.connection.close()
                    return
                if fixture.mode == "blocked":
                    self.send_response(200)
                    self.send_header("Content-Length", "100")
                    self.end_headers()
                    self.wfile.write(b"{")
                    self.wfile.flush()
                    fixture.release.wait(15)
                    return
                status = 200
                value = {
                    "probe_id": "numeric-probe-1", "binding_id": BINDING,
                    "claimed_model": "GPT-4o", "protocol": "chat",
                    "evidence_sha256": "b" * 64, "state": "running",
                    "observed_at": "2026-10-16T00:00:00Z", "result": None, "error_code": "",
                }
                if fixture.mode == "stale":
                    status, value = 400, {"error": "invalid_request"}
                if fixture.mode == "redirect":
                    status, value = 307, {"error": "not_found"}
                if fixture.mode == "unsafe":
                    value["api_key"] = "synthetic-forbidden-echo"
                payload = json.dumps(value).encode()
                self.send_response(status)
                if fixture.mode == "redirect":
                    self.send_header("Location", "/v1/modeltrace/probes")
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)

        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever)
        self.thread.start()
        self.url = "http://127.0.0.1:" + str(self.server.server_port)

    def close(self):
        self.release.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(3)
        if self.thread.is_alive():
            raise AssertionError("synthetic daemon thread was not reaped")


class SignedExportTest(unittest.TestCase):
    def setUp(self):
        self.daemon = SignedDaemonFixture()
        self.addCleanup(self.daemon.close)

    def client(self, **limits):
        if "daemon_url" not in inspect.signature(export.ExportClient).parameters:
            self.fail("signed daemon configuration is missing")
        return export.ExportClient(self.daemon.url, KEY, **limits)

    def test_exact_bytes_headers_and_signed_same_id_readback(self):
        client = self.client()
        evidence = evidence_fixture()
        original = copy.deepcopy(evidence)
        result = client.submit(evidence)
        self.assertEqual(result["state"], "running")
        self.assertEqual(client.get(evidence["probe_id"])["probe_id"], evidence["probe_id"])
        self.assertEqual(evidence, original)
        self.assertEqual(len(self.daemon.requests), 2)
        nonces = []
        for method, path, headers, payload in self.daemon.requests:
            stamp = headers["X-ModelTrace-Timestamp"]
            nonce = headers["X-ModelTrace-Nonce"]
            signature = headers["X-ModelTrace-Signature"]
            canonical = "\n".join((method, path, stamp, nonce,
                                   hashlib.sha256(payload).hexdigest())).encode()
            self.assertEqual(signature, hmac.new(KEY, canonical, hashlib.sha256).hexdigest())
            self.assertRegex(nonce, r"^[0-9a-f]{32}$")
            nonces.append(nonce)
            if method == "POST":
                self.assertEqual(json.loads(payload), original)
            else:
                self.assertEqual(payload, b"")
                self.assertEqual(path, "/v1/modeltrace/probes/numeric-probe-1")
        self.assertNotEqual(*nonces)

    def test_unknown_post_redirect_and_stale_have_no_retry(self):
        client = self.client()
        for mode, expected in (("disconnect", "write_unknown"), ("redirect", "write_unknown"),
                               ("stale", "invalid_request"), ("unsafe", "write_unknown")):
            self.daemon.mode = mode
            before = len(self.daemon.requests)
            result = client.submit(evidence_fixture())
            self.assertEqual(result, {"error": expected})
            self.assertEqual(len(self.daemon.requests) - before, 1)
        self.daemon.mode = "ok"
        self.assertEqual(client.get("numeric-probe-1")["state"], "running")
        self.assertEqual(sum(method == "POST" for method, *_ in self.daemon.requests), 4)

    def test_whole_body_deadline_cancels_owned_io(self):
        client = self.client(connect_timeout=1, whole_timeout=5)
        self.daemon.mode = "blocked"
        completed = threading.Event()
        children, responses = [], []
        spawn = workbench.subprocess.Popen

        def observed_child(*args, **kwargs):
            child = spawn(*args, **kwargs)
            children.append(child)
            return child

        def submit():
            try:
                responses.append(client.submit(evidence_fixture()))
            finally:
                completed.set()

        with patch.object(workbench.subprocess, "Popen", side_effect=observed_child):
            handler = threading.Thread(target=submit)
            handler.start()
            try:
                self.assertTrue(self.daemon.received.wait(4),
                                "body-deadline fixture never admitted its request")
                self.assertTrue(completed.wait(6), "owned I/O exceeded its whole deadline")
                handler.join(1)
                self.assertFalse(handler.is_alive())
                self.assertEqual(responses, [{"error": "write_unknown"}])
                self.assertEqual(len(self.daemon.requests), 1)
                self.assertEqual(len(children), 1)
                self.assertIsNotNone(children[0].returncode)
                with self.assertRaises(ChildProcessError):
                    os.waitpid(children[0].pid, os.WNOHANG)
            finally:
                self.daemon.release.set()
                handler.join(10)

    def test_evidence_caps_and_identity_fail_before_http(self):
        client = self.client()
        changes = [
            {"binding_id": "GPT-4o"}, {"schema_version": True}, {"protocol": "openai"},
            {"api_key": "forbidden"}, {"claimed_model": "Bearer synthetic"},
            {"samples": []}, {"samples": evidence_fixture()["samples"] * 2},
            {"samples": [{"challenge_id": "x", "expected_count": 80, "numbers": [1] * 4097}]},
            {"samples": [{"challenge_id": "x", "expected_count": 80, "numbers": [True] * 80}]},
            {"samples": [{"challenge_id": "x", "expected_count": 80, "numbers": [1] * 79}]},
        ]
        for change in changes:
            with self.subTest(change=next(iter(change))):
                value = {**evidence_fixture(), **change}
                self.assertEqual(client.submit(value), {"error": "invalid_request"})
        self.assertEqual(self.daemon.requests, [])


class CompilationSetupTest(unittest.TestCase):
    def test_callable_modules_compile(self):
        for module in (workbench, export):
            source = Path(module.__file__)
            compile(source.read_bytes(), str(source), "exec")
        self.assertEqual(list(inspect.signature(workbench.create_app).parameters), [
            "bank_store", "transport", "operations", "export_client",
        ])
        self.assertTrue(callable(export.ExportClient.submit))
        self.assertTrue(callable(export.ExportClient.get))
