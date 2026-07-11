package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestIsImageGenerationModelRecognizesGPTImageFamily(t *testing.T) {
	tests := []struct {
		modelName string
		want      bool
	}{
		{modelName: "gpt-image-1", want: true},
		{modelName: "gpt-image-2", want: true},
		{modelName: "openai/gpt-image-3", want: true},
		{modelName: "GPT-IMAGE-2", want: true},
		{modelName: "gpt-5.6-terra", want: false},
	}

	for _, tt := range tests {
		t.Run(tt.modelName, func(t *testing.T) {
			require.Equal(t, tt.want, IsImageGenerationModel(tt.modelName))
		})
	}
}

func TestGPTImageFamilyPrefersImageGenerationEndpoint(t *testing.T) {
	endpoints := GetEndpointTypesByChannelType(constant.ChannelTypeOpenAI, "gpt-image-2")

	require.Equal(t, []constant.EndpointType{
		constant.EndpointTypeImageGeneration,
		constant.EndpointTypeOpenAI,
	}, endpoints)
}
