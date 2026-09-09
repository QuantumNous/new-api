package router

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
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

func TestAgentRefundRoutesEnforceOwnerRootAuditReconciliationAndCriticalRateLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB, originalLogDB := model.DB, model.LOG_DB
	originalMainDatabaseType, originalLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()
	originalRedisEnabled := common.RedisEnabled
	originalSessionSecret := common.SessionSecret
	originalGlobalRateEnabled := common.GlobalApiRateLimitEnable
	originalCriticalEnabled := common.CriticalRateLimitEnable
	originalCriticalNum := common.CriticalRateLimitNum
	originalCriticalDuration := common.CriticalRateLimitDuration
	originalAgentEnabled := operation_setting.GetAgentSetting().Enabled
	dsn := "file:" + filepath.Join(t.TempDir(), "agent-refund-routes.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(8)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.UserSession{}, &model.Log{}, &model.AuditLog{},
		&model.AgentAccount{}, &model.AgentCreditLog{},
		&model.AgentPurchaseOrder{}, &model.AgentRefundRequest{}, &model.Redemption{},
	))
	model.DB, model.LOG_DB = db, db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.SessionSecret = "agent-refund-route-test-secret"
	common.GlobalApiRateLimitEnable = false
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 1
	common.CriticalRateLimitDuration = 3600
	operation_setting.GetAgentSetting().Enabled = true
	t.Cleanup(func() {
		model.DB, model.LOG_DB = originalDB, originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.RedisEnabled = originalRedisEnabled
		common.SessionSecret = originalSessionSecret
		common.GlobalApiRateLimitEnable = originalGlobalRateEnabled
		common.CriticalRateLimitEnable = originalCriticalEnabled
		common.CriticalRateLimitNum = originalCriticalNum
		common.CriticalRateLimitDuration = originalCriticalDuration
		operation_setting.GetAgentSetting().Enabled = originalAgentEnabled
		require.NoError(t, sqlDB.Close())
	})

	users := []model.User{
		{Id: 9501, Username: "refund-route-agent", AffCode: "refund-route-agent-aff", Role: common.RoleCommonUser, Status: common.UserStatusEnabled, AuthVersion: 1},
		{Id: 9502, Username: "refund-route-admin", AffCode: "refund-route-admin-aff", Role: common.RoleAdminUser, Status: common.UserStatusEnabled, AuthVersion: 1},
		{Id: 9503, Username: "refund-route-root", AffCode: "refund-route-root-aff", Role: common.RoleRootUser, Status: common.UserStatusEnabled, AuthVersion: 1},
	}
	require.NoError(t, db.Create(&users).Error)
	require.NoError(t, db.Create(&model.AgentAccount{UserId: users[0].Id, Status: model.AgentAccountStatusActive, Balance: 0}).Error)
	snapshot, err := model.EncodeSubscriptionEntitlementSnapshot(model.SubscriptionEntitlementSnapshot{
		Version: model.SubscriptionEntitlementVersion1, PlanId: 31, PlanTitle: "Refund Route Plan",
		DurationUnit: model.SubscriptionDurationCustom, CustomSeconds: 3600,
		QuotaResetPeriod: model.SubscriptionResetNever,
	})
	require.NoError(t, err)
	order := model.AgentPurchaseOrder{
		OrderNo: "refund-route-order", AgentUserId: users[0].Id, PlanId: 31, PlanTitle: "Refund Route Plan",
		Quantity: 2, UnitPrice: 6000, TotalPrice: 12000, CodeValidDays: 365, RefundFeeBps: 500,
		EntitlementSnapshot: snapshot, IdempotencyKey: "refund-route-purchase", Status: model.AgentPurchaseOrderStatusCompleted,
	}
	require.NoError(t, db.Create(&order).Error)
	codes := []model.Redemption{
		{UserId: users[0].Id, AgentUserId: users[0].Id, AgentOrderId: order.Id, SubscriptionPlanId: order.PlanId, Type: common.RedemptionCodeTypeSubscription, Key: "self-refund-route-secret", Name: order.PlanTitle, Status: common.RedemptionCodeStatusEnabled, ExpiredTime: time.Now().Unix() + 3600},
		{UserId: users[0].Id, AgentUserId: users[0].Id, AgentOrderId: order.Id, SubscriptionPlanId: order.PlanId, Type: common.RedemptionCodeTypeSubscription, Key: "root-refund-route-secret", Name: order.PlanTitle, Status: common.RedemptionCodeStatusEnabled, ExpiredTime: time.Now().Unix() + 3600},
	}
	require.NoError(t, db.Create(&codes).Error)

	engine := gin.New()
	SetApiRouter(engine)

	request := func(accessToken string, method string, target string, body string, remote string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(method, target, strings.NewReader(body))
		if accessToken != "" {
			req.Header.Set("Authorization", "Bearer "+accessToken)
		}
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = remote
		engine.ServeHTTP(recorder, req)
		return recorder
	}

	unauthorized := request("", http.MethodPost, "/api/agent/codes/refund", `{}`, "203.0.113.10:1000")
	assert.Equal(t, http.StatusUnauthorized, unauthorized.Code)

	agentToken := loginDashboardSession(t, users[0].Id)
	self := request(agentToken, http.MethodPost, "/api/agent/codes/refund",
		`{"agent_user_id":9999,"redemption_ids":[`+strconv.Itoa(codes[0].Id)+`],"idempotency_key":"route-self-refund"}`,
		"203.0.113.11:1001")
	var selfPayload struct {
		Success bool `json:"success"`
		Data    struct {
			RedemptionIDs []int  `json:"redemption_ids"`
			Fee           string `json:"fee"`
			Refunded      string `json:"refunded"`
			BalanceAfter  string `json:"balance_after"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(self.Body.Bytes(), &selfPayload), self.Body.String())
	require.True(t, selfPayload.Success, self.Body.String())
	assert.Equal(t, []int{codes[0].Id}, selfPayload.Data.RedemptionIDs)
	assert.Equal(t, "3.00", selfPayload.Data.Fee)
	assert.Equal(t, "57.00", selfPayload.Data.Refunded)
	assert.Equal(t, "57.00", selfPayload.Data.BalanceAfter)

	rateLimited := request(agentToken, http.MethodPost, "/api/agent/codes/refund",
		`{"redemption_ids":[`+strconv.Itoa(codes[1].Id)+`],"idempotency_key":"route-rate-limit"}`,
		"203.0.113.11:1001")
	assert.Equal(t, http.StatusTooManyRequests, rateLimited.Code)

	adminToken := loginDashboardSession(t, users[1].Id)
	adminMutation := request(adminToken, http.MethodPost, "/api/agent-admin/codes/refund",
		`{"agent_user_id":`+strconv.Itoa(users[0].Id)+`,"redemption_ids":[`+strconv.Itoa(codes[1].Id)+`],"idempotency_key":"admin-denied"}`,
		"203.0.113.12:1002")
	var denied struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(adminMutation.Body.Bytes(), &denied), adminMutation.Body.String())
	assert.False(t, denied.Success)

	require.NoError(t, db.Model(&model.AgentAccount{}).Where("user_id = ?", users[0].Id).Update("status", model.AgentAccountStatusDisabled).Error)
	operation_setting.GetAgentSetting().Enabled = false
	rootToken := loginDashboardSession(t, users[2].Id)
	root := request(rootToken, http.MethodPost, "/api/agent-admin/codes/refund",
		`{"agent_user_id":`+strconv.Itoa(users[0].Id)+`,"redemption_ids":[`+strconv.Itoa(codes[1].Id)+`],"idempotency_key":"route-root-refund"}`,
		"203.0.113.13:1003")
	var rootPayload struct {
		Success bool `json:"success"`
		Data    struct {
			Refunded string `json:"refunded"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(root.Body.Bytes(), &rootPayload), root.Body.String())
	require.True(t, rootPayload.Success, root.Body.String())
	assert.Equal(t, "57.00", rootPayload.Data.Refunded)

	reconciliation := request(adminToken, http.MethodGet,
		"/api/agent-admin/agents/"+strconv.Itoa(users[0].Id)+"/reconciliation", "", "203.0.113.14:1004")
	var reconciliationPayload struct {
		Success bool `json:"success"`
		Data    struct {
			Balance    string `json:"balance"`
			LedgerSum  string `json:"ledger_sum"`
			Difference string `json:"difference"`
			Matches    bool   `json:"matches"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(reconciliation.Body.Bytes(), &reconciliationPayload), reconciliation.Body.String())
	require.True(t, reconciliationPayload.Success, reconciliation.Body.String())
	assert.Equal(t, "114.00", reconciliationPayload.Data.Balance)
	assert.Equal(t, "114.00", reconciliationPayload.Data.LedgerSum)
	assert.Equal(t, "0.00", reconciliationPayload.Data.Difference)
	assert.True(t, reconciliationPayload.Data.Matches)

	var audit model.AuditLog
	require.NoError(t, db.Where("user_id = ? AND category = ?", users[2].Id, model.AuditCategoryOperation).Last(&audit).Error)
	auditOther, err := common.Marshal(audit.Other)
	require.NoError(t, err)
	assert.Contains(t, string(auditOther), `"action":"agent.refund"`)
	assert.Contains(t, string(auditOther), `"agent_user_id":`+strconv.Itoa(users[0].Id))
	assert.Contains(t, string(auditOther), `"redemption_ids":[`+strconv.Itoa(codes[1].Id)+`]`)
	assert.Contains(t, string(auditOther), `"fee":"3.00"`)
	assert.Contains(t, string(auditOther), `"refunded":"57.00"`)
	assert.Contains(t, string(auditOther), `"idempotency_key":"route-root-refund"`)
	assert.NotContains(t, string(auditOther), codes[1].Key)
}
