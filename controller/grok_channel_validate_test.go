package controller

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func TestValidateChannelGrokAllowsEmptyKeyOnAdd(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeGrokSubscription, Key: ""}
	ch.Models = "grok-4"
	if err := validateChannel(ch, true); err != nil {
		t.Fatalf("empty-key Grok add must be allowed (pending OAuth), got %v", err)
	}
}

func TestValidateChannelGrokRejectsMultiKey(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeGrokSubscription}
	ch.ChannelInfo.IsMultiKey = true
	if err := validateChannel(ch, false); err == nil {
		t.Fatalf("Grok multi-key must be rejected")
	}
}

func TestValidateChannelGrokRejectsNonVersionedKey(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeGrokSubscription, Key: `{"access_token":"at"}`}
	ch.Models = "grok-4"
	if err := validateChannel(ch, true); err == nil {
		t.Fatalf("Grok key without version/type must be rejected")
	}
}

func TestValidateChannelGrokAcceptsVersionedKey(t *testing.T) {
	ch := &model.Channel{
		Type: constant.ChannelTypeGrokSubscription,
		Key:  `{"version":1,"type":"grok_subscription","access_token":"at","token_type":"Bearer","expires_at":1786900000}`,
	}
	ch.Models = "grok-4"
	if err := validateChannel(ch, true); err != nil {
		t.Fatalf("valid versioned Grok key must pass, got %v", err)
	}
}
