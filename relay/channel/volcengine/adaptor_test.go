package volcengine

import (
	"testing"

	channelconstant "github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTokenPlanRequestURL(t *testing.T) {
	for _, tc := range []struct {
		name   string
		format types.RelayFormat
		mode   int
		url    string
	}{
		{"Chat Completions", types.RelayFormatOpenAI, relayconstant.RelayModeChatCompletions, "https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions"},
		{"Responses", types.RelayFormatOpenAIResponses, relayconstant.RelayModeResponses, "https://ark.cn-beijing.volces.com/api/plan/v3/responses"},
		{"Messages", types.RelayFormatClaude, relayconstant.RelayModeChatCompletions, "https://ark.cn-beijing.volces.com/api/plan/v1/messages"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{
				RelayFormat: tc.format,
				RelayMode:   tc.mode,
				ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: channelconstant.VolcengineTokenPlanBaseURL},
			}
			url, err := (&Adaptor{}).GetRequestURL(info)
			require.NoError(t, err)
			assert.Equal(t, tc.url, url)
		})
	}
}
