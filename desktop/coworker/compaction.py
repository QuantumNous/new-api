"""Auto-compaction of long session histories (OPE-27).

When the outbound history approaches the model's context limit, the older portion of the
*outbound* view is replaced with (a) an LLM-written structured summary and (b) mechanically
extracted state — the recent turns and all user messages survive. The persisted transcript
is never modified; only what is sent to the model. Full design: ocw-context
docs/auto-compaction-spec.md (approved 2026-07-28).

This module is pure functions + one dataclass; the engine owns *when* (its run loop) and
*with what* (its provider/model), both injected here. That split keeps the engine.py
footprint to a few lines and makes every policy testable without a provider.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Optional

# Trigger: min(threshold_pct × context_window, cap_tokens). The cap exists so 1M-context
# models compact early — quality and latency degrade well before the nominal limit.
DEFAULT_THRESHOLD_PCT = 0.8
DEFAULT_CAP_TOKENS = 250_000
# Models without a verified context_window entry in the matrix.
DEFAULT_CONTEXT_WINDOW = 128_000
# The newest slice kept verbatim, as a fraction of the trigger (a token budget, not a
# turn count — one huge tool loop shouldn't starve the working set).
KEEP_RECENT_FRACTION = 0.25
# The summarizer call itself: tools off, modest ceiling.
SUMMARY_MAX_TOKENS = 3_000
# Per-message clip when rendering the span for the summarizer; tool results are the
# first casualty (huge and mostly stale — a file read 40 turns ago is better re-read).
_SPAN_TOOL_RESULT_CLIP = 400
_SPAN_BUDGET_CHARS = 400_000
# User messages preserved mechanically in the compacted block ("trimmed of pasted bulk").
_USER_MESSAGE_CLIP = 600
_TRIM_FRACTION = 0.10


# -- token math ---------------------------------------------------------------


def estimate_tokens(messages: list[dict[str, Any]]) -> int:
    """chars/4 over the serialized messages — the fallback signal for providers that
    never report usage (documented in the metering code)."""
    total = 0
    for msg in messages:
        try:
            total += len(json.dumps(msg, default=str))
        except (TypeError, ValueError):
            total += len(str(msg))
    return total // 4


def trigger_tokens(
    context_window: Optional[int],
    *,
    threshold_pct: float = DEFAULT_THRESHOLD_PCT,
    cap_tokens: int = DEFAULT_CAP_TOKENS,
) -> int:
    window = context_window or DEFAULT_CONTEXT_WINDOW
    return min(int(threshold_pct * window), int(cap_tokens))


def should_compact(
    signal: int,
    context_window: Optional[int],
    *,
    threshold_pct: float = DEFAULT_THRESHOLD_PCT,
    cap_tokens: int = DEFAULT_CAP_TOKENS,
) -> bool:
    return signal >= trigger_tokens(
        context_window, threshold_pct=threshold_pct, cap_tokens=cap_tokens
    )


# -- state --------------------------------------------------------------------


@dataclass
class CompactionState:
    """One compaction point. `boundary_index` is an index into the CANONICAL message list:
    messages before it are represented by the compacted block in the outbound view; messages
    from it on are sent verbatim. Persisted with the session so reloads keep the view."""

    boundary_index: int
    summary_text: str
    working_state: str
    user_messages: list[str] = field(default_factory=list)
    created_at: float = 0.0
    model_used: str = ""
    trimmed: bool = False  # True when this state came from the no-summary trim fallback

    def as_dict(self) -> dict[str, Any]:
        return {
            "boundary_index": self.boundary_index,
            "summary_text": self.summary_text,
            "working_state": self.working_state,
            "user_messages": list(self.user_messages),
            "created_at": self.created_at,
            "model_used": self.model_used,
            "trimmed": self.trimmed,
        }

    @classmethod
    def from_dict(cls, raw: Any) -> Optional["CompactionState"]:
        if not isinstance(raw, dict) or "boundary_index" not in raw:
            return None
        return cls(
            boundary_index=int(raw.get("boundary_index", 0)),
            summary_text=str(raw.get("summary_text", "")),
            working_state=str(raw.get("working_state", "")),
            user_messages=[str(u) for u in raw.get("user_messages") or []],
            created_at=float(raw.get("created_at", 0.0)),
            model_used=str(raw.get("model_used", "")),
            trimmed=bool(raw.get("trimmed", False)),
        )


# -- boundary -----------------------------------------------------------------


def _turn_starts(messages: list[dict[str, Any]], *, start: int) -> tuple[list[int], list[int]]:
    """Candidate boundary indexes past `start`: user-message indexes (turn starts,
    preferred) and assistant indexes (iteration starts — legal suffix heads; a `tool`
    message must never head the outbound view)."""
    users, assistants = [], []
    for i in range(start, len(messages)):
        role = messages[i].get("role")
        if role == "user":
            users.append(i)
        elif role == "assistant":
            assistants.append(i)
    return users, assistants


def pick_boundary(messages: list[dict[str, Any]], *, keep_tokens: int) -> Optional[int]:
    """The canonical index where the verbatim tail begins: the earliest turn start whose
    suffix fits the keep budget. Prefers user-message boundaries; falls back to iteration
    (assistant) boundaries when the newest turn alone exceeds the budget (a giant tool
    loop). None when there is nothing meaningful to summarize."""
    start = 1 if messages and messages[0].get("role") == "system" else 0
    users, assistants = _turn_starts(messages, start=start)

    def _fit(candidates: list[int]) -> Optional[int]:
        for i in candidates:  # earliest-first: keep as much verbatim as fits
            if estimate_tokens(messages[i:]) <= keep_tokens:
                return i
        return None

    boundary = _fit(users)
    if boundary is None and users:
        # The newest user turn alone blows the budget — cut inside it at an iteration
        # boundary, keeping at least the most recent assistant step.
        inside = [i for i in assistants if i > users[-1]]
        boundary = _fit(inside)
        if boundary is None:
            boundary = inside[-1] if inside else users[-1]
    if boundary is None:
        boundary = _fit(assistants) or (assistants[-1] if assistants else None)
    # A boundary at (or before) the first real message summarizes nothing — skip.
    if boundary is None or boundary <= start:
        return None
    return boundary


# -- mechanical extraction (no LLM — zero hallucination risk) -----------------

_WRITE_HINTS = ("write", "edit", "append", "save", "create", "patch")
_ARTIFACT_HINTS = ("artifact", "publish", "deploy")


def _iter_tool_calls(span: list[dict[str, Any]]):
    """(name, args, result_content) for every tool call in the span, in order."""
    results = {
        m.get("tool_call_id"): m.get("content")
        for m in span
        if m.get("role") == "tool"
    }
    for msg in span:
        if msg.get("role") != "assistant":
            continue
        for tc in msg.get("tool_calls") or []:
            fn = tc.get("function") or {}
            try:
                args = json.loads(fn.get("arguments") or "{}")
            except (ValueError, TypeError):
                args = {}
            yield str(fn.get("name") or ""), args, results.get(tc.get("id"))


def _result_status(result: Any) -> str:
    if not isinstance(result, str):
        return ""
    try:
        parsed = json.loads(result)
    except (ValueError, TypeError):
        return ""
    if not isinstance(parsed, dict):
        return ""
    if parsed.get("error"):
        return "error"
    if "exit_code" in parsed:
        code = parsed.get("exit_code")
        return "ok" if code in (0, "0") else f"exit {code}"
    return ""


def extract_working_state(span: list[dict[str, Any]]) -> str:
    """The mechanical block appended to the summary by CODE, from the span's tool-call
    records: files written, recent commands (+ exit status), artifacts, tools used."""
    files: list[str] = []
    commands: list[str] = []
    artifacts: list[str] = []
    tools: list[str] = []
    for name, args, result in _iter_tool_calls(span):
        if name and name not in tools:
            tools.append(name)
        lowered = name.lower()
        path = args.get("path") or args.get("file_path")
        if path and any(h in lowered for h in _WRITE_HINTS):
            files.append(str(path))
        if lowered == "run_shell" and args.get("command"):
            status = _result_status(result)
            line = " ".join(str(args["command"]).split())[:160]
            commands.append(f"{line}" + (f"  [{status}]" if status else ""))
        if any(h in lowered for h in _ARTIFACT_HINTS):
            location = args.get("url") or args.get("path") or args.get("title")
            if location:
                artifacts.append(str(location))

    def _dedupe_recent_first(items: list[str], limit: int) -> list[str]:
        seen: list[str] = []
        for item in reversed(items):  # most recent first
            if item not in seen:
                seen.append(item)
            if len(seen) >= limit:
                break
        return seen

    lines = ["## Working state (extracted mechanically from tool records)"]
    written = _dedupe_recent_first(files, 20)
    if written:
        lines.append("Files written/edited (most recent first):")
        lines += [f"- {p}" for p in written]
    recent_cmds = commands[-10:]
    if recent_cmds:
        lines.append("Recent shell commands:")
        lines += [f"- {c}" for c in recent_cmds]
    made = _dedupe_recent_first(artifacts, 10)
    if made:
        lines.append("Artifacts produced:")
        lines += [f"- {a}" for a in made]
    if tools:
        lines.append("Tools used in the summarized span: " + ", ".join(sorted(tools)))
    return "\n".join(lines) if len(lines) > 1 else ""


def _text_of(content: Any) -> str:
    """A message's text, whether plain or content-parts (images become a placeholder)."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for p in content:
            if isinstance(p, dict) and p.get("type") == "text":
                parts.append(str(p.get("text", "")))
            elif isinstance(p, dict) and p.get("type") == "image_url":
                parts.append("[image]")
        return "\n".join(parts)
    return "" if content is None else str(content)


