"""Phase 1 gate — persona manifest parsing + validation."""

from __future__ import annotations

import pytest

from coworker.personas.manifest import ManifestError, parse_manifest

VALID = """---
id: demo
name: Demo Coworker
icon: demo
tagline: A demo
family: knowledge
workspace: deliverable
tools: [files, search, shell, todo]
messaging: true
connectors: true
recommended_models: [anthropic:claude-opus-4-8]
default_permission_mode: interactive
---
You are a demo coworker. Do helpful things.
"""


def test_parse_valid():
    m = parse_manifest(VALID)
    assert m.id == "demo" and m.name == "Demo Coworker"
    assert m.tools == ["files", "search", "shell", "todo"]
    assert m.family == "knowledge" and m.workspace == "deliverable"
    assert m.messaging is True and m.connectors is True
    assert m.recommended_models == ["anthropic:claude-opus-4-8"]
    assert m.needs_workspace is True
    assert m.system_prompt.startswith("You are a demo coworker")


def test_to_agent_carries_traits_and_tools(tmp_path):
    from coworker.agents.base import AgentContext
    from coworker.tools.todo import TodoList

    agent = parse_manifest(VALID).to_agent()
    assert agent.name == "demo" and agent.family == "knowledge"
    assert agent.messaging and agent.connectors
    ctx = AgentContext(workspace=tmp_path, executor=object(), todo=TodoList())
    names = {getattr(t, "__name__", "") for t in agent.build_tools(ctx)}
    assert {"read_file", "grep", "run_shell", "todo_write"} <= names


def test_list_field_accepts_comma_string():
    text = VALID.replace("tools: [files, search, shell, todo]", "tools: files, search")
    assert parse_manifest(text).tools == ["files", "search"]


def test_workspace_key_is_accepted_but_derived_from_family():
    # §16 collapse: the old enum still parses (back-compat + typo detection) but behavior
    # derives from family — knowledge → scratch ("deliverable"), code → "git". A manifest
    # can no longer demand a folder gate (`project`) or opt out of a workspace (`none`).
    text = """---
id: opsy
workspace: project
tools: [files, search, shell, todo]
---
Operate things.
"""
    m = parse_manifest(text)
    assert m.workspace == "deliverable" and m.needs_workspace is True

    coded = parse_manifest(
        "---\nid: dev\nfamily: code\nworkspace: none\ntools: [git]\n---\nCode."
    )
    assert coded.workspace == "git" and coded.needs_workspace is True


@pytest.mark.parametrize(
    "text,needle",
    [
        ("no frontmatter here", "frontmatter"),
        ("---\nid: x\ntools: [files]\n", "unterminated"),
        ("---\nname: x\n---\nbody", "id"),
        ("---\nid: x\ntools: [files]\n---\n", "no body"),
        ("---\nid: x\ntools: [nope]\n---\nbody", "unknown tool"),
        ("---\nid: x\nfamily: alien\ntools: []\n---\nbody", "family"),
        ("---\nid: x\nworkspace: cloud\ntools: []\n---\nbody", "workspace"),
        (
            "---\nid: x\ndefault_permission_mode: yolo\ntools: []\n---\nbody",
            "permission",
        ),
    ],
)
def test_invalid_manifests_rejected(text, needle):
    with pytest.raises(ManifestError) as e:
        parse_manifest(text)
    assert needle in str(e.value).lower()


def test_fallback_id_from_filename():
    m = parse_manifest("---\nname: X\ntools: []\n---\nbody", fallback_id="ops")
    assert m.id == "ops"


# Ids become directory names under the managed install area (snapshot on install, rmtree on
# uninstall), so hostile or merely unlucky ids must be rejected at parse time: `..`/slashes
# would escape the install dir; `:*?"<>|` are invalid filename chars on Windows.
@pytest.mark.parametrize(
    "bad_id",
    ["../../evil", "a/b", "a\\b", "sales:v2", "up*", "..", "A", "-lead", "x" * 65],
)
def test_unsafe_explicit_ids_rejected(bad_id):
    with pytest.raises(ManifestError) as e:
        parse_manifest(f"---\nid: {bad_id!r}\ntools: []\n---\nbody")
    assert "invalid" in str(e.value)


def test_fallback_id_is_slugified_not_rejected():
    # A filename like "My Persona.md" (no explicit id) installs as a safe slug.
    m = parse_manifest("---\nname: X\ntools: []\n---\nbody", fallback_id="My Persona")
    assert m.id == "my-persona"
    with pytest.raises(ManifestError):  # nothing salvageable in the stem
        parse_manifest("---\nname: X\ntools: []\n---\nbody", fallback_id="..")


REC = """---
id: ops
tools: []
recommends:
  - connector: github
    reason: confirm deploys
    tier: core
  - mcp: filesystem
    reason: read runbooks
---
body
"""


def test_recommends_parsed():
    recs = parse_manifest(REC).recommends
    assert [(r.kind, r.ref, r.tier) for r in recs] == [
        ("connector", "github", "core"),
        ("mcp", "filesystem", "optional"),  # tier defaults to optional
    ]
    assert recs[0].reason == "confirm deploys"


def test_recommends_not_validated_against_shipped_connectors():
    # A persona may recommend a connector we don't ship yet — structure only, no catalog check.
    recs = parse_manifest(
        "---\nid: x\ntools: []\nrecommends:\n  - connector: not_a_real_connector\n---\nbody"
    ).recommends
    assert recs[0].ref == "not_a_real_connector"


@pytest.mark.parametrize(
    "text,needle",
    [
        ("---\nid: x\ntools: []\nrecommends: nope\n---\nbody", "must be a list"),
        ("---\nid: x\ntools: []\nrecommends:\n  - reason: hi\n---\nbody", "connector"),
        (
            "---\nid: x\ntools: []\nrecommends:\n  - connector: gh\n    tier: maybe\n---\nbody",
            "tier",
        ),
    ],
)
def test_invalid_recommends_rejected(text, needle):
    with pytest.raises(ManifestError) as e:
        parse_manifest(text)
    assert needle in str(e.value).lower()
