import http.server
import ipaddress
import json
import os
import select
import socket
import socketserver
import threading
import urllib.parse


DEFAULT_TUNNEL_IDLE_TIMEOUT_SECONDS = 300


class PolicyDenied(Exception):
    pass


class ProxyError(Exception):
    pass


class ResolvedTarget:
    def __init__(self, family, socktype, proto, sockaddr):
        self.family = family
        self.socktype = socktype
        self.proto = proto
        self.sockaddr = sockaddr


class CheckedUrl:
    def __init__(self, url, scheme, host, port):
        self.url = url
        self.scheme = scheme
        self.host = host
        self.port = port


class FilteredHeaders:
    def __init__(self, status, headers):
        self.status = status
        self.headers = headers


class EgressPolicy:
    def __init__(self, allowed_hosts):
        self.allowed_hosts = frozenset(_normalize_host(host) for host in allowed_hosts)

    @classmethod
    def from_file(cls, path=None, *, mode="writable"):
        if path is None:
            path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config", "allowed_hosts.json")
        with open(path, encoding="utf-8") as handle:
            payload = json.load(handle)
        if payload.get("version") != 1:
            raise ValueError("allowed host file is malformed")
        modes = payload.get("modes")
        if isinstance(modes, dict):
            hosts = modes.get(mode)
            if not isinstance(hosts, list):
                raise ValueError("allowed host file is malformed")
            return cls(hosts)
        if mode == "writable" and isinstance(payload.get("hosts"), list):
            return cls(payload["hosts"])
        raise ValueError("allowed host file is malformed")

    def is_allowed_host(self, host):
        try:
            normalized = _normalize_host(host)
            _reject_literal_or_special_host(normalized)
        except PolicyDenied:
            return False
        return normalized in self.allowed_hosts

    def check_url(self, url):
        parsed = urllib.parse.urlsplit(url)
        if parsed.scheme != "http" or not parsed.hostname or parsed.username or parsed.password:
            raise PolicyDenied("only http and https proxy egress is allowed")
        host = _normalize_host(parsed.hostname)
        if not self.is_allowed_host(host):
            raise PolicyDenied("host is outside browser qa allowlist")
        port = parsed.port or 80
        if port != 80:
            raise PolicyDenied("http proxy egress must use port 80")
        return CheckedUrl(url, parsed.scheme, host, port)

    def check_connect_host(self, authority):
        host, port = _split_authority(authority, default_port=443)
        if port != 443:
            raise PolicyDenied("connect egress must use port 443")
        if not self.is_allowed_host(host):
            raise PolicyDenied("connect host is outside browser qa allowlist")
        return host, port

    def resolve(self, host, port, *, resolver=socket.getaddrinfo):
        if not self.is_allowed_host(host):
            raise PolicyDenied("host is outside browser qa allowlist")
        answers = resolver(host, port, socket.AF_UNSPEC, socket.SOCK_STREAM)
        if not answers:
            raise PolicyDenied("dns resolution returned no usable addresses")
        resolved = []
        for family, socktype, proto, _canon, sockaddr in answers:
            ip = ipaddress.ip_address(sockaddr[0])
            if _is_forbidden_ip(ip):
                raise PolicyDenied("dns resolution included forbidden address")
            resolved.append(ResolvedTarget(family, socktype, proto, sockaddr))
        return resolved


def filter_response_headers(status, headers, policy, *, base_url=None):
    cleaned = []
    for key, value in headers:
        if key.lower() == "location" and 300 <= status <= 399:
            try:
                policy.check_url(urllib.parse.urljoin(base_url, value) if base_url else value)
            except PolicyDenied:
                return FilteredHeaders(502, [])
        if key.lower() in {"connection", "proxy-connection", "keep-alive", "transfer-encoding", "upgrade"}:
            continue
        cleaned.append((key, value))
    return FilteredHeaders(status, cleaned)


