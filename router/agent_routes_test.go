package router

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAgentRoutesAuthenticateOwnerAndReturnStringMoney(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB, originalLogDB := model.DB, model.LOG_DB
	originalMainDatabaseType, originalLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	originalRedisEnabled := common.RedisEnabled
	originalAgentEnabled := operation_setting.GetAgentSetting().Enabled
	originalSessionSecret := common.SessionSecret
	common.RedisEnabled = false
	common.SessionSecret = "agent-route-test-secret"
	operation_setting.GetAgentSetting().Enabled = true
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.UserSession{}, &model.AgentAccount{}, &model.AgentCreditLog{},
		&model.SubscriptionPlan{}, &model.AgentPlanOffer{}, &model.AgentPurchaseOrder{},
		&model.Redemption{},
	))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Cleanup(func() {
		model.DB, model.LOG_DB = originalDB, originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.RedisEnabled = originalRedisEnabled
		common.SessionSecret = originalSessionSecret
		operation_setting.GetAgentSetting().Enabled = originalAgentEnabled
		sqlDB, sqlErr := db.DB()
		if sqlErr == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	require.NoError(t, db.Create(&model.User{
		Id: 51, Username: "agent-route", AffCode: "agent-route-aff",
		Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1,
	}).Error)
	require.NoError(t, db.Create(&model.AgentAccount{
		UserId: 51, Status: model.AgentAccountStatusActive,
		DailyCodeLimit: 200,
	}).Error)
	_, err = service.AdjustAgentCredit(service.AgentCreditAdjustment{
		AgentUserID: 51, OperatorUserID: 1, Amount: 100000,
		Direction: service.AgentCreditDirectionCredit, Reason: "test fixture funding",
		IdempotencyKey: "agent-route-fixture-funding",
	})
	require.NoError(t, err)
	plan := model.SubscriptionPlan{
		Title: "Route Plan", Currency: "CNY", Enabled: true,
		DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1,
	}
	require.NoError(t, db.Create(&plan).Error)
	require.NoError(t, db.Create(&model.AgentPlanOffer{
		PlanId: plan.Id, Enabled: true, UnitPrice: 6000,
		CodeValidDays: 365, RefundFeeBps: 500,
	}).Error)

	engine := gin.New()
	SetApiRouter(engine)

	unauthorized := httptest.NewRecorder()
	engine.ServeHTTP(unauthorized, httptest.NewRequest(http.MethodGet, "/api/agent/overview", nil))
	assert.NotEqual(t, http.StatusOK, unauthorized.Code)

	accessToken := loginDashboardSession(t, 51)

	doRequest := func(method string, path string, body string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(method, path, strings.NewReader(body))
		request.Header.Set("Authorization", "Bearer "+accessToken)
		if body != "" {
			request.Header.Set("Content-Type", "application/json")
		}
		engine.ServeHTTP(recorder, request)
		return recorder
	}

	overview := doRequest(http.MethodGet, "/api/agent/overview", "")
	var overviewResponse struct {
		Success bool `json:"success"`
		Data    struct {
			Balance          string `json:"balance"`
			DailyRemaining   int    `json:"daily_remaining"`
			NextDailyResetAt int64  `json:"next_daily_reset_at"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(overview.Body.Bytes(), &overviewResponse))
	require.True(t, overviewResponse.Success, overview.Body.String())
	assert.Equal(t, "1000.00", overviewResponse.Data.Balance)
	assert.Equal(t, 200, overviewResponse.Data.DailyRemaining)
	assert.NotContains(t, overview.Body.String(), `"balance":100000`)

	offers := doRequest(http.MethodGet, "/api/agent/offers", "")
	var offerResponse struct {
		Success bool `json:"success"`
		Data    []struct {
			UnitPrice string `json:"unit_price"`
			PlanId    int    `json:"plan_id"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(offers.Body.Bytes(), &offerResponse))
	require.True(t, offerResponse.Success, offers.Body.String())
	require.Len(t, offerResponse.Data, 1)
	assert.Equal(t, "60.00", offerResponse.Data[0].UnitPrice)
	assert.Equal(t, plan.Id, offerResponse.Data[0].PlanId)

	purchase := doRequest(http.MethodPost, "/api/agent/orders",
		`{"plan_id":`+strconv.Itoa(plan.Id)+`,"quantity":2,"idempotency_key":"route-buy"}`)
	var purchaseResponse struct {
		Success bool `json:"success"`
		Data    struct {
			BalanceAfter string `json:"balance_after"`
			Order        struct {
				UnitPrice  string `json:"unit_price"`
				TotalPrice string `json:"total_price"`
			} `json:"order"`
			Codes []struct {
				Key string `json:"key"`
			} `json:"codes"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(purchase.Body.Bytes(), &purchaseResponse))
	require.True(t, purchaseResponse.Success, purchase.Body.String())
	assert.Equal(t, "880.00", purchaseResponse.Data.BalanceAfter)
	assert.Equal(t, "60.00", purchaseResponse.Data.Order.UnitPrice)
	assert.Equal(t, "120.00", purchaseResponse.Data.Order.TotalPrice)
	require.Len(t, purchaseResponse.Data.Codes, 2)
	assert.Len(t, purchaseResponse.Data.Codes[0].Key, 32)
	assert.NotContains(t, purchase.Body.String(), `"total_price":12000`)
}
