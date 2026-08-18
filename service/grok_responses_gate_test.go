package service

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func TestGrokSupportsOpenAIResponses(t *testing.T) {
	if !channelSupportsOpenAIResponses(constant.ChannelTypeGrokSubscription) {
		t.Fatalf("Grok subscription must support /v1/responses")
	}
}

func TestGrokSupportsResponsesCompactEndpoint(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeGrokSubscription}
	if !channelSupportsRequestedEndpoint(ch, "grok-4", constant.EndpointTypeOpenAIResponseCompact) {
		t.Fatalf("Grok subscription must support responses compact endpoint gate")
	}
}
