"""Persona manifest — parse + validate a persona definition.

Format: YAML frontmatter (identity + capability declaration) followed by a markdown body that
is the system prompt. `persona ⊇ skill` — the same frontmatter-markdown shape as SKILL.md, with
more structured fields. Parsing is strict: an invalid manifest raises ``ManifestError`` rather
than silently producing a broken persona (a third-party persona must fail loudly).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

# Persona ids become directory names under the managed install area (and registry keys), so
# they are restricted to a filesystem-safe slug on every OS: no path separators or `..`
# (traversal), no `:*?"<>|` (invalid on Windows), bounded length.
_ID_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,63}$")

VALID_FAMILIES = {"code", "knowledge"}
VALID_WORKSPACES = {"git", "project", "deliverable", "none"}
VALID_MODES = {"discuss", "plan", "interactive", "custom", "auto"}
VALID_REC_KINDS = {"connector", "mcp"}
VALID_REC_TIERS = {"core", "optional"}


class ManifestError(ValueError):
    """A persona manifest is malformed or references unknown capabilities/values."""


@dataclass
class Recommendation:
    """A connection a persona recommends, surfaced in the per-session connections drawer. ``ref`` is a
    connector id or an MCP server name; ``reason`` is the value it unlocks; ``tier`` ranks it. Not
    validated against shipped connectors — a persona may recommend one we don't ship yet.
    """

    kind: str  # "connector" | "mcp"
    ref: str
    reason: str = ""
    tier: str = "optional"  # "core" | "optional"


@dataclass
class PersonaManifest:
    id: str
    name: str
    system_prompt: str
    icon: str = ""
    tagline: str = ""
    description: str = ""
    tools: list[str] = field(default_factory=list)
    family: str = "knowledge"  # "code" | "knowledge"
    # Derived from family since the enum collapse (§16): code → "git", knowledge →
    # "deliverable". Builtins registered via builders may still carry "none" (Chat).
    workspace: str = "deliverable"
    messaging: bool = False
    connectors: bool = False
    default_permission_mode: str = "interactive"
    recommended_models: list[str] = field(default_factory=list)
    skills: list[str] = field(default_factory=list)
    mcp: list[str] = field(default_factory=list)
    recommends: list[Recommendation] = field(default_factory=list)
    builtin: bool = False
    source: Optional[str] = (
        None  # where it was loaded from (path / url), for provenance
    )

    @property
    def needs_workspace(self) -> bool:
        return self.workspace != "none"

    def to_agent(self):
        """Materialize the runtime Agent (prompt + catalog-expanded tools + traits)."""
        from ..agents.base import Agent
        from ..catalog import expand

        tool_ids = list(self.tools)
        factory = (lambda ctx: expand(tool_ids, ctx)) if tool_ids else None
        return Agent(
            name=self.id,
            title=self.name,
            system_prompt=self.system_prompt,
            needs_workspace=self.needs_workspace,
            tool_factory=factory,
            family=self.family,
            messaging=self.messaging,
            connectors=self.connectors,
        )


def _split_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    if not text.startswith("---"):
        raise ManifestError("manifest must start with a YAML frontmatter block (---)")
    end = text.find("\n---", 3)
    if end == -1:
        raise ManifestError("unterminated frontmatter block (missing closing ---)")
    raw = text[3:end]
    body = text[end + 4 :].lstrip("\n")
    try:
        meta = yaml.safe_load(raw) or {}
    except yaml.YAMLError as e:  # pragma: no cover - exercised via parse error path
        raise ManifestError(f"invalid YAML frontmatter: {e}") from e
    if not isinstance(meta, dict):
        raise ManifestError("frontmatter must be a mapping of key: value")
    return meta, body


def _slugify(stem: str) -> str:
    """Normalize a filename stem into the persona-id charset (used only for ids derived
    from filenames; explicit `id:` values must already be valid)."""
    slug = re.sub(r"[^a-z0-9_-]+", "-", stem.strip().lower()).strip("-_")[:64]
    return slug if _ID_RE.match(slug) else ""


def _strlist(meta: dict, key: str) -> list[str]:
    val = meta.get(key, [])
    if val is None:
        return []
    if isinstance(val, str):
        return [v.strip() for v in val.split(",") if v.strip()]
    if isinstance(val, list):
        return [str(v).strip() for v in val if str(v).strip()]
    raise ManifestError(f"`{key}` must be a list or comma-separated string")


def _recommends(persona_id: str, meta: dict) -> list[Recommendation]:
    raw = meta.get("recommends")
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ManifestError(f"persona {persona_id!r}: `recommends` must be a list")
    out: list[Recommendation] = []
    for item in raw:
        if not isinstance(item, dict):
            raise ManifestError(
                f"persona {persona_id!r}: each `recommends` item must be a mapping"
            )
        if "connector" in item:
            kind, ref = "connector", str(item.get("connector") or "").strip()
        elif "mcp" in item:
            kind, ref = "mcp", str(item.get("mcp") or "").strip()
        else:
            raise ManifestError(
                f"persona {persona_id!r}: each `recommends` item needs a `connector:` or `mcp:` key"
            )
        if not ref:
            raise ManifestError(
                f"persona {persona_id!r}: a `recommends` item has an empty {kind}"
            )
        tier = str(item.get("tier", "optional")).strip().lower()
        if tier not in VALID_REC_TIERS:
            raise ManifestError(
                f"persona {persona_id!r}: recommend tier must be one of {sorted(VALID_REC_TIERS)}"
            )
        out.append(
            Recommendation(
                kind=kind,
                ref=ref,
                reason=str(item.get("reason", "")).strip(),
                tier=tier,
            )
        )
    return out


def parse_manifest(
    text: str,
    *,
    fallback_id: Optional[str] = None,
    builtin: bool = False,
    source: Optional[str] = None,
) -> PersonaManifest:
    meta, body = _split_frontmatter(text)

    explicit_id = str(meta.get("id") or "").strip()
    if explicit_id:
        persona_id = explicit_id
        if not _ID_RE.match(persona_id):
            raise ManifestError(
                f"persona id {persona_id!r} is invalid: lowercase letters, digits, '-' or '_' "
                "only, starting with a letter/digit, max 64 chars (ids become directory names)"
            )
    else:
        # Derived from the filename: normalize it into the id charset instead of erroring,
        # so `My Persona.md` without an explicit id still installs (as `my-persona`).
        persona_id = _slugify(str(fallback_id or ""))
        if not persona_id:
            raise ManifestError(
                "manifest needs an `id` (or a filename to derive one from)"
            )
    if not body.strip():
        raise ManifestError(f"persona {persona_id!r} has no body (the system prompt)")

    family = str(meta.get("family", "knowledge")).strip().lower()
    if family not in VALID_FAMILIES:
        raise ManifestError(
            f"persona {persona_id!r}: family must be one of {sorted(VALID_FAMILIES)}"
        )

    # The workspace enum collapsed into family (owner decision 2026-07-03, UX-DECISIONS §16):
    # knowledge → transparent scratch + user-added roots (no folder gate, ever); code → an
    # explicit directory picked by the user. The manifest key is still accepted — and
    # typo-checked — so older manifests parse, but it no longer drives behavior.
    declared = str(meta.get("workspace", "")).strip().lower()
    if declared and declared not in VALID_WORKSPACES:
        raise ManifestError(
            f"persona {persona_id!r}: workspace must be one of {sorted(VALID_WORKSPACES)}"
        )
    workspace = "git" if family == "code" else "deliverable"

    mode = str(meta.get("default_permission_mode", "interactive")).strip().lower()
    if mode not in VALID_MODES:
        raise ManifestError(
            f"persona {persona_id!r}: default_permission_mode must be one of {sorted(VALID_MODES)}"
        )

    tools = _strlist(meta, "tools")
    _validate_tools(persona_id, tools)

    return PersonaManifest(
        id=persona_id,
        name=str(meta.get("name") or persona_id).strip(),
        system_prompt=body.strip(),
        icon=str(meta.get("icon", "")).strip(),
        tagline=str(meta.get("tagline", "")).strip(),
        description=str(meta.get("description", "")).strip(),
        tools=tools,
        family=family,
        workspace=workspace,
        messaging=bool(meta.get("messaging", False)),
        connectors=bool(meta.get("connectors", False)),
        default_permission_mode=mode,
        recommended_models=_strlist(meta, "recommended_models"),
        skills=_strlist(meta, "skills"),
        mcp=_strlist(meta, "mcp"),
        recommends=_recommends(persona_id, meta),
        builtin=builtin,
        source=source,
    )


def _validate_tools(persona_id: str, tools: list[str]) -> None:
    # Imported here to avoid a module-load cycle (catalog imports agents.base).
    from ..catalog import CATALOG

    unknown = [t for t in tools if t not in CATALOG]
    if unknown:
        raise ManifestError(
            f"persona {persona_id!r} references unknown tool capabilities: {unknown}. "
            f"Known: {sorted(CATALOG)}"
        )


def load_manifest_file(path: str | Path, *, builtin: bool = False) -> PersonaManifest:
    p = Path(path)
    return parse_manifest(
        p.read_text(encoding="utf-8"),
        fallback_id=p.stem,
        builtin=builtin,
        source=str(p),
    )
