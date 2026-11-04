#!/usr/bin/env python3
"""Serve bounded vendor-shaped HTTP fixtures and request-correlated receipts."""

from __future__ import annotations

import contextlib
import hashlib
import json
import re
import select
import socket
import threading
import time
from collections import OrderedDict, deque
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import parse_qs, unquote, urlsplit

from scenarios import MARKER_RE, Scenario, response_text

SERVICE = "gateway-lab"
VERSION = 1
READY_PREFIX = "READY "
MAX_EVENTS = 20000
MAX_BODY_BYTES = 8 * 1024 * 1024
MAX_HANDLERS = 64
READ_TIMEOUT_S = 30.0
NODE_RE = re.compile(r"/nodes/([A-Za-z0-9_-]{1,64})(/.*)")
GEMINI_RE = re.compile(r"/v1beta/models/([^/]+):(generateContent|streamGenerateContent)")


class EventStore:
    """Keep bounded receipts and per-logical-request attempts across mock nodes."""

    def __init__(self, events_file: str | None = None) -> None:
        self.lock = threading.Lock()
        self.events: deque[dict[str, Any]] = deque(maxlen=MAX_EVENTS)
        self.attempts: OrderedDict[tuple[str, str], int] = OrderedDict()
        self._closing = contextlib.closing(open(events_file, "a", encoding="utf-8")) if events_file else None  # noqa: SIM115
        self.file = self._closing.__enter__() if self._closing else None

    def attempt(self, run_id: str, request_id: str) -> int:
        with self.lock:
            key = (run_id, request_id)
            count = self.attempts.get(key, 0) + 1
            self.attempts[key] = count
            if len(self.attempts) > 5000:
                self.attempts.popitem(last=False)
            return count

    def add(self, event: dict[str, Any]) -> None:
        with self.lock:
            self.events.append(event)
            if self.file:
                self.file.write(json.dumps(event, ensure_ascii=False) + "\n")
                self.file.flush()

    def events_for(self, run_id: str | None) -> list[dict[str, Any]]:
        with self.lock:
            return [e for e in self.events if run_id is None or e["run_id"] == run_id]

    def close(self) -> None:
        if self._closing:
            self._closing.__exit__(None, None, None)


