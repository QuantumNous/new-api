"""Prompt-caching breakpoints on the Anthropic provider (OPE-42 follow-up).

The provider opts every request into 5-minute ephemeral caching: one breakpoint on
the last system block (tools + system) and one on the final message's last content
block (conversation prefix). Outbound-only — persisted history stays clean.
"""

from __future__ import annotations

from coworker.providers.anthropic_provider import AnthropicProvider

MARKER = {"type": "ephemeral"}


def _kwargs(messages, tools=None):
    return AnthropicProvider(client=object())._request_kwargs(
        model="claude-haiku-4-5", messages=messages, tools=tools, settings={}
    )


def test_system_becomes_cached_block_list():
    kwargs = _kwargs(
        [
            {"role": "system", "content": "be terse"},
            {"role": "user", "content": "hi"},
        ]
    )
    assert kwargs["system"] == [
        {"type": "text", "text": "be terse", "cache_control": MARKER}
    ]


def test_last_message_last_block_carries_breakpoint():
    kwargs = _kwargs(
        [
            {"role": "user", "content": "first"},
            {"role": "assistant", "content": "reply"},
            {"role": "user", "content": "second"},
        ]
    )
    messages = kwargs["messages"]
    assert messages[-1]["content"][-1]["cache_control"] == MARKER
    # Only the FINAL message is marked — earlier turns stay unmarked so the
    # prefix bytes match the previous request's cache.
    for message in messages[:-1]:
        assert all("cache_control" not in b for b in message["content"])


def test_tool_result_last_block_carries_breakpoint():
    kwargs = _kwargs(
        [
            {"role": "user", "content": "run it"},
            {
                "role": "assistant",
                "content": "",
                "tool_calls": [
                    {
                        "id": "t1",
                        "type": "function",
                        "function": {"name": "ls", "arguments": "{}"},
                    }
                ],
            },
            {"role": "tool", "tool_call_id": "t1", "content": "README.md"},
        ]
    )
    last = kwargs["messages"][-1]["content"][-1]
    assert last["type"] == "tool_result"
    assert last["cache_control"] == MARKER


def test_persisted_history_is_never_mutated():
    history = [
        {"role": "system", "content": "be terse"},
        {"role": "user", "content": "hi"},
    ]
    _kwargs(history)
    assert history == [
        {"role": "system", "content": "be terse"},
        {"role": "user", "content": "hi"},
    ]


def test_no_system_prompt_is_fine():
    kwargs = _kwargs([{"role": "user", "content": "hi"}])
    assert "system" not in kwargs
    assert kwargs["messages"][-1]["content"][-1]["cache_control"] == MARKER
