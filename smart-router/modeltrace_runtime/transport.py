"""One submission, transient secrets, and an owned deadline-bounded child."""

import base64
import hashlib
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import socket
import ssl
import stat
import subprocess
import sys
import time
from urllib.parse import urlsplit


REQUEST_LIMIT = 64 * 1024
RESPONSE_LIMIT = 256 * 1024
CONNECT_TIMEOUT = 10
SLOT_TIMEOUT = 90
_ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,127}\Z")
_TARGET_FIELDS = {"base_url", "api_model", "api_key", "api_format"}


def _public_address(address):
    parsed = ipaddress.ip_address(address)
    return parsed.is_global and not (
        isinstance(parsed, ipaddress.IPv6Address)
        and (parsed.ipv4_mapped or parsed.sixtofour or parsed.teredo)
    )


def _endpoint(url, capability=None):
    if type(url) is not str or len(url) > 2048 or any(
        ord(character) <= 32 or ord(character) >= 127 for character in url
    ):
        raise ValueError("invalid_target")
    parsed = urlsplit(url)
    if (not parsed.hostname or parsed.username is not None
            or parsed.password is not None or parsed.query or parsed.fragment
            or "\\" in url or "%" in parsed.netloc):
        raise ValueError("invalid_target")
    host = parsed.hostname
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if capability is not None:
        if (parsed.scheme, host, port) != ("http", capability[0], capability[1]):
            raise ValueError("invalid_target")
    else:
        if parsed.scheme != "https" or host.lower().rstrip(".") in (
            "localhost", "metadata.google.internal",
        ) or host.lower().rstrip(".").endswith((".localhost", ".local", ".internal")):
            raise ValueError("invalid_target")
        try:
            address = ipaddress.ip_address(host)
        except ValueError:
            address = None
        if address is not None and not _public_address(host):
            raise ValueError("invalid_target")
    return parsed, host, port


def _validate_target(target, capability=None):
    if type(target) is not dict or set(target) != _TARGET_FIELDS:
        raise ValueError("invalid_target")
    if target["api_format"] not in ("openai", "anthropic"):
        raise ValueError("invalid_target")
    _endpoint(target["base_url"], capability)
    for field, limit in (("api_model", 256), ("api_key", 4096)):
        value = target[field]
        if (type(value) is not str or not value or len(value) > limit
                or any(ord(character) < 33 or ord(character) > 126 for character in value)):
            raise ValueError("invalid_target")
    return dict(target)


def _request(target, challenge):
    if (type(challenge) is not dict or not _ID.fullmatch(challenge.get("id", ""))
            or type(challenge.get("expected_count")) is not int
            or not 0 <= challenge["expected_count"] <= 4096):
        raise ValueError("invalid_request")
    prompt = challenge.get("prompt")
    system = challenge.get("system", "")
    prefix = challenge.get("user_prefix", "")
    if any(type(text) is not str for text in (prompt, system, prefix)):
        raise ValueError("invalid_request")
    if prefix:
        prompt = prefix + "\n\nFinal task:\n" + prompt
    body = {
        "model": target["api_model"], "max_tokens": 4096, "stream": False,
        "messages": [{"role": "user", "content": prompt}],
    }
    headers = {"Content-Type": "application/json"}
    base = target["base_url"].rstrip("/")
    if not base.endswith("/v1"):
        base += "/v1"
    if target["api_format"] == "openai":
        url = base + "/chat/completions"
        headers["Authorization"] = "Bearer " + target["api_key"]
        if system:
            body["messages"].insert(0, {"role": "system", "content": system})
    else:
        url = base + "/messages"
        headers.update({"x-api-key": target["api_key"],
                        "anthropic-version": "2023-06-01"})
        if system:
            body["system"] = system
    request = {"url": url, "headers": headers, "body": body}
    # Bound the entire effective request, not only the prompt.
    if len(json.dumps(request, ensure_ascii=True).encode()) > REQUEST_LIMIT:
        raise ValueError("invalid_request")
    return request


