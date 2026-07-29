"""OPE-27 smoke (4/4) — a long multi-turn session driven through the real SessionManager
across REPEATED forced compactions: the provider must actually receive the compacted
view (summary block + verbatim tail), user intent must survive every compaction, and the
state must survive a save/rebuild mid-conversation. This is the scripted stand-in for
the live-model smoke (which needs a configured provider key)."""

import json

import asyncio

from coworker.providers import AssistantTurn, ModelCapabilities, ProviderClient
from coworker.providers.base import TokenUsage
from coworker.server.manager import SessionManager

BULK = "analysis paragraph " * 400  # ~7.6k chars (~1.9k tokens) per turn → triggers by turn 2


class LongSessionProvider(ProviderClient):
    """Main turns: bulky text answers with realistic (growing) usage reporting.
    Summarizer turns: a structured summary echoing the required sections."""

    def __init__(self):
        self.main_messages_seen: list[list[dict]] = []
        self.summary_prompts: list[str] = []

    def complete(self, *, model, messages, tools=None, **settings):
        if messages and "compacting an AI coworker" in str(
            messages[0].get("content", "")
        ):
            self.summary_prompts.append(str(messages[1]["content"]))
            return AssistantTurn(
                text=(
                    "## Primary request and intent\nBuild the Q3 report; never email "
                    "it without approval.\n## Current work\nDrafting section "
                    f"{len(self.summary_prompts)}.\n## Next step\nContinue drafting."
                ),
                finish_reason="stop",
            )
        self.main_messages_seen.append([dict(m) for m in messages])
        # Usage mirrors the outbound size (chars/4), like a real provider would bill it.
        prompt_tokens = sum(len(json.dumps(m, default=str)) for m in messages) // 4
        return AssistantTurn(
            text=f"turn {len(self.main_messages_seen)}: {BULK}",
            finish_reason="stop",
            usage=TokenUsage(input=prompt_tokens, output=500),
        )

    def capabilities(self, model):
        return ModelCapabilities()


def test_long_session_survives_repeated_compaction(tmp_path):
    provider = LongSessionProvider()
    mgr = SessionManager(workspace=tmp_path, provider=provider)
    # Force tiny windows straight through the real Settings plumbing.
    mgr._prefs["compaction_cap_tokens"] = 3_000
    sid = "smoke-long"

    boundaries = []

    # ONE event loop for the whole session, like the real server — the engine's asyncio
    # primitives bind to the loop they first run on, so a per-turn asyncio.run() would
    # silently drop every stream after the first (found the hard way in the live smoke).
    async def scenario():
        engine = mgr.get_engine(sid, agent="cowork", workspace=str(tmp_path))
        for i in range(8):
            async for _ in engine.run(f"user step {i}: keep drafting the Q3 report"):
                pass
            # Every turn must produce a real reply — an empty assistant message means
            # the stream got dropped, not answered.
            last = next(
                m for m in reversed(engine.messages) if m.get("role") == "assistant"
            )
            assert f"turn {i + 1}:" in str(last.get("content", ""))
            if engine.compaction_state is not None:
                if (
                    not boundaries
                    or engine.compaction_state.boundary_index != boundaries[-1]
                ):
                    boundaries.append(engine.compaction_state.boundary_index)
            mgr.save(sid, engine)
            if i == 4:  # mid-conversation restart: state must survive the rebuild
                mgr._engines.pop(sid)
                engine = mgr.get_engine(sid, agent="cowork", workspace=str(tmp_path))
                assert engine.compaction_state is not None
        return engine

    engine = asyncio.run(scenario())

    # Repeated compaction actually happened, moving forward each time.
    assert len(boundaries) >= 2
    assert boundaries == sorted(boundaries)
    # Later summarizer calls fold the previous summary in (summary is message zero).
    assert any("previous compaction summary" in p for p in provider.summary_prompts)

    # What the MODEL actually received after the last compaction: the block + the tail,
    # bounded — not the whole ever-growing canonical history.
    final_view = provider.main_messages_seen[-1]
    assert final_view[0]["role"] == "system"
    block = final_view[1]["content"]
    assert "<compacted-history>" in block
    assert "Q3 report" in block  # the summary carries the intent
    assert "user step 0" in block  # mechanical user-message preservation, from turn 0
    assert "do not recap" in block  # the continuation contract
    assert len(final_view) < len(engine.messages)

    # Canonical transcript: untouched (every turn still present) + the divider notices.
    texts = [str(m.get("content", "")) for m in engine.messages]
    assert all(any(f"user step {i}" in t for t in texts) for i in range(8))
    assert sum(1 for m in engine.messages if m.get("kind") == "compacted") >= 2

    # The persisted record round-trips the final state.
    record = mgr.session_store.load(sid)
    assert record.compaction["boundary_index"] == engine.compaction_state.boundary_index
