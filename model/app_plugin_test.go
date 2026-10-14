package model

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	gormMySQL "gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type legacyAppPluginExchangeReplay struct {
	ScopeHash      string `gorm:"primaryKey;size:64"`
	RequestHash    string `gorm:"size:64;not null"`
	InstallationID string `gorm:"size:64;not null;index"`
	ResponseJSON   string `gorm:"type:text;not null"`
	ResponseMAC    string `gorm:"size:64"`
	ExpiresAt      int64  `gorm:"not null;index"`
}

func (legacyAppPluginExchangeReplay) TableName() string {
	return "app_plugin_exchange_replays"
}

func TestAppPluginMigrationFreshUpgradeReplay(t *testing.T) {
	db := openAppPluginModelDB(t)
	logAppPluginDBVersion(t, db)
	t.Run("records database runtime metadata", func(t *testing.T) {
		assertAppPluginModelRuntimeMetadata(t, db)
	})

	t.Run("fresh migration creates every host-owned app plugin table", func(t *testing.T) {
		require.NoError(t, MigrateAppPluginTables(db))
		for _, table := range []string{
			"app_versions",
			"app_installations",
			"app_installation_idempotencies",
			"app_route_claims",
			"app_service_credentials",
			"app_entitlement_policies",
		} {
			assert.True(t, db.Migrator().HasTable(table), table)
		}
	})

	t.Run("upgrade preserves seeded legacy task plugin rows", func(t *testing.T) {
		require.NoError(t, db.AutoMigrate(&TaskPlugin{}))
		legacy := TaskPlugin{
			Key:        "doubao",
			APIVersion: 1,
			Version:    "1.2.0",
			Source:     "module.exports = {};",
			SourceHash: appPluginDigest("doubao-1.2.0"),
			Enabled:    true,
			Active:     true,
		}
		require.NoError(t, db.Create(&legacy).Error)
		require.NoError(t, MigrateAppPluginTables(db))
		require.NoError(t, MigrateAppPluginTables(db))

		var reloaded TaskPlugin
		require.NoError(t, db.Where(&TaskPlugin{Key: "doubao"}).First(&reloaded).Error)
		assert.Equal(t, "1.2.0", reloaded.Version)
		assert.True(t, reloaded.Enabled)
		assert.True(t, reloaded.Active)
	})

	t.Run("model main migration integration calls the same app plugin migrator", func(t *testing.T) {
		require.NoError(t, MigrateAppPluginTables(db))
		assert.True(t, db.Migrator().HasTable(&AppInstallation{}))
	})

	t.Run("launch table upgrade adds nullable replay authentication linkage and preserves rows", func(t *testing.T) {
		oldDB := openAppPluginModelDB(t)
		require.NoError(t, oldDB.Migrator().DropTable(&AppPluginExchangeReplay{}))
		require.NoError(t, oldDB.AutoMigrate(&legacyAppPluginExchangeReplay{}))
		legacy := legacyAppPluginExchangeReplay{
			ScopeHash: "legacy-scope", RequestHash: "legacy-request",
			InstallationID: "legacy-installation", ResponseJSON: `{"legacy":true}`,
			ResponseMAC: "legacy-response-mac", ExpiresAt: 123,
		}
		require.NoError(t, oldDB.Create(&legacy).Error)

		require.NoError(t, MigrateAppPluginLaunchTables(oldDB))
		require.NoError(t, MigrateAppPluginLaunchTables(oldDB))

		require.True(t, oldDB.Migrator().HasColumn(
			"app_plugin_exchange_replays", "response_mac",
		))
		require.True(t, oldDB.Migrator().HasColumn(
			"app_plugin_exchange_replays", "launch_code_hash",
		))
		require.True(t, oldDB.Migrator().HasColumn(
			"app_plugin_exchange_replays", "app_session_id",
		))
		require.True(t, oldDB.Migrator().HasIndex(
			&AppPluginExchangeReplay{}, "idx_app_plugin_exchange_replay_launch",
		))
		var preserved legacyAppPluginExchangeReplay
		require.NoError(t, oldDB.Where("scope_hash = ?", legacy.ScopeHash).First(&preserved).Error)
		assert.Equal(t, legacy.ResponseJSON, preserved.ResponseJSON)
		var integrity struct {
			ResponseMAC    *string
			LaunchCodeHash *string
			AppSessionID   *string
		}
		require.NoError(t, oldDB.Table("app_plugin_exchange_replays").
			Select("response_mac", "launch_code_hash", "app_session_id").
			Where("scope_hash = ?", legacy.ScopeHash).Take(&integrity).Error)
		require.NotNil(t, integrity.ResponseMAC)
		assert.Equal(t, legacy.ResponseMAC, *integrity.ResponseMAC)
		assert.Nil(t, integrity.LaunchCodeHash)
		assert.Nil(t, integrity.AppSessionID)

		launchCodeHash, appSessionID := strings.Repeat("a", 64), "linked-session"
		linked := AppPluginExchangeReplay{
			ScopeHash: "linked-scope", RequestHash: strings.Repeat("b", 64),
			InstallationID: legacy.InstallationID, LaunchCodeHash: &launchCodeHash,
			AppSessionID: &appSessionID, ResponseJSON: `{}`, ResponseMAC: "linked-mac", ExpiresAt: 456,
		}
		require.NoError(t, oldDB.Create(&linked).Error)
		linked.ScopeHash = "duplicate-linked-scope"
		require.Error(t, oldDB.Create(&linked).Error,
			"one installation and launch code identity can authenticate only one replay")
	})

	t.Run("upgrade preserves legacy app installation public identifier rows", func(t *testing.T) {
		oldDB := openAppPluginModelDB(t)
		require.NoError(t, oldDB.Migrator().DropTable("app_installations"))
		require.NoError(t, oldDB.AutoMigrate(&legacyAppInstallation{}))
		require.NoError(t, oldDB.Create(&legacyAppInstallation{
			ID:                   77,
			AppKey:               "legacy",
			AppVersionID:         "appver",
			ManifestVersion:      "1.0.0",
			ManifestSHA256:       appPluginDigest("legacy"),
			BaseURL:              "https://apps.example.com/legacy/",
			EnabledSurfaces:      AppStringList{},
			AllowedParentOrigins: AppStringList{},
			AllowedOrigins:       AppStringList{},
			AllowedUserPolicy:    AppAllowedUserPolicy{},
			NetworkPolicy:        AppNetworkPolicy{},
			EntitlementPolicyID:  "policy",
			Status:               AppInstallationStatusDisabled,
			Revision:             1,
		}).Error)
		require.NoError(t, MigrateAppPluginTables(oldDB))

		var upgraded AppInstallation
		require.NoError(t, oldDB.Where("id = ?", 77).First(&upgraded).Error)
		assert.Equal(t, "legacy", upgraded.AppKey)
		assert.Equal(t, "77", upgraded.InstallationID)

		var ownership AppRouteClaim
		require.NoError(t, oldDB.Where("app_key = ? AND kind = ?", "legacy", "app_key").First(&ownership).Error)
		assert.Equal(t, upgraded.InstallationID, ownership.InstallationID)
	})

	t.Run("partial DDL resume backfills null and empty public identifiers before auto migration", func(t *testing.T) {
		oldDB := openAppPluginModelDB(t)
		require.NoError(t, oldDB.Migrator().DropTable(&AppRouteClaim{}, &AppInstallation{}))
		require.NoError(t, oldDB.AutoMigrate(&legacyAppInstallation{}))
		legacyInstallations := []legacyAppInstallation{
			{
				ID:                   301,
				AppKey:               "partial-ddl-null",
				AppVersionID:         "appver-null",
				ManifestVersion:      "1.0.0",
				ManifestSHA256:       appPluginDigest("partial-ddl-null"),
				BaseURL:              "https://apps.example.com/partial-ddl-null/",
				EnabledSurfaces:      AppStringList{},
				AllowedParentOrigins: AppStringList{},
				AllowedOrigins:       AppStringList{},
				AllowedUserPolicy:    AppAllowedUserPolicy{},
				NetworkPolicy:        AppNetworkPolicy{},
				EntitlementPolicyID:  "policy",
				Status:               AppInstallationStatusDisabled,
				Revision:             1,
			},
			{
				ID:                   302,
				AppKey:               "partial-ddl-empty",
				AppVersionID:         "appver-empty",
				ManifestVersion:      "1.0.0",
				ManifestSHA256:       appPluginDigest("partial-ddl-empty"),
				BaseURL:              "https://apps.example.com/partial-ddl-empty/",
				EnabledSurfaces:      AppStringList{},
				AllowedParentOrigins: AppStringList{},
				AllowedOrigins:       AppStringList{},
				AllowedUserPolicy:    AppAllowedUserPolicy{},
				NetworkPolicy:        AppNetworkPolicy{},
				EntitlementPolicyID:  "policy",
				Status:               AppInstallationStatusDisabled,
				Revision:             1,
			},
		}
		require.NoError(t, oldDB.Create(&legacyInstallations).Error)

		columnType := "text"
		if oldDB.Dialector.Name() != "sqlite" {
			columnType = "varchar(64)"
		}
		require.NoError(t, oldDB.Exec("ALTER TABLE app_installations ADD COLUMN installation_id "+columnType).Error)
		require.NoError(t, oldDB.Exec("UPDATE app_installations SET installation_id = '' WHERE id = ?", 302).Error)

		require.NoError(t, MigrateAppPluginTables(oldDB))
		require.NoError(t, MigrateAppPluginTables(oldDB))

		var upgraded []AppInstallation
		require.NoError(t, oldDB.Where("id IN ?", []uint{301, 302}).Order("id").Find(&upgraded).Error)
		require.Len(t, upgraded, 2)
		assert.Equal(t, []string{"301", "302"}, []string{upgraded[0].InstallationID, upgraded[1].InstallationID})
		for _, installation := range upgraded {
			var ownership AppRouteClaim
			require.NoError(t, oldDB.Where("app_key = ? AND kind = ?", installation.AppKey, "app_key").First(&ownership).Error)
			assert.Equal(t, installation.InstallationID, ownership.InstallationID)
		}
	})

	t.Run("upgrade converges duplicate legacy ownership without deleting history", func(t *testing.T) {
		oldDB := openAppPluginModelDB(t)
		require.NoError(t, oldDB.Migrator().DropTable(
			&AppRouteClaim{},
			&AppInstallationIdempotency{},
			&AppServiceCredential{},
			&AppInstallation{},
		))
		require.NoError(t, oldDB.AutoMigrate(
			&legacyAppInstallation{},
			&AppInstallationIdempotency{},
			&AppServiceCredential{},
		))

		legacyInstallations := []legacyAppInstallation{
			{
				ID:                   201,
				AppKey:               "legacy-duplicate",
				AppVersionID:         "appver-disabled",
				ManifestVersion:      "1.0.0",
				ManifestSHA256:       appPluginDigest("legacy-disabled"),
				BaseURL:              "https://apps.example.com/legacy-disabled/",
				EnabledSurfaces:      AppStringList{},
				AllowedParentOrigins: AppStringList{},
				AllowedOrigins:       AppStringList{},
				AllowedUserPolicy:    AppAllowedUserPolicy{},
				NetworkPolicy:        AppNetworkPolicy{},
				EntitlementPolicyID:  "policy",
				Status:               AppInstallationStatusDisabled,
				Revision:             3,
			},
			{
				ID:                   202,
				AppKey:               "legacy-duplicate",
				AppVersionID:         "appver-enabled-owner",
				ManifestVersion:      "2.0.0",
				ManifestSHA256:       appPluginDigest("legacy-enabled-owner"),
				BaseURL:              "https://apps.example.com/legacy-enabled-owner/",
				EnabledSurfaces:      AppStringList{"direct"},
				AllowedParentOrigins: AppStringList{},
				AllowedOrigins:       AppStringList{},
				AllowedUserPolicy:    AppAllowedUserPolicy{},
				NetworkPolicy:        AppNetworkPolicy{},
				EntitlementPolicyID:  "policy",
				Status:               AppInstallationStatusEnabled,
				Revision:             7,
			},
			{
				ID:                   203,
				AppKey:               "legacy-duplicate",
				AppVersionID:         "appver-enabled-non-owner",
				ManifestVersion:      "3.0.0",
				ManifestSHA256:       appPluginDigest("legacy-enabled-non-owner"),
				BaseURL:              "https://apps.example.com/legacy-enabled-non-owner/",
				EnabledSurfaces:      AppStringList{"embedded"},
				AllowedParentOrigins: AppStringList{"https://console.example.com"},
				AllowedOrigins:       AppStringList{},
				AllowedUserPolicy:    AppAllowedUserPolicy{},
				NetworkPolicy:        AppNetworkPolicy{},
				EntitlementPolicyID:  "policy",
				Status:               AppInstallationStatusEnabled,
				Revision:             11,
			},
		}
		require.NoError(t, oldDB.Create(&legacyInstallations).Error)

		for _, installation := range legacyInstallations {
			installationID := fmt.Sprintf("%d", installation.ID)
			require.NoError(t, oldDB.Create(&AppServiceCredential{
				AppKey:            installation.AppKey,
				InstallationID:    installationID,
				CredentialID:      "cred-" + installationID,
				CredentialHash:    appPluginDigest("credential-" + installationID),
				CredentialVersion: "v" + installationID,
				Status:            "active",
				ExpiresAt:         4102444800,
			}).Error)
			require.NoError(t, oldDB.Create(&AppInstallationIdempotency{
				ScopeHash:      appPluginDigest("scope-" + installationID),
				ActorID:        int64(installation.ID),
				ScopeKey:       "scope-" + installationID,
				ClaimToken:     appPluginDigest("claim-" + installationID),
				RequestHash:    appPluginDigest("request-" + installationID),
				InstallationID: installationID,
				AppVersionID:   installation.AppVersionID,
				ResponseJSON:   `{"installation_id":"` + installationID + `"}`,
				ResponseDigest: appPluginDigest("response-" + installationID),
			}).Error)
		}

		require.NoError(t, MigrateAppPluginTables(oldDB))
		require.NoError(t, MigrateAppPluginTables(oldDB))

		var upgraded []AppInstallation
		require.NoError(t, oldDB.Where("app_key = ?", "legacy-duplicate").Order("id").Find(&upgraded).Error)
		require.Len(t, upgraded, 3)
		assert.Equal(t, []string{
			AppInstallationStatusRevoked,
			AppInstallationStatusEnabled,
			AppInstallationStatusRevoked,
		}, []string{upgraded[0].Status, upgraded[1].Status, upgraded[2].Status})
		assert.Equal(t, []int64{4, 7, 12}, []int64{upgraded[0].Revision, upgraded[1].Revision, upgraded[2].Revision})

		var ownership []AppRouteClaim
		require.NoError(t, oldDB.Where("app_key = ? AND kind = ?", "legacy-duplicate", "app_key").Find(&ownership).Error)
		require.Len(t, ownership, 1)
		assert.Equal(t, "202", ownership[0].InstallationID)

		var credentials []AppServiceCredential
		require.NoError(t, oldDB.Where("app_key = ?", "legacy-duplicate").Order("installation_id").Find(&credentials).Error)
		require.Len(t, credentials, 3)
		assert.Equal(t, []string{"cred-201", "cred-202", "cred-203"}, []string{
			credentials[0].CredentialID,
			credentials[1].CredentialID,
			credentials[2].CredentialID,
		})
		assert.Equal(t, []string{AppInstallationStatusRevoked, "active", AppInstallationStatusRevoked}, []string{
			credentials[0].Status,
			credentials[1].Status,
			credentials[2].Status,
		})

		var frozen []AppInstallationIdempotency
		require.NoError(t, oldDB.Where("installation_id IN ?", []string{"201", "202", "203"}).Order("installation_id").Find(&frozen).Error)
		require.Len(t, frozen, 3)
		assert.Equal(t, []string{
			`{"installation_id":"201"}`,
			`{"installation_id":"202"}`,
			`{"installation_id":"203"}`,
		}, []string{frozen[0].ResponseJSON, frozen[1].ResponseJSON, frozen[2].ResponseJSON})
	})

	t.Run("migration does not restore ownership after a concurrent revoke", func(t *testing.T) {
		if db.Dialector.Name() == "sqlite" {
			t.Skip("requires row-level transaction concurrency")
		}

		raceDB := openAppPluginModelDB(t)
		require.NoError(t, MigrateAppPluginTables(raceDB))
		seedAppPluginModelPolicy(t, raceDB, "policy-basic")
		req := appPluginModelInstallRequest("migration-revoke", "1.0.0", "https://apps.example.com/migration-revoke/")
		installed, err := InstallAppVersion(context.Background(), raceDB, AppIdempotencyScope{ActorID: 10, Key: "migration-revoke"}, req)
		require.NoError(t, err)
		enabled, err := CompareAndSwapAppInstallationStatus(
			context.Background(),
			raceDB,
			installed.InstallationID,
			installed.Revision,
			AppInstallationStatusEnabled,
		)
		require.NoError(t, err)

		barrierCtx, cancelBarrier := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelBarrier()
		snapshotReady := make(chan struct{}, 1)
		releaseSnapshot := make(chan struct{})
		var releaseOnce sync.Once
		release := func() {
			releaseOnce.Do(func() {
				close(releaseSnapshot)
			})
		}
		defer release()

		const callbackName = "test:app_plugin_migration_revoke_snapshot"
		var coordinated atomic.Bool
		require.NoError(t, raceDB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_installations" || !coordinated.CompareAndSwap(false, true) {
				return
			}
			if _, ok := tx.Statement.Dest.(*[]AppInstallation); !ok {
				return
			}
			select {
			case snapshotReady <- struct{}{}:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("migration snapshot barrier: %w", barrierCtx.Err()))
				return
			}
			select {
			case <-releaseSnapshot:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("migration snapshot release: %w", barrierCtx.Err()))
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, raceDB.Callback().Query().Remove(callbackName))
		})

		migrationResult := make(chan error, 1)
		go func() {
			migrationResult <- MigrateAppPluginTables(raceDB.WithContext(barrierCtx))
		}()

		select {
		case <-snapshotReady:
		case <-barrierCtx.Done():
			t.Fatalf("migration did not read active installations: %v", barrierCtx.Err())
		}
		revoked, err := CompareAndSwapAppInstallationStatus(
			barrierCtx,
			raceDB,
			enabled.InstallationID,
			enabled.Revision,
			AppInstallationStatusRevoked,
		)
		require.NoError(t, err)
		require.Equal(t, AppInstallationStatusRevoked, revoked.Status)
		release()

		select {
		case err := <-migrationResult:
			require.NoError(t, err)
		case <-barrierCtx.Done():
			t.Fatalf("migration did not finish: %v", barrierCtx.Err())
		}

		var current AppInstallation
		require.NoError(t, raceDB.Where("installation_id = ?", installed.InstallationID).First(&current).Error)
		assert.Equal(t, AppInstallationStatusRevoked, current.Status)
		assert.Zero(t, appPluginCountForKey(t, raceDB, &AppRouteClaim{}, req.AppKey))
	})

	t.Run("migration DML retries a deadlock and replays one app key owner", func(t *testing.T) {
		if db.Dialector.Name() != "mysql" {
			t.Skip("requires MySQL deadlock retry semantics")
		}

		installation := AppInstallation{
			InstallationID:       "migration-retry-installation",
			AppKey:               "migration-retry",
			AppVersionID:         "migration-retry-version",
			ManifestVersion:      "1.0.0",
			ManifestSHA256:       appPluginDigest("migration-retry"),
			BaseURL:              "https://apps.example.com/migration-retry/",
			EnabledSurfaces:      AppStringList{},
			AllowedParentOrigins: AppStringList{},
			AllowedOrigins:       AppStringList{},
			AllowedUserPolicy:    AppAllowedUserPolicy{},
			NetworkPolicy:        AppNetworkPolicy{},
			Status:               AppInstallationStatusDisabled,
			Revision:             1,
		}
		require.NoError(t, db.Create(&installation).Error)

		const callbackName = "test:app_plugin_migration_deadlock"
		var attempts atomic.Int32
		require.NoError(t, db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
			claim, ok := tx.Statement.Dest.(*AppRouteClaim)
			if !ok || claim.AppKey != installation.AppKey || claim.Kind != "app_key" {
				return
			}
			if attempts.Add(1) == 1 {
				tx.AddError(&mysqlDriver.MySQLError{Number: 1213, Message: "injected migration deadlock"})
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Create().Remove(callbackName))
		})

		require.NoError(t, MigrateAppPluginTables(db))
		assert.Equal(t, int32(2), attempts.Load())
		require.NoError(t, MigrateAppPluginTables(db))

		var ownership []AppRouteClaim
		require.NoError(t, db.Where("app_key = ? AND kind = ?", installation.AppKey, "app_key").Find(&ownership).Error)
		require.Len(t, ownership, 1)
		assert.Equal(t, installation.InstallationID, ownership[0].InstallationID)
	})
}

