package relay

import (
	"io"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/types"
	"github.com/stretchr/testify/require"
)

func TestShouldUseResponsesTranscriptReplayForCodexAPIRequiresChannelSwitch(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeCodex,
		},
	}

	require.False(t, shouldUseResponsesTranscriptReplay(info))
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

func TestShouldUseResponsesTranscriptReplayForCodexAPIWhenChannelSwitchEnabled(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ApiType: constant.APITypeCodex,
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

func TestResponsesTranscriptReplayErrorBodyPreservesStreamErrorCodes(t *testing.T) {
	streamErr := types.WithOpenAIError(types.OpenAIError{
		Message: `code: invalid_encrypted_content; message: The encrypted content gAAA...V2ln could not be verified. Reason: Encrypted content could not be decrypted or parsed.`,
		Type:    "invalid_request_error",
		Code:    "-4003",
	}, 500)

	body, err := responsesTranscriptReplayErrorBody(streamErr)

	require.NoError(t, err)
	require.True(t, shouldRetryResponsesTranscriptReplay(streamErr.StatusCode, body, []byte(`{"input":[]}`)))
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
