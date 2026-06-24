package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupYooKassaWebhookTest(t *testing.T, paymentResponse string) *gin.Engine {
	t.Helper()

	originalMainDatabaseType := common.MainDatabaseType()
	originalLogDatabaseType := common.LogDatabaseType()
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db
	common.RedisEnabled = false
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.TopUp{}, &model.PaymentMetadata{}, &model.Log{}))

	setting.YooKassaEnabled = true
	setting.YooKassaShopID = "shop"
	setting.YooKassaSecretKey = "secret"
	operation_setting.GetPaymentSetting().ComplianceConfirmed = true
	operation_setting.GetPaymentSetting().ComplianceTermsVersion = operation_setting.CurrentComplianceTermsVersion
	t.Cleanup(func() {
		setting.YooKassaEnabled = false
		setting.YooKassaShopID = ""
		setting.YooKassaSecretKey = ""
		operation_setting.GetPaymentSetting().ComplianceConfirmed = false
		operation_setting.GetPaymentSetting().ComplianceTermsVersion = ""
		service.YooKassaAPIBaseURL = "https://api.yookassa.ru/v3"
		service.YooKassaHTTPClient = http.DefaultClient
		common.SetDatabaseTypes(originalMainDatabaseType, originalLogDatabaseType)
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/v3/payments/pay_1", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(paymentResponse))
	}))
	t.Cleanup(server.Close)

	service.YooKassaAPIBaseURL = server.URL + "/v3"
	service.YooKassaHTTPClient = server.Client()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.POST("/api/user/yookassa/notify", YooKassaNotify)
	return router
}

func insertYooKassaOrderForWebhookTest(t *testing.T, metadata string) {
	t.Helper()
	if metadata == "" {
		metadata = `{"quota_to_add":"500000"}`
	}
	require.NoError(t, model.DB.Create(&model.User{
		Id:       1,
		Username: "yk_user",
		Password: "password",
		Status:   common.UserStatusEnabled,
		Group:    "default",
		Quota:    0,
	}).Error)
	require.NoError(t, model.DB.Create(&model.TopUp{
		UserId:          1,
		Amount:          10,
		Money:           100,
		TradeNo:         "trade-1",
		PaymentMethod:   model.PaymentMethodYooKassaSBP,
		PaymentProvider: model.PaymentProviderYooKassa,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}).Error)
	require.NoError(t, model.DB.Create(&model.PaymentMetadata{
		TradeNo:           "trade-1",
		PaymentProvider:   model.PaymentProviderYooKassa,
		ExternalPaymentID: "pay_1",
		Metadata:          metadata,
		CreateTime:        time.Now().Unix(),
		UpdateTime:        time.Now().Unix(),
	}).Error)
}

func postYooKassaWebhook(t *testing.T, router *gin.Engine) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/user/yookassa/notify", strings.NewReader(`{
		"type":"payment.succeeded",
		"object":{"id":"pay_1"}
	}`))
	req.Header.Set("Content-Type", "application/json")
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, req)
	return recorder
}

func yookassaPaymentResponse(status string, paid bool, amount string) string {
	return `{
		"id":"pay_1",
		"status":"` + status + `",
		"paid":` + map[bool]string{true: "true", false: "false"}[paid] + `,
		"amount":{"value":"` + amount + `","currency":"RUB"},
		"metadata":{"trade_no":"trade-1","user_id":"1","topup_id":"1"}
	}`
}

func TestYooKassaWebhookPaymentSucceeded(t *testing.T) {
	router := setupYooKassaWebhookTest(t, yookassaPaymentResponse("succeeded", true, "100.00"))
	insertYooKassaOrderForWebhookTest(t, "")

	recorder := postYooKassaWebhook(t, router)
	assert.Equal(t, http.StatusOK, recorder.Code)

	topUp := model.GetTopUpByTradeNo("trade-1")
	require.NotNil(t, topUp)
	assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
	var user model.User
	require.NoError(t, model.DB.First(&user, 1).Error)
	assert.Equal(t, 500000, user.Quota)
}

func TestYooKassaWebhookIsIdempotent(t *testing.T) {
	router := setupYooKassaWebhookTest(t, yookassaPaymentResponse("succeeded", true, "100.00"))
	insertYooKassaOrderForWebhookTest(t, "")

	assert.Equal(t, http.StatusOK, postYooKassaWebhook(t, router).Code)
	assert.Equal(t, http.StatusOK, postYooKassaWebhook(t, router).Code)

	var user model.User
	require.NoError(t, model.DB.First(&user, 1).Error)
	assert.Equal(t, 500000, user.Quota)
}

func TestYooKassaWebhookRejectsInvalidAmount(t *testing.T) {
	router := setupYooKassaWebhookTest(t, yookassaPaymentResponse("succeeded", true, "99.99"))
	insertYooKassaOrderForWebhookTest(t, "")

	recorder := postYooKassaWebhook(t, router)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	topUp := model.GetTopUpByTradeNo("trade-1")
	require.NotNil(t, topUp)
	assert.Equal(t, common.TopUpStatusPending, topUp.Status)
}

func TestYooKassaWebhookRejectsInvalidStatus(t *testing.T) {
	router := setupYooKassaWebhookTest(t, yookassaPaymentResponse("pending", false, "100.00"))
	insertYooKassaOrderForWebhookTest(t, "")

	recorder := postYooKassaWebhook(t, router)
	assert.Equal(t, http.StatusBadRequest, recorder.Code)

	topUp := model.GetTopUpByTradeNo("trade-1")
	require.NotNil(t, topUp)
	assert.Equal(t, common.TopUpStatusPending, topUp.Status)
}

func TestYooKassaWebhookUsesPaymentMetadataWhenProviderMetadataMissingTradeNo(t *testing.T) {
	paymentResponse := `{
		"id":"pay_1",
		"status":"succeeded",
		"paid":true,
		"amount":{"value":"100.00","currency":"RUB"},
		"metadata":{"user_id":"1","topup_id":"1"}
	}`
	router := setupYooKassaWebhookTest(t, paymentResponse)
	insertYooKassaOrderForWebhookTest(t, `{"quota_to_add":"123456"}`)

	recorder := postYooKassaWebhook(t, router)
	assert.Equal(t, http.StatusOK, recorder.Code)

	var user model.User
	require.NoError(t, model.DB.First(&user, 1).Error)
	assert.Equal(t, 123456, user.Quota)
}
