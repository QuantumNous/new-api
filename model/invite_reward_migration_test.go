package model

import (
	"fmt"
	"math"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type inviteRewardMigrationSQLRecorder struct {
	entries []string
}

func (r *inviteRewardMigrationSQLRecorder) Printf(format string, args ...any) {
	r.entries = append(r.entries, fmt.Sprintf(format, args...))
}

func setupInviteRewardMigrationTest(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalQuotaPerUnit := common.QuotaPerUnit
	originalInviteRewardSubscriptionMode := common.InviteRewardSubscriptionMode

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/invite-reward-migration.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&User{}, &InviteSubscriptionReward{}, &SubscriptionDiscountAccount{}, &SubscriptionDiscountEntry{}, &SubscriptionOrder{}))

	DB = db
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.QuotaPerUnit = 100_000

	t.Cleanup(func() {
		sqlDB, dbErr := db.DB()
		if dbErr == nil {
			_ = sqlDB.Close()
		}
		DB = originalDB
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.QuotaPerUnit = originalQuotaPerUnit
		common.InviteRewardSubscriptionMode = originalInviteRewardSubscriptionMode
	})

	return db
}

func TestMigrateInvitationValuePreservesOnlyUntransferredSources(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)

	users := []User{
		{Id: 301, Username: "legacy-aff", Password: "password123", AffCode: "legacy-aff-code", AffQuota: 250_000},
		{Id: 302, Username: "pending-reward-inviter", Password: "password123", AffCode: "pending-reward-inviter-code"},
		{Id: 303, Username: "already-in-quota", Password: "password123", AffCode: "already-in-quota-code", Quota: 900_000},
		{Id: 304, Username: "discounted-invitee", Password: "password123", AffCode: "discounted-invitee-code", InviterId: 302},
	}
	require.NoError(t, db.Create(&users).Error)
	pendingReward := InviteSubscriptionReward{
		Id:          401,
		InviteeId:   users[3].Id,
		InviterId:   users[1].Id,
		OrderId:     501,
		TradeNo:     "sub-paid-with-discount",
		OrderMoney:  5,
		RewardQuota: 500_000,
		Status:      InviteSubRewardStatusPending,
		UnlockAt:    123456,
	}
	require.NoError(t, db.Create(&pendingReward).Error)
	require.NoError(t, db.Create(&SubscriptionOrder{
		Id:           501,
		UserId:       users[3].Id,
		PlanId:       1,
		Money:        5,
		DiscountUSD:  3,
		TradeNo:      "sub-paid-with-discount",
		Status:       common.TopUpStatusSuccess,
		CompleteTime: 123,
	}).Error)

	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())
	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())

	var migratedAff User
	require.NoError(t, db.First(&migratedAff, users[0].Id).Error)
	require.Zero(t, migratedAff.AffQuota)
	require.Zero(t, migratedAff.Quota)

	var alreadyTransferred User
	require.NoError(t, db.First(&alreadyTransferred, users[2].Id).Error)
	require.Equal(t, 900_000, alreadyTransferred.Quota)
	require.Zero(t, alreadyTransferred.AffQuota)

	var migratedReward InviteSubscriptionReward
	require.NoError(t, db.First(&migratedReward, pendingReward.Id).Error)
	require.Equal(t, InviteSubRewardStatusGranted, migratedReward.Status)
	require.NotZero(t, migratedReward.GrantedAt)
	require.Zero(t, migratedReward.UnlockAt)

	var entries []SubscriptionDiscountEntry
	require.NoError(t, db.Where("entry_type = ?", SubscriptionDiscountEntryTypeMigration).Order("id ASC").Find(&entries).Error)
	require.Len(t, entries, 2)
	require.EqualValues(t, 250, entries[0].AvailableDeltaUSDMinor)
	require.Equal(t, "migration:invite-discount-v1:aff-quota:301", entries[0].IdempotencyKey)
	require.JSONEq(t, `{"source_type":"aff_quota","source_quota":250000,"quota_per_unit":100000,"quota_to_usd_ratio":"100000:1","usd_minor":250}`, entries[0].PricingSnapshot)
	require.EqualValues(t, 500, entries[1].AvailableDeltaUSDMinor)
	require.Equal(t, "migration:invite-discount-v1:invite-subscription-reward:401", entries[1].IdempotencyKey)
	require.JSONEq(t, `{"source_type":"invite_subscription_reward","source_quota":500000,"quota_per_unit":100000,"quota_to_usd_ratio":"100000:1","usd_minor":500}`, entries[1].PricingSnapshot)

	var inviteeBackfillEntries int64
	require.NoError(t, db.Model(&SubscriptionDiscountEntry{}).
		Where("idempotency_key = ?", fmt.Sprintf("invitee:%d", users[3].Id)).
		Count(&inviteeBackfillEntries).Error)
	require.Zero(t, inviteeBackfillEntries)
}

