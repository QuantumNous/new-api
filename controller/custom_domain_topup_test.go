package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestPaymentReturnURLUsesOnlyAStoredCurrentlyActiveCustomDomain(t *testing.T) {
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousEnabled := common.CustomDomainEnabled
	previousSuffix := common.CustomDomainSuffix
	previousMainOrigin := common.CustomDomainMainOrigin
	previousServerAddress := system_setting.ServerAddress
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.CustomDomainEnabled = true
	common.CustomDomainSuffix = "yeschoy.io"
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	system_setting.ServerAddress = "https://legacy-main.example.com"
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.CustomDomainEnabled = previousEnabled
		common.CustomDomainSuffix = previousSuffix
		common.CustomDomainMainOrigin = previousMainOrigin
		system_setting.ServerAddress = previousServerAddress
	})

	owner := model.User{Username: "topup-return-owner", AffCode: "topup-return-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	_, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	gin.SetMode(gin.TestMode)
	var capturedOrigin string
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/origin", func(c *gin.Context) {
		capturedOrigin = topUpOriginHostFromContext(c)
		c.Status(http.StatusNoContent)
	})
	request := httptest.NewRequest(http.MethodGet, "https://alpha.yeschoy.io/origin", nil)
	request.Host = "alpha.yeschoy.io"
	request.Header.Set("X-Forwarded-Host", "attacker.example")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	require.Equal(t, http.StatusNoContent, response.Code)
	assert.Equal(t, "alpha.yeschoy.io", capturedOrigin)

	topUp := &model.TopUp{OriginHost: "alpha.yeschoy.io"}
	assert.Equal(t, "https://alpha.yeschoy.io/usage-logs", paymentReturnURLForTopUp(topUp, "/usage-logs"))

	_, err = model.DisableCustomDomain(domain.Label)
	require.NoError(t, err)
	assert.Equal(t, "https://yeschoy.com/usage-logs", paymentReturnURLForTopUp(topUp, "/usage-logs"))
	assert.Equal(t, "https://yeschoy.com/wallet", paymentReturnURLForTopUp(&model.TopUp{}, "/wallet"))
}

func TestStripeBrowserReturnNavigatesFromStoredOrderWithoutCrediting(t *testing.T) {
	previousDB := model.DB
	previousDatabaseType := common.MainDatabaseType()
	previousEnabled := common.CustomDomainEnabled
	previousSuffix := common.CustomDomainSuffix
	previousMainOrigin := common.CustomDomainMainOrigin
	previousServerAddress := system_setting.ServerAddress
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}, &model.TopUp{}))
	model.DB = db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.CustomDomainEnabled = true
	common.CustomDomainSuffix = "yeschoy.io"
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	system_setting.ServerAddress = "https://yeschoy.com"
	t.Cleanup(func() {
		model.DB = previousDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.CustomDomainEnabled = previousEnabled
		common.CustomDomainSuffix = previousSuffix
		common.CustomDomainMainOrigin = previousMainOrigin
		system_setting.ServerAddress = previousServerAddress
	})

	owner := model.User{Username: "stripe-return-owner", AffCode: "stripe-return-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	_, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.TopUp{
		UserId: 99, TradeNo: "stripe-return-order", PaymentProvider: model.PaymentProviderStripe,
		PaymentMethod: model.PaymentMethodStripe, Status: common.TopUpStatusPending, OriginHost: "alpha.yeschoy.io",
	}).Error)

	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/api/stripe/return", StripeBrowserReturn)

	for _, test := range []struct {
		result   string
		expected string
	}{
		{result: "success", expected: "https://alpha.yeschoy.io/usage-logs"},
		{result: "cancel", expected: "https://alpha.yeschoy.io/wallet"},
	} {
		request := httptest.NewRequest(http.MethodGet, "https://yeschoy.com/api/stripe/return?trade_no=stripe-return-order&result="+test.result, nil)
		request.Host = "yeschoy.com"
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		require.Equal(t, http.StatusFound, response.Code)
		assert.Equal(t, test.expected, response.Header().Get("Location"))
	}

	request := httptest.NewRequest(http.MethodGet, "https://yeschoy.com/api/stripe/return?trade_no=missing&result=success", nil)
	request.Host = "yeschoy.com"
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	assert.Equal(t, http.StatusNotFound, response.Code)
}

func TestStripeCheckoutReturnURLsIgnoreClientTargetsForACustomDomain(t *testing.T) {
	previousEnabled := common.CustomDomainEnabled
	previousMainOrigin := common.CustomDomainMainOrigin
	previousServerAddress := system_setting.ServerAddress
	previousCustomCallbackAddress := operation_setting.CustomCallbackAddress
	common.CustomDomainEnabled = true
	common.CustomDomainMainOrigin = "https://yeschoy.com/"
	system_setting.ServerAddress = "https://legacy-main.example.com/"
	operation_setting.CustomCallbackAddress = "https://legacy-callback.example.com"
	t.Cleanup(func() {
		common.CustomDomainEnabled = previousEnabled
		common.CustomDomainMainOrigin = previousMainOrigin
		system_setting.ServerAddress = previousServerAddress
		operation_setting.CustomCallbackAddress = previousCustomCallbackAddress
	})

	successURL, cancelURL := stripeCheckoutReturnURLs(
		"stripe-order",
		"alpha.yeschoy.io",
		"https://attacker.example/success",
		"https://attacker.example/cancel",
	)
	assert.Equal(t, "https://yeschoy.com/api/stripe/return?result=success&trade_no=stripe-order", successURL)
	assert.Equal(t, "https://yeschoy.com/api/stripe/return?result=cancel&trade_no=stripe-order", cancelURL)

	successURL, cancelURL = stripeCheckoutReturnURLs("stripe-order", "", "https://trusted.example/success", "https://trusted.example/cancel")
	assert.Equal(t, "https://trusted.example/success", successURL)
	assert.Equal(t, "https://trusted.example/cancel", cancelURL)
	assert.Equal(t, "https://yeschoy.com/api/user/epay/return", epayBrowserReturnURL())
	assert.Equal(t, "https://yeschoy.com/api/user/epay/notify", epayNotifyURL())

	common.CustomDomainEnabled = false
	assert.Equal(t, "https://legacy-main.example.com/api/user/epay/return", epayBrowserReturnURL())
	assert.Equal(t, "https://legacy-callback.example.com/api/user/epay/notify", epayNotifyURL())
}

