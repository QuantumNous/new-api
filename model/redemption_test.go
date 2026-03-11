package model

import (
	"bytes"
	"errors"
	"io"
	"path/filepath"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRedemptionTestDB(t *testing.T) func() {
	t.Helper()

	oldDB := DB
	oldLogDB := LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldUsingMySQL := common.UsingMySQL
	oldRedisEnabled := common.RedisEnabled

	testDB, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "redemption-test.db")), &gorm.Config{})
	require.NoError(t, err)

	DB = testDB
	LOG_DB = testDB
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	common.RedisEnabled = false
	initCol()

	subscriptionPlanCacheOnce = sync.Once{}
	subscriptionPlanInfoCacheOnce = sync.Once{}
	subscriptionPlanCache = nil
	subscriptionPlanInfoCache = nil

	require.NoError(t, DB.AutoMigrate(
		&User{},
		&Log{},
		&Redemption{},
		&UserSubscription{},
	))
	require.NoError(t, ensureSubscriptionPlanTableSQLite())

	return func() {
		DB = oldDB
		LOG_DB = oldLogDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingPostgreSQL = oldUsingPostgreSQL
		common.UsingMySQL = oldUsingMySQL
		common.RedisEnabled = oldRedisEnabled
		initCol()
		subscriptionPlanCacheOnce = sync.Once{}
		subscriptionPlanInfoCacheOnce = sync.Once{}
		subscriptionPlanCache = nil
		subscriptionPlanInfoCache = nil
	}
}

func createRedemptionTestUser(t *testing.T, quota int) *User {
	t.Helper()

	user := &User{
		Username: "redeem-user",
		Password: "password123",
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Quota:    quota,
	}
	require.NoError(t, DB.Create(user).Error)
	return user
}

func TestRedeemQuotaCodeAddsQuotaAndMarksUsed(t *testing.T) {
	cleanup := setupRedemptionTestDB(t)
	defer cleanup()

	user := createRedemptionTestUser(t, 100)
	redemption := &Redemption{
		Name:        "quota-code",
		Key:         "quota-code-key",
		Status:      common.RedemptionCodeStatusEnabled,
		Quota:       50,
		CreatedTime: common.GetTimestamp(),
	}
	require.NoError(t, DB.Create(redemption).Error)

	result, err := Redeem(redemption.Key, user.Id)
	require.NoError(t, err)
	require.Equal(t, RedemptionTypeQuota, result.RedemptionType)
	require.Equal(t, 50, result.Quota)
	require.Nil(t, result.Subscription)

	var updatedUser User
	require.NoError(t, DB.First(&updatedUser, "id = ?", user.Id).Error)
	require.Equal(t, 150, updatedUser.Quota)

	var updatedRedemption Redemption
	require.NoError(t, DB.First(&updatedRedemption, "id = ?", redemption.Id).Error)
	require.Equal(t, common.RedemptionCodeStatusUsed, updatedRedemption.Status)
	require.Equal(t, user.Id, updatedRedemption.UsedUserId)
	require.NotZero(t, updatedRedemption.RedeemedTime)
}

func TestRedeemSubscriptionCodeCreatesSubscriptionAndMarksUsed(t *testing.T) {
	cleanup := setupRedemptionTestDB(t)
	defer cleanup()

	user := createRedemptionTestUser(t, 200)
	plan := &SubscriptionPlan{
		Title:         "月度订阅",
		PriceAmount:   9.9,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   5000,
	}
	require.NoError(t, DB.Create(plan).Error)

	redemption := &Redemption{
		Name:               "subscription-code",
		Key:                "subscription-code-key",
		Status:             common.RedemptionCodeStatusEnabled,
		Quota:              0,
		CreatedTime:        common.GetTimestamp(),
		RedemptionType:     RedemptionTypeSubscription,
		SubscriptionPlanId: plan.Id,
	}
	require.NoError(t, DB.Create(redemption).Error)

	result, err := Redeem(redemption.Key, user.Id)
	require.NoError(t, err)
	require.Equal(t, RedemptionTypeSubscription, result.RedemptionType)
	require.Equal(t, plan.Id, result.SubscriptionPlan.PlanId)
	require.NotNil(t, result.Subscription)
	require.Equal(t, "active", result.Subscription.Status)
	require.EqualValues(t, plan.TotalAmount, result.Subscription.AmountTotal)
	require.Greater(t, result.Subscription.EndTime, result.Subscription.StartTime)

	var subs []UserSubscription
	require.NoError(t, DB.Where("user_id = ?", user.Id).Find(&subs).Error)
	require.Len(t, subs, 1)
	require.Equal(t, "redemption", subs[0].Source)
	require.Equal(t, plan.Id, subs[0].PlanId)

	var updatedRedemption Redemption
	require.NoError(t, DB.First(&updatedRedemption, "id = ?", redemption.Id).Error)
	require.Equal(t, common.RedemptionCodeStatusUsed, updatedRedemption.Status)
	require.Equal(t, user.Id, updatedRedemption.UsedUserId)
	require.NotZero(t, updatedRedemption.RedeemedTime)

	var updatedUser User
	require.NoError(t, DB.First(&updatedUser, "id = ?", user.Id).Error)
	require.Equal(t, 200, updatedUser.Quota)
}

func TestSyncRedemptionUserGroupCacheInvalidatesOnUpdateFailure(t *testing.T) {
	oldUpdater := redemptionUserGroupCacheUpdater
	oldInvalidator := redemptionUserCacheInvalidator
	oldWriter := gin.DefaultWriter

	var logBuffer bytes.Buffer
	gin.DefaultWriter = io.MultiWriter(&logBuffer)

	t.Cleanup(func() {
		redemptionUserGroupCacheUpdater = oldUpdater
		redemptionUserCacheInvalidator = oldInvalidator
		gin.DefaultWriter = oldWriter
	})

	redemptionUserGroupCacheUpdater = func(userId int, group string) error {
		require.Equal(t, 123, userId)
		require.Equal(t, "vip", group)
		return errors.New("cache boom")
	}

	invalidatedUserID := 0
	redemptionUserCacheInvalidator = func(userId int) error {
		invalidatedUserID = userId
		return nil
	}

	syncRedemptionUserGroupCache(123, "vip", 456, 789)

	require.Equal(t, 123, invalidatedUserID)
	require.Contains(t, logBuffer.String(), "failed to update redemption user group cache")
	require.Contains(t, logBuffer.String(), "userId=123")
	require.Contains(t, logBuffer.String(), "redemptionId=456")
	require.Contains(t, logBuffer.String(), "subscriptionId=789")
}
