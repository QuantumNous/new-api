package minimax

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLUsesNativeNotClientFormat(t *testing.T) {
	t.Parallel()
	info := &relaycommon.RelayInfo{
		RequestURLPath:  "/v1beta/models/MiniMax-M3:generateContent",
		OriginModelName: "MiniMax-M3",
		RelayFormat:     types.RelayFormatGemini,
		RelayMode:       relayconstant.RelayModeGemini,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeMiniMax,
			ApiType:           constant.APITypeMiniMax,
			UpstreamModelName: "MiniMax-M3",
			ChannelBaseUrl:    "https://api.minimax.chat",
		},
	}
	info.BuildTextPlan(false)
	got, err := GetRequestURL(info)
	require.NoError(t, err)
	require.True(t, strings.Contains(got, "/v1/text/chatcompletion_v2"), got)
	require.False(t, strings.Contains(got, "generateContent"), got)
}

func TestGetRequestURLClaudeClientUsesAnthropicPath(t *testing.T) {
	t.Parallel()
	info := &relaycommon.RelayInfo{
		RequestURLPath:  "/v1/messages",
		OriginModelName: "MiniMax-M3",
		RelayFormat:     types.RelayFormatClaude,
		RelayMode:       relayconstant.RelayModeUnknown,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       constant.ChannelTypeMiniMax,
			ApiType:           constant.APITypeMiniMax,
			UpstreamModelName: "MiniMax-M3",
			ChannelBaseUrl:    "https://api.minimax.chat",
		},
	}
	info.BuildTextPlan(false)
	got, err := GetRequestURL(info)
	require.NoError(t, err)
	require.True(t, strings.Contains(got, "/anthropic/v1/messages"), got)
}
