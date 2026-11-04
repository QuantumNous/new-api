#!/usr/bin/env python3
"""Send synthetic HTTP requests and reconcile their results with upstream receipts."""

from __future__ import annotations

import codecs
import hashlib
import json
import math
import os
import socket
import threading
import time
from dataclasses import dataclass, field
from http.client import HTTPConnection, HTTPException, HTTPSConnection
from typing import Any
from urllib.parse import quote, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from scenarios import Scenario, marker, response_text

MAX_BODY = 16 * 1024 * 1024
ID_HEADERS = ("x-oneapi-request-id", "x-upstream-request-id", "x-request-id", "request-id")


class DriverSetupError(ValueError):
    """Configuration failed before any model request was sent."""


def validate_url(value: str) -> None:
    """Allow HTTP roots without embedded credentials or query-string secrets."""
    try:
        parts = urlsplit(value)
        if (parts.scheme not in ("http", "https") or not parts.hostname
                or parts.username is not None or parts.password is not None
                or parts.query or parts.fragment or any(c.isspace() for c in value)):
            raise ValueError
        _ = parts.port
    except (ValueError, TypeError):
        raise DriverSetupError("URL must be an HTTP(S) root without credentials, query or fragment") from None


class _NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req: Request, fp: Any, code: int, msg: str,
                         headers: Any, newurl: str) -> None:
        return None


def control_json(url: str, timeout: float = 2.0) -> dict[str, Any]:
    """Read bounded mock metadata without redirects or ambient HTTP proxies."""
    from urllib.request import ProxyHandler

    with build_opener(ProxyHandler({}), _NoRedirect()).open(url, timeout=timeout) as response:
        raw = response.read(MAX_BODY + 1)
    if len(raw) > MAX_BODY:
        raise ValueError("mock metadata exceeds limit")
    value = json.loads(raw)
    if not isinstance(value, dict) or value.get("service") != "gateway-lab":
        raise ValueError("not a gateway-lab mock")
    return value


class SSEParser:
    """Decode SSE events across arbitrary UTF-8 and HTTP read boundaries."""

    def __init__(self) -> None:
        self.decoder = codecs.getincrementaldecoder("utf-8")()
        self.buffer = ""
        self.data: list[str] = []
        self.event = ""
        self.size = 0

    def _line(self, line: str) -> list[tuple[str, str]]:
        if line.strip() == "[DONE]":
            pending = self._dispatch()
            return pending + [("", "[DONE]")]
        if line == "":
            return self._dispatch()
        if line.startswith(":"):
            return []
        key, separator, value = line.partition(":")
        if separator and value.startswith(" "):
            value = value[1:]
        if key == "data":
            self.data.append(value)
            self.size += len(value)
            if self.size > MAX_BODY:
                raise ValueError("SSE event exceeds limit")
        elif key == "event":
            self.event = value
        return []

    def _dispatch(self) -> list[tuple[str, str]]:
        events = [(self.event, "\n".join(self.data))] if self.data else []
        self.data = []
        self.event = ""
        self.size = 0
        return events

    def feed(self, data: bytes, final: bool = False) -> list[tuple[str, str]]:
        self.buffer += self.decoder.decode(data, final=final)
        if len(self.buffer) > MAX_BODY:
            raise ValueError("SSE line exceeds limit")
        result: list[tuple[str, str]] = []
        while "\n" in self.buffer:
            line, self.buffer = self.buffer.split("\n", 1)
            result.extend(self._line(line.removesuffix("\r")))
        if final:
            if self.buffer:
                result.extend(self._line(self.buffer.removesuffix("\r")))
                self.buffer = ""
            result.extend(self._dispatch())
        return result


