package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestOpenaiHandlerBuffersChatCompletionStreamForNonStreamClient(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "gpt-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
			ChannelType:       constant.ChannelTypeOpenAI,
		},
	}
	resp := newChatCompletionSSE(http.StatusOK, `data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":123,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"pong"},"finish_reason":null,"logprobs":null}]}

data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":123,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop","logprobs":null}],"usage":{"prompt_tokens":2,"completion_tokens":1,"total_tokens":3}}

data: [DONE]
`)

	usage, newAPIError := OpenaiHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "application/json")
	require.Equal(t, &dto.Usage{PromptTokens: 2, CompletionTokens: 1, TotalTokens: 3}, usage)

	var parsed dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &parsed))
	require.Equal(t, "chatcmpl-test", parsed.Id)
	require.Equal(t, "chat.completion", parsed.Object)
	require.Equal(t, "gpt-test", parsed.Model)
	require.Len(t, parsed.Choices, 1)
	require.Equal(t, 0, parsed.Choices[0].Index)
	require.Equal(t, "assistant", parsed.Choices[0].Message.Role)
	require.Equal(t, "pong", parsed.Choices[0].Message.Content)
	require.Equal(t, "stop", parsed.Choices[0].FinishReason)
	require.Equal(t, 2, parsed.PromptTokens)
	require.Equal(t, 1, parsed.CompletionTokens)
	require.Equal(t, 3, parsed.TotalTokens)
}

func TestOpenaiHandlerBuffersUsageOnlyStreamForNonStreamClient(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		RelayFormat:     types.RelayFormatOpenAI,
		OriginModelName: "gpt-test",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-test",
			ChannelType:       constant.ChannelTypeOpenAI,
		},
	}
	resp := newChatCompletionSSE(http.StatusOK, `data: {"id":"chatcmpl-usage","object":"chat.completion.chunk","created":456,"model":"gpt-test","choices":[],"usage":{"prompt_tokens":12,"completion_tokens":0,"total_tokens":12}}

data: [DONE]
`)

	usage, newAPIError := OpenaiHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Header().Get("Content-Type"), "application/json")
	require.Equal(t, &dto.Usage{PromptTokens: 12, CompletionTokens: 0, TotalTokens: 12}, usage)

	var parsed dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &parsed))
	require.Equal(t, "chatcmpl-usage", parsed.Id)
	require.Equal(t, "chat.completion", parsed.Object)
	require.Len(t, parsed.Choices, 1)
	require.Equal(t, "assistant", parsed.Choices[0].Message.Role)
	require.Equal(t, "", parsed.Choices[0].Message.Content)
	require.Equal(t, "stop", parsed.Choices[0].FinishReason)
	require.Equal(t, 12, parsed.PromptTokens)
	require.Equal(t, 0, parsed.CompletionTokens)
	require.Equal(t, 12, parsed.TotalTokens)
}

func newChatCompletionSSE(statusCode int, body string) *http.Response {
	return &http.Response{
		StatusCode: statusCode,
		Header: http.Header{
			"Content-Type": []string{" Text/Event-Stream; charset=utf-8"},
		},
		Body: io.NopCloser(strings.NewReader(body)),
	}
}
