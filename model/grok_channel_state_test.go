package model

import (
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

func TestGrokChannelStateNeverStoresSecrets(t *testing.T) {
	allowed := map[string]struct{}{
		"ChannelID": {}, "AuthStatus": {}, "BillingPlan": {}, "TierRaw": {},
		"QuotaSnapshot": {}, "RefreshLeaseOwner": {}, "RefreshLeaseExpiresAt": {},
		"LastRefreshAt": {}, "LastError": {}, "CreatedAt": {}, "UpdatedAt": {},
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
