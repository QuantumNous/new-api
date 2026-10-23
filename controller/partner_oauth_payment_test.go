package controller

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/Calcium-Ion/go-epay/epay"
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupPartnerOAuthPaymentController(t *testing.T) *gin.Engine {
	t.Helper()
	engine := setupPartnerOAuthController(t)
	require.NoError(t, model.DB.AutoMigrate(
		&model.TopUp{}, &model.Option{}, &model.Log{},
		&model.CashbackOrderContext{}, &model.CashbackReward{}, &model.CashbackDeviceLink{},
		&model.CashbackQuotaMutation{}, &model.CashbackCampaign{},
		&model.EpayPaymentEvidence{}, &model.WalletRefundCreditEvent{},
		&model.PartnerOAuthPaymentOrder{},
	))
	confirmPaymentComplianceForTest(t)
	previousDatabaseType := common.MainDatabaseType()
	previousQuotaPerUnit := common.QuotaPerUnit
	previousPayMethods := operation_setting.PayMethods
	previousPayAddress := operation_setting.PayAddress
	previousEpayID := operation_setting.EpayId
	previousEpayKey := operation_setting.EpayKey
	previousMinTopUp := operation_setting.MinTopUp
	previousPrice := operation_setting.Price
	previousDisplay := operation_setting.GetGeneralSetting().QuotaDisplayType
	previousCashback := *operation_setting.GetCashbackSetting()
	common.OptionMapRWMutex.Lock()
	previousOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.SetMainDatabaseType(previousDatabaseType)
		common.QuotaPerUnit = previousQuotaPerUnit
		operation_setting.PayMethods = previousPayMethods
		operation_setting.PayAddress = previousPayAddress
		operation_setting.EpayId = previousEpayID
		operation_setting.EpayKey = previousEpayKey
		operation_setting.MinTopUp = previousMinTopUp
		operation_setting.Price = previousPrice
		operation_setting.GetGeneralSetting().QuotaDisplayType = previousDisplay
		*operation_setting.GetCashbackSetting() = previousCashback
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptionMap
		common.OptionMapRWMutex.Unlock()
	})
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	common.QuotaPerUnit = 500_000
	operation_setting.PayMethods = []map[string]string{
		{"name": "Alipay", "type": "alipay"},
		{"name": "Stripe", "type": model.PaymentMethodStripe},
	}
	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "merchant-id"
	operation_setting.EpayKey = "merchant-secret"
	operation_setting.MinTopUp = 1
	operation_setting.Price = 7
	operation_setting.GetGeneralSetting().QuotaDisplayType = operation_setting.QuotaDisplayTypeUSD

	engine.GET("/api/integrations/v1/balance", middleware.PartnerOAuthBearer(service.PartnerOAuthScopeAccountRead), PartnerOAuthBalance)
	engine.GET("/api/integrations/v1/payment/options", middleware.PartnerOAuthBearer(service.PartnerOAuthScopePaymentWrite), PartnerOAuthPaymentOptions)
	engine.POST("/api/integrations/v1/payment/orders", middleware.PartnerOAuthBearer(service.PartnerOAuthScopePaymentWrite), PartnerOAuthCreatePaymentOrder)
	engine.GET("/api/integrations/v1/payment/orders/:order_id", middleware.PartnerOAuthBearer(service.PartnerOAuthScopePaymentWrite), PartnerOAuthGetPaymentOrder)
	engine.GET("/api/user/epay/return", EpayBrowserReturn)
	return engine
}

// seedPartnerPaymentBinding creates an active binding whose access token is
// accessToken, without walking the authorization flow.
func seedPartnerPaymentBinding(t *testing.T, user *model.User, client *model.PartnerOAuthClient, scope, accessToken string) string {
	t.Helper()
	var bindingID string
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		binding, err := model.CreatePartnerOAuthBindingWithTx(tx, model.PartnerOAuthBindingCreate{
			ClientId:        client.ClientId,
			UserId:          user.Id,
			UserAuthVersion: user.AuthVersion,
			Scope:           scope,
			ExpiresAt:       time.Now().Add(24 * time.Hour).Unix(),
			AccessTokenHash: model.HashPartnerOAuthToken(accessToken),
			AccessExpiresAt: time.Now().Add(time.Hour).Unix(),
		})
		if err != nil {
			return err
		}
		bindingID = binding.BindingId
		return nil
	}))
	return bindingID
}

