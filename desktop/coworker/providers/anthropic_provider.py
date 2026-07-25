"""Anthropic provider — native Claude Messages API.

The runtime's canonical message format is OpenAI-shaped (that is what the engine builds and
persists), so this module is mostly a pair of pure converters: OpenAI-style messages → Anthropic
`messages` + `system`, and OpenAI function schemas → Anthropic `tools`. The Messages API differs
from chat.completions in ways the converters must absorb:

- `system` is a top-level param, not a message role.
- Assistant tool calls are `tool_use` content blocks (input is a dict, not a JSON string).
- Tool results are `tool_result` blocks that must ALL land in the single next user message —
  N consecutive `role:"tool"` messages collapse into one user message here.
- `max_tokens` is required.
- Extended thinking (opt-in via the provider profile's `thinking_budget` field): responses
  carry `thinking`/`redacted_thinking` blocks that MUST be replayed verbatim (signatures
  and all) ahead of the same turn's tool_use blocks when returning tool results — they ride
  the canonical assistant message as the `_anthropic` sidecar and are reattached here. The
  thinking text also lands on `AssistantTurn.reasoning` for display.
"""

from __future__ import annotations

import json
import re
from typing import Any, Optional

from .base import (
    AssistantTurn,
    ModelCapabilities,
    ProviderClient,
    StreamChunk,
    ToolCall,
)
from .capabilities import capabilities_for

# Required by the Messages API; a ceiling, not a spend target.
DEFAULT_MAX_TOKENS = 16000

# Extended thinking is ON by default (owner call 2026-07-23: no user-facing setting —
# most users wouldn't know what a budget is; a per-turn composer control is future work).
# The provider profile's `thinking_budget` remains a hidden override: a number replaces
# the default, 0 disables thinking (where the model allows disabling).
DEFAULT_THINKING_BUDGET = 8192

# API drift (2026): thinking config is MODEL-FAMILY specific.
# - Pre-4.6 models (Haiku 4.5, Sonnet 4.5, Opus 4.5 and older): thinking needs
#   {"type": "enabled", "budget_tokens": N}.
# - 4.6+ and the Claude 5 family (Fable/Mythos 5, Opus 4.8/4.7, Sonnet 5, the 4.6 pair):
#   budget_tokens is deprecated/REMOVED (hard 400 on 4.7+: '"thinking.type.enabled" is
#   not supported for this model') — use {"type": "adaptive"}. Fable 5 thinking is
#   always on and can't be disabled. `display: "summarized"` is required to get trace
#   text on 4.7+ (default "omitted" streams thinking blocks with EMPTY text).
_BUDGET_THINKING_PREFIXES = (
    "claude-haiku-4-5",
    "claude-sonnet-4-5",
    "claude-opus-4-5",
    "claude-opus-4-1",
    "claude-opus-4-0",
    "claude-sonnet-4-0",
    "claude-3",
    "claude-2",
)


def _uses_budget_thinking(model: str) -> bool:
    return model.startswith(_BUDGET_THINKING_PREFIXES)


# Fable/Mythos 5 run safety classifiers that can decline benign-adjacent requests
# (HTTP 200, stop_reason "refusal", empty or partial content). Recommended posture is
# the server-side fallback: the API re-serves the declined request on Opus 4.8 within
# the same call. Beta header + param, beta messages endpoint.
_FALLBACK_BETA = "server-side-fallback-2026-06-01"
_FALLBACK_MODEL = "claude-opus-4-8"


def _needs_refusal_fallback(model: str) -> bool:
    return model.startswith(("claude-fable", "claude-mythos"))


def _raise_on_refusal(stop_reason: Any, raw: Any) -> None:
    """A refusal that survived the fallback chain becomes a normal provider error —
    the engine persists it as an error notice with Retry, instead of a silent blank."""
    if stop_reason != "refusal":
        return
    details = getattr(raw, "stop_details", None)
    category = getattr(details, "category", None)
    suffix = f" (category: {category})" if category else ""
    raise RuntimeError(
        "Claude's safety filter declined this request"
        + suffix
        + " — try rephrasing, or switch model and press Retry."
    )

