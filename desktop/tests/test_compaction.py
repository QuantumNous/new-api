"""OPE-27 — auto-compaction pure functions: trigger math, boundary picking, mechanical
extraction, summarizer seam, trim fallback, outbound view. No engine involved."""

import json

import pytest

from coworker.compaction import (
    CompactionState,
    DEFAULT_CAP_TOKENS,
    DEFAULT_CONTEXT_WINDOW,
    apply_to_outbound,
    build_state,
    compacted_block,
    estimate_tokens,
    extract_user_messages,
    extract_working_state,
    is_context_overflow,
    pick_boundary,
    should_compact,
    summarize_span,
    summarizer_messages,
    trigger_tokens,
    trim_state,
)


# -- message builders ---------------------------------------------------------


def user(text):
    return {"role": "user", "content": text, "ts": 1.0}


_call_seq = 0


def assistant(text="", tool_calls=None):
    global _call_seq
    msg = {"role": "assistant", "content": text, "ts": 1.0}
    if tool_calls:
        calls = []
        for name, args in tool_calls:
            calls.append(
                {
                    "id": f"c{_call_seq}",
                    "type": "function",
                    "function": {"name": name, "arguments": json.dumps(args)},
                }
            )
            _call_seq += 1
        msg["tool_calls"] = calls
    return msg


def tool(call_id, content):
    return {
        "role": "tool",
        "tool_call_id": call_id,
        "content": content if isinstance(content, str) else json.dumps(content),
        "ts": 1.0,
    }


def tool_turn(name, args, result):
    """[assistant tool-call, matching tool result] with a properly paired call id."""
    a = assistant(tool_calls=[(name, args)])
    return [a, tool(a["tool_calls"][0]["id"], result)]


def convo(turns=6, bulk=2000):
    """system + N user/assistant turns with bulky assistant text."""
    msgs = [{"role": "system", "content": "You are a coworker."}]
    for i in range(turns):
        msgs.append(user(f"request {i}"))
        msgs.append(assistant(f"answer {i} " + "x" * bulk))
    return msgs


class FakeSummarizer:
    def __init__(self, text="## Summary\nall good", fail_times=0):
        self.text = text
        self.fail_times = fail_times
        self.calls = []

    def complete(self, *, model, messages, tools=None, **settings):
        self.calls.append({"model": model, "messages": messages, "tools": tools, **settings})
        if self.fail_times > 0:
            self.fail_times -= 1
            raise RuntimeError("summarizer down")

        class Turn:
            pass

        t = Turn()
        t.text = self.text
        return t


# -- trigger math -------------------------------------------------------------


def test_trigger_is_min_of_pct_and_cap():
    assert trigger_tokens(100_000) == 80_000
    assert trigger_tokens(1_000_000) == DEFAULT_CAP_TOKENS  # the 250k cap wins
    assert trigger_tokens(None) == int(0.8 * DEFAULT_CONTEXT_WINDOW)
    # both knobs are user-overridable
    assert trigger_tokens(100_000, threshold_pct=0.5, cap_tokens=40_000) == 40_000
    assert trigger_tokens(100_000, threshold_pct=0.5, cap_tokens=999_999) == 50_000


def test_should_compact_crosses_threshold():
    assert not should_compact(79_999, 100_000)
    assert should_compact(80_000, 100_000)


def test_estimate_tokens_is_chars_over_four():
    msgs = [user("a" * 400)]
    est = estimate_tokens(msgs)
    assert 100 <= est <= 120  # 400 chars of content + json overhead, /4


# -- boundary -----------------------------------------------------------------


def test_boundary_prefers_earliest_user_turn_that_fits():
    msgs = convo(turns=6)
    per_turn = estimate_tokens(msgs[1:3])
    boundary = pick_boundary(msgs, keep_tokens=per_turn * 2 + 10)
    assert msgs[boundary]["role"] == "user"
    assert msgs[boundary]["content"] == "request 4"  # newest two turns survive


def test_boundary_falls_inside_a_giant_final_turn():
    # One user turn followed by a huge tool loop: the turn alone exceeds the budget,
    # so the cut lands on an assistant (iteration) boundary inside it — never a tool row.
    msgs = [{"role": "system", "content": "s"}, user("go")]
    for i in range(8):
        a = assistant("step " + "y" * 3000, tool_calls=[("run_shell", {"command": f"cmd{i}"})])
        msgs += [a, tool(a["tool_calls"][0]["id"], {"exit_code": 0, "out": "z" * 3000})]
    boundary = pick_boundary(msgs, keep_tokens=estimate_tokens(msgs[-3:]))
    assert msgs[boundary]["role"] == "assistant"


def test_boundary_none_when_nothing_to_summarize():
    msgs = [{"role": "system", "content": "s"}, user("hi"), assistant("hello")]
    assert pick_boundary(msgs, keep_tokens=10_000_000) is None


# -- mechanical extraction ----------------------------------------------------


def test_working_state_files_commands_tools():
    span = [
        user("write it"),
        *tool_turn("write_file", {"path": "a.py", "content": "x"}, {"ok": True}),
        *tool_turn("run_shell", {"command": "pytest -q"}, {"exit_code": 1}),
        *tool_turn("write_file", {"path": "b.py", "content": "y"}, {"ok": True}),
        *tool_turn("write_file", {"path": "a.py", "content": "x2"}, {"ok": True}),
    ]
    block = extract_working_state(span)
    # deduped, most recent first
    assert block.index("- a.py") < block.index("- b.py")
    assert block.count("a.py") == 1
    assert "pytest -q" in block and "[exit 1]" in block
    assert "run_shell" in block and "write_file" in block


def test_working_state_empty_span():
    assert extract_working_state([user("hi"), assistant("yo")]) == ""


