package ali

import (
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestQwenImage3NativeRequestPreservesGenerationAndEditingContract(t *testing.T) {
	rawRequest := []byte(`{
		"model":"qwen-image-3.0-pro",
		"input":{"messages":[{"role":"user","content":[
			{"image":"https://example.com/first.png"},
			{"image":"https://example.com/second.png"},
			{"image":"https://example.com/third.png"},
			{"text":"turn the references into a poster"}
		]}]},
		"parameters":{
			"negative_prompt":"blurred text",
			"size":"2048*2048",
			"n":2,
			"prompt_extend":false,
			"prompt_extend_mode":"direct",
			"watermark":false,
			"seed":0
		}
	}`)

	var request dto.ImageRequest
	require.NoError(t, common.Unmarshal(rawRequest, &request))
	info := &relaycommon.RelayInfo{}

	converted, err := oaiImage2AliImageRequest(info, request, true)
	require.NoError(t, err)
	assert.Equal(t, "qwen-image-3.0-pro", converted.Model)
	require.NotNil(t, converted.Parameters.NegativePrompt)
	assert.Equal(t, "blurred text", *converted.Parameters.NegativePrompt)
	assert.Equal(t, "2048*2048", converted.Parameters.Size)
	assert.Equal(t, 2, converted.Parameters.N)
	require.NotNil(t, converted.Parameters.PromptExtend)
	assert.False(t, *converted.Parameters.PromptExtend)
	require.NotNil(t, converted.Parameters.PromptExtendMode)
	assert.Equal(t, "direct", *converted.Parameters.PromptExtendMode)
	require.NotNil(t, converted.Parameters.Watermark)
	assert.False(t, *converted.Parameters.Watermark)
	require.NotNil(t, converted.Parameters.Seed)
	assert.Zero(t, *converted.Parameters.Seed)
	assert.Equal(t, map[string]float64{"n": 2}, info.PriceData.OtherRatios())

	input, ok := converted.Input.(AliImageInput)
	require.True(t, ok)
	require.Len(t, input.Messages, 1)
	assert.Len(t, input.Messages[0].Content, 4)
}

func TestQwenImage3RejectsProviderSpecificQuantityLimits(t *testing.T) {
	tests := []struct {
		name    string
		request string
		wantErr string
	}{
		{
			name: "too many outputs",
			request: fmt.Sprintf(`{
				"model":"qwen-image-3.0-pro",
				"input":{"messages":[{"role":"user","content":[{"text":"poster"}]}]},
				"parameters":{"n":%d}
			}`, qwenImage3MaxOutputs+1),
			wantErr: "supports at most 6 output images",
		},
		{
			name: "too many reference images",
			request: `{
				"model":"qwen-image-3.0-pro",
				"input":{"messages":[{"role":"user","content":[
					{"image":"https://example.com/1.png"},
					{"image":"https://example.com/2.png"},
					{"image":"https://example.com/3.png"},
					{"image":"https://example.com/4.png"},
					{"text":"poster"}
				]}]}
			}`,
			wantErr: "supports at most 3 reference images",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var request dto.ImageRequest
			require.NoError(t, common.Unmarshal([]byte(tt.request), &request))

			_, err := oaiImage2AliImageRequest(&relaycommon.RelayInfo{}, request, true)
			require.ErrorContains(t, err, tt.wantErr)
		})
	}
}

func TestQwenImage3UsesSynchronousMultimodalEndpoint(t *testing.T) {
	info := &relaycommon.RelayInfo{
		RelayMode:       constant.RelayModeImagesGenerations,
		OriginModelName: "customer-image-model",
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl:    "https://dashscope.aliyuncs.com",
			UpstreamModelName: "qwen-image-3.0-pro",
		},
	}

	adaptor := &Adaptor{}
	url, err := adaptor.GetRequestURL(info)
	require.NoError(t, err)
	assert.Equal(t, "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation", url)

	converted, err := adaptor.ConvertImageRequest(nil, info, dto.ImageRequest{
		Model:  "qwen-image-3.0-pro",
		Prompt: "poster",
	})
	require.NoError(t, err)
	assert.True(t, adaptor.IsSyncImageModel)
	_, ok := converted.(*AliImageRequest)
	assert.True(t, ok)
}
