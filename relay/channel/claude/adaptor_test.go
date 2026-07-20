package claude

import (
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLUsesMessagesCountTokensPath(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelBaseUrl: "https://api.anthropic.com",
		RelayMode:      relayconstant.RelayModeClaudeCountTokens,
	}

	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	require.Equal(t, "https://api.anthropic.com/v1/messages/count_tokens", requestURL)
}

func TestGetRequestURLKeepsMessagesPathForClaudeMessages(t *testing.T) {
	adaptor := &Adaptor{}
	info := &relaycommon.RelayInfo{
		ChannelBaseUrl: "https://api.anthropic.com",
		RequestURLPath:  "/v1/messages",
	}

	requestURL, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	require.Equal(t, "https://api.anthropic.com/v1/messages", requestURL)
}
