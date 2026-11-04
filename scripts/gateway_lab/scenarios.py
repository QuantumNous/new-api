#!/usr/bin/env python3
"""Bounded, deterministic scenario definitions shared by the lab's two ends."""

from __future__ import annotations

import json
import math
import re
from dataclasses import asdict, dataclass, fields
from pathlib import Path

PROTOCOLS = ("chat", "responses", "claude", "gemini")
VALID_MODES = frozenset({
    "ok", "empty_body", "empty_content", "role_only", "usage_only",
    "malformed_json", "malformed_sse", "truncated_stream", "fragmented_sse",
    "http_401", "http_429", "http_500", "http_503", "retry_503",
    "bare_done", "bare_done_hold", "tool_only", "reasoning_only", "safety_block",
})
VALID_EXPECTS = frozenset({
    "complete", "cancel", "recovered", "rejected", "observed", "bare_done",
    "tool", "reasoning", "safety",
})
NAME_RE = re.compile(r"[a-z][a-z0-9_]{0,63}\Z")
MARKER_RE = re.compile(
    r"\[gateway-lab:(?P<run_id>[0-9a-f]{32}):(?P<case>[a-z][a-z0-9_]{0,63}):(?P<request_id>[0-9a-f]{32})\]"
)


@dataclass(frozen=True)
class Scenario:
    """One synthetic exchange; times are seconds and context is padding characters."""

    name: str
    mode: str = "ok"
    stream: bool = False
    protocols: tuple[str, ...] = PROTOCOLS
    delay_s: float = 0.0
    first_chunk_delay_s: float = 0.0
    gap_s: float = 0.02
    chunks: int = 3
    context_chars: int = 64
    timeout_s: float = 6.0
    cancel_after_s: float = 0.0
    read_delay_s: float = 0.0
    fragment_bytes: int = 0
    hold_s: float = 0.0
    expect: str = "complete"

    def __post_init__(self) -> None:
        if not isinstance(self.name, str) or not NAME_RE.fullmatch(self.name):
            raise ValueError("scenario name must match [a-z][a-z0-9_]{0,63}")
        if not isinstance(self.mode, str) or self.mode not in VALID_MODES:
            raise ValueError(f"{self.name}: unknown mode")
        if not isinstance(self.expect, str) or self.expect not in VALID_EXPECTS:
            raise ValueError(f"{self.name}: unknown expectation")
        if not isinstance(self.stream, bool):
            raise TypeError(f"{self.name}: stream must be boolean")
        if (not isinstance(self.protocols, tuple) or not self.protocols
                or any(not isinstance(p, str) or p not in PROTOCOLS for p in self.protocols)
                or len(set(self.protocols)) != len(self.protocols)):
            raise ValueError(f"{self.name}: protocols must contain distinct supported names")
        integer_bounds = {"chunks": (1, 256), "context_chars": (0, 2 * 1024 * 1024),
                          "fragment_bytes": (0, 65536)}
        for name, (minimum, maximum) in integer_bounds.items():
            value = getattr(self, name)
            if type(value) is not int or not minimum <= value <= maximum:
                raise ValueError(f"{self.name}: {name} must be an integer in {minimum}..{maximum}")
        time_bounds = {"delay_s": (0, 600), "first_chunk_delay_s": (0, 600), "gap_s": (0, 10), "timeout_s": (0.01, 900),
                       "cancel_after_s": (0, 600), "read_delay_s": (0, 10), "hold_s": (0, 600)}
        for name, (minimum, maximum) in time_bounds.items():
            value = getattr(self, name)
            if (type(value) not in (int, float) or not math.isfinite(value)
                    or not minimum <= value <= maximum):
                raise ValueError(f"{self.name}: {name} must be finite in {minimum}..{maximum}")
        if self.expect == "cancel" and not 0 < self.cancel_after_s < self.timeout_s:
            raise ValueError(f"{self.name}: cancellation must precede the request timeout")
        stream_modes = {"malformed_sse", "truncated_stream", "fragmented_sse", "bare_done", "bare_done_hold"}
        if self.mode in stream_modes and not self.stream:
            raise ValueError(f"{self.name}: mode requires streaming")
        nonstream_modes = {"empty_body", "empty_content", "malformed_json", "tool_only", "reasoning_only", "safety_block"}
        if self.mode in nonstream_modes and self.stream:
            raise ValueError(f"{self.name}: mode requires nonstream requests")
        if self.mode in {"role_only", "usage_only"} and not self.stream:
            raise ValueError(f"{self.name}: mode requires streaming")
        chat_modes = {"role_only", "usage_only", "reasoning_only", "bare_done", "bare_done_hold"}
        if self.mode in chat_modes and self.protocols != ("chat",):
            raise ValueError(f"{self.name}: mode supports chat only")
        if self.mode == "safety_block" and self.protocols != ("gemini",):
            raise ValueError(f"{self.name}: safety_block supports gemini only")