@dataclass
class Observation:
    """Only semantic response data is retained; raw upstream errors are not reported."""

    protocol: str
    text: list[str] = field(default_factory=list)
    reasoning: list[str] = field(default_factory=list)
    tools: list[tuple[str, Any]] = field(default_factory=list)
    usage: dict[str, int | float] = field(default_factory=dict)
    terminal: str | None = None
    finish_reason: str | None = None
    error: bool = False
    safety: bool = False
    ids: list[str] = field(default_factory=list)

    def _usage(self, value: Any) -> None:
        if not isinstance(value, dict):
            return
        names = {"input_tokens", "output_tokens", "total_tokens", "prompt_tokens", "completion_tokens",
                 "promptTokenCount", "candidatesTokenCount", "totalTokenCount", "thoughtsTokenCount"}
        for key in names:
            count = value.get(key)
            if type(count) in (int, float) and math.isfinite(count) and count >= 0:
                self.usage[key] = count

    def _tools(self, calls: Any) -> None:
        if not isinstance(calls, list):
            return
        for call in calls:
            if not isinstance(call, dict):
                continue
            function = call.get("function", call)
            if not isinstance(function, dict):
                continue
            arguments = function.get("arguments", function.get("args", function.get("input")))
            if isinstance(arguments, str):
                try:
                    arguments = json.loads(arguments)
                except ValueError:
                    arguments = None
            self.tools.append((function.get("name", ""), arguments))

    def consume(self, obj: Any, *, stream: bool, event: str = "") -> bool:
        """Consume one native object and return whether it contains semantic output."""
        if not isinstance(obj, dict):
            raise TypeError("response object expected")
        before = (len(self.text), len(self.reasoning), len(self.tools), self.safety)
        kind = obj.get("type", event)
        self.error |= bool(obj.get("error")) or kind in ("error", "response.failed", "response.incomplete")
        if isinstance(obj.get("id"), str):
            self.ids.append(obj["id"][:256])
        self._usage(obj.get("usage", obj.get("usageMetadata")))
        if self.protocol == "chat":
            choices = obj.get("choices", [])
            if choices and isinstance(choices[0], dict):
                choice = choices[0]
                msg = choice.get("delta" if stream else "message", {})
                if isinstance(msg, dict):
                    if isinstance(msg.get("content"), str) and msg["content"]:
                        self.text.append(msg["content"])
                    if isinstance(msg.get("reasoning_content"), str) and msg["reasoning_content"]:
                        self.reasoning.append(msg["reasoning_content"])
                    self._tools(msg.get("tool_calls"))
                if choice.get("finish_reason"):
                    self.finish_reason = str(choice["finish_reason"])
                    if not stream:
                        self.terminal = self.finish_reason
        elif self.protocol == "responses":
            if stream and kind == "response.output_text.delta" and isinstance(obj.get("delta"), str):
                self.text.append(obj["delta"])
            response = obj.get("response", obj)
            if isinstance(response, dict):
                self._usage(response.get("usage"))
                if not stream:
                    final_text: list[str] = []
                    for item in response.get("output", []):
                        if not isinstance(item, dict):
                            continue
                        if item.get("type") == "function_call":
                            self._tools([item])
                        for part in item.get("content", []):
                            if (isinstance(part, dict) and part.get("type") == "output_text"
                                    and isinstance(part.get("text"), str)):
                                final_text.append(part["text"])
                    if not self.text:
                        self.text.extend(final_text)
            if (isinstance(response, dict) and response.get("status") == "completed"
                    and (not stream or kind == "response.completed")):
                self.terminal = "response.completed"
        elif self.protocol == "claude":
            if stream:
                message = obj.get("message")
                if isinstance(message, dict):
                    self._usage(message.get("usage"))
                delta = obj.get("delta", {})
                if isinstance(delta, dict) and isinstance(delta.get("text"), str) and delta["text"]:
                    self.text.append(delta["text"])
                if kind == "message_stop":
                    self.terminal = "message_stop"
            else:
                for block in obj.get("content", []):
                    if not isinstance(block, dict):
                        continue
                    if block.get("type") == "text" and isinstance(block.get("text"), str) and block["text"]:
                        self.text.append(block["text"])
                    elif block.get("type") == "tool_use":
                        self._tools([block])
                if obj.get("stop_reason"):
                    self.terminal = str(obj["stop_reason"])
        else:
            feedback = obj.get("promptFeedback", {})
            self.safety |= isinstance(feedback, dict) and feedback.get("blockReason") == "SAFETY"
            for candidate in obj.get("candidates", [])[:1]:
                if not isinstance(candidate, dict):
                    continue
                content = candidate.get("content", {})
                if isinstance(content, dict):
                    for part in content.get("parts", []):
                        if not isinstance(part, dict):
                            continue
                        if isinstance(part.get("text"), str) and part["text"]:
                            (self.reasoning if part.get("thought") else self.text).append(part["text"])
                        if isinstance(part.get("functionCall"), dict):
                            self._tools([part["functionCall"]])
                if candidate.get("finishReason"):
                    self.terminal = str(candidate["finishReason"])
                    self.safety |= self.terminal == "SAFETY"
        return before != (len(self.text), len(self.reasoning), len(self.tools), self.safety)


