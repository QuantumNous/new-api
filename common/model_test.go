package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func TestIsImageGenerationModelRecognizesGPTImageFamily(t *testing.T) {
	tests := []struct {
		name      string
		modelName string
		want      bool
	}{
		{name: "gpt image 1", modelName: "gpt-image-1", want: true},
		{name: "gpt image 1 mini", modelName: "gpt-image-1-mini", want: true},
		{name: "gpt image 1.5", modelName: "gpt-image-1.5", want: true},
		{name: "gpt image 2", modelName: "gpt-image-2", want: true},
		{name: "provider-prefixed gpt image 2", modelName: "openai/gpt-image-2", want: true},
		{name: "uppercase gpt image 2", modelName: "GPT-IMAGE-2", want: true},
		{name: "chat model", modelName: "gpt-5", want: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.want, IsImageGenerationModel(test.modelName))
		})
	}
}

func TestGetEndpointTypesByChannelTypePrioritizesGPTImageGeneration(t *testing.T) {
	endpointTypes := GetEndpointTypesByChannelType(constant.ChannelTypeOpenAI, "gpt-image-2")

	assert.Equal(t, []constant.EndpointType{
		constant.EndpointTypeImageGeneration,
		constant.EndpointTypeOpenAI,
	}, endpointTypes)
}