func TestMigrateInvitationValueUsesOneQuotaPerUnitSnapshotForWholeRun(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)

	require.NoError(t, db.Create(&[]User{
		{Id: 311, Username: "snapshot-a", Password: "password123", AffCode: "snapshot-a-code", AffQuota: 100_000},
		{Id: 312, Username: "snapshot-b", Password: "password123", AffCode: "snapshot-b-code", AffQuota: 100_000},
	}).Error)
	switched := false
	db.Callback().Create().After("gorm:create").Register("test_switch_quota_per_unit_after_first_migration_entry", func(tx *gorm.DB) {
		if _, ok := tx.Statement.Dest.(*SubscriptionDiscountEntry); !ok || switched {
			return
		}
		switched = true
		common.QuotaPerUnit = 200_000
	})

	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())

	var entries []SubscriptionDiscountEntry
	require.NoError(t, db.Where("entry_type = ?", SubscriptionDiscountEntryTypeMigration).Order("id ASC").Find(&entries).Error)
	require.Len(t, entries, 2)
	for _, entry := range entries {
		require.EqualValues(t, 100, entry.AvailableDeltaUSDMinor)
		require.JSONEq(t, `{"source_type":"aff_quota","source_quota":100000,"quota_per_unit":100000,"quota_to_usd_ratio":"100000:1","usd_minor":100}`, entry.PricingSnapshot)
	}
}

func TestMigrateInvitationValueRejectsInvalidQuotaPerUnit(t *testing.T) {
	for _, quotaPerUnit := range []float64{0, -1, math.NaN(), math.Inf(1), math.Inf(-1)} {
		t.Run(fmt.Sprintf("%v", quotaPerUnit), func(t *testing.T) {
			setupInviteRewardMigrationTest(t)
			common.QuotaPerUnit = quotaPerUnit

			require.ErrorIs(t, MigrateLegacyInvitationValueToSubscriptionDiscount(), ErrSubscriptionDiscountInvalidAmount)
		})
	}
}

func TestMigratePositiveAffQuotaThatRoundsToZeroPreservesSourceValue(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)

	user := User{Id: 363, Username: "rounds-zero-aff", Password: "password123", AffCode: "rounds-zero-aff-code", AffQuota: 1}
	require.NoError(t, db.Create(&user).Error)

	require.ErrorIs(t, MigrateLegacyInvitationValueToSubscriptionDiscount(), ErrSubscriptionDiscountInvalidAmount)

	var unchanged User
	require.NoError(t, db.First(&unchanged, user.Id).Error)
	require.Equal(t, 1, unchanged.AffQuota)
	var entries int64
	require.NoError(t, db.Model(&SubscriptionDiscountEntry{}).Where("entry_type = ?", SubscriptionDiscountEntryTypeMigration).Count(&entries).Error)
	require.Zero(t, entries)
}

