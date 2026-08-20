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

func TestCopilotChannelTypeUsesDedicatedAPIType(t *testing.T) {
	apiType, ok := ChannelType2APIType(constant.ChannelTypeCopilot)
	if !ok {
		t.Fatal("Copilot channel type should be recognized")
	}
	if apiType != constant.APITypeCopilot {
		t.Fatalf("Copilot API type = %d, want %d", apiType, constant.APITypeCopilot)
	}
}

func TestGrokSubscriptionAPITypeMapping(t *testing.T) {
	apiType, ok := ChannelType2APIType(constant.ChannelTypeGrokSubscription)
	if !ok {
		t.Fatalf("ChannelType2APIType(GrokSubscription) ok = false, want true")
	}
	if apiType != constant.APITypeGrokSubscription {
		t.Fatalf("GrokSubscription API type = %d, want %d", apiType, constant.APITypeGrokSubscription)
	}
}
