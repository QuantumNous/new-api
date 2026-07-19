package relay

import (
	"io"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
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

func TestRecalcQuotaFromRatiosIgnoresInvalidMultipliers(t *testing.T) {
	info := &relaycommon.RelayInfo{
		PriceData: types.PriceData{
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
		PriceData: types.PriceData{
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

func TestChatCompletionsViaResponsesRejectsOverrideInjectedImageTool(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "gpt-5",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-5",
			ParamOverride: map[string]any{
				"tools": []any{map[string]any{"type": "image_generation"}},
			},
		},
	}
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-5",
		Messages: []dto.Message{
			{Role: "user", Content: "draw a red kite"},
		},
	}

	usage, apiErr := chatCompletionsViaResponses(c, info, nil, request)
	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeInvalidRequest, apiErr.GetErrorCode())
	assert.True(t, types.IsSkipRetryError(apiErr))
	assert.Contains(t, apiErr.Error(), "POST /v1/images/generations")
}

type convertedImagePayloadAdaptor struct {
	channel.Adaptor
	doRequestCalled bool
}

func (a *convertedImagePayloadAdaptor) ConvertOpenAIResponsesRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ dto.OpenAIResponsesRequest) (any, error) {
	return map[string]any{
		"model": "gpt-5",
		"tools": []any{map[string]any{"type": "image_generation"}},
	}, nil
}

func (a *convertedImagePayloadAdaptor) DoRequest(_ *gin.Context, _ *relaycommon.RelayInfo, _ io.Reader) (any, error) {
	a.doRequestCalled = true
	return nil, nil
}

func TestChatCompletionsViaResponsesRejectsConvertedImagePayloadBeforeRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "gpt-5",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-5",
		},
	}
	request := &dto.GeneralOpenAIRequest{
		Model: "gpt-5",
		Messages: []dto.Message{
			{Role: "user", Content: "tell me a story"},
		},
	}
	adaptor := &convertedImagePayloadAdaptor{}

	usage, apiErr := chatCompletionsViaResponses(c, info, adaptor, request)
	require.Nil(t, usage)
	require.NotNil(t, apiErr)
	assert.False(t, adaptor.doRequestCalled)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeInvalidRequest, apiErr.GetErrorCode())
	assert.True(t, types.IsSkipRetryError(apiErr))
	assert.Contains(t, apiErr.Error(), "POST /v1/images/generations")
}