func TestMigratePositivePendingRewardThatRoundsToZeroPreservesPendingState(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)

	inviter := User{Id: 364, Username: "rounds-zero-inviter", Password: "password123", AffCode: "rounds-zero-inviter-code"}
	invitee := User{Id: 365, Username: "rounds-zero-invitee", Password: "password123", AffCode: "rounds-zero-invitee-code", InviterId: inviter.Id}
	require.NoError(t, db.Create(&[]User{inviter, invitee}).Error)
	reward := InviteSubscriptionReward{
		Id:          422,
		InviteeId:   invitee.Id,
		InviterId:   inviter.Id,
		RewardQuota: 1,
		Status:      InviteSubRewardStatusPending,
		UnlockAt:    456,
	}
	require.NoError(t, db.Create(&reward).Error)

	require.ErrorIs(t, MigrateLegacyInvitationValueToSubscriptionDiscount(), ErrSubscriptionDiscountInvalidAmount)

	var unchanged InviteSubscriptionReward
	require.NoError(t, db.First(&unchanged, reward.Id).Error)
	require.Equal(t, InviteSubRewardStatusPending, unchanged.Status)
	require.Zero(t, unchanged.GrantedAt)
	require.Equal(t, 1, unchanged.RewardQuota)
	var entries int64
	require.NoError(t, db.Model(&SubscriptionDiscountEntry{}).Where("entry_type = ?", SubscriptionDiscountEntryTypeMigration).Count(&entries).Error)
	require.Zero(t, entries)
}

func TestMigrateInvitationValueClearsSourceWhenExistingLedgerHasOlderValidSnapshot(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)

	user := User{Id: 313, Username: "older-ratio", Password: "password123", AffCode: "older-ratio-code", AffQuota: 250_000}
	require.NoError(t, db.Create(&user).Error)
	key := legacyInvitationValueAffQuotaKey(user.Id)
	require.NoError(t, db.Create(&SubscriptionDiscountAccount{
		UserID:            user.Id,
		AvailableUSDMinor: 250,
		CreatedAt:         common.GetTimestamp(),
		UpdatedAt:         common.GetTimestamp(),
	}).Error)
	require.NoError(t, db.Create(&SubscriptionDiscountEntry{
		UserID:                 user.Id,
		EntryType:              SubscriptionDiscountEntryTypeMigration,
		AvailableDeltaUSDMinor: 250,
		AvailableAfterUSDMinor: 250,
		SourceType:             legacyInvitationValueAffQuotaSourceType,
		SourceKey:              key,
		IdempotencyKey:         key,
		PricingSnapshot:        `{"source_type":"aff_quota","source_quota":250000,"quota_per_unit":100000,"quota_to_usd_ratio":"100000:1","usd_minor":250}`,
		CreatedAt:              common.GetTimestamp(),
	}).Error)
	common.QuotaPerUnit = 200_000

	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())

	var migrated User
	require.NoError(t, db.First(&migrated, user.Id).Error)
	require.Zero(t, migrated.AffQuota)
	var entries int64
	require.NoError(t, db.Model(&SubscriptionDiscountEntry{}).Where("idempotency_key = ?", key).Count(&entries).Error)
	require.EqualValues(t, 1, entries)
}

func TestMigrateInvitationValueRejectsMismatchedExistingLedgerAndKeepsSource(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)

	user := User{Id: 314, Username: "bad-ledger", Password: "password123", AffCode: "bad-ledger-code", AffQuota: 250_000}
	require.NoError(t, db.Create(&user).Error)
	key := legacyInvitationValueAffQuotaKey(user.Id)
	require.NoError(t, db.Create(&SubscriptionDiscountEntry{
		UserID:                 user.Id,
		EntryType:              SubscriptionDiscountEntryTypeMigration,
		AvailableDeltaUSDMinor: 250,
		AvailableAfterUSDMinor: 250,
		SourceType:             legacyInvitationValueAffQuotaSourceType,
		SourceKey:              "wrong-source-key",
		IdempotencyKey:         key,
		PricingSnapshot:        `{"source_type":"aff_quota","source_quota":250000,"quota_per_unit":100000,"quota_to_usd_ratio":"100000:1","usd_minor":250}`,
		CreatedAt:              common.GetTimestamp(),
	}).Error)

	require.Error(t, MigrateLegacyInvitationValueToSubscriptionDiscount())

	var unchanged User
	require.NoError(t, db.First(&unchanged, user.Id).Error)
	require.Equal(t, 250_000, unchanged.AffQuota)
}