func TestEpayBrowserReturnVerifiesSettlesOnceAndReturnsToTheStoredDomain(t *testing.T) {
	previousDB, previousLogDB := model.DB, model.LOG_DB
	previousDatabaseType := common.MainDatabaseType()
	previousRedisEnabled := common.RedisEnabled
	previousQuotaPerUnit := common.QuotaPerUnit
	previousEnabled := common.CustomDomainEnabled
	previousSuffix := common.CustomDomainSuffix
	previousMainOrigin := common.CustomDomainMainOrigin
	previousServerAddress := system_setting.ServerAddress
	previousPayAddress := operation_setting.PayAddress
	previousEpayID := operation_setting.EpayId
	previousEpayKey := operation_setting.EpayKey
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.CustomDomain{}, &model.TopUp{}, &model.Log{}))
	model.DB, model.LOG_DB = db, db
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.QuotaPerUnit = 100
	common.CustomDomainEnabled = true
	common.CustomDomainSuffix = "yeschoy.io"
	common.CustomDomainMainOrigin = "https://yeschoy.com"
	system_setting.ServerAddress = "https://yeschoy.com"
	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "merchant-id"
	operation_setting.EpayKey = "merchant-secret"
	t.Cleanup(func() {
		model.DB, model.LOG_DB = previousDB, previousLogDB
		common.SetMainDatabaseType(previousDatabaseType)
		common.RedisEnabled = previousRedisEnabled
		common.QuotaPerUnit = previousQuotaPerUnit
		common.CustomDomainEnabled = previousEnabled
		common.CustomDomainSuffix = previousSuffix
		common.CustomDomainMainOrigin = previousMainOrigin
		system_setting.ServerAddress = previousServerAddress
		operation_setting.PayAddress = previousPayAddress
		operation_setting.EpayId = previousEpayID
		operation_setting.EpayKey = previousEpayKey
	})

	owner := model.User{Username: "epay-return-owner", AffCode: "epay-return-owner-aff", Status: common.UserStatusEnabled}
	payer := model.User{Username: "epay-return-payer", AffCode: "epay-return-payer-aff", Status: common.UserStatusEnabled}
	require.NoError(t, db.Create(&owner).Error)
	require.NoError(t, db.Create(&payer).Error)
	domain, err := model.CreateCustomDomain("alpha", owner.Id)
	require.NoError(t, err)
	_, err = model.EnableCustomDomain(domain.Label)
	require.NoError(t, err)
	require.NoError(t, db.Create(&model.TopUp{
		UserId: payer.Id, Amount: 1, Money: 1, TradeNo: "epay-return-order",
		PaymentProvider: model.PaymentProviderEpay, PaymentMethod: "alipay",
		Status: common.TopUpStatusPending, OriginHost: "alpha.yeschoy.io",
	}).Error)

	settings, err := common.ParseCustomDomainSettings("true", "yeschoy.io", "https://yeschoy.com", "5", "")
	require.NoError(t, err)
	resolver, err := service.NewCustomDomainResolver(settings)
	require.NoError(t, err)
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(middleware.CustomDomainContextWithResolver(resolver, true))
	router.GET("/api/user/epay/return", EpayBrowserReturn)

	params := epay.GenerateParams(map[string]string{
		"pid": "merchant-id", "type": "alipay", "out_trade_no": "epay-return-order",
		"trade_no": "provider-order", "trade_status": epay.StatusTradeSuccess, "money": "1.00",
	}, "merchant-secret")
	query := url.Values{}
	for key, value := range params {
		query.Set(key, value)
	}
	requestReturn := func(rawQuery string) *httptest.ResponseRecorder {
		request := httptest.NewRequest(http.MethodGet, "https://yeschoy.com/api/user/epay/return?"+rawQuery, nil)
		request.Host = "yeschoy.com"
		response := httptest.NewRecorder()
		router.ServeHTTP(response, request)
		return response
	}

	response := requestReturn(query.Encode())
	require.Equal(t, http.StatusFound, response.Code)
	assert.Equal(t, "https://alpha.yeschoy.io/usage-logs", response.Header().Get("Location"))
	response = requestReturn(query.Encode())
	require.Equal(t, http.StatusFound, response.Code)

	var updated model.User
	require.NoError(t, db.First(&updated, payer.Id).Error)
	assert.Equal(t, 100, updated.Quota)

	query.Set("sign", "forged")
	response = requestReturn(query.Encode())
	assert.Equal(t, http.StatusBadRequest, response.Code)
}
