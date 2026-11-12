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