type legacyAppInstallation struct {
	ID                   uint   `gorm:"primaryKey"`
	AppKey               string `gorm:"size:128;not null;index"`
	AppVersionID         string `gorm:"size:64;not null;index"`
	ManifestVersion      string `gorm:"size:64;not null"`
	ManifestSHA256       string `gorm:"size:64;not null"`
	BaseURL              string `gorm:"size:512;not null"`
	EnabledSurfaces      AppStringList
	AllowedParentOrigins AppStringList
	AllowedOrigins       AppStringList
	AllowedUserPolicy    AppAllowedUserPolicy
	NetworkPolicy        AppNetworkPolicy
	EntitlementPolicyID  string `gorm:"size:64;not null"`
	Status               string `gorm:"size:32;not null;index"`
	Revision             int64  `gorm:"not null"`
}

func (legacyAppInstallation) TableName() string {
	return "app_installations"
}

func TestAppInstallIdempotencyAndVersionConflict(t *testing.T) {
	db := openAppPluginModelDB(t)
	logAppPluginDBVersion(t, db)
	t.Run("records database runtime metadata", func(t *testing.T) {
		assertAppPluginModelRuntimeMetadata(t, db)
	})
	require.NoError(t, MigrateAppPluginTables(db))
	seedAppPluginModelPolicy(t, db, "policy-basic")

	t.Run("legacy request hash and frozen replay remain compatible", func(t *testing.T) {
		req := appPluginModelInstallRequest("legacy-hash", "1.0.0", "https://apps.example.com/legacy-hash/")
		// SHA-256 of the pre-draft AppInstallRequest JSON field sequence.
		const legacyHash = "61a7e12bd1a7dd554f7f6de0f89ef7a045a6cec20510ca5bb308c3b92aa00b73"
		hash, err := appInstallRequestHash(req)
		require.NoError(t, err)
		assert.Equal(t, legacyHash, hash)
		scope := AppIdempotencyScope{ActorID: 19, Key: "legacy-hash"}
		first, err := InstallAppVersion(t.Context(), db, scope, req)
		require.NoError(t, err)
		require.NoError(t, db.Model(&AppInstallationIdempotency{}).Where("scope_key = ?", scope.Key).
			Update("request_hash", legacyHash).Error)
		replayed, found, err := ReplayAppInstall(t.Context(), db, scope, req)
		require.NoError(t, err)
		assert.True(t, found)
		assert.Equal(t, first, replayed)
	})

	t.Run("maps model errors to the stable error registry", func(t *testing.T) {
		tests := []struct {
			name string
			err  error
			code string
		}{
			{name: "version conflict", err: ErrAppVersionConflict, code: "app_version_conflict"},
			{name: "idempotency conflict", err: ErrAppIdempotencyConflict, code: "idempotency_conflict"},
			{name: "route collision", err: ErrAppRouteClaimConflict, code: "app_route_collision"},
			{name: "revision conflict", err: ErrAppInstallationRevisionConflict, code: "version_conflict"},
			{name: "unapproved installation upgrade", err: ErrAppInstallationUpgradeForbidden, code: "forbidden"},
			{name: "revoked installation", err: ErrAppInstallationRevoked, code: "invalid_state_transition"},
			{name: "invalid installation status", err: ErrAppInstallationStatusInvalid, code: "invalid_state_transition"},
			{name: "invalid install request", err: ErrAppInstallRequestInvalid, code: "validation_error"},
			{name: "unknown internal error", err: errors.New("database unavailable"), code: "service_unavailable"},
		}
		for _, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				assert.Equal(t, test.code, AppPluginErrorCode(fmt.Errorf("wrapped: %w", test.err)))
			})
		}
	})

	t.Run("same scope request hash and content digest replays frozen response with stable IDs", func(t *testing.T) {
		req := appPluginModelInstallRequest("writer", "1.0.0", "https://apps.example.com/writer/")
		scope := AppIdempotencyScope{ActorID: 11, Key: "install-writer-1"}

		first, err := InstallAppVersion(context.Background(), db, scope, req)
		require.NoError(t, err)
		second, err := InstallAppVersion(context.Background(), db, scope, req)
		require.NoError(t, err)

		assert.Equal(t, first.AppVersionID, second.AppVersionID)
		assert.Equal(t, first.InstallationID, second.InstallationID)
		assert.Equal(t, first.ResponseDigest, second.ResponseDigest)
		assert.Equal(t, first, second)
	})

	t.Run("same immutable version replays its original response across idempotency scopes", func(t *testing.T) {
		for _, differentHostInput := range []bool{false, true} {
			t.Run(fmt.Sprintf("different_host_input_%t", differentHostInput), func(t *testing.T) {
				key := fmt.Sprintf("version-replay-%t", differentHostInput)
				firstRequest := appPluginModelInstallRequest(key, "1.0.0", "https://apps.example.com/"+key+"/")
				first, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 111, Key: key + "-first"}, firstRequest)
				require.NoError(t, err)

				replayRequest := firstRequest
				if differentHostInput {
					replayRequest.BaseURL = "https://apps.example.com/" + key + "-changed/"
					replayRequest.CallbackURL = replayRequest.BaseURL + "callback"
					replayRequest.DirectURL = replayRequest.BaseURL + "direct"
					replayRequest.EmbeddedURL = replayRequest.BaseURL + "embedded"
					replayRequest.EnabledSurfaces = []string{"direct"}
					replayRequest.AllowedOrigins = []string{"https://changed.example.com"}
					replayRequest.ServiceCredentialID = "changed-" + replayRequest.ServiceCredentialID
				}
				replayScope := AppIdempotencyScope{ActorID: 111, Key: key + "-replay"}
				replayed, err := InstallAppVersion(context.Background(), db, replayScope, replayRequest)
				require.NoError(t, err)
				assert.Equal(t, first, replayed)

				replayedAgain, err := InstallAppVersion(context.Background(), db, replayScope, replayRequest)
				require.NoError(t, err)
				assert.Equal(t, first, replayedAgain)

				assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppVersion{}, key))
				assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppInstallation{}, key))
				assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppServiceCredential{}, key))
				assert.Equal(t, int64(4), appPluginCountForKey(t, db, &AppRouteClaim{}, key))

				var frozen AppInstallationIdempotency
				require.NoError(t, db.Where("scope_key = ?", replayScope.Key).First(&frozen).Error)
				assert.Equal(t, first.InstallationID, frozen.InstallationID)
				assert.Equal(t, first.ResponseDigest, frozen.ResponseDigest)
			})
		}
	})

	t.Run("concurrent same scope frozen replay returns the original response", func(t *testing.T) {
		if db.Dialector.Name() != "mysql" {
			t.Skip("requires MySQL REPEATABLE READ snapshot semantics")
		}

		req := appPluginModelInstallRequest("concurrent-frozen-replay", "1.0.0", "https://apps.example.com/concurrent-frozen-replay/")
		original, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 112, Key: "concurrent-frozen-replay-original"}, req)
		require.NoError(t, err)

		barrierCtx, cancelBarrier := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelBarrier()
		const callbackName = "test:app_plugin_same_scope_frozen_replay_snapshot"
		snapshotsReady := make(chan struct{}, 2)
		releaseSnapshots := make(chan struct{})
		var releaseOnce sync.Once
		release := func() {
			releaseOnce.Do(func() {
				close(releaseSnapshots)
			})
		}
		defer release()
		var coordinated atomic.Int32
		require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_installation_idempotencies" || coordinated.Add(1) > 2 {
				return
			}
			select {
			case snapshotsReady <- struct{}{}:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("same-scope replay snapshot barrier: %w", barrierCtx.Err()))
				return
			}
			select {
			case <-releaseSnapshots:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("same-scope replay snapshot release: %w", barrierCtx.Err()))
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Query().Remove(callbackName))
		})

		scope := AppIdempotencyScope{ActorID: 112, Key: "concurrent-frozen-replay"}
		start := make(chan struct{})
		results := make(chan AppInstallResult, 2)
		foundResults := make(chan bool, 2)
		errs := make(chan error, 2)
		var wg sync.WaitGroup
		for range 2 {
			wg.Go(func() {
				<-start
				result, found, replayErr := ReplayAppInstall(barrierCtx, db, scope, req)
				results <- result
				foundResults <- found
				errs <- replayErr
			})
		}
		close(start)
		for range 2 {
			select {
			case <-snapshotsReady:
			case <-barrierCtx.Done():
				t.Fatalf("same-scope replays did not reach their snapshots: %v", barrierCtx.Err())
			}
		}
		release()
		workersDone := make(chan struct{})
		go func() {
			wg.Wait()
			close(workersDone)
		}()
		select {
		case <-workersDone:
		case <-barrierCtx.Done():
			t.Fatalf("same-scope replays did not finish: %v", barrierCtx.Err())
		}
		close(results)
		close(foundResults)
		close(errs)

		for replayErr := range errs {
			require.NoError(t, replayErr)
		}
		for found := range foundResults {
			assert.True(t, found)
		}
		for result := range results {
			assert.Equal(t, original, result)
		}
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppVersion{}, req.AppKey))
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppInstallation{}, req.AppKey))
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppServiceCredential{}, req.AppKey))
		assert.Equal(t, int64(4), appPluginCountForKey(t, db, &AppRouteClaim{}, req.AppKey))
		assert.Equal(t, int64(1), appPluginCountForScope(t, db, scope.Key))
	})

	t.Run("new scope generation replay does not freeze a concurrently revoked installation", func(t *testing.T) {
		if db.Dialector.Name() != "mysql" {
			t.Skip("requires MySQL REPEATABLE READ snapshot semantics")
		}

		req := appPluginModelInstallRequest("replay-revoke", "1.0.0", "https://apps.example.com/replay-revoke/")
		originalScope := AppIdempotencyScope{ActorID: 113, Key: "replay-revoke-original"}
		original, err := InstallAppVersion(context.Background(), db, originalScope, req)
		require.NoError(t, err)

		barrierCtx, cancelBarrier := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelBarrier()
		versionSnapshotReady := make(chan struct{}, 1)
		releaseVersionSnapshot := make(chan struct{})
		var releaseOnce sync.Once
		release := func() {
			releaseOnce.Do(func() {
				close(releaseVersionSnapshot)
			})
		}
		defer release()

		const callbackName = "test:app_plugin_generation_replay_revoke_snapshot"
		var coordinated atomic.Bool
		require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_versions" || !coordinated.CompareAndSwap(false, true) {
				return
			}
			if _, ok := tx.Statement.Dest.(*AppVersion); !ok {
				return
			}
			select {
			case versionSnapshotReady <- struct{}{}:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("generation replay snapshot barrier: %w", barrierCtx.Err()))
				return
			}
			select {
			case <-releaseVersionSnapshot:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("generation replay snapshot release: %w", barrierCtx.Err()))
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Query().Remove(callbackName))
		})

		type replayOutcome struct {
			result AppInstallResult
			found  bool
			err    error
		}
		newScope := AppIdempotencyScope{ActorID: 113, Key: "replay-revoke-new-scope"}
		replayResult := make(chan replayOutcome, 1)
		go func() {
			result, found, replayErr := ReplayAppInstall(barrierCtx, db, newScope, req)
			replayResult <- replayOutcome{result: result, found: found, err: replayErr}
		}()

		select {
		case <-versionSnapshotReady:
		case <-barrierCtx.Done():
			t.Fatalf("generation replay did not read the immutable version: %v", barrierCtx.Err())
		}
		revoked, err := CompareAndSwapAppInstallationStatus(
			barrierCtx,
			db,
			original.InstallationID,
			original.Revision,
			AppInstallationStatusRevoked,
		)
		require.NoError(t, err)
		require.Equal(t, AppInstallationStatusRevoked, revoked.Status)
		release()

		var outcome replayOutcome
		select {
		case outcome = <-replayResult:
		case <-barrierCtx.Done():
			t.Fatalf("generation replay did not finish: %v", barrierCtx.Err())
		}
		require.NoError(t, outcome.err)
		assert.False(t, outcome.found)
		assert.Equal(t, AppInstallResult{}, outcome.result)
		assert.Zero(t, appPluginCountForScope(t, db, newScope.Key))

		sameScope, found, err := ReplayAppInstall(barrierCtx, db, originalScope, req)
		require.NoError(t, err)
		require.True(t, found)
		assert.Equal(t, original, sameScope)
	})

	t.Run("same app key and version with different canonical manifest digest is a stable conflict", func(t *testing.T) {
		first := appPluginModelInstallRequest("writer", "1.1.0", "https://apps.example.com/writer-1-1/")
		second := first
		second.CanonicalManifestJSON = []byte(`{"apiVersion":1,"kind":"app","key":"writer","version":"1.1.0","name":"changed"}`)
		second.ManifestSHA256 = appPluginDigest(string(second.CanonicalManifestJSON))

		_, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 12, Key: "first"}, first)
		require.NoError(t, err)
		_, err = InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 12, Key: "second"}, second)

		require.Error(t, err)
		assert.ErrorIs(t, err, ErrAppVersionConflict)
		assert.Equal(t, "app_version_conflict", AppPluginErrorCode(err))
	})

	t.Run("same idempotency scope with a different request hash conflicts", func(t *testing.T) {
		scope := AppIdempotencyScope{ActorID: 13, Key: "install-writer-2"}
		first := appPluginModelInstallRequest("reader", "1.0.0", "https://apps.example.com/reader/")
		second := appPluginModelInstallRequest("reader", "1.0.0", "https://apps.example.com/reader-v2/")

		_, err := InstallAppVersion(context.Background(), db, scope, first)
		require.NoError(t, err)
		_, err = InstallAppVersion(context.Background(), db, scope, second)

		require.Error(t, err)
		assert.ErrorIs(t, err, ErrAppIdempotencyConflict)
	})

	t.Run("failed install does not reserve an idempotency row", func(t *testing.T) {
		scope := AppIdempotencyScope{ActorID: 14, Key: "route-collision-retry"}
		first := appPluginModelInstallRequest("owner", "1.0.0", "https://apps.example.com/owner/")
		colliding := appPluginModelInstallRequest("intruder", "1.0.0", "https://apps.example.com/intruder/")
		colliding.CallbackURL = first.CallbackURL

		_, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 14, Key: "owner"}, first)
		require.NoError(t, err)
		_, err = InstallAppVersion(context.Background(), db, scope, colliding)
		require.Error(t, err)

		var rows int64
		require.NoError(t, db.Model(&AppInstallationIdempotency{}).Where("scope_key = ?", scope.Key).Count(&rows).Error)
		assert.Zero(t, rows)
	})

	t.Run("scope identity remains case-sensitive on every database", func(t *testing.T) {
		upper := appPluginModelInstallRequest("scope-upper", "1.0.0", "https://apps.example.com/scope-upper/")
		lower := appPluginModelInstallRequest("scope-lower", "1.0.0", "https://apps.example.com/scope-lower/")

		_, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 15, Key: "CaseSensitive"}, upper)
		require.NoError(t, err)
		_, err = InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 15, Key: "casesensitive"}, lower)
		require.NoError(t, err)
	})

	t.Run("rejects tampered or malformed canonical manifest without persistence", func(t *testing.T) {
		tests := []struct {
			name   string
			mutate func(*AppInstallRequest)
		}{
			{
				name: "tampered digest",
				mutate: func(req *AppInstallRequest) {
					req.ManifestSHA256 = appPluginDigest("tampered")
				},
			},
			{
				name: "malformed JSON",
				mutate: func(req *AppInstallRequest) {
					req.CanonicalManifestJSON = []byte(`{"key":`)
					req.ManifestSHA256 = appPluginDigest(string(req.CanonicalManifestJSON))
				},
			},
		}
		for i, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				key := fmt.Sprintf("invalid-manifest-%d", i)
				req := appPluginModelInstallRequest(key, "1.0.0", fmt.Sprintf("https://apps.example.com/invalid/%d/", i))
				test.mutate(&req)
				before := appPluginPersistenceCounts(t, db)

				_, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 16, Key: fmt.Sprintf("%s-%d", test.name, i)}, req)

				require.Error(t, err)
				assert.ErrorIs(t, err, ErrAppInstallRequestInvalid)
				assert.Equal(t, before, appPluginPersistenceCounts(t, db))
			})
		}
	})

	t.Run("rejects manifest key or version mismatch without persistence", func(t *testing.T) {
		for i, field := range []string{"key", "version"} {
			t.Run(field, func(t *testing.T) {
				key := fmt.Sprintf("manifest-mismatch-%d", i)
				req := appPluginModelInstallRequest(key, "1.0.0", fmt.Sprintf("https://apps.example.com/mismatch/%d/", i))
				if field == "key" {
					req.AppKey = "different-key"
				} else {
					req.ManifestVersion = "2.0.0"
				}
				before := appPluginPersistenceCounts(t, db)

				_, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 17, Key: fmt.Sprintf("%s-%d", field, i)}, req)

				require.Error(t, err)
				assert.ErrorIs(t, err, ErrAppInstallRequestInvalid)
				assert.Equal(t, before, appPluginPersistenceCounts(t, db))
			})
		}
	})

	t.Run("rejects invalid host-owned input without persistence", func(t *testing.T) {
		tests := []struct {
			name   string
			mutate func(*AppInstallRequest)
		}{
			{name: "insecure base URL", mutate: func(req *AppInstallRequest) { req.BaseURL = "http://apps.example.com/plugin/" }},
			{name: "endpoint outside base URL", mutate: func(req *AppInstallRequest) { req.CallbackURL = "https://evil.example/callback" }},
			{name: "callback dot traversal", mutate: func(req *AppInstallRequest) { req.CallbackURL = req.BaseURL + "../outside" }},
			{name: "direct encoded traversal", mutate: func(req *AppInstallRequest) { req.DirectURL = req.BaseURL + "%2e%2e/outside" }},
			{name: "embedded different origin", mutate: func(req *AppInstallRequest) { req.EmbeddedURL = "https://other.example.com/embedded" }},
			{name: "embedded different port", mutate: func(req *AppInstallRequest) { req.EmbeddedURL = "https://apps.example.com:8443/app/embedded" }},
			{name: "endpoint prefix sibling", mutate: func(req *AppInstallRequest) {
				req.CallbackURL = strings.TrimSuffix(req.BaseURL, "/") + "-outside/callback"
			}},
			{name: "unknown enabled surface", mutate: func(req *AppInstallRequest) { req.EnabledSurfaces = []string{"admin"} }},
			{name: "non-origin parent URL", mutate: func(req *AppInstallRequest) { req.AllowedParentOrigins = []string{"https://console.example.com/path"} }},
			{name: "insecure allowed origin", mutate: func(req *AppInstallRequest) { req.AllowedOrigins = []string{"http://apps.example.com"} }},
			{name: "invalid user group reference", mutate: func(req *AppInstallRequest) { req.AllowedUserPolicy.Groups = []string{""} }},
			{name: "invalid network host reference", mutate: func(req *AppInstallRequest) { req.NetworkPolicy.AllowHosts = []string{"https://api.example.com/path"} }},
			{name: "unknown entitlement policy reference", mutate: func(req *AppInstallRequest) { req.EntitlementPolicyID = "missing-policy" }},
			{name: "missing credential ID", mutate: func(req *AppInstallRequest) { req.ServiceCredentialID = "" }},
			{name: "missing credential version", mutate: func(req *AppInstallRequest) { req.ServiceCredentialVersion = "" }},
			{name: "invalid credential hash", mutate: func(req *AppInstallRequest) { req.ServiceCredentialHash = "not-a-sha256" }},
			{name: "invalid credential expiry", mutate: func(req *AppInstallRequest) { req.ServiceCredentialExpiry = 0 }},
		}
		for i, test := range tests {
			t.Run(test.name, func(t *testing.T) {
				key := fmt.Sprintf("invalid-host-%d", i)
				req := appPluginModelInstallRequest(key, "1.0.0", fmt.Sprintf("https://apps.example.com/invalid-host/%d/", i))
				test.mutate(&req)
				before := appPluginPersistenceCounts(t, db)

				_, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 18, Key: fmt.Sprintf("%s-%d", test.name, i)}, req)

				require.Error(t, err)
				assert.ErrorIs(t, err, ErrAppInstallRequestInvalid)
				assert.Equal(t, before, appPluginPersistenceCounts(t, db))
			})
		}
	})

	t.Run("disabled install may omit service credential but rejects partial identity", func(t *testing.T) {
		credentialless := appPluginModelInstallRequest("credentialless", "1.0.0", "https://apps.example.com/credentialless/")
		credentialless.ServiceCredentialHash = ""
		credentialless.ServiceCredentialID = ""
		credentialless.ServiceCredentialVersion = ""
		credentialless.ServiceCredentialExpiry = 0

		result, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 19, Key: "credentialless"}, credentialless)
		require.NoError(t, err)
		assert.Equal(t, AppCredentialMeta{}, result.ServiceCredentialSet)
		assert.Equal(t, int64(0), appPluginCountForInstallation(t, db, &AppServiceCredential{}, result.InstallationID))

		partialMutations := []func(*AppInstallRequest){
			func(req *AppInstallRequest) { req.ServiceCredentialID = "" },
			func(req *AppInstallRequest) { req.ServiceCredentialVersion = "" },
			func(req *AppInstallRequest) { req.ServiceCredentialHash = "" },
			func(req *AppInstallRequest) { req.ServiceCredentialExpiry = 0 },
		}
		for i, mutate := range partialMutations {
			partial := appPluginModelInstallRequest(fmt.Sprintf("partial-credential-%d", i), "1.0.0", fmt.Sprintf("https://apps.example.com/partial-credential-%d/", i))
			mutate(&partial)
			before := appPluginPersistenceCounts(t, db)

			_, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 19, Key: fmt.Sprintf("partial-credential-%d", i)}, partial)

			require.Error(t, err)
			assert.ErrorIs(t, err, ErrAppInstallRequestInvalid)
			assert.Equal(t, before, appPluginPersistenceCounts(t, db))
		}
	})

	t.Run("disabled install may omit entitlement policy", func(t *testing.T) {
		req := appPluginModelInstallRequest("policyless", "1.0.0", "https://apps.example.com/policyless/")
		req.EntitlementPolicyID = ""

		result, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 20, Key: "policyless"}, req)

		require.NoError(t, err)
		assert.Empty(t, result.EntitlementPolicyVersion)
	})
}

