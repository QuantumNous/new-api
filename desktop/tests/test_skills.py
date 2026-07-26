"""Agents (Code/Chat) + SKILL.md loader (catalog + load_skill)."""

from __future__ import annotations

from pathlib import Path

from coworker.agent import build_engine
from coworker.agents import AgentContext, chat_agent, code_agent, get_agent
from coworker.providers import ModelCapabilities
from coworker.skills import SkillLoader, skill_catalog_text, skill_tools
from coworker.tools import ToolRegistry
from coworker.tools.shell import LocalExecutor
from coworker.tools.todo import TodoList


class _Stub:
    def complete(self, **kwargs):  # pragma: no cover
        raise NotImplementedError

    def capabilities(self, model):
        return ModelCapabilities()


# -- agents ---------------------------------------------------------------------


def test_code_agent_tools(tmp_path):
    ex = LocalExecutor(cwd=tmp_path, default_timeout=5)
    try:
        ctx = AgentContext(workspace=tmp_path, executor=ex, todo=TodoList())
        names = {getattr(t, "__name__", "?") for t in code_agent().build_tools(ctx)}
        assert {
            "read_file",
            "write_file",
            "git_status",
            "run_shell",
            "todo_write",
        } <= names
    finally:
        ex.close()


def test_chat_agent_has_no_workspace_tools():
    assert chat_agent().build_tools(AgentContext()) == []
    assert chat_agent().needs_workspace is False
    assert code_agent().needs_workspace is True


def test_get_agent_fallback():
    assert get_agent("chat").name == "chat"
    # Unknown ids fall back to the default persona (Cowork), per the persona registry.
    assert get_agent("nope").name == "cowork"


# -- SKILL.md loader ------------------------------------------------------------


def _make_skill(skills_dir, name, desc, body):
    d = skills_dir / name
    d.mkdir(parents=True)
    (d / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: {desc}\n---\n{body}", encoding="utf-8"
    )


def test_three_tier_precedence_and_overrides(tmp_path):
    for tier in ("builtin", "global", "workspace"):
        _make_skill(tmp_path / tier, "report", f"{tier} report", f"{tier} body")
    _make_skill(tmp_path / "builtin", "base-only", "only in builtin", "b")

    loader = SkillLoader(
        [
            (tmp_path / "builtin", "builtin"),
            (tmp_path / "global", "global"),
            (tmp_path / "workspace", "workspace"),
        ]
    )
    report = loader.get("report")
    assert report.source == "workspace"
    assert report.description == "workspace report"
    assert report.overrides == "global"
    assert loader.get("base-only").source == "builtin"
    assert len(loader.list_all()) == 2


def test_disabled_skill_hidden_from_catalog_and_load(tmp_path):
    skills_dir = tmp_path / "skills"
    _make_skill(skills_dir, "alpha", "first", "alpha body")
    _make_skill(skills_dir, "beta", "second", "beta body")

    loader = SkillLoader([skills_dir], disabled={"alpha"})
    assert loader.get("alpha") is None
    assert loader.get_any("alpha").enabled is False
    assert [c["name"] for c in loader.catalog()] == ["beta"]

    reg = ToolRegistry()
    reg.register_all(skill_tools(loader))
    assert reg.execute("load_skill", {"name": "alpha"})["error"]
    assert reg.execute("load_skill", {"name": "beta"})["name"] == "beta"


def test_catalog_budget_shortens_then_omits(tmp_path):
    skills_dir = tmp_path / "skills"
    for i in range(30):
        _make_skill(skills_dir, f"skill-{i:02d}", "x" * 300, "body")
    loader = SkillLoader([skills_dir])

    full = skill_catalog_text(loader)
    assert len(full) <= 8000  # default budget holds via description truncation

    tight = skill_catalog_text(loader, max_chars=500)
    assert len(tight) <= 600
    assert "omitted" in tight


def test_standard_loader_reads_state_dir_and_prefs(tmp_path):
    from coworker.secrets import state_dir
    from coworker.skills.prefs import load_disabled, set_enabled

    _make_skill(state_dir() / "skills", "notes", "global notes", "body")
    ws = tmp_path / "ws"
    _make_skill(ws / ".coworker" / "skills", "notes", "workspace notes", "body")

    loader = SkillLoader.standard(ws)
    assert loader.get("notes").source == "workspace"

    set_enabled("notes", False)
    assert load_disabled() == {"notes"}
    assert SkillLoader.standard(ws).get("notes") is None
    set_enabled("notes", True)
    assert SkillLoader.standard(ws).get("notes") is not None


def test_builtin_pack_ships_office_and_vendored_skills():
    loader = SkillLoader.standard()
    builtin = {s.name for s in loader.list_all() if s.source == "builtin"}
    assert {
        "docx-report",
        "xlsx-workbook",
        "pptx-deck",
        "pdf-deliverable",
        "meeting-notes",
        "weekly-report",
    } <= builtin
    assert {"internal-comms", "theme-factory", "skill-creator"} <= builtin
    # Vendored third-party skills must carry a redistribution-friendly license file.
    for name in ("internal-comms", "theme-factory", "skill-creator"):
        skill = loader.get_any(name)
        assert (Path(skill.path) / "LICENSE.txt").is_file()


def test_skill_loader_catalog_and_load(tmp_path):
    skills_dir = tmp_path / "skills"
    _make_skill(
        skills_dir, "pdf", "extract text from PDFs", "Use pdfplumber to extract text."
    )
    loader = SkillLoader([skills_dir])

    assert loader.catalog() == [
        {"name": "pdf", "description": "extract text from PDFs"}
    ]
    assert "pdf: extract text from PDFs" in skill_catalog_text(loader)

    reg = ToolRegistry()
    reg.register_all(skill_tools(loader))
    loaded = reg.execute("load_skill", {"name": "pdf"})
    assert "pdfplumber" in loaded["instructions"]
    assert reg.execute("load_skill", {"name": "missing"})["error"]


# -- engine assembly per agent --------------------------------------------------


def test_build_engine_chat(tmp_path):
    engine = build_engine(agent=chat_agent(), provider=_Stub())
    assert "load_skill" in engine.registry.names()
    assert "read_file" not in engine.registry.names()
    assert engine.executor is None
    assert engine.agent_name == "chat"


def test_build_engine_code_has_agents_md_and_skills(tmp_path):
    (tmp_path / "AGENTS.md").write_text("PROJECT RULE: prefer pathlib.")
    engine = build_engine(agent=code_agent(), workspace=tmp_path, provider=_Stub())
    try:
        assert "prefer pathlib" in engine.messages[0]["content"]
        assert "todo_write" in engine.registry.names()
        assert "load_skill" in engine.registry.names()
        assert engine.agent_name == "code"
    finally:
        engine.executor.close()
