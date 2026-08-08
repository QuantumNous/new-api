import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from .gcp import GcpClient
from .gcp import GcpError
from .mcp import McpServer
from .mcp import Tool
from .mcp import ToolExecutionError
from .mcp import run_jsonrpc_server


_ENV_RUN_ID = "FLATKEY_BROWSER_QA_RUN_ID"
_ENV_EMAIL_TAG = "FLATKEY_BROWSER_QA_EMAIL_TAG"
_ENV_START_TIME = "FLATKEY_BROWSER_QA_START_TIME"
_ENV_BROKER_URL = "FLATKEY_BROWSER_QA_BROKER_URL"
_POLL_INTERVAL_SECONDS = 5
_DEADLINE_SECONDS = 120
_MAX_RESPONSE_BYTES = 4096
_EMAIL_TAG_RE = re.compile(r"^qa-(?P<run_id>[0-9]+)-[a-z0-9]{8}$")


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def _default_opener():
    return urllib.request.build_opener(_NoRedirectHandler(), urllib.request.ProxyHandler({}))


def run(stdin=None, stdout=None, *, env=None, opener=None, clock=None, max_line_bytes=1024 * 1024, evidence_notifier=None):
    stdin = stdin or sys.stdin
    stdout = stdout or sys.stdout
    env = env or os.environ
    clock = clock or time
    server = McpServer(
        "flatkey-browser-qa-broker",
        [Tool("get_current_verification_code", "Return the verification code for this QA run.", _BrokerTool(env, opener, clock, evidence_notifier))],
    )
    run_jsonrpc_server(stdin, stdout, server, max_line_bytes=max_line_bytes)


class _BrokerTool:
    def __init__(self, env, opener, clock, evidence_notifier=None):
        self.env = env
        self.opener = opener or _default_opener()
        self.clock = clock
        self.evidence_notifier = evidence_notifier or _evidence_notifier_from_env(env)

    def __call__(self):
        config = _load_env(self.env)
        deadline = self.clock.monotonic() + _DEADLINE_SECONDS
        while True:
            try:
                token = GcpClient(opener=self.opener, retry_base_delay=0).identity_token(
                    config["broker_url"], timeout=_remaining(deadline, self.clock), max_attempts=1
                )
                _ensure_remaining(deadline, self.clock)
                response = _post_current_code(self.opener, config, token, timeout=_remaining(deadline, self.clock))
                _ensure_remaining(deadline, self.clock)
            except GcpError as exc:
                raise ToolExecutionError("broker identity unavailable") from exc
            status = response.get("status") if isinstance(response, dict) else None
            if status == "ready":
                code = response.get("code")
                if not isinstance(code, str) or not code:
                    raise ToolExecutionError("broker response malformed")
                self.evidence_notifier({"type": "verification_code", "code": code})
                return {"status": "ready", "code": code}
            if status == "error":
                raise ToolExecutionError("broker returned error")
            if status != "pending":
                raise ToolExecutionError("broker response malformed")
            if self.clock.monotonic() + _POLL_INTERVAL_SECONDS > deadline:
                raise ToolExecutionError("verification code deadline exceeded")
            self.clock.sleep(_POLL_INTERVAL_SECONDS)


def _load_env(env):
    try:
        run_id = env[_ENV_RUN_ID]
        email_tag = env[_ENV_EMAIL_TAG]
        start_time_raw = env[_ENV_START_TIME]
        broker_url = env[_ENV_BROKER_URL]
    except KeyError as exc:
        raise ToolExecutionError("broker mcp configuration missing") from exc
    if not isinstance(run_id, str) or not run_id.isascii() or not run_id.isdecimal():
        raise ToolExecutionError("broker mcp configuration invalid")
    match = _EMAIL_TAG_RE.fullmatch(email_tag) if isinstance(email_tag, str) else None
    if not match or match.group("run_id") != run_id:
        raise ToolExecutionError("broker mcp configuration invalid")
    try:
        start_time = int(start_time_raw)
    except (TypeError, ValueError) as exc:
        raise ToolExecutionError("broker mcp configuration invalid") from exc
    broker_url = _canonical_root_url(broker_url)
    return {"run_id": run_id, "email_tag": email_tag, "start_time": start_time, "broker_url": broker_url}


def _canonical_root_url(url):
    parsed = urllib.parse.urlparse(url)
    hostname = parsed.hostname or ""
    if parsed.scheme != "https" or parsed.netloc != hostname or parsed.path not in ("", "/") or parsed.query or parsed.fragment:
        raise ToolExecutionError("broker mcp configuration invalid")
    return urllib.parse.urlunsplit(("https", hostname, "", "", ""))


def _remaining(deadline, clock):
    remaining = deadline - clock.monotonic()
    if remaining <= 0:
        raise ToolExecutionError("verification code deadline exceeded")
    return min(5, remaining)


def _ensure_remaining(deadline, clock):
    if clock.monotonic() > deadline:
        raise ToolExecutionError("verification code deadline exceeded")


def _post_current_code(opener, config, token, *, timeout):
    target = config["broker_url"] + "/v1/current-code"
    payload = json.dumps(
        {"run_id": config["run_id"], "email_tag": config["email_tag"], "start_time": config["start_time"]},
        separators=(",", ":"),
    ).encode("utf-8")
    request = urllib.request.Request(
        target,
        data=payload,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with opener.open(request, timeout=timeout) as response:
            if 300 <= response.status <= 399:
                raise ToolExecutionError("broker redirect blocked")
            if not 200 <= response.status <= 299:
                raise ToolExecutionError("broker request failed")
            raw = response.read(_MAX_RESPONSE_BYTES + 1)
    except urllib.error.HTTPError as exc:
        if 300 <= exc.code <= 399:
            raise ToolExecutionError("broker redirect blocked") from exc
        raise ToolExecutionError("broker request failed") from exc
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise ToolExecutionError("broker request failed") from exc
    if len(raw) > _MAX_RESPONSE_BYTES:
        raise ToolExecutionError("broker response malformed")
    try:
        decoded = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ToolExecutionError("broker response malformed") from exc
    if not isinstance(decoded, dict):
        raise ToolExecutionError("broker response malformed")
    return decoded


def _evidence_notifier_from_env(env):
    url = env.get("FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL")
    if not url:
        return lambda _event: None

    def notify(event):
        raw = json.dumps(event, separators=(",", ":")).encode("utf-8")
        request = urllib.request.Request(url, data=raw, headers={"Content-Type": "application/json"}, method="POST")
        with _default_opener().open(request, timeout=2):
            return None

    return notify


if __name__ == "__main__":
    run()
