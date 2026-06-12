package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newConvertTestInfo() *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		OriginModelName:   "claude-opus-4-6",
		SendResponseCount: 1,
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{},
	}
	info.SetEstimatePromptTokens(1026)
	return info
}

func findMessageStart(resps []*dto.ClaudeResponse) *dto.ClaudeResponse {
	for _, r := range resps {
		if r.Type == "message_start" {
			return r
		}
	}
	return nil
}

func TestStreamResponseOpenAI2Claude_NormalizesMessageStart(t *testing.T) {
	withNormalize(t, true)

	info := newConvertTestInfo()
	openAIResp := &dto.ChatCompletionsStreamResponse{
		Id:    "gen-1781245943-9Q4Nyw8yXglc3sttYIim",
		Model: "anthropic/claude-4.6-opus-20260205",
	}

	resps := StreamResponseOpenAI2Claude(openAIResp, info)
	start := findMessageStart(resps)
	require.NotNil(t, start)
	require.NotNil(t, start.Message)

	assert.Equal(t, "claude-opus-4-6", start.Message.Model, "model should be the client-requested name")
	assert.True(t, strings.HasPrefix(start.Message.Id, "msg_01"), "id should be msg_ form, got %q", start.Message.Id)
	assert.Equal(t, common.EncodeAnthropicMessageID(openAIResp.Id), start.Message.Id)
	require.NotNil(t, start.Message.Usage)
	// 1026 * 0.84 -> 862 (per-model calibration applied at display boundary)
	assert.Equal(t, 862, start.Message.Usage.InputTokens)
}

func TestStreamResponseOpenAI2Claude_NormalizeDisabled(t *testing.T) {
	withNormalize(t, false)

	info := newConvertTestInfo()
	openAIResp := &dto.ChatCompletionsStreamResponse{
		Id:    "gen-abc",
		Model: "anthropic/claude-4.6-opus-20260205",
	}

	resps := StreamResponseOpenAI2Claude(openAIResp, info)
	start := findMessageStart(resps)
	require.NotNil(t, start)
	require.NotNil(t, start.Message)

	assert.Equal(t, "anthropic/claude-4.6-opus-20260205", start.Message.Model)
	assert.Equal(t, "gen-abc", start.Message.Id)
	assert.Equal(t, 1026, start.Message.Usage.InputTokens, "no calibration when disabled")
}

func TestResponseOpenAI2Claude_NormalizesIdentity(t *testing.T) {
	withNormalize(t, true)

	info := newConvertTestInfo()
	openAIResp := &dto.OpenAITextResponse{
		Id:    "gen-1781245943-abc",
		Model: "anthropic/claude-4.6-opus-20260205",
		Choices: []dto.OpenAITextResponseChoice{
			{
				FinishReason: "stop",
				Message:      dto.Message{Role: "assistant"},
			},
		},
	}

	resp := ResponseOpenAI2Claude(openAIResp, info)
	require.NotNil(t, resp)
	assert.Equal(t, "claude-opus-4-6", resp.Model)
	assert.True(t, strings.HasPrefix(resp.Id, "msg_01"), "id should be msg_ form, got %q", resp.Id)
	assert.Equal(t, common.EncodeAnthropicMessageID(openAIResp.Id), resp.Id)
}

func TestResponseOpenAI2Claude_NormalizeDisabled(t *testing.T) {
	withNormalize(t, false)

	info := newConvertTestInfo()
	openAIResp := &dto.OpenAITextResponse{
		Id:    "gen-x",
		Model: "anthropic/claude-4.6-opus-20260205",
		Choices: []dto.OpenAITextResponseChoice{
			{FinishReason: "stop", Message: dto.Message{Role: "assistant"}},
		},
	}

	resp := ResponseOpenAI2Claude(openAIResp, info)
	require.NotNil(t, resp)
	assert.Equal(t, "anthropic/claude-4.6-opus-20260205", resp.Model)
	assert.Equal(t, "gen-x", resp.Id)
}
