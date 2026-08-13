package openai

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
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func responseBillingRelayInfo(stream bool) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeOpenAI,
			UpstreamModelName: "test-model",
		},
		IsStream:             stream,
		RelayFormat:          types.RelayFormatOpenAI,
		OriginModelName:      "test-model",
		ShouldIncludeUsage:   true,
		ShouldIncludeBilling: true,
		DisablePing:          true,
		StartTime:            time.Now(),
		PriceData: types.PriceData{
			ModelRatio:      1,
			CompletionRatio: 2,
			GroupRatioInfo:  types.GroupRatioInfo{GroupRatio: 0.5},
		},
	}
}

func TestOpenaiHandlerIncludesRequestedBilling(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	body := `{"id":"chatcmpl_1","object":"chat.completion","created":1710000000,"model":"test-model","choices":[{"index":0,"message":{"role":"assistant","content":"hello"},"finish_reason":"stop"}],"usage":{"prompt_tokens":1000,"completion_tokens":500,"total_tokens":1500}}`
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"application/json"}},
	}

	usage, apiErr := OpenaiHandler(ctx, responseBillingRelayInfo(false), resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.NotNil(t, usage.Billing)
	assert.InDelta(t, 0.002, usage.Billing.TotalCost, 1e-12)

	var result dto.OpenAITextResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &result))
	require.NotNil(t, result.Usage.Billing)
	assert.Equal(t, "USD", result.Usage.Billing.Currency)
	assert.InDelta(t, 0.002, result.Usage.Billing.TotalCost, 1e-12)
}

func TestOaiStreamHandlerIncludesBillingInFinalUsageChunk(t *testing.T) {
	gin.SetMode(gin.TestMode)
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Set(common.RequestIdKey, "billing-stream-test")

	body := strings.Join([]string{
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"test-model","choices":[{"index":0,"delta":{"content":"hello"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl_1","object":"chat.completion.chunk","created":1710000000,"model":"test-model","choices":[],"usage":{"prompt_tokens":1000,"completion_tokens":500,"total_tokens":1500}}`,
		`data: [DONE]`,
		``,
	}, "\n")
	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}

	usage, apiErr := OaiStreamHandler(ctx, responseBillingRelayInfo(true), resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.NotNil(t, usage.Billing)
	got := recorder.Body.String()
	assert.Contains(t, got, `"billing":{"currency":"USD","total_cost":0.002`)
	assert.Contains(t, got, `data: [DONE]`)
}
