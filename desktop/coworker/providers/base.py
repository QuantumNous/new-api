"""Provider-agnostic model access layer.

The runtime never imports a provider SDK directly — it talks to a `ProviderClient`.
v1 ships `OpenAIProvider` (OpenAI SDK, `chat.completions` only); an `AISuiteProvider`
slots in later (P12) without touching the engine, since aisuite is OpenAI-API-shaped.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ToolCall:
    """A single tool call requested by the model, with parsed arguments."""

    id: str
    name: str
    arguments: dict[str, Any] = field(default_factory=dict)


@dataclass
class AssistantTurn:
    """One assistant response: free text and/or a set of tool calls."""

    text: Optional[str] = None
    tool_calls: list[ToolCall] = field(default_factory=list)
    finish_reason: Optional[str] = None
    raw: Any = field(default=None, repr=False, compare=False)
    # The model's thinking text (DeepSeek reasoning_content, Gemini thought summaries, …).
    # Display-only: persisted on the assistant message as the `reasoning` sidecar and shown
    # in the GUI, but stripped before every provider call — never replayed as context.
    reasoning: Optional[str] = None
    # Provider-private sidecars to persist on the canonical assistant message
    # (underscore-prefixed keys, e.g. `_gemini` thought signatures). Contract: the
    # owning provider consumes its own key when converting history; every other
    # provider must strip or ignore foreign underscore keys before its wire call.
    extras: dict[str, Any] = field(default_factory=dict)

    @property
    def has_tool_calls(self) -> bool:
        return bool(self.tool_calls)


@dataclass(frozen=True)
class ModelCapabilities:
    """What a given model/provider can do; used for graceful degradation."""

    tools: bool = True
    vision: bool = False
    # Native PDF ingestion (OpenAI `file` part / Anthropic document / Gemini inline_data).
    # Models without it get a local fallback: text extraction or page images (pdf_support.py).
    pdf: bool = False
    parallel_tool_calls: bool = True
    streaming: bool = True


@dataclass
class StreamChunk:
    """One streamed piece: a text and/or reasoning delta, and/or (final) the full turn."""

    text_delta: Optional[str] = None
    reasoning_delta: Optional[str] = None
    turn: Optional[AssistantTurn] = None


class ProviderClient(ABC):
    """Single-shot, provider-agnostic completion interface.

    Deliberately blocking (the turn engine wraps it in `asyncio.to_thread`) and
    deliberately without a `max_turns` loop — the runtime owns the agent loop.
    """

    @abstractmethod
    def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **settings: Any,
    ) -> AssistantTurn:
        """Return one assistant turn for the given messages/tools."""

    @abstractmethod
    def capabilities(self, model: str) -> ModelCapabilities:
        """Return capability flags for the given model."""

    def stream(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **settings: Any,
    ):
        """Yield StreamChunks. Default: no token streaming — one final chunk with the
        full turn. Providers that support streaming (OpenAIProvider) override this."""
        yield StreamChunk(
            turn=self.complete(model=model, messages=messages, tools=tools, **settings)
        )
