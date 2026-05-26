package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupEpayReturnTestConfig(t *testing.T) {
	t.Helper()

	originalServerAddress := system_setting.ServerAddress
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalPayMethods := operation_setting.PayMethods
	originalDistributionEnabled := operation_setting.GetDistributionSetting().Enabled

	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		operation_setting.PayMethods = originalPayMethods
		operation_setting.GetDistributionSetting().Enabled = originalDistributionEnabled
	})

	system_setting.ServerAddress = "https://example.com"
	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "epay_id"
	operation_setting.EpayKey = "epay_key"
	operation_setting.PayMethods = []map[string]string{{"type": "alipay"}}
	operation_setting.GetDistributionSetting().Enabled = false
}

func setupEpayReturnTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := model.DB
	originalLogDB := model.LOG_DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	t.Cleanup(func() {
		model.DB = originalDB
		model.LOG_DB = originalLogDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
	})

	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.Log{}))
	return db
}

func epayReturnTestContext(method string, target string) (*gin.Context, *httptest.ResponseRecorder) {
	req := httptest.NewRequest(method, target, nil)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = req
	return c, w
}

func signedEpayReturnParams(tradeNo string, tradeStatus string) url.Values {
	params := epay.GenerateParams(map[string]string{
		"pid":          operation_setting.EpayId,
		"trade_no":     "epay-platform-trade",
		"out_trade_no": tradeNo,
		"type":         "alipay",
		"name":         "TUC2",
		"money":        "0.40",
		"trade_status": tradeStatus,
	}, operation_setting.EpayKey)

	values := url.Values{}
	for key, value := range params {
		values.Set(key, value)
	}
	return values
}

func TestPaymentResultPath(t *testing.T) {
	originalServerAddress := system_setting.ServerAddress
	t.Cleanup(func() {
		system_setting.ServerAddress = originalServerAddress
	})

	system_setting.ServerAddress = "https://example.com/"
	require.Equal(t, "https://example.com/payment/result?kind=topup&status=success", paymentResultPath("topup", "success"))
}

func TestEpayReturnRedirectsFailForMissingParams(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupEpayReturnTestConfig(t)

	c, w := epayReturnTestContext(http.MethodGet, "/api/user/epay/return")
	EpayReturn(c)

	require.Equal(t, http.StatusFound, w.Code)
	require.Equal(t, "https://example.com/payment/result?kind=topup&status=fail", w.Header().Get("Location"))
}

func TestEpayReturnRedirectsFailForBadSignature(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupEpayReturnTestConfig(t)

	values := signedEpayReturnParams("bad-signature-trade", epay.StatusTradeSuccess)
	values.Set("sign", "bad-signature")

	c, w := epayReturnTestContext(http.MethodGet, "/api/user/epay/return?"+values.Encode())
	EpayReturn(c)

	require.Equal(t, http.StatusFound, w.Code)
	require.Equal(t, "https://example.com/payment/result?kind=topup&status=fail", w.Header().Get("Location"))
}

func TestEpayReturnRedirectsPendingForNonSuccessTradeStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupEpayReturnTestConfig(t)

	values := signedEpayReturnParams("pending-trade", "WAIT_BUYER_PAY")

	c, w := epayReturnTestContext(http.MethodGet, "/api/user/epay/return?"+values.Encode())
	EpayReturn(c)

	require.Equal(t, http.StatusFound, w.Code)
	require.Equal(t, "https://example.com/payment/result?kind=topup&status=pending", w.Header().Get("Location"))
}

func TestEpayReturnCompletesTopUpIdempotently(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupEpayReturnTestConfig(t)
	db := setupEpayReturnTestDB(t)

	require.NoError(t, db.Create(&model.User{
		Id:       123,
		Username: "epay-return-user",
		Password: "password",
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}).Error)

	tradeNo := "epay-return-success"
	require.NoError(t, db.Create(&model.TopUp{
		UserId:          123,
		Amount:          2,
		Money:           0.4,
		TradeNo:         tradeNo,
		PaymentMethod:   "alipay",
		PaymentProvider: model.PaymentProviderEpay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}).Error)

	values := signedEpayReturnParams(tradeNo, epay.StatusTradeSuccess)
	target := "/api/user/epay/return?" + values.Encode()

	c, w := epayReturnTestContext(http.MethodGet, target)
	EpayReturn(c)
	require.Equal(t, http.StatusFound, w.Code)
	require.Equal(t, "https://example.com/payment/result?kind=topup&status=success", w.Header().Get("Location"))

	var user model.User
	require.NoError(t, db.First(&user, 123).Error)
	require.Equal(t, int(2*common.QuotaPerUnit), user.Quota)

	c, w = epayReturnTestContext(http.MethodGet, target)
	EpayReturn(c)
	require.Equal(t, http.StatusFound, w.Code)
	require.Equal(t, "https://example.com/payment/result?kind=topup&status=success", w.Header().Get("Location"))

	require.NoError(t, db.First(&user, 123).Error)
	require.Equal(t, int(2*common.QuotaPerUnit), user.Quota)
}

func TestSubscriptionEpayReturnRedirectsPendingForNonSuccessTradeStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)
	setupEpayReturnTestConfig(t)

	values := signedEpayReturnParams("subscription-pending-trade", "WAIT_BUYER_PAY")

	c, w := epayReturnTestContext(http.MethodGet, "/api/subscription/epay/return?"+values.Encode())
	SubscriptionEpayReturn(c)

	require.Equal(t, http.StatusFound, w.Code)
	require.Equal(t, "https://example.com/payment/result?kind=subscription&status=pending", w.Header().Get("Location"))
}