def request_once(target: dict, challenge: dict, transport) -> dict:
    result = {"status": "invalid_target", "numbers": [], "eligible": False,
              "transport_calls": 0, "submitted": False, "response_received": False}
    capability = transport._capability if isinstance(transport, OneShotTransport) else None
    try:
        target = _validate_target(target, capability)
        result["status"] = "invalid_request"
        request = _request(target, challenge)
    except (ValueError, TypeError, KeyError, OverflowError):
        return result
    result.update({"challenge_id": challenge["id"],
                   "expected_count": challenge["expected_count"],
                   "transport_calls": 1, "submitted": None,
                   "status": "write_unknown"})
    try:
        response = transport(request)
    except (Exception, KeyboardInterrupt, SystemExit):
        return result
    if type(response) is not dict:
        return result
    if "_status" in response:
        result["status"] = response["_status"] if response["_status"] in (
            "invalid_target", "write_unknown",
        ) else "write_unknown"
        result["submitted"] = response.get("submitted")
        return result
    result["submitted"] = response.get("submitted", True)
    result["response_received"] = True
    code = response.get("status_code")
    result["status"] = "http_error"
    if type(code) is not int or not 200 <= code < 300:
        return result
    result["status"] = "invalid_response"
    try:
        body = response["body"]
        if type(body) is bytes:
            if len(body) > RESPONSE_LIMIT:
                result["status"] = "write_unknown"
                return result
            body = json.loads(body)
        elif len(json.dumps(body, allow_nan=False).encode()) > RESPONSE_LIMIT:
            result["status"] = "write_unknown"
            return result
        if type(body) is not dict:
            return result
        if target["api_format"] == "openai":
            choices = body["choices"]
            if type(choices) is not list or len(choices) != 1:
                return result
            message = choices[0]["message"]
            content = message["content"]
            normal = choices[0].get("finish_reason") == "stop" and not message.get("refusal")
        else:
            content = body["content"]
            normal = body.get("stop_reason") in ("end_turn", "stop_sequence")
        if type(content) is str and target["api_format"] == "openai":
            text = content
        elif type(content) is list:
            texts = []
            for part in content:
                if type(part) is not dict:
                    return result
                if part.get("type") == "text" and type(part.get("text")) is str:
                    texts.append(part["text"])
                else:
                    normal = False
            text = "\n".join(texts)
        else:
            return result
        if len(text.encode()) > RESPONSE_LIMIT:
            result["status"] = "write_unknown"
            return result
        from third_party.modeltrace import fingerprint
        numbers = fingerprint.parse_numbers(text)
        if len(numbers) > 4096:
            return result
        result["numbers"] = numbers
        if normal:
            result.update({"status": "ok", "eligible": True})
    except (ValueError, TypeError, KeyError, IndexError, OverflowError):
        pass
    return result


class OneShotTransport:
    def __init__(self, *, interpreter_sha256):
        self._python = sys.executable
        self._pin = interpreter_sha256
        self._check_pin()
        self._capability = None
        self._timeout = SLOT_TIMEOUT
        self._stall_dns = False
        self.last_child_pid = None

    def _check_pin(self):
        path = Path(self._python)
        if (type(self._pin) is not str or not re.fullmatch("[0-9a-f]{64}", self._pin)
                or path.is_symlink() or not stat.S_ISREG(path.stat().st_mode)
                or hashlib.sha256(path.read_bytes()).hexdigest() != self._pin):
            raise ValueError("invalid_interpreter")

    @classmethod
    def _for_test(cls, listener, *, slot_timeout=SLOT_TIMEOUT, stall_dns=False):
        if (not isinstance(listener, socket.socket) or listener.fileno() < 0
                or listener.type != socket.SOCK_STREAM):
            raise ValueError("invalid_test_listener")
        host, port = listener.getsockname()[:2]
        if host != "127.0.0.1" or not 0 < slot_timeout <= SLOT_TIMEOUT:
            raise ValueError("invalid_test_listener")
        instance = cls(interpreter_sha256=hashlib.sha256(
            Path(sys.executable).read_bytes()).hexdigest())
        instance._capability = (host, port)
        instance._timeout = slot_timeout
        instance._stall_dns = bool(stall_dns)
        return instance

    def __call__(self, request):
        self._check_pin()
        _endpoint(request["url"], self._capability)
        payload = json.dumps({
            "request": request, "capability": self._capability,
            "timeout": self._timeout, "stall_dns": self._stall_dns,
        }, ensure_ascii=True).encode()
        child = None
        output = b""
        try:
            child = subprocess.Popen(
                [self._python, "-I", "-B", str(Path(__file__).absolute()),
                 "--one-shot-child"],
                stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                stderr=subprocess.DEVNULL, close_fds=True,
                cwd=Path(__file__).absolute().parents[1],
                env={"PATH": "/usr/bin:/bin", "LANG": "C", "PYTHONNOUSERSITE": "1",
                     "PYTHONDONTWRITEBYTECODE": "1"},
            )
            self.last_child_pid = child.pid
            output, _ = child.communicate(payload, timeout=self._timeout)
            lines = output.splitlines()
            response = json.loads(lines[-1])
            if "encoded_body" in response:
                response["body"] = base64.b64decode(response.pop("encoded_body"),
                                                  validate=True)
            return response
        except subprocess.TimeoutExpired as error:
            output = error.output or b""
        except (Exception, KeyboardInterrupt, SystemExit):
            pass
        finally:
            if child is not None:
                try:
                    if child.poll() is None:
                        child.terminate()
                        try:
                            child.wait(timeout=2)
                        except subprocess.TimeoutExpired:
                            child.kill()
                            child.wait()
                finally:
                    for stream in (child.stdin, child.stdout):
                        if stream is not None:
                            stream.close()
        return {"_status": "write_unknown",
                "submitted": b'{"phase": "submitted"}' in output}


