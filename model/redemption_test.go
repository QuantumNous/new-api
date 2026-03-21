package model

import (
	"path/filepath"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRedemptionTestDB(t *testing.T) {
	t.Helper()

	oldDB := DB
	oldLogDB := LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldRedisEnabled := common.RedisEnabled
	oldBatchUpdateEnabled := common.BatchUpdateEnabled

	dsn := filepath.Join(t.TempDir(), "redemption_test.db")
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	DB = db
	LOG_DB = db
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.RedisEnabled = false
	common.BatchUpdateEnabled = false

	require.NoError(t, db.AutoMigrate(
		&User{},
		&Redemption{},
		&SubscriptionPlan{},
		&UserSubscription{},
		&Log{},
	))

	t.Cleanup(func() {
		DB = oldDB
		LOG_DB = oldLogDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingPostgreSQL = oldUsingPostgreSQL
		common.RedisEnabled = oldRedisEnabled
		common.BatchUpdateEnabled = oldBatchUpdateEnabled
	})
}

func seedRedemptionUserAndPlan(t *testing.T) *SubscriptionPlan {
	t.Helper()

	user := &User{
		Id:       1,
		Username: "redeem-user",
		Password: "password123",
		Status:   common.UserStatusEnabled,
		Quota:    1000,
		Group:    "default",
	}
	require.NoError(t, DB.Create(user).Error)

	plan := &SubscriptionPlan{
		Id:            1,
		Title:         "Pro Monthly",
		PriceAmount:   9.9,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   500000,
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

func TestRedeemSubscriptionOnly(t *testing.T) {
	setupRedemptionTestDB(t)
	plan := seedRedemptionUserAndPlan(t)

	redemption := &Redemption{
		UserId:                99,
		Name:                  "subscription-only",
		Key:                   "subonlycode",
		Status:                common.RedemptionCodeStatusEnabled,
		Quota:                 0,
		SubscriptionPlanId:    plan.Id,
		SubscriptionPlanTitle: plan.Title,
		CreatedTime:           common.GetTimestamp(),
	}
	require.NoError(t, redemption.Insert())

	result, err := Redeem(redemption.Key, 1)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, 0, result.Quota)
	if assert.NotNil(t, result.Subscription) {
		assert.Equal(t, plan.Id, result.Subscription.SubscriptionPlanId)
		assert.Equal(t, plan.Title, result.Subscription.SubscriptionPlanTitle)
		assert.Equal(t, plan.TotalAmount, result.Subscription.AmountTotal)
	}

	var user User
	require.NoError(t, DB.First(&user, "id = ?", 1).Error)
	assert.Equal(t, 1000, user.Quota)

	var sub UserSubscription
	require.NoError(t, DB.First(&sub, "user_id = ?", 1).Error)
	assert.Equal(t, plan.Id, sub.PlanId)
	assert.Equal(t, "active", sub.Status)
	assert.Equal(t, "redemption", sub.Source)

	var redeemed Redemption
	require.NoError(t, DB.First(&redeemed, "id = ?", redemption.Id).Error)
	assert.Equal(t, common.RedemptionCodeStatusUsed, redeemed.Status)
	assert.Equal(t, 1, redeemed.UsedUserId)
	assert.NotZero(t, redeemed.RedeemedTime)
}

func TestRedeemQuotaAndSubscription(t *testing.T) {
	setupRedemptionTestDB(t)
	plan := seedRedemptionUserAndPlan(t)

	redemption := &Redemption{
		UserId:                99,
		Name:                  "mixed-benefit",
		Key:                   "mixedcode",
		Status:                common.RedemptionCodeStatusEnabled,
		Quota:                 250000,
		SubscriptionPlanId:    plan.Id,
		SubscriptionPlanTitle: plan.Title,
		CreatedTime:           common.GetTimestamp(),
	}
	require.NoError(t, redemption.Insert())

	result, err := Redeem(redemption.Key, 1)
	require.NoError(t, err)
	require.NotNil(t, result)
	assert.Equal(t, 250000, result.Quota)
	require.NotNil(t, result.Subscription)
	assert.Equal(t, plan.Title, result.Subscription.SubscriptionPlanTitle)

	var user User
	require.NoError(t, DB.First(&user, "id = ?", 1).Error)
	assert.Equal(t, 251000, user.Quota)

	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ?", 1, plan.Id).Count(&count).Error)
	assert.EqualValues(t, 1, count)
}
