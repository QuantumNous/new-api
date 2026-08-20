package model

import (
	"encoding/json"
	"strings"
	"testing"
)

// TestNewGrokAuthStateViewProjectsWhitelistOnly 守护白名单投影正确性：
// 从一个"塞满敏感字段"的 GrokChannelState 投影出的 view 只携带 4 个非秘密字段，
// 且值逐一正确。这是 detail 响应对外暴露前的最后一道白名单闸门。
func TestNewGrokAuthStateViewProjectsWhitelistOnly(t *testing.T) {
	st := &GrokChannelState{
		ChannelID:             7,
		AuthStatus:            GrokAuthStatusActive,
		BillingPlan:           "SuperGrok",
		TierRaw:               "tier-x",
		QuotaSnapshot:         `{"remaining":5}`,
		RefreshLeaseOwner:     "SENSITIVE-lease-owner-node",
		RefreshLeaseExpiresAt: 1893456000,
		LastRefreshAt:         1700000000,
		LastError:             "SENSITIVE-upstream-desc-with-token-xyz",
		CreatedAt:             1600000000,
		UpdatedAt:             1650000000,
	}
	view := NewGrokAuthStateView(st)
	if view == nil {
		t.Fatalf("NewGrokAuthStateView must not return nil for a non-nil state")
	}
	if view.AuthStatus != GrokAuthStatusActive {
		t.Fatalf("AuthStatus = %q, want %q", view.AuthStatus, GrokAuthStatusActive)
	}
	if view.BillingPlan != "SuperGrok" {
		t.Fatalf("BillingPlan = %q, want SuperGrok", view.BillingPlan)
	}
	if view.TierRaw != "tier-x" {
		t.Fatalf("TierRaw = %q, want tier-x", view.TierRaw)
	}
	if view.LastRefreshAt != 1700000000 {
		t.Fatalf("LastRefreshAt = %d, want 1700000000", view.LastRefreshAt)
	}

	// 编译期/反射护栏：view 结构体绝不能悄悄长出 LastError/lease/token 之类字段。
	// 复用 grok_channel_state_test.go 的 assertOnlyAllowedFields。
	allowed := map[string]struct{}{
		"AuthStatus": {}, "BillingPlan": {}, "TierRaw": {}, "LastRefreshAt": {},
	}
	assertOnlyAllowedFields(t, GrokAuthStateView{}, allowed)
}

// TestNewGrokAuthStateViewJSONNeverLeaksSecrets 安全回归：view 的 JSON 序列化
// 绝不含 last_error / refresh_lease / token / 任何敏感哨兵子串。
// 这是证明 LastError（承载上游报文片段）不会随 detail 响应外泄的关键测试。
func TestNewGrokAuthStateViewJSONNeverLeaksSecrets(t *testing.T) {
	st := &GrokChannelState{
		ChannelID:             7,
		AuthStatus:            GrokAuthStatusNeedsReauth,
		BillingPlan:           "SuperGrok",
		TierRaw:               "tier-x",
		QuotaSnapshot:         `{"remaining":5}`,
		RefreshLeaseOwner:     "SENSITIVE-lease-owner-node",
		RefreshLeaseExpiresAt: 1893456000,
		LastRefreshAt:         1700000000,
		LastError:             "SENSITIVE-upstream-desc-with-token-xyz",
	}
	blob, err := json.Marshal(NewGrokAuthStateView(st))
	if err != nil {
		t.Fatalf("marshal view err %v", err)
	}
	got := string(blob)
	for _, banned := range []string{
		"last_error", "refresh_lease", "token",
		"SENSITIVE-upstream-desc-with-token-xyz", "SENSITIVE-lease-owner-node",
		"quota_snapshot", "remaining",
	} {
		if strings.Contains(got, banned) {
			t.Fatalf("view JSON must not contain %q, got: %s", banned, got)
		}
	}
	// 正向确认白名单字段确实存在（否则空 JSON 也能"通过"上面的 NotContains）。
	if !strings.Contains(got, "auth_status") {
		t.Fatalf("view JSON must contain auth_status, got: %s", got)
	}
}

// TestNewGrokAuthStateViewNilReturnsNil 空入参（state 行不存在时的哨兵）返回 nil，
// 让 detail 响应因 omitempty 直接省略 grok_auth_state 字段。
func TestNewGrokAuthStateViewNilReturnsNil(t *testing.T) {
	if v := NewGrokAuthStateView(nil); v != nil {
		t.Fatalf("NewGrokAuthStateView(nil) = %+v, want nil", v)
	}
}
