import http.client
import http.server
import json
import socket
import socketserver
import threading
import unittest

from scripts.browser_qa.flatkey_browser_qa import egress_proxy


class FakeConnector:
    def __init__(self):
        self.calls = []

    def __call__(self, resolved, timeout):
        self.calls.append((resolved, timeout))
        raise OSError("connect stopped by test")


class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class ChunkedSocket:
    def __init__(self, chunks):
        self.chunks = list(chunks)

    def recv(self, _size):
        if not self.chunks:
            raise socket.timeout("no more data")
        return self.chunks.pop(0)


def _read_connect_response(sock):
    data = b""
    while b"\r\n\r\n" not in data:
        chunk = sock.recv(256)
        if not chunk:
            break
        data += chunk
    header, separator, remainder = data.partition(b"\r\n\r\n")
    return header + separator, remainder


class RedirectHandler(http.server.BaseHTTPRequestHandler):
    redirect_to = "https://flatkey.ai/blocked"

    def do_GET(self):
        if self.path == "/redirect":
            self.send_response(302)
            self.send_header("Location", self.redirect_to)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        if self.path == "/relative-redirect":
            self.send_response(302)
            self.send_header("Location", "/safe-target")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", "7")
        self.end_headers()
        self.wfile.write(b"allowed")

    def log_message(self, _format, *args):
        return


