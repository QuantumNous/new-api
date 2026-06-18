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
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newResponsesUsagePolicyContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}

	info := &relaycommon.RelayInfo{
		IsStream:           true,
		RelayFormat:        types.RelayFormatOpenAI,
		ChannelMeta:        &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o-mini"},
		ShouldIncludeUsage: false,
	}
	info.SetEstimatePromptTokens(5)
	return c, recorder, resp, info
}

func responsesStreamUsagePolicyBody() string {
	return strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"hello"}`,
		``,
		`data: {"type":"response.completed","response":{"id":"resp_1","model":"gpt-4o-mini","created_at":1710000000,"usage":{"input_tokens":11,"output_tokens":7,"total_tokens":18},"output":[{"type":"image_generation_call","quality":"high","size":"1024x1024"}]}}`,
		``,
	}, "\n")
}

func TestShouldTrustResponsesUsageNilInfoDefaultsToFalse(t *testing.T) {
	assert.False(t, shouldTrustResponsesUsage(nil))
}

func TestOaiResponsesStreamHandlerTrustUpstreamUsageDefaultUsesLocalFallback(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	c, recorder, resp, info := newResponsesUsagePolicyContext(t, responsesStreamUsagePolicyBody())

	usage, err := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, err)
	expected := service.ResponseText2Usage(c, "hello", info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens, usage.TotalTokens)
	assert.NotEqual(t, 18, usage.TotalTokens)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.True(t, common.GetContextKeyBool(c, "image_generation_call"))
	assert.Contains(t, recorder.Body.String(), `"type":"response.completed"`)
}

func TestOaiResponsesStreamHandlerTrustUpstreamUsageTrueKeepsUpstreamUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	c, _, resp, info := newResponsesUsagePolicyContext(t, responsesStreamUsagePolicyBody())
	value := true
	info.ChannelOtherSettings = dto.ChannelOtherSettings{TrustUpstreamUsage: &value}

	usage, err := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, err)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 7, usage.CompletionTokens)
	assert.Equal(t, 18, usage.TotalTokens)
}

func TestOaiResponsesStreamHandlerTrustUpstreamUsageTrueFallsBackWhenUsageMissing(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := strings.Join([]string{
		`data: {"type":"response.output_text.delta","delta":"hello"}`,
		``,
		`data: {"type":"response.completed","response":{"id":"resp_1","model":"gpt-4o-mini","created_at":1710000000}}`,
		``,
	}, "\n")
	c, _, resp, info := newResponsesUsagePolicyContext(t, body)
	value := true
	info.ChannelOtherSettings = dto.ChannelOtherSettings{TrustUpstreamUsage: &value}

	usage, err := OaiResponsesStreamHandler(c, info, resp)
	require.Nil(t, err)
	expected := service.ResponseText2Usage(c, "hello", info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens, usage.TotalTokens)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
}

func TestOaiResponsesToChatStreamHandlerTrustUpstreamUsageDefaultUsesLocalFallback(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	c, recorder, resp, info := newResponsesUsagePolicyContext(t, responsesStreamUsagePolicyBody())
	info.ShouldIncludeUsage = true

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	expected := service.ResponseText2Usage(c, "hello", info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens, usage.TotalTokens)
	assert.NotEqual(t, 18, usage.TotalTokens)
	assert.NotContains(t, recorder.Body.String(), `"prompt_tokens":11`)
}

func TestOaiResponsesToChatStreamHandlerTrustUpstreamUsageTrueKeepsUpstreamUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	c, _, resp, info := newResponsesUsagePolicyContext(t, responsesStreamUsagePolicyBody())
	value := true
	info.ChannelOtherSettings = dto.ChannelOtherSettings{TrustUpstreamUsage: &value}
	info.ShouldIncludeUsage = true

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 7, usage.CompletionTokens)
	assert.Equal(t, 18, usage.TotalTokens)
}

func TestOaiResponsesToChatHandlerTrustUpstreamUsageDefaultUsesLocalUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"id":"resp_1","object":"response","created_at":1710000000,"model":"gpt-4o-mini","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hello"}]}],"usage":{"input_tokens":11,"output_tokens":7,"total_tokens":18}}`
	c, recorder, resp, info := newResponsesUsagePolicyContext(t, body)

	usage, err := OaiResponsesToChatHandler(c, info, resp)
	require.Nil(t, err)
	expected := service.ResponseText2Usage(c, "hello", info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens, usage.TotalTokens)
	assert.Contains(t, recorder.Body.String(), `"prompt_tokens":5`)
	assert.NotContains(t, recorder.Body.String(), `"prompt_tokens":11`)
}