# Anthropic stop_reason → the engine's OpenAI-shaped finish_reason vocabulary.
_STOP_REASON_MAP = {
    "end_turn": "stop",
    "tool_use": "tool_calls",
    "max_tokens": "length",
    "stop_sequence": "stop",
    "refusal": "stop",
    "pause_turn": "stop",
}

# Settings the Messages API accepts; everything else (frequency_penalty, …) is dropped.
_SETTINGS_WHITELIST = {
    "max_tokens",
    "temperature",
    "top_p",
    "top_k",
    "stop_sequences",
    "metadata",
    "thinking",
}

# Sampling knobs the API rejects alongside extended thinking (temperature must stay 1).
_THINKING_INCOMPATIBLE = ("temperature", "top_p", "top_k")

_DATA_URL_RE = re.compile(
    r"^data:(image/[a-z0-9.+-]+);base64,(.+)$", re.IGNORECASE | re.DOTALL
)

_PDF_DATA_URL_RE = re.compile(
    r"^data:application/pdf;base64,(.+)$", re.IGNORECASE | re.DOTALL
)


def resolve_api_key(secrets: Any = None) -> Optional[str]:
    """Resolve the Anthropic API key: env `ANTHROPIC_API_KEY` first, else the SecretStore
    `provider:anthropic` profile (`{api_key}`). Same contract as the OpenAI resolver: the
    Tauri-launched sidecar does not inherit the shell env, so Settings-entered keys must work.
    """
    import os

    key = os.environ.get("ANTHROPIC_API_KEY")
    if key:
        return key
    if secrets is not None:
        profile = secrets.get("provider:anthropic") or {}
        return profile.get("api_key") or None
    return None


def _parse_args(raw: Any) -> dict[str, Any]:
    """Tool-call arguments: dict passthrough, JSON string parse, `{"_raw": …}` fallback."""
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {"_raw": raw}
    except (TypeError, json.JSONDecodeError):
        return {"_raw": raw}


def _image_block(url: str) -> Optional[dict[str, Any]]:
    """An OpenAI `image_url` part → an Anthropic image block. Attachments are always data URLs
    (attachments.py); plain http(s) URLs map to a url source. Anything else → None."""
    match = _DATA_URL_RE.match(url or "")
    if match:
        return {
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": match.group(1).lower(),
                "data": match.group(2),
            },
        }
    if (url or "").startswith(("http://", "https://")):
        return {"type": "image", "source": {"type": "url", "url": url}}
    return None


def _document_block(part: dict[str, Any]) -> Optional[dict[str, Any]]:
    """An OpenAI `file` part (PDF data URL, attachments.py) → an Anthropic document block."""
    file = part.get("file") or {}
    match = _PDF_DATA_URL_RE.match(file.get("file_data") or "")
    if not match:
        return None
    block: dict[str, Any] = {
        "type": "document",
        "source": {
            "type": "base64",
            "media_type": "application/pdf",
            "data": match.group(1),
        },
    }
    name = file.get("filename")
    if name:
        block["title"] = str(name)
    return block


def _user_blocks(content: Any) -> list[dict[str, Any]]:
    """User content (str or OpenAI parts list) → Anthropic content blocks."""
    if isinstance(content, str):
        return [{"type": "text", "text": content}] if content else []
    blocks: list[dict[str, Any]] = []
    for part in content or []:
        kind = part.get("type") if isinstance(part, dict) else None
        if kind == "text":
            text = part.get("text") or ""
            if text:
                blocks.append({"type": "text", "text": text})
        elif kind == "image_url":
            url = (part.get("image_url") or {}).get("url") or ""
            block = _image_block(url)
            blocks.append(
                block
                if block
                else {"type": "text", "text": "[unsupported image attachment]"}
            )
        elif kind == "file":
            block = _document_block(part)
            blocks.append(
                block
                if block
                else {"type": "text", "text": "[unsupported file attachment]"}
            )
    return blocks


