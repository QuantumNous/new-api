"""Skill installation (folder / GitHub / marketplace) + the skills REST surface."""

from __future__ import annotations

import os

import pytest
from fastapi.testclient import TestClient

from coworker.providers import ModelCapabilities, ProviderClient
from coworker.server import SessionManager, create_app
from coworker.skills import SkillLoader
from coworker.skills import market
from coworker.skills.install import (
    SkillInstallError,
    delete_skill,
    global_skills_dir,
    install_from_path,
)
from coworker.skills.market import MarketError, locate_skill_dir, parse_repo_ref


class _Stub(ProviderClient):
    def complete(self, **kwargs):  # pragma: no cover
        raise NotImplementedError

    def capabilities(self, model):
        return ModelCapabilities()


def _skill_folder(root, name="pdf-notes", description="summarize PDFs", extra=None):
    d = root / name
    d.mkdir(parents=True)
    (d / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: {description}\n---\nInstructions.",
        encoding="utf-8",
    )
    for rel in extra or []:
        p = d / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("x", encoding="utf-8")
    return d


# -- install_from_path ----------------------------------------------------------


def test_install_from_path_copies_into_global_tier(tmp_path):
    src = _skill_folder(tmp_path, extra=["scripts/run.py", "references/a.md"])
    out = install_from_path(src)
    assert out["name"] == "pdf-notes"
    assert out["source"] == "global"
    assert out["has_scripts"] is True
    installed = global_skills_dir() / "pdf-notes"
    assert (installed / "SKILL.md").is_file()
    assert (installed / "scripts" / "run.py").is_file()
    assert SkillLoader.standard().get("pdf-notes").description == "summarize PDFs"


def test_install_rejects_missing_manifest_and_description(tmp_path):
    empty = tmp_path / "empty"
    empty.mkdir()
    with pytest.raises(SkillInstallError, match="no SKILL.md"):
        install_from_path(empty)

    bare = tmp_path / "bare"
    bare.mkdir()
    (bare / "SKILL.md").write_text("---\nname: bare\n---\nBody.", encoding="utf-8")
    with pytest.raises(SkillInstallError, match="description"):
        install_from_path(bare)


@pytest.mark.skipif(os.name == "nt", reason="symlink creation needs privileges")
def test_install_rejects_symlinks(tmp_path):
    src = _skill_folder(tmp_path)
    (src / "link").symlink_to(tmp_path / "outside")
    with pytest.raises(SkillInstallError, match="symlink"):
        install_from_path(src)


def test_install_rejects_unsafe_frontmatter_name(tmp_path):
    src = tmp_path / "evil"
    src.mkdir()
    (src / "SKILL.md").write_text(
        "---\nname: ../escape\ndescription: nope\n---\nBody.", encoding="utf-8"
    )
    with pytest.raises(SkillInstallError, match="invalid skill name"):
        install_from_path(src)


def test_install_duplicate_requires_overwrite(tmp_path):
    src = _skill_folder(tmp_path)
    install_from_path(src)
    with pytest.raises(SkillInstallError, match="already installed"):
        install_from_path(src)
    out = install_from_path(src, overwrite=True)
    assert out["name"] == "pdf-notes"


def test_delete_skill_global_only(tmp_path):
    src = _skill_folder(tmp_path)
    install_from_path(src)
    assert delete_skill("pdf-notes") is True
    assert delete_skill("pdf-notes") is False
    assert not (global_skills_dir() / "pdf-notes").exists()


# -- GitHub / marketplace resolution (no network) -------------------------------


def test_parse_repo_ref_variants():
    assert parse_repo_ref("anthropics/skills") == ("anthropics/skills", "HEAD", None)
    assert parse_repo_ref("https://github.com/anthropics/skills") == (
        "anthropics/skills",
        "HEAD",
        None,
    )
    assert parse_repo_ref("https://github.com/anthropics/skills/tree/main/skills/pdf") == (
        "anthropics/skills",
        "main",
        "skills/pdf",
    )
    with pytest.raises(MarketError):
        parse_repo_ref("not-a-repo")


def _tree(*paths):
    return [{"path": p, "type": "blob", "mode": "100644", "size": 10} for p in paths]


