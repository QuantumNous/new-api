package deepseek

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestConvertClaudeRequestMergesTrailingSystemIntoPreviousUser(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model: "deepseek-v4-pro",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "Why did the skill stop?"},
			{Role: "system", Content: "Ultracode is on: keep working."},
		},
	}

	converted, err := (&Adaptor{}).ConvertClaudeRequest(nil, &relaycommon.RelayInfo{}, req)
	if err != nil {
		t.Fatalf("ConvertClaudeRequest returned error: %v", err)
	}
	claudeReq := converted.(*dto.ClaudeRequest)

	if len(claudeReq.Messages) != 1 {
		t.Fatalf("expected 1 message after normalization, got %d", len(claudeReq.Messages))
	}
	if claudeReq.Messages[0].Role != "user" {
		t.Fatalf("expected normalized message to remain user, got %q", claudeReq.Messages[0].Role)
	}
	content := claudeReq.Messages[0].GetStringContent()
	if !strings.Contains(content, "Why did the skill stop?") {
		t.Fatalf("expected user content to be preserved, got %q", content)
	}
	if !strings.Contains(content, "Ultracode is on: keep working.") {
		t.Fatalf("expected trailing system content to be merged into user content, got %q", content)
	}
}

func TestConvertClaudeRequestMergesInterleavedSystemIntoNextUser(t *testing.T) {
	req := &dto.ClaudeRequest{
		Model: "deepseek-v4-pro",
		Messages: []dto.ClaudeMessage{
			{Role: "user", Content: "First request"},
			{Role: "assistant", Content: "First response"},
			{Role: "system", Content: "Apply this reminder before the next answer."},
			{Role: "user", Content: "Second request"},
		},
	}

	converted, err := (&Adaptor{}).ConvertClaudeRequest(nil, &relaycommon.RelayInfo{}, req)
	if err != nil {
		t.Fatalf("ConvertClaudeRequest returned error: %v", err)
	}
	claudeReq := converted.(*dto.ClaudeRequest)

	if len(claudeReq.Messages) != 3 {
		t.Fatalf("expected 3 messages after normalization, got %d", len(claudeReq.Messages))
	}
	if claudeReq.Messages[2].Role != "user" {
		t.Fatalf("expected interleaved system to be merged into next user, got role %q", claudeReq.Messages[2].Role)
	}
	content := claudeReq.Messages[2].GetStringContent()
	if !strings.Contains(content, "Apply this reminder before the next answer.") {
		t.Fatalf("expected interleaved system content in next user message, got %q", content)
	}
	if !strings.Contains(content, "Second request") {
		t.Fatalf("expected next user content to be preserved, got %q", content)
	}
}
