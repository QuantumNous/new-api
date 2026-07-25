"""OpenAI provider — the v1 model access implementation.

Uses the OpenAI Python SDK `chat.completions` API only (no Responses/Assistants), so
the later swap to aisuite (OpenAI-API-shaped) stays a near drop-in.
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


def resolve_api_key(secrets: Any = None) -> Optional[str]:
    """Resolve the OpenAI API key: env `OPENAI_API_KEY` first, else the SecretStore
    `provider:openai` profile (`{api_key}`). Lets a Tauri-launched sidecar — which does NOT
    inherit the shell env — still find a key the user entered in Settings. The value never
    enters the model context; it only configures the SDK client.
    """
    import os

    key = os.environ.get("OPENAI_API_KEY")
    if key:
        return key
    if secrets is not None:
        profile = secrets.get("provider:openai") or {}
        return profile.get("api_key") or None
    return None


# GPT-5.6 (2026-07) defaults reasoning_effort to "medium" server-side, and
# /v1/chat/completions rejects function tools combined with any effort other than
# "none" ("use /v1/responses"). Until we grow a Responses API path, pin effort to
# none whenever tools ride along on these models — and when the API rejects a call
# with that exact complaint anyway (a future generation, an alias we didn't list),
# retry once at effort none so the user gets a working turn instead of a 400.
_EFFORT_ERROR = "function tools with reasoning_effort are not supported"


def _pin_reasoning_effort(kwargs: dict[str, Any]) -> None:
    if kwargs.get("tools") and str(kwargs.get("model", "")).startswith("gpt-5.6"):
        kwargs.setdefault("reasoning_effort", "none")


def _delta_reasoning(obj: Any) -> Optional[str]:
    """Thinking text off a delta/message: `reasoning_content` (DeepSeek, GLM, Kimi, and
    most compat vendors) or `reasoning` (xAI, OpenRouter). Extra response fields survive
    the OpenAI SDK's models (extra="allow"), so plain getattr sees them."""
    value = getattr(obj, "reasoning_content", None) or getattr(obj, "reasoning", None)
    return value if isinstance(value, str) and value else None


