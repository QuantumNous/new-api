package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/stretchr/testify/assert"
)

func TestShouldOpenAIChannelUseResponsesPolicyAutomaticMode(t *testing.T) {
	t.Parallel()
	policy := model_setting.ChatCompletionsToResponsesPolicy{}

	assert.True(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 1, constant.ChannelTypeOpenAI, "gpt-5.6-sol"))
	assert.True(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 1, constant.ChannelTypeOpenAI, "OpenAI/GPT-4o"))
	assert.True(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 1, constant.ChannelTypeOpenAI, "o3-pro"))
	assert.False(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 1, constant.ChannelTypeOpenAI, "chatgpt-4o-latest"))
	assert.False(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 1, constant.ChannelTypeOpenAI, "glm-5.2"))
}

func TestShouldOpenAIChannelUseResponsesPolicyCustomMode(t *testing.T) {
	t.Parallel()
	policy := model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       true,
		AllChannels:   true,
		ModelPatterns: []string{`^glm-5\.2$`, `(?i)^gpt-custom$`},
	}

	assert.True(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 1, constant.ChannelTypeOpenAI, "glm-5.2"))
	assert.True(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 1, constant.ChannelTypeOpenAI, "GPT-CUSTOM"))
	assert.False(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 1, constant.ChannelTypeOpenAI, "gpt-5.6-sol"))
	assert.True(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 1, constant.ChannelTypeOpenAI, "o3-pro"), "Responses-only models must remain protected")
}

func TestShouldOpenAIChannelUseResponsesPolicyOnlyOverridesSelectedChannels(t *testing.T) {
	t.Parallel()
	policy := model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       true,
		ChannelIDs:    []int{7},
		ModelPatterns: []string{`^glm-5\.2$`},
	}

	assert.True(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 7, constant.ChannelTypeOpenAI, "glm-5.2"))
	assert.False(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 8, constant.ChannelTypeOpenAI, "glm-5.2"))
	assert.True(t, ShouldOpenAIChannelUseResponsesPolicy(policy, 8, constant.ChannelTypeOpenAI, "gpt-5"), "unselected channels keep automatic routing")
}
