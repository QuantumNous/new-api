"""ProviderRouter — one `ProviderClient` that dispatches by the `provider:` prefix of a model
string to a per-provider client, built lazily from its SecretStore profile and cached.

This is the single provider the `SessionManager` hands to every engine, so `complete()/stream()`
(which already receive the full model string per-call) route themselves: `ollama:llama3.3` →
the Ollama client (Ollama's OpenAI-compatible `/v1`), bare `gpt-5.5` → the default (OpenAI). The
prefix is stripped before delegating, since the underlying SDKs want the bare model name.

Config changes (a new key, a new Ollama URL) call `invalidate()` to drop cached clients, so
existing engines pick up the change without a rebuild.
"""

from __future__ import annotations

import threading
from typing import Any, Optional

from .base import ProviderClient
from .capabilities import capabilities_for
from .registry import build_provider_client, get_descriptor


class ProviderRouter(ProviderClient):
    def __init__(
        self,
        secrets: Any = None,
        *,
        default_provider: str = "openai",
        on_use: Any = None,
    ) -> None:
        self._secrets = secrets
        self._default = default_provider
        self._clients: dict[str, ProviderClient] = {}
        self._lock = threading.Lock()
        # Optional callable(provider_name) fired when a completion is dispatched — drives the
        # Settings pane's "Last used" line. Best-effort: its failures never break a model call.
        self._on_use = on_use

    def _note_use(self, model: str) -> None:
        if self._on_use is None:
            return
        try:
            self._on_use(self._provider_name(model))
        except Exception:
            pass

    # -- routing ----------------------------------------------------------------
    def _provider_name(self, model: str) -> str:
        """The provider for a model: the `prefix` of `prefix:rest` if it's a known provider,
        else the default. (A colon that isn't a known provider — unlikely — falls through.)
        """
        if ":" in model:
            prefix = model.split(":", 1)[0]
            if get_descriptor(prefix) is not None:
                return prefix
        return self._default

    def _client_for(self, model: str) -> ProviderClient:
        name = self._provider_name(model)
        with self._lock:
            client = self._clients.get(name)
            if client is None:
                profile = {}
                if self._secrets is not None:
                    profile = self._secrets.get(f"provider:{name}") or {}
                client = build_provider_client(name, profile, self._secrets)
                self._clients[name] = client
            return client

    @staticmethod
    def _bare(model: str) -> str:
        """Strip a KNOWN provider prefix; the underlying SDK wants the bare model name. A model
        whose first segment isn't a provider (e.g. `qwen2.5-coder:32b` — a version tag, not a
        prefix) is returned unchanged, so the colon isn't mistaken for a provider separator.
        """
        if ":" in model:
            prefix, rest = model.split(":", 1)
            if get_descriptor(prefix) is not None:
                return rest
        return model

    def invalidate(self, name: Optional[str] = None) -> None:
        """Drop cached client(s) so the next call rebuilds with fresh config."""
        with self._lock:
            if name is None:
                self._clients.clear()
            else:
                self._clients.pop(name, None)

    # -- ProviderClient ---------------------------------------------------------
    def complete(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **settings: Any,
    ):
        self._note_use(model)
        return self._client_for(model).complete(
            model=self._bare(model), messages=messages, tools=tools, **settings
        )

    def stream(
        self,
        *,
        model: str,
        messages: list[dict[str, Any]],
        tools: Optional[list[dict[str, Any]]] = None,
        **settings: Any,
    ):
        self._note_use(model)
        return self._client_for(model).stream(
            model=self._bare(model), messages=messages, tools=tools, **settings
        )

    def capabilities(self, model: str):
        return capabilities_for(model)