func partnerIntegrationRequest(engine http.Handler, method, path, accessToken, idempotencyKey, body string) *httptest.ResponseRecorder {
	var reader *bytes.Buffer
	if body != "" {
		reader = bytes.NewBufferString(body)
	} else {
		reader = &bytes.Buffer{}
	}
	req := httptest.NewRequest(method, path, reader)
	req.Host = "localhost:3000"
	if accessToken != "" {
		req.Header.Set("Authorization", "Bearer "+accessToken)
	}
	if idempotencyKey != "" {
		req.Header.Set("Idempotency-Key", idempotencyKey)
	}
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	rec := httptest.NewRecorder()
	engine.ServeHTTP(rec, req)
	return rec
}

func partnerIntegrationErrorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body), rec.Body.String())
	return body.Error.Code
}

func TestPartnerOAuthBalanceFollowsDisplayCurrency(t *testing.T) {
	engine := setupPartnerOAuthPaymentController(t)
	previousRate := operation_setting.USDExchangeRate
	previousCustomRate := operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate
	previousSymbol := operation_setting.GetGeneralSetting().CustomCurrencySymbol
	t.Cleanup(func() {
		operation_setting.USDExchangeRate = previousRate
		operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate = previousCustomRate
		operation_setting.GetGeneralSetting().CustomCurrencySymbol = previousSymbol
	})
	operation_setting.USDExchangeRate = 7.3
	operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate = 0.9
	operation_setting.GetGeneralSetting().CustomCurrencySymbol = "€"
	user := &model.User{Username: "balance-user", Password: "unused", Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, Quota: 1_250_000, UsedQuota: 300_000}
	require.NoError(t, model.DB.Create(user).Error)
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	bindingID := seedPartnerPaymentBinding(t, user, client, "account:read", "oa_balance_reader")
	seedPartnerPaymentBinding(t, user, client, "credential:read", "oa_balance_without_scope")

	for _, tc := range []struct {
		display, amount, currency, symbol string
	}{
		{display: operation_setting.QuotaDisplayTypeUSD, amount: "2.5", currency: "USD", symbol: "$"},
		{display: operation_setting.QuotaDisplayTypeCNY, amount: "18.25", currency: "CNY", symbol: "¥"},
		{display: operation_setting.QuotaDisplayTypeCustom, amount: "2.25", currency: "CUSTOM", symbol: "€"},
		{display: operation_setting.QuotaDisplayTypeTokens, amount: "2.5", currency: "USD", symbol: "$"},
	} {
		t.Run(tc.display, func(t *testing.T) {
			operation_setting.GetGeneralSetting().QuotaDisplayType = tc.display
			rec := partnerIntegrationRequest(engine, http.MethodGet, "/api/integrations/v1/balance", "oa_balance_reader", "", "")
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			assert.Equal(t, "no-store", rec.Header().Get("Cache-Control"))
			var balance service.PartnerOAuthBalanceResponse
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &balance))
			assert.Equal(t, bindingID, balance.BindingID)
			assert.Equal(t, 1_250_000, balance.Quota)
			assert.Equal(t, 300_000, balance.UsedQuota)
			assert.Equal(t, tc.amount, balance.Amount)
			assert.Equal(t, tc.currency, balance.Currency)
			assert.Equal(t, tc.symbol, balance.CurrencySymbol)
			assert.Equal(t, "500000", balance.QuotaPerUnit)
		})
	}

	rec := partnerIntegrationRequest(engine, http.MethodGet, "/api/integrations/v1/balance", "oa_balance_without_scope", "", "")
	assert.Equal(t, http.StatusForbidden, rec.Code)
	assert.Contains(t, rec.Header().Get("WWW-Authenticate"), `scope="account:read"`)
	rec = partnerIntegrationRequest(engine, http.MethodGet, "/api/integrations/v1/balance?x=1", "oa_balance_reader", "", "")
	assert.Equal(t, http.StatusBadRequest, rec.Code)
}

