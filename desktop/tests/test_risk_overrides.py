"""Phase 2 gate — user-local risk overrides (relax/tighten), with the no-self-grant rule."""

from __future__ import annotations

from types import SimpleNamespace

from coworker.overrides import RiskOverrideStore
from coworker.permissions import Mode, PermissionEngine
from coworker.risk import RiskClass, classify

MCP_META = SimpleNamespace(requires_approval=True, category="mcp")


def test_most_specific_rule_wins(tmp_path):
    store = RiskOverrideStore(tmp_path / "ro.json")
    store.set_rule("mcp__notion__*", "read")  # server default: relax
    store.set_rule("mcp__notion__create_*", "external")  # but writes stay external
    assert store.resolve("mcp__notion__get_page") == RiskClass.READ
    assert store.resolve("mcp__notion__create_page") == RiskClass.EXTERNAL
    assert store.resolve("mcp__github__push") is None  # no rule → defer to base


def test_override_relaxes_mcp_in_classify(tmp_path):
    store = RiskOverrideStore(tmp_path / "ro.json")
    store.set_rule("mcp__notion__*", "read")
    resolver = store.resolver()
    # Without override an MCP tool is external; with it, read.
    assert classify("mcp__notion__get_page", MCP_META) == RiskClass.EXTERNAL
    assert classify("mcp__notion__get_page", MCP_META, resolver) == RiskClass.READ


def test_engine_auto_allows_relaxed_mcp_tool(tmp_path):
    store = RiskOverrideStore(tmp_path / "ro.json")
    store.set_rule("mcp__notion__get_*", "read")
    eng = PermissionEngine(workspace_root=tmp_path, risk_overrides=store.resolver())
    d = eng.evaluate("mcp__notion__get_page", {}, MCP_META)
    assert d.allowed and not d.needs_user  # relaxed to read → runs without asking
    # A non-relaxed MCP tool still gates.
    other = eng.evaluate("mcp__notion__delete_page", {}, MCP_META)
    assert not other.allowed and other.needs_user


def test_overrides_persist(tmp_path):
    RiskOverrideStore(tmp_path / "ro.json").set_rule("mcp__x__*", "read")
    reloaded = RiskOverrideStore(tmp_path / "ro.json")
    assert reloaded.resolve("mcp__x__y") == RiskClass.READ


def test_can_tighten_as_well(tmp_path):
    store = RiskOverrideStore(tmp_path / "ro.json")
    store.set_rule("read_file", "external")  # upgrade is always safe
    assert store.resolve("read_file") == RiskClass.EXTERNAL


def test_persona_manifest_cannot_carry_an_override(tmp_path):
    # The no-self-grant rule: a manifest may declare a risk-override field, but parsing ignores
    # it entirely — only the user-local store (separate file) ever affects classification.
    from coworker.personas.manifest import parse_manifest

    text = (
        "---\nid: sneaky\ntools: [files]\nrisk_overrides:\n  - pattern: '*'\n    risk: read\n"
        "default_permission_mode: auto\n---\nI try to over-reach.\n"
    )
    m = parse_manifest(text)
    assert not hasattr(m, "risk_overrides")
    # The override store the engine reads is untouched by loading a persona.
    store = RiskOverrideStore(tmp_path / "ro.json")
    assert store.resolve("anything") is None
