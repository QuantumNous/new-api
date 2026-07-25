"""Phase 1 gate — a session is born from exactly one persona; pin + rename persist.

The persona binding rides on the existing ``SessionRecord.agent`` column (immutable in
practice — ``get_engine`` always rebuilds from it). Pin = ``pinned`` flag; rename = ``title``.
"""

from __future__ import annotations

from coworker.conversations import ConversationStore
from coworker.sessions import SessionRecord


def _store(tmp_path) -> ConversationStore:
    return ConversationStore(tmp_path)


def test_session_records_its_persona(tmp_path):
    store = _store(tmp_path)
    store.save(
        SessionRecord(
            session_id="s1",
            workspace=str(tmp_path),
            model="gpt-5.5",
            mode="interactive",
            agent="ops",
        )
    )
    loaded = store.load("s1")
    assert loaded is not None and loaded.agent == "ops"


def test_persona_binding_is_stable_across_reload(tmp_path):
    store = _store(tmp_path)
    store.save(
        SessionRecord(
            session_id="s2",
            workspace=str(tmp_path),
            model="gpt-5.5",
            mode="interactive",
            agent="code",
        )
    )
    # A fresh store instance over the same dir still sees the original persona.
    assert _store(tmp_path).load("s2").agent == "code"


def test_pin_persists(tmp_path):
    store = _store(tmp_path)
    store.save(
        SessionRecord(
            session_id="s3",
            workspace=str(tmp_path),
            model="gpt-5.5",
            mode="interactive",
            agent="ops",
        )
    )
    assert store.set_flags("s3", pinned=True)
    assert store.load("s3").pinned is True


def test_rename_persists(tmp_path):
    store = _store(tmp_path)
    store.save(
        SessionRecord(
            session_id="s4",
            workspace=str(tmp_path),
            model="gpt-5.5",
            mode="interactive",
            agent="ops",
        )
    )
    assert store.rename("s4", "Release Captain")
    assert store.load("s4").title == "Release Captain"