func TestPartnerOAuthPaymentOrderSettlesWithoutCashbackAndReturnsToPartner(t *testing.T) {
	engine := setupPartnerOAuthPaymentController(t)
	cashbackSetting := operation_setting.DefaultCashbackSetting()
	cashbackSetting.InviterEnabled = true
	cashbackSetting.InviterRateBPS = 1_000
	cashbackSetting.MaxRewardQuota = 10_000_000
	cashbackSetting.DailyRewardQuota = 50_000_000
	_, _, err := model.UpdateCashbackSettingAtomic(cashbackSetting, true, time.Now().Unix()-100)
	require.NoError(t, err)

	inviter := &model.User{Username: "payment-inviter", Password: "unused", Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "payment-inviter-aff"}
	require.NoError(t, model.DB.Create(inviter).Error)
	payer := &model.User{Username: "payment-payer", Password: "unused", Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1, AffCode: "payment-payer-aff", InviterId: inviter.Id}
	require.NoError(t, model.DB.Create(payer).Error)
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	bindingID := seedPartnerPaymentBinding(t, payer, client, "account:read payment:write", "oa_payment_writer")
	seedPartnerPaymentBinding(t, payer, client, "payment:write", "oa_other_binding")

	optionsRec := partnerIntegrationRequest(engine, http.MethodGet, "/api/integrations/v1/payment/options", "oa_payment_writer", "", "")
	require.Equal(t, http.StatusOK, optionsRec.Code, optionsRec.Body.String())
	var options partnerPaymentOptionsResponse
	require.NoError(t, json.Unmarshal(optionsRec.Body.Bytes(), &options))
	assert.True(t, options.Available)
	assert.Equal(t, []partnerPaymentMethod{{ID: "alipay", Name: "Alipay"}}, options.Methods, "only Epay channels are offered")
	assert.Equal(t, "USD", options.Currency)
	assert.Equal(t, "CNY", options.PayCurrency)
	require.NotEmpty(t, options.AmountOptions)
	assert.Equal(t, partnerPaymentAmountOption{Amount: 10, PayMoney: "70.00"}, options.AmountOptions[0])

	const body = `{"amount":10,"payment_method":"alipay","return_url":"https://assistant.example.com/billing/done?tab=wallet"}`
	const idempotencyKey = "order-key-0000000001"
	createRec := partnerIntegrationRequest(engine, http.MethodPost, "/api/integrations/v1/payment/orders", "oa_payment_writer", idempotencyKey, body)
	require.Equal(t, http.StatusCreated, createRec.Code, createRec.Body.String())
	var created partnerPaymentOrderResponse
	require.NoError(t, json.Unmarshal(createRec.Body.Bytes(), &created))
	assert.Equal(t, common.TopUpStatusPending, created.Status)
	assert.Equal(t, int64(10), created.Amount)
	assert.Equal(t, "70.00", created.PayMoney)
	checkout, err := url.Parse(created.CheckoutURL)
	require.NoError(t, err)
	assert.Equal(t, "pay.example.com", checkout.Host)
	assert.Equal(t, created.OrderID, checkout.Query().Get("out_trade_no"))
	assert.Equal(t, "70.00", checkout.Query().Get("money"))
	assert.NotEmpty(t, checkout.Query().Get("sign"))

	var orderContext model.CashbackOrderContext
	require.NoError(t, model.DB.Where("trade_no = ?", created.OrderID).First(&orderContext).Error)
	assert.Equal(t, model.CashbackIneligiblePartnerOAuth, orderContext.IneligibleReason)
	assert.Empty(t, orderContext.RequestIP, "the partner server address is not payer evidence")
	assert.Zero(t, orderContext.CampaignID)
	var deviceLinks int64
	require.NoError(t, model.DB.Model(&model.CashbackDeviceLink{}).Count(&deviceLinks).Error)
	assert.Zero(t, deviceLinks)

	replayRec := partnerIntegrationRequest(engine, http.MethodPost, "/api/integrations/v1/payment/orders", "oa_payment_writer", idempotencyKey, body)
	require.Equal(t, http.StatusOK, replayRec.Code, replayRec.Body.String())
	var replayed partnerPaymentOrderResponse
	require.NoError(t, json.Unmarshal(replayRec.Body.Bytes(), &replayed))
	assert.Equal(t, created.OrderID, replayed.OrderID)
	assert.Equal(t, created.CheckoutURL, replayed.CheckoutURL)
	conflictRec := partnerIntegrationRequest(engine, http.MethodPost, "/api/integrations/v1/payment/orders", "oa_payment_writer", idempotencyKey, `{"amount":20,"payment_method":"alipay"}`)
	assert.Equal(t, http.StatusConflict, conflictRec.Code)
	assert.Equal(t, "idempotency_conflict", partnerIntegrationErrorCode(t, conflictRec))
	var topUps int64
	require.NoError(t, model.DB.Model(&model.TopUp{}).Count(&topUps).Error)
	assert.Equal(t, int64(1), topUps)

	otherRec := partnerIntegrationRequest(engine, http.MethodGet, "/api/integrations/v1/payment/orders/"+created.OrderID, "oa_other_binding", "", "")
	assert.Equal(t, http.StatusNotFound, otherRec.Code)
	assert.Equal(t, "order_not_found", partnerIntegrationErrorCode(t, otherRec))
	require.NoError(t, model.DB.Create(&model.TopUp{UserId: payer.Id, Amount: 1, Money: 7, TradeNo: "web-console-order",
		PaymentProvider: model.PaymentProviderEpay, PaymentMethod: "alipay", Status: common.TopUpStatusPending}).Error)
	webRec := partnerIntegrationRequest(engine, http.MethodGet, "/api/integrations/v1/payment/orders/web-console-order", "oa_payment_writer", "", "")
	assert.Equal(t, http.StatusNotFound, webRec.Code)

	params := epay.GenerateParams(map[string]string{
		"pid": "merchant-id", "type": "alipay", "out_trade_no": created.OrderID,
		"trade_no": "provider-order", "trade_status": epay.StatusTradeSuccess, "money": "70.00",
	}, "merchant-secret")
	query := url.Values{}
	for key, value := range params {
		query.Set(key, value)
	}
	returnReq := httptest.NewRequest(http.MethodGet, "/api/user/epay/return?"+query.Encode(), nil)
	returnReq.Host = "localhost:3000"
	returnRec := httptest.NewRecorder()
	engine.ServeHTTP(returnRec, returnReq)
	require.Equal(t, http.StatusFound, returnRec.Code, returnRec.Body.String())
	location, err := url.Parse(returnRec.Header().Get("Location"))
	require.NoError(t, err)
	assert.Equal(t, "assistant.example.com", location.Host)
	assert.Equal(t, "/billing/done", location.Path)
	assert.Equal(t, "wallet", location.Query().Get("tab"))
	assert.Equal(t, created.OrderID, location.Query().Get("order_id"))
	assert.Equal(t, common.TopUpStatusSuccess, location.Query().Get("status"))

	statusRec := partnerIntegrationRequest(engine, http.MethodGet, "/api/integrations/v1/payment/orders/"+created.OrderID, "oa_payment_writer", "", "")
	require.Equal(t, http.StatusOK, statusRec.Code, statusRec.Body.String())
	var settled partnerPaymentOrderResponse
	require.NoError(t, json.Unmarshal(statusRec.Body.Bytes(), &settled))
	assert.Equal(t, common.TopUpStatusSuccess, settled.Status)
	assert.NotEmpty(t, settled.PaidAt)
	assert.Empty(t, settled.CheckoutURL)

	balanceRec := partnerIntegrationRequest(engine, http.MethodGet, "/api/integrations/v1/balance", "oa_payment_writer", "", "")
	require.Equal(t, http.StatusOK, balanceRec.Code)
	var balance service.PartnerOAuthBalanceResponse
	require.NoError(t, json.Unmarshal(balanceRec.Body.Bytes(), &balance))
	assert.Equal(t, 5_000_000, balance.Quota)
	var rewards int64
	require.NoError(t, model.DB.Model(&model.CashbackReward{}).Count(&rewards).Error)
	assert.Zero(t, rewards, "partner orders never earn cashback")

	var logs []model.PartnerOauthAuthorizationLog
	require.NoError(t, model.LOG_DB.Where("action = ?", "partner_oauth.payment.order_create").Find(&logs).Error)
	require.Len(t, logs, 1, "an idempotent replay is not a second order")
	assert.Equal(t, bindingID, logs[0].BindingId)
	encoded, err := common.Marshal(logs[0])
	require.NoError(t, err)
	assert.NotContains(t, string(encoded), idempotencyKey)
	assert.NotContains(t, string(encoded), "oa_payment_writer")

	// Control: the same payer's web order under the same configuration does
	// earn inviter cashback, so the partner exclusion above is what stopped it.
	webTopUp := &model.TopUp{UserId: payer.Id, Amount: 10, Money: 70, TradeNo: "web-cashback-order",
		PaymentProvider: model.PaymentProviderEpay, PaymentMethod: "alipay", CreateTime: time.Now().Unix(), Status: common.TopUpStatusPending}
	require.NoError(t, model.InsertOnlineTopUp(webTopUp, 5_000_000, model.CashbackRequestMetadata{FaceAmount: 10, QuotaPerFaceUnit: "500000"}))
	_, err = model.RechargeEpay(webTopUp.TradeNo, "alipay", "70.00", "127.0.0.1", model.EpayVerifiedDetails{GatewayTradeNo: "provider-web", MerchantID: "merchant-id"})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.CashbackReward{}).Count(&rewards).Error)
	assert.Equal(t, int64(1), rewards)
}