def extract_user_messages(
    span: list[dict[str, Any]], *, clip: int = _USER_MESSAGE_CLIP
) -> list[str]:
    """Every user message in the span, chronological, trimmed of pasted bulk. Preserved
    mechanically — the summarizer is also asked to list them, but user words are the
    ground truth of intent and must not depend on an LLM remembering to include them."""
    out: list[str] = []
    for msg in span:
        if msg.get("role") != "user":
            continue
        text = " ".join(_text_of(msg.get("content")).split())
        if not text:
            continue
        out.append(text[: clip - 1] + "…" if len(text) > clip else text)
    return out


# -- summarizer ---------------------------------------------------------------

SUMMARY_SYSTEM_PROMPT = """You are compacting an AI coworker's session history so the coworker can continue working in a smaller context. Write a structured summary of the conversation below. It is the coworker's ONLY memory of these turns, so preserve everything load-bearing.

Produce ALL of the following sections, in this order, each as a markdown heading:

1. **Primary request and intent** — what the user is trying to get done, in their terms, including standing constraints stated at any point (e.g. "never send without my approval"). Constraints outlive the turns they were stated in.
2. **Key concepts and decisions** — domain facts, technical choices, and rationale established so far. Include the WHY, not just the what — a decision without its reason gets relitigated.
3. **Artifacts and files** — every file/deliverable created, modified, or read that still matters: path, its role, and a short excerpt of load-bearing content only.
4. **Errors and fixes** — problems hit and how they were resolved, including user corrections ("no, do it this way") — those are feedback with lasting force.
5. **All user messages** — a chronological list of every user message (trimmed of pasted bulk). This is the intent audit-trail.
6. **Pending tasks** — explicitly incomplete items, promised follow-ups, things the user said "later" about.
7. **Current work** — precisely what was in progress at this point: which step, which file, what state.
8. **Next step** — the immediate next action, justified by the user's request.

Rules:
- Do NOT carry full file contents as truth. Note THAT a file was read/edited; the coworker re-reads if it needs the content again. Stale memory of a file is worse than no memory.
- Be concrete: paths, names, commands, ids — not vague references.
- Output only the summary sections, no preamble."""

