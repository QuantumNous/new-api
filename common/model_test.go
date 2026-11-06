package common_test

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func TestWanEndpointsDistinguishImagesFromVideos(t *testing.T) {
	for _, name := range []string{
		"wan2.7-image-pro", "wan2.7-image", "wan2.6-image", "wan2.6-t2i",
		"wan2.5-t2i-preview", "wan2.2-t2i-flash", "wan2.2-t2i-plus",
		"wanx2.1-t2i-turbo", "wanx2.1-t2i-plus", "wanx2.0-t2i-turbo",
	} {
		t.Run(name, func(t *testing.T) {
			assert.Contains(t, common.GetEndpointTypesByChannelType(constant.ChannelTypeAli, name), constant.EndpointTypeImageGeneration)
		})
	}
	for _, name := range []string{
		"wanx2.1-t2v-plus", "wanx2.1-t2v-turbo", "wanx2.1-i2v-plus", "wanx2.1-i2v-turbo",
	} {
		t.Run(name, func(t *testing.T) {
			assert.NotContains(t, common.GetEndpointTypesByChannelType(constant.ChannelTypeAli, name), constant.EndpointTypeImageGeneration)
		})
	}
}

// /v1/models reports the DeepSeek Search and Fetch routing names with their
// own endpoint on the channels that relay them; chat models keep their list.
func TestDeepSeekToolRoutingNamesReportTheirEndpoint(t *testing.T) {
	for _, channelType := range []int{constant.ChannelTypeDeepSeek, constant.ChannelTypeNewAPI} {
		assert.Equal(t, []constant.EndpointType{constant.EndpointTypeDeepSeekToolsSearch}, common.GetEndpointTypesByChannelType(channelType, constant.DeepSeekSearchModel))
		assert.Equal(t, []constant.EndpointType{constant.EndpointTypeDeepSeekToolsFetch}, common.GetEndpointTypesByChannelType(channelType, constant.DeepSeekFetchModel))
	}
	assert.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAI}, common.GetEndpointTypesByChannelType(constant.ChannelTypeDeepSeek, "deepseek-flash"))
}

func TestAliTextModelsReportResponsesAndMessagesEndpoints(t *testing.T) {
	for _, name := range []string{
		"qwen3.8-max", "qwen3.8-flash", "qwen3.7-max", "qwen3.7-plus",
		"qwen3.7-flash", "qwen3.6-plus", "qwen3.5-plus", "qwen-plus",
		"qwq-32b", "qvq-max", "deepseek-v4-pro", "glm-5.3", "kimi-k3",
		"minimax-m2.5", " QWEN3.8-MAX ",
	} {
		t.Run(name, func(t *testing.T) {
			endpoints := common.GetEndpointTypesByChannelType(constant.ChannelTypeAli, name)
			assert.Equal(t, []constant.EndpointType{
				constant.EndpointTypeOpenAI,
				constant.EndpointTypeOpenAIResponse,
				constant.EndpointTypeAnthropic,
			}, endpoints)
		})
	}

	for _, name := range []string{
		"qwen-image", "qwen-image-edit", "wan2.7-image", "wanx2.1-t2v-plus",
		"text-embedding-v4", "qwen3-embedding-8b", "qwen3-vl-embedding",
		"gte-rerank-v2", "qwen3-rerank", "qwen3-tts-flash", "qwen3-asr-flash",
		"qwen3-omni-flash-realtime", "custom-model", "",
	} {
		t.Run(name, func(t *testing.T) {
			endpoints := common.GetEndpointTypesByChannelType(constant.ChannelTypeAli, name)
			assert.NotContains(t, endpoints, constant.EndpointTypeOpenAIResponse)
			assert.NotContains(t, endpoints, constant.EndpointTypeAnthropic)
		})
	}

	// Another provider or an OpenAI-compatible wrapper with the same model
	// name must not inherit Bailian-specific protocol declarations.
	for _, channelType := range []int{constant.ChannelTypeOpenAI, constant.ChannelTypeOpenRouter} {
		assert.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAI},
			common.GetEndpointTypesByChannelType(channelType, "qwen3.8-max"))
	}
	assert.Equal(t, []constant.EndpointType{constant.EndpointTypeOpenAIResponse},
		common.GetEndpointTypesByChannelType(constant.ChannelTypeAli, "o3-pro"))
}
