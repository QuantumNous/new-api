package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
)

func TestNativeTextFormat(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		channelType int
		apiType     int
		model       string
		incoming    types.RelayFormat
		want        types.RelayFormat
	}{
		{name: "gemini provider", channelType: constant.ChannelTypeGemini, apiType: constant.APITypeGemini, incoming: types.RelayFormatOpenAI, want: types.RelayFormatGemini},
		{name: "claude provider", channelType: constant.ChannelTypeAnthropic, apiType: constant.APITypeAnthropic, incoming: types.RelayFormatOpenAI, want: types.RelayFormatClaude},
		{name: "aws claude", channelType: constant.ChannelTypeAws, apiType: constant.APITypeAws, model: "claude-sonnet-4", incoming: types.RelayFormatOpenAI, want: types.RelayFormatClaude},
		{name: "aws nova stays chat", channelType: constant.ChannelTypeAws, apiType: constant.APITypeAws, model: "amazon-nova-pro", incoming: types.RelayFormatOpenAI, want: types.RelayFormatOpenAI},
		{name: "vertex gemini", channelType: constant.ChannelTypeVertexAi, apiType: constant.APITypeVertexAi, model: "gemini-3.7-flash", incoming: types.RelayFormatOpenAI, want: types.RelayFormatGemini},
		{name: "vertex gemini with publisher prefix", channelType: constant.ChannelTypeVertexAi, apiType: constant.APITypeVertexAi, model: "google/gemini-3.7-flash", incoming: types.RelayFormatClaude, want: types.RelayFormatGemini},
		{name: "vertex claude", channelType: constant.ChannelTypeVertexAi, apiType: constant.APITypeVertexAi, model: "claude-sonnet-4", incoming: types.RelayFormatGemini, want: types.RelayFormatClaude},
		{name: "vertex claude with publisher prefix", channelType: constant.ChannelTypeVertexAi, apiType: constant.APITypeVertexAi, model: "anthropic/claude-sonnet-4", incoming: types.RelayFormatOpenAI, want: types.RelayFormatClaude},
		{name: "codex is responses", channelType: constant.ChannelTypeCodex, apiType: constant.APITypeCodex, incoming: types.RelayFormatOpenAI, want: types.RelayFormatOpenAIResponses},
		{name: "openai chat stays chat", channelType: constant.ChannelTypeOpenAI, apiType: constant.APITypeOpenAI, incoming: types.RelayFormatOpenAI, want: types.RelayFormatOpenAI},
		{name: "openai responses stays responses", channelType: constant.ChannelTypeOpenAI, apiType: constant.APITypeOpenAI, incoming: types.RelayFormatOpenAIResponses, want: types.RelayFormatOpenAIResponses},
		{name: "xai responses stays responses", channelType: constant.ChannelTypeXai, apiType: constant.APITypeXai, model: "grok-4.6", incoming: types.RelayFormatOpenAIResponses, want: types.RelayFormatOpenAIResponses},
		{name: "deepseek responses converts to chat", channelType: constant.ChannelTypeDeepSeek, apiType: constant.APITypeDeepSeek, incoming: types.RelayFormatOpenAIResponses, want: types.RelayFormatOpenAI},
		{name: "newapi passthrough gemini", channelType: constant.ChannelTypeNewAPI, apiType: constant.APITypeNewAPI, incoming: types.RelayFormatGemini, want: types.RelayFormatGemini},
		{name: "moonshot claude native", channelType: constant.ChannelTypeMoonshot, apiType: constant.APITypeMoonshot, incoming: types.RelayFormatClaude, want: types.RelayFormatClaude},
		{name: "moonshot gemini via chat", channelType: constant.ChannelTypeMoonshot, apiType: constant.APITypeMoonshot, incoming: types.RelayFormatGemini, want: types.RelayFormatOpenAI},
		{name: "ali qwen claude native", channelType: constant.ChannelTypeAli, apiType: constant.APITypeAli, model: "qwen-plus", incoming: types.RelayFormatClaude, want: types.RelayFormatClaude},
		{name: "ali chat client stays chat", channelType: constant.ChannelTypeAli, apiType: constant.APITypeAli, model: "qwen-plus", incoming: types.RelayFormatOpenAI, want: types.RelayFormatOpenAI},
		{name: "ali non-claude model converts to chat", channelType: constant.ChannelTypeAli, apiType: constant.APITypeAli, model: "wanx-v1", incoming: types.RelayFormatClaude, want: types.RelayFormatOpenAI},
		{name: "api type fallback", apiType: constant.APITypeGemini, incoming: types.RelayFormatOpenAI, want: types.RelayFormatGemini},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			info := &RelayInfo{
				ChannelMeta: &ChannelMeta{
					ChannelType:       tt.channelType,
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
