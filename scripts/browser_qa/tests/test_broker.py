import http.client
import json
import socket
import threading
import time
import unittest
from contextlib import redirect_stderr
from contextlib import redirect_stdout
from http.server import ThreadingHTTPServer
from io import StringIO
from unittest import mock

from scripts.browser_qa.flatkey_browser_qa import broker
from scripts.browser_qa.flatkey_browser_qa.broker import BrokerConfig, VerificationBroker, make_handler
from scripts.browser_qa.flatkey_browser_qa.gmail import GmailInvalidGrant
from scripts.browser_qa.flatkey_browser_qa.gmail import GmailPermanentError


class FakeGmail:
    base_address = "owner@gmail.com"

    def __init__(self, code=None, error=None):
        self.code = code
        self.error = error
        self.searches = []

    def find_verification_code(self, search):
        self.searches.append(search)
        if self.error is not None:
            raise self.error
        return self.code


class BrokerTests(unittest.TestCase):
    def start_broker(self, gmail, *, log=None):
        kwargs = {
            "sender": "noreply@flatkey.ai",
            "subject_marker": "Flatkey Email Verification",
            "request_timeout_seconds": 0.2,
            "now": lambda: 1800000060,
        }
        if log == "default":
            config = BrokerConfig(**kwargs)
        else:
            config = BrokerConfig(**kwargs, log=log or (lambda _event: None))
        broker = VerificationBroker(gmail, config)
        server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(broker))
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        return server, thread

    def request(self, server, method, path, body=None, headers=None):
        host, port = server.server_address
        conn = http.client.HTTPConnection(host, port, timeout=5)
        raw = None if body is None else json.dumps(body).encode("utf-8")
        conn.request(method, path, body=raw, headers=headers or {"Content-Type": "application/json"})
        response = conn.getresponse()
        payload = response.read()
        conn.close()
        return response.status, json.loads(payload.decode("utf-8"))

    def raw_request(self, server, data, *, timeout=3):
        host, port = server.server_address
        with socket.create_connection((host, port), timeout=timeout) as sock:
            sock.settimeout(timeout)
            sock.sendall(data)
            chunks = []
            while b"\r\n\r\n" not in b"".join(chunks):
                chunks.append(sock.recv(4096))
            head, _, rest = b"".join(chunks).partition(b"\r\n\r\n")
            length = 0
            for line in head.decode("iso-8859-1").split("\r\n"):
                if line.lower().startswith("content-length:"):
                    length = int(line.split(":", 1)[1].strip())
            body = rest
            while len(body) < length:
                body += sock.recv(4096)
            status = int(head.split(b" ", 2)[1])
            return status, json.loads(body.decode("utf-8"))

    def test_returns_ready_or_pending_only_for_valid_current_code_request(self):
        gmail = FakeGmail("123456")
        server, thread = self.start_broker(gmail)
        try:
            status, payload = self.request(
                server,
                "POST",
                "/v1/current-code",
                {"run_id": "123456789", "email_tag": "qa-123456789-abc123de", "start_time": 1800000000},
            )
            pending_status, pending_payload = self.request(
                server,
                "POST",
                "/v1/current-code",
                {"run_id": "123456789", "email_tag": "qa-123456789-abc123de", "start_time": 1800000000},
            )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertEqual(status, 200)
        self.assertEqual(payload, {"status": "ready", "code": "123456"})
        self.assertEqual(pending_status, 200)
        self.assertEqual(pending_payload, {"status": "ready", "code": "123456"})
        self.assertEqual(gmail.searches[0].email_tag, "qa-123456789-abc123de")
        self.assertEqual(gmail.searches[0].run_start_epoch, 1800000000)

    def test_rejects_method_path_content_type_unknown_fields_and_alias_tampering(self):
        cases = [
            ("GET", "/v1/current-code", None, {"Content-Type": "application/json"}, "method_not_allowed"),
            ("POST", "/wrong", {}, {"Content-Type": "application/json"}, "not_found"),
            ("POST", "/v1/current-code", {}, {"Content-Type": "text/plain"}, "unsupported_media_type"),
            (
                "POST",
                "/v1/current-code",
                {"run_id": "123", "email_tag": "qa-123-abcdefgh", "start_time": 1800000000, "base": "owner@gmail.com"},
                {"Content-Type": "application/json"},
                "invalid_fields",
            ),
            (
                "POST",
                "/v1/current-code",
                {"run_id": "123", "email_tag": "qa-124-abcdefgh", "start_time": 1800000000},
                {"Content-Type": "application/json"},
                "invalid_email_tag",
            ),
            (
                "POST",
                "/v1/current-code",
                {"run_id": "１２３", "email_tag": "qa-123-abcdefgh", "start_time": 1800000000},
                {"Content-Type": "application/json"},
                "invalid_run_id",
            ),
        ]
        server, thread = self.start_broker(FakeGmail())
        try:
            for method, path, body, headers, code in cases:
                with self.subTest(code=code):
                    status, payload = self.request(server, method, path, body, headers)
                    self.assertGreaterEqual(status, 400)
                    self.assertEqual(payload, {"error": code})
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

    def test_rejects_stale_future_oversized_chunked_invalid_json_and_malformed_tags(self):
        server, thread = self.start_broker(FakeGmail())
        host, port = server.server_address
        try:
            stale = self.request(
                server,
                "POST",
                "/v1/current-code",
                {"run_id": "123", "email_tag": "qa-123-abcdefgh", "start_time": 1799990000},
            )
            future = self.request(
                server,
                "POST",
                "/v1/current-code",
                {"run_id": "123", "email_tag": "qa-123-abcdefgh", "start_time": 1800000400},
            )
            malformed_tags = [
                {"run_id": "123", "email_tag": "qa-123-ABCDEF12", "start_time": 1800000000},
                {"run_id": "123", "email_tag": "flatkey-qa-123-abcdefghij", "start_time": 1800000000},
                {"run_id": "123", "email_tag": "qa-123-abcdefghi", "start_time": 1800000000},
            ]
            bad_tags = [self.request(server, "POST", "/v1/current-code", body) for body in malformed_tags]

            conn = http.client.HTTPConnection(host, port, timeout=5)
            conn.putrequest("POST", "/v1/current-code")
            conn.putheader("Content-Type", "application/json")
            conn.putheader("Transfer-Encoding", "chunked")
            conn.endheaders()
            conn.send(b"0\r\n\r\n")
            chunked_response = conn.getresponse()
            chunked = (chunked_response.status, json.loads(chunked_response.read().decode("utf-8")))
            conn.close()

            conn = http.client.HTTPConnection(host, port, timeout=5)
            conn.request("POST", "/v1/current-code", body=b"x" * 4097, headers={"Content-Type": "application/json"})
            oversized_response = conn.getresponse()
            oversized = (oversized_response.status, json.loads(oversized_response.read().decode("utf-8")))
            conn.close()

            conn = http.client.HTTPConnection(host, port, timeout=5)
            conn.request("POST", "/v1/current-code", body=b"{", headers={"Content-Type": "application/json"})
            invalid_response = conn.getresponse()
            invalid = (invalid_response.status, json.loads(invalid_response.read().decode("utf-8")))
            conn.close()
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertEqual(stale[1], {"error": "invalid_time_window"})
        self.assertEqual(future[1], {"error": "invalid_time_window"})
        self.assertEqual([payload for _status, payload in bad_tags], [{"error": "invalid_email_tag"}] * 3)
        self.assertEqual(chunked, (411, {"error": "length_required"}))
        self.assertEqual(oversized, (413, {"error": "body_too_large"}))
        self.assertEqual(invalid[1], {"error": "invalid_json"})

    def test_rejects_negative_content_length_without_reading_unbounded_body(self):
        server, thread = self.start_broker(FakeGmail())
        try:
            status, payload = self.raw_request(
                server,
                b"POST /v1/current-code HTTP/1.1\r\n"
                b"Host: localhost\r\n"
                b"Content-Type: application/json\r\n"
                b"Content-Length: -1\r\n"
                b"\r\n",
            )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertEqual(status, 400)
        self.assertEqual(payload, {"error": "invalid_content_length"})

    def test_slow_body_read_timeout_returns_stable_error(self):
        server, thread = self.start_broker(FakeGmail())
        host, port = server.server_address
        try:
            with socket.create_connection((host, port), timeout=3) as sock:
                sock.settimeout(3)
                sock.sendall(
                    b"POST /v1/current-code HTTP/1.1\r\n"
                    b"Host: localhost\r\n"
                    b"Content-Type: application/json\r\n"
                    b"Content-Length: 20\r\n"
                    b"\r\n"
                    b"{"
                )
                chunks = []
                while b"\r\n\r\n" not in b"".join(chunks):
                    chunks.append(sock.recv(4096))
                head, _, rest = b"".join(chunks).partition(b"\r\n\r\n")
                length = 0
                for line in head.decode("iso-8859-1").split("\r\n"):
                    if line.lower().startswith("content-length:"):
                        length = int(line.split(":", 1)[1].strip())
                body = rest
                while len(body) < length:
                    body += sock.recv(4096)
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertEqual(int(head.split(b" ", 2)[1]), 408)
        self.assertEqual(json.loads(body.decode("utf-8")), {"error": "request_timeout"})

    def test_gmail_invalid_grant_returns_stable_json_without_secret_logs(self):
        stderr = StringIO()
        logs = []
        server, thread = self.start_broker(
            FakeGmail(error=GmailInvalidGrant("refresh-secret invalid_grant owner@gmail.com")),
            log=logs.append,
        )
        try:
            with redirect_stderr(stderr):
                status, payload = self.request(
                    server,
                    "POST",
                    "/v1/current-code",
                    {"run_id": "123", "email_tag": "qa-123-abcdefgh", "start_time": 1800000000},
                )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertEqual(status, 503)
        self.assertEqual(payload, {"error": "gmail_invalid_grant"})
        combined = stderr.getvalue() + json.dumps(logs)
        for secret in ["refresh-secret", "owner", "gmail", "abcdefgh", "qa-"]:
            self.assertNotIn(secret, combined)
        self.assertNotIn("Traceback", combined)

    def test_general_gmail_failure_returns_stable_json_without_exception_text(self):
        stderr = StringIO()
        logs = []
        server, thread = self.start_broker(
            FakeGmail(error=GmailPermanentError("access-secret message body leaked")),
            log=logs.append,
        )
        try:
            with redirect_stderr(stderr):
                status, payload = self.request(
                    server,
                    "POST",
                    "/v1/current-code",
                    {"run_id": "123", "email_tag": "qa-123-abcdefgh", "start_time": 1800000000},
                )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        self.assertEqual(status, 502)
        self.assertEqual(payload, {"error": "gmail_request_failed"})
        combined = stderr.getvalue() + json.dumps(logs)
        for secret in ["access-secret", "message body", "abcdefgh", "qa-"]:
            self.assertNotIn(secret, combined)
        self.assertNotIn("Traceback", combined)

    def test_access_logs_and_structured_logs_do_not_include_secrets(self):
        stdout = StringIO()
        server, thread = self.start_broker(FakeGmail("123456"), log="default")
        try:
            with redirect_stdout(stdout):
                self.request(
                    server,
                    "POST",
                    "/v1/current-code",
                    {"run_id": "123", "email_tag": "qa-123-abcdefgh", "start_time": 1800000000},
                )
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=2)

        output = stdout.getvalue()
        self.assertIn('"run_id": "123"', output)
        for secret in ["owner", "gmail", "abcdefgh", "123456", "qa-"]:
            self.assertNotIn(secret, output)

    def test_main_rejects_arguments_and_serves_http_broker_not_stdio_mcp(self):
        with self.assertRaises(SystemExit) as extra_arg:
            broker.main(["broker_mcp"])
        self.assertNotEqual(extra_arg.exception.code, 0)

        with (
            mock.patch.dict("os.environ", {"PORT": "8080"}, clear=True),
            mock.patch.object(broker, "OAuthCredentials") as credentials,
            mock.patch.object(broker, "GmailClient") as gmail_client,
            mock.patch.object(broker, "serve_forever") as serve_forever,
            mock.patch("scripts.browser_qa.flatkey_browser_qa.broker_mcp.run") as broker_mcp_run,
        ):
            credentials.from_env.return_value = object()
            gmail_client.return_value = object()
            result = broker.main([])

        self.assertEqual(result, 0)
        credentials.from_env.assert_called_once()
        gmail_client.assert_called_once_with(credentials.from_env.return_value)
        serve_forever.assert_called_once()
        self.assertIs(serve_forever.call_args.args[0], gmail_client.return_value)
        self.assertEqual(serve_forever.call_args.args[1].sender, "mail@noreply.flatkey.ai")
        self.assertEqual(serve_forever.call_args.args[1].subject_marker, "flatkey")
        self.assertEqual(serve_forever.call_args.kwargs, {})
        broker_mcp_run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
