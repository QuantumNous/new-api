package router

import (
	"encoding/csv"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestAgentQueryRoutesEnforceIdentityFeatureMaskingCSVAndAdminAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB, originalLogDB := model.DB, model.LOG_DB
	originalMainDatabaseType, originalLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	originalRedisEnabled := common.RedisEnabled
	originalAgentEnabled := operation_setting.GetAgentSetting().Enabled
	originalSessionSecret := common.SessionSecret
	common.RedisEnabled = false
	common.SessionSecret = "agent-query-route-test-secret"
	operation_setting.GetAgentSetting().Enabled = true
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.UserSession{}, &model.Log{}, &model.AuditLog{},
		&model.AgentAccount{}, &model.AgentCreditLog{},
		&model.SubscriptionPlan{}, &model.AgentPurchaseOrder{}, &model.Redemption{},
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

	users := []model.User{
		{Id: 71, Username: "query-owner", AffCode: "query-owner-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1},
		{Id: 72, Username: "query-other", AffCode: "query-other-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1},
		{Id: 73, Username: "query-disabled", AffCode: "query-disabled-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1},
		{Id: 74, Username: "query-non-agent", AffCode: "query-non-agent-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1},
		{Id: 75, Username: "query-admin", AffCode: "query-admin-aff", Role: common.RoleAdminUser, Status: common.UserStatusEnabled, AuthVersion: 1},
	}
	require.NoError(t, db.Create(&users).Error)
	require.NoError(t, db.Create(&[]model.AgentAccount{
		{UserId: 71, Status: model.AgentAccountStatusActive},
		{UserId: 72, Status: model.AgentAccountStatusActive},
		{UserId: 73, Status: model.AgentAccountStatusDisabled},
	}).Error)
	plan := model.SubscriptionPlan{Title: "查询套餐", Enabled: true}
	require.NoError(t, db.Create(&plan).Error)
	now := time.Now().Unix()
	orders := []model.AgentPurchaseOrder{
		{OrderNo: "owner-order", AgentUserId: 71, PlanId: plan.Id, PlanTitle: plan.Title, Quantity: 1, UnitPrice: 6000, TotalPrice: 6000, CodeValidDays: 365, RefundFeeBps: 500, EntitlementSnapshot: "{}", IdempotencyKey: "owner-order-key", Status: model.AgentPurchaseOrderStatusCompleted, CreatedAt: now - 30},
		{OrderNo: "other-order", AgentUserId: 72, PlanId: plan.Id, PlanTitle: plan.Title, Quantity: 1, UnitPrice: 7000, TotalPrice: 7000, CodeValidDays: 365, RefundFeeBps: 500, EntitlementSnapshot: "{}", IdempotencyKey: "other-order-key", Status: model.AgentPurchaseOrderStatusCompleted, CreatedAt: now - 20},
		{OrderNo: "disabled-order", AgentUserId: 73, PlanId: plan.Id, PlanTitle: plan.Title, Quantity: 2, UnitPrice: 8000, TotalPrice: 16000, CodeValidDays: 365, RefundFeeBps: 500, EntitlementSnapshot: "{}", IdempotencyKey: "disabled-order-key", Status: model.AgentPurchaseOrderStatusCompleted, CreatedAt: now - 10},
	}
	require.NoError(t, db.Create(&orders).Error)
	codes := []model.Redemption{
		{UserId: 71, AgentUserId: 71, AgentOrderId: orders[0].Id, SubscriptionPlanId: plan.Id, Type: common.RedemptionCodeTypeSubscription, Key: "owner-secret", Name: plan.Title, Status: common.RedemptionCodeStatusEnabled, CreatedTime: now - 30, ExpiredTime: now + 3600},
		{UserId: 72, AgentUserId: 72, AgentOrderId: orders[1].Id, SubscriptionPlanId: plan.Id, Type: common.RedemptionCodeTypeSubscription, Key: "other-secret", Name: plan.Title, Status: common.RedemptionCodeStatusEnabled, CreatedTime: now - 20, ExpiredTime: now + 3600},
		{UserId: 73, AgentUserId: 73, AgentOrderId: orders[2].Id, SubscriptionPlanId: plan.Id, Type: common.RedemptionCodeTypeSubscription, Key: "disabled-fresh-secret", Name: plan.Title, Status: common.RedemptionCodeStatusEnabled, CreatedTime: now - 10, ExpiredTime: now + 3600},
		{UserId: 73, AgentUserId: 73, AgentOrderId: orders[2].Id, SubscriptionPlanId: plan.Id, Type: common.RedemptionCodeTypeSubscription, Key: "disabled-used-history", Name: plan.Title, Status: common.RedemptionCodeStatusUsed, CreatedTime: now - 9, ExpiredTime: now + 3600, RedeemedTime: now - 1, UsedUserId: 74},
	}
	require.NoError(t, db.Create(&codes).Error)
	require.NoError(t, db.Create(&[]model.AgentCreditLog{
		{AgentUserId: 71, Delta: -6000, BalanceBefore: 10000, BalanceAfter: 4000, EventType: model.AgentCreditEventPurchase, BusinessKey: "route-owner-ledger", OrderId: orders[0].Id},
		{AgentUserId: 72, Delta: -7000, BalanceBefore: 10000, BalanceAfter: 3000, EventType: model.AgentCreditEventPurchase, BusinessKey: "route-other-ledger", OrderId: orders[1].Id},
	}).Error)

	engine := gin.New()
	SetApiRouter(engine)

	request := func(accessToken string, target string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, target, nil)
		req.Header.Set("Authorization", "Bearer "+accessToken)
		engine.ServeHTTP(recorder, req)
		return recorder
	}
	type apiResult struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	assertAPIFailure := func(recorder *httptest.ResponseRecorder) {
		var response apiResult
		require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response), recorder.Body.String())
		assert.False(t, response.Success, recorder.Body.String())
	}

	ownerToken := loginDashboardSession(t, 71)
	ownerCodes := request(ownerToken, "/api/agent/codes?agent_user_id=72")
	var ownerResponse struct {
		Success bool `json:"success"`
		Data    struct {
			Total int `json:"total"`
			Items []struct {
				Code        string `json:"code"`
				AgentUserID int    `json:"agent_user_id"`
				CodeVisible bool   `json:"code_visible"`
			} `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(ownerCodes.Body.Bytes(), &ownerResponse))
	require.True(t, ownerResponse.Success, ownerCodes.Body.String())
	require.Len(t, ownerResponse.Data.Items, 1)
	assert.Equal(t, 71, ownerResponse.Data.Items[0].AgentUserID)
	assert.Equal(t, "owner-secret", ownerResponse.Data.Items[0].Code)
	assert.True(t, ownerResponse.Data.Items[0].CodeVisible)
	assert.NotContains(t, ownerCodes.Body.String(), "other-secret")

	forgedIdentity := request(ownerToken+"tampered", "/api/agent/codes")
	assert.Equal(t, http.StatusUnauthorized, forgedIdentity.Code)

	for _, target := range []string{
		"/api/agent/orders?p=0",
		"/api/agent/codes?plan_id=0",
		"/api/agent/codes?order_id=-1",
		"/api/agent/codes?start_timestamp=-1",
		"/api/agent/codes?start_timestamp=20&end_timestamp=10",
		"/api/agent/codes?status=invalid",
	} {
		assertAPIFailure(request(ownerToken, target))
	}

	nonAgentToken := loginDashboardSession(t, 74)
	assertAPIFailure(request(nonAgentToken, "/api/agent/codes"))
	assertAPIFailure(request(nonAgentToken, "/api/agent-admin/codes"))

	disabledToken := loginDashboardSession(t, 73)
	disabledCodes := request(disabledToken, "/api/agent/codes?page_size=100")
	var disabledResponse struct {
		Success bool `json:"success"`
		Data    struct {
			Items []struct {
				Code        string `json:"code"`
				Status      string `json:"status"`
				CodeVisible bool   `json:"code_visible"`
			} `json:"items"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(disabledCodes.Body.Bytes(), &disabledResponse))
	require.True(t, disabledResponse.Success, disabledCodes.Body.String())
	require.Len(t, disabledResponse.Data.Items, 2)
	assert.NotContains(t, disabledCodes.Body.String(), "disabled-fresh-secret")
	for _, item := range disabledResponse.Data.Items {
		if item.Status == "unused" {
			assert.Empty(t, item.Code)
			assert.False(t, item.CodeVisible)
		}
	}
	assertAPIFailure(request(disabledToken, "/api/agent/codes/export"))

	export := request(ownerToken, "/api/agent/codes/export")
	assert.Equal(t, "text/csv; charset=utf-8", export.Header().Get("Content-Type"))
	assert.Regexp(t, `^attachment; filename="agent-codes-[0-9]{8}-[0-9]{6}\.csv"$`, export.Header().Get("Content-Disposition"))
	assert.Equal(t, "no-store", export.Header().Get("Cache-Control"))
	records, err := csv.NewReader(strings.NewReader(export.Body.String())).ReadAll()
	require.NoError(t, err)
	require.Len(t, records, 2)
	assert.Equal(t, []string{"code", "plan", "order_no", "status", "created_at", "expired_at", "redeemed_at"}, records[0])
	assert.Equal(t, "owner-secret", records[1][0])
	assert.Len(t, records[1], 7)
	assert.NotContains(t, export.Body.String(), "other-secret")

	operation_setting.GetAgentSetting().Enabled = false
	for _, target := range []string{
		"/api/agent/orders", "/api/agent/codes", "/api/agent/codes/export", "/api/agent/credit-logs",
	} {
		assertAPIFailure(request(ownerToken, target))
	}
	adminToken := loginDashboardSession(t, 75)
	adminCodes := request(adminToken, "/api/agent-admin/codes?agent_user_id=71")
	var adminResponse apiResult
	require.NoError(t, common.Unmarshal(adminCodes.Body.Bytes(), &adminResponse))
	assert.True(t, adminResponse.Success, adminCodes.Body.String())
}