func TestAppInstallRouteCollisionIsAtomic(t *testing.T) {
	db := openAppPluginModelDB(t)
	logAppPluginDBVersion(t, db)
	t.Run("records database runtime metadata", func(t *testing.T) {
		assertAppPluginModelRuntimeMetadata(t, db)
	})
	require.NoError(t, MigrateAppPluginTables(db))
	seedAppPluginModelPolicy(t, db, "policy-basic")

	first := appPluginModelInstallRequest("routes-one", "1.0.0", "https://apps.example.com/one/")
	result, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 21, Key: "routes-one"}, first)
	require.NoError(t, err)

	for _, endpoint := range []string{first.CallbackURL, first.DirectURL, first.EmbeddedURL} {
		var claim AppRouteClaim
		require.NoError(t, db.Where("absolute_endpoint = ?", endpoint).First(&claim).Error)
		assert.Equal(t, result.InstallationID, claim.InstallationID)
	}

	colliding := appPluginModelInstallRequest("routes-two", "1.0.0", "https://apps.example.com/one/")
	_, err = InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 22, Key: "routes-two"}, colliding)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrAppRouteClaimConflict)

	for _, table := range []any{&AppVersion{}, &AppInstallation{}, &AppRouteClaim{}, &AppServiceCredential{}} {
		var rows int64
		require.NoError(t, db.Model(table).Where("app_key = ?", "routes-two").Count(&rows).Error)
		assert.Zero(t, rows)
	}

	t.Run("concurrent different apps leave one route owner and a stable collision", func(t *testing.T) {
		if db.Dialector.Name() != "mysql" {
			t.Skip("requires MySQL REPEATABLE READ snapshot semantics")
		}

		barrierCtx, cancelBarrier := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelBarrier()
		const callbackName = "test:app_plugin_route_claim_snapshot"
		snapshotsReady := make(chan struct{}, 2)
		releaseSnapshots := make(chan struct{})
		var releaseOnce sync.Once
		release := func() {
			releaseOnce.Do(func() {
				close(releaseSnapshots)
			})
		}
		defer release()
		var coordinated atomic.Int32
		require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_entitlement_policies" || coordinated.Add(1) > 2 {
				return
			}
			select {
			case snapshotsReady <- struct{}{}:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("route collision snapshot barrier: %w", barrierCtx.Err()))
				return
			}
			select {
			case <-releaseSnapshots:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("route collision snapshot release: %w", barrierCtx.Err()))
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Query().Remove(callbackName))
		})

		type installOutcome struct {
			appKey string
			result AppInstallResult
			err    error
		}
		start := make(chan struct{})
		outcomes := make(chan installOutcome, 2)
		requests := []AppInstallRequest{
			appPluginModelInstallRequest("concurrent-route-one", "1.0.0", "https://apps.example.com/concurrent-route/"),
			appPluginModelInstallRequest("concurrent-route-two", "1.0.0", "https://apps.example.com/concurrent-route/"),
		}
		var wg sync.WaitGroup
		for i := range requests {
			req := requests[i]
			wg.Go(func() {
				<-start
				result, installErr := InstallAppVersion(
					barrierCtx,
					db,
					AppIdempotencyScope{ActorID: int64(220 + i), Key: "concurrent-route-" + req.AppKey},
					req,
				)
				outcomes <- installOutcome{appKey: req.AppKey, result: result, err: installErr}
			})
		}
		close(start)
		for range 2 {
			select {
			case <-snapshotsReady:
			case <-barrierCtx.Done():
				t.Fatalf("route collision installs did not reach their snapshots: %v", barrierCtx.Err())
			}
		}
		release()
		workersDone := make(chan struct{})
		go func() {
			wg.Wait()
			close(workersDone)
		}()
		select {
		case <-workersDone:
		case <-barrierCtx.Done():
			t.Fatalf("route collision installs did not finish: %v", barrierCtx.Err())
		}
		close(outcomes)

		var winner installOutcome
		successes := 0
		conflicts := 0
		for outcome := range outcomes {
			switch {
			case outcome.err == nil:
				winner = outcome
				successes++
			case errors.Is(outcome.err, ErrAppRouteClaimConflict):
				assert.Equal(t, "app_route_collision", AppPluginErrorCode(outcome.err))
				conflicts++
			default:
				require.NoError(t, outcome.err)
			}
		}
		require.Equal(t, 1, successes)
		require.Equal(t, 1, conflicts)

		var claims []AppRouteClaim
		require.NoError(t, db.Where("absolute_endpoint IN ?", []string{
			requests[0].CallbackURL,
			requests[0].DirectURL,
			requests[0].EmbeddedURL,
		}).Find(&claims).Error)
		require.Len(t, claims, 3)
		for _, claim := range claims {
			assert.Equal(t, winner.appKey, claim.AppKey)
			assert.Equal(t, winner.result.InstallationID, claim.InstallationID)
		}
		assert.Equal(t, int64(4), appPluginCountForKey(t, db, &AppRouteClaim{}, winner.appKey))
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppInstallation{}, winner.appKey))
		for _, req := range requests {
			if req.AppKey == winner.appKey {
				continue
			}
			assert.Zero(t, appPluginCountForKey(t, db, &AppRouteClaim{}, req.AppKey))
			assert.Zero(t, appPluginCountForKey(t, db, &AppInstallation{}, req.AppKey))
		}
	})

	t.Run("new immutable version atomically upgrades the existing installation", func(t *testing.T) {
		v1 := appPluginModelInstallRequest("atomic-upgrade", "1.0.0", "https://apps.example.com/atomic-upgrade-v1/")
		created, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 23, Key: "atomic-upgrade-v1"}, v1)
		require.NoError(t, err)
		enabled, err := CompareAndSwapAppInstallationStatus(context.Background(), db, created.InstallationID, created.Revision, AppInstallationStatusEnabled)
		require.NoError(t, err)

		v2 := appPluginModelInstallRequest("atomic-upgrade", "2.0.0", "https://apps.example.com/atomic-upgrade-v2/")
		v2.EnabledSurfaces = []string{"direct"}
		v2.AllowedOrigins = []string{"https://v2.example.com"}
		upgraded, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 23, Key: "atomic-upgrade-v2"}, v2)
		require.NoError(t, err)

		assert.Equal(t, created.InstallationID, upgraded.InstallationID)
		assert.Equal(t, enabled.Revision+1, upgraded.Revision)
		assert.Equal(t, AppInstallationStatusDisabled, upgraded.Status)
		assert.Equal(t, v2.BaseURL, upgraded.BaseURL)
		assert.Equal(t, v2.EnabledSurfaces, upgraded.EnabledSurfaces)
		assert.Equal(t, v2.AllowedOrigins, upgraded.AllowedOrigins)
		assert.Equal(t, int64(2), appPluginCountForKey(t, db, &AppVersion{}, v2.AppKey))
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppInstallation{}, v2.AppKey))
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppServiceCredential{}, v2.AppKey))
		assert.Equal(t, int64(4), appPluginCountForKey(t, db, &AppRouteClaim{}, v2.AppKey))
		for _, endpoint := range []string{v1.CallbackURL, v1.DirectURL, v1.EmbeddedURL} {
			assert.Equal(t, int64(0), appPluginCountForEndpoint(t, db, endpoint))
		}
		for _, endpoint := range []string{v2.CallbackURL, v2.DirectURL, v2.EmbeddedURL} {
			assert.Equal(t, int64(1), appPluginCountForEndpoint(t, db, endpoint))
		}
	})

	t.Run("upgrade without credential input preserves existing credential", func(t *testing.T) {
		v1 := appPluginModelInstallRequest("credential-preserved", "1.0.0", "https://apps.example.com/credential-preserved-v1/")
		created, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 25, Key: "credential-preserved-v1"}, v1)
		require.NoError(t, err)
		var original AppServiceCredential
		require.NoError(t, db.Where("installation_id = ?", created.InstallationID).First(&original).Error)

		v2 := appPluginModelInstallRequest("credential-preserved", "2.0.0", "https://apps.example.com/credential-preserved-v2/")
		v2.ServiceCredentialHash = ""
		v2.ServiceCredentialID = ""
		v2.ServiceCredentialVersion = ""
		v2.ServiceCredentialExpiry = 0
		upgraded, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 25, Key: "credential-preserved-v2"}, v2)
		require.NoError(t, err)

		assert.Equal(t, credentialMeta(original), upgraded.ServiceCredentialSet)
		assert.Equal(t, int64(1), appPluginCountForInstallation(t, db, &AppServiceCredential{}, created.InstallationID))
		var preserved AppServiceCredential
		require.NoError(t, db.Where("installation_id = ?", created.InstallationID).First(&preserved).Error)
		assert.Equal(t, original, preserved)
	})

	t.Run("upgrade credential metadata cannot replace existing credential", func(t *testing.T) {
		v1 := appPluginModelInstallRequest("credential-metadata-ignored", "1.0.0", "https://apps.example.com/credential-metadata-ignored-v1/")
		created, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 26, Key: "credential-metadata-ignored-v1"}, v1)
		require.NoError(t, err)
		var original AppServiceCredential
		require.NoError(t, db.Where("installation_id = ?", created.InstallationID).First(&original).Error)

		v2 := appPluginModelInstallRequest("credential-metadata-ignored", "2.0.0", "https://apps.example.com/credential-metadata-ignored-v2/")
		v2.ServiceCredentialHash = appPluginDigest("replacement-credential")
		v2.ServiceCredentialID = "replacement-credential"
		v2.ServiceCredentialVersion = "replacement-version"
		v2.ServiceCredentialExpiry = 4102444900
		upgraded, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 26, Key: "credential-metadata-ignored-v2"}, v2)
		require.NoError(t, err)

		assert.Equal(t, credentialMeta(original), upgraded.ServiceCredentialSet)
		assert.Equal(t, int64(1), appPluginCountForInstallation(t, db, &AppServiceCredential{}, created.InstallationID))
		var preserved AppServiceCredential
		require.NoError(t, db.Where("installation_id = ?", created.InstallationID).First(&preserved).Error)
		assert.Equal(t, original, preserved)
	})

	t.Run("upgrade route collision rolls back version configuration claims and idempotency", func(t *testing.T) {
		blocker := appPluginModelInstallRequest("upgrade-blocker", "1.0.0", "https://apps.example.com/rollback-upgrade-v2/")
		_, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 24, Key: "upgrade-blocker"}, blocker)
		require.NoError(t, err)

		v1 := appPluginModelInstallRequest("rollback-upgrade", "1.0.0", "https://apps.example.com/rollback-upgrade-v1/")
		created, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 24, Key: "rollback-upgrade-v1"}, v1)
		require.NoError(t, err)
		var before AppInstallation
		require.NoError(t, db.Where("installation_id = ?", created.InstallationID).First(&before).Error)
		var credentialBefore AppServiceCredential
		require.NoError(t, db.Where("installation_id = ?", created.InstallationID).First(&credentialBefore).Error)

		v2 := appPluginModelInstallRequest("rollback-upgrade", "2.0.0", "https://apps.example.com/rollback-upgrade-v2/")
		_, err = InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 24, Key: "rollback-upgrade-v2"}, v2)
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrAppRouteClaimConflict)

		var after AppInstallation
		require.NoError(t, db.Where("installation_id = ?", created.InstallationID).First(&after).Error)
		assert.Equal(t, before, after)
		var credentialAfter AppServiceCredential
		require.NoError(t, db.Where("installation_id = ?", created.InstallationID).First(&credentialAfter).Error)
		assert.Equal(t, credentialBefore, credentialAfter)
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppVersion{}, v1.AppKey))
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppInstallation{}, v1.AppKey))
		assert.Equal(t, int64(4), appPluginCountForKey(t, db, &AppRouteClaim{}, v1.AppKey))
		assert.Equal(t, int64(0), appPluginCountForScope(t, db, "rollback-upgrade-v2"))
		for _, endpoint := range []string{v1.CallbackURL, v1.DirectURL, v1.EmbeddedURL} {
			assert.Equal(t, int64(1), appPluginCountForEndpoint(t, db, endpoint))
		}
	})
}

