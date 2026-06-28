package ali

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestConvertToAliRequestPreservesExplicitZeroValueParameters(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		OriginModelName: "wan2.5-t2v-preview",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "wan2.5-t2v-preview",
			IsModelMapped:     true,
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt: "a quiet mountain lake",
		Model:  "wan2.5-t2v-preview",
		Size:   "1920*1080",
		Metadata: map[string]interface{}{
			"parameters": map[string]interface{}{
				"duration":      0,
				"prompt_extend": false,
				"watermark":     false,
				"seed":          0,
			},
		},
	}

	aliReq, err := adaptor.convertToAliRequest(info, req)
	require.NoError(t, err)

	require.NotNil(t, aliReq.Parameters.Duration)
	require.Equal(t, 0, *aliReq.Parameters.Duration)
	require.NotNil(t, aliReq.Parameters.PromptExtend)
	require.False(t, *aliReq.Parameters.PromptExtend)
	require.NotNil(t, aliReq.Parameters.Watermark)
	require.False(t, *aliReq.Parameters.Watermark)
	require.NotNil(t, aliReq.Parameters.Seed)
	require.Equal(t, 0, *aliReq.Parameters.Seed)

	encoded, err := common.Marshal(aliReq)
	require.NoError(t, err)

	require.True(t, gjson.GetBytes(encoded, "parameters.duration").Exists())
	require.EqualValues(t, 0, gjson.GetBytes(encoded, "parameters.duration").Int())
	require.True(t, gjson.GetBytes(encoded, "parameters.prompt_extend").Exists())
	require.False(t, gjson.GetBytes(encoded, "parameters.prompt_extend").Bool())
	require.True(t, gjson.GetBytes(encoded, "parameters.watermark").Exists())
	require.False(t, gjson.GetBytes(encoded, "parameters.watermark").Bool())
	require.True(t, gjson.GetBytes(encoded, "parameters.seed").Exists())
	require.EqualValues(t, 0, gjson.GetBytes(encoded, "parameters.seed").Int())
}

func TestConvertToAliRequestKeepsDefaultPromptExtendAndDuration(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		OriginModelName: "wan2.5-t2v-preview",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "wan2.5-t2v-preview",
			IsModelMapped:     true,
		},
	}
	req := relaycommon.TaskSubmitReq{
		Prompt: "a quiet mountain lake",
		Model:  "wan2.5-t2v-preview",
		Size:   "1920*1080",
	}

	aliReq, err := adaptor.convertToAliRequest(info, req)
	require.NoError(t, err)

	require.NotNil(t, aliReq.Parameters.Duration)
	require.Equal(t, 5, *aliReq.Parameters.Duration)
	require.NotNil(t, aliReq.Parameters.PromptExtend)
	require.True(t, *aliReq.Parameters.PromptExtend)

	encoded, err := common.Marshal(aliReq)
	require.NoError(t, err)

	require.EqualValues(t, 5, gjson.GetBytes(encoded, "parameters.duration").Int())
	require.True(t, gjson.GetBytes(encoded, "parameters.prompt_extend").Bool())
	require.False(t, gjson.GetBytes(encoded, "parameters.watermark").Exists())
	require.False(t, gjson.GetBytes(encoded, "parameters.seed").Exists())
}
