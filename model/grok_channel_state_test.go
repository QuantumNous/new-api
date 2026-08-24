package model

import (
	"errors"
	"reflect"
	"testing"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// setupGrokChannelStateTestDB 建内存 SQLite 并接管包级 DB，测试结束还原（照 grok_auth_flow_test.go 模式）。
func setupGrokChannelStateTestDB(t *testing.T) {
	t.Helper()
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&GrokChannelState{}))
	DB = db
	t.Cleanup(func() { DB = originalDB })
}

// assertOnlyAllowedFields 反射遍历 v 的字段名，任何不在 allowed 白名单里的字段即 fail。
// 这是防止未来往非秘密快照表塞 access_token / refresh_token / pkce_verifier 等秘密的编译期护栏。
func assertOnlyAllowedFields(t *testing.T, v interface{}, allowed map[string]struct{}) {
	t.Helper()
	typ := reflect.TypeOf(v)
	for typ.Kind() == reflect.Ptr {
		typ = typ.Elem()
	}
	if typ.Kind() != reflect.Struct {
		t.Fatalf("assertOnlyAllowedFields: expected struct, got %s", typ.Kind())
	}
	for i := 0; i < typ.NumField(); i++ {
		name := typ.Field(i).Name
		if _, ok := allowed[name]; !ok {
			t.Fatalf("unexpected field %q on %s: non-secret snapshot table must not gain fields without review (no tokens/secrets)", name, typ.Name())
		}
	}
}

func TestGrokChannelStateUpsert(t *testing.T) {
	setupGrokChannelStateTestDB(t) // 注意：不是计划里的 setupTestDB
	st := &GrokChannelState{
		ChannelID:     42,
		AuthStatus:    GrokAuthStatusActive,
		BillingPlan:   "SuperGrok",
		QuotaSnapshot: `{"remaining":100}`,
		UpdatedAt:     GetDBTimestamp(),
	}
	if err := UpsertGrokChannelState(st); err != nil {
		t.Fatalf("upsert insert err %v", err)
	}
	st.AuthStatus = GrokAuthStatusNeedsReauth
	if err := UpsertGrokChannelState(st); err != nil {
		t.Fatalf("upsert update err %v", err)
	}
	got, err := GetGrokChannelState(42)
	if err != nil {
		t.Fatalf("get err %v", err)
	}
	if got.AuthStatus != GrokAuthStatusNeedsReauth {
		t.Fatalf("auth status = %q, want needs_reauth", got.AuthStatus)
	}
	var count int64
	DB.Model(&GrokChannelState{}).Where("channel_id = ?", 42).Count(&count)
	if count != 1 {
		t.Fatalf("expected exactly 1 row, got %d", count)
	}
}

func TestGrokBillingObservationConditionalWriteIsMonotonicAndLeaseOwned(t *testing.T) {
	setupGrokChannelStateTestDB(t)
	now := GetDBTimestamp()
	require.NoError(t, UpsertGrokChannelState(&GrokChannelState{
		ChannelID:             113,
		AuthStatus:            GrokAuthStatusActive,
		RefreshLeaseOwner:     "node-A",
		RefreshLeaseExpiresAt: now + 300,
	}))

	wrote, err := SaveGrokBillingObservation(113, "node-A", GrokBillingObservation{
		ObservedAt:    1700000100,
		BillingPlan:   "SuperGrok",
		TierRaw:       "premium-plus",
		QuotaSnapshot: `{"remaining":100}`,
	})
	require.NoError(t, err)
	require.True(t, wrote)

	got, err := GetGrokChannelState(113)
	require.NoError(t, err)
	require.Equal(t, int64(1700000100), got.BillingObservedAt)
	require.Equal(t, "SuperGrok", got.BillingPlan)
	require.Equal(t, "premium-plus", got.TierRaw)
	require.Equal(t, `{"remaining":100}`, got.QuotaSnapshot)
	require.Equal(t, int64(1700000100), got.UpdatedAt)

	for _, tc := range []struct {
		name        string
		leaseOwner  string
		observation GrokBillingObservation
	}{
		{
			name:       "older timestamp",
			leaseOwner: "node-A",
			observation: GrokBillingObservation{
				ObservedAt:    1700000099,
				BillingPlan:   "StalePlan",
				TierRaw:       "stale-tier",
				QuotaSnapshot: `{"remaining":1}`,
			},
		},
		{
			name:       "wrong lease owner",
			leaseOwner: "node-B",
			observation: GrokBillingObservation{
				ObservedAt:    1700000200,
				BillingPlan:   "WrongOwnerPlan",
				TierRaw:       "wrong-owner-tier",
				QuotaSnapshot: `{"remaining":3}`,
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			wrote, err := SaveGrokBillingObservation(113, tc.leaseOwner, tc.observation)
			require.NoError(t, err)
			require.False(t, wrote)

			got, err := GetGrokChannelState(113)
			require.NoError(t, err)
			require.Equal(t, int64(1700000100), got.BillingObservedAt)
			require.Equal(t, "SuperGrok", got.BillingPlan)
			require.Equal(t, "premium-plus", got.TierRaw)
			require.Equal(t, `{"remaining":100}`, got.QuotaSnapshot)
			require.Equal(t, int64(1700000100), got.UpdatedAt)
		})
	}

	wrote, err = SaveGrokBillingObservation(113, "node-A", GrokBillingObservation{
		ObservedAt:    1700000100,
		BillingPlan:   "SameTimePlan",
		TierRaw:       "same-time-tier",
		QuotaSnapshot: `{"remaining":2}`,
	})
	require.NoError(t, err)
	require.True(t, wrote)
	got, err = GetGrokChannelState(113)
	require.NoError(t, err)
	require.Equal(t, int64(1700000100), got.BillingObservedAt)
	require.Equal(t, "SameTimePlan", got.BillingPlan)
	require.Equal(t, "same-time-tier", got.TierRaw)
	require.Equal(t, `{"remaining":2}`, got.QuotaSnapshot)
}

