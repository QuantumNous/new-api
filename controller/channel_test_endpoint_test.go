package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/model_setting"

	"github.com/stretchr/testify/require"
)

func TestNormalizeChannelTestEndpointUsesResponsesCompatibilityPolicy(t *testing.T) {
	settings := model_setting.GetGlobalSettings()
	previous := settings.ChatCompletionsToResponsesPolicy
	settings.ChatCompletionsToResponsesPolicy = model_setting.ChatCompletionsToResponsesPolicy{
		Enabled:       true,
		ChannelIDs:    []int{4},
		ModelPatterns: []string{"^gpt-5.*$"},
	}
	t.Cleanup(func() {
		settings.ChatCompletionsToResponsesPolicy = previous
	})

	channel := &model.Channel{Id: 4, Type: constant.ChannelTypeOpenAI}
	require.Equal(
		t,
		string(constant.EndpointTypeOpenAIResponse),
		normalizeChannelTestEndpoint(channel, "gpt-5.6-sol", ""),
	)
	require.Empty(
		t,
		normalizeChannelTestEndpoint(channel, "claude-3-7-sonnet", ""),
	)
	require.Empty(
		t,
		normalizeChannelTestEndpoint(
			&model.Channel{Id: 5, Type: constant.ChannelTypeOpenAI},
			"gpt-5.6-sol",
			"",
		),
	)
}

func TestNormalizeChannelTestEndpointKeepsExplicitEndpoint(t *testing.T) {
	channel := &model.Channel{Id: 4, Type: constant.ChannelTypeOpenAI}
	require.Equal(
		t,
		string(constant.EndpointTypeOpenAI),
		normalizeChannelTestEndpoint(
			channel,
			"gpt-5.6-sol",
			string(constant.EndpointTypeOpenAI),
		),
	)
}
