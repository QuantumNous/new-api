package openaicompat

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestShouldChatCompletionsUseResponsesGlobal_CodexChannelForced(t *testing.T) {
	if !ShouldChatCompletionsUseResponsesGlobal(0, constant.ChannelTypeCodex, "gpt-5.2") {
		t.Fatalf("expected codex channel to always use responses compatibility")
	}
}

func TestShouldChatCompletionsUseResponsesGlobal_NonCodexRespectsPolicy(t *testing.T) {
	if ShouldChatCompletionsUseResponsesGlobal(0, constant.ChannelTypeOpenAI, "gpt-5.2") {
		t.Fatalf("expected non-codex channel to follow global policy default (disabled)")
	}
}
