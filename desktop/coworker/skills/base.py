"""Skill loading — Anthropic SKILL.md format with progressive disclosure.

A skill is a folder containing `SKILL.md` (YAML frontmatter: name, description,
optional allowed-tools) + a markdown body of instructions + optional resources/scripts.

Progressive disclosure: at session start only the catalog (name + description) is injected
into the agent's context; the full body is loaded on demand via the `load_skill` tool.

Skills resolve across three tiers — builtin (bundled with the app), global
(`state_dir()/skills`), workspace (`<ws>/.coworker/skills`) — later tiers override
earlier ones on name clash. A disabled set (skills/prefs.py) hides skills from the
catalog and from `load_skill` without deleting them.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import aisuite as ai

from ..secrets import state_dir

# The catalog must never crowd out the rest of the system prompt (Codex uses 2% of the
# context window; unknown windows get a fixed byte budget — we always take the fixed one).
CATALOG_CHAR_BUDGET = 8000
_DESC_TRUNCATED_LEN = 80


@dataclass
class Skill:
    name: str
    description: str
    instructions: str = ""  # full body — loaded on demand
    path: Optional[str] = None
    allowed_tools: list[str] = field(default_factory=list)
    source: str = "global"  # "builtin" | "global" | "workspace"
    enabled: bool = True
    overrides: Optional[str] = None  # source tier this skill shadowed on a name clash


def builtin_skills_dir() -> Path:
    return Path(__file__).parent / "builtin"


def standard_skill_dirs(
    workspace: Optional[Path] = None,
) -> list[tuple[Path, str]]:
    """The three-tier search path, lowest precedence first."""
    dirs: list[tuple[Path, str]] = [
        (builtin_skills_dir(), "builtin"),
        (state_dir() / "skills", "global"),
    ]
    if workspace is not None:
        dirs.append((Path(workspace) / ".coworker" / "skills", "workspace"))
    return dirs


class SkillLoader:
    def __init__(
        self,
        dirs: list,
        *,
        disabled: Optional[set[str]] = None,
    ) -> None:
        """`dirs` entries are paths (source defaults to "global") or (path, source) pairs."""
        self._skills: dict[str, Skill] = {}
        self._disabled = disabled if disabled is not None else set()
        for entry in dirs:
            if isinstance(entry, tuple):
                directory, source = entry
            else:
                directory, source = entry, "global"
            self._discover(Path(directory), source)
        for skill in self._skills.values():
            skill.enabled = skill.name not in self._disabled

    @classmethod
    def standard(cls, workspace: Optional[Path] = None) -> "SkillLoader":
        from .prefs import load_disabled

        return cls(standard_skill_dirs(workspace), disabled=load_disabled())

    def _discover(self, directory: Path, source: str) -> None:
        if not directory.is_dir():
            return
        for sub in sorted(directory.iterdir()):
            md = sub / "SKILL.md"
            if md.is_file():
                skill = _parse_skill(md, source=source)
                prior = self._skills.get(skill.name)
                if prior is not None and prior.source != source:
                    skill.overrides = prior.source
                self._skills[skill.name] = skill

    def names(self) -> list[str]:
        return [s.name for s in self._skills.values() if s.enabled]

    def get(self, name: str) -> Optional[Skill]:
        skill = self._skills.get(name)
        if skill is None or not skill.enabled:
            return None
        return skill

    def get_any(self, name: str) -> Optional[Skill]:
        """Lookup ignoring the disabled set (management surfaces only)."""
        return self._skills.get(name)

    def catalog(self) -> list[dict]:
        return [
            {"name": s.name, "description": s.description}
            for s in self._skills.values()
            if s.enabled
        ]

    def list_all(self) -> list[Skill]:
        """Every discovered skill, including disabled ones (management surfaces)."""
        return list(self._skills.values())


def _parse_skill(md: Path, *, source: str = "global") -> Skill:
    text = md.read_text(encoding="utf-8")
    name, description, allowed, body = md.parent.name, "", [], text
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            frontmatter = text[3:end]
            body = text[end + 4 :].lstrip("\n")
            for line in frontmatter.splitlines():
                if ":" not in line:
                    continue
                key, value = line.split(":", 1)
                key, value = key.strip().lower(), value.strip()
                if key == "name" and value:
                    name = value
                elif key == "description":
                    description = value
                elif key in ("allowed-tools", "allowed_tools"):
                    allowed = [t.strip() for t in value.split(",") if t.strip()]
    return Skill(
        name=name,
        description=description,
        instructions=body.strip(),
        path=str(md.parent),
        allowed_tools=allowed,
        source=source,
    )


def skill_catalog_text(
    loader: SkillLoader, *, max_chars: int = CATALOG_CHAR_BUDGET
) -> str:
    catalog = loader.catalog()
    if not catalog:
        return ""
    header = (
        "Available skills — call load_skill(name) to load one's full instructions when "
        "it's relevant to the task:\n"
    )

    def render(entries: list[dict]) -> str:
        return header + "\n".join(f"- {c['name']}: {c['description']}" for c in entries)

    text = render(catalog)
    if len(text) <= max_chars:
        return text
    # Over budget: shorten descriptions first, then drop entries with a warning.
    trimmed = [
        {
            "name": c["name"],
            "description": c["description"][:_DESC_TRUNCATED_LEN],
        }
        for c in catalog
    ]
    text = render(trimmed)
    if len(text) <= max_chars:
        return text
    kept: list[dict] = []
    used = len(header)
    omitted = 0
    for c in trimmed:
        line = f"- {c['name']}: {c['description']}\n"
        if used + len(line) > max_chars - 80:  # reserve room for the warning line
            omitted += 1
            continue
        kept.append(c)
        used += len(line)
    warning = f"\n({omitted} more skills omitted to fit the context budget.)"
    return render(kept) + warning


def skill_tools(loader: SkillLoader) -> list:
    def load_skill(name: str) -> dict:
        """Load a skill's full instructions + resources path by name. Call this when a
        skill from the catalog is relevant to the current task."""
        skill = loader.get(name)
        if skill is None:
            return {"error": f"unknown skill: {name}", "available": loader.names()}
        return {
            "name": skill.name,
            "instructions": skill.instructions,
            "resources_path": skill.path,
        }

    return [
        ai.tool(
            load_skill,
            metadata=ai.ToolMetadata(
                category="skills", risk_level="low", capabilities=["load_skill"]
            ),
        )
    ]