func TestOpenAppPluginModelDBDefaultSQLiteConfiguration(t *testing.T) {
	t.Setenv("APP_PLUGIN_TEST_DIALECT", "sqlite")
	t.Setenv("APP_PLUGIN_TEST_DSN", "")

	db := openAppPluginModelDB(t)
	var busyTimeout int
	require.NoError(t, db.Raw("PRAGMA busy_timeout").Scan(&busyTimeout).Error)
	require.Equal(t, 30000, busyTimeout)
	var journalMode string
	require.NoError(t, db.Raw("PRAGMA journal_mode").Scan(&journalMode).Error)
	require.Equal(t, "wal", journalMode)

	require.NoError(t, MigrateAppPluginTables(db))
	seedAppPluginModelPolicy(t, db, "policy-basic")
	req := appPluginModelInstallRequest("fixture-concurrent-cas", "1.0.0", "https://apps.example.com/fixture-concurrent-cas/")
	installation, err := InstallAppVersion(
		context.Background(),
		db,
		AppIdempotencyScope{ActorID: 30, Key: "fixture-concurrent-cas"},
		req,
	)
	require.NoError(t, err)

	start := make(chan struct{})
	errs := make(chan error, 2)
	var wg sync.WaitGroup
	for _, target := range []string{AppInstallationStatusEnabled, AppInstallationStatusRevoked} {
		wg.Add(1)
		go func(next string) {
			defer wg.Done()
			<-start
			_, updateErr := CompareAndSwapAppInstallationStatus(
				context.Background(),
				db,
				installation.InstallationID,
				installation.Revision,
				next,
			)
			errs <- updateErr
		}(target)
	}
	close(start)
	wg.Wait()
	close(errs)

	successes := 0
	conflicts := 0
	for updateErr := range errs {
		switch {
		case updateErr == nil:
			successes++
		case errors.Is(updateErr, ErrAppInstallationRevisionConflict), errors.Is(updateErr, ErrAppInstallationRevoked):
			conflicts++
		default:
			require.NoError(t, updateErr)
		}
	}
	require.Equal(t, 1, successes)
	require.Equal(t, 1, conflicts)
}

func TestAppPluginTestSQLiteFileURLWindowsDrivePaths(t *testing.T) {
	const rawQuery = "_pragma=busy_timeout%2830000%29&_txlock=immediate"
	for _, test := range []struct {
		name string
		path string
	}{
		{name: "native path", path: `C:\tmp\template.sqlite`},
		{name: "slash-normalized path", path: "C:/tmp/template.sqlite"},
	} {
		t.Run(test.name, func(t *testing.T) {
			databaseURL := appPluginTestSQLiteFileURL(test.path, rawQuery)
			parsed, err := url.Parse(databaseURL.String())
			require.NoError(t, err)
			assert.Equal(t, "file", parsed.Scheme)
			assert.Empty(t, parsed.Host)
			assert.Equal(t, "/C:/tmp/template.sqlite", parsed.Path)
			assert.Equal(t, rawQuery, parsed.RawQuery)
		})
	}
}

