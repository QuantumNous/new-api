package vertex

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLClaudeIncomingUsesGooglePublisher(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		RequestURLPath:  "/v1/messages",
		OriginModelName: "gemini-3.7-flash",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeVertexAi,
			ApiType:           constant.APITypeVertexAi,
			UpstreamModelName: "gemini-3.7-flash",
			ApiKey:            "test-key",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				VertexKeyType: dto.VertexKeyTypeAPIKey,
			},
		},
	}

	adaptor := &Adaptor{}
	adaptor.Init(info)
	require.Equal(t, RequestModeGemini, adaptor.RequestMode)

	got, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Contains(t, got, "/publishers/google/models/gemini-3.7-flash:generateContent")
	assert.NotContains(t, got, "/publishers/anthropic/")
	assert.True(t, strings.Contains(got, "key=test-key"))
}

func TestGetRequestURLStripsPublisherPrefixForGeminiModel(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		RequestURLPath:  "/v1/messages",
		OriginModelName: "gemini-3.7-flash",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeVertexAi,
			ApiType:           constant.APITypeVertexAi,
			UpstreamModelName: "google/gemini-3.7-flash",
			ApiKey:            "test-key",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				VertexKeyType: dto.VertexKeyTypeAPIKey,
			},
		},
	}

	adaptor := &Adaptor{}
	got, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Contains(t, got, "/publishers/google/models/gemini-3.7-flash:generateContent")
	assert.NotContains(t, got, "/models/google/gemini-3.7-flash")
	assert.Equal(t, types.RelayFormat(types.RelayFormatGemini), relaycommon.NativeTextFormat(info, types.RelayFormatClaude))
}