func TestMigrateInvitationValueSkipsMissingInvitersWithoutBlockingLaterRewards(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)

	deletedInviter := User{Id: 315, Username: "deleted-inviter", Password: "password123", AffCode: "deleted-inviter-code"}
	validInviter := User{Id: 316, Username: "valid-inviter", Password: "password123", AffCode: "valid-inviter-code"}
	require.NoError(t, db.Create(&[]User{deletedInviter, validInviter}).Error)
	require.NoError(t, db.Delete(&User{}, deletedInviter.Id).Error)
	require.NoError(t, db.Create(&[]InviteSubscriptionReward{
		{Id: 411, InviteeId: 911, InviterId: 999_001, RewardQuota: 100_000, Status: InviteSubRewardStatusPending, UnlockAt: 100},
		{Id: 412, InviteeId: 912, InviterId: deletedInviter.Id, RewardQuota: 100_000, Status: InviteSubRewardStatusPending, UnlockAt: 100},
		{Id: 413, InviteeId: 913, InviterId: validInviter.Id, RewardQuota: 100_000, Status: InviteSubRewardStatusPending, UnlockAt: 100},
	}).Error)

	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())

	for _, rewardId := range []int{411, 412} {
		var reward InviteSubscriptionReward
		require.NoError(t, db.First(&reward, rewardId).Error)
		require.Equal(t, InviteSubRewardStatusPending, reward.Status)
		require.Zero(t, reward.GrantedAt)
	}
	var granted InviteSubscriptionReward
	require.NoError(t, db.First(&granted, 413).Error)
	require.Equal(t, InviteSubRewardStatusGranted, granted.Status)
	var entries int64
	require.NoError(t, db.Model(&SubscriptionDiscountEntry{}).Where("entry_type = ?", SubscriptionDiscountEntryTypeMigration).Count(&entries).Error)
	require.EqualValues(t, 1, entries)
}

func TestMigrateInvitationRewardLocksInviterBeforeRewardRow(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)

	inviter := User{Id: 317, Username: "lock-order-inviter", Password: "password123", AffCode: "lock-order-inviter-code"}
	require.NoError(t, db.Create(&inviter).Error)
	require.NoError(t, db.Create(&InviteSubscriptionReward{
		Id:          414,
		InviteeId:   914,
		InviterId:   inviter.Id,
		RewardQuota: 100_000,
		Status:      InviteSubRewardStatusPending,
		UnlockAt:    100,
	}).Error)

	var lockOrder []string
	db.Callback().Update().Before("gorm:update").Register("test_record_invite_reward_migration_lock_order", func(tx *gorm.DB) {
		switch tx.Statement.Table {
		case "users", "invite_subscription_rewards":
			lockOrder = append(lockOrder, tx.Statement.Table)
		}
	})

	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())
	require.GreaterOrEqual(t, len(lockOrder), 2)
	require.Equal(t, []string{"users", "invite_subscription_rewards"}, lockOrder[:2])
}

func TestMigrateInvitationValueHandlesZeroQuotaPendingRewardAsTerminalNoCredit(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)

	inviter := User{Id: 321, Username: "zero-inviter", Password: "password123", AffCode: "zero-inviter-code"}
	invitee := User{Id: 322, Username: "zero-invitee", Password: "password123", AffCode: "zero-invitee-code", InviterId: inviter.Id}
	require.NoError(t, db.Create(&[]User{inviter, invitee}).Error)
	reward := InviteSubscriptionReward{
		Id:          421,
		InviteeId:   invitee.Id,
		InviterId:   inviter.Id,
		RewardQuota: 0,
		Status:      InviteSubRewardStatusPending,
		UnlockAt:    456,
	}
	require.NoError(t, db.Create(&reward).Error)

	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())
	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())

	var migrated InviteSubscriptionReward
	require.NoError(t, db.First(&migrated, reward.Id).Error)
	require.Equal(t, InviteSubRewardStatusGranted, migrated.Status)
	require.NotZero(t, migrated.GrantedAt)
	require.Zero(t, migrated.UnlockAt)
	var entries int64
	require.NoError(t, db.Model(&SubscriptionDiscountEntry{}).Count(&entries).Error)
	require.Zero(t, entries)
}

