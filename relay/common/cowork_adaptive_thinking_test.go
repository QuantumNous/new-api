package common

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
)

func TestFixCoworkAdaptiveThinkingJSONConvertsThinkingBlocks(t *testing.T) {
	input := `{
		"model": "claude-opus-4-7",
		"thinking": {"type": "adaptive"},
		"system": [{"type": "text", "text": "cc_entrypoint=claude-desktop-3p"}],
		"messages": [
			{
				"role": "assistant",
				"content": [
					{"type": "thinking", "thinking": "I need to reason.", "signature": "bad-signature"},
					{"type": "text", "text": "Final answer."}
				]
			},
			{"role": "user", "content": "continue"}
		]
	}`

	out, stats, err := FixCoworkAdaptiveThinkingJSON(
		[]byte(input),
		dto.ChannelOtherSettings{CoworkAdaptiveThinkingFix: true},
	)
	if err != nil {
		t.Fatalf("FixCoworkAdaptiveThinkingJSON returned error: %v", err)
	}
	if !stats.Changed || stats.ThinkingBlocks != 1 || stats.RedactedThinkingBlocks != 0 {
		t.Fatalf("unexpected stats: %#v", stats)
	}
	assertJSONEqual(t, `{
		"model": "claude-opus-4-7",
		"thinking": {"type": "adaptive"},
		"system": [{"type": "text", "text": "cc_entrypoint=claude-desktop-3p"}],
		"messages": [
			{
				"role": "assistant",
				"content": [
					{"type": "text", "text": "<previous_reasoning>\nI need to reason.\n</previous_reasoning>"},
					{"type": "text", "text": "Final answer."}
				]
			},
			{"role": "user", "content": "continue"}
		]
	}`, string(out))
}

func TestFixCoworkAdaptiveThinkingJSONConvertsRedactedThinkingBlocks(t *testing.T) {
	input := `{
		"model": "claude-opus-4-7",
		"thinking": {"type": "adaptive"},
		"system": [{"type": "text", "text": "cc_entrypoint=claude-desktop-3p"}],
		"messages": [
			{
				"role": "assistant",
				"content": [
					{"type": "redacted_thinking", "data": "encrypted-or-redacted-data"},
					{"type": "text", "text": "Final answer."}
				]
			}
		]
	}`

	out, stats, err := FixCoworkAdaptiveThinkingJSON(
		[]byte(input),
		dto.ChannelOtherSettings{CoworkAdaptiveThinkingFix: true},
	)
	if err != nil {
		t.Fatalf("FixCoworkAdaptiveThinkingJSON returned error: %v", err)
	}
	if !stats.Changed || stats.ThinkingBlocks != 0 || stats.RedactedThinkingBlocks != 1 {
		t.Fatalf("unexpected stats: %#v", stats)
	}
	assertJSONEqual(t, `{
		"model": "claude-opus-4-7",
		"thinking": {"type": "adaptive"},
		"system": [{"type": "text", "text": "cc_entrypoint=claude-desktop-3p"}],
		"messages": [
			{
				"role": "assistant",
				"content": [
					{"type": "text", "text": "<previous_reasoning_redacted/>"},
					{"type": "text", "text": "Final answer."}
				]
			}
		]
	}`, string(out))
}

func TestFixCoworkAdaptiveThinkingJSONSkipsWhenDisabled(t *testing.T) {
	input := `{
		"thinking": {"type": "adaptive"},
		"system": [{"type": "text", "text": "cc_entrypoint=claude-desktop-3p"}],
		"messages": [{"role": "assistant", "content": [{"type": "thinking", "thinking": "hidden", "signature": "sig"}]}]
	}`

	out, stats, err := FixCoworkAdaptiveThinkingJSON([]byte(input), dto.ChannelOtherSettings{})
	if err != nil {
		t.Fatalf("FixCoworkAdaptiveThinkingJSON returned error: %v", err)
	}
	if stats.Changed {
		t.Fatalf("expected no conversion when channel setting is disabled, got %#v", stats)
	}
	assertJSONEqual(t, input, string(out))
}

func TestFixCoworkAdaptiveThinkingJSONSkipsNonAdaptiveThinking(t *testing.T) {
	input := `{
		"thinking": {"type": "enabled", "budget_tokens": 4096},
		"system": [{"type": "text", "text": "cc_entrypoint=claude-desktop-3p"}],
		"messages": [{"role": "assistant", "content": [{"type": "thinking", "thinking": "hidden", "signature": "sig"}]}]
	}`

	out, stats, err := FixCoworkAdaptiveThinkingJSON(
		[]byte(input),
		dto.ChannelOtherSettings{CoworkAdaptiveThinkingFix: true},
	)
	if err != nil {
		t.Fatalf("FixCoworkAdaptiveThinkingJSON returned error: %v", err)
	}
	if stats.Changed {
		t.Fatalf("expected no conversion for non-adaptive thinking, got %#v", stats)
	}
	assertJSONEqual(t, input, string(out))
}

func TestFixCoworkAdaptiveThinkingJSONSkipsNonCoworkRequests(t *testing.T) {
	input := `{
		"thinking": {"type": "adaptive"},
		"system": [{"type": "text", "text": "normal client"}],
		"messages": [{"role": "assistant", "content": [{"type": "thinking", "thinking": "hidden", "signature": "sig"}]}]
	}`

	out, stats, err := FixCoworkAdaptiveThinkingJSON(
		[]byte(input),
		dto.ChannelOtherSettings{CoworkAdaptiveThinkingFix: true},
	)
	if err != nil {
		t.Fatalf("FixCoworkAdaptiveThinkingJSON returned error: %v", err)
	}
	if stats.Changed {
		t.Fatalf("expected no conversion for non-Cowork request, got %#v", stats)
	}
	assertJSONEqual(t, input, string(out))
}

func TestFixCoworkAdaptiveThinkingJSONPreservesNormalBlocks(t *testing.T) {
	input := `{
		"thinking": {"type": "adaptive"},
		"system": [{"type": "text", "text": "cc_entrypoint=claude-desktop-3p"}],
		"messages": [
			{
				"role": "assistant",
				"content": [
					{"type": "text", "text": "hello"},
					{"type": "tool_use", "id": "toolu_123", "name": "Read", "input": {"file_path": "/tmp/a.txt"}}
				]
			}
		]
	}`

	out, stats, err := FixCoworkAdaptiveThinkingJSON(
		[]byte(input),
		dto.ChannelOtherSettings{CoworkAdaptiveThinkingFix: true},
	)
	if err != nil {
		t.Fatalf("FixCoworkAdaptiveThinkingJSON returned error: %v", err)
	}
	if stats.Changed {
		t.Fatalf("expected no conversion when no thinking block exists, got %#v", stats)
	}
	assertJSONEqual(t, input, string(out))
}
