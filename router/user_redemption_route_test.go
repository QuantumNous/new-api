package router

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
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

// loginDashboardSession issues a dashboard access token through the same
// service the login handlers use, so route tests travel the real UserAuth
// credential path instead of forging request context.
func loginDashboardSession(t *testing.T, userID int) string {
	t.Helper()
	bundle, err := service.CreateLoginSession(userID, "password", "127.0.0.1", "router-test")
	require.NoError(t, err)
	return bundle.AccessToken
}

func TestUserRedeemRouteIsRegistered(t *testing.T) {
	gin.SetMode(gin.TestMode)
	engine := gin.New()
	SetApiRouter(engine)

	found := false
	for _, route := range engine.Routes() {
		if route.Method == "POST" && route.Path == "/api/user/redeem" {
			found = true
			assert.Contains(t, route.Handler, "controller.Redeem")
		}
	}
	assert.True(t, found)
}

func TestUserRedeemRouteAuthTypedDeliveryAndCriticalRateLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	originalDB, originalLogDB := model.DB, model.LOG_DB
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalRedisEnabled := common.RedisEnabled
	originalGlobalRateEnabled := common.GlobalApiRateLimitEnable
	originalCriticalEnabled := common.CriticalRateLimitEnable
	originalCriticalNum := common.CriticalRateLimitNum
	originalCriticalDuration := common.CriticalRateLimitDuration
	originalPaymentSetting := *operation_setting.GetPaymentSetting()
	originalAgentEnabled := operation_setting.GetAgentSetting().Enabled
	originalSessionSecret := common.SessionSecret

	dsn := "file:" + filepath.Join(t.TempDir(), "route-redemption.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(8)
	require.NoError(t, db.AutoMigrate(
		&model.User{}, &model.UserSession{}, &model.Log{}, &model.SubscriptionPlan{}, &model.UserSubscription{},
		&model.AgentAccount{}, &model.AgentPlanOffer{}, &model.AgentPurchaseOrder{}, &model.Redemption{},
	))
	model.DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Setenv("LOG_SQL_DSN", "")
	require.NoError(t, model.InitLogDB())
	common.RedisEnabled = false
	common.GlobalApiRateLimitEnable = false
	common.CriticalRateLimitEnable = true
	common.CriticalRateLimitNum = 2
	common.CriticalRateLimitDuration = 3600
	operation_setting.GetPaymentSetting().ComplianceConfirmed = true
	operation_setting.GetPaymentSetting().ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	operation_setting.GetAgentSetting().Enabled = false
	common.SessionSecret = "user-redemption-route-test-secret"
	t.Cleanup(func() {
		model.DB, model.LOG_DB = originalDB, originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.RedisEnabled = originalRedisEnabled
		common.GlobalApiRateLimitEnable = originalGlobalRateEnabled
		common.CriticalRateLimitEnable = originalCriticalEnabled
		common.CriticalRateLimitNum = originalCriticalNum
		common.CriticalRateLimitDuration = originalCriticalDuration
		*operation_setting.GetPaymentSetting() = originalPaymentSetting
		operation_setting.GetAgentSetting().Enabled = originalAgentEnabled
		common.SessionSecret = originalSessionSecret
		require.NoError(t, sqlDB.Close())
	})

	user := model.User{
		Id: 8201, Username: "route-redeem-user", AffCode: "route-redeem-aff",
		Status: common.UserStatusEnabled, Role: common.RoleCommonUser, Group: "starter",
		AuthVersion: 1,
	}
	require.NoError(t, db.Create(&user).Error)
	quotaCode := model.Redemption{
		Key: "61000000000000000000000000000001", Name: "zero-quota-route",
		Status: common.RedemptionCodeStatusEnabled, Type: common.RedemptionCodeTypeQuota, Quota: 1,
	}
	require.NoError(t, db.Create(&quotaCode).Error)
	require.NoError(t, db.Model(&quotaCode).UpdateColumn("quota", 0).Error)

	snapshot := model.SubscriptionEntitlementSnapshot{
		Version: model.SubscriptionEntitlementVersion1, PlanId: 9901, PlanTitle: "Route Snapshot Pro",
		DurationUnit: model.SubscriptionDurationCustom, CustomSeconds: 7200,
		UpgradeGroup: "pro", DowngradeGroup: "starter", TotalAmount: 9000,
		QuotaResetPeriod: model.SubscriptionResetNever,
	}
	rawSnapshot, err := model.EncodeSubscriptionEntitlementSnapshot(snapshot)
	require.NoError(t, err)
	order := model.AgentPurchaseOrder{
		OrderNo: "route-redemption-order", AgentUserId: 8301, PlanId: snapshot.PlanId,
		PlanTitle: snapshot.PlanTitle, Quantity: 1, UnitPrice: 6000, TotalPrice: 6000,
		CodeValidDays: 365, RefundFeeBps: 500, EntitlementSnapshot: rawSnapshot,
		IdempotencyKey: "route-redemption-order-key", Status: model.AgentPurchaseOrderStatusCompleted,
	}
	require.NoError(t, db.Create(&order).Error)
	require.NoError(t, db.Create(&model.AgentAccount{UserId: order.AgentUserId, Status: model.AgentAccountStatusDisabled}).Error)
	require.NoError(t, db.Create(&model.AgentPlanOffer{
		PlanId: snapshot.PlanId, Enabled: false, UnitPrice: 6000, CodeValidDays: 365, RefundFeeBps: 500,
	}).Error)
	packageCode := model.Redemption{
		UserId: order.AgentUserId, Key: "62000000000000000000000000000001",
		Status: common.RedemptionCodeStatusEnabled, Type: common.RedemptionCodeTypeSubscription,
		Name: snapshot.PlanTitle, AgentUserId: order.AgentUserId, AgentOrderId: order.Id,
		SubscriptionPlanId: snapshot.PlanId, ExpiredTime: common.GetTimestamp() + 3600,
	}
	require.NoError(t, db.Create(&packageCode).Error)

	engine := gin.New()
	SetApiRouter(engine)

	unauthorized := httptest.NewRecorder()
	unauthorizedRequest := httptest.NewRequest(http.MethodPost, "/api/user/redeem", strings.NewReader(`{"key":"missing"}`))
	unauthorizedRequest.Header.Set("Content-Type", "application/json")
	unauthorizedRequest.RemoteAddr = "203.0.113.201:12001"
	engine.ServeHTTP(unauthorized, unauthorizedRequest)
	assert.Equal(t, http.StatusUnauthorized, unauthorized.Code)

	accessToken := loginDashboardSession(t, user.Id)
	doRedeem := func(key string) *httptest.ResponseRecorder {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, "/api/user/redeem", strings.NewReader(`{"key":"`+key+`"}`))
		request.Header.Set("Content-Type", "application/json")
		request.Header.Set("Authorization", "Bearer "+accessToken)
		request.RemoteAddr = "203.0.113.202:12002"
		engine.ServeHTTP(recorder, request)
		return recorder
	}

	quotaResponse := doRedeem(quotaCode.Key)
	var quotaPayload struct {
		Success bool `json:"success"`
		Data    struct {
			Type  string `json:"type"`
			Quota *int   `json:"quota"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(quotaResponse.Body.Bytes(), &quotaPayload))
	require.True(t, quotaPayload.Success, quotaResponse.Body.String())
	assert.Equal(t, "quota", quotaPayload.Data.Type)
	require.NotNil(t, quotaPayload.Data.Quota)
	assert.Zero(t, *quotaPayload.Data.Quota)

	packageResponse := doRedeem(packageCode.Key)
	var packagePayload struct {
		Success bool `json:"success"`
		Data    struct {
			Type           string `json:"type"`
			SubscriptionID int    `json:"subscription_id"`
			PlanTitle      string `json:"plan_title"`
			EndTime        int64  `json:"end_time"`
		} `json:"data"`
	}
	require.NoError(t, common.Unmarshal(packageResponse.Body.Bytes(), &packagePayload))
	require.True(t, packagePayload.Success, packageResponse.Body.String())
	assert.Equal(t, "subscription", packagePayload.Data.Type)
	assert.NotZero(t, packagePayload.Data.SubscriptionID)
	assert.Equal(t, snapshot.PlanTitle, packagePayload.Data.PlanTitle)
	assert.Greater(t, packagePayload.Data.EndTime, common.GetTimestamp())
	assert.NotContains(t, packageResponse.Body.String(), `"quota"`)

	rateLimited := doRedeem("63000000000000000000000000000001")
	assert.Equal(t, http.StatusTooManyRequests, rateLimited.Code)
}