CONTINUATION_CONTRACT = (
    "Continue where you left off: pick up the current work and next step exactly as "
    "described. Do not re-ask answered questions, do not recap, do not mention that the "
    "context was compacted. If you need the contents of a file noted above, re-read it."
)


def _render_span(span: list[dict[str, Any]], *, budget_chars: int = _SPAN_BUDGET_CHARS) -> str:
    """The summarized span as compact text for the summarizer. Tool results are clipped
    hard (first casualty); if the whole render still exceeds the budget, oldest lines are
    dropped — the newest context is the most load-bearing."""
    lines: list[str] = []
    for msg in span:
        role = msg.get("role")
        if role == "system":
            continue
        if role == "notice":
            continue
        if role == "tool":
            text = _text_of(msg.get("content"))
            text = " ".join(text.split())
            if len(text) > _SPAN_TOOL_RESULT_CLIP:
                text = text[: _SPAN_TOOL_RESULT_CLIP - 1] + "…"
            lines.append(f"[tool result] {text}")
            continue
        text = _text_of(msg.get("content"))
        if role == "assistant":
            for tc in msg.get("tool_calls") or []:
                fn = tc.get("function") or {}
                args = " ".join(str(fn.get("arguments", "")).split())
                if len(args) > 200:
                    args = args[:199] + "…"
                lines.append(f"[assistant → {fn.get('name')}] {args}")
            if text:
                lines.append(f"[assistant] {text}")
        elif role == "user":
            lines.append(f"[user] {text}")
    rendered = "\n".join(lines)
    if len(rendered) > budget_chars:
        rendered = "(…oldest turns elided…)\n" + rendered[-budget_chars:]
    return rendered


