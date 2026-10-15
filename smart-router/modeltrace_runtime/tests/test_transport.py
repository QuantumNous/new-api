import hashlib
import http.server
import json
import os
from pathlib import Path
import socket
import sys
import threading
import time
import unittest
from unittest.mock import patch

from modeltrace_runtime import transport as transport_module
from modeltrace_runtime.transport import request_once


TARGET = {
    "base_url": "https://provider.example", "api_model": "sample-model",
    "api_key": "test-sentinel", "api_format": "openai",
}
CHALLENGE = {
    "id": "challenge-1", "prompt": "controlled test", "expected_count": 300,
}


def openai_body(text="3, 2, 3", finish="stop", refusal=None):
    return {"choices": [{"message": {"content": text, "refusal": refusal},
                         "finish_reason": finish}]}


class OwnedProvider:
    def __init__(self, mode="ok", protocol="openai"):
        self.mode = mode
        self.protocol = protocol
        self.posts = []
        self.release = threading.Event()
        owner = self

        class Handler(http.server.BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_POST(self):
                payload = self.rfile.read(int(self.headers["Content-Length"]))
                owner.posts.append((self.path, dict(self.headers),
                                    json.loads(payload)))
                body = (
                    openai_body(", ".join(["3", "2", "3"] * 120))
                    if owner.protocol == "openai" else {
                        "content": [{"type": "text", "text": ", ".join(["2"] * 300)}],
                        "stop_reason": "end_turn",
                    }
                )
                if owner.mode == "redirect":
                    self.send_response(302)
                    self.send_header("Location", "http://127.0.0.1:1/secret")
                    self.send_header("Content-Length", "0")
                    self.end_headers()
                    return
                if owner.mode == "oversized":
                    payload = b"x" * (256 * 1024 + 1)
                else:
                    payload = json.dumps(body).encode()
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                if owner.mode == "stall":
                    self.wfile.write(payload[:1])
                    self.wfile.flush()
                    owner.release.wait(5)
                    return
                try:
                    self.wfile.write(payload)
                except (BrokenPipeError, ConnectionResetError):
                    pass

        self.server = http.server.HTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever)

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *args):
        self.release.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(5)
        if self.thread.is_alive():
            raise AssertionError("owned provider did not stop")

    def target(self):
        return {**TARGET, "api_format": self.protocol,
                "base_url": "http://127.0.0.1:" + str(self.server.server_port)}

    def transport(self, **kwargs):
        return transport_module.OneShotTransport._for_test(
            self.server.socket, **kwargs)