class EgressProxy:
    def __init__(
        self,
        *,
        policy=None,
        resolver=socket.getaddrinfo,
        connector=None,
        host="127.0.0.1",
        port=0,
        max_header_bytes=16384,
        max_body_bytes=1048576,
        max_tunnel_bytes=16 * 1024 * 1024,
        timeout=5,
    ):
        self.policy = policy or EgressPolicy.from_file()
        self.resolver = resolver
        self.connector = connector or open_verified_socket
        self.host = host
        self.port = port
        self.max_header_bytes = max_header_bytes
        self.max_body_bytes = max_body_bytes
        self.max_tunnel_bytes = max_tunnel_bytes
        self.tunnel_idle_timeout = DEFAULT_TUNNEL_IDLE_TIMEOUT_SECONDS
        self.timeout = timeout
        self.events = []
        self._server = None
        self._thread = None

    def start(self):
        if self.host not in {"127.0.0.1", "::1", "localhost"}:
            raise ValueError("egress proxy must listen only on loopback")
        owner = self

        class Handler(_ProxyHandler):
            proxy = owner

        self._server = _ThreadingServer((self.host, self.port), Handler)
        self.host, self.port = self._server.server_address[:2]
        self._thread = threading.Thread(target=self._server.serve_forever, daemon=True)
        self._thread.start()
        return self

    def stop(self):
        if self._server is not None:
            self._server.shutdown()
            self._server.server_close()
        if self._thread is not None:
            self._thread.join(timeout=2)

    def log(self, event):
        self.events.append({key: value for key, value in event.items() if key in {"action", "host", "status", "reason"}})


class _ThreadingServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


class _ProxyHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    proxy = None

    def setup(self):
        super().setup()
        self.connection.settimeout(self.proxy.timeout)

    def parse_request(self):
        ok = super().parse_request()
        if ok and len(str(self.headers).encode("utf-8", "replace")) > self.proxy.max_header_bytes:
            self.send_error(431, "request headers too large")
            return False
        return ok

    def do_CONNECT(self):
        try:
            host, port = self.proxy.policy.check_connect_host(self.path)
        except (PolicyDenied, ValueError):
            self.proxy.log({"action": "connect", "host": self.path, "status": 403, "reason": "denied"})
            self._simple_error(403, "blocked by browser qa egress policy")
            return
        try:
            resolved = self.proxy.policy.resolve(host, port, resolver=self.proxy.resolver)[0]
            upstream = self.proxy.connector(resolved, self.proxy.timeout)
        except Exception:
            self._simple_error(502, "connect failed")
            return
        upstream.settimeout(self.proxy.timeout)
        self.send_response(200, "Connection Established")
        self.end_headers()
        self._tunnel(upstream)

    def do_GET(self):
        self._http_request()

    def do_POST(self):
        self._http_request()

    def do_HEAD(self):
        self._http_request()

    def do_PUT(self):
        self._simple_error(405, "method not allowed")

    def do_DELETE(self):
        self._simple_error(405, "method not allowed")

    def _http_request(self):
        try:
            checked = self.proxy.policy.check_url(self.path)
        except PolicyDenied:
            self.proxy.log({"action": self.command, "host": self.headers.get("Host", ""), "status": 403, "reason": "denied"})
            self._simple_error(403, "blocked by browser qa egress policy")
            return
        lengths = self.headers.get_all("Content-Length") or []
        if self.headers.get("Transfer-Encoding"):
            self._simple_error(400, "transfer encoding is not allowed")
            return
        try:
            parsed_lengths = {int(value) for value in lengths} if lengths else {0}
        except ValueError:
            self._simple_error(400, "invalid content length")
            return
        if len(parsed_lengths) != 1:
            self._simple_error(400, "ambiguous content length")
            return
        length = parsed_lengths.pop()
        if length > self.proxy.max_body_bytes:
            self._simple_error(413, "request body too large")
            return
        body = self.rfile.read(length) if length else b""
        try:
            resolved = self.proxy.policy.resolve(checked.host, checked.port, resolver=self.proxy.resolver)[0]
            with self.proxy.connector(resolved, self.proxy.timeout) as upstream:
                upstream.settimeout(self.proxy.timeout)
                self._send_upstream_request(upstream, checked, body)
                self._forward_upstream_response(upstream)
        except Exception:
            self._simple_error(502, "upstream http forwarding failed")
            self.proxy.log({"action": self.command, "host": checked.host, "status": 502})
            return
        self.proxy.log({"action": self.command, "host": checked.host, "status": 200})

    def _send_upstream_request(self, upstream, checked, body):
        parsed = urllib.parse.urlsplit(checked.url)
        selector = urllib.parse.urlunsplit(("", "", parsed.path or "/", parsed.query, ""))
        lines = [f"{self.command} {selector} HTTP/1.1"]
        for key, value in self.headers.items():
            lowered = key.lower()
            if lowered in {"proxy-connection", "connection", "keep-alive", "upgrade", "host", "transfer-encoding"}:
                continue
            lines.append(f"{key}: {value}")
        lines.append(f"Host: {checked.host}")
        lines.append("Connection: close")
        if body:
            lines.append(f"Content-Length: {len(body)}")
        upstream.sendall(("\r\n".join(lines) + "\r\n\r\n").encode("iso-8859-1"))
        if body:
            upstream.sendall(body)

    def _forward_upstream_response(self, upstream):
        fileobj = upstream.makefile("rb")
        status_line = fileobj.readline(self.proxy.max_header_bytes + 1)
        if len(status_line) > self.proxy.max_header_bytes or not status_line.startswith(b"HTTP/"):
            raise ProxyError("malformed upstream response")
        parts = status_line.decode("iso-8859-1").split(" ", 2)
        if len(parts) < 2 or not parts[1].isdigit():
            raise ProxyError("malformed upstream status")
        status = int(parts[1])
        headers = []
        header_bytes = len(status_line)
        while True:
            line = fileobj.readline(self.proxy.max_header_bytes + 1)
            header_bytes += len(line)
            if header_bytes > self.proxy.max_header_bytes:
                raise ProxyError("upstream headers too large")
            if line in {b"\r\n", b"\n", b""}:
                break
            key, separator, value = line.decode("iso-8859-1").partition(":")
            if not separator:
                raise ProxyError("malformed upstream header")
            headers.append((key.strip(), value.strip()))
        filtered = filter_response_headers(status, headers, self.proxy.policy, base_url=self.path)
        if filtered.status != status:
            self.send_response(filtered.status)
            self.send_header("Content-Length", "0")
            self.send_header("Connection", "close")
            self.end_headers()
            return
        for key, value in filtered.headers:
            if key.lower() == "content-length":
                try:
                    if int(value) > self.proxy.max_body_bytes:
                        raise ProxyError("upstream response body too large")
                except ValueError as exc:
                    raise ProxyError("malformed content length") from exc
        self.send_response(status)
        for key, value in filtered.headers:
            self.send_header(key, value)
        self.send_header("Connection", "close")
        self.end_headers()
        forwarded = 0
        while True:
            chunk = fileobj.read(8192)
            if not chunk:
                break
            forwarded += len(chunk)
            if forwarded > self.proxy.max_body_bytes:
                raise ProxyError("upstream response body too large")
            self.wfile.write(chunk)

    def _simple_error(self, status, message):
        body = (message + "\n").encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _tunnel(self, upstream):
        sockets = [self.connection, upstream]
        client_to_upstream = 0
        upstream_to_client = 0
        try:
            while True:
                readable, _, _ = select.select(sockets, [], [], self.proxy.tunnel_idle_timeout)
                if not readable:
                    return
                for source in readable:
                    data = source.recv(8192)
                    if not data:
                        return
                    target = upstream if source is self.connection else self.connection
                    if source is self.connection:
                        client_to_upstream += len(data)
                        if client_to_upstream > self.proxy.max_tunnel_bytes:
                            return
                    else:
                        upstream_to_client += len(data)
                        if upstream_to_client > self.proxy.max_tunnel_bytes:
                            data = data[: max(0, self.proxy.max_tunnel_bytes - (upstream_to_client - len(data)))]
                            if not data:
                                return
                    target.sendall(data)
        finally:
            upstream.close()

    def log_message(self, _format, *args):
        return