func TestStartupInviteRewardMigrationSelectionUsesStoredOption(t *testing.T) {
	t.Run("missing option keeps legacy quota migration", func(t *testing.T) {
		db := setupInviteRewardMigrationTest(t)
		require.NoError(t, db.AutoMigrate(&Option{}))
		common.InviteRewardSubscriptionMode = true
		require.NoError(t, db.Create(&User{Id: 361, Username: "startup-legacy", Password: "password123", AffCode: "startup-legacy-code", AffQuota: 100_000}).Error)

		require.NoError(t, migrateStartupInvitationValue())

		var user User
		require.NoError(t, db.First(&user, 361).Error)
		require.Zero(t, user.AffQuota)
		require.Equal(t, 100_000, user.Quota)
		var entries int64
		require.NoError(t, db.Model(&SubscriptionDiscountEntry{}).Count(&entries).Error)
		require.Zero(t, entries)
	})

	t.Run("true option runs subscription discount migration", func(t *testing.T) {
		db := setupInviteRewardMigrationTest(t)
		require.NoError(t, db.AutoMigrate(&Option{}))
		common.InviteRewardSubscriptionMode = false
		require.NoError(t, db.Create(&Option{Key: "InviteRewardSubscriptionModeEnabled", Value: "true"}).Error)
		require.NoError(t, db.Create(&User{Id: 362, Username: "startup-subscription", Password: "password123", AffCode: "startup-subscription-code", AffQuota: 100_000}).Error)

		require.NoError(t, migrateStartupInvitationValue())

		var user User
		require.NoError(t, db.First(&user, 362).Error)
		require.Zero(t, user.AffQuota)
		require.Zero(t, user.Quota)
		account, err := GetSubscriptionDiscountAccount(362)
		require.NoError(t, err)
		require.EqualValues(t, 100, account.AvailableUSDMinor)
	})

	t.Run("invalid option returns parse error", func(t *testing.T) {
		db := setupInviteRewardMigrationTest(t)
		require.NoError(t, db.AutoMigrate(&Option{}))
		require.NoError(t, db.Create(&Option{Key: "InviteRewardSubscriptionModeEnabled", Value: "not-bool"}).Error)

		require.Error(t, migrateStartupInvitationValue())
	})
}

func TestStoredInviteRewardSubscriptionModeQueryQuotesReservedKey(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)
	require.NoError(t, db.AutoMigrate(&Option{}))
	require.NoError(t, db.Create(&Option{Key: "InviteRewardSubscriptionModeEnabled", Value: "true"}).Error)

	recorder := &inviteRewardMigrationSQLRecorder{}
	DB = db.Session(&gorm.Session{Logger: logger.New(recorder, logger.Config{LogLevel: logger.Info})})
	enabled, err := storedInviteRewardSubscriptionModeEnabled()
	require.NoError(t, err)
	require.True(t, enabled)

	generatedSQL := strings.Join(recorder.entries, "\n")
	require.Contains(t, generatedSQL, "`options`.`key`")
	require.NotContains(t, generatedSQL, "WHERE key =")
}

func TestMigrateUserInvitationValueScopesAffQuotaAndPendingRewards(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)

	users := []User{
		{Id: 331, Username: "selected", Password: "password123", AffCode: "selected-code", AffQuota: 100_000},
		{Id: 332, Username: "other", Password: "password123", AffCode: "other-code", AffQuota: 200_000},
		{Id: 333, Username: "invitee-selected", Password: "password123", AffCode: "invitee-selected-code", InviterId: 331},
		{Id: 334, Username: "invitee-other", Password: "password123", AffCode: "invitee-other-code", InviterId: 332},
	}
	require.NoError(t, db.Create(&users).Error)
	require.NoError(t, db.Create(&[]InviteSubscriptionReward{
		{Id: 431, InviteeId: 333, InviterId: 331, RewardQuota: 300_000, Status: InviteSubRewardStatusPending, UnlockAt: 100},
		{Id: 432, InviteeId: 334, InviterId: 332, RewardQuota: 400_000, Status: InviteSubRewardStatusPending, UnlockAt: 100},
	}).Error)

	require.NoError(t, MigrateUserLegacyInvitationValueToSubscriptionDiscount(331))
	require.NoError(t, MigrateUserLegacyInvitationValueToSubscriptionDiscount(331))

	var selected User
	require.NoError(t, db.First(&selected, 331).Error)
	require.Zero(t, selected.AffQuota)
	var other User
	require.NoError(t, db.First(&other, 332).Error)
	require.Equal(t, 200_000, other.AffQuota)

	var selectedReward InviteSubscriptionReward
	require.NoError(t, db.First(&selectedReward, 431).Error)
	require.Equal(t, InviteSubRewardStatusGranted, selectedReward.Status)
	var otherReward InviteSubscriptionReward
	require.NoError(t, db.First(&otherReward, 432).Error)
	require.Equal(t, InviteSubRewardStatusPending, otherReward.Status)
	var entries []SubscriptionDiscountEntry
	require.NoError(t, db.Where("entry_type = ?", SubscriptionDiscountEntryTypeMigration).Find(&entries).Error)
	require.Len(t, entries, 2)
}