class TransportTest(unittest.TestCase):
    def test_unknown_write_calls_transport_once_and_stops(self):
        calls = []

        def interrupted(request):
            calls.append(request)
            raise TimeoutError("synthetic interruption")

        result = request_once(TARGET, CHALLENGE, interrupted)
        self.assertEqual(len(calls), 1)
        self.assertEqual(result["status"], "write_unknown")

    def test_openai_unary_text_and_content_parts(self):
        for content in ("3, 2, 3", [{"type": "text", "text": "3, 2, 3"}]):
            with self.subTest(shape=type(content).__name__):
                calls = []

                def provider(request):
                    calls.append(request)
                    return {"status_code": 200, "body": {"choices": [{
                        "message": {"content": content}, "finish_reason": "stop",
                    }]}}

                result = request_once(TARGET, CHALLENGE, provider)
                self.assertEqual(calls, [{
                    "url": "https://provider.example/v1/chat/completions",
                    "headers": {"Authorization": "Bearer test-sentinel",
                                "Content-Type": "application/json"},
                    "body": {"model": "sample-model", "max_tokens": 4096,
                             "stream": False,
                             "messages": [{"role": "user",
                                           "content": "controlled test"}]},
                }])
                self.assertEqual(result["numbers"], [3, 2, 3])
                self.assertEqual(result["status"], "ok")

    def test_anthropic_text_blocks(self):
        calls = []
        expected_request = {
            "url": "https://provider.example/v1/messages",
            "headers": {"x-api-key": "test-sentinel",
                        "anthropic-version": "2023-06-01",
                        "Content-Type": "application/json"},
            "body": {"model": "sample-model", "max_tokens": 4096,
                     "stream": False, "messages": [
                         {"role": "user", "content": "controlled test"}]},
        }

        def provider(request):
            calls.append(request)
            self.assertEqual(request, expected_request)
            return {"status_code": 200, "body": {
                "content": [{"type": "text", "text": "3, 2, 3"}],
                "stop_reason": "end_turn",
            }}

        result = request_once(
            {**TARGET, "api_format": "anthropic"}, CHALLENGE, provider)
        self.assertEqual(calls, [expected_request])
        self.assertEqual(result["numbers"], [3, 2, 3])
        self.assertEqual(result["status"], "ok")

    def test_invalid_finish_and_refusal_keep_numbers_but_not_eligibility(self):
        cases = [
            ("openai", openai_body("1, 2, 3", reason))
            for reason in ("length", "content_filter", "tool_calls", None)
        ] + [
            ("openai", openai_body("1, 2, 3", refusal="synthetic-body-secret")),
            ("anthropic", {"content": [{"type": "text", "text": "1, 2, 3"}],
                           "stop_reason": "max_tokens"}),
            ("anthropic", {"content": [{"type": "text", "text": "1, 2, 3"}],
                           "stop_reason": "refusal"}),
        ]
        for protocol, body in cases:
            with self.subTest(protocol=protocol, reason=body.get("stop_reason")):
                result = request_once(
                    {**TARGET, "api_format": protocol}, CHALLENGE,
                    lambda request: {"status_code": 200, "body": body})
                self.assertEqual(result["status"], "invalid_response")
                self.assertFalse(result["eligible"])
                self.assertEqual(result["numbers"], [1, 2, 3])
                self.assertNotIn("synthetic-body-secret", json.dumps(result))

    def test_explicit_protocol_does_not_fallback_after_400(self):
        calls = []

        def provider(request):
            calls.append(request)
            return {"status_code": 400, "body": "synthetic-body-secret"}

        result = request_once(TARGET, CHALLENGE, provider)
        self.assertEqual(len(calls), 1)
        self.assertEqual(result["status"], "http_error")
        self.assertNotIn("synthetic-body-secret", json.dumps(result))

    def test_target_rejects_private_metadata_url_credentials_and_extra_fields(self):
        cases = [
            {**TARGET, "base_url": url} for url in (
                "http://provider.example", "https://localhost",
                "https://127.0.0.1", "https://10.0.0.1",
                "https://169.254.169.254", "https://[::1]",
                "https://[::ffff:127.0.0.1]", "https://user:pass@provider.example",
                "https://provider.example?api_key=sentinel",
            )
        ] + [
            {**TARGET, "api_format": "auto"},
            {**TARGET, "headers": {"Authorization": "sentinel"}},
            {**TARGET, "api_key": "sentinel\r\nInjected: value"},
            {**TARGET, "allow_loopback": True},
        ]
        for index, target in enumerate(cases):
            with self.subTest(case=index):
                calls = []
                result = request_once(target, CHALLENGE, calls.append)
                self.assertEqual(result["status"], "invalid_target")
                self.assertEqual(calls, [])

    def test_numbers_bound_and_longest_run_semantics(self):
        for text, expected, status in (
            ("3,2 alpha 4,4,1 alpha 2", [4, 4, 1], "ok"),
            (",".join(["1"] * 4096), [1] * 4096, "ok"),
            (",".join(["1"] * 4097), [], "invalid_response"),
        ):
            with self.subTest(count=len(expected)):
                result = request_once(
                    TARGET, CHALLENGE,
                    lambda request: {"status_code": 200,
                                     "body": openai_body(text)})
                self.assertEqual(result["status"], status)
                self.assertEqual(result["numbers"], expected)

    def test_request_bound_prevents_invocation(self):
        calls = []
        result = request_once(
            TARGET, {**CHALLENGE, "prompt": "x" * 65536}, calls.append)
        self.assertEqual(result["status"], "invalid_request")
        self.assertEqual(calls, [])

    def test_error_never_echoes_credentials_url_or_exception(self):
        def interrupted(request):
            raise ConnectionError("test-sentinel synthetic-body-secret provider.example")

        result = request_once(TARGET, CHALLENGE, interrupted)
        self.assertEqual(result["status"], "write_unknown")
        for sentinel in ("test-sentinel", "synthetic-body-secret", "provider.example"):
            self.assertNotIn(sentinel, json.dumps(result))

    def test_actual_child_both_protocols_proxy_disabled_and_reaped(self):
        for protocol in ("openai", "anthropic"):
            with self.subTest(protocol=protocol), OwnedProvider(protocol=protocol) as server:
                transport = server.transport()
                with patch.dict(os.environ, {"HTTPS_PROXY": "http://127.0.0.1:1",
                                             "HTTP_PROXY": "http://127.0.0.1:1"}):
                    result = request_once(server.target(), CHALLENGE, transport)
                self.assertEqual(result["status"], "ok")
                self.assertEqual(len(server.posts), 1)
                self.assertEqual(server.posts[0][2]["max_tokens"], 4096)
                self.assertTrue(result["submitted"])
                self.assertTrue(result["response_received"])
                with self.assertRaises(ChildProcessError):
                    os.waitpid(transport.last_child_pid, os.WNOHANG)

    def test_actual_child_redirect_stall_oversize_and_reaping(self):
        for mode, status in (
            ("redirect", "http_error"), ("stall", "write_unknown"),
            ("oversized", "write_unknown"),
        ):
            with self.subTest(mode=mode), OwnedProvider(mode=mode) as server:
                transport = server.transport(slot_timeout=0.8)
                result = request_once(server.target(), CHALLENGE, transport)
                self.assertEqual(result["status"], status)
                self.assertEqual(len(server.posts), 1)
                with self.assertRaises(ChildProcessError):
                    os.waitpid(transport.last_child_pid, os.WNOHANG)

    def test_actual_child_stalled_dns_is_deadlined_and_reaped(self):
        with OwnedProvider() as server:
            transport = server.transport(slot_timeout=0.5, stall_dns=True)
            start = time.monotonic()
            result = request_once(server.target(), CHALLENGE, transport)
            self.assertEqual(result["status"], "write_unknown")
            self.assertLess(time.monotonic() - start, 4)
            self.assertEqual(server.posts, [])
            self.assertFalse(result["submitted"])
            with self.assertRaises(ChildProcessError):
                os.waitpid(transport.last_child_pid, os.WNOHANG)

    def test_loopback_capability_cannot_authorize_another_port(self):
        with OwnedProvider() as server, OwnedProvider() as other:
            result = request_once(other.target(), CHALLENGE, server.transport())
            self.assertEqual(result["status"], "invalid_target")
            self.assertEqual(server.posts + other.posts, [])

    def test_production_interpreter_pin_is_required_and_checked(self):
        actual = hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest()
        transport_module.OneShotTransport(interpreter_sha256=actual)
        with self.assertRaises(ValueError):
            transport_module.OneShotTransport(interpreter_sha256="0" * 64)


if __name__ == "__main__":
    unittest.main()
