package cloudflare

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCfHandlerUsesValidUpstreamUsageExactly(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "cf-usage-test")

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "@cf/openai/gpt-oss-20b"},
	}
	info.SetEstimatePromptTokens(999)

	body := `{"id":"upstream-id","model":"upstream-model","choices":[{"index":0,"message":{"role":"assistant","content":"visible answer"},"finish_reason":"stop"}],"usage":{"prompt_tokens":11,"completion_tokens":31,"total_tokens":42,"completion_tokens_details":{"reasoning_tokens":23}}}`
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError, usage := cfHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 31, usage.CompletionTokens)
	assert.Equal(t, 23, usage.CompletionTokenDetails.ReasoningTokens)
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))

	var downstream dto.TextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &downstream))
	assert.Equal(t, 11, downstream.Usage.PromptTokens)
	assert.Equal(t, 31, downstream.Usage.CompletionTokens)
	assert.Equal(t, 23, downstream.Usage.CompletionTokenDetails.ReasoningTokens)
}

func TestCfHandlerFallsBackForZeroUsage(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "cf-zero-usage-test")

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: "@cf/openai/gpt-oss-20b"},
	}
	info.SetEstimatePromptTokens(999)

	body := `{"id":"upstream-id","model":"upstream-model","choices":[{"index":0,"message":{"role":"assistant","content":"visible answer","reasoning_content":"hidden reasoning"},"finish_reason":"stop"}],"usage":{"prompt_tokens":0,"completion_tokens":0,"total_tokens":0}}`
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError, usage := cfHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 999, usage.PromptTokens)
	expectedCompletionTokens := service.EstimateTokenByModel("@cf/openai/gpt-oss-20b", "visible answerhidden reasoning")
	assert.Equal(t, expectedCompletionTokens, usage.CompletionTokens)
	assert.Equal(t, usage.PromptTokens+usage.CompletionTokens, usage.TotalTokens)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))

	var downstream dto.TextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &downstream))
	assert.Equal(t, usage.PromptTokens, downstream.Usage.PromptTokens)
	assert.Equal(t, usage.CompletionTokens, downstream.Usage.CompletionTokens)
	assert.Equal(t, usage.TotalTokens, downstream.Usage.TotalTokens)
}

func TestCfStreamHandlerUsesFinalUpstreamUsage(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "cf-stream-usage-test")

	info := &relaycommon.RelayInfo{
		StartTime:          time.Unix(1_700_000_000, 0),
		ShouldIncludeUsage: true,
		ChannelMeta:        &relaycommon.ChannelMeta{UpstreamModelName: "@cf/openai/gpt-oss-20b"},
	}
	info.SetEstimatePromptTokens(999)

	body := strings.Join([]string{
		`data: {"id":"upstream-id","object":"chat.completion.chunk","model":"upstream-model","choices":[{"index":0,"delta":{"content":"visible answer"}}]}`,
		`data: {"id":"upstream-id","object":"chat.completion.chunk","model":"upstream-model","choices":[],"usage":{"prompt_tokens":11,"completion_tokens":31,"total_tokens":42,"completion_tokens_details":{"reasoning_tokens":23}}}`,
		`data: [DONE]`,
		"",
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError, usage := cfStreamHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 31, usage.CompletionTokens)
	assert.Equal(t, 23, usage.CompletionTokenDetails.ReasoningTokens)
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.Equal(t, 1, strings.Count(recorder.Body.String(), `"completion_tokens":31`))
	assert.Equal(t, 1, strings.Count(recorder.Body.String(), `"reasoning_tokens":23`))
}

func TestCfStreamHandlerFallsBackForZeroUsage(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "cf-stream-zero-usage-test")

	info := &relaycommon.RelayInfo{
		StartTime:          time.Unix(1_700_000_000, 0),
		ShouldIncludeUsage: true,
		ChannelMeta:        &relaycommon.ChannelMeta{UpstreamModelName: "@cf/openai/gpt-oss-20b"},
	}
	info.SetEstimatePromptTokens(999)

	body := strings.Join([]string{
		`data: {"id":"upstream-id","object":"chat.completion.chunk","model":"upstream-model","choices":[{"index":0,"delta":{"reasoning_content":"hidden reasoning"}}]}`,
		`data: {"id":"upstream-id","object":"chat.completion.chunk","model":"upstream-model","choices":[{"index":0,"delta":{"content":"visible answer"}}]}`,
		`data: {"id":"upstream-id","object":"chat.completion.chunk","model":"upstream-model","choices":[],"usage":{"prompt_tokens":0,"completion_tokens":0,"total_tokens":0}}`,
		`data: [DONE]`,
		"",
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError, usage := cfStreamHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 999, usage.PromptTokens)
	expectedCompletionTokens := service.EstimateTokenByModel("@cf/openai/gpt-oss-20b", "hidden reasoningvisible answer")
	assert.Equal(t, expectedCompletionTokens, usage.CompletionTokens)
	assert.Equal(t, usage.PromptTokens+usage.CompletionTokens, usage.TotalTokens)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.NotContains(t, recorder.Body.String(), `"prompt_tokens":0`)
	assert.Contains(t, recorder.Body.String(), `"prompt_tokens":999`)
}

func TestCfStreamHandlerOmitsUsageOnlyChunkWhenNotRequested(t *testing.T) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "cf-stream-no-usage-test")

	info := &relaycommon.RelayInfo{
		StartTime:          time.Unix(1_700_000_000, 0),
		ShouldIncludeUsage: false,
		ChannelMeta:        &relaycommon.ChannelMeta{UpstreamModelName: "@cf/openai/gpt-oss-20b"},
	}
	info.SetEstimatePromptTokens(999)

	body := strings.Join([]string{
		`data: {"id":"upstream-id","object":"chat.completion.chunk","model":"upstream-model","choices":[{"index":0,"delta":{"content":"visible answer"}}]}`,
		`data: {"id":"upstream-id","object":"chat.completion.chunk","model":"upstream-model","choices":[],"usage":{"prompt_tokens":11,"completion_tokens":31,"total_tokens":42,"completion_tokens_details":{"reasoning_tokens":23}}}`,
		`data: [DONE]`,
		"",
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
		Body:       io.NopCloser(strings.NewReader(body)),
	}

	newAPIError, usage := cfStreamHandler(c, info, resp)

	require.Nil(t, newAPIError)
	require.NotNil(t, usage)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 31, usage.CompletionTokens)
	assert.Equal(t, 23, usage.CompletionTokenDetails.ReasoningTokens)
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.Contains(t, recorder.Body.String(), "visible answer")
	assert.NotContains(t, recorder.Body.String(), `"choices":[]`)
	assert.NotContains(t, recorder.Body.String(), `"completion_tokens":31`)
}

func TestConvertOpenAIRequestForcesUpstreamStreamUsage(t *testing.T) {
	adaptor := &Adaptor{}
	request := &dto.GeneralOpenAIRequest{
		Stream:        common.GetPointer(true),
		StreamOptions: &dto.StreamOptions{IncludeUsage: false},
	}
	info := &relaycommon.RelayInfo{
		IsStream:  true,
		RelayMode: relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			SupportStreamOptions: true,
		},
	}

	converted, err := adaptor.ConvertOpenAIRequest(nil, info, request)

	require.NoError(t, err)
	require.Same(t, request, converted)
	require.NotNil(t, request.StreamOptions)
	assert.True(t, request.StreamOptions.IncludeUsage)
}
