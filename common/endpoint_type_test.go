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
		{"TechMobiVideo", constant.ChannelTypeTechMobiVideo},
		{"BytePlus", constant.ChannelTypeBytePlus},
		{"MiniMaxH3", constant.ChannelTypeMiniMaxH3},
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

func TestGetEndpointTypesByChannelType_Sonilo(t *testing.T) {
	got := GetEndpointTypesByChannelType(constant.ChannelTypeSonilo, "sonilo-video-to-music")
	if !containsEndpointType(got, constant.EndpointTypeVideoToMusic) {
		t.Fatalf("expected endpoints to contain %q, got %v", constant.EndpointTypeVideoToMusic, got)
	}
}

func TestGetEndpointTypesByChannelType_ModelAPISeedance(t *testing.T) {
	got := GetEndpointTypesByChannelType(constant.ChannelTypeModelAPISeedance, "doubao-seedance-2-5-260628")
	if !containsEndpointType(got, constant.EndpointTypeOpenAIVideo) {
		t.Fatalf("expected endpoints to contain %q, got %v", constant.EndpointTypeOpenAIVideo, got)
	}
}

func TestGrokSubscriptionEndpointTypes(t *testing.T) {
	t.Run("text model advertises text endpoints only", func(t *testing.T) {
		got := GetEndpointTypesByChannelType(constant.ChannelTypeGrokSubscription, "grok-4.6")
		if !containsEndpointType(got, constant.EndpointTypeOpenAIResponse) {
			t.Fatalf("expected endpoints to contain %q, got %v", constant.EndpointTypeOpenAIResponse, got)
		}
		if !containsEndpointType(got, constant.EndpointTypeOpenAI) {
			t.Fatalf("expected endpoints to contain %q, got %v", constant.EndpointTypeOpenAI, got)
		}
		if containsEndpointType(got, constant.EndpointTypeOpenAIVideo) {
			t.Fatalf("text Grok subscription model must not advertise video, got %v", got)
		}
		if containsEndpointType(got, constant.EndpointTypeImageGeneration) {
			t.Fatalf("text Grok subscription model must not advertise image generation, got %v", got)
		}
	})

	t.Run("image model advertises image generation first", func(t *testing.T) {
		got := GetEndpointTypesByChannelType(constant.ChannelTypeGrokSubscription, "grok-imagine-image-2.0")
		if len(got) == 0 || got[0] != constant.EndpointTypeImageGeneration {
			t.Fatalf("expected image generation first, got %v", got)
		}
		if containsEndpointType(got, constant.EndpointTypeOpenAIVideo) {
			t.Fatalf("image Grok subscription model must not advertise video, got %v", got)
		}
	})

	for _, modelName := range []string{"grok-imagine-video-1.5", "grok-imagine-video"} {
		t.Run(modelName+" advertises openai video", func(t *testing.T) {
			got := GetEndpointTypesByChannelType(constant.ChannelTypeGrokSubscription, modelName)
			if !containsEndpointType(got, constant.EndpointTypeOpenAIVideo) {
				t.Fatalf("expected endpoints to contain %q, got %v", constant.EndpointTypeOpenAIVideo, got)
			}
			if containsEndpointType(got, constant.EndpointTypeImageGeneration) {
				t.Fatalf("video Grok subscription model must not advertise image generation, got %v", got)
			}
		})
	}
}