func TestPartnerOAuthPaymentOrderRejectsInvalidRequests(t *testing.T) {
	engine := setupPartnerOAuthPaymentController(t)
	user := &model.User{Username: "payment-validation", Password: "unused", Status: common.UserStatusEnabled, Group: "default", AuthVersion: 1}
	require.NoError(t, model.DB.Create(user).Error)
	client, _ := createPartnerTestClient(t, model.PartnerOAuthTokenAuthMethodBasic, []string{"https://assistant.example.com/oauth/callback"})
	seedPartnerPaymentBinding(t, user, client, "payment:write", "oa_validation_writer")
	seedPartnerPaymentBinding(t, user, client, "account:read", "oa_validation_reader")
	const validBody = `{"amount":10,"payment_method":"alipay"}`

	for _, tc := range []struct {
		name, path, token, key, body string
		status                       int
		code                         string
	}{
		{name: "missing scope", token: "oa_validation_reader", key: "validation-key-00001", body: validBody, status: http.StatusForbidden, code: "insufficient_scope"},
		{name: "missing idempotency key", token: "oa_validation_writer", body: validBody, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "short idempotency key", token: "oa_validation_writer", key: "short", body: validBody, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "query parameters", path: "/api/integrations/v1/payment/orders?amount=10", token: "oa_validation_writer", key: "validation-key-00002", body: validBody, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "unknown field", token: "oa_validation_writer", key: "validation-key-00003", body: `{"amount":10,"payment_method":"alipay","user_id":1}`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "fractional amount", token: "oa_validation_writer", key: "validation-key-00004", body: `{"amount":1.5,"payment_method":"alipay"}`, status: http.StatusBadRequest, code: "invalid_request"},
		{name: "amount below minimum", token: "oa_validation_writer", key: "validation-key-00005", body: `{"amount":0,"payment_method":"alipay"}`, status: http.StatusBadRequest, code: "invalid_amount"},
		{name: "non-epay method", token: "oa_validation_writer", key: "validation-key-00006", body: `{"amount":10,"payment_method":"stripe"}`, status: http.StatusBadRequest, code: "invalid_payment_method"},
		{name: "foreign return url", token: "oa_validation_writer", key: "validation-key-00007", body: `{"amount":10,"payment_method":"alipay","return_url":"https://evil.example.com/done"}`, status: http.StatusBadRequest, code: "invalid_return_url"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			path := tc.path
			if path == "" {
				path = "/api/integrations/v1/payment/orders"
			}
			rec := partnerIntegrationRequest(engine, http.MethodPost, path, tc.token, tc.key, tc.body)
			require.Equal(t, tc.status, rec.Code, rec.Body.String())
			assert.Equal(t, tc.code, partnerIntegrationErrorCode(t, rec))
		})
	}

	nonJSON := httptest.NewRequest(http.MethodPost, "/api/integrations/v1/payment/orders", strings.NewReader("amount=10"))
	nonJSON.Host = "localhost:3000"
	nonJSON.Header.Set("Authorization", "Bearer oa_validation_writer")
	nonJSON.Header.Set("Idempotency-Key", "validation-key-00008")
	nonJSON.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	nonJSONRec := httptest.NewRecorder()
	engine.ServeHTTP(nonJSONRec, nonJSON)
	assert.Equal(t, http.StatusUnsupportedMediaType, nonJSONRec.Code)

	for i := range partnerPaymentPendingLimit {
		rec := partnerIntegrationRequest(engine, http.MethodPost, "/api/integrations/v1/payment/orders", "oa_validation_writer", "pending-limit-key-"+strconv.Itoa(10+i), validBody)
		require.Equal(t, http.StatusCreated, rec.Code, rec.Body.String())
	}
	limited := partnerIntegrationRequest(engine, http.MethodPost, "/api/integrations/v1/payment/orders", "oa_validation_writer", "pending-limit-key-99", validBody)
	assert.Equal(t, http.StatusTooManyRequests, limited.Code)
	assert.Equal(t, "rate_limited", partnerIntegrationErrorCode(t, limited))
	assert.NotEmpty(t, limited.Header().Get("Retry-After"))

	operation_setting.GetPaymentSetting().ComplianceConfirmed = false
	unavailable := partnerIntegrationRequest(engine, http.MethodPost, "/api/integrations/v1/payment/orders", "oa_validation_writer", "validation-key-00009", validBody)
	assert.Equal(t, http.StatusServiceUnavailable, unavailable.Code)
	assert.Equal(t, "payment_unavailable", partnerIntegrationErrorCode(t, unavailable))
	// A replay must not hand out a checkout URL whose payment notify would refuse.
	replay := partnerIntegrationRequest(engine, http.MethodPost, "/api/integrations/v1/payment/orders", "oa_validation_writer", "pending-limit-key-10", validBody)
	assert.Equal(t, http.StatusServiceUnavailable, replay.Code)
	assert.Equal(t, "payment_unavailable", partnerIntegrationErrorCode(t, replay))
	assert.NotContains(t, replay.Body.String(), "checkout_url")
}

