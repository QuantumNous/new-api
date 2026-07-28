"""AWS Bedrock provider — one entry in Settings, two wire paths by model family.

Routed ids look like `bedrock:<family>/<bedrock model id>`; the router strips `bedrock:`
and this provider splits the family segment:

- `claude/…`  → the native `AnthropicProvider` over the SDK's `AnthropicBedrock` client,
  so Claude-on-Bedrock gets everything direct Anthropic gets (thinking, refusal handling).
- `other/…`   → the Converse API (`bedrock-runtime.converse/converse_stream`), Bedrock's
  unified wire format across Llama, Nova, Mistral, Cohere, DeepSeek, …

An id with no family segment falls back to Converse as-is — Converse serves every Bedrock
model (including Claude, minus the native extras), so a raw model id pasted without the
add-model dropdown still works.

Auth is ONE method at a time, selected by the profile's `auth_method` (a segmented choice
in Settings — owner call 2026-07-26, directness over field-precedence rules):

- `api_key`  — a **Bedrock API key** (bearer token from the console, the no-CLI path);
  rides `AWS_BEARER_TOKEN_BEDROCK`, which boto3 prefers over SigV4 for Bedrock calls.
- `profile`  — a named `~/.aws` profile (covers `aws sso login`); blank → the default
  credential chain (env vars / ~/.aws / role).
- `iam`      — explicit access keys (+ optional STS session token).

Fields from non-selected methods are dropped at construction, so a stale stored value can
never leak into a different auth path (`AnthropicBedrock` raises outright on a mix). A
missing/unknown method falls back to whichever fields are present, api_key first.

boto3 is a lazy import (packaged via the `bedrock` extra) and returns PLAIN DICTS — every
response/stream mapping here is dict-shaped, unlike the attribute objects other SDKs return.
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Any, Optional

from .anthropic_provider import AnthropicProvider
from .base import (
    AssistantTurn,
    ModelCapabilities,
    ProviderClient,
    StreamChunk,
    ToolCall,
)
from .capabilities import capabilities_for

# Converse has no required max token param but per-model defaults vary wildly (Meta's is
# 512 — an agent turn gets truncated mid-tool-call); 4096 fits every family's ceiling.
DEFAULT_MAX_TOKENS = 4096

# Converse stopReason → the engine's OpenAI-shaped finish_reason vocabulary.
_STOP_REASON_MAP = {
    "end_turn": "stop",
    "tool_use": "tool_calls",
    "max_tokens": "length",
    "stop_sequence": "stop",
    "guardrail_intervened": "stop",
    "content_filtered": "stop",
}

_DATA_URL_RE = re.compile(
    r"^data:image/([a-z0-9.+-]+);base64,(.+)$", re.IGNORECASE | re.DOTALL
)
_PDF_DATA_URL_RE = re.compile(
    r"^data:application/pdf;base64,(.+)$", re.IGNORECASE | re.DOTALL
)

# Bedrock document names: alphanumeric, whitespace, hyphens, parens, brackets only.
_DOC_NAME_RE = re.compile(r"[^A-Za-z0-9\s\-\(\)\[\]]+")


def _session_kwargs(
    profile_name: Optional[str],
    access_key_id: Optional[str],
    secret_access_key: Optional[str],
    session_token: Optional[str],
) -> dict[str, Any]:
    """boto3.Session kwargs for the explicit → profile → ambient resolution order."""
    if access_key_id and secret_access_key:
        kwargs: dict[str, Any] = {
            "aws_access_key_id": access_key_id,
            "aws_secret_access_key": secret_access_key,
        }
        if session_token:
            kwargs["aws_session_token"] = session_token
        return kwargs
    if profile_name:
        return {"profile_name": profile_name}
    return {}


def _parse_args(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, dict) else {"_raw": raw}
    except (TypeError, json.JSONDecodeError):
        return {"_raw": raw}


def _user_blocks(content: Any) -> list[dict[str, Any]]:
    """User content (str or OpenAI parts list) → Converse content blocks (bytes, not URLs)."""
    if isinstance(content, str):
        return [{"text": content}] if content else []
    blocks: list[dict[str, Any]] = []
    for part in content or []:
        kind = part.get("type") if isinstance(part, dict) else None
        if kind == "text":
            if part.get("text"):
                blocks.append({"text": part["text"]})
        elif kind == "image_url":
            url = (part.get("image_url") or {}).get("url") or ""
            match = _DATA_URL_RE.match(url)
            if match:
                fmt = match.group(1).lower()
                blocks.append(
                    {
                        "image": {
                            "format": "jpeg" if fmt == "jpg" else fmt,
                            "source": {"bytes": base64.b64decode(match.group(2))},
                        }
                    }
                )
            else:  # Converse takes bytes only — no URL sources.
                blocks.append({"text": "[unsupported image attachment]"})
        elif kind == "file":
            file = part.get("file") or {}
            match = _PDF_DATA_URL_RE.match(file.get("file_data") or "")
            if match:
                name = _DOC_NAME_RE.sub("-", str(file.get("filename") or "document"))
                blocks.append(
                    {
                        "document": {
                            "format": "pdf",
                            "name": name or "document",
                            "source": {"bytes": base64.b64decode(match.group(1))},
                        }
                    }
                )
            else:
                blocks.append({"text": "[unsupported file attachment]"})
    return blocks


def convert_messages(
    messages: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """OpenAI-shaped history → (Converse `system`, Converse `messages`).

    Same shape discipline as the Anthropic converter (it's the same API family): leading
    system messages become the top-level param, `role:"tool"` results become toolResult
    blocks inside a user message, and consecutive same-role messages fold together so all
    of a turn's parallel tool results land in the single next user message.
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
            text = message.get("content") or ""
            if text:
                converted.append(
                    {"role": "user", "content": [{"text": f"<system>\n{text}\n</system>"}]}
                )
        elif role == "user":
            blocks = _user_blocks(message.get("content"))
            if blocks:
                converted.append({"role": "user", "content": blocks})
        elif role == "assistant":
            blocks = []
            text = message.get("content")
            if isinstance(text, str) and text:
                blocks.append({"text": text})
            for call in message.get("tool_calls") or []:
                function = call.get("function") or {}
                blocks.append(
                    {
                        "toolUse": {
                            "toolUseId": call.get("id") or "",
                            "name": function.get("name") or "",
                            "input": _parse_args(function.get("arguments")),
                        }
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
                            "toolResult": {
                                "toolUseId": message.get("tool_call_id") or "",
                                "content": [
                                    {"text": str(message.get("content") or "")}
                                ],
                            }
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
        raise ValueError("no convertible messages for the Bedrock Converse API")
    if folded[0]["role"] != "user":
        folded.insert(0, {"role": "user", "content": [{"text": "(continued)"}]})

    system = [{"text": "\n\n".join(system_parts)}] if system_parts else []
    return system, folded


def convert_tools(tools: Optional[list[dict[str, Any]]]) -> Optional[dict[str, Any]]:
    """OpenAI function schemas → Converse `toolConfig` (None when there are no tools —
    Converse rejects an empty tool list)."""
    specs = []
    for tool in tools or []:
        function = tool.get("function") or {}
        parameters = function.get("parameters")
        if not isinstance(parameters, dict) or not parameters.get("type"):
            parameters = {"type": "object", "properties": {}}
        spec: dict[str, Any] = {
            "name": function.get("name") or "",
            "inputSchema": {"json": parameters},
        }
        if function.get("description"):
            spec["description"] = function["description"]
        specs.append({"toolSpec": spec})
    return {"tools": specs} if specs else None


def _inference_config(settings: dict[str, Any]) -> dict[str, Any]:
    """Whitelisted engine settings → Converse `inferenceConfig` (camelCase)."""
    config: dict[str, Any] = {
        "maxTokens": int(settings.get("max_tokens") or DEFAULT_MAX_TOKENS)
    }
    if settings.get("temperature") is not None:
        config["temperature"] = settings["temperature"]
    if settings.get("top_p") is not None:
        config["topP"] = settings["top_p"]
    stop = settings.get("stop_sequences") or settings.get("stop")
    if stop:
        config["stopSequences"] = [stop] if isinstance(stop, str) else list(stop)
    return config


class _BedrockConverseClient(ProviderClient):
    """The `other/` family: any Bedrock model over the unified Converse API."""

    def __init__(
        self,
        client: Any = None,
        *,
        region: Optional[str] = None,
        bedrock_api_key: Optional[str] = None,
        profile_name: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        session_token: Optional[str] = None,
    ):
        self._client = client  # tests inject a dict-returning fake
        self._region = region
        self._bedrock_api_key = bedrock_api_key
        self._session_kwargs = _session_kwargs(
            profile_name, access_key_id, secret_access_key, session_token
        )

    def _ensure_client(self) -> Any:
        if self._client is None:
            try:
                import boto3
            except ImportError as exc:
                raise RuntimeError(
                    "AWS Bedrock support needs the boto3 package — "
                    "install with `pip install 'openworker[bedrock]'`."
                ) from exc
            # boto3 has no per-client bearer parameter — it only reads the env var, and
            # prefers bearer auth for Bedrock whenever it's set. The sidecar process is
            # ours, so publishing the configured key there is the supported path.
            if self._bedrock_api_key:
                os.environ["AWS_BEARER_TOKEN_BEDROCK"] = self._bedrock_api_key
            session = boto3.session.Session(**self._session_kwargs)
            self._client = session.client("bedrock-runtime", region_name=self._region)
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
        kwargs: dict[str, Any] = {
            "modelId": model,
            "messages": converted,
            "inferenceConfig": _inference_config(settings),
        }
        if system:
            kwargs["system"] = system
        tool_config = convert_tools(tools)
        if tool_config:
            kwargs["toolConfig"] = tool_config
        return kwargs

    @staticmethod
    def _call(client: Any, method: str, kwargs: dict[str, Any]) -> Any:
        try:
            return getattr(client, method)(**kwargs)
        except Exception as exc:
            # boto3's "Unable to locate credentials" is famously cryptic — name the fix.
            if exc.__class__.__name__ == "NoCredentialsError":
                raise RuntimeError(
                    "No AWS credentials found — add keys or a profile in Settings ▸ "
                    "Models, or configure the AWS CLI (`aws configure` / `aws sso login`)."
                ) from exc
            raise

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
        response = self._call(self._ensure_client(), "converse", kwargs)

        text_parts: list[str] = []
        reasoning_parts: list[str] = []
        tool_calls: list[ToolCall] = []
        content = ((response.get("output") or {}).get("message") or {}).get(
            "content"
        ) or []
        for block in content:
            if "text" in block:
                text_parts.append(block["text"] or "")
            elif "toolUse" in block:
                tool = block["toolUse"]
                tool_calls.append(
                    ToolCall(
                        id=tool.get("toolUseId") or "",
                        name=tool.get("name") or "",
                        arguments=_parse_args(tool.get("input")),
                    )
                )
            elif "reasoningContent" in block:
                text = (block["reasoningContent"].get("reasoningText") or {}).get(
                    "text"
                ) or ""
                if text:
                    reasoning_parts.append(text)
        stop_reason = response.get("stopReason")
        return AssistantTurn(
            text="".join(text_parts) or None,
            tool_calls=tool_calls,
            finish_reason=_STOP_REASON_MAP.get(stop_reason, stop_reason),
            raw=response,
            reasoning="".join(reasoning_parts) or None,
        )

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
        response = self._call(self._ensure_client(), "converse_stream", kwargs)

        text_parts: list[str] = []
        reasoning_parts: list[str] = []
        tool_accum: dict[int, dict[str, str]] = {}
        stop_reason = None

        for event in response.get("stream") or []:
            if "contentBlockStart" in event:
                start = (event["contentBlockStart"].get("start") or {}).get("toolUse")
                if start:
                    tool_accum[event["contentBlockStart"].get("contentBlockIndex", 0)] = {
                        "id": start.get("toolUseId") or "",
                        "name": start.get("name") or "",
                        "json": "",
                    }
            elif "contentBlockDelta" in event:
                block = event["contentBlockDelta"]
                delta = block.get("delta") or {}
                if delta.get("text"):
                    text_parts.append(delta["text"])
                    yield StreamChunk(text_delta=delta["text"])
                elif "toolUse" in delta:
                    acc = tool_accum.get(block.get("contentBlockIndex", 0))
                    if acc is not None:
                        acc["json"] += delta["toolUse"].get("input") or ""
                elif "reasoningContent" in delta:
                    thought = delta["reasoningContent"].get("text") or ""
                    if thought:
                        reasoning_parts.append(thought)
                        yield StreamChunk(reasoning_delta=thought)
            elif "messageStop" in event:
                stop_reason = event["messageStop"].get("stopReason") or stop_reason

        tool_calls = [
            ToolCall(
                id=tool_accum[i]["id"],
                name=tool_accum[i]["name"],
                arguments=_parse_args(tool_accum[i]["json"]),
            )
            for i in sorted(tool_accum)
        ]
        yield StreamChunk(
            turn=AssistantTurn(
                text="".join(text_parts) or None,
                tool_calls=tool_calls,
                finish_reason=_STOP_REASON_MAP.get(stop_reason, stop_reason),
                reasoning="".join(reasoning_parts) or None,
            )
        )

    def capabilities(self, model: str) -> ModelCapabilities:
        return capabilities_for(f"bedrock:other/{model}")


class BedrockProvider(ProviderClient):
    """Family dispatcher: splits `<family>/<model id>` and delegates to the sub-client."""

    def __init__(
        self,
        *,
        region: Optional[str] = None,
        auth_method: Optional[str] = None,
        bedrock_api_key: Optional[str] = None,
        profile_name: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        session_token: Optional[str] = None,
        claude_client: Optional[ProviderClient] = None,
        converse_client: Optional[ProviderClient] = None,
    ):
        # Narrow to the selected auth method here, once — stale values stored under a
        # previously-selected method must never reach a different credential path.
        if auth_method == "api_key":
            profile_name = access_key_id = secret_access_key = session_token = None
        elif auth_method == "profile":
            bedrock_api_key = access_key_id = secret_access_key = session_token = None
        elif auth_method == "iam":
            bedrock_api_key = profile_name = None
        self._region = region
        self._bedrock_api_key = bedrock_api_key
        self._profile_name = profile_name
        self._access_key_id = access_key_id
        self._secret_access_key = secret_access_key
        self._session_token = session_token
        # Test seams: pre-built sub-providers skip the SDK construction below.
        self._clients: dict[str, ProviderClient] = {}
        if claude_client is not None:
            self._clients["claude"] = claude_client
        if converse_client is not None:
            self._clients["other"] = converse_client

    @staticmethod
    def _split(model: str) -> tuple[str, str]:
        """`claude/<id>` → the native path; anything else (including a raw Bedrock id with
        no family segment) → Converse, which serves every Bedrock model."""
        if "/" in model:
            family, rest = model.split("/", 1)
            if family in ("claude", "other"):
                return family, rest
        return "other", model

    def _family_client(self, family: str) -> ProviderClient:
        client = self._clients.get(family)
        if client is None:
            if family == "claude":
                from anthropic import AnthropicBedrock

                # A Bedrock API key (field or ambient env) takes the bearer path and
                # EXCLUDES the SigV4 params — AnthropicBedrock raises on a mix.
                bearer = self._bedrock_api_key or os.environ.get(
                    "AWS_BEARER_TOKEN_BEDROCK"
                )
                if bearer:
                    sdk = AnthropicBedrock(api_key=bearer, aws_region=self._region)
                else:
                    sdk = AnthropicBedrock(
                        aws_region=self._region,
                        aws_profile=self._profile_name,
                        aws_access_key=self._access_key_id,
                        aws_secret_key=self._secret_access_key,
                        aws_session_token=self._session_token,
                    )
                client = AnthropicProvider(client=sdk)
            else:
                client = _BedrockConverseClient(
                    region=self._region,
                    bedrock_api_key=self._bedrock_api_key,
                    profile_name=self._profile_name,
                    access_key_id=self._access_key_id,
                    secret_access_key=self._secret_access_key,
                    session_token=self._session_token,
                )
            self._clients[family] = client
        return client

    def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **settings: Any,
    ) -> AssistantTurn:
        family, rest = self._split(model)
        return self._family_client(family).complete(
            model=rest, messages=messages, tools=tools, **settings
        )

    def stream(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **settings: Any,
    ):
        family, rest = self._split(model)
        return self._family_client(family).stream(
            model=rest, messages=messages, tools=tools, **settings
        )

    def capabilities(self, model: str) -> ModelCapabilities:
        qualified = model if model.startswith("bedrock:") else f"bedrock:{model}"
        return capabilities_for(qualified)
