package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/require"
)

func TestShouldUseResponsesTranscriptReplayForCodexAPI(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeCodex,
		},
	}

	require.True(t, shouldUseResponsesTranscriptReplay(info))
}

func TestShouldUseResponsesTranscriptReplayWhenChannelSwitchEnabled(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeOpenAI,
			ChannelOtherSettings: dto.ChannelOtherSettings{
				ResponsesTranscriptReplayEnabled: true,
			},
		},
	}

	require.True(t, shouldUseResponsesTranscriptReplay(info))
}

func TestShouldUseResponsesTranscriptReplayIgnoresNormalOpenAIResponsesChannel(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:    constant.ChannelTypeOpenAI,
			ApiType:        constant.APITypeOpenAI,
			ChannelBaseUrl: "https://api.openai.com",
		},
	}

	require.False(t, shouldUseResponsesTranscriptReplay(info))
}

func TestShouldRetryResponsesTranscriptReplayIgnoresPayloadTooLarge(t *testing.T) {
	require.False(t, shouldRetryResponsesTranscriptReplay(413, []byte(`<html>too large</html>`), []byte(`{
		"input":[{"type":"reasoning","encrypted_content":"bad-ciphertext","summary":[]}]
	}`)))
}
