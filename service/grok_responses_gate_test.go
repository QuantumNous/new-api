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

func TestExistingChannelTypesStillSupportOpenAIResponses(t *testing.T) {
	// 守护 allowlist 既有成员不被误删（Grok 之外的成员回归）。
	// 只用 ChannelType2APIType 返回 ok==true 的类型，避免命中 !ok fallback 导致空洞通过。
	for _, ct := range []int{
		constant.ChannelTypeOpenAI,
		constant.ChannelTypeXai,
		constant.ChannelTypeCodex,
	} {
		if !channelSupportsOpenAIResponses(ct) {
			t.Fatalf("existing channel type %d must still support /v1/responses", ct)
		}
	}
}

func TestCodexStillSupportsResponsesCompactEndpoint(t *testing.T) {
	// 守护 compact 分支的既有成员 Codex 不被误删。
	ch := &model.Channel{Type: constant.ChannelTypeCodex}
	if !channelSupportsRequestedEndpoint(ch, "gpt-5-codex", constant.EndpointTypeOpenAIResponseCompact) {
		t.Fatalf("Codex must still support responses compact endpoint gate")
	}
}
