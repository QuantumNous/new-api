package ali

import (
	"encoding/json"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestConvertOpenAIRequestPreservesThinkingBudgetForQwen(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model:          "qwen-plus",
		EnableThinking: json.RawMessage(`true`),
		ThinkingBudget: json.RawMessage(`128`),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "qwen-plus",
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, request)
	require.NoError(t, err)

	encoded, err := common.Marshal(converted)
	require.NoError(t, err)

	assert.True(t, gjson.GetBytes(encoded, "enable_thinking").Bool())
	assert.Equal(t, int64(128), gjson.GetBytes(encoded, "thinking_budget").Int())
}

func TestConvertOpenAIRequestDropsThinkingBudgetForNonQwen(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model:          "deepseek-r1",
		EnableThinking: json.RawMessage(`true`),
		ThinkingBudget: json.RawMessage(`128`),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "deepseek-r1",
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, request)
	require.NoError(t, err)

	encoded, err := common.Marshal(converted)
	require.NoError(t, err)

	assert.False(t, gjson.GetBytes(encoded, "thinking_budget").Exists())
}