func TestGrokBillingObservationRejectsExpiredSameOwnerLease(t *testing.T) {
	setupGrokChannelStateTestDB(t)
	now := GetDBTimestamp()
	require.NoError(t, UpsertGrokChannelState(&GrokChannelState{
		ChannelID:             116,
		AuthStatus:            GrokAuthStatusActive,
		RefreshLeaseOwner:     "node-A",
		RefreshLeaseExpiresAt: now - 1,
		BillingObservedAt:     1700000100,
		BillingPlan:           "ExistingPlan",
		TierRaw:               "existing-tier",
		QuotaSnapshot:         `{"remaining":50}`,
		UpdatedAt:             1700000100,
	}))
	before, err := GetGrokChannelState(116)
	require.NoError(t, err)

	wrote, err := SaveGrokBillingObservation(116, "node-A", GrokBillingObservation{
		ObservedAt:    1700000200,
		BillingPlan:   "StaleWorkerPlan",
		TierRaw:       "stale-worker-tier",
		QuotaSnapshot: `{"remaining":1}`,
	})
	require.NoError(t, err)
	require.False(t, wrote)

	got, err := GetGrokChannelState(116)
	require.NoError(t, err)
	require.Equal(t, int64(1700000100), got.BillingObservedAt)
	require.Equal(t, "ExistingPlan", got.BillingPlan)
	require.Equal(t, "existing-tier", got.TierRaw)
	require.Equal(t, `{"remaining":50}`, got.QuotaSnapshot)
	require.Equal(t, before.UpdatedAt, got.UpdatedAt)
}

func TestGrokBillingObservationAcceptsLegacyNullObservedAt(t *testing.T) {
	originalDB := DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	t.Cleanup(func() { DB = originalDB })

	require.NoError(t, DB.Exec(`CREATE TABLE grok_channel_states (
		channel_id integer PRIMARY KEY,
		auth_status text,
		billing_plan text,
		tier_raw text,
		quota_snapshot text,
		billing_observed_at integer NULL,
		refresh_lease_owner text,
		refresh_lease_expires_at integer,
		last_refresh_at integer,
		last_error text,
		created_at integer,
		updated_at integer
	)`).Error)
	require.NoError(t, DB.Exec(`INSERT INTO grok_channel_states (
		channel_id,
		auth_status,
		billing_observed_at,
		refresh_lease_owner,
		refresh_lease_expires_at
	) VALUES (?, ?, NULL, ?, ?)`, 115, GrokAuthStatusActive, "node-A", GetDBTimestamp()+300).Error)

	wrote, err := SaveGrokBillingObservation(115, "node-A", GrokBillingObservation{
		ObservedAt:    1700000300,
		BillingPlan:   "SuperGrok",
		TierRaw:       "premium-plus",
		QuotaSnapshot: `{"remaining":100}`,
	})
	require.NoError(t, err)
	require.True(t, wrote)

	got, err := GetGrokChannelState(115)
	require.NoError(t, err)
	require.Equal(t, int64(1700000300), got.BillingObservedAt)
	require.Equal(t, "SuperGrok", got.BillingPlan)
	require.Equal(t, "premium-plus", got.TierRaw)
	require.Equal(t, `{"remaining":100}`, got.QuotaSnapshot)
}

