package model

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func openAssetModelReadinessTestDB(t *testing.T) {
	t.Helper()

	previous := DB
	dsn := fmt.Sprintf("file:%s_%d?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"), time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = sqlDB.Close()
		DB = previous
	})
	DB = db
	require.NoError(t, DB.AutoMigrate(&AssetModelCoverageTarget{}, &AssetModelReadiness{}))
}

func TestAssetModelReadinessAutoMigrateAndCompositeUniqueness(t *testing.T) {
	openAssetModelReadinessTestDB(t)

	require.NoError(t, DB.Create(&AssetModelCoverageTarget{
		ScopeKey:   "scope-a",
		ModelName:  "model-a",
		Status:     AssetModelTargetStatusSelecting,
		CreatedAt:  10,
		UpdatedAt:  10,
		Generation: 0,
	}).Error)
	require.Error(t, DB.Create(&AssetModelCoverageTarget{
		ScopeKey:  "scope-a",
		ModelName: "model-a",
		Status:    AssetModelTargetStatusSelecting,
		CreatedAt: 11,
		UpdatedAt: 11,
	}).Error)

	require.NoError(t, DB.Create(&AssetModelReadiness{
		AssetId:   7,
		ScopeKey:  "scope-a",
		ModelName: "model-a",
		Status:    AssetModelReadinessStatusPending,
	}).Error)
	require.Error(t, DB.Create(&AssetModelReadiness{
		AssetId:   7,
		ScopeKey:  "scope-a",
		ModelName: "model-a",
		Status:    AssetModelReadinessStatusPending,
	}).Error)
}

func TestAssetModelEnsureReadinessCanonicalIdempotency(t *testing.T) {
	openAssetModelReadinessTestDB(t)

	require.NoError(t, EnsureAssetModelReadiness(42, " scope-a ", []string{" zeta ", "", "alpha", "zeta", " alpha "}, 100))
	require.NoError(t, EnsureAssetModelReadiness(42, "scope-a", []string{"alpha", "zeta"}, 200))
	require.NoError(t, EnsureAssetModelReadiness(0, "scope-a", []string{"ignored"}, 200))
	require.NoError(t, EnsureAssetModelReadiness(42, "", []string{"ignored"}, 200))
	require.NoError(t, EnsureAssetModelReadiness(42, "scope-a", []string{" ", ""}, 200))

	rows, err := ListAssetModelReadiness(42, "scope-a", []string{"zeta", "alpha", "alpha"})
	require.NoError(t, err)
	require.Len(t, rows, 2)
	require.Equal(t, "alpha", rows[0].ModelName)
	require.Equal(t, "zeta", rows[1].ModelName)
	for _, row := range rows {
		require.Equal(t, AssetModelReadinessStatusPending, row.Status)
		require.Equal(t, int64(100), row.CreatedAt)
		require.Equal(t, int64(100), row.UpdatedAt)
	}
}

func TestAssetModelReadinessDueFilteringAndOrder(t *testing.T) {
	openAssetModelReadinessTestDB(t)

	seed := []AssetModelReadiness{
		{AssetId: 1, ScopeKey: "s", ModelName: "pending-leased", Status: AssetModelReadinessStatusPending, LeaseOwner: "other", LeaseExpiresAt: 1000, UpdatedAt: 1},
		{AssetId: 1, ScopeKey: "s", ModelName: "retry-future", Status: AssetModelReadinessStatusRetryWaiting, NextRetryAt: 600, UpdatedAt: 2},
		{AssetId: 1, ScopeKey: "s", ModelName: "processing-live", Status: AssetModelReadinessStatusProcessing, LeaseOwner: "w", LeaseExpiresAt: 600, UpdatedAt: 3},
		{AssetId: 1, ScopeKey: "s", ModelName: "failed", Status: AssetModelReadinessStatusFailed, UpdatedAt: 4},
		{AssetId: 1, ScopeKey: "s", ModelName: "retry-due", Status: AssetModelReadinessStatusRetryWaiting, NextRetryAt: 20, UpdatedAt: 8},
		{AssetId: 1, ScopeKey: "s", ModelName: "pending", Status: AssetModelReadinessStatusPending, UpdatedAt: 5},
		{AssetId: 1, ScopeKey: "s", ModelName: "processing-expired", Status: AssetModelReadinessStatusProcessing, LeaseOwner: "w", LeaseExpiresAt: 40, UpdatedAt: 7},
	}
	require.NoError(t, DB.Create(&seed).Error)

	rows, err := ListDueAssetModelReadiness(50, 10)
	require.NoError(t, err)
	require.Equal(t, []string{"pending", "processing-expired", "retry-due"}, readinessModelNames(rows))
}