def _strip_foreign_sidecars(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop provider-private message sidecars (underscore-prefixed keys, e.g. `_gemini`
    thought signatures — see providers/base.py): they belong to other providers, and the
    OpenAI wire (and its compat servers) rejects unknown message fields."""
    return [
        (
            {k: v for k, v in m.items() if not k.startswith("_")}
            if any(k.startswith("_") for k in m)
            else m
        )
        for m in messages
    ]


_MAX_TOKENS_ERROR = "'max_tokens' is not supported"


def _param_fix_retry(kwargs: dict[str, Any], exc: Exception) -> dict[str, Any]:
    """Kwargs for the one retry an unsupported-parameter error earns, or re-raise.

    Reasoning-routed OpenAI models reject `max_tokens` outright (they want
    `max_completion_tokens`) — but compat servers (Ollama's /v1) know ONLY
    `max_tokens`, so the swap must happen on rejection, never up front. Same
    contract as the reasoning_effort retry: fix exactly what the server named.
    """
    msg = str(exc).lower()
    if _EFFORT_ERROR in msg and kwargs.get("reasoning_effort") != "none":
        return {**kwargs, "reasoning_effort": "none"}
    if _MAX_TOKENS_ERROR in msg and "max_tokens" in kwargs:
        fixed = dict(kwargs)
        fixed["max_completion_tokens"] = fixed.pop("max_tokens")
        return fixed
    raise exc


class OpenAIProvider(ProviderClient):
    def __init__(
        self,
        client: Any = None,
        *,
        default_model: str = "gpt-5.6-sol",
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        secrets: Any = None,
    ):
        # The SDK client is built lazily on first use, NOT at construction. This lets an engine
        # be assembled before any key exists — the desktop app lets you enter the key in Settings
        # *after* launch — and the super-agent engine to be built at startup with no key. The key
        # is resolved at call time: explicit `api_key` → env `OPENAI_API_KEY` → SecretStore. Tests
        # inject a `client` directly, bypassing all of this.
        #
        # `base_url` points the same OpenAI SDK at any OpenAI-compatible endpoint — used by the
        # provider router for Ollama (`http://localhost:11434/v1`, with a placeholder key) and,
        # later, other OpenAI-shaped backends. When None, behavior is identical to stock OpenAI.
        self._client = client
        self._api_key = api_key
        self._base_url = base_url
        self._secrets = secrets
        self.default_model = default_model

    def _ensure_client(self) -> Any:
        if self._client is None:
            # Lazy import so the SDK is only required when actually talking to OpenAI.
            from openai import OpenAI

            key = self._api_key or resolve_api_key(self._secrets)
            if not key:
                raise RuntimeError(
                    "No model API key configured. Set OPENAI_API_KEY in the environment, "
                    "or add your key in Manage → Settings."
                )
            kwargs: dict[str, Any] = {"api_key": key}
            if self._base_url:
                kwargs["base_url"] = self._base_url
            self._client = OpenAI(**kwargs)
        return self._client

    def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **settings: Any,
    ) -> AssistantTurn:
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": _strip_foreign_sidecars(messages),
            **settings,
        }
        if tools:
            kwargs["tools"] = tools
        _pin_reasoning_effort(kwargs)

        client = self._ensure_client()
        # Up to two param-fix retries: effort and max_tokens can BOTH need fixing.
        for _ in range(2):
            try:
                response = client.chat.completions.create(**kwargs)
                break
            except Exception as exc:
                kwargs = _param_fix_retry(kwargs, exc)
        else:
            response = client.chat.completions.create(**kwargs)
        choice = response.choices[0]
        message = choice.message
        text = getattr(message, "content", None)
        tool_calls = _parse_tool_calls(getattr(message, "tool_calls", None))
        text, tool_calls = _maybe_salvage_tool_calls(text, tool_calls, tools=tools)
        return AssistantTurn(
            text=text,
            tool_calls=tool_calls,
            finish_reason=getattr(choice, "finish_reason", None),
            raw=response,
            reasoning=_delta_reasoning(message),
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
        kwargs: dict[str, Any] = {
            "model": model,
            "messages": _strip_foreign_sidecars(messages),
            "stream": True,
            **settings,
        }
        if tools:
            kwargs["tools"] = tools
        _pin_reasoning_effort(kwargs)
        client = self._ensure_client()

        text_parts: list[str] = []
        reasoning_parts: list[str] = []
        tool_accum: dict[int, dict[str, str]] = {}
        finish_reason = None

        # Up to two param-fix retries: effort and max_tokens can BOTH need fixing.
        for _ in range(2):
            try:
                chunks = client.chat.completions.create(**kwargs)
                break
            except Exception as exc:
                kwargs = _param_fix_retry(kwargs, exc)
        else:
            chunks = client.chat.completions.create(**kwargs)
        for chunk in chunks:
            choices = getattr(chunk, "choices", None)
            if not choices:
                continue
            choice = choices[0]
            delta = getattr(choice, "delta", None)
            if delta is not None:
                reasoning = _delta_reasoning(delta)
                if reasoning:
                    reasoning_parts.append(reasoning)
                    yield StreamChunk(reasoning_delta=reasoning)
                content = getattr(delta, "content", None)
                if content:
                    text_parts.append(content)
                    yield StreamChunk(text_delta=content)
                for tc in getattr(delta, "tool_calls", None) or []:
                    acc = tool_accum.setdefault(
                        getattr(tc, "index", 0), {"id": "", "name": "", "args": ""}
                    )
                    if getattr(tc, "id", None):
                        acc["id"] = tc.id
                    fn = getattr(tc, "function", None)
                    if fn is not None:
                        if getattr(fn, "name", None):
                            acc["name"] = fn.name
                        if getattr(fn, "arguments", None):
                            acc["args"] += fn.arguments
            if getattr(choice, "finish_reason", None):
                finish_reason = choice.finish_reason

        tool_calls = []
        for index in sorted(tool_accum):
            acc = tool_accum[index]
            try:
                arguments = json.loads(acc["args"]) if acc["args"] else {}
            except (TypeError, json.JSONDecodeError):
                arguments = {"_raw": acc["args"]}
            tool_calls.append(
                ToolCall(id=acc["id"], name=acc["name"], arguments=arguments)
            )

        text, tool_calls = _maybe_salvage_tool_calls(
            "".join(text_parts) or None, tool_calls, tools=tools
        )
        yield StreamChunk(
            turn=AssistantTurn(
                text=text,
                tool_calls=tool_calls,
                finish_reason=finish_reason,
                reasoning="".join(reasoning_parts) or None,
            )
        )


def _parse_tool_calls(raw_tool_calls: Any) -> list[ToolCall]:
    calls: list[ToolCall] = []
    for tc in raw_tool_calls or []:
        function = tc.function
        raw_args = getattr(function, "arguments", None)
        try:
            arguments = json.loads(raw_args) if raw_args else {}
        except (TypeError, json.JSONDecodeError):
            # Surface unparseable arguments rather than dropping the call; the engine
            # can return a tool-error so the model corrects itself.
            arguments = {"_raw": raw_args}
        calls.append(
            ToolCall(id=getattr(tc, "id", ""), name=function.name, arguments=arguments)
        )
    return calls


# Some OpenAI-compatible backends — notably Ollama for several local models (qwen, etc.) —
# fail to populate the structured `tool_calls` field and instead emit the call as TEXT, in
# wildly varied shapes: a `<tool_call>{…}</tool_call>` block, a bare `{"name","arguments"}` object
# (often mixed in with prose), or a `toolname {args}` / `toolname [args]` shorthand. Our agent
# loop needs structured calls, so we recover them — using the requested tool SCHEMAS to recognize
# tool-name forms and to filter out anything whose name isn't a real tool (no false positives).
# Gated on: tools were requested AND no structured calls came back. Never fires for OpenAI.
_TOOLCALL_OPEN = re.compile(r"<tool_call>\s*", re.IGNORECASE)

# Qwen/Hermes native tool-call template — NOT JSON. The model writes the call as nested XML:
#   <function=write_file><parameter=path>hello.txt</parameter><parameter=content>hi</parameter></function>
# (usually wrapped in <tool_call>…</tool_call>). qwen3-coder emits exactly this, so we parse the
# function/parameter tags directly. Values are taken verbatim (stripped); only no-whitespace JSON
# tokens (numbers, bools, objects/arrays) are coerced, so free-text content stays a string.
_FUNCTION_BLOCK = re.compile(
    r"<function\s*=\s*(?P<name>[^>\s]+)\s*>(?P<body>.*?)</function\s*>",
    re.IGNORECASE | re.DOTALL,
)
_PARAM_BLOCK = re.compile(
    r"<parameter\s*=\s*(?P<key>[^>\s]+)\s*>(?P<val>.*?)</parameter\s*>",
    re.IGNORECASE | re.DOTALL,
)


def _coerce_param(raw: str) -> Any:
    """Keep free-text verbatim (the common case: file content), but recover real JSON values when
    the whole token is unambiguous JSON (no embedded whitespace) — e.g. `3`, `true`, `{"a":1}`.
    """
    s = raw.strip()
    if s and not any(c.isspace() for c in s):
        v = _loads(s)
        if isinstance(v, (dict, list, int, float, bool)):
            return v
    return s


def _maybe_salvage_tool_calls(
    text: Optional[str],
    tool_calls: list[ToolCall],
    *,
    tools: Optional[list[dict[str, Any]]],
) -> tuple[Optional[str], list[ToolCall]]:
    """If the model returned tool calls as text, convert them. Returns (text, tool_calls):
    on success the salvaged calls replace `tool_calls` and `text` is cleared."""
    if tool_calls or not tools or not text:
        return text, tool_calls
    salvaged = _salvage_tool_calls_from_text(text, tools)
    if salvaged:
        return None, salvaged
    return text, tool_calls


def _tool_index(
    tools: Optional[list[dict[str, Any]]],
) -> tuple[Optional[set[str]], dict[str, Optional[str]]]:
    """(known tool names, {name: sole-parameter-name}) from OpenAI tool schemas. The sole-param
    map lets us map a bare `toolname [args]` to `{param: args}` when a tool has one parameter.
    """
    if not tools:
        return None, {}
    names: set[str] = set()
    single: dict[str, Optional[str]] = {}
    for t in tools:
        fn = (t or {}).get("function") or {}
        name = fn.get("name")
        if not isinstance(name, str) or not name:
            continue
        names.add(name)
        params = fn.get("parameters") or {}
        props = params.get("properties") or {}
        if len(props) == 1:
            single[name] = next(iter(props))
        else:
            required = params.get("required") or []
            single[name] = required[0] if len(required) == 1 else None
    return names, single


def _loads(s: str) -> Any:
    try:
        return json.loads(s)
    except (TypeError, json.JSONDecodeError):
        return None


def _extract_balanced(text: str, start: int) -> Optional[str]:
    """Return the balanced `{…}`/`[…]` substring beginning at `text[start]` (string-aware), or
    None if it doesn't close — so nested braces/brackets are handled correctly."""
    open_ch = text[start]
    close_ch = "]" if open_ch == "[" else "}"
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                in_str = False
        elif ch == '"':
            in_str = True
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return text[start : i + 1]
    return None


def _iter_top_objects(text: str):
    """Yield balanced `{…}` substrings at brace-depth 0 (array brackets ignored), so embedded
    JSON objects are found even amid surrounding prose."""
    i = 0
    while i < len(text):
        if text[i] == "{":
            sub = _extract_balanced(text, i)
            if sub:
                yield sub
                i += len(sub)
                continue
        i += 1


def _call_from_dict(d: Any, names: Optional[set[str]]) -> Optional[ToolCall]:
    """Build a ToolCall from a `{"name","arguments"}` dict, or None if it isn't one / the name
    isn't a known tool."""
    if not isinstance(d, dict):
        return None
    name = d.get("name")
    if not isinstance(name, str) or not name:
        return None
    if names is not None and name not in names:
        return None
    args = d.get("arguments", d.get("parameters"))
    if args is None:
        args = {}
    if isinstance(args, str):
        args = _loads(args)
        if not isinstance(args, dict):
            args = {"_raw": d.get("arguments")}
    if not isinstance(args, dict):
        args = {"_raw": args}
    return ToolCall(id="", name=name, arguments=args)


def _renumber(calls: list[ToolCall]) -> list[ToolCall]:
    return [
        ToolCall(id=f"call_salvaged_{i}", name=c.name, arguments=c.arguments)
        for i, c in enumerate(calls)
    ]


def _salvage_tool_calls_from_text(
    content: str, tools: Optional[list[dict[str, Any]]] = None
) -> list[ToolCall]:
    """Best-effort recovery of tool calls embedded in assistant text. Tries, in order:
    1. `<tool_call>…</tool_call>` blocks (anywhere, balanced); 2. embedded `{"name","arguments"}`
    objects (even mixed with prose); 3. `toolname {args}` / `toolname [args]` for known tools.
    Returns [] (treat as plain text) when nothing tool-shaped is found."""
    text = (content or "").strip()
    if not text:
        return []
    names, single = _tool_index(tools)

    # 1) <tool_call> … </tool_call> blocks.
    calls: list[ToolCall] = []
    for m in _TOOLCALL_OPEN.finditer(text):
        j = m.end()
        if j < len(text) and text[j] in "{[":
            sub = _extract_balanced(text, j)
            parsed = _loads(sub) if sub else None
            for d in parsed if isinstance(parsed, list) else [parsed]:
                c = _call_from_dict(d, names)
                if c:
                    calls.append(c)
    if calls:
        return _renumber(calls)

    # 1b) Qwen/Hermes XML calls: <function=NAME><parameter=KEY>VAL</parameter>…</function>.
    for fm in _FUNCTION_BLOCK.finditer(text):
        name = fm.group("name").strip()
        if names is not None and name not in names:
            continue
        args = {
            pm.group("key").strip(): _coerce_param(pm.group("val"))
            for pm in _PARAM_BLOCK.finditer(fm.group("body"))
        }
        calls.append(ToolCall(id="", name=name, arguments=args))
    if calls:
        return _renumber(calls)

    # 2) Embedded {"name": …, "arguments": …} objects, even surrounded by prose.
    for sub in _iter_top_objects(text):
        d = _loads(sub)
        if isinstance(d, dict) and "name" in d:
            c = _call_from_dict(d, names)
            if c:
                calls.append(c)
    if calls:
        return _renumber(calls)

    # 3) `toolname {args}` / `toolname [args]` shorthand — only for tools we actually offered.
    if names:
        for name in names:
            for m in re.finditer(re.escape(name) + r"\s*[:=]?\s*", text):
                j = m.end()
                if j >= len(text) or text[j] not in "{[":
                    continue
                sub = _extract_balanced(text, j)
                parsed = _loads(sub) if sub else None
                if parsed is None:
                    continue
                if isinstance(parsed, dict):
                    args = parsed
                else:
                    param = single.get(name)
                    if not param:
                        continue
                    args = {param: parsed}
                calls.append(ToolCall(id="", name=name, arguments=args))
                break  # one salvaged call per tool name
    return _renumber(calls)
