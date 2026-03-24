package service

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func TestSelectMultiKeyStickyStableForSameToken(t *testing.T) {
	t.Cleanup(func() {
		_ = getMultiKeyStickyCache().Purge()
	})

	channel := &model.Channel{
		Id:  101,
		Key: "sk-alpha\nsk-beta\nsk-gamma",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 3,
			MultiKeyMode: constant.MultiKeyModeSticky,
		},
	}

	ctx1, _ := gin.CreateTestContext(nil)
	common.SetContextKey(ctx1, constant.ContextKeyTokenId, 42)
	_, firstIndex, err := SelectMultiKey(ctx1, channel)
	if err != nil {
		t.Fatalf("first sticky selection failed: %v", err)
	}

	ctx2, _ := gin.CreateTestContext(nil)
	common.SetContextKey(ctx2, constant.ContextKeyTokenId, 42)
	_, secondIndex, err := SelectMultiKey(ctx2, channel)
	if err != nil {
		t.Fatalf("second sticky selection failed: %v", err)
	}

	if firstIndex != secondIndex {
		t.Fatalf("expected stable sticky selection, got %d then %d", firstIndex, secondIndex)
	}
}

func TestSelectMultiKeyStickyRebindAfterFailure(t *testing.T) {
	t.Cleanup(func() {
		_ = getMultiKeyStickyCache().Purge()
	})

	channel := &model.Channel{
		Id:  102,
		Key: "sk-alpha\nsk-beta\nsk-gamma",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 3,
			MultiKeyMode: constant.MultiKeyModeSticky,
		},
	}

	ctx, _ := gin.CreateTestContext(nil)
	common.SetContextKey(ctx, constant.ContextKeyTokenId, 88)
	_, firstIndex, err := SelectMultiKey(ctx, channel)
	if err != nil {
		t.Fatalf("first sticky selection failed: %v", err)
	}

	RecordMultiKeyFailure(ctx, channel.Id, channel.ChannelInfo.MultiKeyMode, firstIndex)
	_, reboundIndex, err := SelectMultiKey(ctx, channel)
	if err != nil {
		t.Fatalf("sticky re-selection failed: %v", err)
	}
	if reboundIndex == firstIndex {
		t.Fatalf("expected rebound selection to move away from failed key %d", firstIndex)
	}

	CommitMultiKeyBinding(ctx)

	nextCtx, _ := gin.CreateTestContext(nil)
	common.SetContextKey(nextCtx, constant.ContextKeyTokenId, 88)
	_, nextIndex, err := SelectMultiKey(nextCtx, channel)
	if err != nil {
		t.Fatalf("sticky selection after rebind failed: %v", err)
	}
	if nextIndex != reboundIndex {
		t.Fatalf("expected sticky binding to persist rebound index %d, got %d", reboundIndex, nextIndex)
	}
}

func TestSelectMultiKeyStickyRingChangeInvalidatesBinding(t *testing.T) {
	t.Cleanup(func() {
		_ = getMultiKeyStickyCache().Purge()
	})

	channel := &model.Channel{
		Id:  103,
		Key: "sk-alpha\nsk-beta\nsk-gamma",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey:   true,
			MultiKeySize: 3,
			MultiKeyMode: constant.MultiKeyModeSticky,
		},
	}

	ctx, _ := gin.CreateTestContext(nil)
	common.SetContextKey(ctx, constant.ContextKeyTokenId, 99)
	_, firstIndex, err := SelectMultiKey(ctx, channel)
	if err != nil {
		t.Fatalf("first sticky selection failed: %v", err)
	}
	RecordMultiKeyFailure(ctx, channel.Id, channel.ChannelInfo.MultiKeyMode, firstIndex)
	reboundKey, _, err := SelectMultiKey(ctx, channel)
	if err != nil {
		t.Fatalf("sticky re-selection failed: %v", err)
	}
	CommitMultiKeyBinding(ctx)

	keys := channel.GetKeys()
	remainingKeys := make([]string, 0, len(keys)-1)
	for _, key := range keys {
		if key == reboundKey {
			continue
		}
		remainingKeys = append(remainingKeys, key)
	}
	channel.Key = strings.Join(remainingKeys, "\n")
	channel.ChannelInfo.MultiKeySize = len(remainingKeys)

	nextCtx, _ := gin.CreateTestContext(nil)
	common.SetContextKey(nextCtx, constant.ContextKeyTokenId, 99)
	nextKey, _, err := SelectMultiKey(nextCtx, channel)
	if err != nil {
		t.Fatalf("sticky selection after ring change failed: %v", err)
	}
	if nextKey == reboundKey {
		t.Fatalf("expected stale sticky binding to be ignored after key removal")
	}
}
