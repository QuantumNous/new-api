package volcengine

import (
	"net/http"
	"net/http/httptest"
	"testing"

	channelconstant "github.com/warjiang/new-api/constant"
	relaycommon "github.com/warjiang/new-api/relay/common"
	relayconstant "github.com/warjiang/new-api/relay/constant"
	"github.com/warjiang/new-api/relaykit/dto"
	"github.com/warjiang/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLForVolcEnginePlans(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		channelType int
		baseURL     string
		relayFormat types.RelayFormat
		relayMode   int
		want        string
	}{
		{
			name:        "agent plan anthropic messages",
			channelType: channelconstant.ChannelTypeVolcEngineAgentPlan,
			relayFormat: types.RelayFormatClaude,
			relayMode:   relayconstant.RelayModeChatCompletions,
			want:        "https://ark.cn-beijing.volces.com/api/plan/v1/messages",
		},
		{
			name:        "agent plan chat completions",
			channelType: channelconstant.ChannelTypeVolcEngineAgentPlan,
			relayMode:   relayconstant.RelayModeChatCompletions,
			want:        "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions",
		},
		{
			name:        "agent plan responses",
			channelType: channelconstant.ChannelTypeVolcEngineAgentPlan,
			relayMode:   relayconstant.RelayModeResponses,
			want:        "https://ark.cn-beijing.volces.com/api/plan/v3/responses",
		},
		{
			name:        "coding plan anthropic messages",
			channelType: channelconstant.ChannelTypeVolcEngineCodingPlan,
			relayFormat: types.RelayFormatClaude,
			relayMode:   relayconstant.RelayModeChatCompletions,
			want:        "https://ark.cn-beijing.volces.com/api/coding/v1/messages",
		},
		{
			name:        "coding plan chat completions",
			channelType: channelconstant.ChannelTypeVolcEngineCodingPlan,
			relayMode:   relayconstant.RelayModeChatCompletions,
			want:        "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
		},
		{
			name:        "coding plan responses",
			channelType: channelconstant.ChannelTypeVolcEngineCodingPlan,
			relayMode:   relayconstant.RelayModeResponses,
			want:        "https://ark.cn-beijing.volces.com/api/coding/v3/responses",
		},
		{
			name:        "legacy coding plan alias responses",
			channelType: channelconstant.ChannelTypeVolcEngine,
			baseURL:     "doubao-coding-plan",
			relayMode:   relayconstant.RelayModeResponses,
			want:        "https://ark.cn-beijing.volces.com/api/coding/v3/responses",
		},
		{
			name:        "ordinary volcengine responses unchanged",
			channelType: channelconstant.ChannelTypeVolcEngine,
			relayMode:   relayconstant.RelayModeResponses,
			want:        "https://ark.cn-beijing.volces.com/api/v3/responses",
		},
	}

	adaptor := &Adaptor{}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Parallel()
			info := &relaycommon.RelayInfo{
				RelayFormat: test.relayFormat,
				RelayMode:   test.relayMode,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType:    test.channelType,
					ChannelBaseUrl: test.baseURL,
				},
			}

			got, err := adaptor.GetRequestURL(info)

			require.NoError(t, err)
			assert.Equal(t, test.want, got)
		})
	}
}

func TestSetupRequestHeaderForVolcEnginePlan(t *testing.T) {
	tests := []struct {
		name      string
		key       string
		wantError string
	}{
		{name: "legacy inference key", key: "agent-plan-key"},
		{name: "composite model discovery credential", key: "agent-plan-key|access-key|secret-key"},
		{name: "invalid composite credential", key: "agent-plan-key|access-key", wantError: "expected PlanAPIKey"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
			c.Request.Header.Set("Content-Type", "application/json")
			header := make(http.Header)
			info := &relaycommon.RelayInfo{
				RelayMode: relayconstant.RelayModeResponses,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelType: channelconstant.ChannelTypeVolcEngineAgentPlan,
					ApiKey:      test.key,
				},
			}

			err := (&Adaptor{}).SetupRequestHeader(c, &header, info)
			if test.wantError != "" {
				require.ErrorContains(t, err, test.wantError)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, "Bearer agent-plan-key", header.Get("Authorization"))
			assert.Equal(t, "agent-plan-key", info.ApiKey)
		})
	}
}

func TestSetupRequestHeaderForOrdinaryVolcEngineCompositeCredential(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	header := make(http.Header)
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: channelconstant.ChannelTypeVolcEngine,
			ApiKey:      "ark-api-key|access-key|secret-key",
		},
	}

	err := (&Adaptor{}).SetupRequestHeader(c, &header, info)

	require.NoError(t, err)
	assert.Equal(t, "Bearer ark-api-key", header.Get("Authorization"))
	assert.Equal(t, "ark-api-key", info.ApiKey)
}

func TestConvertClaudeRequestPreservesVolcEnginePlanPayload(t *testing.T) {
	t.Parallel()

	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: channelconstant.ChannelTypeVolcEngineAgentPlan,
		},
	}
	request := &dto.ClaudeRequest{Model: "ark-code-latest"}

	got, err := (&Adaptor{}).ConvertClaudeRequest(c, info, request)

	require.NoError(t, err)
	assert.Same(t, request, got)
}
