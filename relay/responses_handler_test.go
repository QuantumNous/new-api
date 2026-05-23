package relay

import (
	"bytes"
	"compress/gzip"
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

func TestGzipResponsesOutboundBodyRoundTrip(t *testing.T) {
	original := []byte(strings.Repeat(`{"type":"message","role":"user","content":"hello"}`, 20000))

	gzipBody, err := gzipResponsesOutboundBody(original)
	require.NoError(t, err)
	require.Less(t, len(gzipBody), len(original))

	reader, err := gzip.NewReader(bytes.NewReader(gzipBody))
	require.NoError(t, err)
	defer reader.Close()

	decompressed, err := io.ReadAll(reader)
	require.NoError(t, err)
	require.Equal(t, original, decompressed)
}

func TestNewResponsesOutboundJSONBodyGzipsLargeReplayEnabledBody(t *testing.T) {
	original := []byte(`{"input":"` + strings.Repeat("x", responsesOutboundGzipMinBytes) + `"}`)
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 5,
			ApiType:   constant.APITypeCodex,
		},
	}

	body, closer, newAPIError := newResponsesOutboundJSONBody(nil, info, original)
	require.Nil(t, newAPIError)
	defer closer.Close()

	require.Equal(t, "gzip", info.UpstreamRequestBodyEncoding)
	require.Less(t, info.UpstreamRequestBodySize, int64(len(original)))

	gzipBody, err := io.ReadAll(body)
	require.NoError(t, err)
	require.Equal(t, info.UpstreamRequestBodySize, int64(len(gzipBody)))

	reader, err := gzip.NewReader(bytes.NewReader(gzipBody))
	require.NoError(t, err)
	defer reader.Close()

	decompressed, err := io.ReadAll(reader)
	require.NoError(t, err)
	require.Equal(t, original, decompressed)
}

func TestNewResponsesOutboundJSONBodyDoesNotGzipNormalOpenAIResponses(t *testing.T) {
	original := []byte(`{"input":"` + strings.Repeat("x", responsesOutboundGzipMinBytes) + `"}`)
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelId: 5,
			ApiType:   constant.APITypeOpenAI,
		},
	}

	body, closer, newAPIError := newResponsesOutboundJSONBody(nil, info, original)
	require.Nil(t, newAPIError)
	defer closer.Close()

	require.Empty(t, info.UpstreamRequestBodyEncoding)
	require.Equal(t, int64(len(original)), info.UpstreamRequestBodySize)

	outboundBody, err := io.ReadAll(body)
	require.NoError(t, err)
	require.Equal(t, original, outboundBody)
}