def summarizer_messages(
    span: list[dict[str, Any]], *, prior_summary: str = ""
) -> list[dict[str, Any]]:
    """The provider-ready messages for the summarizer call. On repeated compaction the
    previous summary is message zero of the new span — summarized along with the turns
    since."""
    body = _render_span(span)
    if prior_summary:
        body = (
            "[previous compaction summary — fold its still-relevant content into the new "
            "summary]\n" + prior_summary + "\n\n[conversation since]\n" + body
        )
    return [
        {"role": "system", "content": SUMMARY_SYSTEM_PROMPT},
        {"role": "user", "content": body},
    ]


def summarize_span(
    provider: Any,
    model: str,
    span: list[dict[str, Any]],
    *,
    prior_summary: str = "",
    max_tokens: int = SUMMARY_MAX_TOKENS,
) -> str:
    """One summarizer round-trip (blocking — the engine runs it off-loop). Tools are
    disabled; the Settings model override is just a different `model` id. Raises on
    provider failure or an empty summary — the caller owns the retry/trim policy."""
    turn = provider.complete(
        model=model,
        messages=summarizer_messages(span, prior_summary=prior_summary),
        tools=None,
        max_tokens=max_tokens,
    )
    text = (getattr(turn, "text", None) or "").strip()
    if not text:
        raise RuntimeError("summarizer returned an empty summary")
    return text


# -- building + applying a compaction -----------------------------------------


def build_state(
    messages: list[dict[str, Any]],
    *,
    provider: Any,
    model: str,
    keep_tokens: int,
    prior: Optional[CompactionState] = None,
) -> Optional[CompactionState]:
    """Summarize everything older than the picked boundary into a new CompactionState.
    On repeated compaction the prior summary heads the new span. Returns None when there
    is nothing to compact; raises when the summarizer fails (caller applies policy)."""
    boundary = pick_boundary(messages, keep_tokens=keep_tokens)
    if boundary is None or (prior is not None and boundary <= prior.boundary_index):
        return None
    span_start = prior.boundary_index if prior is not None else 0
    span = messages[span_start:boundary]
    prior_users = list(prior.user_messages) if prior is not None else []
    summary = summarize_span(
        provider,
        model,
        span,
        prior_summary=prior.summary_text if prior is not None else "",
    )
    return CompactionState(
        boundary_index=boundary,
        summary_text=summary,
        working_state=extract_working_state(span),
        user_messages=prior_users + extract_user_messages(span),
        created_at=time.time(),
        model_used=model,
    )