class PeerDisconnected(Exception):
    """Stop the exchange as soon as a peer closure is observed."""


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def setup(self) -> None:
        super().setup()
        self.connection.settimeout(READ_TIMEOUT_S)
        self.context: dict[str, Any] | None = None
        self.aborted = False
        self.started = time.monotonic()

    def log_message(self, *_args: Any) -> None:
        # BaseHTTPRequestHandler otherwise logs request paths and raw parse errors.
        pass

    def note(self, kind: str, status: int | None = None, detail: str = "") -> None:
        if self.context is not None:
            self.server.store.add({**self.context, "kind": kind, "status": status,
                                   "detail": detail, "wall_time_s": time.time(),
                                   "elapsed_ms": round((time.monotonic() - self.started) * 1000, 3)})

    def abort(self) -> None:
        if not self.aborted:
            self.aborted = True
            self.note("peer_closed", detail="peer_connection_closed")
            self.note("aborted", detail="exchange_stopped")
        self.close_connection = True
        raise PeerDisconnected

    def wait_peer(self, seconds: float) -> None:
        """Poll FIN/RST even while no response bytes are being written."""
        deadline = time.monotonic() + seconds
        while True:
            remaining = max(0.0, deadline - time.monotonic())
            try:
                readable, _, _ = select.select([self.connection], [], [], min(remaining, 0.025))
                if readable and not self.connection.recv(1, socket.MSG_PEEK | socket.MSG_DONTWAIT):
                    self.abort()
            except BlockingIOError:
                pass
            except OSError:
                self.abort()
            if time.monotonic() >= deadline:
                return

    def write_bytes(self, data: bytes) -> None:
        try:
            self.wfile.write(data)
            self.wfile.flush()
        except OSError:
            self.abort()

    def send_headers(self, status: int, content_type: str, length: int | None) -> None:
        self.wait_peer(0)
        try:
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Connection", "close")
            if length is None:
                self.send_header("Transfer-Encoding", "chunked")
            else:
                self.send_header("Content-Length", str(length))
            if self.context is not None:
                self.send_header("X-Upstream-Request-Id",
                                 f"lab-{self.context['node']}-{self.context['request_id']}-{self.context['attempt']}")
            self.end_headers()
        except OSError:
            self.abort()
        self.note("headers", status)

    def send_json(self, status: int, value: Any) -> None:
        body = json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.send_headers(status, "application/json", len(body))
        self.write_bytes(body)
        self.note("complete", status)

    def send_chunk(self, data: bytes, fragment_bytes: int = 0) -> None:
        step = fragment_bytes or len(data)
        for offset in range(0, len(data), step):
            self.wait_peer(0)
            piece = data[offset:offset + step]
            self.write_bytes(f"{len(piece):x}\r\n".encode("ascii") + piece + b"\r\n")

    def route(self) -> tuple[str, str, str | None, bool, str]:
        path = urlsplit(self.path).path
        node = "default"
        if path.startswith("/nodes/"):
            match = NODE_RE.fullmatch(path)
            if match is None:
                return path, node, None, False, "gateway-lab"
            node, path = match.groups()
        protocol = {"/v1/chat/completions": "chat", "/v1/responses": "responses",
                    "/v1/messages": "claude"}.get(path)
        gemini = GEMINI_RE.fullmatch(path)
        if gemini:
            return path, node, "gemini", gemini[2] == "streamGenerateContent", unquote(gemini[1])
        return path, node, protocol, False, "gateway-lab"

    def do_GET(self) -> None:
        self.close_connection = True
        path, _, _, _, _ = self.route()
        try:
            if path == "/healthz":
                self.send_json(200, {"service": SERVICE, "version": VERSION})
            elif path == "/events":
                query = parse_qs(urlsplit(self.path).query)
                run_id = query.get("run", [None])[0]
                self.send_json(200, {"service": SERVICE, "version": VERSION,
                                     "events": self.server.store.events_for(run_id)})
            elif path == "/v1/models":
                self.send_json(200, {"object": "list", "data": [{"id": "gateway-lab", "object": "model"}]})
            else:
                self.send_json(404, {"error": {"type": "lab_error", "message": "unknown route"}})
        except PeerDisconnected:
            pass

    def do_POST(self) -> None:
        self.close_connection = True
        self.started = time.monotonic()
        try:
            self.handle_post()
        except PeerDisconnected:
            pass

    def handle_post(self) -> None:
        _, node, protocol, stream, model = self.route()
        if protocol is None:
            self.send_json(404, {"error": {"type": "lab_error", "message": "unknown route"}})
            return
        lengths = self.headers.get_all("Content-Length", [])
        try:
            length = int(lengths[0]) if len(lengths) == 1 else 0
        except ValueError:
            length = 0
        if self.headers.get("Transfer-Encoding") or not 0 < length <= MAX_BODY_BYTES:
            self.send_json(400, {"error": {"type": "lab_error", "message": "bounded Content-Length required"}})
            return
        body = bytearray()
        deadline = time.monotonic() + READ_TIMEOUT_S
        while len(body) < length:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                self.send_json(400, {"error": {"type": "lab_error", "message": "incomplete request body"}})
                return
            self.connection.settimeout(remaining)
            try:
                chunk = self.rfile.read1(min(65536, length - len(body)))
            except OSError:
                return
            if not chunk:
                return
            body.extend(chunk)
        self.connection.settimeout(READ_TIMEOUT_S)
        try:
            payload = json.loads(body)
        except (ValueError, UnicodeDecodeError):
            self.send_json(400, {"error": {"type": "lab_error", "message": "invalid request JSON"}})
            return
        if not isinstance(payload, dict):
            self.send_json(400, {"error": {"type": "lab_error", "message": "request object required"}})
            return
        pending = [payload]
        markers: set[str] = set()
        while pending:
            value = pending.pop()
            if isinstance(value, str):
                markers.update(m.group(0) for m in MARKER_RE.finditer(value))
            elif isinstance(value, dict):
                pending.extend(value.values())
            elif isinstance(value, list):
                pending.extend(value)
        if len(markers) != 1:
            self.send_json(400, {"error": {"type": "lab_error", "message": "one unambiguous lab marker required"}})
            return
        match = MARKER_RE.fullmatch(markers.pop())
        run_id, case_name, request_id = match.group("run_id", "case", "request_id")
        scenario = self.server.scenarios.get(case_name)
        if protocol != "gemini":
            stream = payload.get("stream", False)
            model = payload.get("model", "gateway-lab")
        if (scenario is None or protocol not in scenario.protocols
                or type(stream) is not bool or stream != scenario.stream):
            self.send_json(400, {"error": {"type": "lab_error", "message": "scenario/protocol/stream mismatch"}})
            return
        attempt = self.server.store.attempt(run_id, request_id)
        self.context = {"run_id": run_id, "case": case_name, "request_id": request_id,
                        "node": node, "attempt": attempt, "protocol": protocol,
                        "request_bytes": len(body), "body_sha256": hashlib.sha256(body).hexdigest(),
                        "mode": scenario.mode, "stream": stream, "expect": scenario.expect}
        self.request_tokens = max(1, len(body) // 4)
        self.note("begin")
        self.wait_peer(scenario.delay_s)
        mode = scenario.mode
        if mode.startswith("http_") or (mode == "retry_503" and attempt == 1):
            code = int(mode[5:]) if mode.startswith("http_") else 503
            self.send_json(code, {"error": {"type": "lab_error", "message": f"synthetic HTTP {code}"}})
        elif mode in ("empty_body", "malformed_json"):
            body = b"" if mode == "empty_body" else b"{not valid json"
            self.send_headers(200, "application/json", len(body))
            self.write_bytes(body)
            self.note("complete", 200)
        elif stream:
            self.stream_response(protocol, model, request_id, scenario)
        else:
            self.send_json(200, self.native_response(protocol, model, request_id, scenario))

    def native_response(self, protocol: str, model: str, request_id: str, scenario: Scenario) -> dict[str, Any]:
        """Return a native nonstream response, including valid no-text semantics."""
        mode = scenario.mode
        text = response_text(request_id, scenario.chunks) if mode not in ("empty_content", "tool_only", "reasoning_only", "safety_block") else ""
        rid = f"lab-{self.context['node']}-{request_id}"
        tokens = max(1, len(text) // 4)
        prompt = self.request_tokens
        if protocol == "chat":
            message: dict[str, Any] = {"role": "assistant", "content": text}
            finish = "stop"
            if mode == "tool_only":
                message["tool_calls"] = [{"id": "lab_call", "type": "function",
                                          "function": {"name": "lab_tool", "arguments": "{}"}}]
                finish = "tool_calls"
            elif mode == "reasoning_only":
                message["reasoning_content"] = response_text(request_id, scenario.chunks)
            return {"id": rid, "object": "chat.completion", "created": int(time.time()), "model": model,
                    "choices": [{"index": 0, "message": message, "finish_reason": finish}],
                    "usage": {"prompt_tokens": prompt, "completion_tokens": tokens, "total_tokens": prompt + tokens}}
        if protocol == "responses":
            item = {"type": "message", "id": rid + "-msg", "role": "assistant", "status": "completed",
                    "content": [{"type": "output_text", "text": text, "annotations": []}]}
            if mode == "tool_only":
                item = {"type": "function_call", "id": "lab_call", "call_id": "lab_call",
                        "name": "lab_tool", "arguments": "{}", "status": "completed"}
            return {"id": rid, "object": "response", "created_at": int(time.time()), "model": model,
                    "status": "completed", "output": [item],
                    "usage": {"input_tokens": prompt, "output_tokens": tokens, "total_tokens": prompt + tokens}}
        if protocol == "claude":
            block = {"type": "text", "text": text}
            if mode == "tool_only":
                block = {"type": "tool_use", "id": "lab_call", "name": "lab_tool", "input": {}}
            return {"id": rid, "type": "message", "role": "assistant", "model": model,
                    "content": [block], "stop_reason": "tool_use" if mode == "tool_only" else "end_turn",
                    "stop_sequence": None, "usage": {"input_tokens": prompt, "output_tokens": tokens}}
        if mode == "safety_block":
            return {"promptFeedback": {"blockReason": "SAFETY"}, "candidates": []}
        part = {"text": text} if mode != "tool_only" else {"functionCall": {"name": "lab_tool", "args": {}}}
        return {"candidates": [{"index": 0, "content": {"role": "model", "parts": [part]}, "finishReason": "STOP"}],
                "modelVersion": model, "usageMetadata": {"promptTokenCount": prompt,
                "candidatesTokenCount": tokens, "totalTokenCount": prompt + tokens}}

    def stream_events(self, protocol: str, model: str, request_id: str,
                      scenario: Scenario) -> Iterator[tuple[dict[str, Any] | bytes, bool]]:
        """Yield native events; only the protocol's final event is terminal."""
        unit = response_text(request_id, 1)
        truncated = scenario.mode == "truncated_stream"
        count = max(1, scenario.chunks - 1) if truncated else scenario.chunks
        rid = f"lab-{self.context['node']}-{request_id}"
        if protocol == "chat":
            base = {"id": rid, "object": "chat.completion.chunk", "created": int(time.time()), "model": model}
            if scenario.mode == "role_only":
                yield {**base, "choices": [{"index": 0, "delta": {"role": "assistant"}}]}, False
            elif scenario.mode == "usage_only":
                yield {**base, "choices": [], "usage": {"prompt_tokens": 10, "completion_tokens": 0, "total_tokens": 10}}, False
            else:
                for index in range(count):
                    choice: dict[str, Any] = {"index": 0, "delta": {"content": unit}}
                    if index == count - 1 and not truncated and scenario.mode not in ("bare_done", "bare_done_hold"):
                        choice["finish_reason"] = "stop"
                    yield {**base, "choices": [choice]}, False
            if not truncated:
                yield b"[DONE]\n\n" if scenario.mode in ("bare_done", "bare_done_hold") else b"data: [DONE]\n\n", True
            return
        if protocol == "responses":
            final = self.native_response(protocol, model, request_id, scenario)
            item = final["output"][0]
            empty_item = {**item, "status": "in_progress", "content": []}
            yield {"type": "response.created", "response": {**final, "status": "in_progress", "output": [], "usage": None}}, False
            yield {"type": "response.output_item.added", "output_index": 0, "item": empty_item}, False
            yield {"type": "response.content_part.added", "item_id": item["id"], "output_index": 0,
                   "content_index": 0, "part": {"type": "output_text", "text": "", "annotations": []}}, False
            for _ in range(count):
                yield {"type": "response.output_text.delta", "item_id": item["id"], "output_index": 0,
                       "content_index": 0, "delta": unit}, False
            if not truncated:
                yield {"type": "response.output_text.done", "item_id": item["id"], "output_index": 0,
                       "content_index": 0, "text": item["content"][0]["text"]}, False
                yield {"type": "response.content_part.done", "item_id": item["id"], "output_index": 0,
                       "content_index": 0, "part": item["content"][0]}, False
                yield {"type": "response.output_item.done", "output_index": 0, "item": item}, False
                yield {"type": "response.completed", "response": final}, True
            return
        if protocol == "claude":
            final = self.native_response(protocol, model, request_id, scenario)
            yield {"type": "message_start", "message": {**final, "content": [], "stop_reason": None,
                   "usage": {"input_tokens": 10, "output_tokens": 0}}}, False
            yield {"type": "content_block_start", "index": 0, "content_block": {"type": "text", "text": ""}}, False
            for _ in range(count):
                yield {"type": "content_block_delta", "index": 0, "delta": {"type": "text_delta", "text": unit}}, False
            if not truncated:
                yield {"type": "content_block_stop", "index": 0}, False
                yield {"type": "message_delta", "delta": {"stop_reason": "end_turn", "stop_sequence": None},
                       "usage": {"output_tokens": max(1, len(unit) * count // 4)}}, False
                yield {"type": "message_stop"}, True
            return
        for index in range(count):
            terminal = index == count - 1 and not truncated
            candidate = {"index": 0, "content": {"role": "model", "parts": [{"text": unit}]}}
            if terminal:
                candidate["finishReason"] = "STOP"
            event: dict[str, Any] = {"candidates": [candidate]}
            if terminal:
                event["usageMetadata"] = {"promptTokenCount": 10, "candidatesTokenCount": count * 10,
                                          "totalTokenCount": 10 + count * 10}
            yield event, terminal

    def stream_response(self, protocol: str, model: str, request_id: str, scenario: Scenario) -> None:
        self.send_headers(200, "text/event-stream", None)
        self.wait_peer(scenario.first_chunk_delay_s)
        if scenario.mode == "malformed_sse":
            self.send_chunk(b"data: {broken json\n\n", scenario.fragment_bytes)
        else:
            for sequence, (event, terminal) in enumerate(self.stream_events(protocol, model, request_id, scenario)):
                if sequence:
                    self.wait_peer(scenario.gap_s)
                if isinstance(event, bytes):
                    frame = event
                else:
                    if protocol == "responses":
                        event["sequence_number"] = sequence
                    prefix = "event: " + event["type"] + "\n" if "type" in event else ""
                    frame = (prefix + "data: " + json.dumps(event, ensure_ascii=False) + "\n\n").encode("utf-8")
                self.send_chunk(frame, scenario.fragment_bytes)
                if terminal:
                    self.note("terminal", 200)
        if scenario.mode == "truncated_stream":
            self.note("aborted", detail="intentional_truncation")
            try:
                self.connection.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            return
        if scenario.mode == "bare_done_hold":
            self.wait_peer(scenario.hold_s)
        self.write_bytes(b"0\r\n\r\n")
        self.note("complete", 200)


class LabServer(ThreadingHTTPServer):
    """Acquire permits before spawning threads, including idle HTTP connections."""

    daemon_threads = True
    request_queue_size = 64

    def __init__(self, address: tuple[str, int], scenarios: dict[str, Scenario], store: EventStore) -> None:
        super().__init__(address, Handler)
        self.scenarios = scenarios
        self.store = store
        self.permits = threading.BoundedSemaphore(MAX_HANDLERS)

    def process_request(self, request: socket.socket, client_address: tuple[str, int]) -> None:
        if not self.permits.acquire(blocking=False):
            request.close()
            return
        try:
            super().process_request(request, client_address)
        except Exception:
            self.permits.release()
            raise

    def process_request_thread(self, request: socket.socket, client_address: tuple[str, int]) -> None:
        try:
            super().process_request_thread(request, client_address)
        finally:
            self.permits.release()


def serve(host: str, port: int, scenarios: dict[str, Scenario], events_file: str | None = None) -> None:
    """Serve until interrupted; port zero selects an available local port."""
    store = EventStore(events_file)
    try:
        with LabServer((host, port), scenarios, store) as server:
            actual_host, actual_port = server.server_address
            print(f"{READY_PREFIX}http://{actual_host}:{actual_port}", flush=True)
            server.serve_forever()
    finally:
        store.close()