func TestAssetModelReadinessLeaseSingleWinnerAndAttemptStart(t *testing.T) {
	openAssetModelReadinessTestDB(t)
	require.NoError(t, EnsureAssetModelReadiness(7, "scope", []string{"model"}, 10))
	row := requireOneReadiness(t, 7, "scope", "model")

	won, err := ClaimAssetModelReadinessLease(row.Id, "owner-a", 20, 80)
	require.NoError(t, err)
	require.True(t, won)
	won, err = ClaimAssetModelReadinessLease(row.Id, "owner-b", 21, 90)
	require.NoError(t, err)
	require.False(t, won)

	row = requireOneReadiness(t, 7, "scope", "model")
	require.Equal(t, AssetModelReadinessStatusProcessing, row.Status)
	require.Equal(t, "owner-a", row.LeaseOwner)
	require.Equal(t, int64(80), row.LeaseExpiresAt)
	require.Equal(t, int64(20), row.AttemptStartedAt)
	require.Equal(t, 1, row.AttemptCount)

	won, err = ClaimAssetModelReadinessLease(row.Id, "owner-b", 81, 120)
	require.NoError(t, err)
	require.True(t, won)
	row = requireOneReadiness(t, 7, "scope", "model")
	require.Equal(t, "owner-b", row.LeaseOwner)
	require.Equal(t, int64(20), row.AttemptStartedAt)
	require.Equal(t, 2, row.AttemptCount)
}

func TestAssetModelReadinessCASFencingRetryActiveFailedAndReset(t *testing.T) {
	openAssetModelReadinessTestDB(t)
	require.NoError(t, EnsureAssetModelReadiness(9, "scope", []string{"model"}, 10))
	row := requireOneReadiness(t, 9, "scope", "model")
	won, err := ClaimAssetModelReadinessLease(row.Id, "worker", 20, 100)
	require.NoError(t, err)
	require.True(t, won)
	row = requireOneReadiness(t, 9, "scope", "model")

	target := AssetModelCoverageTarget{
		ScopeKey:          "scope",
		ModelName:         "model",
		ChannelId:         101,
		BindingScope:      "tenant-a",
		Generation:        2,
		Status:            AssetModelTargetStatusActive,
		SpecificChannelId: 101,
		CandidateIndex:    3,
		CredentialIndex:   4,
	}
	reset, err := ResetAssetModelReadinessForTargetCAS(row.Id, "worker", row.AttemptCount, row.LeaseExpiresAt, target, 30)
	require.NoError(t, err)
	require.True(t, reset)
	row = requireOneReadiness(t, 9, "scope", "model")
	require.Equal(t, AssetModelReadinessStatusPending, row.Status)
	require.Equal(t, int64(2), row.TargetGeneration)
	require.Equal(t, 101, row.ChannelId)
	require.Equal(t, "tenant-a", row.BindingScope)
	require.Equal(t, 0, row.AttemptCount)
	require.Equal(t, int64(0), row.AttemptStartedAt)

	won, err = ClaimAssetModelReadinessLease(row.Id, "worker", 40, 120)
	require.NoError(t, err)
	require.True(t, won)
	row = requireOneReadiness(t, 9, "scope", "model")
	transition := AssetModelReadinessTransition{
		AssetId:                9,
		ScopeKey:               "scope",
		ModelName:              "model",
		TargetGeneration:       2,
		ChannelId:              101,
		BindingScope:           "tenant-a",
		LeaseOwner:             "worker",
		ExpectedAttemptCount:   row.AttemptCount,
		ExpectedLeaseExpiresAt: row.LeaseExpiresAt,
		Now:                    50,
	}
	ok, err := ScheduleAssetModelReadinessRetryCAS(transition, " provider/time out! ", 90)
	require.NoError(t, err)
	require.True(t, ok)
	row = requireOneReadiness(t, 9, "scope", "model")
	require.Equal(t, AssetModelReadinessStatusRetryWaiting, row.Status)
	require.Equal(t, "provider_time_out", row.ErrorClass)
	require.Equal(t, int64(90), row.NextRetryAt)
	require.Equal(t, "", row.LeaseOwner)

	won, err = ClaimAssetModelReadinessLease(row.Id, "worker", 91, 140)
	require.NoError(t, err)
	require.True(t, won)
	row = requireOneReadiness(t, 9, "scope", "model")
	transition.ExpectedAttemptCount = row.AttemptCount
	transition.ExpectedLeaseExpiresAt = row.LeaseExpiresAt
	stale := transition
	stale.TargetGeneration = 1
	stale.Now = 92
	ok, err = ActivateAssetModelReadinessCAS(stale)
	require.NoError(t, err)
	require.False(t, ok)
	ok, err = ActivateAssetModelReadinessCAS(transition)
	require.NoError(t, err)
	require.True(t, ok)
	row = requireOneReadiness(t, 9, "scope", "model")
	require.Equal(t, AssetModelReadinessStatusActive, row.Status)
	require.Equal(t, "", row.ErrorClass)
	require.Equal(t, "", row.LeaseOwner)

	row.Status = AssetModelReadinessStatusProcessing
	row.LeaseOwner = "worker"
	row.LeaseExpiresAt = 200
	require.NoError(t, DB.Save(&row).Error)
	transition.ExpectedLeaseExpiresAt = 200
	ok, err = FailAssetModelReadinessCAS(transition, "fatal/provider")
	require.NoError(t, err)
	require.True(t, ok)
	row = requireOneReadiness(t, 9, "scope", "model")
	require.Equal(t, AssetModelReadinessStatusFailed, row.Status)
	require.Equal(t, "fatal_provider", row.ErrorClass)
}

