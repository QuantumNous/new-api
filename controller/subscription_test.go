package controller

import (
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupSubscriptionControllerTestDB(t *testing.T) *gorm.DB {
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

	require.NoError(t, db.AutoMigrate(&model.SubscriptionPlan{}))

	return db
}

func TestAdminCreateSubscriptionPlanStoresPurchaseLink(t *testing.T) {
	db := setupSubscriptionControllerTestDB(t)

	body := map[string]any{
		"plan": map[string]any{
			"title":          "外部购买套餐",
			"price_amount":   9.9,
			"duration_unit":  model.SubscriptionDurationMonth,
			"duration_value": 1,
			"enabled":        true,
			"purchase_link":  " https://billing.example.com/plan/basic?src=new-api ",
		},
	}
	ctx, recorder := newAuthenticatedContext(t, http.MethodPost, "/api/subscription/admin/plans", body, 1)

	AdminCreateSubscriptionPlan(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	var created model.SubscriptionPlan
	require.NoError(t, db.First(&created).Error)
	require.Equal(t, "https://billing.example.com/plan/basic?src=new-api", created.PurchaseLink)
}

func TestAdminUpdateSubscriptionPlanClearsPurchaseLink(t *testing.T) {
	db := setupSubscriptionControllerTestDB(t)

	plan := &model.SubscriptionPlan{
		Title:         "清空购买链接套餐",
		PriceAmount:   19.9,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		PurchaseLink:  "https://billing.example.com/legacy-link",
	}
	require.NoError(t, db.Create(plan).Error)

	body := map[string]any{
		"plan": map[string]any{
			"title":          plan.Title,
			"price_amount":   plan.PriceAmount,
			"duration_unit":  plan.DurationUnit,
			"duration_value": plan.DurationValue,
			"enabled":        plan.Enabled,
			"purchase_link":  "",
		},
	}
	target := fmt.Sprintf("/api/subscription/admin/plans/%d", plan.Id)
	ctx, recorder := newAuthenticatedContext(t, http.MethodPut, target, body, 1)
	ctx.Params = gin.Params{{Key: "id", Value: fmt.Sprintf("%d", plan.Id)}}

	AdminUpdateSubscriptionPlan(ctx)

	response := decodeAPIResponse(t, recorder)
	require.True(t, response.Success, "expected success response, got message: %s", response.Message)

	var updated model.SubscriptionPlan
	require.NoError(t, db.First(&updated, plan.Id).Error)
	require.Empty(t, updated.PurchaseLink)
}