func TestOpenAppPluginModelDBExplicitSQLiteTemplateIsPrivate(t *testing.T) {
	t.Setenv("APP_PLUGIN_TEST_DIALECT", "sqlite")
	templateURL := appPluginTestSQLiteFileURL(
		filepath.Join(t.TempDir(), "template.sqlite"),
		"_pragma=busy_timeout%2830000%29&_pragma=journal_mode%28WAL%29&_txlock=immediate",
	)
	t.Setenv("APP_PLUGIN_TEST_DSN", templateURL.String())

	first := openAppPluginModelDB(t)
	second := openAppPluginModelDB(t)
	firstDialector, ok := first.Dialector.(*sqlite.Dialector)
	require.True(t, ok)
	secondDialector, ok := second.Dialector.(*sqlite.Dialector)
	require.True(t, ok)
	firstURL, err := url.Parse(firstDialector.DSN)
	require.NoError(t, err)
	secondURL, err := url.Parse(secondDialector.DSN)
	require.NoError(t, err)

	assert.Equal(t, templateURL.RawQuery, firstURL.RawQuery)
	assert.Equal(t, templateURL.RawQuery, secondURL.RawQuery)
	assert.NotEqual(t, templateURL.Path, firstURL.Path)
	assert.NotEqual(t, templateURL.Path, secondURL.Path)
	assert.NotEqual(t, firstURL.Path, secondURL.Path)

	require.NoError(t, first.Exec("CREATE TABLE app_plugin_fixture_isolation (value TEXT NOT NULL)").Error)
	require.NoError(t, first.Exec("INSERT INTO app_plugin_fixture_isolation (value) VALUES (?)", "first").Error)
	var secondTableCount int64
	require.NoError(t, second.Raw(
		"SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
		"app_plugin_fixture_isolation",
	).Scan(&secondTableCount).Error)
	assert.Zero(t, secondTableCount)
}

func TestOpenAppPluginModelDBLocalSQLitePathTemplateIsPrivate(t *testing.T) {
	tests := []struct {
		name     string
		windows  bool
		rawQuery string
	}{
		{name: "unix without query"},
		{
			name:     "unix with query",
			rawQuery: "_pragma=busy_timeout%2830000%29&_pragma=journal_mode%28WAL%29&_txlock=immediate",
		},
		{name: "windows drive without query", windows: true},
		{
			name:     "windows drive with query",
			windows:  true,
			rawQuery: "_pragma=busy_timeout%2830000%29&_pragma=journal_mode%28WAL%29&_txlock=immediate",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			t.Setenv("APP_PLUGIN_TEST_DIALECT", "sqlite")
			templatePath := filepath.Join(t.TempDir(), "template.sqlite")
			if test.windows {
				templatePath = `C:\tmp\template.sqlite`
			}
			templateURL := url.URL{
				Path:     templatePath,
				RawQuery: test.rawQuery,
			}
			template := templateURL.String()
			if test.windows {
				template = templatePath
				if test.rawQuery != "" {
					template += "?" + test.rawQuery
				}
			}
			t.Setenv("APP_PLUGIN_TEST_DSN", template)

			first := openAppPluginModelDB(t)
			second := openAppPluginModelDB(t)
			firstDialector, ok := first.Dialector.(*sqlite.Dialector)
			require.True(t, ok)
			secondDialector, ok := second.Dialector.(*sqlite.Dialector)
			require.True(t, ok)
			firstURL, err := url.Parse(firstDialector.DSN)
			require.NoError(t, err)
			secondURL, err := url.Parse(secondDialector.DSN)
			require.NoError(t, err)

			assert.Equal(t, "file", firstURL.Scheme)
			assert.Equal(t, "file", secondURL.Scheme)
			assert.Equal(t, templateURL.RawQuery, firstURL.RawQuery)
			assert.Equal(t, templateURL.RawQuery, secondURL.RawQuery)
			assert.NotEqual(t, templateURL.Path, firstURL.Path)
			assert.NotEqual(t, templateURL.Path, secondURL.Path)
			assert.NotEqual(t, firstURL.Path, secondURL.Path)

			require.NoError(t, first.Exec("CREATE TABLE app_plugin_local_path_isolation (value TEXT NOT NULL)").Error)
			require.NoError(t, first.Exec("INSERT INTO app_plugin_local_path_isolation (value) VALUES (?)", "first").Error)
			var secondTableCount int64
			require.NoError(t, second.Raw(
				"SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?",
				"app_plugin_local_path_isolation",
			).Scan(&secondTableCount).Error)
			assert.Zero(t, secondTableCount)
		})
	}
}

func TestOpenAppPluginModelDBClosesSQLitePool(t *testing.T) {
	var pool *sql.DB
	t.Run("fixture owner", func(t *testing.T) {
		t.Setenv("APP_PLUGIN_TEST_DIALECT", "sqlite")
		t.Setenv("APP_PLUGIN_TEST_DSN", "")
		db := openAppPluginModelDB(t)
		var err error
		pool, err = db.DB()
		require.NoError(t, err)
		require.NoError(t, pool.Ping())
	})

	require.NotNil(t, pool)
	require.Error(t, pool.Ping())
	assert.Zero(t, pool.Stats().OpenConnections)
}

func TestAppPluginSQLiteDSNRejectsUnsafeTemplates(t *testing.T) {
	tests := []struct {
		name string
		dsn  string
	}{
		{name: "non-file scheme", dsn: "https:///tmp/app_plugin.sqlite"},
		{name: "authority", dsn: "file://localhost/tmp/app_plugin.sqlite"},
		{name: "user info", dsn: "file://user@localhost/tmp/app_plugin.sqlite"},
		{name: "fragment", dsn: "file:/tmp/app_plugin.sqlite#fragment"},
		{name: "opaque URI", dsn: "file:app_plugin.sqlite"},
		{name: "empty path", dsn: "file:"},
		{name: "backslash UNC path", dsn: `\\server\share\app_plugin.sqlite`},
		{name: "slash UNC path", dsn: "//server/share/app_plugin.sqlite"},
		{name: "file URI UNC path", dsn: "file:////server/share/app_plugin.sqlite?_txlock=immediate"},
		{name: "drive-relative path", dsn: `C:app_plugin.sqlite`},
		{name: "relative path", dsn: "app_plugin.sqlite"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err := appPluginSQLiteDSN(t, test.dsn)
			require.Error(t, err)
		})
	}
}

func TestAppPluginSQLiteEagerTransactionMatchesDriverCasePolicy(t *testing.T) {
	tests := []struct {
		name     string
		rawQuery string
		eager    bool
	}{
		{name: "lowercase immediate", rawQuery: "_txlock=immediate", eager: true},
		{name: "uppercase immediate", rawQuery: "_txlock=IMMEDIATE", eager: true},
		{name: "mixed-case immediate", rawQuery: "_txlock=Immediate", eager: true},
		{name: "lowercase exclusive", rawQuery: "_txlock=exclusive", eager: true},
		{name: "mixed-case exclusive", rawQuery: "_txlock=ExClUsIvE", eager: true},
		{name: "deferred", rawQuery: "_txlock=deferred", eager: false},
		{name: "missing", rawQuery: "_pragma=busy_timeout%2830000%29", eager: false},
		{name: "case-sensitive key", rawQuery: "_TXLOCK=immediate", eager: false},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			eager, err := appPluginSQLiteEagerTransaction("file:/tmp/app_plugin.sqlite?" + test.rawQuery)
			require.NoError(t, err)
			assert.Equal(t, test.eager, eager)
		})
	}
}

func TestAppPluginWaitForDBInUseRejectsWrapperEntryOnly(t *testing.T) {
	t.Setenv("APP_PLUGIN_TEST_DIALECT", "sqlite")
	t.Setenv("APP_PLUGIN_TEST_DSN", "")
	db := openAppPluginModelDB(t)
	pool, err := db.DB()
	require.NoError(t, err)

	held, err := pool.Conn(context.Background())
	require.NoError(t, err)
	defer held.Close()
	require.Equal(t, 1, pool.Stats().InUse)

	wrapperEntered := make(chan struct{}, 1)
	wrapperEntered <- struct{}{}
	<-wrapperEntered

	waitCtx, cancelWait := context.WithTimeout(context.Background(), 25*time.Millisecond)
	defer cancelWait()
	err = appPluginWaitForDBInUse(waitCtx, pool, 2)
	require.ErrorIs(t, err, context.DeadlineExceeded,
		"wrapper entry alone must not prove that a second database/sql connection is in use")
	assert.Contains(t, err.Error(), "InUse >= 2 (last InUse=1)")
}

