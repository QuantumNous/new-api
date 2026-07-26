package xai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertClaudeRequestUsesOpenAICompatibleChatRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	stream := true
	maxTokens := uint(128)
	temperature := 0.2
	info := &relaycommon.RelayInfo{
		IsStream:    true,
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			SupportStreamOptions: true,
			UpstreamModelName:    "grok-4.3-fast",
		},
	}
	info.ClaudeConvertInfo = &relaycommon.ClaudeConvertInfo{
		LastMessagesType: relaycommon.LastMessageTypeNone,
	}

	converted, err := (&Adaptor{}).ConvertClaudeRequest(c, info, &dto.ClaudeRequest{
		Model:       "grok-4.3-fast",
		MaxTokens:   &maxTokens,
		Stream:      &stream,
		Temperature: &temperature,
		Messages: []dto.ClaudeMessage{
			{
				Role:    "user",
				Content: "hello",
			},
		},
	})

	require.NoError(t, err)
	openAIRequest, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	assert.Equal(t, "grok-4.3-fast", openAIRequest.Model)
	require.Len(t, openAIRequest.Messages, 1)
	assert.Equal(t, "user", openAIRequest.Messages[0].Role)
	assert.Equal(t, "hello", openAIRequest.Messages[0].StringContent())
	require.NotNil(t, openAIRequest.Stream)
	assert.True(t, *openAIRequest.Stream)
	require.NotNil(t, openAIRequest.StreamOptions)
	assert.True(t, openAIRequest.StreamOptions.IncludeUsage)
	require.NotNil(t, openAIRequest.MaxTokens)
	assert.Equal(t, maxTokens, *openAIRequest.MaxTokens)
	require.NotNil(t, openAIRequest.Temperature)
	assert.Equal(t, temperature, *openAIRequest.Temperature)
}

func TestGetRequestURLUsesChatCompletionsForClaudeFormat(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayFormat:    types.RelayFormatClaude,
		RelayMode:      relayconstant.RelayModeChatCompletions,
		RequestURLPath: "/v1/messages",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://api.x.ai",
		},
	}

	requestURL, err := (&Adaptor{}).GetRequestURL(info)

	require.NoError(t, err)
	assert.Equal(t, "https://api.x.ai/v1/chat/completions", requestURL)
}

func TestXAIHandlerConvertsClaudeFormatResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "grok-4.3-fast",
		},
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{},
	}
	responseBody := `{"id":"chatcmpl-1","object":"chat.completion","created":1,"model":"grok-4.3-fast","choices":[{"index":0,"message":{"role":"assistant","content":"pong"},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}`
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(responseBody)),
	}

	usage, newAPIError := xAIHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 3, usage.PromptTokens)
	assert.Equal(t, 2, usage.CompletionTokens)
	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Body.String(), `"type":"message"`)
	assert.Contains(t, recorder.Body.String(), `"content":[{"type":"text","text":"pong"}]`)
	assert.Contains(t, recorder.Body.String(), `"input_tokens":3`)
}

func TestXAIStreamHandlerConvertsClaudeFormatResponse(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalStreamingTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = originalStreamingTimeout
	})
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		IsStream:    true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "grok-4.3-fast",
		},
		ClaudeConvertInfo: &relaycommon.ClaudeConvertInfo{
			LastMessagesType: relaycommon.LastMessageTypeNone,
		},
	}
	info.SetEstimatePromptTokens(3)
	responseBody := strings.Join([]string{
		`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"grok-4.3-fast","choices":[{"index":0,"delta":{"content":"pong"},"finish_reason":null}],"usage":null}`,
		"",
		`data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"grok-4.3-fast","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":0,"total_tokens":5}}`,
		"",
		"data: [DONE]",
		"",
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(responseBody)),
	}

	usage, newAPIError := xAIStreamHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 3, usage.PromptTokens)
	assert.Equal(t, 2, usage.CompletionTokens)
	body := recorder.Body.String()
	assert.Contains(t, body, "event: message_start")
	assert.Contains(t, body, "event: content_block_delta")
	assert.Contains(t, body, "event: message_stop")
	assert.Contains(t, body, `"text":"pong"`)
	assert.Contains(t, body, `"input_tokens":3`)
	assert.NotContains(t, body, "[DONE]")
}