def test_user_messages_extracted_verbatim_and_clipped():
    span = [
        user("first ask"),
        assistant("a"),
        user([{"type": "text", "text": "second"}, {"type": "image_url", "image_url": {}}]),
        assistant("b"),
        user("bulk " + "z" * 2000),
    ]
    out = extract_user_messages(span)
    assert out[0] == "first ask"
    assert out[1] == "second [image]"
    assert out[2].endswith("…") and len(out[2]) <= 600


# -- summarizer seam ----------------------------------------------------------


def test_summarizer_messages_clip_tool_results_and_fold_prior():
    span = [user("go"), *tool_turn("read_file", {"path": "big.txt"}, "huge " * 500)]
    msgs = summarizer_messages(span, prior_summary="OLD SUMMARY")
    body = msgs[1]["content"]
    assert "OLD SUMMARY" in body
    assert len(body) < 3000  # the 2500-char tool result got clipped hard
    assert msgs[0]["role"] == "system" and "Primary request and intent" in msgs[0]["content"]


def test_summarize_span_passes_model_and_raises_on_empty():
    fake = FakeSummarizer(text="## ok")
    out = summarize_span(fake, "prov:model-x", [user("hi")])
    assert out == "## ok"
    assert fake.calls[0]["model"] == "prov:model-x"
    assert fake.calls[0]["tools"] is None

    with pytest.raises(RuntimeError):
        summarize_span(FakeSummarizer(text="  "), "m", [user("hi")])


# -- build + repeated compaction ----------------------------------------------


def test_build_state_and_outbound_view():
    msgs = convo(turns=6)
    fake = FakeSummarizer(text="## Summary\nthe gist")
    state = build_state(
        msgs, provider=fake, model="m", keep_tokens=estimate_tokens(msgs[-4:]) + 10
    )
    assert state is not None and not state.trimmed
    assert state.user_messages[0] == "request 0"

    out = apply_to_outbound(msgs, state)
    assert out[0]["role"] == "system"  # instructions survive
    assert "<compacted-history>" in out[1]["content"]
    assert "the gist" in out[1]["content"]
    assert "request 0" in out[1]["content"]  # mechanical user-message list
    assert out[2] is msgs[state.boundary_index]  # verbatim tail, canonical untouched
    assert len(msgs) == 13  # canonical history unchanged


def test_repeated_compaction_summarizes_prior_plus_new_turns():
    msgs = convo(turns=4)
    fake = FakeSummarizer()
    first = build_state(msgs, provider=fake, model="m", keep_tokens=estimate_tokens(msgs[-4:]) + 10)
    # session grows
    for i in range(4, 8):
        msgs.append(user(f"request {i}"))
        msgs.append(assistant(f"answer {i} " + "x" * 2000))
    second = build_state(
        msgs, provider=fake, model="m",
        keep_tokens=estimate_tokens(msgs[-4:]) + 10, prior=first,
    )
    assert second is not None and second.boundary_index > first.boundary_index
    # the second summarizer call folds the prior summary in
    assert "previous compaction summary" in fake.calls[1]["messages"][1]["content"]
    # user messages accumulate across compactions
    assert "request 0" in second.user_messages[0]
    assert any("request 5" in u for u in second.user_messages)


def test_build_state_none_when_boundary_stale():
    msgs = convo(turns=3)
    fake = FakeSummarizer()
    state = build_state(msgs, provider=fake, model="m", keep_tokens=estimate_tokens(msgs[-2:]) + 10)
    again = build_state(
        msgs, provider=fake, model="m",
        keep_tokens=10_000_000, prior=state,
    )
    assert again is None  # nothing new fits below the prior boundary


# -- trim fallback ------------------------------------------------------------


def test_trim_advances_boundary_and_keeps_user_messages():
    msgs = convo(turns=10)
    state = trim_state(msgs)
    assert state is not None and state.trimmed
    assert msgs[state.boundary_index]["role"] in ("user", "assistant")
    assert state.user_messages  # preserved mechanically even without a summary
    assert "trimmed" in state.summary_text
    out = apply_to_outbound(msgs, state)
    assert len(out) < len(msgs) + 1


def test_trim_from_prior_state_never_lands_on_tool_row():
    msgs = [{"role": "system", "content": "s"}, user("go")]
    for i in range(10):
        msgs += tool_turn("run_shell", {"command": f"c{i}"}, {"exit_code": 0})
    prior = trim_state(msgs)
    later = trim_state(msgs, prior=prior)
    assert later.boundary_index > prior.boundary_index
    assert msgs[later.boundary_index]["role"] != "tool"


def test_trim_none_when_too_small():
    assert trim_state([user("hi"), assistant("yo")]) is None


# -- state round-trip + overflow detection ------------------------------------


def test_state_dict_round_trip():
    state = CompactionState(
        boundary_index=7, summary_text="s", working_state="w",
        user_messages=["u1"], created_at=1.5, model_used="m", trimmed=True,
    )
    assert CompactionState.from_dict(state.as_dict()) == state
    assert CompactionState.from_dict(None) is None
    assert CompactionState.from_dict({}) is None


def test_apply_to_outbound_noop_on_stale_or_missing_state():
    msgs = convo(turns=2)
    assert apply_to_outbound(msgs, None) is msgs
    stale = CompactionState(boundary_index=999, summary_text="s", working_state="")
    assert apply_to_outbound(msgs, stale) is msgs


def test_is_context_overflow():
    assert is_context_overflow(Exception("Error 400: maximum context length is 128000 tokens"))
    assert is_context_overflow(Exception("context_length_exceeded"))
    assert is_context_overflow(Exception("Prompt is too long: 210000 tokens > limit"))
    assert not is_context_overflow(Exception("rate limit exceeded"))
    assert not is_context_overflow(Exception("connection reset"))
