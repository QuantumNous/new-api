package service

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/relayconvert"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
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

func TestRequestConverterFacadeInlinesGeminiImageWithDebugEnabled(t *testing.T) {
	previousDebug := common.DebugEnabled
	common.DebugEnabled = true
	t.Cleanup(func() { common.DebugEnabled = previousDebug })

	const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAEklEQVR4nGP4z8CAFWEXHbQSACj/P8Fu7N9hAAAAAElFTkSuQmCC"
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	request := &dto.GeneralOpenAIRequest{
		Model: "gemini-test",
		Messages: []dto.Message{
			{Role: "user", Content: []any{
				map[string]any{"type": "text", "text": "what color?"},
				map[string]any{"type": "image_url", "image_url": map[string]any{"url": "data:image/png;base64," + pngBase64}},
			}},
		},
	}

	var result *relayconvert.RequestResult
	var err error
	require.NotPanics(t, func() {
		result, err = ConvertRequest(c, &relaycommon.RelayInfo{}, types.RelayFormatGemini, request)
	})
	require.NoError(t, err)

	geminiRequest, ok := result.Value.(*dto.GeminiChatRequest)
	require.True(t, ok)
	require.Len(t, geminiRequest.Contents, 1)
	parts := geminiRequest.Contents[0].Parts
	require.Len(t, parts, 2)
	require.NotNil(t, parts[1].InlineData)
	assert.Equal(t, "image/png", parts[1].InlineData.MimeType)
	assert.Equal(t, pngBase64, parts[1].InlineData.Data)

	sources, exists := c.Get(string(constant.ContextKeyFileSourcesToCleanup))
	require.True(t, exists, "image source should be registered on the gin context for request-end cleanup")
	assert.Len(t, sources, 1)
}

func ptrValue[T any](value T) *T {
	return &value
}