func TestMigrateInvitationValueSQLiteConcurrentRunsConverge(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "invite-reward-migration-concurrent.db")
	setupInviteRewardMigrationTestDBPath(t, dbPath+"?_pragma=busy_timeout(10000)&_txlock=immediate", 4)
	require.NoError(t, DB.Create(&User{Id: 341, Username: "concurrent", Password: "password123", AffCode: "concurrent-code", AffQuota: 250_000}).Error)
	require.NoError(t, DB.Create(&User{Id: 342, Username: "concurrent-invitee", Password: "password123", AffCode: "concurrent-invitee-code", InviterId: 341}).Error)
	require.NoError(t, DB.Create(&InviteSubscriptionReward{Id: 441, InviteeId: 342, InviterId: 341, RewardQuota: 500_000, Status: InviteSubRewardStatusPending, UnlockAt: 100}).Error)

	start := make(chan struct{})
	results := make(chan error, 4)
	var wg sync.WaitGroup
	for i := 0; i < 4; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			<-start
			results <- MigrateLegacyInvitationValueToSubscriptionDiscount()
		}()
	}
	close(start)
	wg.Wait()
	close(results)
	for err := range results {
		require.NoError(t, err)
	}
	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())

	var user User
	require.NoError(t, DB.First(&user, 341).Error)
	require.Zero(t, user.AffQuota)
	var entries int64
	require.NoError(t, DB.Model(&SubscriptionDiscountEntry{}).Where("entry_type = ?", SubscriptionDiscountEntryTypeMigration).Count(&entries).Error)
	require.EqualValues(t, 2, entries)
	account, err := GetSubscriptionDiscountAccount(341)
	require.NoError(t, err)
	require.EqualValues(t, 750, account.AvailableUSDMinor)
}

func setupInviteRewardMigrationTestDBPath(t *testing.T, dsn string, maxOpenConns int) {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalQuotaPerUnit := common.QuotaPerUnit

	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(maxOpenConns)
	sqlDB.SetMaxIdleConns(maxOpenConns)

	DB = db
	LOG_DB = db
	common.RedisEnabled = false
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.QuotaPerUnit = 100_000
	require.NoError(t, db.AutoMigrate(&User{}, &InviteSubscriptionReward{}, &SubscriptionDiscountAccount{}, &SubscriptionDiscountEntry{}, &SubscriptionOrder{}))

	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
		DB = originalDB
		LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.QuotaPerUnit = originalQuotaPerUnit
	})
}

func TestMigrateInvitationValueMySQLSmoke(t *testing.T) {
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set TEST_MYSQL_DSN to run MySQL invite reward migration smoke test")
	}
	runInviteRewardMigrationExternalDBSmoke(t, "mysql", dsn)
}

func TestMigrateInvitationValuePostgresSmoke(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("set TEST_POSTGRES_DSN to run PostgreSQL invite reward migration smoke test")
	}
	runInviteRewardMigrationExternalDBSmoke(t, "postgres", dsn)
}