def _normalize_host(host):
    if not isinstance(host, str) or not host:
        raise PolicyDenied("missing host")
    if "://" in host or "/" in host or "@" in host:
        raise PolicyDenied("host must be a hostname")
    return host.rstrip(".").lower()


def _split_authority(authority, default_port):
    if authority.startswith("["):
        end = authority.find("]")
        if end < 0:
            raise ValueError("invalid authority")
        host = authority[1:end]
        rest = authority[end + 1 :]
        port = int(rest[1:]) if rest.startswith(":") else default_port
        return _normalize_host(host), port
    if ":" in authority:
        host, port_text = authority.rsplit(":", 1)
        return _normalize_host(host), int(port_text)
    return _normalize_host(authority), default_port


def _reject_literal_or_special_host(host):
    if host == "localhost" or host.endswith(".localhost") or host == "metadata.google.internal":
        raise PolicyDenied("special host is forbidden")
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        try:
            if host.startswith("0") and all(part.isdigit() for part in host.split(".")):
                raise PolicyDenied("ambiguous literal ip is forbidden")
        except AttributeError:
            pass
        return
    if _is_forbidden_ip(ip):
        raise PolicyDenied("literal ip is forbidden")


def _is_forbidden_ip(ip):
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_unspecified
        or ip.is_reserved
        or ip.is_multicast
    )


def open_verified_socket(resolved, timeout, *, socket_factory=socket.socket):
    sock = socket_factory(resolved.family, resolved.socktype, resolved.proto)
    try:
        sock.settimeout(timeout)
        sock.connect(resolved.sockaddr)
        return sock
    except Exception:
        try:
            sock.close()
        except Exception:
            pass
        raise
