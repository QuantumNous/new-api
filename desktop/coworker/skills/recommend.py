"""Curated skill recommendations — vetted packs the GUI offers as one-click installs.

These are NOT bundled: each entry is downloaded from its pinned upstream commit when the
user installs it. Only redistribution-friendly, reviewed skills belong here (the same bar
as `packaging/vendor_skills.py`); anything proprietary stays out, including Anthropic's
docx/pdf/pptx/xlsx document skills, whose license forbids extraction.
"""

from __future__ import annotations

from typing import Any

_ANTHROPIC = "https://github.com/anthropics/skills/tree/b29e7cf65e5cb78a5ac33d582270551bc74a14eb"

RECOMMENDED: list[dict[str, str]] = [
    {
        "name": "canvas-design",
        "title": "Canvas design",
        "description": "Design posters, one-pagers, and visual layouts with real typography rules.",
        "url": _ANTHROPIC,
        "subdir": "skills/canvas-design",
        "license": "Apache-2.0",
    },
    {
        "name": "frontend-design",
        "title": "Frontend design",
        "description": "Build polished web pages with a coherent design system.",
        "url": _ANTHROPIC,
        "subdir": "skills/frontend-design",
        "license": "Apache-2.0",
    },
    {
        "name": "web-artifacts-builder",
        "title": "Web artifacts",
        "description": "Produce self-contained interactive HTML deliverables.",
        "url": _ANTHROPIC,
        "subdir": "skills/web-artifacts-builder",
        "license": "Apache-2.0",
    },
    {
        "name": "webapp-testing",
        "title": "Web app testing",
        "description": "Drive and verify a running web app in a headless browser.",
        "url": _ANTHROPIC,
        "subdir": "skills/webapp-testing",
        "license": "Apache-2.0",
    },
    {
        "name": "mcp-builder",
        "title": "MCP builder",
        "description": "Write and package an MCP server for a new tool or API.",
        "url": _ANTHROPIC,
        "subdir": "skills/mcp-builder",
        "license": "Apache-2.0",
    },
]


def annotate(installed: set[str]) -> list[dict[str, Any]]:
    return [{**entry, "installed": entry["name"] in installed} for entry in RECOMMENDED]