func TestGrokBillingObservationRejectsInvalidInputs(t *testing.T) {
	setupGrokChannelStateTestDB(t)
	for _, tc := range []struct {
		name       string
		channelID  int
		leaseOwner string
		observedAt int64
	}{
		{name: "missing channel", channelID: 0, leaseOwner: "node-A", observedAt: 1},
		{name: "missing owner", channelID: 1, leaseOwner: "", observedAt: 1},
		{name: "missing observed time", channelID: 1, leaseOwner: "node-A", observedAt: 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			wrote, err := SaveGrokBillingObservation(tc.channelID, tc.leaseOwner, GrokBillingObservation{ObservedAt: tc.observedAt})
			require.Error(t, err)
			require.False(t, wrote)
		})
	}
}

func TestGrokAuthStateUpsertPreservesBillingObservedAt(t *testing.T) {
	setupGrokChannelStateTestDB(t)
	require.NoError(t, UpsertGrokChannelState(&GrokChannelState{
		ChannelID:         114,
		AuthStatus:        GrokAuthStatusActive,
		BillingObservedAt: 1700000100,
		BillingPlan:       "SuperGrok",
		TierRaw:           "premium-plus",
		QuotaSnapshot:     `{"remaining":100}`,
	}))

	require.NoError(t, UpsertGrokChannelState(&GrokChannelState{
		ChannelID:  114,
		AuthStatus: GrokAuthStatusNeedsReauth,
	}))

	got, err := GetGrokChannelState(114)
	require.NoError(t, err)
	require.Equal(t, GrokAuthStatusNeedsReauth, got.AuthStatus)
	require.Equal(t, int64(1700000100), got.BillingObservedAt)
	require.Equal(t, "SuperGrok", got.BillingPlan)
	require.Equal(t, "premium-plus", got.TierRaw)
	require.Equal(t, `{"remaining":100}`, got.QuotaSnapshot)
}

func TestGrokAuthStateBillingObservedAtMigratesAsColumn(t *testing.T) {
	setupGrokChannelStateTestDB(t)
	require.True(t, DB.Migrator().HasColumn(&GrokChannelState{}, "billing_observed_at"))
}

func TestGrokChannelStateNeverStoresSecrets(t *testing.T) {
	allowed := map[string]struct{}{
		"ChannelID": {}, "AuthStatus": {}, "BillingPlan": {}, "TierRaw": {},
		"QuotaSnapshot": {}, "BillingObservedAt": {}, "RefreshLeaseOwner": {},
		"RefreshLeaseExpiresAt": {}, "LastRefreshAt": {}, "LastError": {},
		"CreatedAt": {}, "UpdatedAt": {},
	}
	assertOnlyAllowedFields(t, GrokChannelState{}, allowed)
}

func TestGrokTablesRegisteredForMigration(t *testing.T) {
	names := map[string]bool{}
	for _, m := range orderedMigrationModels() {
		names[m.name] = true
	}
	for _, want := range []string{"GrokAuthFlow", "GrokChannelState"} {
		if !names[want] {
			t.Fatalf("migration model %q not registered", want)
		}
	}
}