def test_locate_skill_dir_by_subdir_id_and_single():
    tree = _tree("skills/pdf/SKILL.md", "skills/docx/SKILL.md", "README.md")
    assert locate_skill_dir(tree, skill_id=None, subdir="skills/pdf") == "skills/pdf"
    assert locate_skill_dir(tree, skill_id="docx", subdir=None) == "skills/docx"
    with pytest.raises(MarketError, match="multiple skills"):
        locate_skill_dir(tree, skill_id=None, subdir=None)
    with pytest.raises(MarketError, match="not found"):
        locate_skill_dir(tree, skill_id="nope", subdir=None)
    only = _tree("one/SKILL.md")
    assert locate_skill_dir(only, skill_id=None, subdir=None) == "one"


def test_fetch_skill_files_filters_symlinks_and_caps(monkeypatch):
    tree = [
        {"path": "s/SKILL.md", "type": "blob", "mode": "100644", "size": 10},
        {"path": "s/link", "type": "blob", "mode": "120000", "size": 5},
    ]
    monkeypatch.setattr(market, "_repo_tree", lambda repo, ref: tree)

    class _Resp:
        status_code = 200
        content = b"---\nname: s\ndescription: d\n---\nBody."

    class _Client:
        def __init__(self, **kw):
            pass

        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

        def get(self, url):
            return _Resp()

    monkeypatch.setattr(market.httpx, "Client", _Client)
    files = market.fetch_skill_files("o/r", "HEAD", "s")
    assert [rel for rel, _ in files] == ["SKILL.md"]  # symlink entry skipped

    huge = [{"path": "s/big", "type": "blob", "mode": "100644", "size": 10**9}]
    monkeypatch.setattr(market, "_repo_tree", lambda repo, ref: huge)
    with pytest.raises(MarketError, match="too large"):
        market.fetch_skill_files("o/r", "HEAD", "s")


# -- REST contract --------------------------------------------------------------


def _client(tmp_path):
    manager = SessionManager(workspace=tmp_path, provider=_Stub())
    return TestClient(create_app(manager))


def test_skills_rest_crud(tmp_path, monkeypatch):
    client = _client(tmp_path)
    src = _skill_folder(tmp_path / "stage", name="meeting-notes", description="notes")

    installed = client.post(
        "/v1/skills/install", json={"source": "path", "path": str(src)}
    ).json()
    assert installed["ok"] is True
    assert installed["name"] == "meeting-notes"

    listed = client.get("/v1/skills").json()["skills"]
    row = next(s for s in listed if s["name"] == "meeting-notes")
    assert row["source"] == "global"
    assert row["enabled"] is True

    assert client.patch(
        "/v1/skills/meeting-notes", json={"enabled": False}
    ).json()["ok"]
    listed = client.get("/v1/skills").json()["skills"]
    assert next(s for s in listed if s["name"] == "meeting-notes")["enabled"] is False

    detail = client.get("/v1/skills/meeting-notes").json()
    assert detail["ok"] is True
    assert "Instructions." in detail["instructions"]

    assert client.delete("/v1/skills/meeting-notes").json()["ok"] is True
    assert client.delete("/v1/skills/meeting-notes").json()["ok"] is False

    bad = client.post("/v1/skills/install", json={"source": "nope"}).json()
    assert bad["ok"] is False


def test_skills_rest_search_proxies_market(tmp_path, monkeypatch):
    import coworker.skills.market as m

    monkeypatch.setattr(
        m,
        "search",
        lambda q, limit=10: [
            {
                "id": "anthropics/skills/pdf",
                "name": "pdf",
                "skill_id": "pdf",
                "source": "anthropics/skills",
                "installs": 165554,
            }
        ],
    )
    client = _client(tmp_path)
    res = client.get("/v1/skills/search", params={"q": "pdf"}).json()
    assert res["ok"] is True
    assert res["skills"][0]["source"] == "anthropics/skills"
    assert client.get("/v1/skills/search").json() == {"ok": True, "skills": []}


def test_recommended_skills_are_installable_and_drop_out_once_installed(tmp_path):
    from coworker.skills.recommend import RECOMMENDED

    client = _client(tmp_path)
    rows = client.get("/v1/skills/recommended").json()["skills"]
    assert [r["name"] for r in rows] == [r["name"] for r in RECOMMENDED]
    # Every entry carries what the one-click install needs, and nothing proprietary.
    assert all(r["url"] and r["subdir"] and r["license"] == "Apache-2.0" for r in rows)
    assert not {r["name"] for r in rows} & {"docx", "pdf", "pptx", "xlsx"}
    assert all(r["installed"] is False for r in rows)

    first = rows[0]["name"]
    install_from_path(_skill_folder(tmp_path / "stage", name=first, description="d"))
    after = {r["name"]: r["installed"] for r in client.get("/v1/skills/recommended").json()["skills"]}
    assert after[first] is True
    delete_skill(first)
