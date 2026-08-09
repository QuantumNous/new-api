package relay

import (
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relay/channel/codex"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIsResponsesEventStreamContentType(t *testing.T) {
	tests := []struct {
		name        string
		contentType string
		want        bool
	}{
		{name: "plain", contentType: "text/event-stream", want: true},
		{name: "mixed case with charset", contentType: "Text/Event-Stream; charset=utf-8", want: true},
		{name: "json", contentType: "application/json", want: false},
		{name: "empty", contentType: "", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, isResponsesEventStreamContentType(tt.contentType))
		})
	}
}

func TestChatCompletionsViaResponsesRestoresClientStreamAfterCodexHTTPError(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.Contains(t, string(body), `"stream":true`)
		assert.Equal(t, "text/event-stream", r.Header.Get("Accept"))

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusTooManyRequests)
		_, err = w.Write([]byte(`{"error":{"message":"retry later","type":"rate_limit_error"}}`))
		require.NoError(t, err)
	}))
	defer upstream.Close()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, common.RequestIdKey, "stream-state-test")

	info := newCodexChatResponsesTestInfo(upstream.URL)
	request := newCodexChatResponsesTestRequest()

	_, newApiErr := chatCompletionsViaResponses(c, info, &codex.Adaptor{}, request)

	require.NotNil(t, newApiErr)
	assert.Equal(t, http.StatusTooManyRequests, newApiErr.StatusCode)
	assert.False(t, info.IsStream)
	assert.Empty(t, c.Request.Header.Values("Accept"))
	assert.Equal(t, relayconstant.RelayModeChatCompletions, info.RelayMode)
	assert.Equal(t, "/v1/chat/completions", info.RequestURLPath)
}

func TestChatCompletionsViaResponsesRestoresClientStreamAfterCodexSSEHTTPError(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusServiceUnavailable)
		_, err := io.WriteString(w, `data: {"error":{"message":"temporarily unavailable","type":"server_error"}}\n\n`)
		require.NoError(t, err)
	}))
	defer upstream.Close()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, common.RequestIdKey, "stream-state-test")

	info := newCodexChatResponsesTestInfo(upstream.URL)
	request := newCodexChatResponsesTestRequest()

	_, newApiErr := chatCompletionsViaResponses(c, info, &codex.Adaptor{}, request)

	require.NotNil(t, newApiErr)
	assert.Equal(t, http.StatusServiceUnavailable, newApiErr.StatusCode)
	assert.False(t, info.IsStream)
	assert.Empty(t, c.Request.Header.Values("Accept"))
	assert.Equal(t, relayconstant.RelayModeChatCompletions, info.RelayMode)
	assert.Equal(t, "/v1/chat/completions", info.RequestURLPath)
}

func newCodexChatResponsesTestInfo(baseURL string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		IsStream:       false,
		RelayMode:      relayconstant.RelayModeChatCompletions,
		RequestURLPath: "/v1/chat/completions",
		RelayFormat:    relaytypes.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeCodex,
			ApiType:           constant.APITypeCodex,
			ApiKey:            `{"access_token":"test-token","account_id":"test-account"}`,
			ChannelBaseUrl:    baseURL,
			UpstreamModelName: "gpt-test",
		},
	}
}

func newCodexChatResponsesTestRequest() *dto.GeneralOpenAIRequest {
	return &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		Messages: []dto.Message{
			{Role: "user", Content: "hello"},
		},
	}
}

func TestChatCompletionsViaResponsesRestoresClientStreamAfterCodexBufferedSuccess(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.Contains(t, string(body), `"stream":true`)
		assert.Equal(t, "text/event-stream", r.Header.Get("Accept"))

		w.Header().Set("Content-Type", "text/event-stream")
		_, err = io.WriteString(w, strings.Join([]string{
			`data: {"type":"response.output_text.delta","delta":"hello"}`,
			`data: {"type":"response.completed","response":{"id":"resp_1","model":"gpt-test","status":"completed","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}`,
			`data: [DONE]`,
			``,
		}, "\n"))
		require.NoError(t, err)
	}))
	defer upstream.Close()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, common.RequestIdKey, "stream-state-test")

	info := newCodexChatResponsesTestInfo(upstream.URL)
	request := newCodexChatResponsesTestRequest()

	usage, newApiErr := chatCompletionsViaResponses(c, info, &codex.Adaptor{}, request)

	require.Nil(t, newApiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 2, usage.TotalTokens)
	assert.False(t, info.IsStream)
	assert.Empty(t, c.Request.Header.Values("Accept"))
	assert.Equal(t, "application/json", recorder.Header().Get("Content-Type"))
	assert.NotContains(t, recorder.Body.String(), "data:")
	assert.Contains(t, recorder.Body.String(), `"object":"chat.completion"`)
}

func TestChatCompletionsViaResponsesUsesActualJSONResponseFormat(t *testing.T) {
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()

		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		assert.Contains(t, string(body), `"stream":true`)
		assert.Equal(t, "text/event-stream", r.Header.Get("Accept"))

		w.Header().Set("Content-Type", "application/json")
		_, err = io.WriteString(w, `{"id":"resp_json","object":"response","created_at":1710000000,"status":"completed","model":"gpt-test","output":[{"id":"msg_1","type":"message","status":"completed","role":"assistant","content":[{"type":"output_text","text":"json response"}]}],"usage":{"input_tokens":2,"output_tokens":3,"total_tokens":5}}`)
		require.NoError(t, err)
	}))
	defer upstream.Close()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	c.Request.Header.Set("Content-Type", "application/json")
	common.SetContextKey(c, common.RequestIdKey, "response-format-test")

	info := newCodexChatResponsesTestInfo(upstream.URL)
	usage, newApiErr := chatCompletionsViaResponses(c, info, &codex.Adaptor{}, newCodexChatResponsesTestRequest())

	require.Nil(t, newApiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 5, usage.TotalTokens)
	assert.Contains(t, recorder.Body.String(), `"content":"json response"`)
	assert.NotContains(t, recorder.Body.String(), `data:`)
	assert.False(t, info.IsStream)
	assert.Empty(t, c.Request.Header.Values("Accept"))
}

func TestRecalcQuotaFromRatiosIgnoresInvalidMultipliers(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: hosttypes.PriceData{
			Quota: 100,
		},
	}
	info.PriceData.AddOtherRatio("duration", 2)

	quota, ok := recalcQuotaFromRatios(info, map[string]float64{
		"duration": 3,
		"zero":     0,
		"negative": -1,
		"nan":      math.NaN(),
		"inf":      math.Inf(1),
	})

	require.True(t, ok)
	assert.Equal(t, 150, quota)
	assert.True(t, info.PriceData.HasOtherRatio("duration"))
}

func TestRecalcQuotaFromRatiosRejectsAllInvalidAdjustedRatios(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: hosttypes.PriceData{
			Quota: 100,
		},
	}
	info.PriceData.AddOtherRatio("duration", 2)

	quota, ok := recalcQuotaFromRatios(info, map[string]float64{
		"zero":     0,
		"negative": -1,
		"nan":      math.NaN(),
		"inf":      math.Inf(1),
	})

	require.False(t, ok)
	assert.Equal(t, 0, quota)
	assert.True(t, info.PriceData.HasOtherRatio("duration"))
}
