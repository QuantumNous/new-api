"""Per-model capability probe.

A heuristic table for now (refined as we probe real providers/endpoints). Accepts
either bare model names (`gpt-5.5`) or provider-qualified ones (`openai:gpt-5.5`).
"""

from __future__ import annotations

from .base import ModelCapabilities


def capabilities_for(model: str) -> ModelCapabilities:
    # Curated models answer from the matrix (exact full-id match — including reseller ids
    # like `together:zai-org/GLM-5.2`, whose names defeat the prefix heuristics below).
    # Custom user-added models fall through to the heuristics, at their own risk.
    from .matrix import entry_for

    entry = entry_for(model)
    if entry is not None:
        return entry.caps

    provider = model.split(":", 1)[0].lower() if ":" in model else ""
    name = model.split(":", 1)[-1].lower()  # strip a provider prefix if present

    # Ollama (local) models vary widely and many fake/mishandle parallel tool calls — assume
    # tools work (we only point at tool-capable models) but stay conservative otherwise.
    if provider == "ollama":
        return ModelCapabilities(
            tools=True, vision=False, parallel_tool_calls=False, streaming=True
        )

    # Claude / Gemini (both native): tools + vision + parallel tool calls + streaming. The
    # engine executes parallel calls sequentially and each converter folds the results into
    # the single next user message — exactly what both APIs require.
    if provider in ("anthropic", "gemini"):
        return ModelCapabilities(
            tools=True, vision=True, pdf=True, parallel_tool_calls=True, streaming=True
        )

    # Modern OpenAI GPT models: tools + vision + parallel tool calls + streaming.
    if name.startswith(("gpt-5", "gpt-4")):
        return ModelCapabilities(
            tools=True, vision=True, pdf=True, parallel_tool_calls=True, streaming=True
        )

    # OpenAI reasoning models: tools yes, parallel tool calls constrained.
    if name.startswith(("o1", "o3", "o4")):
        return ModelCapabilities(
            tools=True, vision=False, parallel_tool_calls=False, streaming=True
        )

    # OpenAI-compatible vendors (DeepSeek, Z AI/GLM, Kimi, MiniMax, Qwen, xAI/Grok, Mistral):
    # tool calling + streaming across their current lineups; vision left off until probed
    # per-model (several have vision variants, but the text flagships are what we suggest).
    if name.startswith(
        ("deepseek", "glm", "kimi", "minimax", "qwen", "grok", "mistral", "magistral")
    ):
        return ModelCapabilities(
            tools=True, vision=False, parallel_tool_calls=True, streaming=True
        )

    # Conservative default for unknown models.
    return ModelCapabilities(
        tools=True, vision=False, parallel_tool_calls=False, streaming=True
    )