def _child_request(envelope):
    request = envelope["request"]
    capability = envelope["capability"]
    parsed, host, port = _endpoint(request["url"], capability)
    deadline = time.monotonic() + min(envelope["timeout"], SLOT_TIMEOUT)
    if capability is not None and envelope.get("stall_dns"):
        # An owned resolver stall exercises parent cancellation before any socket.
        time.sleep(SLOT_TIMEOUT * 2)
    addresses = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    if not addresses or len(addresses) > 64:
        raise ValueError("invalid_target")
    for family, kind, protocol, canonical, address in addresses:
        if capability is not None:
            if address[:2] != tuple(capability):
                raise ValueError("invalid_target")
        elif not _public_address(address[0]):
            raise ValueError("invalid_target")
    family, kind, protocol, canonical, address = addresses[0]
    connection_deadline = min(deadline, time.monotonic() + CONNECT_TIMEOUT)
    sock = socket.socket(family, kind, protocol)
    connection = None
    submitted = False
    try:
        sock.settimeout(max(0.001, connection_deadline - time.monotonic()))
        sock.connect(address)
        if parsed.scheme == "https":
            sock.settimeout(max(0.001, connection_deadline - time.monotonic()))
            sock = ssl.create_default_context().wrap_socket(sock, server_hostname=host)
        sock.settimeout(max(0.001, deadline - time.monotonic()))
        connection = http.client.HTTPConnection(host, port)
        connection.auto_open = False
        connection.sock = sock
        body = json.dumps(request["body"], ensure_ascii=True).encode()
        submitted = True
        print(json.dumps({"phase": "submitted"}), flush=True)
        connection.request("POST", parsed.path or "/", body, request["headers"])
        response = connection.getresponse()
        size = response.getheader("Content-Length")
        if size is not None and int(size) > RESPONSE_LIMIT:
            raise OverflowError
        payload = response.read(RESPONSE_LIMIT + 1)
        if len(payload) > RESPONSE_LIMIT:
            raise OverflowError
        return {"status_code": response.status, "submitted": True,
                "encoded_body": base64.b64encode(payload).decode("ascii")}
    except ValueError:
        return {"_status": "write_unknown" if submitted else "invalid_target",
                "submitted": submitted}
    except (Exception, KeyboardInterrupt, SystemExit):
        return {"_status": "write_unknown", "submitted": submitted}
    finally:
        if connection is not None:
            connection.close()
        sock.close()


def _child_main():
    try:
        payload = sys.stdin.buffer.read(REQUEST_LIMIT * 2 + 1)
        if len(payload) > REQUEST_LIMIT * 2:
            raise ValueError
        result = _child_request(json.loads(payload))
    except ValueError:
        result = {"_status": "invalid_target", "submitted": False}
    except Exception:
        result = {"_status": "write_unknown", "submitted": False}
    print(json.dumps(result), flush=True)


if __name__ == "__main__" and sys.argv[1:] == ["--one-shot-child"]:
    _child_main()