func runInviteRewardMigrationExternalDBSmoke(t *testing.T, dialect string, dsn string) {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalQuotaPerUnit := common.QuotaPerUnit

	var (
		db  *gorm.DB
		err error
	)
	switch dialect {
	case "mysql":
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	case "postgres":
		db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	default:
		t.Fatalf("unsupported dialect %q", dialect)
	}
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
		DB = originalDB
		LOG_DB = originalLogDB
		common.RedisEnabled = originalRedisEnabled
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		common.QuotaPerUnit = originalQuotaPerUnit
	})

	for _, table := range []string{"users", "invite_subscription_rewards", "subscription_discount_accounts", "subscription_discount_entries"} {
		if db.Migrator().HasTable(table) {
			t.Skipf("refusing to run %s invite reward migration smoke against non-empty external database; table %s already exists", dialect, table)
		}
	}

	DB = db
	LOG_DB = db
	common.RedisEnabled = false
	common.UsingSQLite = false
	common.UsingMySQL = dialect == "mysql"
	common.UsingPostgreSQL = dialect == "postgres"
	common.QuotaPerUnit = 100_000
	require.NoError(t, db.AutoMigrate(&User{}, &InviteSubscriptionReward{}, &SubscriptionDiscountAccount{}, &SubscriptionDiscountEntry{}))
	require.NoError(t, db.Create(&User{Id: 351, Username: "external", Password: "password123", AffCode: "external-code", AffQuota: 100_000}).Error)
	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())
	require.NoError(t, MigrateLegacyInvitationValueToSubscriptionDiscount())

	account, err := GetSubscriptionDiscountAccount(351)
	require.NoError(t, err)
	require.EqualValues(t, 100, account.AvailableUSDMinor)
}

func TestMigrateLegacyAffQuotaToQuotaIsIdempotent(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)
	users := []User{
		{Id: 101, Username: "legacy-reward", Password: "password123", AffCode: "legacy-reward-code", Quota: 300, AffQuota: 200},
		{Id: 102, Username: "no-legacy-reward", Password: "password123", AffCode: "no-legacy-reward-code", Quota: 500},
	}
	require.NoError(t, db.Create(&users).Error)

	require.NoError(t, MigrateLegacyAffQuotaToQuota())
	require.NoError(t, MigrateLegacyAffQuotaToQuota())

	var migrated User
	require.NoError(t, db.First(&migrated, users[0].Id).Error)
	require.Equal(t, 500, migrated.Quota)
	require.Zero(t, migrated.AffQuota)

	var unchanged User
	require.NoError(t, db.First(&unchanged, users[1].Id).Error)
	require.Equal(t, 500, unchanged.Quota)
	require.Zero(t, unchanged.AffQuota)
}

func TestMigrateLegacyAffQuotaBatchOnlyMigratesSelectedUsers(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)
	users := []User{
		{Id: 151, Username: "selected-legacy-reward", Password: "password123", AffCode: "selected-legacy-reward-code", Quota: 100, AffQuota: 200},
		{Id: 152, Username: "late-legacy-reward", Password: "password123", AffCode: "late-legacy-reward-code", Quota: 300, AffQuota: 400},
	}
	require.NoError(t, db.Create(&users).Error)

	require.NoError(t, migrateLegacyAffQuotaBatch([]int{users[0].Id}))

	var selected User
	require.NoError(t, db.First(&selected, users[0].Id).Error)
	require.Equal(t, 300, selected.Quota)
	require.Zero(t, selected.AffQuota)

	var late User
	require.NoError(t, db.First(&late, users[1].Id).Error)
	require.Equal(t, 300, late.Quota)
	require.Equal(t, 400, late.AffQuota)
}

func TestMigrateUserLegacyAffQuotaToQuotaScopesTheReconciliation(t *testing.T) {
	db := setupInviteRewardMigrationTest(t)
	users := []User{
		{Id: 201, Username: "selected-user", Password: "password123", AffCode: "selected-user-code", Quota: 100, AffQuota: 250},
		{Id: 202, Username: "other-user", Password: "password123", AffCode: "other-user-code", Quota: 400, AffQuota: 600},
	}
	require.NoError(t, db.Create(&users).Error)

	require.NoError(t, MigrateUserLegacyAffQuotaToQuota(users[0].Id))
	require.NoError(t, MigrateUserLegacyAffQuotaToQuota(users[0].Id))

	var selected User
	require.NoError(t, db.First(&selected, users[0].Id).Error)
	require.Equal(t, 350, selected.Quota)
	require.Zero(t, selected.AffQuota)

	var other User
	require.NoError(t, db.First(&other, users[1].Id).Error)
	require.Equal(t, 400, other.Quota)
	require.Equal(t, 600, other.AffQuota)
}