def marker(run_id: str, case_name: str, request_id: str) -> str:
    """Embed a correlation marker that survives gateway model/header remapping."""
    value = f"[gateway-lab:{run_id}:{case_name}:{request_id}]"
    if not MARKER_RE.fullmatch(value):
        raise ValueError("invalid lab marker identifiers")
    return value


def response_text(request_id: str, chunks: int) -> str:
    """Return the exact expected text, including multi-byte UTF-8 content."""
    return f"gateway-lab:{request_id}:你好🌱\n" * chunks


BUILTINS: dict[str, Scenario] = {
    s.name: s for s in (
        Scenario("nonstream"),
        Scenario("stream", stream=True),
        Scenario("long_context", context_chars=131072),
        Scenario("long_context_stream", stream=True, context_chars=262144),
        Scenario("delayed_headers", delay_s=0.5),
        Scenario("delayed_first_chunk", stream=True, first_chunk_delay_s=0.5),
        Scenario("long_stream", stream=True, chunks=64, gap_s=0.05, timeout_s=8),
        Scenario("idle_stream", stream=True, chunks=3, gap_s=2, timeout_s=8, expect="observed"),
        Scenario("slow_reader", stream=True, chunks=32, read_delay_s=0.1, expect="observed"),
        Scenario("cancel_before_headers", delay_s=3, cancel_after_s=0.2, timeout_s=5, expect="cancel"),
        Scenario("cancel_midstream", stream=True, chunks=64, gap_s=0.2, cancel_after_s=0.3, expect="cancel"),
        Scenario("empty_body", mode="empty_body", expect="observed"),
        Scenario("empty_content", mode="empty_content", expect="observed"),
        Scenario("role_only", mode="role_only", stream=True, protocols=("chat",), expect="observed"),
        Scenario("usage_only", mode="usage_only", stream=True, protocols=("chat",), expect="observed"),
        Scenario("malformed_json", mode="malformed_json", expect="observed"),
        Scenario("malformed_sse", mode="malformed_sse", stream=True, expect="observed"),
        Scenario("truncated_stream", mode="truncated_stream", stream=True, expect="observed"),
        Scenario("fragmented_sse", mode="fragmented_sse", stream=True, fragment_bytes=1),
        Scenario("http_401", mode="http_401", expect="rejected"),
        Scenario("http_429", mode="http_429", expect="rejected"),
        Scenario("http_500", mode="http_500", expect="rejected"),
        Scenario("http_503", mode="http_503", expect="rejected"),
        Scenario("retry_503", mode="retry_503", expect="recovered"),
        Scenario("bare_done_hold", mode="bare_done_hold", stream=True, protocols=("chat",),
                 hold_s=3, expect="bare_done"),
        Scenario("tool_only", mode="tool_only", expect="tool"),
        Scenario("reasoning_only", mode="reasoning_only", protocols=("chat",), expect="reasoning"),
        Scenario("safety_block", mode="safety_block", protocols=("gemini",), expect="safety"),
    )
}


def load_scenarios(path: str | None) -> dict[str, Scenario]:
    """Merge explicit JSON overrides; missing or invalid files are configuration errors."""
    result = dict(BUILTINS)
    if path is None:
        return result
    source = Path(path)
    if source.stat().st_size > 1024 * 1024:
        raise ValueError("scenario file exceeds 1 MiB")
    entries = json.loads(source.read_text(encoding="utf-8"))
    if not isinstance(entries, list) or len(entries) > 128:
        raise ValueError("scenarios must be a JSON array of at most 128 entries")
    allowed = {f.name for f in fields(Scenario)}
    seen: set[str] = set()
    for entry in entries:
        if not isinstance(entry, dict) or not isinstance(entry.get("name"), str):
            raise TypeError("each scenario must be an object with a name")
        name = entry["name"]
        if name in seen:
            raise ValueError(f"duplicate scenario: {name}")
        if set(entry) - allowed:
            raise ValueError(f"{name}: unknown scenario fields")
        seen.add(name)
        values = asdict(result[name]) if name in result else {}
        values.update(entry)
        if "protocols" in values:
            if not isinstance(values["protocols"], (list, tuple)):
                raise TypeError(f"{name}: protocols must be an array")
            values["protocols"] = tuple(values["protocols"])
        result[name] = Scenario(**values)
    return result