// TestGrokChannelStateUpsertPreservesCreatedAt 守护 Task 5 坑域的正确性不变量：
// OnConflict{UpdateAll} 的 DO UPDATE 不得覆盖 created_at。用一个明显不同的哨兵 created_at
// 做二次 upsert —— 若 GORM（或将来对 UpdateAll 的改动）错误地把 created_at 纳入 DO UPDATE，
// 哨兵 111111 会出现在读回结果里，断言即失败。distinct 哨兵保证本测试非空洞。
func TestGrokChannelStateUpsertPreservesCreatedAt(t *testing.T) {
	setupGrokChannelStateTestDB(t)
	first := &GrokChannelState{ChannelID: 77, AuthStatus: GrokAuthStatusActive}
	if err := UpsertGrokChannelState(first); err != nil {
		t.Fatalf("first upsert err %v", err)
	}
	got1, err := GetGrokChannelState(77)
	if err != nil {
		t.Fatalf("get after insert err %v", err)
	}
	original := got1.CreatedAt
	if original == 0 {
		t.Fatalf("created_at must be set on insert")
	}
	second := &GrokChannelState{ChannelID: 77, AuthStatus: GrokAuthStatusNeedsReauth, CreatedAt: 111111}
	if err := UpsertGrokChannelState(second); err != nil {
		t.Fatalf("second upsert err %v", err)
	}
	got2, err := GetGrokChannelState(77)
	if err != nil {
		t.Fatalf("get after update err %v", err)
	}
	if got2.CreatedAt != original {
		t.Fatalf("created_at must be preserved on upsert-update: got %d, want %d (sentinel 111111 must NOT overwrite)", got2.CreatedAt, original)
	}
	if got2.AuthStatus != GrokAuthStatusNeedsReauth {
		t.Fatalf("auth_status must update to needs_reauth, got %q", got2.AuthStatus)
	}
}

// TestUpsertGrokChannelStateRejectsInvalidInputs 覆盖 fail-closed 入口（对齐兄弟文件
// grok_auth_flow_test.go 的 TestGrokAuthFlowRejectsInvalidInputs 范式）。
func TestUpsertGrokChannelStateRejectsInvalidInputs(t *testing.T) {
	setupGrokChannelStateTestDB(t)
	if err := UpsertGrokChannelState(nil); err == nil {
		t.Fatalf("UpsertGrokChannelState(nil) must return error")
	}
	if err := UpsertGrokChannelState(&GrokChannelState{ChannelID: 0}); err == nil {
		t.Fatalf("UpsertGrokChannelState with ChannelID<=0 must return error")
	}
	if err := UpsertGrokChannelState(&GrokChannelState{ChannelID: -3}); err == nil {
		t.Fatalf("UpsertGrokChannelState with negative ChannelID must return error")
	}
}

// TestGetGrokChannelStateNotFound 未命中须透传 gorm.ErrRecordNotFound，供调用方 errors.Is 区分。
func TestGetGrokChannelStateNotFound(t *testing.T) {
	setupGrokChannelStateTestDB(t)
	if _, err := GetGrokChannelState(4242); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("missing state must return ErrRecordNotFound, got %v", err)
	}
}

// TestDeleteGrokChannelState 删除后再取须为 NotFound（渠道删除级联清理路径）。
func TestDeleteGrokChannelState(t *testing.T) {
	setupGrokChannelStateTestDB(t)
	if err := UpsertGrokChannelState(&GrokChannelState{ChannelID: 88, AuthStatus: GrokAuthStatusActive}); err != nil {
		t.Fatalf("upsert err %v", err)
	}
	if err := DeleteGrokChannelState(88); err != nil {
		t.Fatalf("delete err %v", err)
	}
	if _, err := GetGrokChannelState(88); !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("after delete, get must return ErrRecordNotFound, got %v", err)
	}
}

// TestAcquireRefreshLeaseIsExclusive 守护跨节点刷新 lease 的互斥语义：
// 未过期时仅一个节点可持有；过期后可被抢占；非 owner 释放无效。
func TestAcquireRefreshLeaseIsExclusive(t *testing.T) {
	setupGrokChannelStateTestDB(t) // 修正：不是计划里的 setupTestDB
	if err := UpsertGrokChannelState(&GrokChannelState{ChannelID: 5, AuthStatus: GrokAuthStatusActive}); err != nil {
		t.Fatalf("seed err %v", err)
	}
	now := GetDBTimestamp()
	okA, err := AcquireGrokRefreshLease(5, "node-A", now, 30)
	if err != nil || !okA {
		t.Fatalf("node A must acquire lease, ok=%v err=%v", okA, err)
	}
	okB, _ := AcquireGrokRefreshLease(5, "node-B", now+1, 30)
	if okB {
		t.Fatalf("node B must not acquire while A holds unexpired lease")
	}
	okB2, _ := AcquireGrokRefreshLease(5, "node-B", now+31, 30)
	if !okB2 {
		t.Fatalf("node B must acquire after A's lease expired")
	}
	ReleaseGrokRefreshLease(5, "node-A") // A 已非 owner（现在是 B），释放应无效
	st, _ := GetGrokChannelState(5)
	if st.RefreshLeaseOwner != "node-B" {
		t.Fatalf("non-owner release must not clear lease, owner=%q", st.RefreshLeaseOwner)
	}
}
