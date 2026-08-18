package model

import (
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupGrokAuthFlowTestDB 建内存 SQLite 并接管包级 DB，测试结束还原（照 copilot_channel_test.go 模式）。
func setupGrokAuthFlowTestDB(t *testing.T) {
	t.Helper()
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&GrokAuthFlow{}))
	DB = db
	t.Cleanup(func() { DB = originalDB })
}

func TestGrokAuthFlowLifecycle(t *testing.T) {
	setupGrokAuthFlowTestDB(t)
	flow := &GrokAuthFlow{
		Provider:          "grok_subscription",
		AdminID:           1,
		ChannelID:         42,
		StateHash:         "statehash",
		EncryptedVerifier: "v1:abc",
		RedirectURI:       "https://example/callback",
		ExpiresAt:         GetDBTimestamp() + 600,
	}
	if err := CreateGrokAuthFlow(flow); err != nil {
		t.Fatalf("create err %v", err)
	}
	// claim 一次成功
	claimed, ok, err := ClaimGrokAuthFlow(flow.FlowID, "owner-token-1")
	if err != nil || !ok {
		t.Fatalf("first claim must succeed, ok=%v err=%v", ok, err)
	}
	if claimed.ChannelID != 42 {
		t.Fatalf("claimed channel = %d", claimed.ChannelID)
	}
	// 再次 claim（不同 owner）必须失败（一次性）
	if _, ok2, _ := ClaimGrokAuthFlow(flow.FlowID, "owner-token-2"); ok2 {
		t.Fatalf("second claim must fail (one-time)")
	}
	// 同 owner 再次 claim 幂等成功（重试安全）
	if _, ok3, err := ClaimGrokAuthFlow(flow.FlowID, "owner-token-1"); err != nil || !ok3 {
		t.Fatalf("same-owner re-claim must be idempotent, ok=%v err=%v", ok3, err)
	}
	// consume 删除
	if err := ConsumeGrokAuthFlow(flow.FlowID, "owner-token-1"); err != nil {
		t.Fatalf("consume err %v", err)
	}
	if _, ok4, _ := ClaimGrokAuthFlow(flow.FlowID, "owner-token-1"); ok4 {
		t.Fatalf("claim after consume must fail")
	}
}

func TestGrokAuthFlowRejectsExpired(t *testing.T) {
	setupGrokAuthFlowTestDB(t)
	flow := &GrokAuthFlow{Provider: "grok_subscription", AdminID: 1, ChannelID: 7, StateHash: "s", EncryptedVerifier: "v1:x", ExpiresAt: GetDBTimestamp() - 1}
	if err := CreateGrokAuthFlow(flow); err != nil {
		t.Fatalf("create err %v", err)
	}
	if _, ok, _ := ClaimGrokAuthFlow(flow.FlowID, "owner"); ok {
		t.Fatalf("expired flow must not be claimable")
	}
}

func TestConsumeGrokAuthFlowOnlyOwner(t *testing.T) {
	setupGrokAuthFlowTestDB(t)
	flow := &GrokAuthFlow{Provider: "grok_subscription", AdminID: 1, ChannelID: 9, StateHash: "s", EncryptedVerifier: "v1:y", ExpiresAt: GetDBTimestamp() + 600}
	if err := CreateGrokAuthFlow(flow); err != nil {
		t.Fatalf("create err %v", err)
	}
	if _, ok, err := ClaimGrokAuthFlow(flow.FlowID, "owner-1"); err != nil || !ok {
		t.Fatalf("claim must succeed, ok=%v err=%v", ok, err)
	}
	// 非 owner consume 不得删除
	if err := ConsumeGrokAuthFlow(flow.FlowID, "not-owner"); err != nil {
		t.Fatalf("consume err %v", err)
	}
	if _, ok, _ := ClaimGrokAuthFlow(flow.FlowID, "owner-1"); !ok {
		t.Fatalf("flow must still exist after non-owner consume")
	}
}

// TestGrokAuthFlowRejectsInvalidInputs 覆盖 CRUD 的 fail-closed 入口校验（M1）。
func TestGrokAuthFlowRejectsInvalidInputs(t *testing.T) {
	setupGrokAuthFlowTestDB(t)
	// CreateGrokAuthFlow(nil) 必须返回 error（不得 panic）。
	if err := CreateGrokAuthFlow(nil); err == nil {
		t.Fatalf("CreateGrokAuthFlow(nil) must return error")
	}
	// 空 flowID 必须被拒。
	if _, ok, err := ClaimGrokAuthFlow("", "owner"); err == nil || ok {
		t.Fatalf("ClaimGrokAuthFlow with empty flowID must fail, ok=%v err=%v", ok, err)
	}
	// 空 ownerToken 必须被拒。
	if _, ok, err := ClaimGrokAuthFlow("flow", ""); err == nil || ok {
		t.Fatalf("ClaimGrokAuthFlow with empty ownerToken must fail, ok=%v err=%v", ok, err)
	}
	// 双空同样被拒。
	if _, ok, err := ClaimGrokAuthFlow("", ""); err == nil || ok {
		t.Fatalf("ClaimGrokAuthFlow with empty flowID/ownerToken must fail, ok=%v err=%v", ok, err)
	}
}
