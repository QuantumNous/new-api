package controller

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRedemptionControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldGinMode := gin.Mode()
	oldDB := model.DB
	oldLogDB := model.LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldUsingMySQL := common.UsingMySQL
	oldRedisEnabled := common.RedisEnabled
	var db *gorm.DB

	t.Cleanup(func() {
		gin.SetMode(oldGinMode)
		model.DB = oldDB
		model.LOG_DB = oldLogDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingPostgreSQL = oldUsingPostgreSQL
		common.UsingMySQL = oldUsingMySQL
		common.RedisEnabled = oldRedisEnabled

		if db == nil {
			return
		}
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	gin.SetMode(gin.TestMode)

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	var err error
	db, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.UsingPostgreSQL = false
	common.UsingMySQL = false
	common.RedisEnabled = false

	require.NoError(t, db.AutoMigrate(
		&model.User{},
		&model.Redemption{},
		&model.SubscriptionPlan{},
	))

	return db
}

func TestSetupRedemptionControllerTestDBRestoresGlobalsAfterCleanup(t *testing.T) {
	oldGinMode := gin.Mode()
	oldDB := model.DB
	oldLogDB := model.LOG_DB
	oldUsingSQLite := common.UsingSQLite
	oldUsingPostgreSQL := common.UsingPostgreSQL
	oldUsingMySQL := common.UsingMySQL
	oldRedisEnabled := common.RedisEnabled

	gin.SetMode(gin.ReleaseMode)
	common.UsingSQLite = false
	common.UsingPostgreSQL = true
	common.UsingMySQL = false
	common.RedisEnabled = true

	t.Cleanup(func() {
		gin.SetMode(oldGinMode)
		model.DB = oldDB
		model.LOG_DB = oldLogDB
		common.UsingSQLite = oldUsingSQLite
		common.UsingPostgreSQL = oldUsingPostgreSQL
		common.UsingMySQL = oldUsingMySQL
		common.RedisEnabled = oldRedisEnabled
	})

	t.Run("setup and cleanup", func(t *testing.T) {
		db := setupRedemptionControllerTestDB(t)
		require.NotNil(t, db)
		require.Equal(t, gin.TestMode, gin.Mode())
		require.True(t, common.UsingSQLite)
		require.False(t, common.UsingPostgreSQL)
		require.False(t, common.UsingMySQL)
		require.False(t, common.RedisEnabled)
	})

	require.Equal(t, gin.ReleaseMode, gin.Mode())
	require.Equal(t, oldDB, model.DB)
	require.Equal(t, oldLogDB, model.LOG_DB)
	require.False(t, common.UsingSQLite)
	require.True(t, common.UsingPostgreSQL)
	require.False(t, common.UsingMySQL)
	require.True(t, common.RedisEnabled)
}

func TestAddRedemptionUsesSubscriptionPlanTitleWhenNameBlank(t *testing.T) {
	db := setupRedemptionControllerTestDB(t)

	plan := &model.SubscriptionPlan{
		Id:            int(time.Now().UnixNano() % 1_000_000_000),
		Title:         "月卡套餐",
		PriceAmount:   9.9,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   5000,
	}
	require.NoError(t, db.Create(plan).Error)

	body := map[string]any{
		"name":                 "   ",
		"count":                1,
		"redemption_type":      model.RedemptionTypeSubscription,
		"subscription_plan_id": plan.Id,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/redemption", body, 1)

	AddRedemption(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	var keys []string
	require.NoError(t, common.Unmarshal(response.Data, &keys))
	require.Len(t, keys, 1)

	var redemption model.Redemption
	require.NoError(t, db.First(&redemption, "key = ?", keys[0]).Error)
	require.Equal(t, plan.Title, redemption.Name)
	require.Equal(t, model.RedemptionTypeSubscription, redemption.RedemptionType)
	require.Equal(t, plan.Id, redemption.SubscriptionPlanId)
}

func TestAddRedemptionRejectsDisabledSubscriptionPlan(t *testing.T) {
	db := setupRedemptionControllerTestDB(t)

	plan := &model.SubscriptionPlan{
		Id:            int(time.Now().UnixNano()%1_000_000_000) + 1,
		Title:         "已禁用套餐",
		PriceAmount:   9.9,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   5000,
	}
	require.NoError(t, db.Create(plan).Error)
	require.NoError(t, db.Model(plan).Update("enabled", false).Error)

	body := map[string]any{
		"name":                 "禁用套餐兑换码",
		"count":                1,
		"redemption_type":      model.RedemptionTypeSubscription,
		"subscription_plan_id": plan.Id,
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/redemption", body, 1)

	AddRedemption(ctx)

	response := decodeAPIResponse(t, recorder)
	require.False(t, response.Success)
	require.Equal(t, "套餐未启用", response.Message)

	var count int64
	require.NoError(t, db.Model(&model.Redemption{}).Count(&count).Error)
	require.Zero(t, count)
}
