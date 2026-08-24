package service

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCodexVersionSyncTest(t *testing.T) {
	t.Helper()

	originalDB := model.DB
	originalOptionMap := common.OptionMap
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}))

	model.DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.OptionMap = map[string]string{
		OptionKeyCodexAutoSyncClientVersion: "true",
	}

	t.Cleanup(func() {
		model.DB = originalDB
		common.OptionMap = originalOptionMap
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		codexVersionSyncHTTPClient = http.DefaultClient
		codexVersionSyncReleaseURL = codexLatestReleaseURL
	})
}

func setCodexVersionSyncReleaseServer(t *testing.T, handler http.HandlerFunc) {
	t.Helper()

	server := httptest.NewServer(handler)
	t.Cleanup(server.Close)
	codexVersionSyncHTTPClient = server.Client()
	codexVersionSyncReleaseURL = server.URL
}

func requireCodexOptionValue(t *testing.T, key string) string {
	t.Helper()

	var option model.Option
	require.NoError(t, model.DB.Where("key = ?", key).First(&option).Error)
	return option.Value
}

func TestSyncCodexVersionAcceptsOnlyNewerStableOfficialRelease(t *testing.T) {
	setupCodexVersionSyncTest(t)
	require.NoError(t, model.UpdateOption(OptionKeyCodexSyncedClientVersion, "0.199.0"))
	require.NoError(t, model.UpdateOption(OptionKeyCodexSyncedClientVersionAt, "2026-08-20T00:00:00Z"))

	releases := []string{
		`{"tag_name":"rust-v0.200.0","name":"rust-v0.200.0","draft":false,"prerelease":false}`,
		`{"tag_name":"rust-v0.201.0","name":"rust-v0.201.0","draft":true,"prerelease":false}`,
		`{"tag_name":"rust-v0.202.0","name":"rust-v0.202.0","draft":false,"prerelease":true}`,
		`{"tag_name":"rust-vnot-a-version","name":"rust-vnot-a-version","draft":false,"prerelease":false}`,
		`{"tag_name":"rust-v0.198.9","name":"rust-v0.198.9","draft":false,"prerelease":false}`,
	}
	requests := 0
	setCodexVersionSyncReleaseServer(t, func(w http.ResponseWriter, _ *http.Request) {
		require.Less(t, requests, len(releases))
		_, _ = w.Write([]byte(releases[requests]))
		requests++
	})

	for range releases {
		require.NoError(t, SyncLatestStableCodexVersion(context.Background()))
	}

	require.Equal(t, len(releases), requests)
	require.Equal(t, "0.200.0", requireCodexOptionValue(t, OptionKeyCodexSyncedClientVersion))
	require.NotEqual(t, "2026-08-20T00:00:00Z", requireCodexOptionValue(t, OptionKeyCodexSyncedClientVersionAt))
	require.Equal(t, "0.200.0", common.OptionMap[OptionKeyCodexSyncedClientVersion])
}

func TestSyncCodexVersionPreservesStoredValueOnFailure(t *testing.T) {
	for _, tt := range []struct {
		name       string
		statusCode int
		body       string
	}{
		{name: "http error", statusCode: http.StatusBadGateway, body: `{"message":"upstream unavailable"}`},
		{name: "malformed json", statusCode: http.StatusOK, body: `{`},
		{name: "invalid tag", statusCode: http.StatusOK, body: `{"tag_name":"codex-v0.201.0","name":"codex-v0.201.0","draft":false,"prerelease":false}`},
	} {
		t.Run(tt.name, func(t *testing.T) {
			setupCodexVersionSyncTest(t)
			require.NoError(t, model.UpdateOption(OptionKeyCodexSyncedClientVersion, "0.199.0"))
			require.NoError(t, model.UpdateOption(OptionKeyCodexSyncedClientVersionAt, "2026-08-20T00:00:00Z"))
			setCodexVersionSyncReleaseServer(t, func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tt.statusCode)
				_, _ = w.Write([]byte(tt.body))
			})

			require.NoError(t, SyncLatestStableCodexVersion(context.Background()))

			require.Equal(t, "0.199.0", requireCodexOptionValue(t, OptionKeyCodexSyncedClientVersion))
			require.Equal(t, "2026-08-20T00:00:00Z", requireCodexOptionValue(t, OptionKeyCodexSyncedClientVersionAt))
			require.Equal(t, "0.199.0", common.OptionMap[OptionKeyCodexSyncedClientVersion])
		})
	}
}

func TestManualCodexVersionStillWinsAfterSync(t *testing.T) {
	setupCodexVersionSyncTest(t)
	require.NoError(t, model.UpdateOption(OptionKeyCodexClientVersion, "0.250.0"))
	require.NoError(t, model.UpdateOption(OptionKeyCodexSyncedClientVersion, "0.179.0"))
	setCodexVersionSyncReleaseServer(t, func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte(`{"tag_name":"rust-v0.200.0","name":"rust-v0.200.0","draft":false,"prerelease":false}`))
	})

	require.NoError(t, SyncLatestStableCodexVersion(context.Background()))

	require.Equal(t, "0.200.0", requireCodexOptionValue(t, OptionKeyCodexSyncedClientVersion))
	require.Equal(t, "0.250.0", ResolveCodexClientIdentity().Version)
}