func TestPartnerOAuthPaymentReturnURLMustUseRegisteredOrigin(t *testing.T) {
	confidential := &model.PartnerOAuthClient{TokenAuthMethod: model.PartnerOAuthTokenAuthMethodBasic, RedirectURIs: `["https://assistant.example.com/oauth/callback"]`}
	public := &model.PartnerOAuthClient{TokenAuthMethod: model.PartnerOAuthTokenAuthMethodNone, RedirectURIs: `["http://127.0.0.1/callback"]`}
	for _, tc := range []struct {
		name   string
		client *model.PartnerOAuthClient
		url    string
		valid  bool
	}{
		{name: "same origin other path", client: confidential, url: "https://assistant.example.com/billing?x=1", valid: true},
		{name: "other host", client: confidential, url: "https://evil.example.com/billing", valid: false},
		{name: "subdomain", client: confidential, url: "https://pay.assistant.example.com/billing", valid: false},
		{name: "scheme downgrade", client: confidential, url: "http://assistant.example.com/billing", valid: false},
		{name: "userinfo", client: confidential, url: "https://user@assistant.example.com/billing", valid: false},
		{name: "fragment", client: confidential, url: "https://assistant.example.com/billing#x", valid: false},
		{name: "relative", client: confidential, url: "/billing", valid: false},
		{name: "public loopback any port", client: public, url: "http://127.0.0.1:53682/paid", valid: true},
		{name: "public other loopback host", client: public, url: "http://localhost:53682/paid", valid: false},
		{name: "confidential loopback port", client: &model.PartnerOAuthClient{TokenAuthMethod: model.PartnerOAuthTokenAuthMethodBasic, RedirectURIs: `["http://127.0.0.1/callback"]`}, url: "http://127.0.0.1:8080/paid", valid: false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			err := service.ValidatePartnerOAuthPaymentReturnURL(tc.client, tc.url)
			if tc.valid {
				assert.NoError(t, err)
			} else {
				assert.Error(t, err)
			}
		})
	}
}