func TestOaiResponsesToChatHandlerTrustUpstreamUsageTrueKeepsUpstreamUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"id":"resp_1","object":"response","created_at":1710000000,"model":"gpt-4o-mini","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hello"}]}],"usage":{"input_tokens":11,"output_tokens":7,"total_tokens":18}}`
	c, recorder, resp, info := newResponsesUsagePolicyContext(t, body)
	value := true
	info.ChannelOtherSettings = dto.ChannelOtherSettings{TrustUpstreamUsage: &value}

	usage, err := OaiResponsesToChatHandler(c, info, resp)
	require.Nil(t, err)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 7, usage.CompletionTokens)
	assert.Equal(t, 18, usage.TotalTokens)
	assert.Contains(t, recorder.Body.String(), `"prompt_tokens":11`)
}

func TestOaiResponsesToChatHandlerTrustUpstreamUsageTrueFallsBackWhenUsageZero(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"id":"resp_1","object":"response","created_at":1710000000,"model":"gpt-4o-mini","output":[{"type":"message","role":"assistant","content":[{"type":"output_text","text":"hello"}]}],"usage":{"input_tokens":0,"output_tokens":0,"total_tokens":0}}`
	c, recorder, resp, info := newResponsesUsagePolicyContext(t, body)
	value := true
	info.ChannelOtherSettings = dto.ChannelOtherSettings{TrustUpstreamUsage: &value}

	usage, err := OaiResponsesToChatHandler(c, info, resp)
	require.Nil(t, err)
	expected := service.ResponseText2Usage(c, "hello", info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens, usage.TotalTokens)
	assert.Contains(t, recorder.Body.String(), `"prompt_tokens":5`)
}

func TestOaiResponsesCompactionHandlerTrustUpstreamUsageDefaultUsesLocalUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"id":"resp_compact_1","object":"response.compaction","created_at":1710000000,"output":"compact summary","usage":{"input_tokens":11,"output_tokens":7,"total_tokens":18}}`
	c, _, resp, info := newResponsesUsagePolicyContext(t, body)

	usage, err := OaiResponsesCompactionHandler(c, info, resp)
	require.Nil(t, err)
	expected := service.ResponseText2Usage(c, `"compact summary"`, info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens, usage.TotalTokens)
}

func TestOaiResponsesCompactionHandlerTrustUpstreamUsageTrueKeepsUpstreamUsage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"id":"resp_compact_1","object":"response.compaction","created_at":1710000000,"output":"compact summary","usage":{"input_tokens":11,"output_tokens":7,"total_tokens":18}}`
	c, _, resp, info := newResponsesUsagePolicyContext(t, body)
	value := true
	info.ChannelOtherSettings = dto.ChannelOtherSettings{TrustUpstreamUsage: &value}

	usage, err := OaiResponsesCompactionHandler(c, info, resp)
	require.Nil(t, err)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 7, usage.CompletionTokens)
	assert.Equal(t, 18, usage.TotalTokens)
}

func TestOaiResponsesCompactionHandlerTrustUpstreamUsageTrueFallsBackWhenUsageMissing(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"id":"resp_compact_1","object":"response.compaction","created_at":1710000000,"output":"compact summary"}`
	c, _, resp, info := newResponsesUsagePolicyContext(t, body)
	value := true
	info.ChannelOtherSettings = dto.ChannelOtherSettings{TrustUpstreamUsage: &value}

	usage, err := OaiResponsesCompactionHandler(c, info, resp)
	require.Nil(t, err)
	expected := service.ResponseText2Usage(c, `"compact summary"`, info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens, usage.TotalTokens)
}
