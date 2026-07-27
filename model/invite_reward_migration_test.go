package model

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func setupInviteRewardMigrationTest(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := DB
	originalRedisEnabled := common.RedisEnabled
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL
	originalQuotaPerUnit := common.QuotaPerUnit

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