func TestAssetModelReadinessSameOwnerReclaimRequiresFreshAttemptFence(t *testing.T) {
	openAssetModelReadinessTestDB(t)
	require.NoError(t, EnsureAssetModelReadiness(11, "scope", []string{"model"}, 1))
	row := requireOneReadiness(t, 11, "scope", "model")
	won, err := ClaimAssetModelReadinessLease(row.Id, "node-a", 10, 20)
	require.NoError(t, err)
	require.True(t, won)
	attemptOne := requireOneReadiness(t, 11, "scope", "model")

	won, err = ClaimAssetModelReadinessLease(row.Id, "node-a", 21, 60)
	require.NoError(t, err)
	require.True(t, won)
	attemptTwo := requireOneReadiness(t, 11, "scope", "model")
	require.Equal(t, 2, attemptTwo.AttemptCount)
	require.Equal(t, int64(60), attemptTwo.LeaseExpiresAt)

	staleTransition := AssetModelReadinessTransition{
		AssetId:                11,
		ScopeKey:               "scope",
		ModelName:              "model",
		LeaseOwner:             "node-a",
		ExpectedAttemptCount:   attemptOne.AttemptCount,
		ExpectedLeaseExpiresAt: attemptOne.LeaseExpiresAt,
		Now:                    22,
	}
	ok, err := ActivateAssetModelReadinessCAS(staleTransition)
	require.NoError(t, err)
	require.False(t, ok)

	freshTransition := staleTransition
	freshTransition.ExpectedAttemptCount = attemptTwo.AttemptCount
	freshTransition.ExpectedLeaseExpiresAt = attemptTwo.LeaseExpiresAt
	ok, err = ActivateAssetModelReadinessCAS(freshTransition)
	require.NoError(t, err)
	require.True(t, ok)

	require.NoError(t, DB.Model(&AssetModelReadiness{}).Where("id = ?", row.Id).Updates(map[string]any{
		"status":           AssetModelReadinessStatusProcessing,
		"lease_owner":      "node-a",
		"lease_expires_at": int64(90),
		"attempt_count":    3,
	}).Error)
	target := AssetModelCoverageTarget{
		ScopeKey:     "scope",
		ModelName:    "model",
		Generation:   1,
		ChannelId:    77,
		BindingScope: "tenant",
	}
	reset, err := ResetAssetModelReadinessForTargetCAS(row.Id, "node-a", attemptOne.AttemptCount, attemptOne.LeaseExpiresAt, target, 30)
	require.NoError(t, err)
	require.False(t, reset)
	mismatchedTarget := target
	mismatchedTarget.ScopeKey = "other-scope"
	reset, err = ResetAssetModelReadinessForTargetCAS(row.Id, "node-a", 3, 90, mismatchedTarget, 30)
	require.NoError(t, err)
	require.False(t, reset)
	reset, err = ResetAssetModelReadinessForTargetCAS(row.Id, "node-a", 3, 90, target, 30)
	require.NoError(t, err)
	require.True(t, reset)
}