func TestAppLifecycleCASAndRevokedTerminal(t *testing.T) {
	db := openAppPluginModelDB(t)
	logAppPluginDBVersion(t, db)
	t.Run("records database runtime metadata", func(t *testing.T) {
		assertAppPluginModelRuntimeMetadata(t, db)
	})
	require.NoError(t, MigrateAppPluginTables(db))
	seedAppPluginModelPolicy(t, db, "policy-basic")

	install := appPluginModelInstallRequest("lifecycle", "1.0.0", "https://apps.example.com/lifecycle/")
	created, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 31, Key: "lifecycle"}, install)
	require.NoError(t, err)
	assert.Equal(t, AppInstallationStatusDisabled, created.Status)
	assert.Equal(t, int64(1), created.Revision)

	enabled, err := CompareAndSwapAppInstallationStatus(context.Background(), db, created.InstallationID, created.Revision, AppInstallationStatusEnabled)
	require.NoError(t, err)
	assert.Equal(t, AppInstallationStatusEnabled, enabled.Status)
	disabled, err := CompareAndSwapAppInstallationStatus(context.Background(), db, created.InstallationID, enabled.Revision, AppInstallationStatusDisabled)
	require.NoError(t, err)
	assert.Equal(t, AppInstallationStatusDisabled, disabled.Status)
	revoked, err := CompareAndSwapAppInstallationStatus(context.Background(), db, created.InstallationID, disabled.Revision, AppInstallationStatusRevoked)
	require.NoError(t, err)
	assert.Equal(t, AppInstallationStatusRevoked, revoked.Status)
	assert.Equal(t, int64(0), appPluginCountForKey(t, db, &AppRouteClaim{}, install.AppKey))

	_, err = CompareAndSwapAppInstallationStatus(context.Background(), db, created.InstallationID, revoked.Revision, AppInstallationStatusEnabled)
	require.Error(t, err)
	assert.ErrorIs(t, err, ErrAppInstallationRevoked)

	reinstalled, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 31, Key: "lifecycle-reinstall"}, install)
	require.NoError(t, err)
	assert.NotEqual(t, created.InstallationID, reinstalled.InstallationID)
	assert.Equal(t, int64(4), appPluginCountForKey(t, db, &AppRouteClaim{}, install.AppKey))
	var generationCount int64
	require.NoError(t, db.Model(&AppVersion{}).Where("app_key = ? AND manifest_version = ?", "lifecycle", "1.0.0").Count(&generationCount).Error)
	assert.Equal(t, int64(1), generationCount)

	race := appPluginModelInstallRequest("race", "1.0.0", "https://apps.example.com/race/")
	raceInstall, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 32, Key: "race"}, race)
	require.NoError(t, err)
	firstWinner, firstErr := CompareAndSwapAppInstallationStatus(context.Background(), db, raceInstall.InstallationID, raceInstall.Revision, AppInstallationStatusEnabled)
	secondWinner, secondErr := CompareAndSwapAppInstallationStatus(context.Background(), db, raceInstall.InstallationID, raceInstall.Revision, AppInstallationStatusRevoked)
	assert.NoError(t, firstErr)
	assert.ErrorIs(t, secondErr, ErrAppInstallationRevisionConflict)
	assert.Equal(t, AppInstallationStatusEnabled, firstWinner.Status)
	assert.Empty(t, secondWinner.InstallationID)

	concurrent := appPluginModelInstallRequest("concurrent-cas", "1.0.0", "https://apps.example.com/concurrent-cas/")
	concurrentInstall, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 33, Key: "concurrent-cas"}, concurrent)
	require.NoError(t, err)

	start := make(chan struct{})
	errs := make(chan error, 2)
	var wg sync.WaitGroup
	for _, target := range []string{AppInstallationStatusEnabled, AppInstallationStatusRevoked} {
		wg.Add(1)
		go func(next string) {
			defer wg.Done()
			<-start
			_, updateErr := CompareAndSwapAppInstallationStatus(context.Background(), db, concurrentInstall.InstallationID, concurrentInstall.Revision, next)
			errs <- updateErr
		}(target)
	}
	close(start)
	wg.Wait()
	close(errs)

	successes := 0
	conflicts := 0
	for updateErr := range errs {
		switch {
		case updateErr == nil:
			successes++
		case errors.Is(updateErr, ErrAppInstallationRevisionConflict), errors.Is(updateErr, ErrAppInstallationRevoked):
			conflicts++
		default:
			require.NoError(t, updateErr)
		}
	}
	assert.Equal(t, 1, successes)
	assert.Equal(t, 1, conflicts)

	t.Run("CAS rejects ownership assigned to another installation", func(t *testing.T) {
		req := appPluginModelInstallRequest("cas-owner-mismatch", "1.0.0", "https://apps.example.com/cas-owner-mismatch/")
		installation, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 329, Key: req.AppKey}, req)
		require.NoError(t, err)
		require.NoError(t, db.Model(&AppRouteClaim{}).
			Where("app_key = ? AND kind = ?", req.AppKey, "app_key").
			Update("installation_id", "inst_other").Error)
		t.Cleanup(func() {
			require.NoError(t, db.Model(&AppRouteClaim{}).
				Where("app_key = ? AND kind = ?", req.AppKey, "app_key").
				Update("installation_id", installation.InstallationID).Error)
		})

		_, err = CompareAndSwapAppInstallationStatus(
			context.Background(),
			db,
			installation.InstallationID,
			installation.Revision,
			AppInstallationStatusEnabled,
		)
		assert.ErrorIs(t, err, ErrAppRouteClaimConflict)

		var current AppInstallation
		require.NoError(t, db.Where("installation_id = ?", installation.InstallationID).First(&current).Error)
		assert.Equal(t, AppInstallationStatusDisabled, current.Status)
		assert.Equal(t, installation.Revision, current.Revision)
	})

	t.Run("CAS transaction retries only MySQL deadlocks and stops after three attempts", func(t *testing.T) {
		req := appPluginModelInstallRequest("cas-retry-limit-"+db.Dialector.Name(), "1.0.0", "https://apps.example.com/cas-retry-limit-"+db.Dialector.Name()+"/")
		installation, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 330, Key: req.AppKey}, req)
		require.NoError(t, err)

		const callbackName = "test:app_plugin_cas_retry_limit"
		var attempts atomic.Int32
		require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_installations" {
				return
			}
			attempts.Add(1)
			tx.AddError(&mysqlDriver.MySQLError{Number: 1213, Message: "injected persistent CAS deadlock"})
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Update().Remove(callbackName))
		})

		_, err = CompareAndSwapAppInstallationStatus(
			context.Background(),
			db,
			installation.InstallationID,
			installation.Revision,
			AppInstallationStatusEnabled,
		)
		require.Error(t, err)
		assert.Equal(t, uint16(1213), err.(*mysqlDriver.MySQLError).Number)
		if db.Dialector.Name() == "mysql" {
			assert.Equal(t, int32(3), attempts.Load())
		} else {
			assert.Equal(t, int32(1), attempts.Load())
		}
	})

	t.Run("CAS transaction retries a transient MySQL deadlock", func(t *testing.T) {
		if db.Dialector.Name() != "mysql" {
			t.Skip("requires MySQL deadlock retry semantics")
		}

		req := appPluginModelInstallRequest("cas-retry-success", "1.0.0", "https://apps.example.com/cas-retry-success/")
		installation, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 331, Key: req.AppKey}, req)
		require.NoError(t, err)

		const callbackName = "test:app_plugin_cas_retry_success"
		var attempts atomic.Int32
		require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_installations" {
				return
			}
			if attempts.Add(1) == 1 {
				tx.AddError(&mysqlDriver.MySQLError{Number: 1213, Message: "injected transient CAS deadlock"})
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Update().Remove(callbackName))
		})

		updated, err := CompareAndSwapAppInstallationStatus(
			context.Background(),
			db,
			installation.InstallationID,
			installation.Revision,
			AppInstallationStatusEnabled,
		)
		require.NoError(t, err)
		assert.Equal(t, int32(2), attempts.Load())
		assert.Equal(t, AppInstallationStatusEnabled, updated.Status)
		assert.Equal(t, installation.Revision+1, updated.Revision)
	})

	t.Run("CAS transaction does not retry a non-deadlock MySQL error", func(t *testing.T) {
		if db.Dialector.Name() != "mysql" {
			t.Skip("requires MySQL error classification")
		}

		req := appPluginModelInstallRequest("cas-no-retry", "1.0.0", "https://apps.example.com/cas-no-retry/")
		installation, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 332, Key: req.AppKey}, req)
		require.NoError(t, err)

		const callbackName = "test:app_plugin_cas_no_retry"
		var attempts atomic.Int32
		require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_installations" {
				return
			}
			attempts.Add(1)
			tx.AddError(&mysqlDriver.MySQLError{Number: 1205, Message: "injected lock wait timeout"})
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Update().Remove(callbackName))
		})

		_, err = CompareAndSwapAppInstallationStatus(
			context.Background(),
			db,
			installation.InstallationID,
			installation.Revision,
			AppInstallationStatusEnabled,
		)
		require.Error(t, err)
		assert.Equal(t, uint16(1205), err.(*mysqlDriver.MySQLError).Number)
		assert.Equal(t, int32(1), attempts.Load())
	})

	t.Run("CAS transaction retries a transient PostgreSQL deadlock", func(t *testing.T) {
		if db.Dialector.Name() != "postgres" {
			t.Skip("requires PostgreSQL deadlock retry semantics")
		}

		req := appPluginModelInstallRequest("cas-pg-retry-success", "1.0.0", "https://apps.example.com/cas-pg-retry-success/")
		installation, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 333, Key: req.AppKey}, req)
		require.NoError(t, err)

		const callbackName = "test:app_plugin_cas_pg_retry_success"
		var attempts atomic.Int32
		require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_installations" {
				return
			}
			if attempts.Add(1) == 1 {
				tx.AddError(&pgconn.PgError{Code: "40P01", Message: "injected transient CAS deadlock"})
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Update().Remove(callbackName))
		})

		updated, err := CompareAndSwapAppInstallationStatus(
			context.Background(),
			db,
			installation.InstallationID,
			installation.Revision,
			AppInstallationStatusEnabled,
		)
		require.NoError(t, err)
		assert.Equal(t, int32(2), attempts.Load())
		assert.Equal(t, AppInstallationStatusEnabled, updated.Status)
		assert.Equal(t, installation.Revision+1, updated.Revision)
	})

	t.Run("CAS transaction stops after three persistent PostgreSQL deadlocks", func(t *testing.T) {
		if db.Dialector.Name() != "postgres" {
			t.Skip("requires PostgreSQL deadlock retry semantics")
		}

		req := appPluginModelInstallRequest("cas-pg-retry-limit", "1.0.0", "https://apps.example.com/cas-pg-retry-limit/")
		installation, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 334, Key: req.AppKey}, req)
		require.NoError(t, err)

		const callbackName = "test:app_plugin_cas_pg_retry_limit"
		var attempts atomic.Int32
		require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_installations" {
				return
			}
			attempts.Add(1)
			tx.AddError(&pgconn.PgError{Code: "40P01", Message: "injected persistent CAS deadlock"})
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Update().Remove(callbackName))
		})

		_, err = CompareAndSwapAppInstallationStatus(
			context.Background(),
			db,
			installation.InstallationID,
			installation.Revision,
			AppInstallationStatusEnabled,
		)
		var pgErr *pgconn.PgError
		require.ErrorAs(t, err, &pgErr)
		assert.Equal(t, "40P01", pgErr.Code)
		assert.Equal(t, int32(3), attempts.Load())
	})

	t.Run("CAS transaction does not retry a non-deadlock PostgreSQL error", func(t *testing.T) {
		if db.Dialector.Name() != "postgres" {
			t.Skip("requires PostgreSQL error classification")
		}

		req := appPluginModelInstallRequest("cas-pg-no-retry", "1.0.0", "https://apps.example.com/cas-pg-no-retry/")
		installation, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 335, Key: req.AppKey}, req)
		require.NoError(t, err)

		const callbackName = "test:app_plugin_cas_pg_no_retry"
		var attempts atomic.Int32
		require.NoError(t, db.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_installations" {
				return
			}
			attempts.Add(1)
			tx.AddError(&pgconn.PgError{Code: "55P03", Message: "injected lock not available"})
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Update().Remove(callbackName))
		})

		_, err = CompareAndSwapAppInstallationStatus(
			context.Background(),
			db,
			installation.InstallationID,
			installation.Revision,
			AppInstallationStatusEnabled,
		)
		var pgErr *pgconn.PgError
		require.ErrorAs(t, err, &pgErr)
		assert.Equal(t, "55P03", pgErr.Code)
		assert.Equal(t, int32(1), attempts.Load())
	})

	t.Run("concurrent PostgreSQL CAS and upgrade acquire ownership before installation", func(t *testing.T) {
		if db.Dialector.Name() != "postgres" {
			t.Skip("requires PostgreSQL row-level deadlock detection")
		}

		v1 := appPluginModelInstallRequest("pg-cas-upgrade", "1.0.0", "https://apps.example.com/pg-cas-upgrade-v1/")
		created, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 336, Key: "pg-cas-upgrade-v1"}, v1)
		require.NoError(t, err)

		barrierCtx, cancelBarrier := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelBarrier()
		type workerKey struct{}
		ownershipLocked := make(chan struct{}, 1)
		casOwnershipAttempted := make(chan struct{}, 1)
		casInstallationLocked := make(chan struct{}, 1)
		upgradeInstallationAttempted := make(chan struct{}, 1)
		releaseOwnership := make(chan struct{})
		var releaseOnce sync.Once
		release := func() {
			releaseOnce.Do(func() {
				close(releaseOwnership)
			})
		}
		defer release()

		ownershipClaimKey := appKeyClaim(v1.AppKey, "").ClaimKey
		var holderCoordinated atomic.Bool
		const afterQueryCallback = "test:app_plugin_pg_upgrade_holds_ownership"
		require.NoError(t, db.Callback().Query().After("gorm:query").Register(afterQueryCallback, func(tx *gorm.DB) {
			worker, _ := tx.Statement.Context.Value(workerKey{}).(string)
			if worker != "upgrade" ||
				tx.Statement.Table != "app_route_claims" ||
				!strings.Contains(tx.Statement.SQL.String(), "FOR UPDATE") ||
				len(tx.Statement.Vars) == 0 ||
				tx.Statement.Vars[0] != ownershipClaimKey ||
				!holderCoordinated.CompareAndSwap(false, true) {
				return
			}
			select {
			case ownershipLocked <- struct{}{}:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("upgrade ownership lock barrier: %w", barrierCtx.Err()))
				return
			}
			select {
			case <-releaseOwnership:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("upgrade ownership release: %w", barrierCtx.Err()))
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Query().Remove(afterQueryCallback))
		})

		var casClaimCoordinated atomic.Bool
		var upgradeInstallationCoordinated atomic.Bool
		const beforeQueryCallback = "test:app_plugin_pg_lock_attempts"
		require.NoError(t, db.Callback().Query().Before("gorm:query").Register(beforeQueryCallback, func(tx *gorm.DB) {
			worker, _ := tx.Statement.Context.Value(workerKey{}).(string)
			_, locksForUpdate := tx.Statement.Clauses["FOR"]
			switch {
			case worker == "cas" &&
				tx.Statement.Table == "app_route_claims" &&
				locksForUpdate &&
				casClaimCoordinated.CompareAndSwap(false, true):
				select {
				case casOwnershipAttempted <- struct{}{}:
				case <-barrierCtx.Done():
					tx.AddError(fmt.Errorf("CAS ownership attempt barrier: %w", barrierCtx.Err()))
				}
			case worker == "upgrade" &&
				tx.Statement.Table == "app_installations" &&
				upgradeInstallationCoordinated.CompareAndSwap(false, true):
				select {
				case upgradeInstallationAttempted <- struct{}{}:
				case <-barrierCtx.Done():
					tx.AddError(fmt.Errorf("upgrade installation attempt barrier: %w", barrierCtx.Err()))
				}
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Query().Remove(beforeQueryCallback))
		})

		var casUpdateCoordinated atomic.Bool
		const updateCallback = "test:app_plugin_pg_cas_holds_installation"
		require.NoError(t, db.Callback().Update().After("gorm:update").Register(updateCallback, func(tx *gorm.DB) {
			worker, _ := tx.Statement.Context.Value(workerKey{}).(string)
			updates, ok := tx.Statement.Dest.(map[string]any)
			if worker != "cas" ||
				tx.Statement.Table != "app_installations" ||
				!ok ||
				updates["status"] != AppInstallationStatusRevoked ||
				!casUpdateCoordinated.CompareAndSwap(false, true) {
				return
			}
			select {
			case casInstallationLocked <- struct{}{}:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("CAS installation lock barrier: %w", barrierCtx.Err()))
				return
			}
			select {
			case <-upgradeInstallationAttempted:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("upgrade installation attempt wait: %w", barrierCtx.Err()))
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Update().Remove(updateCallback))
		})

		v2 := appPluginModelInstallRequest("pg-cas-upgrade", "2.0.0", "https://apps.example.com/pg-cas-upgrade-v2/")
		upgradeResult := make(chan error, 1)
		go func() {
			ctx := context.WithValue(barrierCtx, workerKey{}, "upgrade")
			_, upgradeErr := InstallAppVersion(ctx, db, AppIdempotencyScope{ActorID: 336, Key: "pg-cas-upgrade-v2"}, v2)
			upgradeResult <- upgradeErr
		}()
		select {
		case <-ownershipLocked:
		case <-barrierCtx.Done():
			t.Fatalf("upgrade did not lock ownership: %v", barrierCtx.Err())
		}

		casResult := make(chan error, 1)
		go func() {
			ctx := context.WithValue(barrierCtx, workerKey{}, "cas")
			_, casErr := CompareAndSwapAppInstallationStatus(
				ctx,
				db,
				created.InstallationID,
				created.Revision,
				AppInstallationStatusRevoked,
			)
			casResult <- casErr
		}()

		ordered := false
		select {
		case <-casOwnershipAttempted:
			ordered = true
			release()
		case <-casInstallationLocked:
			release()
		case <-barrierCtx.Done():
			t.Fatalf("CAS did not attempt an ownership or installation lock: %v", barrierCtx.Err())
		}

		var upgradeErr error
		select {
		case upgradeErr = <-upgradeResult:
		case <-barrierCtx.Done():
			t.Fatalf("upgrade did not finish: %v", barrierCtx.Err())
		}
		var casErr error
		select {
		case casErr = <-casResult:
		case <-barrierCtx.Done():
			t.Fatalf("CAS did not finish: %v", barrierCtx.Err())
		}
		require.NoError(t, upgradeErr)
		assert.ErrorIs(t, casErr, ErrAppInstallationRevisionConflict)
		assert.True(t, ordered, "CAS must attempt the ownership lock before locking the installation")
	})

	t.Run("concurrent CAS upgrade and revoke preserve one live installation owner", func(t *testing.T) {
		if db.Dialector.Name() != "mysql" {
			t.Skip("requires MySQL row-level deadlock detection")
		}

		v1 := appPluginModelInstallRequest("cas-upgrade-revoke", "1.0.0", "https://apps.example.com/cas-upgrade-revoke-v1/")
		created, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 333, Key: "cas-upgrade-revoke-v1"}, v1)
		require.NoError(t, err)

		barrierCtx, cancelBarrier := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelBarrier()
		type workerKey struct{}
		casInstallationLocked := make(chan struct{}, 1)
		upgradeClaimAttempted := make(chan struct{}, 1)
		allowCASClaimDelete := make(chan struct{})
		var releaseOnce sync.Once
		release := func() {
			releaseOnce.Do(func() {
				close(allowCASClaimDelete)
			})
		}
		defer release()
		const updateCallbackName = "test:app_plugin_cas_installation_lock"
		require.NoError(t, db.Callback().Update().After("gorm:update").Register(updateCallbackName, func(tx *gorm.DB) {
			status, ok := tx.Statement.Dest.(map[string]any)["status"]
			if tx.Statement.Table != "app_installations" || !ok || status != AppInstallationStatusRevoked {
				return
			}
			select {
			case casInstallationLocked <- struct{}{}:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("CAS installation lock barrier: %w", barrierCtx.Err()))
				return
			}
			select {
			case <-allowCASClaimDelete:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("CAS claim deletion release: %w", barrierCtx.Err()))
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Update().Remove(updateCallbackName))
		})

		var claimAttemptCoordinated atomic.Bool
		var upgradeInstallationLockStarted atomic.Bool
		const queryCallbackName = "test:app_plugin_upgrade_lock_attempts"
		require.NoError(t, db.Callback().Query().Before("gorm:query").Register(queryCallbackName, func(tx *gorm.DB) {
			worker, _ := tx.Statement.Context.Value(workerKey{}).(string)
			if worker != "upgrade" {
				return
			}
			_, locksForUpdate := tx.Statement.Clauses["FOR"]
			switch {
			case tx.Statement.Table == "app_route_claims" &&
				locksForUpdate &&
				claimAttemptCoordinated.CompareAndSwap(false, true):
				select {
				case upgradeClaimAttempted <- struct{}{}:
				case <-barrierCtx.Done():
					tx.AddError(fmt.Errorf("upgrade ownership lock attempt barrier: %w", barrierCtx.Err()))
				}
			case tx.Statement.Table == "app_installations" && locksForUpdate:
				upgradeInstallationLockStarted.Store(true)
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Query().Remove(queryCallbackName))
		})

		casResult := make(chan error, 1)
		go func() {
			_, casErr := CompareAndSwapAppInstallationStatus(
				barrierCtx,
				db,
				created.InstallationID,
				created.Revision,
				AppInstallationStatusRevoked,
			)
			casResult <- casErr
		}()
		select {
		case <-casInstallationLocked:
		case <-barrierCtx.Done():
			t.Fatalf("CAS did not lock the installation: %v", barrierCtx.Err())
		}

		v2 := appPluginModelInstallRequest("cas-upgrade-revoke", "2.0.0", "https://apps.example.com/cas-upgrade-revoke-v2/")
		upgradeResult := make(chan error, 1)
		go func() {
			ctx := context.WithValue(barrierCtx, workerKey{}, "upgrade")
			_, upgradeErr := InstallAppVersion(
				ctx,
				db,
				AppIdempotencyScope{ActorID: 333, Key: "cas-upgrade-revoke-v2"},
				v2,
			)
			upgradeResult <- upgradeErr
		}()
		select {
		case <-upgradeClaimAttempted:
		case <-barrierCtx.Done():
			t.Fatalf("upgrade did not attempt the ownership lock: %v", barrierCtx.Err())
		}
		assert.False(t, upgradeInstallationLockStarted.Load(), "upgrade must remain blocked before locking the installation")
		release()

		var casErr error
		select {
		case casErr = <-casResult:
		case <-barrierCtx.Done():
			t.Fatalf("CAS did not finish: %v", barrierCtx.Err())
		}
		var upgradeErr error
		select {
		case upgradeErr = <-upgradeResult:
		case <-barrierCtx.Done():
			t.Fatalf("upgrade did not finish: %v", barrierCtx.Err())
		}
		require.NoError(t, upgradeErr)
		if casErr != nil {
			assert.ErrorIs(t, casErr, ErrAppInstallationRevisionConflict)
			assert.NotEqual(t, "service_unavailable", AppPluginErrorCode(casErr))
		}

		var liveInstallations []AppInstallation
		require.NoError(t, db.Where("app_key = ? AND status <> ?", v1.AppKey, AppInstallationStatusRevoked).Find(&liveInstallations).Error)
		require.Len(t, liveInstallations, 1)
		assert.Equal(t, "2.0.0", liveInstallations[0].ManifestVersion)

		var ownership []AppRouteClaim
		require.NoError(t, db.Where("app_key = ? AND kind = ?", v1.AppKey, "app_key").Find(&ownership).Error)
		require.Len(t, ownership, 1)
		assert.Equal(t, liveInstallations[0].InstallationID, ownership[0].InstallationID)
		assert.Equal(t, int64(4), appPluginCountForKey(t, db, &AppRouteClaim{}, v1.AppKey))
		assert.Equal(t, int64(2), appPluginCountForKey(t, db, &AppVersion{}, v1.AppKey))
	})

	t.Run("concurrent same generation with different scopes replays one installation", func(t *testing.T) {
		if db.Dialector.Name() != "mysql" {
			t.Skip("requires MySQL REPEATABLE READ snapshot semantics")
		}

		barrierCtx, cancelBarrier := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelBarrier()
		const callbackName = "test:app_plugin_same_generation_snapshot"
		snapshotsReady := make(chan struct{}, 2)
		releaseSnapshots := make(chan struct{})
		var releaseOnce sync.Once
		release := func() {
			releaseOnce.Do(func() {
				close(releaseSnapshots)
			})
		}
		defer release()
		var coordinated atomic.Int32
		require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
			if tx.Statement.Table != "app_installation_idempotencies" || coordinated.Add(1) > 2 {
				return
			}
			select {
			case snapshotsReady <- struct{}{}:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("same-generation snapshot barrier: %w", barrierCtx.Err()))
				return
			}
			select {
			case <-releaseSnapshots:
			case <-barrierCtx.Done():
				tx.AddError(fmt.Errorf("same-generation snapshot release: %w", barrierCtx.Err()))
			}
		}))
		t.Cleanup(func() {
			require.NoError(t, db.Callback().Query().Remove(callbackName))
		})

		req := appPluginModelInstallRequest("concurrent-generation", "1.0.0", "https://apps.example.com/concurrent-generation/")
		start := make(chan struct{})
		results := make(chan AppInstallResult, 2)
		errs := make(chan error, 2)
		var wg sync.WaitGroup
		for _, scopeKey := range []string{"concurrent-generation-a", "concurrent-generation-b"} {
			wg.Add(1)
			go func(key string) {
				defer wg.Done()
				<-start
				result, installErr := InstallAppVersion(barrierCtx, db, AppIdempotencyScope{ActorID: 35, Key: key}, req)
				results <- result
				errs <- installErr
			}(scopeKey)
		}
		close(start)
		for range 2 {
			select {
			case <-snapshotsReady:
			case <-barrierCtx.Done():
				t.Fatalf("same-generation installs did not reach their snapshots: %v", barrierCtx.Err())
			}
		}
		release()
		workersDone := make(chan struct{})
		go func() {
			wg.Wait()
			close(workersDone)
		}()
		select {
		case <-workersDone:
		case <-barrierCtx.Done():
			t.Fatalf("same-generation installs did not finish: %v", barrierCtx.Err())
		}
		close(results)
		close(errs)

		var installed []AppInstallResult
		for installErr := range errs {
			require.NoError(t, installErr)
		}
		for result := range results {
			installed = append(installed, result)
		}
		require.Len(t, installed, 2)
		assert.Equal(t, installed[0], installed[1])
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppVersion{}, req.AppKey))
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppInstallation{}, req.AppKey))
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppServiceCredential{}, req.AppKey))
		assert.Equal(t, int64(4), appPluginCountForKey(t, db, &AppRouteClaim{}, req.AppKey))
		assert.Equal(t, int64(2), appPluginCountForScope(t, db, "concurrent-generation-a")+appPluginCountForScope(t, db, "concurrent-generation-b"))
	})

	t.Run("concurrent different versions serialize onto one installation", func(t *testing.T) {
		v1 := appPluginModelInstallRequest("concurrent-upgrade", "1.0.0", "https://apps.example.com/concurrent-upgrade-v1/")
		created, err := InstallAppVersion(context.Background(), db, AppIdempotencyScope{ActorID: 34, Key: "concurrent-upgrade-v1"}, v1)
		require.NoError(t, err)

		barrierCtx, cancelBarrier := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancelBarrier()
		type workerKey struct{}
		holderReady := make(chan struct{}, 1)
		waiterAttempted := make(chan struct{}, 1)
		releaseHolder := make(chan struct{})
		var releaseOnce sync.Once
		release := func() {
			releaseOnce.Do(func() {
				close(releaseHolder)
			})
		}
		defer release()

		eagerSQLiteFixture := false
		if db.Dialector.Name() == "sqlite" {
			dialector, ok := db.Dialector.(*sqlite.Dialector)
			require.True(t, ok)
			eagerSQLiteFixture, err = appPluginSQLiteEagerTransaction(dialector.DSN)
			require.NoError(t, err)
		}
		upgradeDB := db
		var eagerSQLitePool *sql.DB
		switch {
		case db.Dialector.Name() == "sqlite" && eagerSQLiteFixture:
			eagerSQLitePool, err = db.DB()
			require.NoError(t, err)
			beginner, ok := db.Statement.ConnPool.(gorm.TxBeginner)
			require.True(t, ok)
			observer := &appPluginTxBeginObserver{
				ConnPool: db.Statement.ConnPool,
				beginTx: func(ctx context.Context, options *sql.TxOptions) (*sql.Tx, error) {
					worker, _ := ctx.Value(workerKey{}).(string)
					if worker == "3.0.0" {
						select {
						case waiterAttempted <- struct{}{}:
						case <-barrierCtx.Done():
							return nil, fmt.Errorf("different-version SQLite waiter begin barrier: %w", barrierCtx.Err())
						}
					}
					transaction, beginErr := beginner.BeginTx(ctx, options)
					if worker != "2.0.0" || beginErr != nil {
						return transaction, beginErr
					}
					select {
					case holderReady <- struct{}{}:
					case <-barrierCtx.Done():
						_ = transaction.Rollback()
						return nil, fmt.Errorf("different-version SQLite holder begin barrier: %w", barrierCtx.Err())
					}
					select {
					case <-releaseHolder:
					case <-barrierCtx.Done():
						_ = transaction.Rollback()
						return nil, fmt.Errorf("different-version SQLite holder release: %w", barrierCtx.Err())
					}
					return transaction, nil
				},
			}
			upgradeDB = db.Session(&gorm.Session{NewDB: true})
			upgradeDB.Statement.ConnPool = observer
		case db.Dialector.Name() == "sqlite":
			const callbackName = "test:app_plugin_different_version_sqlite_start"
			workersReady := make(chan struct{}, 2)
			var coordinated sync.Map
			require.NoError(t, db.Callback().Create().Before("gorm:create").Register(callbackName, func(tx *gorm.DB) {
				worker, _ := tx.Statement.Context.Value(workerKey{}).(string)
				idempotency, ok := tx.Statement.Dest.(*AppInstallationIdempotency)
				if worker == "" || !ok || idempotency.ActorID != 34 {
					return
				}
				if _, loaded := coordinated.LoadOrStore(worker, struct{}{}); loaded {
					return
				}
				select {
				case workersReady <- struct{}{}:
				case <-barrierCtx.Done():
					tx.AddError(fmt.Errorf("different-version SQLite start barrier: %w", barrierCtx.Err()))
					return
				}
				select {
				case <-releaseHolder:
				case <-barrierCtx.Done():
					tx.AddError(fmt.Errorf("different-version SQLite start release: %w", barrierCtx.Err()))
				}
			}))
			t.Cleanup(func() {
				require.NoError(t, db.Callback().Create().Remove(callbackName))
			})
			holderReady = workersReady
		default:
			ownershipClaimKey := appKeyClaim(v1.AppKey, "").ClaimKey
			var holderCoordinated atomic.Bool
			const holderCallback = "test:app_plugin_different_version_ownership_holder"
			require.NoError(t, db.Callback().Query().After("gorm:query").Register(holderCallback, func(tx *gorm.DB) {
				worker, _ := tx.Statement.Context.Value(workerKey{}).(string)
				if worker != "2.0.0" ||
					tx.Statement.Table != "app_route_claims" ||
					!strings.Contains(tx.Statement.SQL.String(), "FOR UPDATE") ||
					len(tx.Statement.Vars) == 0 ||
					tx.Statement.Vars[0] != ownershipClaimKey ||
					!holderCoordinated.CompareAndSwap(false, true) {
					return
				}
				select {
				case holderReady <- struct{}{}:
				case <-barrierCtx.Done():
					tx.AddError(fmt.Errorf("different-version ownership holder barrier: %w", barrierCtx.Err()))
					return
				}
				select {
				case <-releaseHolder:
				case <-barrierCtx.Done():
					tx.AddError(fmt.Errorf("different-version ownership holder release: %w", barrierCtx.Err()))
				}
			}))
			t.Cleanup(func() {
				require.NoError(t, db.Callback().Query().Remove(holderCallback))
			})

			var waiterCoordinated atomic.Bool
			const waiterCallback = "test:app_plugin_different_version_ownership_waiter"
			require.NoError(t, db.Callback().Query().Before("gorm:query").Register(waiterCallback, func(tx *gorm.DB) {
				worker, _ := tx.Statement.Context.Value(workerKey{}).(string)
				_, locksForUpdate := tx.Statement.Clauses["FOR"]
				if worker != "3.0.0" ||
					tx.Statement.Table != "app_route_claims" ||
					!locksForUpdate ||
					!waiterCoordinated.CompareAndSwap(false, true) {
					return
				}
				select {
				case waiterAttempted <- struct{}{}:
				case <-barrierCtx.Done():
					tx.AddError(fmt.Errorf("different-version ownership waiter barrier: %w", barrierCtx.Err()))
				}
			}))
			t.Cleanup(func() {
				require.NoError(t, db.Callback().Query().Remove(waiterCallback))
			})
		}

		results := make(chan AppInstallResult, 2)
		errs := make(chan error, 2)
		var wg sync.WaitGroup
		runUpgrade := func(version string) {
			wg.Go(func() {
				ctx := context.WithValue(barrierCtx, workerKey{}, version)
				req := appPluginModelInstallRequest("concurrent-upgrade", version, "https://apps.example.com/concurrent-upgrade-v"+string(version[0])+"/")
				result, installErr := InstallAppVersion(ctx, upgradeDB, AppIdempotencyScope{ActorID: 34, Key: "concurrent-upgrade-v" + string(version[0])}, req)
				results <- result
				errs <- installErr
			})
		}

		if db.Dialector.Name() == "sqlite" {
			runUpgrade("2.0.0")
			if eagerSQLiteFixture {
				select {
				case <-holderReady:
				case <-barrierCtx.Done():
					t.Fatalf("different-version SQLite holder did not begin its eager transaction: %v", barrierCtx.Err())
				}
				runUpgrade("3.0.0")
				select {
				case <-waiterAttempted:
				case <-barrierCtx.Done():
					t.Fatalf("different-version SQLite waiter did not attempt transaction begin while the first transaction was held: %v", barrierCtx.Err())
				}
				if waitErr := appPluginWaitForDBInUse(barrierCtx, eagerSQLitePool, 2); waitErr != nil {
					t.Fatalf("different-version SQLite waiter did not check out a second database/sql connection while the first transaction was held: %v", waitErr)
				}
			} else {
				runUpgrade("3.0.0")
				for range 2 {
					select {
					case <-holderReady:
					case <-barrierCtx.Done():
						t.Fatalf("different-version SQLite workers did not reach the start barrier: %v", barrierCtx.Err())
					}
				}
			}
		} else {
			runUpgrade("2.0.0")
			select {
			case <-holderReady:
			case <-barrierCtx.Done():
				t.Fatalf("different-version holder did not acquire the ownership lock: %v", barrierCtx.Err())
			}
			runUpgrade("3.0.0")
			select {
			case <-waiterAttempted:
			case <-barrierCtx.Done():
				t.Fatalf("different-version waiter did not attempt the ownership lock: %v", barrierCtx.Err())
			}
		}
		release()
		workersDone := make(chan struct{})
		go func() {
			wg.Wait()
			close(workersDone)
		}()
		select {
		case <-workersDone:
		case <-barrierCtx.Done():
			t.Fatalf("different-version upgrades did not finish: %v", barrierCtx.Err())
		}
		close(results)
		close(errs)

		for installErr := range errs {
			require.NoError(t, installErr)
		}
		for result := range results {
			assert.Equal(t, created.InstallationID, result.InstallationID)
		}
		assert.Equal(t, int64(3), appPluginCountForKey(t, db, &AppVersion{}, v1.AppKey))
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppInstallation{}, v1.AppKey))
		assert.Equal(t, int64(1), appPluginCountForKey(t, db, &AppServiceCredential{}, v1.AppKey))
		assert.Equal(t, int64(4), appPluginCountForKey(t, db, &AppRouteClaim{}, v1.AppKey))

		var final AppInstallation
		require.NoError(t, db.Where("installation_id = ?", created.InstallationID).First(&final).Error)
		assert.Equal(t, int64(3), final.Revision)
		assert.Contains(t, []string{"2.0.0", "3.0.0"}, final.ManifestVersion)
	})
}

