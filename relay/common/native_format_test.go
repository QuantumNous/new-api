package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func TestNativeTextFormat(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		apiType  int
		model    string
		incoming types.RelayFormat
		want     types.RelayFormat
	}{
		{name: "gemini channel", apiType: constant.APITypeGemini, incoming: types.RelayFormatOpenAI, want: types.RelayFormatGemini},
		{name: "claude channel", apiType: constant.APITypeAnthropic, incoming: types.RelayFormatOpenAI, want: types.RelayFormatClaude},
		{name: "aws claude", apiType: constant.APITypeAws, model: "claude-sonnet-4", incoming: types.RelayFormatOpenAI, want: types.RelayFormatClaude},
		{name: "aws nova stays chat", apiType: constant.APITypeAws, model: "amazon-nova-pro", incoming: types.RelayFormatOpenAI, want: types.RelayFormatOpenAI},
		{name: "vertex gemini", apiType: constant.APITypeVertexAi, model: "gemini-2.5-pro", incoming: types.RelayFormatOpenAI, want: types.RelayFormatGemini},
		{name: "vertex claude", apiType: constant.APITypeVertexAi, model: "claude-sonnet-4", incoming: types.RelayFormatGemini, want: types.RelayFormatClaude},
		{name: "codex is responses", apiType: constant.APITypeCodex, incoming: types.RelayFormatOpenAI, want: types.RelayFormatOpenAIResponses},
		{name: "openai chat stays chat", apiType: constant.APITypeOpenAI, incoming: types.RelayFormatOpenAI, want: types.RelayFormatOpenAI},
		{name: "openai responses stays responses", apiType: constant.APITypeOpenAI, incoming: types.RelayFormatOpenAIResponses, want: types.RelayFormatOpenAIResponses},
		{name: "deepseek responses converts to chat", apiType: constant.APITypeDeepSeek, incoming: types.RelayFormatOpenAIResponses, want: types.RelayFormatOpenAI},
		{name: "newapi passthrough gemini", apiType: constant.APITypeNewAPI, incoming: types.RelayFormatGemini, want: types.RelayFormatGemini},
		{name: "moonshot claude native", apiType: constant.APITypeMoonshot, incoming: types.RelayFormatClaude, want: types.RelayFormatClaude},
		{name: "moonshot gemini via chat", apiType: constant.APITypeMoonshot, incoming: types.RelayFormatGemini, want: types.RelayFormatOpenAI},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			info := &RelayInfo{
				ChannelMeta: &ChannelMeta{
					ApiType:           tt.apiType,
					UpstreamModelName: tt.model,
				},
			}
			if got := NativeTextFormat(info, tt.incoming); got != tt.want {
				t.Fatalf("NativeTextFormat=%s want %s", got, tt.want)
			}
		})
	}
}
