package controller

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSelectChannelContributionEndpointRespectsChannelProtocol(t *testing.T) {
	tests := []struct {
		name          string
		channelType   int
		modelName     string
		endpointTypes []constant.EndpointType
		expected      constant.EndpointType
	}{
		{
			name:          "openai compatible claude model remains openai",
			channelType:   constant.ChannelTypeOpenAI,
			modelName:     "claude-3-7-sonnet",
			endpointTypes: []constant.EndpointType{constant.EndpointTypeAnthropic},
			expected:      constant.EndpointTypeOpenAI,
		},
		{
			name:          "openai compatible gemini model remains openai",
			channelType:   constant.ChannelTypeOpenRouter,
			modelName:     "gemini-2.5-pro",
			endpointTypes: []constant.EndpointType{constant.EndpointTypeGemini},
			expected:      constant.EndpointTypeOpenAI,
		},
		{
			name:        "native anthropic channel",
			channelType: constant.ChannelTypeAnthropic,
			modelName:   "claude-3-7-sonnet",
			expected:    constant.EndpointTypeAnthropic,
		},
		{
			name:        "native gemini channel",
			channelType: constant.ChannelTypeGemini,
			modelName:   "gemini-2.5-pro",
			expected:    constant.EndpointTypeGemini,
		},
		{
			name:          "embedding capability overrides chat protocol",
			channelType:   constant.ChannelTypeOpenAI,
			modelName:     "text-embedding-3-small",
			endpointTypes: []constant.EndpointType{constant.EndpointTypeEmbeddings},
			expected:      constant.EndpointTypeEmbeddings,
		},
		{
			name:          "multi protocol new api follows metadata",
			channelType:   constant.ChannelTypeNewAPI,
			modelName:     "claude-3-7-sonnet",
			endpointTypes: []constant.EndpointType{constant.EndpointTypeAnthropic, constant.EndpointTypeOpenAI},
			expected:      constant.EndpointTypeAnthropic,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			assert.Equal(t, test.expected, selectChannelContributionEndpoint(test.channelType, test.modelName, test.endpointTypes))
		})
	}
}

func TestValidateChannelContributionEndpointTypesRejectsAsyncMedia(t *testing.T) {
	for _, endpointType := range []constant.EndpointType{
		constant.EndpointTypeImageGeneration,
		constant.EndpointTypeOpenAIVideo,
	} {
		t.Run(string(endpointType), func(t *testing.T) {
			require.Error(t, validateChannelContributionEndpointTypes([]constant.EndpointType{endpointType}))
		})
	}
	require.NoError(t, validateChannelContributionEndpointTypes([]constant.EndpointType{
		constant.EndpointTypeOpenAI,
		constant.EndpointTypeOpenAIResponse,
		constant.EndpointTypeEmbeddings,
	}))
}

func TestChannelTestResponseRecorderCapsBufferedOutput(t *testing.T) {
	recorder := newChannelTestResponseRecorder(8)
	written, err := recorder.Write([]byte(strings.Repeat("x", 32)))

	require.NoError(t, err)
	assert.Equal(t, 32, written)
	assert.True(t, recorder.exceeded)
	assert.Equal(t, "xxxxxxxx", recorder.Body.String())
}
