package ir

import (
	"testing"

	"github.com/QuantumNous/new-api/relaykit/types"
)

func TestRequestProjectionLossesDropsClaudeSignatureForChat(t *testing.T) {
	t.Parallel()
	req := &Request{
		Messages: []Message{{
			Role: RoleAssistant,
			Blocks: []Block{
				Think("secret", "sig-1"),
			},
		}},
	}
	report := RequestProjectionLosses(types.RelayFormatClaude, types.RelayFormatOpenAI, req)
	if report.Empty() {
		t.Fatal("expected signature loss")
	}
	found := false
	for _, loss := range report.Losses {
		if loss.Field == "thinking.signature" && loss.Kind == LossDropped {
			found = true
		}
	}
	if !found {
		t.Fatalf("losses=%#v", report.Losses)
	}
}

func TestRequestProjectionLossesDropsGeminiIncompatibleTools(t *testing.T) {
	t.Parallel()
	req := &Request{
		Tools: []Tool{
			{Kind: ToolFunction, Name: "fn"},
			{Kind: ToolWebSearch, Name: "web_search"},
			{Kind: ToolCustom, Name: "apply_patch"},
		},
	}
	report := RequestProjectionLosses(types.RelayFormatOpenAIResponses, types.RelayFormatGemini, req)
	foundWeb, foundCustom := false, false
	for _, loss := range report.Losses {
		switch loss.Field {
		case "tools.web_search":
			foundWeb = true
		case "tools.custom":
			foundCustom = true
		}
	}
	if !foundWeb || !foundCustom {
		t.Fatalf("losses=%#v", report.Losses)
	}
}

func TestRequestProjectionLossesRecordsThinkingCoercions(t *testing.T) {
	t.Parallel()
	budget := 16000
	tests := []struct {
		name  string
		to    types.RelayFormat
		think *ThinkConfig
		field string
	}{
		{name: "detailed to Gemini", to: types.RelayFormatGemini, think: &ThinkConfig{Display: ThinkDisplayDetailed}, field: "thinking.display"},
		{name: "budget to Chat", to: types.RelayFormatOpenAI, think: &ThinkConfig{Budget: &budget}, field: "thinking.budget"},
		{name: "detailed to Claude", to: types.RelayFormatClaude, think: &ThinkConfig{Display: ThinkDisplayDetailed}, field: "thinking.display"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			report := RequestProjectionLosses(types.RelayFormatOpenAIResponses, tt.to, &Request{Think: tt.think})
			found := false
			for _, loss := range report.Losses {
				if loss.Field == tt.field && loss.Kind == LossCoerced {
					found = true
				}
			}
			if !found {
				t.Fatalf("losses=%#v", report.Losses)
			}
		})
	}
}

func TestRequestProjectionLossesEmptyOnRoundtrip(t *testing.T) {
	t.Parallel()
	req := &Request{
		Messages: []Message{{
			Role:   RoleAssistant,
			Blocks: []Block{Think("secret", "sig-1")},
		}},
	}
	report := RequestProjectionLosses(types.RelayFormatClaude, types.RelayFormatClaude, req)
	if !report.Empty() {
		t.Fatalf("roundtrip must not record losses: %#v", report.Losses)
	}
}