func openAppPluginModelDB(t *testing.T) *gorm.DB {
	t.Helper()
	dialect := os.Getenv("APP_PLUGIN_TEST_DIALECT")
	dsn := os.Getenv("APP_PLUGIN_TEST_DSN")
	t.Logf("APP_PLUGIN_TEST_IMAGE=%s APP_PLUGIN_TEST_PLATFORM=%s APP_PLUGIN_TEST_DIALECT=%s", os.Getenv("APP_PLUGIN_TEST_IMAGE"), os.Getenv("APP_PLUGIN_TEST_PLATFORM"), dialect)
	if dialect == "" {
		dialect = "sqlite"
	}
	var (
		db  *gorm.DB
		err error
	)
	switch dialect {
	case "sqlite":
		common.SetMainDatabaseType(common.DatabaseTypeSQLite)
		dsn, err = appPluginSQLiteDSN(t, dsn)
		require.NoError(t, err)
		db, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{})
		require.NoError(t, err)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = sqlDB.Close()
		})
	case "mysql":
		common.SetMainDatabaseType(common.DatabaseTypeMySQL)
		require.NotEmpty(t, dsn, "APP_PLUGIN_TEST_DSN is required for mysql")
		db, err = gorm.Open(gormMySQL.Open(dsn), &gorm.Config{})
	case "postgres", "postgresql":
		common.SetMainDatabaseType(common.DatabaseTypePostgreSQL)
		require.NotEmpty(t, dsn, "APP_PLUGIN_TEST_DSN is required for postgres")
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		t.Fatalf("unsupported APP_PLUGIN_TEST_DIALECT %q", dialect)
	}
	require.NoError(t, err)
	return db
}