def trim_state(
    messages: list[dict[str, Any]],
    *,
    prior: Optional[CompactionState] = None,
    fraction: float = _TRIM_FRACTION,
) -> Optional[CompactionState]:
    """The no-LLM fallback: advance the boundary past ~`fraction` of the outbound
    messages. No summary — but the mechanical block and the user-message list (never
    trimmed away, per spec) are free, so the model still gets deterministic state."""
    start = prior.boundary_index if prior is not None else 0
    remaining = len(messages) - start
    if remaining <= 2:
        return None
    step = max(1, int(remaining * fraction))
    target = start + step
    # Land on a legal suffix head at or after the target (never a tool message).
    boundary = None
    for i in range(target, len(messages)):
        if messages[i].get("role") in ("user", "assistant"):
            boundary = i
            break
    if boundary is None or boundary <= start or boundary >= len(messages):
        return None
    span = messages[start:boundary]
    prior_users = list(prior.user_messages) if prior is not None else []
    summary = (
        (prior.summary_text + "\n\n" if prior is not None and prior.summary_text else "")
        + "(Older turns were trimmed to fit the context window; no summary is available "
        "for them. Re-read files and re-run commands if earlier results are needed.)"
    )
    return CompactionState(
        boundary_index=boundary,
        summary_text=summary,
        working_state=extract_working_state(span),
        user_messages=prior_users + extract_user_messages(span),
        created_at=time.time(),
        model_used="",
        trimmed=True,
    )


def compacted_block(state: CompactionState) -> str:
    """The single outbound message standing in for everything before the boundary."""
    parts = [
        "<compacted-history>",
        "Earlier turns of this session were compacted. The summary below is your memory "
        "of them.",
        "",
        state.summary_text,
    ]
    if state.working_state:
        parts += ["", state.working_state]
    if state.user_messages:
        parts += ["", "## User messages in the compacted span (verbatim, chronological)"]
        parts += [f"- {u}" for u in state.user_messages]
    parts += ["", CONTINUATION_CONTRACT, "</compacted-history>"]
    return "\n".join(parts)


def apply_to_outbound(
    messages: list[dict[str, Any]], state: Optional[CompactionState]
) -> list[dict[str, Any]]:
    """The outbound view: [system?] + the compacted block (as a user message) + the
    verbatim tail. Canonical history is untouched; provider-private sidecars in the
    summarized span vanish with it (replay chains legally restart after a compaction
    point). No-op when state is absent or stale."""
    if state is None:
        return messages
    boundary = state.boundary_index
    if boundary <= 0 or boundary >= len(messages):
        return messages
    head: list[dict[str, Any]] = []
    if messages and messages[0].get("role") == "system":
        head.append(messages[0])
    head.append({"role": "user", "content": compacted_block(state)})
    return head + messages[boundary:]


# -- overflow detection -------------------------------------------------------

_OVERFLOW_MARKERS = (
    "context_length_exceeded",
    "maximum context length",
    "context window",
    "prompt is too long",
    "input is too long",
    "too many tokens",
    "input length and `max_tokens` exceed",
    "exceeds the maximum number of tokens",
)


def is_context_overflow(exc: BaseException) -> bool:
    """A raw context-overflow 400 from the main model (compaction mispredicted, e.g. the
    estimate path) — routed into the compaction policy instead of surfacing."""
    text = str(exc).lower()
    return any(marker in text for marker in _OVERFLOW_MARKERS)
