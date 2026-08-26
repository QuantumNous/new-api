package relay

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"
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
			assert.Equal(t, tt.want, relaycommon.IsEventStreamContentType(tt.contentType))
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

func useResponsesRoutingPolicy(t *testing.T, policy model_setting.ChatCompletionsToResponsesPolicy) {
	t.Helper()
	settings := model_setting.GetGlobalSettings()
	originalPolicy := settings.ChatCompletionsToResponsesPolicy
	originalPassThrough := settings.PassThroughRequestEnabled
	t.Cleanup(func() {
		settings.ChatCompletionsToResponsesPolicy = originalPolicy
		settings.PassThroughRequestEnabled = originalPassThrough
	})
	settings.ChatCompletionsToResponsesPolicy = policy
	settings.PassThroughRequestEnabled = false
}

func TestResolveTextNativeOverrideOpenAIAutomaticRouting(t *testing.T) {
	useResponsesRoutingPolicy(t, model_setting.ChatCompletionsToResponsesPolicy{})

	gptInfo := testRelayInfo(constant.APITypeOpenAI, "public-alias")
	gptInfo.UpstreamModelName = "openai/GPT-5.6-sol"
	assert.Equal(t, relaytypes.RelayFormat(relaytypes.RelayFormatOpenAIResponses), resolveTextNativeOverride(gptInfo))

	glmInfo := testRelayInfo(constant.APITypeOpenAI, "glm-5.2")
	assert.Equal(t, relaytypes.RelayFormatOpenAI, resolveTextNativeOverride(glmInfo))

	responsesOnly := testRelayInfo(constant.APITypeOpenAI, "openai/o3-pro")
	assert.Equal(t, relaytypes.RelayFormat(relaytypes.RelayFormatOpenAIResponses), resolveTextNativeOverride(responsesOnly))
}

func TestResolveTextNativeOverrideOpenAICustomRulesAreAuthoritative(t *testing.T) {
	useResponsesRoutingPolicy(t, model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       true,
		AllChannels:   true,
		ModelPatterns: []string{`^glm-5\.2$`},
	})

	matched := testRelayInfo(constant.APITypeOpenAI, "public-alias")
	matched.UpstreamModelName = "glm-5.2"
	assert.Equal(t, relaytypes.RelayFormat(relaytypes.RelayFormatOpenAIResponses), resolveTextNativeOverride(matched))

	unmatchedGPT := testRelayInfo(constant.APITypeOpenAI, "gpt-5.6-sol")
	unmatchedGPT.Request = &dto.GeneralOpenAIRequest{ReasoningEffort: "high"}
	assert.Equal(t, relaytypes.RelayFormatOpenAI, resolveTextNativeOverride(unmatchedGPT), "thinking must not bypass an enabled custom rule")

	responsesOnly := testRelayInfo(constant.APITypeOpenAI, "o3-pro")
	assert.Equal(t, relaytypes.RelayFormat(relaytypes.RelayFormatOpenAIResponses), resolveTextNativeOverride(responsesOnly))
}

func TestResolveTextNativeOverrideOpenAIPassthroughPreservesClientProtocol(t *testing.T) {
	useResponsesRoutingPolicy(t, model_setting.ChatCompletionsToResponsesPolicy{})

	chat := testRelayInfo(constant.APITypeOpenAI, "gpt-5.6-sol")
	chat.RelayFormat = relaytypes.RelayFormatOpenAI
	chat.ChannelSetting.PassThroughBodyEnabled = true
	assert.Equal(t, relaytypes.RelayFormatOpenAI, resolveTextNativeOverride(chat))

	responses := testRelayInfo(constant.APITypeOpenAI, "glm-5.2")
	responses.RelayFormat = relaytypes.RelayFormatOpenAIResponses
	responses.ChannelSetting.PassThroughBodyEnabled = true
	assert.Equal(t, relaytypes.RelayFormat(relaytypes.RelayFormatOpenAIResponses), resolveTextNativeOverride(responses))
}

func TestResolveTextNativeOverrideOtherProvidersRetainCapabilityChecks(t *testing.T) {
	assert.Empty(t, resolveTextNativeOverride(nil))

	deepseekInfo := testRelayInfo(constant.APITypeDeepSeek, "gpt-5")
	deepseekInfo.Request = &dto.GeneralOpenAIRequest{ReasoningEffort: "high"}
	assert.Empty(t, resolveTextNativeOverride(deepseekInfo))

	geminiInfo := testRelayInfo(constant.APITypeGemini, "gpt-5")
	assert.Empty(t, resolveTextNativeOverride(geminiInfo))

	newAPIInfo := testRelayInfo(constant.APITypeNewAPI, "gpt-5")
	assert.Empty(t, resolveTextNativeOverride(newAPIInfo))

	xaiInfo := testRelayInfo(constant.APITypeXai, "grok-4.6")
	xaiInfo.Request = &dto.GeneralOpenAIRequest{ReasoningEffort: "high"}
	assert.Equal(t, relaytypes.RelayFormat(relaytypes.RelayFormatOpenAIResponses), resolveTextNativeOverride(xaiInfo))
}
