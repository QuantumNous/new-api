package helper

import (
	"net/http/httptest"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestModelMappedHelperSendsExactCompactModel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("model_mapping", `{"gpt-5-openai-compact":"real-openai-compact"}`)
	info := &relaycommon.RelayInfo{
		RelayMode:           relayconstant.RelayModeResponsesCompact,
		OriginModelName:     "gpt-5",
		RequestedModel:      "gpt-5",
		LogicalBillingModel: "gpt-5-openai-compact",
		CompactAttemptStage: relaycommon.CompactAttemptExact,
		ChannelMeta:         &relaycommon.ChannelMeta{},
	}
	request := &dto.OpenAIResponsesRequest{Model: "gpt-5"}

	require.NoError(t, ModelMappedHelper(ctx, info, request))
	require.Equal(t, "real-openai-compact", request.Model)
	require.Equal(t, "real-openai-compact", info.UpstreamAttemptModel)
	require.Equal(t, "gpt-5-openai-compact", info.LogicalBillingModel)
}

func TestModelMappedHelperSendsBaseOnCompactFallback(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("model_mapping", `{"gpt-5":"real-openai-compact"}`)
	info := &relaycommon.RelayInfo{
		RelayMode:           relayconstant.RelayModeResponsesCompact,
		OriginModelName:     "gpt-5",
		RequestedModel:      "gpt-5",
		LogicalBillingModel: "gpt-5-openai-compact",
		CompactAttemptStage: relaycommon.CompactAttemptBase,
		ChannelMeta:         &relaycommon.ChannelMeta{},
	}
	request := &dto.OpenAIResponsesRequest{Model: "gpt-5"}

	require.NoError(t, ModelMappedHelper(ctx, info, request))
	require.Equal(t, "real", request.Model)
	require.Equal(t, "real", info.UpstreamAttemptModel)
	require.Equal(t, "gpt-5-openai-compact", info.LogicalBillingModel)
}

func TestModelMappedHelperUsesBaseIdentityForNonGPTCompact(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("model_mapping", `{"claude-3-5-sonnet-openai-compact":"suffix-upstream","claude-3-5-sonnet":"base-upstream"}`)
	info := &relaycommon.RelayInfo{
		RelayMode:           relayconstant.RelayModeResponsesCompact,
		RequestedModel:      "claude-3-5-sonnet",
		LogicalBillingModel: "claude-3-5-sonnet",
		CompactAttemptStage: relaycommon.CompactAttemptExact,
		ChannelMeta:         &relaycommon.ChannelMeta{},
	}
	request := &dto.OpenAIResponsesRequest{Model: "claude-3-5-sonnet-openai-compact"}

	require.NoError(t, ModelMappedHelper(ctx, info, request))
	require.Equal(t, "base-upstream", request.Model)
	require.Equal(t, "claude-3-5-sonnet", info.LogicalBillingModel)
}

func TestModelMappedHelperTreatsCompactSuffixAsRegularResponsesModel(t *testing.T) {
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("model_mapping", `{"gpt-5-openai-compact":"upstream-regular-model"}`)
	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeResponses,
		OriginModelName: "gpt-5-openai-compact",
		ChannelMeta:     &relaycommon.ChannelMeta{},
	}
	request := &dto.OpenAIResponsesRequest{Model: "gpt-5-openai-compact"}

	require.NoError(t, ModelMappedHelper(ctx, info, request))
	require.Equal(t, "upstream-regular-model", request.Model)
	require.Equal(t, "upstream-regular-model", info.UpstreamModelName)
	require.Empty(t, info.LogicalBillingModel)
	require.Empty(t, info.UpstreamAttemptModel)
}
