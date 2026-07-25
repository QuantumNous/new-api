"""Tests for image/text attachments.

Layered: (1) the pure content builder, (2) the pass-through assumption — an image attachment
reaches the provider's `messages` byte-for-byte unmodified (a spy provider, no network),
(3) persistence of list-content messages, and (4) an OPT-IN live vision call that proves the
model actually reads the image (`COWORKER_LIVE_VISION=1`, key read from the SecretStore).
"""

from __future__ import annotations

import base64
import os
import struct
import zlib

import pytest

from coworker.attachments import build_user_content, content_to_text


# -- a tiny solid-color PNG (stdlib) so tests need no fixtures -------------------
def _solid_png(r: int, g: int, b: int, size: int = 32) -> bytes:
    raw = bytearray()
    row = bytes((r, g, b)) * size
    for _ in range(size):
        raw.append(0)
        raw.extend(row)

    def chunk(typ: bytes, data: bytes) -> bytes:
        c = typ + data
        return (
            struct.pack(">I", len(data))
            + c
            + struct.pack(">I", zlib.crc32(c) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(
            b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
        )  # 8-bit RGB
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def _data_url(r: int, g: int, b: int) -> str:
    return "data:image/png;base64," + base64.b64encode(_solid_png(r, g, b)).decode()


# -- (1) builder ----------------------------------------------------------------
def test_no_attachments_returns_plain_string():
    assert build_user_content("hello", []) == "hello"
    assert build_user_content("hello", None) == "hello"


def test_image_attachment_becomes_image_url_part():
    url = _data_url(220, 30, 30)
    content = build_user_content("what is this?", [{"kind": "image", "data_url": url}])
    assert isinstance(content, list)
    assert content[0] == {"type": "text", "text": "what is this?"}
    assert content[1] == {"type": "image_url", "image_url": {"url": url}}


def test_text_attachment_is_inlined():
    content = build_user_content(
        "", [{"kind": "text", "name": "notes.md", "text": "# Title\nbody"}]
    )
    assert isinstance(content, list)
    assert (
        content[0]["type"] == "text"
        and "notes.md" in content[0]["text"]
        and "# Title" in content[0]["text"]
    )


def test_invalid_and_oversized_attachments_are_skipped():
    bad = [
        {"kind": "image", "data_url": "https://example.com/x.png"},  # not a data: URL
        {
            "kind": "image",
            "data_url": "data:image/png;base64," + "A" * 12_000_001,
        },  # too big
        {"kind": "text", "text": ""},  # empty
    ]
    # only the leading text survives → falls back to the plain string
    assert build_user_content("hi", bad) == "hi"


def test_content_to_text_flattens_parts():
    url = _data_url(0, 0, 0)
    parts = build_user_content("look at this", [{"kind": "image", "data_url": url}])
    assert content_to_text(parts) == "look at this [image]"
    assert content_to_text("plain") == "plain"


# -- (2) the assumption: image reaches the provider unmodified ------------------
async def test_image_reaches_provider_unmodified():
    from coworker.agents.chat import chat_agent
    from coworker.agent import build_engine
    from coworker.providers import AssistantTurn, ModelCapabilities, ProviderClient

    class Spy(ProviderClient):
        def __init__(self):
            self.captured = None

        def complete(self, *, model, messages, tools=None, **settings):
            self.captured = [dict(m) for m in messages]
            return AssistantTurn(text="ok", finish_reason="stop")

        def capabilities(self, model):
            return ModelCapabilities(vision=True)

    spy = Spy()
    engine = build_engine(agent=chat_agent(), model="gpt-4o", provider=spy)
    url = _data_url(220, 30, 30)
    content = build_user_content(
        "describe the image", [{"kind": "image", "data_url": url}]
    )

    async for _ in engine.run(content):
        pass

    user_msgs = [m for m in (spy.captured or []) if m.get("role") == "user"]
    assert user_msgs, "no user message reached the provider"
    parts = user_msgs[-1]["content"]
    assert isinstance(parts, list)
    images = [p for p in parts if p.get("type") == "image_url"]
    assert images and images[0]["image_url"]["url"] == url  # byte-for-byte intact


# -- (3) persistence of list-content messages ----------------------------------
def test_list_content_message_persists_and_titles(tmp_path):
    from coworker.conversations import ConversationStore, title_from
    from coworker.sessions import SessionRecord

    url = _data_url(0, 128, 0)
    msgs = [
        {
            "role": "user",
            "content": build_user_content(
                "review this diagram", [{"kind": "image", "data_url": url}]
            ),
        }
    ]
    store = ConversationStore(tmp_path)
    rec = SessionRecord(
        session_id="s1",
        workspace=str(tmp_path),
        model="gpt-4o",
        mode="interactive",
        messages=msgs,
        agent="chat",
    )
    store.save(rec)
    loaded = store.load("s1")
    # the image survives the round-trip, and the title comes from the text part
    assert loaded.messages[0]["content"][1]["image_url"]["url"] == url
    assert title_from(msgs) == "review this diagram"


# -- (4) live vision (opt-in) --------------------------------------------------
@pytest.mark.skipif(
    os.environ.get("COWORKER_LIVE_VISION") != "1",
    reason="opt-in: real OpenAI vision call (set COWORKER_LIVE_VISION=1)",
)
def test_live_vision_model_reads_image():
    from coworker.providers import OpenAIProvider
    from coworker.secrets import SecretStore

    provider = OpenAIProvider(default_model="gpt-4o", secrets=SecretStore())
    content = build_user_content(
        "What is the single dominant color of this image? Reply with one word.",
        [{"kind": "image", "data_url": _data_url(220, 30, 30)}],
    )
    turn = provider.complete(
        model="gpt-4o", messages=[{"role": "user", "content": content}]
    )
    assert "red" in (turn.text or "").lower(), f"model said: {turn.text!r}"


def test_pdf_attachment_becomes_file_part():
    url = "data:application/pdf;base64,JVBERi0xLjQ="
    content = build_user_content(
        "summarize this", [{"kind": "pdf", "name": "report.pdf", "data_url": url}]
    )
    assert content == [
        {"type": "text", "text": "summarize this"},
        {"type": "file", "file": {"filename": "report.pdf", "file_data": url}},
    ]


def test_pdf_attachment_invalid_or_oversized_skipped():
    from coworker.attachments import MAX_PDF_CHARS

    bad = [
        {"kind": "pdf", "name": "x.pdf", "data_url": "data:image/png;base64,zz"},
        {"kind": "pdf", "name": "x.pdf"},
        {
            "kind": "pdf",
            "name": "big.pdf",
            "data_url": "data:application/pdf;base64," + "A" * MAX_PDF_CHARS,
        },
    ]
    assert build_user_content("hi", bad) == "hi"


def test_content_to_text_renders_pdf_placeholder():
    parts = [
        {"type": "text", "text": "see attached"},
        {
            "type": "file",
            "file": {
                "filename": "report.pdf",
                "file_data": "data:application/pdf;base64,x",
            },
        },
    ]
    assert content_to_text(parts) == "see attached [pdf]"
    assert content_to_text(parts, image_placeholder="") == "see attached"
