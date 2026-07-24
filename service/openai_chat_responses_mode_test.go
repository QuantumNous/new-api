package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestShouldChatCompletionsUseResponsesForRelayRequiresBedrockFrontierConversion(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeAwsOpenAI,
			UpstreamModelName: "openai.gpt-5.6-terra",
			ChannelSetting: dto.ChannelSettings{
				PassThroughBodyEnabled: true,
			},
		},
	}

	require.True(t, ShouldChatCompletionsUseResponsesForRelay(info, true))
}

func TestShouldChatCompletionsUseResponsesForRelayDoesNotForceGptOss(t *testing.T) {
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeAwsOpenAI,
			UpstreamModelName: "openai.gpt-oss-120b",
		},
	}

	require.False(t, ShouldChatCompletionsUseResponsesForRelay(info, true))
	require.False(t, ShouldChatCompletionsUseResponsesForRelay(nil, false))
}
