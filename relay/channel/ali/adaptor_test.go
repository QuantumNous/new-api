package ali

import (
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestConvertRequestsFiltersThinkingBudgetByMappedUpstreamModel(t *testing.T) {
	budget := 128
	tests := []struct {
		name          string
		upstreamModel string
		wantBudget    bool
	}{
		{name: "qwen", upstreamModel: "qwen-plus", wantBudget: true},
		{name: "qwq explicit provider prefix", upstreamModel: "provider/QwQ-32B", wantBudget: true},
		{name: "mapped non-qwen", upstreamModel: "deepseek-r1", wantBudget: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{UpstreamModelName: test.upstreamModel}}
			chatValue, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, &dto.GeneralOpenAIRequest{
				Model:          "qwen-client-alias",
				ThinkingBudget: &budget,
			})
			require.NoError(t, err)
			chat, ok := chatValue.(*dto.GeneralOpenAIRequest)
			require.True(t, ok)
			assert.Equal(t, test.wantBudget, chat.ThinkingBudget != nil)

			responsesValue, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(nil, info, dto.OpenAIResponsesRequest{
				Model:          "qwen-client-alias",
				ThinkingBudget: &budget,
			})
			require.NoError(t, err)
			responses, ok := responsesValue.(dto.OpenAIResponsesRequest)
			require.True(t, ok)
			assert.Equal(t, test.wantBudget, responses.ThinkingBudget != nil)
		})
	}
}