func appPluginSQLiteDSN(t *testing.T, template string) (string, error) {
	t.Helper()
	var sqliteURL *url.URL
	if template == "" {
		sqliteURL = &url.URL{
			RawQuery: url.Values{
				"_pragma": {"busy_timeout(30000)", "journal_mode(WAL)"},
				"_txlock": {"immediate"},
			}.Encode(),
		}
	} else {
		templatePath, rawQuery, hasQuery := strings.Cut(template, "?")
		if appPluginWindowsDriveAbsolute(templatePath) {
			queryURL, err := url.Parse("file:/fixture?" + rawQuery)
			if err != nil {
				return "", fmt.Errorf("parse APP_PLUGIN_TEST_DSN: %w", err)
			}
			if strings.Contains(templatePath, "#") || queryURL.Fragment != "" {
				return "", fmt.Errorf("APP_PLUGIN_TEST_DSN must not contain a fragment")
			}
			sqliteURL = &url.URL{
				Path:       templatePath,
				RawQuery:   rawQuery,
				ForceQuery: hasQuery && rawQuery == "",
			}
		} else {
			var err error
			sqliteURL, err = url.Parse(template)
			if err != nil {
				return "", fmt.Errorf("parse APP_PLUGIN_TEST_DSN: %w", err)
			}
		}
		switch {
		case sqliteURL.Scheme != "" && sqliteURL.Scheme != "file":
			return "", fmt.Errorf("APP_PLUGIN_TEST_DSN must use a file URI")
		case sqliteURL.Host != "":
			return "", fmt.Errorf("APP_PLUGIN_TEST_DSN must not contain an authority")
		case sqliteURL.User != nil:
			return "", fmt.Errorf("APP_PLUGIN_TEST_DSN must not contain user info")
		case sqliteURL.Fragment != "":
			return "", fmt.Errorf("APP_PLUGIN_TEST_DSN must not contain a fragment")
		case sqliteURL.Opaque != "":
			return "", fmt.Errorf("APP_PLUGIN_TEST_DSN must not be opaque")
		case sqliteURL.Path == "":
			return "", fmt.Errorf("APP_PLUGIN_TEST_DSN must contain a path")
		case strings.HasPrefix(sqliteURL.Path, "//"):
			return "", fmt.Errorf("APP_PLUGIN_TEST_DSN must not contain a UNC path")
		case !appPluginWindowsDriveAbsolute(sqliteURL.Path) && !strings.HasPrefix(sqliteURL.Path, "/"):
			return "", fmt.Errorf("APP_PLUGIN_TEST_DSN must contain an absolute path")
		}
	}

	fixtureURL := appPluginTestSQLiteFileURL(
		filepath.Join(t.TempDir(), "app_plugin.sqlite"),
		sqliteURL.RawQuery,
	)
	fixtureURL.ForceQuery = sqliteURL.ForceQuery
	return fixtureURL.String(), nil
}

func appPluginTestSQLiteFileURL(path, rawQuery string) url.URL {
	if appPluginWindowsDriveAbsolute(path) {
		path = "/" + strings.ReplaceAll(path, `\`, "/")
	} else {
		path = filepath.ToSlash(path)
	}
	return url.URL{Scheme: "file", Path: path, RawQuery: rawQuery}
}

func appPluginWindowsDriveAbsolute(path string) bool {
	if len(path) < 3 || path[1] != ':' || (path[2] != '/' && path[2] != '\\') {
		return false
	}
	return path[0] >= 'A' && path[0] <= 'Z' || path[0] >= 'a' && path[0] <= 'z'
}

func appPluginSQLiteEagerTransaction(dsn string) (bool, error) {
	sqliteURL, err := url.Parse(dsn)
	if err != nil {
		return false, err
	}
	query, err := url.ParseQuery(sqliteURL.RawQuery)
	if err != nil {
		return false, err
	}
	lockMode := query.Get("_txlock")
	return strings.EqualFold(lockMode, "immediate") || strings.EqualFold(lockMode, "exclusive"), nil
}

type appPluginTxBeginObserver struct {
	gorm.ConnPool
	beginTx func(context.Context, *sql.TxOptions) (*sql.Tx, error)
}

func (observer *appPluginTxBeginObserver) BeginTx(ctx context.Context, options *sql.TxOptions) (*sql.Tx, error) {
	return observer.beginTx(ctx, options)
}

func appPluginWaitForDBInUse(ctx context.Context, pool *sql.DB, minimum int) error {
	ticker := time.NewTicker(time.Millisecond)
	defer ticker.Stop()
	for {
		stats := pool.Stats()
		if stats.InUse >= minimum {
			return nil
		}
		select {
		case <-ctx.Done():
			stats = pool.Stats()
			if stats.InUse >= minimum {
				return nil
			}
			return fmt.Errorf(
				"database/sql pool did not reach InUse >= %d (last InUse=%d): %w",
				minimum, stats.InUse, ctx.Err(),
			)
		case <-ticker.C:
		}
	}
}

func logAppPluginDBVersion(t *testing.T, db *gorm.DB) {
	t.Helper()
	var version string
	switch db.Dialector.Name() {
	case "sqlite":
		require.NoError(t, db.Raw("select sqlite_version()").Scan(&version).Error)
	case "mysql":
		require.NoError(t, db.Raw("select version()").Scan(&version).Error)
	case "postgres":
		require.NoError(t, db.Raw("select version()").Scan(&version).Error)
	}
	t.Logf("database=%s version=%s", db.Dialector.Name(), version)
}

func assertAppPluginModelRuntimeMetadata(t *testing.T, db *gorm.DB) {
	t.Helper()
	dialect := db.Dialector.Name()
	require.Equal(t, dialect, os.Getenv("APP_PLUGIN_TEST_DIALECT"))
	require.NotEmpty(t, os.Getenv("APP_PLUGIN_TEST_DRIVER"))

	var version string
	switch dialect {
	case "sqlite":
		require.NoError(t, db.Raw("select sqlite_version()").Scan(&version).Error)
		require.Equal(t, "github.com/glebarez/sqlite@v1.11.0", os.Getenv("APP_PLUGIN_TEST_DRIVER"))
		require.Empty(t, os.Getenv("APP_PLUGIN_TEST_IMAGE"))
		require.Empty(t, os.Getenv("APP_PLUGIN_TEST_PLATFORM"))
	case "mysql":
		require.NoError(t, db.Raw("select version()").Scan(&version).Error)
		require.Equal(t, "gorm.io/driver/mysql@v1.5.7", os.Getenv("APP_PLUGIN_TEST_DRIVER"))
		require.Equal(t, "mysql:5.7.44@sha256:4bc6bc963e6d8443453676cae56536f4b8156d78bae03c0145cbe47c2aad73bb", os.Getenv("APP_PLUGIN_TEST_IMAGE"))
		require.Equal(t, "linux/amd64", os.Getenv("APP_PLUGIN_TEST_PLATFORM"))
	case "postgres":
		require.NoError(t, db.Raw("select version()").Scan(&version).Error)
		require.Equal(t, "gorm.io/driver/postgres@v1.5.9", os.Getenv("APP_PLUGIN_TEST_DRIVER"))
		require.Equal(t, "postgres:15.19@sha256:9b1d34adbce1dd07ee6e94b4a2cf698884b89bd44a6c9c12f5da8f3acbfe4957", os.Getenv("APP_PLUGIN_TEST_IMAGE"))
		require.Equal(t, "linux/arm64", os.Getenv("APP_PLUGIN_TEST_PLATFORM"))
	default:
		t.Fatalf("unsupported database dialect %q", dialect)
	}
	require.Equal(t, version, os.Getenv("APP_PLUGIN_TEST_DATABASE_VERSION"))
}

func appPluginModelInstallRequest(key, version, baseURL string) AppInstallRequest {
	manifest := []byte(`{"apiVersion":1,"kind":"app","key":"` + key + `","version":"` + version + `"}`)
	return AppInstallRequest{
		AppKey:                   key,
		ManifestVersion:          version,
		ManifestSHA256:           appPluginDigest(string(manifest)),
		CanonicalManifestJSON:    manifest,
		BaseURL:                  baseURL,
		CallbackURL:              baseURL + "callback",
		DirectURL:                baseURL + "direct",
		EmbeddedURL:              baseURL + "embedded",
		EnabledSurfaces:          []string{"direct", "embedded"},
		AllowedParentOrigins:     []string{"https://console.example.com"},
		AllowedOrigins:           []string{"https://apps.example.com"},
		AllowedUserPolicy:        AppAllowedUserPolicy{Groups: []string{"default"}},
		NetworkPolicy:            AppNetworkPolicy{AllowHosts: []string{"api.example.com"}},
		EntitlementPolicyID:      "policy-basic",
		ServiceCredentialHash:    appPluginDigest("credential:" + key),
		ServiceCredentialID:      "cred_" + key,
		ServiceCredentialVersion: "v1",
		ServiceCredentialExpiry:  4102444800,
	}
}

func appPluginPersistenceCounts(t *testing.T, db *gorm.DB) [4]int64 {
	t.Helper()
	var counts [4]int64
	for i, table := range []any{
		&AppVersion{},
		&AppInstallation{},
		&AppInstallationIdempotency{},
		&AppRouteClaim{},
	} {
		require.NoError(t, db.Model(table).Count(&counts[i]).Error)
	}
	return counts
}

func appPluginCountForKey(t *testing.T, db *gorm.DB, table any, appKey string) int64 {
	t.Helper()
	var count int64
	require.NoError(t, db.Model(table).Where("app_key = ?", appKey).Count(&count).Error)
	return count
}

func appPluginCountForInstallation(t *testing.T, db *gorm.DB, table any, installationID string) int64 {
	t.Helper()
	var count int64
	require.NoError(t, db.Model(table).Where("installation_id = ?", installationID).Count(&count).Error)
	return count
}

func appPluginCountForEndpoint(t *testing.T, db *gorm.DB, endpoint string) int64 {
	t.Helper()
	var count int64
	require.NoError(t, db.Model(&AppRouteClaim{}).Where("absolute_endpoint = ?", endpoint).Count(&count).Error)
	return count
}

func appPluginCountForScope(t *testing.T, db *gorm.DB, scope string) int64 {
	t.Helper()
	var count int64
	require.NoError(t, db.Model(&AppInstallationIdempotency{}).Where("scope_key = ?", scope).Count(&count).Error)
	return count
}

func seedAppPluginModelPolicy(t *testing.T, db *gorm.DB, id string) {
	t.Helper()
	key := "fixture-" + id
	policy := AppEntitlementPolicy{
		ID:             id,
		KeyHash:        appPluginDigest(key),
		VersionKey:     appPluginDigest(key + "-v1"),
		CreationToken:  appPluginDigest(key + "-creation"),
		Key:            key,
		Version:        1,
		EffectiveRules: AppJSONMap{},
	}
	require.NoError(t, db.Where("id = ?", id).FirstOrCreate(&policy).Error)
}

func appPluginDigest(value string) string {
	sum := sha256.Sum256([]byte(value))
	return fmt.Sprintf("%x", sum)
}
