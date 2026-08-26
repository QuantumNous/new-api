package relay

import (
	"math"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
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

func TestShouldUpgradeChatToResponsesWhenClientWantsThinking(t *testing.T) {
	openaiInfo := testRelayInfo(constant.APITypeOpenAI, "gpt-5.6-sol")
	assert.False(t, shouldUpgradeChatToResponses(openaiInfo), "no thinking request stays Chat")

	openaiInfo.Request = &dto.GeneralOpenAIRequest{
		Model:           "gpt-5.6-sol",
		ReasoningEffort: "high",
	}
	assert.True(t, shouldUpgradeChatToResponses(openaiInfo), "Chat reasoning_effort upgrades to Responses for summary thinking")

	claudeInfo := testRelayInfo(constant.APITypeOpenAI, "gpt-5.6-sol")
	claudeInfo.Request = &dto.ClaudeRequest{
		Model:    "gpt-5.6-sol",
		Thinking: &dto.Thinking{Type: "adaptive"},
	}
	assert.True(t, shouldUpgradeChatToResponses(claudeInfo))

	deepseekInfo := testRelayInfo(constant.APITypeDeepSeek, "glm-5.2")
	deepseekInfo.Request = &dto.GeneralOpenAIRequest{ReasoningEffort: "high"}
	assert.False(t, shouldUpgradeChatToResponses(deepseekInfo), "Chat-only channels must not receive Responses")

	openAICompatibleInfo := testRelayInfo(constant.APITypeOpenAI, "glm-5.2")
	openAICompatibleInfo.Request = &dto.GeneralOpenAIRequest{ReasoningEffort: "high"}
	assert.False(t, shouldUpgradeChatToResponses(openAICompatibleInfo), "OpenAI-compatible Chat models must not receive Responses")
}

func TestShouldUpgradeChatToResponsesRequiresResponsesNativeChannel(t *testing.T) {
	assert.False(t, shouldUpgradeChatToResponses(nil))

	openaiInfo := testRelayInfo(constant.APITypeOpenAI, "gpt-5")
	assert.False(t, shouldUpgradeChatToResponses(openaiInfo), "policy is off by default")

	deepseekInfo := testRelayInfo(constant.APITypeDeepSeek, "gpt-5")
	assert.False(t, shouldUpgradeChatToResponses(deepseekInfo))

	geminiInfo := testRelayInfo(constant.APITypeGemini, "gpt-5")
	assert.False(t, shouldUpgradeChatToResponses(geminiInfo))

	newAPIInfo := testRelayInfo(constant.APITypeNewAPI, "gpt-5")
	assert.False(t, shouldUpgradeChatToResponses(newAPIInfo))

	passthrough := testRelayInfo(constant.APITypeOpenAI, "gpt-5")
	passthrough.ChannelSetting.PassThroughBodyEnabled = true
	assert.False(t, shouldUpgradeChatToResponses(passthrough))

	settings := model_setting.GetGlobalSettings()
	originalPolicy := settings.ChatCompletionsToResponsesPolicy
	t.Cleanup(func() { settings.ChatCompletionsToResponsesPolicy = originalPolicy })
	settings.ChatCompletionsToResponsesPolicy = model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       true,
		AllChannels:   true,
		ModelPatterns: []string{`^grok-4\.6$`, `^gpt-5$`},
	}

	xaiInfo := testRelayInfo(constant.APITypeXai, "grok-4.6")
	assert.True(t, shouldUpgradeChatToResponses(xaiInfo), "xAI provider natively supports Responses")
	assert.False(t, shouldUpgradeChatToResponses(geminiInfo), "Gemini provider must not receive Responses payloads")
}
