package stepfun

import (
	"net/http"
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestAdaptorForwardsSupportedProtocolsNatively(t *testing.T) {
	gin.SetMode(gin.TestMode)
	adaptor := &Adaptor{}

	tests := []struct {
		name        string
		format      types.RelayFormat
		wantURL     string
		convert     func(*gin.Context, *relaycommon.RelayInfo) (any, error)
		wantRequest any
	}{
		{
			name:    "chat completions",
			format:  types.RelayFormatOpenAI,
			wantURL: "https://api.stepfun.com/v1/chat/completions",
			convert: func(c *gin.Context, info *relaycommon.RelayInfo) (any, error) {
				return adaptor.ConvertOpenAIRequest(c, info, &dto.GeneralOpenAIRequest{Model: "step-5-preview"})
			},
			wantRequest: &dto.GeneralOpenAIRequest{Model: "step-5-preview"},
		},
		{
			name:    "messages",
			format:  types.RelayFormatClaude,
			wantURL: "https://api.stepfun.com/v1/messages",
			convert: func(c *gin.Context, info *relaycommon.RelayInfo) (any, error) {
				return adaptor.ConvertClaudeRequest(c, info, &dto.ClaudeRequest{Model: "step-5-preview"})
			},
			wantRequest: &dto.ClaudeRequest{Model: "step-5-preview"},
		},
		{
			name:    "responses",
			format:  types.RelayFormatOpenAIResponses,
			wantURL: "https://api.stepfun.com/v1/responses",
			convert: func(c *gin.Context, info *relaycommon.RelayInfo) (any, error) {
				return adaptor.ConvertOpenAIResponsesRequest(c, info, dto.OpenAIResponsesRequest{Model: "step-5-preview"})
			},
			wantRequest: dto.OpenAIResponsesRequest{Model: "step-5-preview"},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			context, _ := gin.CreateTestContext(httptest.NewRecorder())
			context.Request = httptest.NewRequest(http.MethodPost, "/", nil)
			info := &relaycommon.RelayInfo{
				RelayFormat: test.format,
				ChannelMeta: &relaycommon.ChannelMeta{},
			}
			info.ChannelBaseUrl = "https://api.stepfun.com"
			info.ApiKey = "test-key"

			request, err := test.convert(context, info)
			require.NoError(t, err)
			assert.Equal(t, test.wantRequest, request)

			requestURL, err := adaptor.GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, test.wantURL, requestURL)

			header := http.Header{}
			require.NoError(t, adaptor.SetupRequestHeader(context, &header, info))
			assert.Equal(t, "Bearer test-key", header.Get("Authorization"))
		})
	}
}
