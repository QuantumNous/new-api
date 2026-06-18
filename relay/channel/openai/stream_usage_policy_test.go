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
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newOpenAIStreamUsagePolicyContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}

	info := &relaycommon.RelayInfo{
		IsStream:           true,
		RelayMode:          relayconstant.RelayModeChatCompletions,
		RelayFormat:        types.RelayFormatOpenAI,
		ShouldIncludeUsage: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4o-mini",
		},
	}
	info.SetEstimatePromptTokens(5)

	return c, recorder, resp, info
}

func openAIStreamUsagePolicyBody(content string) string {
	return strings.Join([]string{
		`data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1710000000,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"` + content + `"},"finish_reason":null}],"usage":null}`,
		``,
		`data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1710000000,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":11,"completion_tokens":7,"total_tokens":18}}`,
		``,
		`data: [DONE]`,
		``,
	}, "\n")
}

func TestOaiStreamHandlerTrustUpstreamUsageDefaultUsesLocalFallback(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	content := "hello"
	c, recorder, resp, info := newOpenAIStreamUsagePolicyContext(t, openAIStreamUsagePolicyBody(content))

	usage, err := OaiStreamHandler(c, info, resp)
	require.Nil(t, err)

	expected := service.ResponseText2Usage(c, content, info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens, usage.TotalTokens)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.NotContains(t, recorder.Body.String(), `"prompt_tokens":11`)
}

func TestOaiStreamHandlerTrustUpstreamUsageTrueKeepsUpstreamUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	c, recorder, resp, info := newOpenAIStreamUsagePolicyContext(t, openAIStreamUsagePolicyBody("hello"))
	value := true
	info.ChannelOtherSettings = dto.ChannelOtherSettings{TrustUpstreamUsage: &value}

	usage, err := OaiStreamHandler(c, info, resp)
	require.Nil(t, err)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 7, usage.CompletionTokens)
	assert.Equal(t, 18, usage.TotalTokens)
	assert.Contains(t, recorder.Body.String(), `"prompt_tokens":11`)
}

func TestOpenaiHandlerTrustUpstreamUsageDefaultUsesLocalUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	content := "hello"
	body := `{"id":"chatcmpl-test","object":"chat.completion","created":1710000000,"model":"gpt-4o-mini","choices":[{"index":0,"message":{"role":"assistant","content":"` + content + `"},"finish_reason":"stop"}],"usage":{"prompt_tokens":11,"completion_tokens":7,"total_tokens":18}}`
	c, recorder, resp, info := newOpenAIStreamUsagePolicyContext(t, body)
	info.IsStream = false

	usage, err := OpenaiHandler(c, info, resp)
	require.Nil(t, err)
	expected := service.ResponseText2Usage(c, content, info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens, usage.TotalTokens)
	assert.Contains(t, recorder.Body.String(), `"prompt_tokens":5`)
	assert.NotContains(t, recorder.Body.String(), `"prompt_tokens":11`)
}

func TestOpenaiHandlerTrustUpstreamUsageTrueKeepsUpstreamUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"id":"chatcmpl-test","object":"chat.completion","created":1710000000,"model":"gpt-4o-mini","choices":[{"index":0,"message":{"role":"assistant","content":"hello"},"finish_reason":"stop"}],"usage":{"prompt_tokens":11,"completion_tokens":7,"total_tokens":18}}`
	c, recorder, resp, info := newOpenAIStreamUsagePolicyContext(t, body)
	info.IsStream = false
	value := true
	info.ChannelOtherSettings = dto.ChannelOtherSettings{TrustUpstreamUsage: &value}

	usage, err := OpenaiHandler(c, info, resp)
	require.Nil(t, err)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 7, usage.CompletionTokens)
	assert.Equal(t, 18, usage.TotalTokens)
	assert.Contains(t, recorder.Body.String(), `"prompt_tokens":11`)
}

func TestOpenaiHandlerTrustUpstreamUsageDefaultCountsToolCalls(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	arguments := `{"city":"Paris"}`
	body := `{"id":"chatcmpl-test","object":"chat.completion","created":1710000000,"model":"gpt-4o-mini","choices":[{"index":0,"message":{"role":"assistant","content":null,"tool_calls":[{"id":"call_1","type":"function","function":{"name":"lookup","arguments":"{\"city\":\"Paris\"}"}}]},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":11,"completion_tokens":7,"total_tokens":18}}`
	c, _, resp, info := newOpenAIStreamUsagePolicyContext(t, body)
	info.IsStream = false

	usage, err := OpenaiHandler(c, info, resp)
	require.Nil(t, err)
	expected := service.ResponseText2Usage(c, "lookup"+arguments, info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens+7, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens+7, usage.TotalTokens)
}

func TestHandleLastResponseUntrustedUsageOnlyChunkIsNotSent(t *testing.T) {
	var responseID string
	var created int64
	var systemFingerprint string
	var model string
	usage := &dto.Usage{}
	containStreamUsage := false
	shouldSendLastResp := true
	info := &relaycommon.RelayInfo{
		ShouldIncludeUsage: false,
		ChannelMeta:        &relaycommon.ChannelMeta{},
	}
	lastStreamData := `{"id":"chatcmpl-test","object":"chat.completion.chunk","created":1710000000,"model":"gpt-4o-mini","choices":[],"usage":{"prompt_tokens":11,"completion_tokens":7,"total_tokens":18}}`

	err := handleLastResponse(lastStreamData, &responseID, &created, &systemFingerprint, &model, &usage, &containStreamUsage, info, &shouldSendLastResp)
	require.NoError(t, err)
	assert.False(t, containStreamUsage)
	assert.False(t, shouldSendLastResp)
}
