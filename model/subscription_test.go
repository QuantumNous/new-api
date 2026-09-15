package model

import (
	"database/sql"
	"fmt"
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionTestDB(t *testing.T) func() {
	t.Helper()

	oldDB := DB
	oldLogDB := LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldUsingMySQL := common.UsingMySQL
	oldRedisEnabled := common.RedisEnabled

	testDB, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "subscription-test.db")), &gorm.Config{})
	require.NoError(t, err)

	DB = testDB
	LOG_DB = testDB
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	common.RedisEnabled = false
	initCol()

	return func() {
		DB = oldDB
		LOG_DB = oldLogDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingPostgreSQL = oldUsingPostgreSQL
		common.UsingMySQL = oldUsingMySQL
		common.RedisEnabled = oldRedisEnabled
		initCol()
	}
}

func TestSubscriptionUsageUpdatesDoNotOverwriteWalletOverflowSnapshot(t *testing.T) {
	cleanup := setupSubscriptionTestDB(t)
	defer cleanup()

	require.NoError(t, DB.AutoMigrate(&SubscriptionPlan{}, &UserSubscription{}, &SubscriptionPreConsumeRecord{}))

	plan := &SubscriptionPlan{
		Title:            "Reset Snapshot",
		PriceAmount:      9.9,
		Currency:         "USD",
		DurationUnit:     SubscriptionDurationMonth,
		DurationValue:    1,
		Enabled:          true,
		TotalAmount:      100,
		QuotaResetPeriod: SubscriptionResetDaily,
	}
	require.NoError(t, DB.Create(plan).Error)

	now := GetDBTimestamp()
	sub := &UserSubscription{
		UserId:        1,
		PlanId:        plan.Id,
		AmountTotal:   100,
		AmountUsed:    60,
		StartTime:     now - 86400,
		EndTime:       now + 86400,
		Status:        "active",
		LastResetTime: now - 86400,
		NextResetTime: now - 1,
		CreatedAt:    common.GetTimestamp(),
		UpdatedAt:    common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(sub).Error)
	require.NoError(t, DB.Model(&UserSubscription{}).
		Where("id = ?", sub.Id).
		Update("allow_wallet_overflow", gorm.Expr("NULL")).Error)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var locked UserSubscription
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			First(&locked, sub.Id).Error; err != nil {
			return err
		}
		return maybeResetUserSubscriptionWithPlanTx(tx, &locked, plan, GetDBTimestamp())
	}))

	var updated UserSubscription
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	require.EqualValues(t, 0, updated.AmountUsed)
	requireWalletOverflowSnapshotNull(t, sub.Id)

	_, err := PreConsumeUserSubscription(fmt.Sprintf("req-reset-%s", t.Name()), 1, "gpt-4o", 0, 10)
	require.NoError(t, err)
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	require.EqualValues(t, 10, updated.AmountUsed)
	requireWalletOverflowSnapshotNull(t, sub.Id)

	require.NoError(t, PostConsumeUserSubscriptionDelta(sub.Id, -5))
	require.NoError(t, DB.First(&updated, sub.Id).Error)
	require.EqualValues(t, 5, updated.AmountUsed)
	requireWalletOverflowSnapshotNull(t, sub.Id)
}

func requireWalletOverflowSnapshotNull(t *testing.T, userSubscriptionId int) {
	t.Helper()

	var overflowSnapshot sql.NullBool
	require.NoError(t, DB.Raw("SELECT allow_wallet_overflow FROM user_subscriptions WHERE id = ?", userSubscriptionId).
		Scan(&overflowSnapshot).Error)
	require.False(t, overflowSnapshot.Valid)
}
