"""Web search — a keyless DuckDuckGo default + configurable third-party providers."""

from __future__ import annotations

from .providers import (
    BraveProvider,
    DuckDuckGoProvider,
    SearchResult,
    TavilyProvider,
    WebSearchProvider,
    build_provider,
    provider_names,
)
from .fetch import make_web_fetch_tool
from .tool import make_web_search_tool, resolve_provider

__all__ = [
    "SearchResult",
    "WebSearchProvider",
    "DuckDuckGoProvider",
    "TavilyProvider",
    "BraveProvider",
    "build_provider",
    "provider_names",
    "make_web_search_tool",
    "make_web_fetch_tool",
    "resolve_provider",
]
