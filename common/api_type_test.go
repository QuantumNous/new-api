package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestJimengReverseProxyChannelTypesUseOpenAIWireProtocol(t *testing.T) {
	for _, channelType := range []int{
		constant.ChannelTypeJimengProxy,
		constant.ChannelTypeJimengZhizinan,
	} {
		apiType, ok := ChannelType2APIType(channelType)
		if !ok {
			t.Fatalf("channel type %d should be recognized", channelType)
		}
		if apiType != constant.APITypeOpenAI {
			t.Fatalf("channel type %d api type = %d, want OpenAI", channelType, apiType)
		}
	}
}