class EgressPolicyTests(unittest.TestCase):
    def test_allowlist_file_is_versioned_deny_by_default_and_blocks_private_literal_hosts(self):
        policy = egress_proxy.EgressPolicy.from_file()

        self.assertTrue(policy.is_allowed_host("staging-website.flatkey.ai"))
        self.assertTrue(policy.is_allowed_host("staging-console.flatkey.ai"))
        self.assertFalse(policy.is_allowed_host("docs.flatkey.ai"))
        self.assertTrue(egress_proxy.EgressPolicy.from_file(mode="read_only").is_allowed_host("docs.flatkey.ai"))
        self.assertFalse(egress_proxy.EgressPolicy.from_file(mode="read_only").is_allowed_host("staging-console.flatkey.ai"))
        self.assertFalse(policy.is_allowed_host("flatkey.ai"))
        self.assertFalse(policy.is_allowed_host("assets.example.com"))
        self.assertFalse(policy.is_allowed_host("localhost"))
        self.assertFalse(policy.is_allowed_host("127.0.0.1"))
        self.assertFalse(policy.is_allowed_host("0177.0.0.1"))
        self.assertFalse(policy.is_allowed_host("169.254.169.254"))
        self.assertFalse(policy.is_allowed_host("http://staging-console.flatkey.ai"))

    def test_dns_resolution_fails_closed_on_any_private_answer_and_uses_verified_sockaddr(self):
        policy = egress_proxy.EgressPolicy({"staging-console.flatkey.ai"})

        def mixed_resolver(host, port, *_):
            return [
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port)),
                (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("10.0.0.1", port)),
            ]

        with self.assertRaises(egress_proxy.PolicyDenied):
            policy.resolve("staging-console.flatkey.ai", 443, resolver=mixed_resolver)

        def public_resolver(host, port, *_):
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", port))]

        resolved = policy.resolve("staging-console.flatkey.ai", 443, resolver=public_resolver)
        self.assertEqual(resolved[0].sockaddr, ("93.184.216.34", 443))

    def test_connect_checks_host_before_opening_socket_and_never_logs_secret_headers(self):
        connector = FakeConnector()
        policy = egress_proxy.EgressPolicy({"staging-console.flatkey.ai"})
        proxy = egress_proxy.EgressProxy(policy=policy, resolver=lambda *_: [], connector=connector)
        proxy.start()
        try:
            conn = http.client.HTTPConnection(proxy.host, proxy.port, timeout=2)
            conn.set_tunnel("flatkey.ai", 443, headers={"Authorization": "Bearer sk-secretSECRET", "Cookie": "secret=value"})
            with self.assertRaises((OSError, http.client.HTTPException)):
                conn.request("GET", "/")
            self.assertEqual(connector.calls, [])
            self.assertNotIn("sk-secretSECRET", json.dumps(proxy.events))
            self.assertNotIn("secret=value", json.dumps(proxy.events))
        finally:
            proxy.stop()

    def test_verified_socket_uses_resolved_family_socktype_proto_and_sockaddr_for_ipv4_and_ipv6(self):
        class FakeSocket:
            def __init__(self, family, socktype, proto):
                self.family = family
                self.socktype = socktype
                self.proto = proto
                self.timeout = None
                self.connected = None

            def settimeout(self, timeout):
                self.timeout = timeout

            def connect(self, sockaddr):
                self.connected = sockaddr

        created = []

        def socket_factory(family, socktype, proto):
            sock = FakeSocket(family, socktype, proto)
            created.append(sock)
            return sock

        for target in [
            egress_proxy.ResolvedTarget(socket.AF_INET, socket.SOCK_STREAM, 6, ("93.184.216.34", 443)),
            egress_proxy.ResolvedTarget(socket.AF_INET6, socket.SOCK_STREAM, 6, ("2606:2800:220:1:248:1893:25c8:1946", 443, 0, 0)),
        ]:
            with self.subTest(family=target.family):
                sock = egress_proxy.open_verified_socket(target, 3, socket_factory=socket_factory)
                self.assertIs(sock, created[-1])
                self.assertEqual(sock.family, target.family)
                self.assertEqual(sock.socktype, target.socktype)
                self.assertEqual(sock.proto, target.proto)
                self.assertEqual(sock.timeout, 3)
                self.assertEqual(sock.connected, target.sockaddr)

    def test_redirect_target_is_rechecked_and_non_http_methods_are_blocked(self):
        policy = egress_proxy.EgressPolicy({"staging-console.flatkey.ai"})
        self.assertEqual(policy.check_url("http://staging-console.flatkey.ai/login").host, "staging-console.flatkey.ai")
        with self.assertRaises(egress_proxy.PolicyDenied):
            policy.check_url("https://flatkey.ai/login")
        with self.assertRaises(egress_proxy.PolicyDenied):
            policy.check_url("ftp://staging-console.flatkey.ai/file")

        response = egress_proxy.filter_response_headers(
            302,
            [("Location", "https://flatkey.ai/blocked"), ("Content-Length", "0")],
            policy,
            base_url="http://staging-console.flatkey.ai/start",
        )
        self.assertEqual(response.status, 502)
        self.assertEqual(response.headers, [])

        response = egress_proxy.filter_response_headers(
            302,
            [("Location", "/safe-target"), ("Content-Length", "0")],
            policy,
            base_url="http://staging-console.flatkey.ai/start",
        )
        self.assertEqual(response.status, 302)

    def test_allowed_http_is_forwarded_to_verified_sockaddr_and_redirect_is_rechecked(self):
        upstream = ThreadedServer(("127.0.0.1", 0), RedirectHandler)
        thread = threading.Thread(target=upstream.serve_forever, daemon=True)
        thread.start()
        port = upstream.server_address[1]
        resolver_calls = []

        def resolver(host, resolved_port, *_):
            resolver_calls.append((host, resolved_port))
            return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", resolved_port))]

        def connector(resolved, timeout):
            self.assertEqual(resolved.sockaddr, ("93.184.216.34", 80))
            return socket.create_connection(("127.0.0.1", port), timeout=timeout)

        proxy = egress_proxy.EgressProxy(
            policy=egress_proxy.EgressPolicy({"staging-console.flatkey.ai"}),
            resolver=resolver,
            connector=connector,
        )
        proxy.start()
        try:
            conn = http.client.HTTPConnection(proxy.host, proxy.port, timeout=2)
            conn.request("GET", "http://staging-console.flatkey.ai/")
            response = conn.getresponse()
            self.assertEqual(response.status, 200)
            self.assertEqual(response.read(), b"allowed")
            conn.close()

            conn = http.client.HTTPConnection(proxy.host, proxy.port, timeout=2)
            conn.request("GET", "http://staging-console.flatkey.ai/redirect")
            response = conn.getresponse()
            self.assertEqual(response.status, 502)
            self.assertEqual(response.read(), b"")
            conn.close()
            self.assertEqual(resolver_calls, [("staging-console.flatkey.ai", 80), ("staging-console.flatkey.ai", 80)])
        finally:
            proxy.stop()

    def test_http_response_body_over_budget_fails_closed(self):
        class LargeHandler(http.server.BaseHTTPRequestHandler):
            def do_GET(self):
                body = b"x" * 16
                self.send_response(200)
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

            def log_message(self, _format, *args):
                return

        upstream = ThreadedServer(("127.0.0.1", 0), LargeHandler)
        thread = threading.Thread(target=upstream.serve_forever, daemon=True)
        thread.start()
        port = upstream.server_address[1]
        proxy = egress_proxy.EgressProxy(
            policy=egress_proxy.EgressPolicy({"staging-console.flatkey.ai"}),
            resolver=lambda host, resolved_port, *_: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", resolved_port))],
            connector=lambda _resolved, timeout: socket.create_connection(("127.0.0.1", port), timeout=timeout),
            max_body_bytes=8,
        )
        proxy.start()
        try:
            conn = http.client.HTTPConnection(proxy.host, proxy.port, timeout=2)
            conn.request("GET", "http://staging-console.flatkey.ai/")
            response = conn.getresponse()
            self.assertEqual(response.status, 502)
        finally:
            conn.close()
            proxy.stop()
            upstream.shutdown()
            upstream.server_close()

    def test_connect_response_reader_preserves_payload_arriving_with_header(self):
        response, remainder = _read_connect_response(
            ChunkedSocket([b"HTTP/1.1 200 Connection Established\r\n\r\nyyyyyyyy"])
        )

        self.assertIn(b"200", response)
        self.assertEqual(remainder, b"y" * 8)

    def test_connect_tunnel_has_independent_byte_budgets_per_direction(self):
        class EchoHandler(socketserver.BaseRequestHandler):
            def handle(self):
                self.request.sendall(b"y" * 16)

        upstream = socketserver.TCPServer(("127.0.0.1", 0), EchoHandler)
        thread = threading.Thread(target=upstream.serve_forever, daemon=True)
        thread.start()
        port = upstream.server_address[1]
        proxy = egress_proxy.EgressProxy(
            policy=egress_proxy.EgressPolicy({"staging-console.flatkey.ai"}),
            resolver=lambda host, resolved_port, *_: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", resolved_port))],
            connector=lambda _resolved, timeout: socket.create_connection(("127.0.0.1", port), timeout=timeout),
            max_tunnel_bytes=8,
        )
        proxy.start()
        try:
            with socket.create_connection((proxy.host, proxy.port), timeout=2) as sock:
                sock.sendall(b"CONNECT staging-console.flatkey.ai:443 HTTP/1.1\r\nHost: staging-console.flatkey.ai\r\n\r\n")
                response, data = _read_connect_response(sock)
                self.assertIn(b"200", response)
                while len(data) < 8:
                    chunk = sock.recv(8 - len(data))
                    if not chunk:
                        break
                    data += chunk
                self.assertEqual(data, b"y" * 8)
        finally:
            proxy.stop()
            upstream.shutdown()
            upstream.server_close()

    def test_connect_tunnel_outlives_transport_timeout_while_waiting_for_signup_code(self):
        class EchoHandler(socketserver.BaseRequestHandler):
            def handle(self):
                while True:
                    data = self.request.recv(1024)
                    if not data:
                        return
                    self.request.sendall(data)

        upstream = socketserver.TCPServer(("127.0.0.1", 0), EchoHandler)
        thread = threading.Thread(target=upstream.serve_forever, daemon=True)
        thread.start()
        port = upstream.server_address[1]
        proxy = egress_proxy.EgressProxy(
            policy=egress_proxy.EgressPolicy({"staging-console.flatkey.ai"}),
            resolver=lambda host, resolved_port, *_: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", resolved_port))],
            connector=lambda _resolved, timeout: socket.create_connection(("127.0.0.1", port), timeout=timeout),
            timeout=0.1,
        )
        proxy.start()
        try:
            with socket.create_connection((proxy.host, proxy.port), timeout=2) as sock:
                sock.settimeout(2)
                sock.sendall(b"CONNECT staging-console.flatkey.ai:443 HTTP/1.1\r\nHost: staging-console.flatkey.ai\r\n\r\n")
                response, _data = _read_connect_response(sock)
                self.assertIn(b"200", response)

                threading.Event().wait(0.25)
                sock.sendall(b"registration")

                try:
                    echoed = sock.recv(len(b"registration"))
                except OSError:
                    echoed = b""
                self.assertEqual(echoed, b"registration")
        finally:
            proxy.stop()
            upstream.shutdown()
            upstream.server_close()

    def test_default_connect_tunnel_budget_carries_current_staging_bundle_with_headroom(self):
        expected_bytes = 6 * 1024 * 1024

        class BundleHandler(socketserver.BaseRequestHandler):
            def handle(self):
                remaining = expected_bytes
                chunk = b"y" * 65536
                while remaining:
                    payload = chunk[:remaining]
                    try:
                        self.request.sendall(payload)
                    except (BrokenPipeError, ConnectionResetError):
                        return
                    remaining -= len(payload)

        upstream = socketserver.TCPServer(("127.0.0.1", 0), BundleHandler)
        thread = threading.Thread(target=upstream.serve_forever, daemon=True)
        thread.start()
        port = upstream.server_address[1]
        proxy = egress_proxy.EgressProxy(
            policy=egress_proxy.EgressPolicy({"staging-console.flatkey.ai"}),
            resolver=lambda host, resolved_port, *_: [(socket.AF_INET, socket.SOCK_STREAM, 6, "", ("93.184.216.34", resolved_port))],
            connector=lambda _resolved, timeout: socket.create_connection(("127.0.0.1", port), timeout=timeout),
        )
        proxy.start()
        try:
            with socket.create_connection((proxy.host, proxy.port), timeout=2) as sock:
                sock.sendall(b"CONNECT staging-console.flatkey.ai:443 HTTP/1.1\r\nHost: staging-console.flatkey.ai\r\n\r\n")
                response, data = _read_connect_response(sock)
                self.assertIn(b"200", response)
                while len(data) < expected_bytes:
                    try:
                        chunk = sock.recv(min(65536, expected_bytes - len(data)))
                    except socket.timeout:
                        break
                    if not chunk:
                        break
                    data += chunk
                self.assertEqual(len(data), expected_bytes)
        finally:
            proxy.stop()
            upstream.shutdown()
            upstream.server_close()

    def test_header_body_bounds_and_thread_local_decisions(self):
        proxy = egress_proxy.EgressProxy(policy=egress_proxy.EgressPolicy({"staging-console.flatkey.ai"}), max_header_bytes=32)
        proxy.start()
        try:
            with socket.create_connection((proxy.host, proxy.port), timeout=2) as sock:
                sock.sendall(b"GET http://staging-console.flatkey.ai/ HTTP/1.1\r\nHost: staging-console.flatkey.ai\r\nX-Oversized: " + b"a" * 80 + b"\r\n\r\n")
                data = sock.recv(256)
            self.assertIn(b"431", data)
        finally:
            proxy.stop()

        proxy = egress_proxy.EgressProxy(policy=egress_proxy.EgressPolicy({"staging-console.flatkey.ai"}))
        proxy.start()
        try:
            results = []

            def hit(host):
                conn = http.client.HTTPConnection(proxy.host, proxy.port, timeout=2)
                try:
                    conn.request("GET", f"http://{host}/", headers={"Host": host})
                    results.append(conn.getresponse().status)
                except Exception:
                    results.append("error")
                finally:
                    conn.close()

            threads = [threading.Thread(target=hit, args=("flatkey.ai",)), threading.Thread(target=hit, args=("localhost",))]
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
            self.assertEqual(results.count(403), 2)
        finally:
            proxy.stop()

    def test_proxy_rejects_ports_methods_userinfo_ambiguous_length_and_transfer_encoding(self):
        policy = egress_proxy.EgressPolicy({"staging-console.flatkey.ai"})
        with self.assertRaises(egress_proxy.PolicyDenied):
            policy.check_url("https://staging-console.flatkey.ai/")
        with self.assertRaises(egress_proxy.PolicyDenied):
            policy.check_url("http://staging-console.flatkey.ai:81/")
        with self.assertRaises(egress_proxy.PolicyDenied):
            policy.check_url("http://user@staging-console.flatkey.ai/")
        with self.assertRaises(egress_proxy.PolicyDenied):
            policy.check_connect_host("staging-console.flatkey.ai:444")

        proxy = egress_proxy.EgressProxy(policy=policy)
        proxy.start()
        try:
            conn = http.client.HTTPConnection(proxy.host, proxy.port, timeout=2)
            conn.request("PUT", "http://staging-console.flatkey.ai/")
            self.assertEqual(conn.getresponse().status, 405)
            conn.close()

            with socket.create_connection((proxy.host, proxy.port), timeout=2) as sock:
                sock.sendall(
                    b"POST http://staging-console.flatkey.ai/ HTTP/1.1\r\n"
                    b"Host: staging-console.flatkey.ai\r\n"
                    b"Content-Length: 1\r\n"
                    b"Content-Length: 2\r\n\r\nx"
                )
                self.assertIn(b"400", sock.recv(256))

            with socket.create_connection((proxy.host, proxy.port), timeout=2) as sock:
                sock.sendall(
                    b"POST http://staging-console.flatkey.ai/ HTTP/1.1\r\n"
                    b"Host: staging-console.flatkey.ai\r\n"
                    b"Transfer-Encoding: chunked\r\n\r\n0\r\n\r\n"
                )
                self.assertIn(b"400", sock.recv(256))
        finally:
            proxy.stop()


if __name__ == "__main__":
    unittest.main()