func TestAssetModelTargetLeasePublishAndRotateCAS(t *testing.T) {
	openAssetModelReadinessTestDB(t)

	won, err := ClaimAssetModelTargetLease("scope", "model", "owner-a", 10, 100)
	require.NoError(t, err)
	require.True(t, won)
	target, err := GetAssetModelCoverageTarget("scope", "model")
	require.NoError(t, err)
	require.Equal(t, AssetModelTargetStatusSelecting, target.Status)
	require.Equal(t, int64(0), target.Generation)
	require.Equal(t, "owner-a", target.LeaseOwner)

	won, err = ClaimAssetModelTargetLease("scope", "model", "owner-b", 11, 120)
	require.NoError(t, err)
	require.False(t, won)
	won, err = ClaimAssetModelTargetLease("scope", "model", "owner-a", 12, 130)
	require.NoError(t, err)
	require.True(t, won)

	candidate := AssetModelCoverageTarget{
		RoutingGroups:     "vip,default",
		SpecificChannelId: 77,
		ChannelId:         88,
		MappedModel:       "mapped-model",
		BindingScope:      "tenant",
		CredentialIndex:   2,
		CandidateIndex:    5,
	}
	published, err := PublishAssetModelTargetCAS("scope", "model", "owner-b", 0, 130, candidate, 20)
	require.NoError(t, err)
	require.False(t, published)
	published, err = PublishAssetModelTargetCAS("scope", "model", "owner-a", 0, 130, candidate, 21)
	require.NoError(t, err)
	require.True(t, published)
	published, err = PublishAssetModelTargetCAS("scope", "model", "owner-a", 0, 130, candidate, 22)
	require.NoError(t, err)
	require.False(t, published)
	target, err = GetAssetModelCoverageTarget("scope", "model")
	require.NoError(t, err)
	require.Equal(t, AssetModelTargetStatusActive, target.Status)
	require.Equal(t, int64(1), target.Generation)
	require.Equal(t, 88, target.ChannelId)
	require.Equal(t, "", target.LeaseOwner)

	rotated, err := RotateAssetModelTargetCAS("scope", "model", 0, "ignored", 30)
	require.NoError(t, err)
	require.False(t, rotated)
	rotated, err = RotateAssetModelTargetCAS("scope", "model", 1, "ignored", 31)
	require.NoError(t, err)
	require.True(t, rotated)
	target, err = GetAssetModelCoverageTarget("scope", "model")
	require.NoError(t, err)
	require.Equal(t, AssetModelTargetStatusRotating, target.Status)
	require.Equal(t, int64(2), target.Generation)
	require.Equal(t, 0, target.ChannelId)
	require.Equal(t, "", target.MappedModel)
	require.Equal(t, -1, target.CandidateIndex)
	require.Equal(t, -1, target.CredentialIndex)
}

func TestAssetModelTargetPublishSameOwnerReclaimRequiresCurrentLeaseExpiry(t *testing.T) {
	openAssetModelReadinessTestDB(t)

	won, err := ClaimAssetModelTargetLease("scope", "model", "owner-a", 10, 100)
	require.NoError(t, err)
	require.True(t, won)
	won, err = ClaimAssetModelTargetLease("scope", "model", "owner-a", 11, 150)
	require.NoError(t, err)
	require.True(t, won)

	candidate := AssetModelCoverageTarget{ChannelId: 88, BindingScope: "tenant"}
	published, err := PublishAssetModelTargetCAS("scope", "model", "owner-a", 0, 100, candidate, 20)
	require.NoError(t, err)
	require.False(t, published)
	published, err = PublishAssetModelTargetCAS("scope", "model", "owner-a", 0, 150, candidate, 21)
	require.NoError(t, err)
	require.True(t, published)
	published, err = PublishAssetModelTargetCAS("scope", "model", "owner-a", 0, 150, candidate, 22)
	require.NoError(t, err)
	require.False(t, published)

	target, err := GetAssetModelCoverageTarget("scope", "model")
	require.NoError(t, err)
	require.Equal(t, int64(1), target.Generation)
}

func TestAssetModelTargetRotateDoesNotStealLiveLease(t *testing.T) {
	openAssetModelReadinessTestDB(t)

	require.NoError(t, DB.Create(&AssetModelCoverageTarget{
		ScopeKey:       "scope",
		ModelName:      "model",
		Status:         AssetModelTargetStatusActive,
		Generation:     7,
		LeaseOwner:     "publisher",
		LeaseExpiresAt: 100,
		ChannelId:      88,
	}).Error)

	rotated, err := RotateAssetModelTargetCAS("scope", "model", 7, "ignored", 50)
	require.NoError(t, err)
	require.False(t, rotated)
	rotated, err = RotateAssetModelTargetCAS("scope", "model", 7, "ignored", 101)
	require.NoError(t, err)
	require.True(t, rotated)
}

func readinessModelNames(rows []AssetModelReadiness) []string {
	names := make([]string, 0, len(rows))
	for _, row := range rows {
		names = append(names, row.ModelName)
	}
	return names
}

func requireOneReadiness(t *testing.T, assetID int64, scopeKey string, modelName string) AssetModelReadiness {
	t.Helper()

	rows, err := ListAssetModelReadiness(assetID, scopeKey, []string{modelName})
	require.NoError(t, err)
	require.Len(t, rows, 1, fmt.Sprintf("readiness row %d/%s/%s", assetID, scopeKey, modelName))
	return rows[0]
}