def _receipts(mock_url: str, run_id: str, request_id: str, grace: float,
              cancelled: bool) -> list[dict[str, Any]]:
    """Poll receipts; cancellations run the full grace, noncancel returns once all attempts are terminal."""
    deadline = time.monotonic() + grace
    found: list[dict[str, Any]] = []
    TERMINAL = {"complete", "aborted", "terminal", "peer_closed"}
    quiet_until: float | None = None
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            return found
        try:
            payload = control_json(mock_url.rstrip("/") + "/events?run=" + run_id,
                                   timeout=min(remaining, 1.0))
            for event in payload.get("events", []):
                if (isinstance(event, dict) and event.get("run_id") == run_id
                        and event.get("request_id") == request_id and event not in found):
                    found.append(event)
        except (OSError, ValueError):
            pass
        if not cancelled:
            began = {e.get("attempt") for e in found
                     if e.get("kind") == "begin" and isinstance(e.get("attempt"), int)}
            termed = {e.get("attempt") for e in found
                      if e.get("kind") in TERMINAL and isinstance(e.get("attempt"), int)}
            if began and began <= termed:
                if quiet_until is None:
                    quiet_until = time.monotonic() + 0.05
                elif time.monotonic() >= quiet_until:
                    return found
            else:
                quiet_until = None
        time.sleep(min(0.025, max(0, deadline - time.monotonic())))


