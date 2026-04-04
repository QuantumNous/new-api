package controller

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupJeepayTestDB(t *testing.T) {
	t.Helper()

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	model.DB = db
	model.LOG_DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.LogConsumeEnabled = true
	common.QuotaPerUnit = 1

	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.Log{}))
}

func TestJeepayBuildSign(t *testing.T) {
	params := map[string]interface{}{
		"mchNo":      "M123",
		"appId":      "A123",
		"mchOrderNo": "TOPUP-001",
		"amount":     1234,
		"currency":   "cny",
		"notifyUrl":  "https://example.com/api/jeepay/notify",
		"reqTime":    int64(1710000000000),
		"version":    "1.0",
		"signType":   "MD5",
		"body":       "",
	}

	sign := buildJeepaySign(params, "secret-key")

	require.Equal(t, "22E54179A3B0EC004B210E2942C0FA90", sign)
}

func TestJeepayNotify(t *testing.T) {
	setupJeepayTestDB(t)
	gin.SetMode(gin.TestMode)

	settingJeepayForTest()

	user := &model.User{
		Username: "alice",
		Password: "password123",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
	}
	require.NoError(t, model.DB.Create(user).Error)

	topUp := &model.TopUp{
		UserId:        user.Id,
		Amount:        100,
		Money:         100,
		TradeNo:       "JEEPAY-TOPUP-001",
		PaymentMethod: PaymentMethodJeepay,
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, topUp.Insert())

	notifyPayload := map[string]interface{}{
		"payOrderId":  "P20260404001",
		"mchNo":       settingJeepayMchNoForTest,
		"appId":       settingJeepayAppIDForTest,
		"mchOrderNo":  topUp.TradeNo,
		"wayCode":     "WEB_CASHIER",
		"ifCode":      "WX_NATIVE",
		"state":       "2",
		"amount":      10000,
		"currency":    "cny",
		"createdAt":   1710000000000,
		"successTime": 1710000001000,
		"signType":    "MD5",
	}
	notifyPayload["sign"] = buildJeepaySign(notifyPayload, settingJeepayApiKeyForTest)

	bodyBytes, err := common.Marshal(notifyPayload)
	require.NoError(t, err)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/jeepay/notify", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	JeepayNotify(c)

	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "success", w.Body.String())

	savedTopUp := model.GetTopUpByTradeNo(topUp.TradeNo)
	require.NotNil(t, savedTopUp)
	require.Equal(t, common.TopUpStatusSuccess, savedTopUp.Status)

	var updatedUser model.User
	require.NoError(t, model.DB.First(&updatedUser, user.Id).Error)
	require.Equal(t, 100, updatedUser.Quota)
}

func TestJeepayNotifyRejectsInvalidSignature(t *testing.T) {
	setupJeepayTestDB(t)
	gin.SetMode(gin.TestMode)

	settingJeepayForTest()

	topUp := &model.TopUp{
		UserId:        1,
		Amount:        50,
		Money:         50,
		TradeNo:       "JEEPAY-TOPUP-INVALID",
		PaymentMethod: PaymentMethodJeepay,
		Status:        common.TopUpStatusPending,
	}
	require.NoError(t, model.DB.Create(&model.User{
		Id:       1,
		Username: "bob",
		Password: "password123",
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
	}).Error)
	require.NoError(t, topUp.Insert())

	bodyBytes, err := common.Marshal(map[string]interface{}{
		"mchNo":      settingJeepayMchNoForTest,
		"appId":      settingJeepayAppIDForTest,
		"mchOrderNo": topUp.TradeNo,
		"state":      "2",
		"amount":     5000,
		"signType":   "MD5",
		"sign":       "BAD-SIGN",
	})
	require.NoError(t, err)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req := httptest.NewRequest(http.MethodPost, "/api/jeepay/notify", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req

	JeepayNotify(c)

	require.NotEqual(t, http.StatusOK, w.Code)

	savedTopUp := model.GetTopUpByTradeNo(topUp.TradeNo)
	require.NotNil(t, savedTopUp)
	require.Equal(t, common.TopUpStatusPending, savedTopUp.Status)
}

const (
	settingJeepayMchNoForTest  = "M123456789"
	settingJeepayAppIDForTest  = "A123456789"
	settingJeepayApiKeyForTest = "secret-key"
)

func settingJeepayForTest() {
	setting.JeepayBaseURL = "https://jeepay.example.com"
	setting.JeepayMchNo = settingJeepayMchNoForTest
	setting.JeepayAppID = settingJeepayAppIDForTest
	setting.JeepayAPIKey = settingJeepayApiKeyForTest
}
