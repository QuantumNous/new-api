import json
import os
import sys
import urllib.request
from urllib.parse import urlsplit

from . import mcp


SCREENSHOT_SCHEMA = {
    "type": "object",
    "properties": {"name": {"type": "string"}},
    "required": ["name"],
    "additionalProperties": False,
}


def main():
    evidence_url = os.environ["FLATKEY_BROWSER_QA_RUNTIME_EVIDENCE_URL"]
    for line in sys.stdin:
        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            _write_error(None, -32700, "parse error")
            continue
        if not isinstance(request, dict) or request.get("jsonrpc") != "2.0":
            _write_error(None, -32600, "invalid request")
            continue
        if "id" not in request:
            continue
        request_id = request.get("id") if isinstance(request, dict) else None
        method = request.get("method")
        if method == "initialize":
            _write_result(
                request_id,
                {
                    "protocolVersion": mcp.PROTOCOL_VERSION,
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "flatkey-browser-evidence", "version": "1.0.0"},
                },
            )
        elif method == "tools/list":
            _write_result(
                request_id,
                {
                    "tools": [{
                        "name": "qa_capture_screenshot",
                        "description": "Capture a redacted screenshot into the private QA runtime evidence area.",
                        "inputSchema": SCREENSHOT_SCHEMA,
                    }]
                },
            )
        elif method == "tools/call":
            params = request.get("params") if isinstance(request, dict) else None
            arguments = params.get("arguments") if isinstance(params, dict) else None
            name = arguments.get("name") if isinstance(arguments, dict) else None
            if (
                not isinstance(params, dict)
                or params.get("name") != "qa_capture_screenshot"
                or not isinstance(arguments, dict)
                or set(arguments) != {"name"}
                or not isinstance(name, str)
            ):
                _write_error(request_id, -32602, "invalid screenshot request")
                continue
            try:
                logical = _request_capture(evidence_url, name)
            except Exception as exc:
                _write_error(request_id, -32000, str(exc))
                continue
            _write_result(request_id, {"content": [{"type": "text", "text": logical}]})
        else:
            _write_error(request_id, -32601, "method not found")


def _request_capture(evidence_url, name, *, opener=None):
    endpoint = _validate_evidence_url(evidence_url)
    selected_opener = opener or urllib.request.build_opener(urllib.request.ProxyHandler({}))
    body = json.dumps({"type": "screenshot", "name": name}, sort_keys=True).encode("utf-8")
    request = urllib.request.Request(
        endpoint,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with selected_opener.open(request, timeout=30) as response:
        raw = response.read(4097)
    if len(raw) > 4096:
        raise RuntimeError("screenshot response too large")
    payload = json.loads(raw.decode("utf-8"))
    path = payload.get("path") if isinstance(payload, dict) else None
    if not isinstance(path, str) or not path.startswith("screenshots/"):
        raise RuntimeError("screenshot response invalid")
    return path


def _validate_evidence_url(evidence_url):
    if not isinstance(evidence_url, str) or not evidence_url:
        raise RuntimeError("runtime evidence endpoint invalid")
    try:
        parsed = urlsplit(evidence_url)
    except ValueError as exc:
        raise RuntimeError("runtime evidence endpoint invalid") from exc
    if (
        parsed.scheme != "http"
        or parsed.hostname != "127.0.0.1"
        or parsed.username is not None
        or parsed.password is not None
        or parsed.path != "/runtime-evidence"
        or parsed.query
        or parsed.fragment
    ):
        raise RuntimeError("runtime evidence endpoint invalid")
    try:
        port = parsed.port
    except ValueError as exc:
        raise RuntimeError("runtime evidence endpoint invalid") from exc
    if not isinstance(port, int) or port <= 0 or port > 65535:
        raise RuntimeError("runtime evidence endpoint invalid")
    return f"http://127.0.0.1:{port}/runtime-evidence"


def _write_result(request_id, result):
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": request_id, "result": result}, sort_keys=True) + "\n")
    sys.stdout.flush()


def _write_error(request_id, code, message):
    sys.stdout.write(json.dumps({"jsonrpc": "2.0", "id": request_id, "error": {"code": code, "message": message}}, sort_keys=True) + "\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()