def convert_messages(
    messages: list[dict[str, Any]],
) -> tuple[Optional[str], list[dict[str, Any]]]:
    """OpenAI-shaped history → (`system`, Anthropic `messages`).

    Leading system messages become the `system` param. Consecutive same-role outputs are folded
    into one message — this is what collapses a run of `role:"tool"` results (one per parallel
    call) into the single user message Anthropic requires, with any steering user text after.
    """
    system_parts: list[str] = []
    index = 0
    while index < len(messages) and messages[index].get("role") == "system":
        content = messages[index].get("content")
        if isinstance(content, str) and content:
            system_parts.append(content)
        index += 1

    converted: list[dict[str, Any]] = []
    for message in messages[index:]:
        role = message.get("role")
        if role == "system":
            # Defensive: a stray mid-thread system message rides as marked user text.
            text = message.get("content") or ""
            if text:
                converted.append(
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": f"<system>\n{text}\n</system>"}
                        ],
                    }
                )
        elif role == "user":
            blocks = _user_blocks(message.get("content"))
            if blocks:
                converted.append({"role": "user", "content": blocks})
        elif role == "assistant":
            blocks = []
            # Replay thinking/redacted_thinking blocks VERBATIM, ahead of the turn's own
            # blocks — required whenever the turn's tool calls are being answered.
            blocks.extend((message.get("_anthropic") or {}).get("blocks") or [])
            text = message.get("content")
            if isinstance(text, str) and text:
                blocks.append({"type": "text", "text": text})
            for call in message.get("tool_calls") or []:
                function = call.get("function") or {}
                blocks.append(
                    {
                        "type": "tool_use",
                        "id": call.get("id") or "",
                        "name": function.get("name") or "",
                        "input": _parse_args(function.get("arguments")),
                    }
                )
            if blocks:
                converted.append({"role": "assistant", "content": blocks})
        elif role == "tool":
            converted.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": message.get("tool_call_id") or "",
                            "content": str(message.get("content") or ""),
                        }
                    ],
                }
            )

    folded: list[dict[str, Any]] = []
    for message in converted:
        if folded and folded[-1]["role"] == message["role"]:
            folded[-1]["content"].extend(message["content"])
        else:
            folded.append(message)

    if not folded:
        raise ValueError("no convertible messages for the Anthropic Messages API")
    if folded[0]["role"] != "user":
        folded.insert(
            0, {"role": "user", "content": [{"type": "text", "text": "(continued)"}]}
        )

    return ("\n\n".join(system_parts) or None), folded


