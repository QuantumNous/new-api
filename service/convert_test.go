package service

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRequestConverterFacadeAcceptsTypedNilRelayInfo(t *testing.T) {
	for _, target := range []types.RelayFormat{types.RelayFormatClaude, types.RelayFormatGemini} {
		t.Run(string(target), func(t *testing.T) {
			var info *relaycommon.RelayInfo
			request := &dto.GeneralOpenAIRequest{
				Model: "test-model",
				Messages: []dto.Message{
					{Role: "user", Content: "hello"},
				},
			}

			result, err := ConvertRequest(nil, info, target, request)

			require.NoError(t, err)
			require.NotNil(t, result)
			assert.Equal(t, target, result.To)
		})
	}
}

func TestStreamResponseConverterFacadesAcceptTypedNilRelayInfo(t *testing.T) {
	var info *relaycommon.RelayInfo
	content := "hello"
	streamResp := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_typed_nil",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Content: &content,
				},
			},
		},
	}

	claudeResult, err := ConvertStreamResponse(nil, info, types.RelayFormatClaude, streamResp)
	require.NoError(t, err)
	require.NotNil(t, claudeResult)
	require.IsType(t, []*dto.ClaudeResponse{}, claudeResult.Value)
	claudeResponses := claudeResult.Value.([]*dto.ClaudeResponse)
	require.NotEmpty(t, claudeResponses)
	assert.Equal(t, "content_block_start", claudeResponses[0].Type)

	geminiResult, err := ConvertStreamResponse(nil, info, types.RelayFormatGemini, streamResp)
	require.NoError(t, err)
	require.NotNil(t, geminiResult)
	require.IsType(t, &dto.GeminiChatResponse{}, geminiResult.Value)
	geminiResp := geminiResult.Value.(*dto.GeminiChatResponse)
	require.NotNil(t, geminiResp)
	require.Len(t, geminiResp.Candidates, 1)
	assert.Zero(t, geminiResp.UsageMetadata.PromptTokenCount)
}
