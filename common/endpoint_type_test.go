package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestGetEndpointTypesByChannelTypeCodex(t *testing.T) {
	tests := []struct {
		name      string
		modelName string
		expected  []constant.EndpointType
	}{
		{
			name:      "responses",
			modelName: "gpt-5.4",
			expected:  []constant.EndpointType{constant.EndpointTypeOpenAIResponse},
		},
		{
			name:      "responses compact",
			modelName: "gpt-5.4-openai-compact",
			expected:  []constant.EndpointType{constant.EndpointTypeOpenAIResponseCompact},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, GetEndpointTypesByChannelType(constant.ChannelTypeCodex, tt.modelName))
		})
	}
}
