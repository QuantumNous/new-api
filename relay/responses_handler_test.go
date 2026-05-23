package relay

import (
	"io"
	"strings"
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

func TestNewResponsesOutboundJSONBodyKeepsLargeReplayBodyAsJSON(t *testing.T) {
	original := []byte(`{"input":"` + strings.Repeat("x", 900*1024) + `"}`)
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 5,
			ApiType:   constant.APITypeCodex,
		},
	}

	body, closer, newAPIError := newResponsesOutboundJSONBody(info, original)
	require.Nil(t, newAPIError)
	defer closer.Close()

	outboundBody, err := io.ReadAll(body)
	require.NoError(t, err)
	require.Equal(t, int64(len(original)), info.UpstreamRequestBodySize)
	require.Equal(t, original, outboundBody)
}

func TestNewResponsesOutboundJSONBodyDoesNotGzipNormalOpenAIResponses(t *testing.T) {
	original := []byte(`{"input":"` + strings.Repeat("x", 900*1024) + `"}`)
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 5,
			ApiType:   constant.APITypeOpenAI,
		},
	}

	body, closer, newAPIError := newResponsesOutboundJSONBody(info, original)
	require.Nil(t, newAPIError)
	defer closer.Close()

	require.Equal(t, int64(len(original)), info.UpstreamRequestBodySize)

	outboundBody, err := io.ReadAll(body)
	require.NoError(t, err)
	require.Equal(t, original, outboundBody)
}
