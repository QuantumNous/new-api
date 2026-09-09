package router

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAgentCustomerRoutesEnforceOwnershipAndAllowDisabledReads(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB, originalLogDB := model.DB, model.LOG_DB
	originalMainDatabaseType, originalLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	originalRedisEnabled := common.RedisEnabled
	originalAgentEnabled := operation_setting.GetAgentSetting().Enabled
	originalSessionSecret := common.SessionSecret
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.UserSession{}, &model.AgentAccount{}, &model.SubscriptionPlan{},
		&model.UserSubscription{}, &model.Log{},
	))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.SessionSecret = "agent-customer-route-test-secret"
	operation_setting.GetAgentSetting().Enabled = true
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

	now := time.Now().Unix()
	users := []model.User{
		{Id: 101, Username: "route-agent", AffCode: "route-agent-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1},
		{Id: 102, Username: "route-disabled", AffCode: "route-disabled-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1},
		{Id: 103, Username: "route-customer", AffCode: "route-customer-aff", BoundAgentId: 101, BoundAt: now - 100, Email: "secret@example.com"},
		{Id: 104, Username: "route-other-customer", AffCode: "route-other-customer-aff", BoundAgentId: 102, BoundAt: now - 100},
	}
	require.NoError(t, db.Create(&users).Error)
	require.NoError(t, db.Create(&[]model.AgentAccount{
		{UserId: 101, Status: model.AgentAccountStatusActive},
		{UserId: 102, Status: model.AgentAccountStatusDisabled},
	}).Error)
	require.NoError(t, db.Create(&[]model.Log{
		{Id: 201, UserId: 103, Username: "route-customer", Type: model.LogTypeConsume, CreatedAt: now - 10, ModelName: "gpt-route", Quota: 30, Other: `{"admin_info":{"secret":"x"}}`},
		{Id: 202, UserId: 104, Username: "route-other-customer", Type: model.LogTypeConsume, CreatedAt: now - 5, ModelName: "gpt-route", Quota: 40},
	}).Error)

	engine := gin.New()
	SetApiRouter(engine)

	request := func(userID int, target string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, target, nil)
		req.Header.Set("Authorization", "Bearer "+loginDashboardSession(t, userID))
		engine.ServeHTTP(recorder, req)
		return recorder
	}

	customers := request(101, "/api/agent/customers?page_size=100")
	var customerResponse struct {
		Success bool `json:"success"`
		Data    struct {
			Total int `json:"total"`
			Items []struct {
				ID       int    `json:"id"`
				Username string `json:"username"`
			} `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(customers.Body.Bytes(), &customerResponse), customers.Body.String())
	require.True(t, customerResponse.Success, customers.Body.String())
	require.Len(t, customerResponse.Data.Items, 1)
	assert.Equal(t, 103, customerResponse.Data.Items[0].ID)
	assert.NotContains(t, customers.Body.String(), "secret@example.com")
	assert.NotContains(t, customers.Body.String(), "route-other-customer")

	logs := request(101, "/api/agent/logs?type=2&page_size=100")
	assert.Contains(t, logs.Body.String(), "route-customer")
	assert.NotContains(t, logs.Body.String(), "route-other-customer")
	assert.NotContains(t, logs.Body.String(), "admin_info")

	disabledCustomers := request(102, "/api/agent/customers?page_size=100")
	assert.Contains(t, disabledCustomers.Body.String(), "route-other-customer")
}
