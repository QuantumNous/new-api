"""Phase 2 gate — third-party persona loading (dir + git URL) and install-time consent."""

from __future__ import annotations

import pytest

from coworker.personas.loading import consent_summary
from coworker.personas.manifest import ManifestError, parse_manifest
from coworker.personas.registry import PersonaRegistry

THIRD_PARTY = """---
id: acme-ops
name: Acme Ops Coworker
icon: ops
tagline: Acme's ops worker
family: knowledge
workspace: deliverable
tools: [files, search, shell, todo]
connectors: true
mcp: [acme-pager]
recommended_models: [anthropic:claude-opus-4-8]
default_permission_mode: interactive
---
You are Acme's ops coworker.
"""


def _persona_dir(tmp_path, name="acme.md", text=THIRD_PARTY):
    d = tmp_path / "vendor"
    d.mkdir(exist_ok=True)
    (d / name).write_text(text, encoding="utf-8")
    return d


def test_consent_summary_lists_capabilities():
    m = parse_manifest(THIRD_PARTY)
    s = consent_summary(m)
    assert s["tools"] == ["files", "search", "shell", "todo"]
    assert set(s["risk"]) == {"read", "write_local", "exec"}
    assert s["connectors"] is True and s["mcp"] == ["acme-pager"]
    assert s["recommended_mode"] == "interactive"


def test_install_from_dir_lands_disabled_pending_consent(tmp_path):
    reg = PersonaRegistry(state_path=tmp_path / "personas.json")
    summaries = reg.install_from_dir(_persona_dir(tmp_path))
    assert [s["id"] for s in summaries] == ["acme-ops"]
    # Installed but NOT enabled / surfaced until the user approves.
    assert "acme-ops" in reg.ids()
    assert reg.is_enabled("acme-ops") is False
    assert reg.is_surfaced("acme-ops") is False
    assert "acme-ops" not in [e["name"] for e in reg.sidebar()]
    # The user approves → enable + surface.
    reg.set_enabled("acme-ops", True)
    reg.set_surfaced("acme-ops", True)
    assert "acme-ops" in [e["name"] for e in reg.sidebar()]
    assert reg.agent("acme-ops").family == "knowledge"


def test_installed_persona_persists_across_restart(tmp_path):
    reg = PersonaRegistry(state_path=tmp_path / "personas.json")
    reg.install_from_dir(_persona_dir(tmp_path))
    reg.set_enabled("acme-ops", True)
    # A fresh registry reloads the installed persona (source persisted) + its state.
    reg2 = PersonaRegistry(state_path=tmp_path / "personas.json")
    assert "acme-ops" in reg2.ids() and reg2.is_enabled("acme-ops")


def test_install_from_git_uses_injected_clone(tmp_path):
    reg = PersonaRegistry(state_path=tmp_path / "personas.json")

    def fake_clone(url, dest):
        dest.mkdir(parents=True, exist_ok=True)
        (dest / "acme.md").write_text(THIRD_PARTY, encoding="utf-8")

    summaries = reg.install_from_git(
        "https://example.com/acme/persona.git",
        cache_base=tmp_path / "cache",
        clone=fake_clone,
    )
    assert [s["id"] for s in summaries] == ["acme-ops"]
    assert "acme-ops" in reg.ids()


def test_invalid_third_party_manifest_fails_loud(tmp_path):
    bad = "---\nid: broken\ntools: [does_not_exist]\n---\nbody\n"
    reg = PersonaRegistry(state_path=tmp_path / "personas.json")
    with pytest.raises(ManifestError):
        reg.install_from_dir(_persona_dir(tmp_path, name="broken.md", text=bad))


def test_uninstall_removes_entry_state_and_snapshot(tmp_path):
    reg = PersonaRegistry(state_path=tmp_path / "personas.json")
    reg.install_from_dir(_persona_dir(tmp_path))
    reg.set_enabled("acme-ops", True)
    snap = reg.installed_dir / "acme-ops"
    assert snap.is_dir()

    reg.uninstall("acme-ops")
    assert "acme-ops" not in reg.ids()
    assert not snap.exists()
    # Gone for good — a fresh registry must not resurrect it from the snapshot area.
    reg2 = PersonaRegistry(state_path=tmp_path / "personas.json")
    assert "acme-ops" not in reg2.ids()


def test_uninstall_default_falls_back_to_cowork(tmp_path):
    reg = PersonaRegistry(state_path=tmp_path / "personas.json")
    reg.install_from_dir(_persona_dir(tmp_path))
    reg.set_default("acme-ops")
    reg.uninstall("acme-ops")
    assert reg.default_id() == "cowork"


def test_uninstall_refuses_builtins_and_unknown(tmp_path):
    reg = PersonaRegistry(state_path=tmp_path / "personas.json")
    with pytest.raises(ValueError):
        reg.uninstall("cowork")
    with pytest.raises(KeyError):
        reg.uninstall("ghost")


def test_install_snapshots_independently_of_source(tmp_path):
    # The snapshot must survive the user deleting/moving their source dir.
    import shutil

    reg = PersonaRegistry(state_path=tmp_path / "personas.json")
    src = _persona_dir(tmp_path)
    reg.install_from_dir(src)
    reg.set_enabled("acme-ops", True)
    shutil.rmtree(src)  # source gone
    reg2 = PersonaRegistry(state_path=tmp_path / "personas.json")
    assert "acme-ops" in reg2.ids() and reg2.is_enabled("acme-ops")
    assert reg2.agent("acme-ops").family == "knowledge"
