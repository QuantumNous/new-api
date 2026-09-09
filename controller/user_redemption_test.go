package controller

import (
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupUserRedemptionControllerTest(t *testing.T) model.User {
	t.Helper()
	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	originalRedisEnabled := common.RedisEnabled
	originalPaymentSetting := *operation_setting.GetPaymentSetting()

	dsn := "file:" + filepath.Join(t.TempDir(), "controller-redemption.db") + "?_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)"
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Log{}, &model.Redemption{}, &model.AgentAccount{}))
	model.DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	t.Setenv("LOG_SQL_DSN", "")
	require.NoError(t, model.InitLogDB())
	common.RedisEnabled = false
	operation_setting.GetPaymentSetting().ComplianceConfirmed = true
	operation_setting.GetPaymentSetting().ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion

	user := model.User{
		Id: 8101, Username: "controller-redeem-user", AffCode: "controller-redeem-aff",
		Status: common.UserStatusEnabled, Role: common.RoleCommonUser,
	}
	require.NoError(t, model.DB.Create(&user).Error)
	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
		common.RedisEnabled = originalRedisEnabled
		*operation_setting.GetPaymentSetting() = originalPaymentSetting
		require.NoError(t, sqlDB.Close())
	})
	return user
}

func callRedeemController(t *testing.T, userID int, body string) map[string]interface{} {
	t.Helper()
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", userID)
	context.Request = httptest.NewRequest("POST", "/api/user/redeem", strings.NewReader(body))
	context.Request.Header.Set("Content-Type", "application/json")
	Redeem(context)
	var response map[string]interface{}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	return response
}

func TestRedeemReturnsTypedQuotaResult(t *testing.T) {
	gin.SetMode(gin.TestMode)
	user := setupUserRedemptionControllerTest(t)
	code := model.Redemption{
		Key: "51000000000000000000000000000001", Name: "controller-quota",
		Status: common.RedemptionCodeStatusEnabled, Type: common.RedemptionCodeTypeQuota, Quota: 500,
	}
	require.NoError(t, model.DB.Create(&code).Error)

	response := callRedeemController(t, user.Id, `{"key":"51000000000000000000000000000001"}`)
	assert.Equal(t, true, response["success"])
	data, ok := response["data"].(map[string]interface{})
	require.True(t, ok)
	assert.Equal(t, "quota", data["type"])
	assert.Equal(t, float64(500), data["quota"])
}

func TestLegacyTopUpStillCreditsQuota(t *testing.T) {
	gin.SetMode(gin.TestMode)
	user := setupUserRedemptionControllerTest(t)
	code := model.Redemption{
		Key: "51000000000000000000000000000002", Name: "controller-legacy-quota",
		Status: common.RedemptionCodeStatusEnabled, Type: common.RedemptionCodeTypeQuota, Quota: 700,
	}
	require.NoError(t, model.DB.Create(&code).Error)

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", user.Id)
	context.Request = httptest.NewRequest("POST", "/api/user/topup", strings.NewReader(`{"key":"51000000000000000000000000000002"}`))
	context.Request.Header.Set("Content-Type", "application/json")
	TopUp(context)

	var response map[string]interface{}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, true, response["success"])
	assert.Equal(t, float64(700), response["data"])
	var reloaded model.User
	require.NoError(t, model.DB.First(&reloaded, user.Id).Error)
	assert.Equal(t, 700, reloaded.Quota)
}

func TestLegacyTopUpBindsAgentCustomer(t *testing.T) {
	gin.SetMode(gin.TestMode)
	user := setupUserRedemptionControllerTest(t)
	agent := model.User{
		Id: 8102, Username: "controller-agent", AffCode: "controller-agent-aff",
		Status: common.UserStatusEnabled, Role: common.RoleCommonUser,
	}
	require.NoError(t, model.DB.Create(&agent).Error)
	require.NoError(t, model.DB.Create(&model.AgentAccount{UserId: agent.Id}).Error)
	code := model.Redemption{
		Key: "51000000000000000000000000000003", Name: "controller-agent-quota",
		Status: common.RedemptionCodeStatusEnabled, Type: common.RedemptionCodeTypeQuota,
		Quota: 700, AgentUserId: agent.Id,
	}
	require.NoError(t, model.DB.Create(&code).Error)

	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Set("id", user.Id)
	context.Request = httptest.NewRequest("POST", "/api/user/topup", strings.NewReader(`{"key":"51000000000000000000000000000003"}`))
	context.Request.Header.Set("Content-Type", "application/json")
	TopUp(context)

	var response map[string]interface{}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
	assert.Equal(t, true, response["success"])
	var reloaded model.User
	require.NoError(t, model.DB.First(&reloaded, user.Id).Error)
	assert.Equal(t, agent.Id, reloaded.BoundAgentId)
}

func TestRedeemReturnsSameFailureForUnavailableCodes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	user := setupUserRedemptionControllerTest(t)
	used := model.Redemption{
		Key: "52000000000000000000000000000001", Name: "controller-used",
		Status: common.RedemptionCodeStatusUsed, Type: common.RedemptionCodeTypeQuota, Quota: 500,
	}
	require.NoError(t, model.DB.Create(&used).Error)

	usedResponse := callRedeemController(t, user.Id, `{"key":"52000000000000000000000000000001"}`)
	missingResponse := callRedeemController(t, user.Id, `{"key":"52000000000000000000000000000002"}`)
	assert.Equal(t, false, usedResponse["success"])
	assert.Equal(t, false, missingResponse["success"])
	assert.NotEmpty(t, usedResponse["message"])
	assert.Equal(t, usedResponse["message"], missingResponse["message"])
}
