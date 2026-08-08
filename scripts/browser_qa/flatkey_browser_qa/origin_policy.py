import ipaddress
import socket
from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True)
class OriginDecision:
    allowed: bool
    reason: str
    host: str | None = None


@dataclass(frozen=True)
class OriginPolicy:
    allowed_hosts: frozenset[str]
    loopback_proxy: tuple[str, int] | None = None

    @classmethod
    def from_hosts(cls, hosts, loopback_proxy=None):
        normalized = []
        for host in hosts:
            if not isinstance(host, str) or not host:
                raise ValueError("allowed hosts must be non-empty strings")
            if "://" in host or "/" in host or "@" in host:
                raise ValueError("allowed hosts must be bare hostnames")
            normalized.append(host.lower().rstrip("."))
        return cls(frozenset(normalized), loopback_proxy)

    def decide(self, url):
        try:
            parsed = urlsplit(url)
        except ValueError:
            return OriginDecision(False, "malformed_url")

        if parsed.scheme not in {"http", "https"}:
            return OriginDecision(False, "unsupported_scheme")
        if parsed.username is not None or parsed.password is not None:
            return OriginDecision(False, "url_credentials_forbidden")
        if not parsed.hostname:
            return OriginDecision(False, "missing_host")

        host = parsed.hostname.lower().rstrip(".")
        try:
            port = parsed.port
        except ValueError:
            return OriginDecision(False, "invalid_port", host)

        if self._is_configured_loopback_proxy(parsed.scheme, host, port):
            return OriginDecision(True, "loopback_proxy", host)

        if parsed.scheme != "https":
            return OriginDecision(False, "non_https_forbidden", host)
        if port not in {None, 443}:
            return OriginDecision(False, "non_default_https_port", host)
        if host not in self.allowed_hosts:
            return OriginDecision(False, "host_not_allowed", host)
        if _host_is_unsafe(host):
            return OriginDecision(False, "private_or_loopback_address", host)
        return OriginDecision(True, "allowed", host)

    def _is_configured_loopback_proxy(self, scheme, host, port):
        if self.loopback_proxy is None or scheme != "http":
            return False
        proxy_host, proxy_port = self.loopback_proxy
        return host == proxy_host and port == proxy_port and ipaddress.ip_address(host).is_loopback


def _host_is_unsafe(host):
    try:
        return _ip_is_unsafe(ipaddress.ip_address(host))
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except OSError:
        return True
    if not infos:
        return True

    for info in infos:
        address = info[4][0]
        try:
            if _ip_is_unsafe(ipaddress.ip_address(address)):
                return True
        except ValueError:
            return True
    return False


def _ip_is_unsafe(ip):
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )
