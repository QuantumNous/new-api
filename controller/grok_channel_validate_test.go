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

// TestValidateChannelGrokRejectsNonVersionedKeyOnEdit 锁定设计决策:版本化校验块
// 故意置于 isAdd 分支之外,使编辑(isAdd=false)时提供的非法 Key 同样被拒。
// 若将来有人把校验块误挪进 isAdd 分支,本测试会转红(现有 4 个测试都不会)。
func TestValidateChannelGrokRejectsNonVersionedKeyOnEdit(t *testing.T) {
	ch := &model.Channel{Type: constant.ChannelTypeGrokSubscription, Key: `{"access_token":"at"}`}
	ch.Models = "grok-4"
	if err := validateChannel(ch, false); err == nil { // isAdd=false → 编辑路径
		t.Fatalf("Grok non-versioned key on edit must be rejected (validation block must cover edit path)")
	}
}
