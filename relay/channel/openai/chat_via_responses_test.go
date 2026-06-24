package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newResponsesToChatStreamTestContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Set(common.RequestIdKey, "responses-to-chat-test")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
	info := &relaycommon.RelayInfo{
		RelayFormat:        types.RelayFormatOpenAI,
		ShouldIncludeUsage: true,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-5.5",
		},
	}
	info.SetEstimatePromptTokens(37)
	return c, recorder, resp, info
}

func responsesSSE(lines ...string) string {
	var b strings.Builder
	for _, line := range lines {
		b.WriteString("data: ")
		b.WriteString(line)
		b.WriteString("\n\n")
	}
	b.WriteString("data: [DONE]\n\n")
	return b.String()
}

func TestOaiResponsesToChatStreamFallbackUsageMatchesResponseText2Usage(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := responsesSSE(
		`{"type":"response.created","response":{"id":"resp_test","created_at":1710000000,"model":"gpt-5.5"}}`,
		`{"type":"response.reasoning_summary_text.delta","delta":"Reasoning summary 123"}`,
		`{"type":"response.reasoning_summary_text.done"}`,
		`{"type":"response.reasoning_summary_text.delta","delta":"second paragraph"}`,
		`{"type":"response.output_text.delta","delta":" Visible output 中文"}`,
		`{"type":"response.output_item.added","item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"lookup","arguments":"{\"city\":\"Bei"}}`,
		`{"type":"response.function_call_arguments.delta","item_id":"fc_1","delta":"jing\"}"}`,
		`{"type":"response.completed","response":{"id":"resp_test","created_at":1710000001,"model":"gpt-5.5","usage":{"input_tokens":0,"output_tokens":0,"total_tokens":0}}}`,
	)

	c, recorder, resp, info := newResponsesToChatStreamTestContext(t, body)

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)

	expectedText := "Reasoning summary 123\n\nsecond paragraph Visible output 中文"
	expected := service.ResponseText2Usage(gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()), expectedText, info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens, usage.TotalTokens)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.Contains(t, recorder.Body.String(), `"usage":{"prompt_tokens":37`)
}

func TestOaiResponsesToChatStreamFallbackUsageCountsToolCalls(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := responsesSSE(
		`{"type":"response.created","response":{"id":"resp_test","created_at":1710000000,"model":"gpt-5.5"}}`,
		`{"type":"response.output_item.added","item":{"id":"fc_1","type":"function_call","call_id":"call_1","name":"lookup","arguments":"{\"city\":\"Bei"}}`,
		`{"type":"response.function_call_arguments.delta","item_id":"fc_1","delta":"jing\"}"}`,
		`{"type":"response.completed","response":{"id":"resp_test","created_at":1710000001,"model":"gpt-5.5","usage":{"input_tokens":0,"output_tokens":0,"total_tokens":0}}}`,
	)

	c, recorder, resp, info := newResponsesToChatStreamTestContext(t, body)

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)

	expectedText := `lookup{"city":"Beijing"}`
	expected := service.ResponseText2Usage(gin.CreateTestContextOnly(httptest.NewRecorder(), gin.New()), expectedText, info.UpstreamModelName, info.GetEstimatePromptTokens())
	assert.Equal(t, expected.PromptTokens, usage.PromptTokens)
	assert.Equal(t, expected.CompletionTokens, usage.CompletionTokens)
	assert.Equal(t, expected.TotalTokens, usage.TotalTokens)
	assert.True(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.Contains(t, recorder.Body.String(), `"finish_reason":"tool_calls"`)
}

func TestOaiResponsesToChatStreamUsesUpstreamUsageWithoutLocalCountFlag(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := responsesSSE(
		`{"type":"response.created","response":{"id":"resp_test","created_at":1710000000,"model":"gpt-5.5"}}`,
		`{"type":"response.output_text.delta","delta":"Visible output that must not be locally counted"}`,
		`{"type":"response.completed","response":{"id":"resp_test","created_at":1710000001,"model":"gpt-5.5","usage":{"input_tokens":11,"output_tokens":13,"total_tokens":24,"input_tokens_details":{"cached_tokens":7},"completion_tokens_details":{"reasoning_tokens":5}}}}`,
	)

	c, recorder, resp, info := newResponsesToChatStreamTestContext(t, body)

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 13, usage.CompletionTokens)
	assert.Equal(t, 24, usage.TotalTokens)
	assert.Equal(t, 11, usage.InputTokens)
	assert.Equal(t, 13, usage.OutputTokens)
	assert.Equal(t, 7, usage.PromptTokensDetails.CachedTokens)
	assert.Equal(t, 5, usage.CompletionTokenDetails.ReasoningTokens)
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.Contains(t, recorder.Body.String(), `"usage":{"prompt_tokens":11`)
}

func TestOaiResponsesToChatStreamCompletesUpstreamUsageTotalWithoutLocalCountFlag(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	body := responsesSSE(
		`{"type":"response.created","response":{"id":"resp_test","created_at":1710000000,"model":"gpt-5.5"}}`,
		`{"type":"response.output_text.delta","delta":"Visible output with upstream input and output tokens"}`,
		`{"type":"response.completed","response":{"id":"resp_test","created_at":1710000001,"model":"gpt-5.5","usage":{"input_tokens":11,"output_tokens":13,"total_tokens":0}}}`,
	)

	c, recorder, resp, info := newResponsesToChatStreamTestContext(t, body)

	usage, err := OaiResponsesToChatStreamHandler(c, info, resp)
	require.Nil(t, err)
	require.NotNil(t, usage)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 13, usage.CompletionTokens)
	assert.Equal(t, 24, usage.TotalTokens)
	assert.Equal(t, 11, usage.InputTokens)
	assert.Equal(t, 13, usage.OutputTokens)
	assert.False(t, common.GetContextKeyBool(c, constant.ContextKeyLocalCountTokens))
	assert.Contains(t, recorder.Body.String(), `"usage":{"prompt_tokens":11`)
}
