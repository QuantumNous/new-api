package service

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResponseConverterFacades(t *testing.T) {
	cache5m, cache1h := NormalizeCacheCreationSplit(10, 3, 2)
	assert.Equal(t, 8, cache5m)
	assert.Equal(t, 2, cache1h)

	chatResp := &dto.OpenAITextResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.OpenAITextResponseChoice{
			{
				Message: dto.Message{
					Role:    "assistant",
					Content: "hello",
				},
				FinishReason: "stop",
			},
		},
	}

	claudeResp := ResponseOpenAI2Claude(chatResp, &relaycommon.RelayInfo{})
	require.NotNil(t, claudeResp)
	assert.Equal(t, "message", claudeResp.Type)

	geminiResp := ResponseOpenAI2Gemini(chatResp, &relaycommon.RelayInfo{})
	require.NotNil(t, geminiResp)
	require.Len(t, geminiResp.Candidates, 1)
}

func TestStreamResponseConverterFacades(t *testing.T) {
	info := &relaycommon.RelayInfo{
		SendResponseCount: 1,
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeNone,
		},
	}
	streamResp := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_1",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Content: ptrValue("hello"),
				},
			},
		},
	}

	claudeResponses := StreamResponseOpenAI2Claude(streamResp, info)
	require.NotEmpty(t, claudeResponses)

	geminiResp := StreamResponseOpenAI2Gemini(streamResp, &relaycommon.RelayInfo{})
	require.NotNil(t, geminiResp)
	require.Len(t, geminiResp.Candidates, 1)
}

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

func TestReasoningContentConversionsUseConfiguredUpstreamModel(t *testing.T) {
	settings := model_setting.GetGlobalSettings()
	original := append([]string(nil), settings.ReasoningContentModels...)
	t.Cleanup(func() {
		settings.ReasoningContentModels = original
	})
	settings.ReasoningContentModels = []string{"mimo"}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "xiaomi-mimo-v2-flash"},
	}
	request := &dto.OpenAIResponsesRequest{
		Model: "xiaomi-mimo-v2-flash",
		Input: []byte(`[{"type":"reasoning","summary":[{"type":"summary_text","text":"Need the lookup."}]},{"type":"function_call","call_id":"call_1","name":"lookup","arguments":"{}"},{"type":"function_call_output","call_id":"call_1","output":"done"}]`),
	}

	result, err := ConvertRequest(nil, info, types.RelayFormatOpenAI, request)
	require.NoError(t, err)
	converted, ok := result.Value.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.Len(t, converted.Messages, 2)
	assert.Equal(t, "Need the lookup.", converted.Messages[0].GetReasoningContent())
	assert.Len(t, converted.Messages[0].ParseToolCalls(), 1)

	reasoning := "Need the lookup."
	result, err = ConvertRequest(nil, info, types.RelayFormatGemini, &dto.GeneralOpenAIRequest{
		Model: "xiaomi-mimo-v2-flash",
		Messages: []dto.Message{{
			Role:             "assistant",
			Content:          "Calling the tool.",
			ReasoningContent: &reasoning,
		}},
	})
	require.NoError(t, err)
	geminiRequest, ok := result.Value.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.NotEmpty(t, geminiRequest.Contents)
	require.NotEmpty(t, geminiRequest.Contents[0].Parts)
	assert.True(t, geminiRequest.Contents[0].Parts[0].Thought)
	assert.Equal(t, reasoning, geminiRequest.Contents[0].Parts[0].Text)
}

func TestStreamResponseConverterFacadesAcceptTypedNilRelayInfo(t *testing.T) {
	var info *relaycommon.RelayInfo
	streamResp := &dto.ChatCompletionsStreamResponse{
		Id:    "chatcmpl_typed_nil",
		Model: "gpt-test",
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{
				Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
					Content: ptrValue("hello"),
				},
			},
		},
	}

	claudeResponses := StreamResponseOpenAI2Claude(streamResp, info)
	require.NotEmpty(t, claudeResponses)
	assert.Equal(t, "content_block_start", claudeResponses[0].Type)

	geminiResp := StreamResponseOpenAI2Gemini(streamResp, info)
	require.NotNil(t, geminiResp)
	require.Len(t, geminiResp.Candidates, 1)
	assert.Zero(t, geminiResp.UsageMetadata.PromptTokenCount)
}

func ptrValue[T any](value T) *T {
	return &value
}
