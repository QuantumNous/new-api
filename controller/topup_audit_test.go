package controller

import (
	"bytes"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func performRedemptionTopupRequest(t *testing.T, userID int, key string) bool {
	t.Helper()
	body, err := common.Marshal(map[string]string{"key": key})
	require.NoError(t, err)
	response := httptest.NewRecorder()
	c, engine := gin.CreateTestContext(response)
	require.NoError(t, engine.SetTrustedProxies(nil))
	c.Request = httptest.NewRequest(http.MethodPost, "/api/user/topup", bytes.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Request.RemoteAddr = "203.0.113.17:12345"
	c.Set("id", userID)
	TopUp(c)
	require.Equal(t, http.StatusOK, response.Code)
	var result struct {
		Success bool `json:"success"`
	}
	require.NoError(t, common.Unmarshal(response.Body.Bytes(), &result))
	return result.Success
}

func TestRedemptionTopupAudit(t *testing.T) {
	gin.SetMode(gin.TestMode)
	previousPayment := *operation_setting.GetPaymentSetting()
	previousNode, previousVersion := common.NodeName, common.Version
	operation_setting.GetPaymentSetting().ComplianceConfirmed = true
	operation_setting.GetPaymentSetting().ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	common.NodeName, common.Version = "redemption-test-node", "redemption-test-version"
	t.Cleanup(func() {
		*operation_setting.GetPaymentSetting() = previousPayment
		common.NodeName, common.Version = previousNode, previousVersion
	})

	for _, separateLogDB := range []string{"0", "1"} {
		t.Run("separate_log_db_"+separateLogDB, func(t *testing.T) {
			t.Setenv("TEST_MANAGE_USER_SEPARATE_LOG_DB", separateLogDB)
			for _, tc := range []struct {
				name        string
				status      int
				expiredTime int64
				quota       int
				success     bool
			}{
				{name: "success", status: common.RedemptionCodeStatusEnabled, success: true},
				{name: "already used", status: common.RedemptionCodeStatusUsed},
				{name: "expired", status: common.RedemptionCodeStatusEnabled, expiredTime: common.GetTimestamp() - 60},
				{name: "wallet overflow", status: common.RedemptionCodeStatusEnabled, quota: common.MaxWalletQuota - 10},
			} {
				t.Run(tc.name, func(t *testing.T) {
					db := setupManageUserTestDB(t)
					require.NoError(t, db.AutoMigrate(&model.Redemption{}))
					user := model.User{Username: "redeem-audit-user", Status: common.UserStatusEnabled, Quota: tc.quota}
					require.NoError(t, db.Create(&user).Error)
					code := model.Redemption{Name: "audit-test", Key: "12345678901234567890123456789012", Status: tc.status, Quota: 500, ExpiredTime: tc.expiredTime}
					require.NoError(t, db.Create(&code).Error)

					require.Equal(t, tc.success, performRedemptionTopupRequest(t, user.Id, code.Key))
					var logs []*model.Log
					require.NoError(t, model.LOG_DB.Where("user_id = ? AND type = ?", user.Id, model.LogTypeTopup).Find(&logs).Error)
					var storedUser model.User
					require.NoError(t, db.First(&storedUser, user.Id).Error)
					if !tc.success {
						assert.Empty(t, logs, "failed redemption must not record a successful top-up")
						assert.Equal(t, tc.quota, storedUser.Quota)
						return
					}

					require.Len(t, logs, 1)
					assert.Equal(t, tc.quota+500, storedUser.Quota)
					assert.Equal(t, "203.0.113.17", logs[0].Ip)
					assert.NotContains(t, logs[0].Content+logs[0].Other, code.Key)
					model.FormatAdminLogs(logs)
					var other map[string]any
					require.NoError(t, common.UnmarshalJsonStr(logs[0].Other, &other))
					admin, ok := other["admin_info"].(map[string]any)
					require.True(t, ok, "new redemption must persist administrator audit information")
					assert.Equal(t, "redemption", admin["source"])
					assert.EqualValues(t, code.Id, admin["redemption_id"])
					assert.Equal(t, "203.0.113.17", admin["request_ip"])
					assert.Equal(t, "redemption-test-node", admin["node_name"])
					assert.Equal(t, "redemption-test-version", admin["version"])
					serverIP, ok := admin["server_ip"].(string)
					assert.True(t, ok)
					if serverIP != "" {
						assert.NotNil(t, net.ParseIP(serverIP))
					}
					for _, field := range []string{"payment_method", "callback_payment_method", "caller_ip"} {
						assert.NotContains(t, admin, field, "redemption has no payment callback")
					}

					userLogs, total, err := model.GetUserLogs(user.Id, model.LogFilter{}, 0, 10)
					require.NoError(t, err)
					require.EqualValues(t, 1, total)
					require.Len(t, userLogs, 1)
					var userOther map[string]any
					require.NoError(t, common.UnmarshalJsonStr(userLogs[0].Other, &userOther))
					assert.NotContains(t, userOther, "admin_info")
					assert.Contains(t, userOther, "content_parts")

					assert.False(t, performRedemptionTopupRequest(t, user.Id, code.Key))
					var count int64
					require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("user_id = ?", user.Id).Count(&count).Error)
					assert.EqualValues(t, 1, count, "repeated redemption must not duplicate the top-up audit")
				})
			}
		})
	}
}

func TestPaymentTopupAuditPreservesCallbackFields(t *testing.T) {
	db := setupManageUserTestDB(t)
	user := model.User{Username: "payment-audit-user", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&user).Error)
	model.RecordTopupLog(user.Id, common.NewMessage("payment completed"), "203.0.113.18", "card", "stripe")
	var log model.Log
	require.NoError(t, model.LOG_DB.Where("user_id = ?", user.Id).First(&log).Error)
	assert.Equal(t, model.LogTypeTopup, log.Type)
	assert.Equal(t, "203.0.113.18", log.Ip)
	var other struct {
		Admin map[string]any `json:"admin_info"`
	}
	require.NoError(t, common.UnmarshalJsonStr(log.Other, &other))
	assert.Equal(t, "203.0.113.18", other.Admin["caller_ip"])
	assert.Equal(t, "card", other.Admin["payment_method"])
	assert.Equal(t, "stripe", other.Admin["callback_payment_method"])
	assert.Contains(t, other.Admin, "server_ip")
	assert.Contains(t, other.Admin, "node_name")
	assert.Contains(t, other.Admin, "version")
}