def convert_tools(tools: Optional[list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """OpenAI function schemas → Anthropic tool definitions. Missing description is omitted;
    missing/typeless parameters become an empty object schema (Anthropic requires one).
    """
    converted = []
    for tool in tools or []:
        function = tool.get("function") or {}
        entry: dict[str, Any] = {"name": function.get("name") or ""}
        if function.get("description"):
            entry["description"] = function["description"]
        parameters = function.get("parameters")
        if not isinstance(parameters, dict) or not parameters.get("type"):
            parameters = {"type": "object", "properties": {}}
        entry["input_schema"] = parameters
        converted.append(entry)
    return converted


def _reasoning_text(thinking_blocks: list[dict[str, Any]]) -> Optional[str]:
    """Display text for the GUI's disclosure — thinking text only (redacted stays opaque)."""
    text = "".join(
        b.get("thinking", "") for b in thinking_blocks if b.get("type") == "thinking"
    )
    return text or None


def _thinking_extras(thinking_blocks: list[dict[str, Any]]) -> dict[str, Any]:
    """Raw blocks → the `_anthropic` sidecar convert_messages replays (empty when none)."""
    return {"_anthropic": {"blocks": thinking_blocks}} if thinking_blocks else {}


class AnthropicProvider(ProviderClient):
    def __init__(
        self,
        client: Any = None,
        *,
        default_model: str = "claude-sonnet-4-6",
        api_key: Optional[str] = None,
        secrets: Any = None,
        thinking_budget: Optional[int] = None,
    ):
        # Mirrors OpenAIProvider: the SDK client is built lazily so engines can be assembled
        # before any key exists; the key resolves at call time (explicit → env → SecretStore).
        # Tests inject a `client` directly. `thinking_budget` (tokens, from the provider
        # profile's optional field) opts every request into extended thinking.
        self._client = client
        self._api_key = api_key
        self._secrets = secrets
        self.default_model = default_model
        self.thinking_budget = thinking_budget or 0

    def _ensure_client(self) -> Any:
        if self._client is None:
            # Lazy import so the SDK is only required when actually talking to Anthropic.
            from anthropic import Anthropic

            key = self._api_key or resolve_api_key(self._secrets)
            if not key:
                raise RuntimeError(
                    "No Anthropic API key configured. Set ANTHROPIC_API_KEY in the environment, "
                    "or add your key in Manage → Configure Models."
                )
            self._client = Anthropic(api_key=key)
        return self._client

    def _request_kwargs(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]],
        settings: dict[str, Any],
    ) -> dict[str, Any]:
        system, converted = convert_messages(messages)
        if "stop" in settings and "stop_sequences" not in settings:
            stop = settings["stop"]
            settings["stop_sequences"] = [stop] if isinstance(stop, str) else list(stop)
        filtered = {k: v for k, v in settings.items() if k in _SETTINGS_WHITELIST}
        if self.thinking_budget > 0 and "thinking" not in filtered:
            if _uses_budget_thinking(model):
                filtered["thinking"] = {
                    "type": "enabled",
                    "budget_tokens": self.thinking_budget,
                }
            else:
                # 4.6+/Claude 5 family: adaptive only (budget_tokens 400s on 4.7+);
                # display opt-in or the trace text arrives empty.
                filtered["thinking"] = {"type": "adaptive", "display": "summarized"}
        thinking = filtered.get("thinking") or {}
        if thinking.get("type") == "enabled":
            # Budget must fit under max_tokens.
            budget = int(thinking.get("budget_tokens") or 0)
            floor = max(DEFAULT_MAX_TOKENS, budget + 4096)
            if int(filtered.get("max_tokens") or 0) <= budget:
                filtered["max_tokens"] = floor
        if thinking.get("type") in ("enabled", "adaptive"):
            # Sampling knobs are rejected alongside thinking (and removed outright on 4.7+).
            for key in _THINKING_INCOMPATIBLE:
                filtered.pop(key, None)
        filtered.setdefault("max_tokens", DEFAULT_MAX_TOKENS)
        kwargs: dict[str, Any] = {"model": model, "messages": converted, **filtered}
        if system:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = convert_tools(tools)
        return kwargs

    def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **settings: Any,
    ) -> AssistantTurn:
        kwargs = self._request_kwargs(
            model=model, messages=messages, tools=tools, settings=settings
        )
        client = self._ensure_client()
        if _needs_refusal_fallback(model):
            response = client.beta.messages.create(
                **kwargs,
                betas=[_FALLBACK_BETA],
                fallbacks=[{"model": _FALLBACK_MODEL}],
            )
        else:
            response = client.messages.create(**kwargs)

        text_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        thinking_blocks: list[dict[str, Any]] = []
        for block in getattr(response, "content", None) or []:
            kind = getattr(block, "type", None)
            if kind == "text":
                text_parts.append(getattr(block, "text", "") or "")
            elif kind == "tool_use":
                tool_calls.append(
                    ToolCall(
                        id=getattr(block, "id", "") or "",
                        name=getattr(block, "name", "") or "",
                        arguments=dict(getattr(block, "input", None) or {}),
                    )
                )
            elif kind == "thinking":
                thinking_blocks.append(
                    {
                        "type": "thinking",
                        "thinking": getattr(block, "thinking", "") or "",
                        "signature": getattr(block, "signature", "") or "",
                    }
                )
            elif kind == "redacted_thinking":
                thinking_blocks.append(
                    {
                        "type": "redacted_thinking",
                        "data": getattr(block, "data", "") or "",
                    }
                )
        stop_reason = getattr(response, "stop_reason", None)
        _raise_on_refusal(stop_reason, response)
        return AssistantTurn(
            text="".join(text_parts) or None,
            tool_calls=tool_calls,
            finish_reason=_STOP_REASON_MAP.get(stop_reason, stop_reason),
            raw=response,
            reasoning=_reasoning_text(thinking_blocks),
            extras=_thinking_extras(thinking_blocks),
        )

    def capabilities(self, model: str) -> ModelCapabilities:
        return capabilities_for(model)

    def stream(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **settings: Any,
    ):
        kwargs = self._request_kwargs(
            model=model, messages=messages, tools=tools, settings=settings
        )
        kwargs["stream"] = True
        client = self._ensure_client()
        if _needs_refusal_fallback(model):
            events = client.beta.messages.create(
                **kwargs,
                betas=[_FALLBACK_BETA],
                fallbacks=[{"model": _FALLBACK_MODEL}],
            )
        else:
            events = client.messages.create(**kwargs)

        text_parts: list[str] = []
        tool_accum: dict[int, dict[str, str]] = {}
        # Thinking blocks accumulate per stream index and must be replayed verbatim later,
        # so both the text and the signature_delta tail are collected (in block order).
        thinking_accum: dict[int, dict[str, Any]] = {}
        stop_reason = None

        last_message_delta: Any = None
        for event in events:
            kind = getattr(event, "type", None)
            if kind == "content_block_start":
                block = getattr(event, "content_block", None)
                block_kind = getattr(block, "type", None)
                if block_kind == "tool_use":
                    tool_accum[getattr(event, "index", 0)] = {
                        "id": getattr(block, "id", "") or "",
                        "name": getattr(block, "name", "") or "",
                        "json": "",
                    }
                elif block_kind == "thinking":
                    thinking_accum[getattr(event, "index", 0)] = {
                        "type": "thinking",
                        "thinking": getattr(block, "thinking", "") or "",
                        "signature": getattr(block, "signature", "") or "",
                    }
                elif block_kind == "redacted_thinking":
                    # Arrives whole — opaque data, no deltas.
                    thinking_accum[getattr(event, "index", 0)] = {
                        "type": "redacted_thinking",
                        "data": getattr(block, "data", "") or "",
                    }
            elif kind == "content_block_delta":
                delta = getattr(event, "delta", None)
                delta_kind = getattr(delta, "type", None)
                if delta_kind == "text_delta":
                    text = getattr(delta, "text", "") or ""
                    if text:
                        text_parts.append(text)
                        yield StreamChunk(text_delta=text)
                elif delta_kind == "input_json_delta":
                    acc = tool_accum.get(getattr(event, "index", 0))
                    if acc is not None:
                        acc["json"] += getattr(delta, "partial_json", "") or ""
                elif delta_kind == "thinking_delta":
                    acc = thinking_accum.get(getattr(event, "index", 0))
                    thought = getattr(delta, "thinking", "") or ""
                    if acc is not None and thought:
                        acc["thinking"] += thought
                        yield StreamChunk(reasoning_delta=thought)
                elif delta_kind == "signature_delta":
                    acc = thinking_accum.get(getattr(event, "index", 0))
                    if acc is not None:
                        acc["signature"] = (acc.get("signature") or "") + (
                            getattr(delta, "signature", "") or ""
                        )
            elif kind == "message_delta":
                last_message_delta = getattr(event, "delta", None)
                reason = getattr(last_message_delta, "stop_reason", None)
                if reason:
                    stop_reason = reason

        _raise_on_refusal(stop_reason, last_message_delta)
        tool_calls = []
        for index in sorted(tool_accum):
            acc = tool_accum[index]
            tool_calls.append(
                ToolCall(
                    id=acc["id"], name=acc["name"], arguments=_parse_args(acc["json"])
                )
            )
        thinking_blocks = [thinking_accum[i] for i in sorted(thinking_accum)]

        yield StreamChunk(
            turn=AssistantTurn(
                text="".join(text_parts) or None,
                tool_calls=tool_calls,
                finish_reason=_STOP_REASON_MAP.get(stop_reason, stop_reason),
                reasoning=_reasoning_text(thinking_blocks),
                extras=_thinking_extras(thinking_blocks),
            )
        )
