package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestBedrockOpenAIModelClassification(t *testing.T) {
	tests := []struct {
		name          string
		model         string
		responsesOnly bool
		mantleChat    bool
		runtimeChat   bool
	}{
		{name: "frontier", model: "openai.gpt-5.6-sol", responsesOnly: true},
		{name: "frontier effort suffix", model: "openai.gpt-5.5-xhigh", responsesOnly: true},
		{name: "mantle gpt oss", model: "openai.gpt-oss-120b", mantleChat: true},
		{name: "safeguard chat only", model: "openai.gpt-oss-safeguard-20b"},
		{name: "runtime gpt oss", model: "openai.gpt-oss-20b-1:0", runtimeChat: true},
		{name: "unrelated", model: "gpt-5.6-sol"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.responsesOnly, IsBedrockOpenAIResponsesModel(tt.model))
			require.Equal(t, tt.mantleChat, IsBedrockOpenAIMantleChatModel(tt.model))
			require.Equal(t, tt.runtimeChat, IsBedrockOpenAIRuntimeChatModel(tt.model))
		})
	}
}

func TestBedrockOpenAIChannelMetadata(t *testing.T) {
	apiType, ok := ChannelType2APIType(constant.ChannelTypeAwsOpenAI)
	require.True(t, ok)
	require.Equal(t, constant.APITypeOpenAI, apiType)

	require.Equal(t,
		[]constant.EndpointType{constant.EndpointTypeOpenAIResponse},
		GetEndpointTypesByChannelType(constant.ChannelTypeAwsOpenAI, "openai.gpt-5.4"),
	)
	require.Equal(t,
		[]constant.EndpointType{constant.EndpointTypeOpenAI, constant.EndpointTypeOpenAIResponse},
		GetEndpointTypesByChannelType(constant.ChannelTypeAwsOpenAI, "openai.gpt-oss-120b"),
	)
	require.Equal(t,
		[]constant.EndpointType{constant.EndpointTypeOpenAI},
		GetEndpointTypesByChannelType(constant.ChannelTypeAwsOpenAI, "openai.gpt-oss-120b-1:0"),
	)
	require.Equal(t,
		[]constant.EndpointType{constant.EndpointTypeOpenAI},
		GetEndpointTypesByChannelType(constant.ChannelTypeAwsOpenAI, "openai.gpt-oss-safeguard-120b"),
	)
}
