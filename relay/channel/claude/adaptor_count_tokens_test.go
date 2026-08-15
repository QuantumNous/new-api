package claude

import (
	"strings"
	"testing"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/stretchr/testify/require"
)

func TestGetRequestURLCountTokensAlwaysUsesBetaQuery(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode: relayconstant.RelayModeClaudeCountTokens,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://api.anthropic.com",
		},
	}

	got, err := (&Adaptor{}).GetRequestURL(info)

	require.NoError(t, err)
	require.Equal(t, "https://api.anthropic.com/v1/messages/count_tokens?beta=true", got)
}

func TestMergeClaudeCountTokensBeta(t *testing.T) {
	require.Equal(t, "token-counting-2024-11-01", mergeClaudeCountTokensBeta(""))
	beta := mergeClaudeCountTokensBeta("oauth-2025-04-20,token-counting-2024-11-01")
	require.Equal(t, 1, strings.Count(beta, "token-counting-2024-11-01"))
}
