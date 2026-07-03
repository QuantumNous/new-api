package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

// containsEndpointType reports whether the endpoint set includes target.
func containsEndpointType(endpoints []constant.EndpointType, target constant.EndpointType) bool {
	for _, e := range endpoints {
		if e == target {
			return true
		}
	}
	return false
}

// TestGetEndpointTypesByChannelType_VideoChannels asserts that video-capable
// channels resolve to the openai-video endpoint instead of defaulting to chat.
func TestGetEndpointTypesByChannelType_VideoChannels(t *testing.T) {
	cases := []struct {
		name        string
		channelType int
	}{
		{"Sora", constant.ChannelTypeSora},
		{"BlockRunVideo", constant.ChannelTypeBlockRunVideo},
		{"BlockRunSeedance", constant.ChannelTypeBlockRunSeedance},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := GetEndpointTypesByChannelType(tc.channelType, "some-video-model")
			if !containsEndpointType(got, constant.EndpointTypeOpenAIVideo) {
				t.Fatalf("channel %s (type %d): expected endpoints to contain %q, got %v",
					tc.name, tc.channelType, constant.EndpointTypeOpenAIVideo, got)
			}
		})
	}
}

func TestGetEndpointTypesByChannelType_GPTImage2(t *testing.T) {
	got := GetEndpointTypesByChannelType(constant.ChannelTypeOpenAI, "gpt-image-2")
	if !containsEndpointType(got, constant.EndpointTypeImageGeneration) {
		t.Fatalf("expected endpoints to contain %q, got %v", constant.EndpointTypeImageGeneration, got)
	}
}