def run_case(target: dict[str, Any], scenario: Scenario, run_id: str, request_id: str,
             *, cancel_grace_s: float = 1.0) -> dict[str, Any]:
    """Run one actual request; HTTP 200 without content and receipts cannot pass."""
    protocol = target["protocol"]
    result: dict[str, Any] = {
        "target": target["name"], "protocol": protocol, "model": target["model"],
        "case": scenario.name, "run_id": run_id, "request_id": request_id,
        "verdict": "SKIP", "reason": "unsupported protocol for scenario", "checks": [],
    }
    if protocol not in scenario.protocols:
        return result
    validate_url(target["base_url"])
    validate_url(target["mock_url"])
    env = target.get("api_key_env")
    key = os.environ.get(env, "") if env else ""
    if env and not key:
        raise DriverSetupError("configured API-key environment variable is missing or empty")
    root = target["base_url"].rstrip("/")
    for suffix in ("/v1beta", "/v1"):
        if root.endswith(suffix):
            root = root[:-len(suffix)]
            break
    prompt = marker(run_id, scenario.name, request_id) + "x" * scenario.context_chars
    payload: dict[str, Any]
    headers = {"Content-Type": "application/json", "Connection": "close", "Accept": "text/event-stream" if scenario.stream else "application/json"}
    if protocol == "gemini":
        path = f"/v1beta/models/{quote(target['model'], safe='')}:" + ("streamGenerateContent?alt=sse" if scenario.stream else "generateContent")
        payload = {"contents": [{"role": "user", "parts": [{"text": prompt}]}]}
        if key:
            headers["x-goog-api-key"] = key
    else:
        path = {"chat": "/v1/chat/completions", "responses": "/v1/responses", "claude": "/v1/messages"}[protocol]
        payload = {"model": target["model"], "stream": scenario.stream}
        if protocol == "responses":
            payload["input"] = prompt
        else:
            payload["messages"] = [{"role": "user", "content": prompt}]
        if protocol == "claude":
            payload["max_tokens"] = 1024
            headers["anthropic-version"] = "2023-06-01"
            if key:
                headers["x-api-key"] = key
        elif key:
            headers["Authorization"] = "Bearer " + key
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    parts = urlsplit(root + path)
    connection = (HTTPSConnection if parts.scheme == "https" else HTTPConnection)(
        parts.hostname, parts.port, timeout=scenario.timeout_s)
    started = time.monotonic()
    finished = threading.Event()
    deadline_fired = threading.Event()
    cancel_wall: list[float] = []
    timers: list[threading.Timer] = []
    sock: socket.socket | None = None
    response: Any = None
    observation = Observation(protocol)
    parser = SSEParser()
    status = None
    ids: dict[str, str] = {}
    raw = bytearray()
    total_bytes = 0
    first_byte = first_content = terminal_wall = last_event = None
    gaps: list[float] = []
    error: str | None = None

    def close_socket(cancel: bool) -> None:
        if finished.is_set():
            return
        if cancel:
            cancel_wall.append(time.time())
        else:
            deadline_fired.set()
        if sock is not None:
            try:
                sock.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass

    try:
        connection.connect()
        sock = connection.sock
        timer = threading.Timer(max(0.001, scenario.timeout_s - (time.monotonic() - started)), close_socket, args=(False,))
        timer.daemon = True
        timer.start()
        timers.append(timer)
        connection.request("POST", parts.path + ("?" + parts.query if parts.query else ""), body, headers)
        if scenario.cancel_after_s:
            timer = threading.Timer(scenario.cancel_after_s, close_socket, args=(True,))
            timer.daemon = True
            timer.start()
            timers.append(timer)
        response = connection.getresponse()
        status = response.status
        ids = {h: response.getheader(h)[:256] for h in ID_HEADERS if response.getheader(h)}
        is_sse = scenario.stream and 200 <= status < 300 and "text/event-stream" in response.getheader("Content-Type", "")
        if scenario.stream and 200 <= status < 300 and not is_sse:
            error = "expected SSE content type"
        stop = False
        while not stop:
            remaining = scenario.timeout_s - (time.monotonic() - started)
            if remaining <= 0 or deadline_fired.is_set():
                error = "request deadline exceeded"
                break
            if sock is not None:
                sock.settimeout(remaining)
            chunk = response.read1(65536)
            now = time.monotonic()
            if chunk and first_byte is None:
                first_byte = now
            total_bytes += len(chunk)
            if total_bytes > MAX_BODY:
                raise ValueError("response exceeds limit")
            if is_sse:
                for event, data in parser.feed(chunk, final=not chunk):
                    if last_event is not None:
                        gaps.append((now - last_event) * 1000)
                    last_event = now
                    if data.strip() == "[DONE]":
                        if protocol != "chat":
                            raise ValueError("terminal belongs to another protocol")
                        observation.terminal = "[DONE]"
                        terminal_wall = time.time()
                        stop = True
                        break
                    semantic = observation.consume(json.loads(data), stream=True, event=event)
                    if semantic and first_content is None:
                        first_content = now
                    if observation.terminal:
                        terminal_wall = time.time()
                        if protocol != "chat":
                            stop = True
                            break
            else:
                raw.extend(chunk)
            if not chunk or (not is_sse and response.isclosed()):
                break
            if scenario.read_delay_s and not stop:
                deadline_fired.wait(min(scenario.read_delay_s, max(0, scenario.timeout_s - (time.monotonic() - started))))
        if not is_sse:
            semantic = observation.consume(json.loads(raw), stream=False)
            if semantic:
                first_content = time.monotonic()
    except (OSError, ValueError, TypeError, KeyError, AttributeError, IndexError) as exc:
        error = "response " + type(exc).__name__
    except HTTPException as exc:
        error = "transport " + type(exc).__name__
    finally:
        finished.set()
        for timer in timers:
            timer.cancel()
            timer.join(timeout=0.2)
        if response is not None:
            response.close()
        connection.close()
        if sock is not None:
            sock.close()
    elapsed_ms = (time.monotonic() - started) * 1000
    if deadline_fired.is_set():
        error = "request deadline exceeded"
    receipts = _receipts(target["mock_url"], run_id, request_id, cancel_grace_s, bool(cancel_wall))
    begins = [e for e in receipts if e.get("kind") == "begin"]
    receipt_ok = bool(begins) and all(
        e.get("case") == scenario.name and e.get("mode") == scenario.mode
        and e.get("stream") == scenario.stream and type(e.get("attempt")) is int and e["attempt"] > 0
        for e in begins)
    attempts = {e["attempt"]: e for e in begins}
    nodes: dict[str, int] = {}
    for event in attempts.values():
        node = str(event.get("node", "default"))
        nodes[node] = nodes.get(node, 0) + 1
    headers_events = [e for e in receipts if e.get("kind") == "headers"]
    peer_events = [e for e in receipts if e.get("kind") == "peer_closed"]
    cancel_delay = None
    if cancel_wall and peer_events:
        delays = [(e.get("wall_time_s", 0) - cancel_wall[0]) * 1000 for e in peer_events]
        nonnegative = [d for d in delays if d >= 0]
        if nonnegative:
            cancel_delay = max(nonnegative)
    text = "".join(observation.text)
    expected = response_text(request_id, scenario.chunks)
    positive_status = status is not None and 200 <= status < 300
    checks: list[dict[str, Any]] = []

    def check(name: str, passed: bool, detail: str = "") -> bool:
        checks.append({"name": name, "passed": bool(passed), "detail": detail})
        return bool(passed)

    check("upstream_scenario_receipt", receipt_ok, f"attempts={len(attempts)}")
    expectation = target.get("expectations", {}).get(scenario.name, scenario.expect)
    complete = positive_status and not error and not observation.error and bool(observation.terminal) and text == expected
    passed = False
    reason = expectation
    if not receipt_ok:
        verdict, reason = "FAIL", "missing or mismatched upstream scenario receipt"
    elif expectation == "observed":
        verdict, reason = "OBSERVED", "gateway-policy outcome recorded, not a correctness pass"
    else:
        if expectation in ("complete", "recovered", "bare_done"):
            passed = check("complete_exact_content", complete, f"status={status}, terminal={observation.terminal}, error={error}")
            if expectation == "recovered":
                failed = [e["attempt"] for e in headers_events if e.get("status") == 503]
                succeeded = [e["attempt"] for e in headers_events if e.get("status") == 200]
                recovered = bool(failed and succeeded and min(failed) < max(succeeded))
                passed = check("failed_then_successful_attempt", recovered, "enable gateway retries and at least two lab routes") and passed
            elif expectation == "bare_done":
                budget = (scenario.delay_s + scenario.first_chunk_delay_s + scenario.chunks * scenario.gap_s
                          + scenario.hold_s * 0.75) * 1000
                early = observation.terminal == "[DONE]" and terminal_wall is not None and elapsed_ms < budget
                passed = check("terminal_before_socket_hold_ends", early, f"elapsed_ms={elapsed_ms:.1f}, budget_ms={budget:.1f}") and passed
        elif expectation == "rejected":
            rejected = (status is not None and not positive_status) or observation.error
            upstream_fault = bool(headers_events)
            if scenario.mode.startswith("http_"):
                upstream_fault = any(e.get("status") == int(scenario.mode[5:]) for e in headers_events)
            passed = check("fault_not_fabricated_success", bool(rejected and upstream_fault and not observation.terminal))
        elif expectation == "cancel":
            cancel_time = cancel_wall[0] if cancel_wall else None
            max_cancel_ms = target.get("max_cancel_delay_ms", 1000)
            if cancel_time is None:
                passed = check("upstream_closed_after_client_cancel", False,
                               "no client cancel observed; same-host wall clocks required")
            else:
                no_late_retry = not any(
                    e.get("wall_time_s", 0) > cancel_time for e in begins)
                no_completed_after_cancel = not any(
                    e.get("kind") in ("complete", "terminal")
                    and e.get("wall_time_s", 0) > cancel_time for e in receipts)
                per_attempt: dict[int, float] = {}
                for attempt in attempts:
                    delays = [((pe.get("wall_time_s") or 0) - cancel_time) * 1000
                              for pe in peer_events if pe.get("attempt") == attempt]
                    nonnegative = [d for d in delays if d >= 0]
                    if nonnegative:
                        per_attempt[attempt] = max(nonnegative)
                all_attempts_closed = bool(attempts) and set(per_attempt) == set(attempts)
                within_limit = all(d <= max_cancel_ms for d in per_attempt.values())
                cancel_delay = max(per_attempt.values()) if per_attempt else None
                passed = check("upstream_closed_after_client_cancel",
                               bool(cancel_wall and cancel_delay is not None
                                    and no_late_retry and no_completed_after_cancel
                                    and all_attempts_closed and within_limit),
                               f"worst_delay_ms={cancel_delay}; same-host wall clocks required")
        elif expectation == "tool":
            passed = check("native_tool_result", bool(positive_status and not error and not observation.error
                           and observation.terminal and not text and ("lab_tool", {}) in observation.tools))
        elif expectation == "reasoning":
            passed = check("native_reasoning_result", bool(positive_status and not error and not observation.error
                           and observation.terminal and not text and "".join(observation.reasoning) == expected))
        elif expectation == "safety":
            passed = check("native_safety_block", bool(positive_status and not error and not observation.error
                           and observation.safety and not text))
        verdict = "PASS" if passed else "FAIL"
    result.update({
        "verdict": verdict, "reason": reason, "expectation": expectation, "status": status,
        "elapsed_ms": round(elapsed_ms, 3),
        "ttfb_ms": round((first_byte - started) * 1000, 3) if first_byte is not None else None,
        "ttft_ms": round((first_content - started) * 1000, 3) if first_content is not None else None,
        "max_event_gap_ms": round(max(gaps), 3) if gaps else None,
        "terminal": observation.terminal, "response_ids": ids,
        "text_chars": len(text), "text_sha256": hashlib.sha256(text.encode()).hexdigest(),
        "reasoning_chars": sum(map(len, observation.reasoning)), "tool_calls": len(observation.tools),
        "safety_blocked": observation.safety, "inband_error": observation.error, "error": error,
        "usage": observation.usage, "request_bytes": len(body), "response_bytes": total_bytes,
        "checks": checks,
        "upstream": {"attempts": len(attempts), "nodes": sorted(nodes), "attempts_by_node": nodes,
                     "protocols": sorted({str(e.get("protocol")) for e in begins}), "events": receipts,
                     "cancel_delay_ms": round(cancel_delay, 3) if cancel_delay is not None else None},
        "clock_assumption": "cancellation latency requires client and mock to share the host clock",
    })
    return result
