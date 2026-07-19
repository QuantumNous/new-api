package relay

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRelayHandlersRejectRetryChannelImageOverrideBeforeConversion(t *testing.T) {
	gin.SetMode(gin.TestMode)
	tests := []struct {
		name        string
		path        string
		channelType int
		info        func() *relaycommon.RelayInfo
		invoke      func(*gin.Context, *relaycommon.RelayInfo) *types.NewAPIError
	}{
		{
			name:        "text",
			path:        "/v1/chat/completions",
			channelType: constant.ChannelTypeOpenAI,
			info: func() *relaycommon.RelayInfo {
				return &relaycommon.RelayInfo{
					RelayMode:       relayconstant.RelayModeChatCompletions,
					RelayFormat:     types.RelayFormatOpenAI,
					OriginModelName: "gpt-5",
					Request:         &dto.GeneralOpenAIRequest{Model: "gpt-5"},
				}
			},
			invoke: TextHelper,
		},
		{
			name:        "responses",
			path:        "/v1/responses",
			channelType: constant.ChannelTypeOpenAI,
			info: func() *relaycommon.RelayInfo {
				return &relaycommon.RelayInfo{
					RelayMode:       relayconstant.RelayModeResponses,
					RelayFormat:     types.RelayFormatOpenAIResponses,
					OriginModelName: "gpt-5",
					Request:         &dto.OpenAIResponsesRequest{Model: "gpt-5"},
				}
			},
			invoke: ResponsesHelper,
		},
		{
			name:        "gemini",
			path:        "/v1beta/models/gemini-2.5-flash:generateContent",
			channelType: constant.ChannelTypeGemini,
			info: func() *relaycommon.RelayInfo {
				return &relaycommon.RelayInfo{
					RelayMode:       relayconstant.RelayModeGemini,
					RelayFormat:     types.RelayFormatGemini,
					OriginModelName: "gemini-2.5-flash",
					Request:         &dto.GeminiChatRequest{},
				}
			},
			invoke: GeminiHelper,
		},
		{
			name:        "claude",
			path:        "/v1/messages",
			channelType: constant.ChannelTypeAnthropic,
			info: func() *relaycommon.RelayInfo {
				return &relaycommon.RelayInfo{
					RelayMode:       relayconstant.RelayModeChatCompletions,
					RelayFormat:     types.RelayFormatClaude,
					OriginModelName: "claude-sonnet-4-5",
					Request:         &dto.ClaudeRequest{Model: "claude-sonnet-4-5"},
				}
			},
			invoke: ClaudeHelper,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, test.path, nil)
			common.SetContextKey(c, constant.ContextKeyChannelType, test.channelType)
			common.SetContextKey(c, constant.ContextKeyOriginalModel, test.info().OriginModelName)
			common.SetContextKey(c, constant.ContextKeyChannelParamOverride, map[string]any{
				"operations": []any{map[string]any{
					"mode":  "set",
					"path":  "model",
					"value": "gpt-image-2",
				}},
			})
			common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{})
			common.SetContextKey(c, constant.ContextKeyChannelSetting, dto.ChannelSettings{})
			common.SetContextKey(c, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{})

			apiErr := test.invoke(c, test.info())

			require.NotNil(t, apiErr)
			assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
			assert.Equal(t, types.ErrorCodeInvalidRequest, apiErr.GetErrorCode())
			assert.Contains(t, apiErr.Error(), "POST /v1/images/generations")
		})
	}
}
