package controller

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/webhook"
)

const (
	// PayMethods as saved by releases that had no provider field.
	legacyPayMethodsJSON = `[{"name":"Alipay","type":"alipay","color":"#1677FF"},{"name":"Custom","type":"custom1","min_topup":"50"}]`
	// Alipay and WeChat Pay routed through Stripe next to an Epay method.
	stripeRoutedPayMethodsJSON = `[{"name":"Alipay","type":"alipay","provider":"stripe"},{"name":"WeChat","type":"wxpay","provider":"stripe"},{"name":"Custom","type":"custom1"}]`
)

// stripePayMethodFixture is a database with one user and a local stand-in for
// the Stripe API that records every Checkout Session it is asked to create.
type stripePayMethodFixture struct {
	userID   int
	checkout []url.Values
}

// setupStripePayMethodTest loads payMethodsJSON the way a saved PayMethods
// option is loaded, configures Epay, and configures Stripe top-up with
// placeholder credentials when stripeConfigured is set. No request leaves the
// process: the Stripe SDK is pointed at a local server.
func setupStripePayMethodTest(t *testing.T, stripeConfigured bool, payMethodsJSON string) *stripePayMethodFixture {
	t.Helper()
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.TopUp{}, &model.SubscriptionPlan{}, &model.SubscriptionOrder{}, &model.UserSubscription{}, &model.Log{}))
	confirmPaymentComplianceForTest(t)

	originalAPISecret := setting.StripeApiSecret
	originalWebhookSecret := setting.StripeWebhookSecret
	originalPriceID := setting.StripePriceId
	originalPromotionCodes := setting.StripePromotionCodesEnabled
	originalStripeKey := stripe.Key
	originalPayMethods := operation_setting.PayMethods
	originalPayAddress := operation_setting.PayAddress
	originalEpayID := operation_setting.EpayId
	originalEpayKey := operation_setting.EpayKey
	originalServerAddress := system_setting.ServerAddress
	t.Cleanup(func() {
		setting.StripeApiSecret = originalAPISecret
		setting.StripeWebhookSecret = originalWebhookSecret
		setting.StripePriceId = originalPriceID
		setting.StripePromotionCodesEnabled = originalPromotionCodes
		stripe.Key = originalStripeKey
		stripe.SetBackend(stripe.APIBackend, nil)
		operation_setting.PayMethods = originalPayMethods
		operation_setting.PayAddress = originalPayAddress
		operation_setting.EpayId = originalEpayID
		operation_setting.EpayKey = originalEpayKey
		system_setting.ServerAddress = originalServerAddress
	})

	setting.StripeApiSecret, setting.StripeWebhookSecret, setting.StripePriceId = "", "", ""
	if stripeConfigured {
		setting.StripeApiSecret = "sk_test_123"
		setting.StripeWebhookSecret = "whsec_test"
		setting.StripePriceId = "price_topup"
	}
	setting.StripePromotionCodesEnabled = false
	operation_setting.PayAddress = "https://pay.example.com"
	operation_setting.EpayId = "epay_id"
	operation_setting.EpayKey = "epay_key"
	system_setting.ServerAddress = "https://dashboard.example.com"
	require.NoError(t, operation_setting.UpdatePayMethodsByJsonString(payMethodsJSON))

	fixture := &stripePayMethodFixture{userID: 4201}
	stripeAPI := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/checkout/sessions" || r.ParseForm() != nil {
			http.Error(w, `{"error":{"message":"unexpected Stripe request"}}`, http.StatusBadRequest)
			return
		}
		fixture.checkout = append(fixture.checkout, r.PostForm)
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprintf(w, `{"id":"cs_test_%d","object":"checkout.session","url":"https://checkout.stripe.test/pay/%d"}`, len(fixture.checkout), len(fixture.checkout))
	}))
	t.Cleanup(stripeAPI.Close)
	stripe.SetBackend(stripe.APIBackend, stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{
		URL:               stripe.String(stripeAPI.URL),
		MaxNetworkRetries: stripe.Int64(0),
	}))

	require.NoError(t, db.Create(&model.User{
		Id:       fixture.userID,
		Username: "stripe_pay_method_user",
		Email:    "user@example.com",
		Group:    "default",
		Status:   common.UserStatusEnabled,
	}).Error)
	return fixture
}

// post sends a JSON body to a payment handler as the fixture user.
func (f *stripePayMethodFixture) post(handler gin.HandlerFunc, body string) string {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	c.Request.Header.Set("Content-Type", "application/json")
	c.Set("id", f.userID)
	handler(c)
	return recorder.Body.String()
}

func topUpInfoForTest(t *testing.T) (map[string]map[string]any, map[string]any) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/user/topup/info", nil)
	GetTopUpInfo(c)
	var body struct {
		Data map[string]any `json:"data"`
	}
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &body))
	methods := make(map[string]map[string]any)
	for _, item := range body.Data["pay_methods"].([]any) {
		method := item.(map[string]any)
		methods[method["type"].(string)] = method
	}
	return methods, body.Data
}

func TestUpdateOptionValidatesPayMethodProviders(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}))
	originalOptionMap := common.OptionMap
	originalPayMethods := operation_setting.PayMethods
	t.Cleanup(func() {
		common.OptionMap = originalOptionMap
		operation_setting.PayMethods = originalPayMethods
	})
	common.OptionMap = map[string]string{"PayMethods": legacyPayMethodsJSON}
	require.NoError(t, operation_setting.UpdatePayMethodsByJsonString(legacyPayMethodsJSON))

	cases := []struct {
		name      string
		value     string
		wantError string
	}{
		{"custom method through stripe", `[{"name":"Custom","type":"custom1","provider":"stripe"}]`, "Only alipay and wxpay payment methods can use the Stripe channel, got custom1"},
		{"unknown provider", `[{"name":"Alipay","type":"alipay","provider":"paypal"}]`, "Unsupported payment channel paypal for payment method alipay"},
		{"stripe type configured twice", `[{"name":"A","type":"alipay","provider":"stripe"},{"name":"B","type":"alipay"}]`, "Payment method alipay uses the Stripe channel and must be configured only once"},
		{"non-string value", `[{"name":"Custom","type":"custom1","min_topup":50}]`, "Payment methods must be a JSON array of objects with string values"},
		{"legacy entries without provider", legacyPayMethodsJSON, ""},
		{"explicit epay provider", `[{"name":"Alipay","type":"alipay","provider":"epay"}]`, ""},
		{"alipay and wxpay through stripe", stripeRoutedPayMethodsJSON, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			before := common.OptionMap["PayMethods"]
			body, err := common.Marshal(OptionUpdateRequest{Key: "PayMethods", Value: tc.value})
			require.NoError(t, err)
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPut, "/api/option/", strings.NewReader(string(body)))

			UpdateOption(c)

			var response struct {
				Success bool   `json:"success"`
				Message string `json:"message"`
			}
			require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &response))
			if tc.wantError == "" {
				require.True(t, response.Success, response.Message)
				assert.Equal(t, tc.value, common.OptionMap["PayMethods"])
				return
			}
			assert.False(t, response.Success)
			assert.Equal(t, tc.wantError, response.Message)
			assert.Equal(t, before, common.OptionMap["PayMethods"], "a rejected value must not be saved")
		})
	}
}

func TestStripeTopUpRestrictsCheckoutToRoutedPayMethod(t *testing.T) {
	fixture := setupStripePayMethodTest(t, true, stripeRoutedPayMethodsJSON)

	cases := []struct {
		method      string
		wantTypes   []string
		wantWeChat  string
		wantOrdered bool
	}{
		{method: "stripe", wantOrdered: true},
		{method: "alipay", wantTypes: []string{"alipay"}, wantOrdered: true},
		{method: "wxpay", wantTypes: []string{"wechat_pay"}, wantWeChat: "web", wantOrdered: true},
		// An Epay method and an unknown one never reach Stripe.
		{method: "custom1"},
		{method: "paypal"},
	}
	for _, tc := range cases {
		t.Run(tc.method, func(t *testing.T) {
			fixture.checkout = nil
			body := fixture.post(RequestStripePay, `{"amount":20,"payment_method":"`+tc.method+`"}`)

			var orders []model.TopUp
			require.NoError(t, model.DB.Where("payment_method = ?", tc.method).Find(&orders).Error)
			if !tc.wantOrdered {
				assert.Contains(t, body, "Unsupported payment channel")
				assert.Empty(t, fixture.checkout)
				assert.Empty(t, orders)
				return
			}
			assert.Contains(t, body, `"pay_link":"https://checkout.stripe.test/pay/1"`)
			require.Len(t, fixture.checkout, 1)
			form := fixture.checkout[0]
			assert.Equal(t, "payment", form.Get("mode"))
			assert.Equal(t, "price_topup", form.Get("line_items[0][price]"))
			assert.Equal(t, "20", form.Get("line_items[0][quantity]"))
			assert.Equal(t, "user@example.com", form.Get("customer_email"))
			var gotTypes []string
			for index := 0; form.Has(fmt.Sprintf("payment_method_types[%d]", index)); index++ {
				gotTypes = append(gotTypes, form.Get(fmt.Sprintf("payment_method_types[%d]", index)))
			}
			assert.Equal(t, tc.wantTypes, gotTypes)
			assert.Equal(t, tc.wantWeChat, form.Get("payment_method_options[wechat_pay][client]"))

			require.Len(t, orders, 1)
			assert.Equal(t, model.PaymentProviderStripe, orders[0].PaymentProvider)
			assert.Equal(t, form.Get("client_reference_id"), orders[0].TradeNo)
			assert.Equal(t, int64(20), orders[0].Amount)
			assert.Equal(t, common.TopUpStatusPending, orders[0].Status)
		})
	}

	t.Run("legacy alipay entry is not a Stripe method", func(t *testing.T) {
		require.NoError(t, operation_setting.UpdatePayMethodsByJsonString(legacyPayMethodsJSON))
		fixture.checkout = nil
		body := fixture.post(RequestStripePay, `{"amount":20,"payment_method":"alipay"}`)
		assert.Contains(t, body, "Unsupported payment channel")
		assert.Empty(t, fixture.checkout)
	})

	t.Run("routed method is refused while Stripe top-up is not configured", func(t *testing.T) {
		require.NoError(t, operation_setting.UpdatePayMethodsByJsonString(stripeRoutedPayMethodsJSON))
		setting.StripePriceId = ""
		fixture.checkout = nil
		body := fixture.post(RequestStripePay, `{"amount":20,"payment_method":"alipay"}`)
		assert.Contains(t, body, "Unsupported payment channel")
		assert.Empty(t, fixture.checkout)
	})
}

func TestStripeSubscriptionUsesOneTimePaymentForRoutedPayMethod(t *testing.T) {
	fixture := setupStripePayMethodTest(t, true, stripeRoutedPayMethodsJSON)
	recurringPlan := &model.SubscriptionPlan{Id: 4211, Title: "Pro", PriceAmount: 19.99, Currency: "USD", Enabled: true, StripePriceId: "price_recurring"}
	oneTimeOnlyPlan := &model.SubscriptionPlan{Id: 4212, Title: "Lite", PriceAmount: 5, Currency: "USD", Enabled: true}
	require.NoError(t, model.DB.Create(recurringPlan).Error)
	require.NoError(t, model.DB.Create(oneTimeOnlyPlan).Error)
	lastOrder := func() model.SubscriptionOrder {
		var order model.SubscriptionOrder
		require.NoError(t, model.DB.Order("id desc").First(&order).Error)
		return order
	}

	// Without payment_method the request is the recurring Stripe subscription it always was.
	body := fixture.post(SubscriptionRequestStripePay, `{"plan_id":4211}`)
	assert.Contains(t, body, `"pay_link":"https://checkout.stripe.test/pay/1"`)
	require.Len(t, fixture.checkout, 1)
	recurring := fixture.checkout[0]
	assert.Equal(t, "subscription", recurring.Get("mode"))
	assert.Equal(t, "price_recurring", recurring.Get("line_items[0][price]"))
	assert.False(t, recurring.Has("payment_method_types[0]"))
	assert.Equal(t, model.PaymentMethodStripe, lastOrder().PaymentMethod)

	// WeChat Pay cannot back a Stripe subscription: the plan is bought once at its USD price.
	body = fixture.post(SubscriptionRequestStripePay, `{"plan_id":4211,"payment_method":"wxpay"}`)
	assert.Contains(t, body, `"pay_link":"https://checkout.stripe.test/pay/2"`)
	require.Len(t, fixture.checkout, 2)
	oneTime := fixture.checkout[1]
	assert.Equal(t, "payment", oneTime.Get("mode"))
	assert.False(t, oneTime.Has("line_items[0][price]"), "a recurring price cannot be used in payment mode")
	assert.Equal(t, "usd", oneTime.Get("line_items[0][price_data][currency]"))
	assert.Equal(t, "1999", oneTime.Get("line_items[0][price_data][unit_amount]"))
	assert.Equal(t, "Pro", oneTime.Get("line_items[0][price_data][product_data][name]"))
	assert.Equal(t, "1", oneTime.Get("line_items[0][quantity]"))
	assert.Equal(t, "wechat_pay", oneTime.Get("payment_method_types[0]"))
	assert.Equal(t, "web", oneTime.Get("payment_method_options[wechat_pay][client]"))
	order := lastOrder()
	assert.Equal(t, "wxpay", order.PaymentMethod)
	assert.Equal(t, model.PaymentProviderStripe, order.PaymentProvider)
	assert.Equal(t, oneTime.Get("client_reference_id"), order.TradeNo)
	assert.InDelta(t, 19.99, order.Money, 0.000001)

	// A plan without a recurring Stripe price can still be bought with Alipay, but not as a subscription.
	body = fixture.post(SubscriptionRequestStripePay, `{"plan_id":4212,"payment_method":"alipay"}`)
	assert.Contains(t, body, `"pay_link":"https://checkout.stripe.test/pay/3"`)
	require.Len(t, fixture.checkout, 3)
	assert.Equal(t, "payment", fixture.checkout[2].Get("mode"))
	assert.Equal(t, "500", fixture.checkout[2].Get("line_items[0][price_data][unit_amount]"))
	assert.Equal(t, "alipay", fixture.checkout[2].Get("payment_method_types[0]"))
	body = fixture.post(SubscriptionRequestStripePay, `{"plan_id":4212}`)
	assert.Contains(t, body, "StripePriceId is not configured for this plan")

	// Methods that are not routed through Stripe are refused before Stripe is called.
	body = fixture.post(SubscriptionRequestStripePay, `{"plan_id":4211,"payment_method":"custom1"}`)
	assert.Contains(t, body, "Unsupported payment channel")
	assert.Len(t, fixture.checkout, 3)
	var orders int64
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Count(&orders).Error)
	assert.Equal(t, int64(3), orders)
}

func TestEpayOrdersOnlyAcceptEpayPayMethods(t *testing.T) {
	fixture := setupStripePayMethodTest(t, true, stripeRoutedPayMethodsJSON)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{Id: 4221, Title: "Pro", PriceAmount: 10, Currency: "USD", Enabled: true}).Error)
	countOrders := func() (int64, int64) {
		var topUps, subscriptions int64
		require.NoError(t, model.DB.Model(&model.TopUp{}).Count(&topUps).Error)
		require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Count(&subscriptions).Error)
		return topUps, subscriptions
	}

	assert.Contains(t, fixture.post(RequestEpay, `{"amount":10,"payment_method":"alipay"}`), "Payment method does not exist")
	assert.Contains(t, fixture.post(SubscriptionRequestEpay, `{"plan_id":4221,"payment_method":"alipay"}`), "Payment method does not exist")
	topUps, subscriptions := countOrders()
	assert.Zero(t, topUps)
	assert.Zero(t, subscriptions)

	// The Epay method configured next to them still orders through Epay.
	assert.Contains(t, fixture.post(RequestEpay, `{"amount":10,"payment_method":"custom1"}`), `"url":"https://pay.example.com/submit.php"`)

	// The same alipay entry saved without a provider is an Epay method, as before.
	require.NoError(t, operation_setting.UpdatePayMethodsByJsonString(legacyPayMethodsJSON))
	assert.Contains(t, fixture.post(RequestEpay, `{"amount":10,"payment_method":"alipay"}`), `"url":"https://pay.example.com/submit.php"`)
	assert.Contains(t, fixture.post(SubscriptionRequestEpay, `{"plan_id":4221,"payment_method":"alipay"}`), `"url":"https://pay.example.com/submit.php"`)
	var topUp model.TopUp
	require.NoError(t, model.DB.Where("payment_method = ?", "alipay").First(&topUp).Error)
	assert.Equal(t, model.PaymentProviderEpay, topUp.PaymentProvider)
	topUps, subscriptions = countOrders()
	assert.Equal(t, int64(2), topUps)
	assert.Equal(t, int64(1), subscriptions)
	assert.Empty(t, fixture.checkout, "Epay orders never call Stripe")
}

func TestGetTopUpInfoListsPayMethodsByProvider(t *testing.T) {
	t.Run("legacy entries are listed unchanged as Epay methods", func(t *testing.T) {
		setupStripePayMethodTest(t, false, legacyPayMethodsJSON)
		methods, info := topUpInfoForTest(t)
		assert.Equal(t, map[string]any{"name": "Alipay", "type": "alipay", "color": "#1677FF", "provider": "epay"}, methods["alipay"])
		assert.Equal(t, map[string]any{"name": "Custom", "type": "custom1", "min_topup": "50", "provider": "epay"}, methods["custom1"])
		assert.Len(t, methods, 2)
		assert.Equal(t, true, info["enable_online_topup"])
	})

	t.Run("routed methods are hidden while Stripe top-up is not configured", func(t *testing.T) {
		setupStripePayMethodTest(t, false, stripeRoutedPayMethodsJSON)
		methods, _ := topUpInfoForTest(t)
		assert.NotContains(t, methods, "alipay")
		assert.NotContains(t, methods, "wxpay")
		assert.NotContains(t, methods, "stripe")
		require.Contains(t, methods, "custom1")
		assert.Equal(t, "epay", methods["custom1"]["provider"])
	})

	t.Run("routed methods are listed with their provider once Stripe top-up is configured", func(t *testing.T) {
		setupStripePayMethodTest(t, true, stripeRoutedPayMethodsJSON)
		methods, _ := topUpInfoForTest(t)
		require.Contains(t, methods, "alipay")
		require.Contains(t, methods, "wxpay")
		require.Contains(t, methods, "stripe")
		assert.Equal(t, "stripe", methods["alipay"]["provider"])
		assert.Equal(t, "stripe", methods["wxpay"]["provider"])
		assert.Equal(t, "stripe", methods["stripe"]["provider"])
		assert.Equal(t, "epay", methods["custom1"]["provider"])
		// The response is built from copies: the configured entries stay untouched.
		assert.NotContains(t, operation_setting.PayMethods[2], "provider")
	})

	t.Run("Stripe-routed methods alone do not enable Epay top-up", func(t *testing.T) {
		setupStripePayMethodTest(t, true, `[{"name":"Alipay","type":"alipay","provider":"stripe"}]`)
		_, info := topUpInfoForTest(t)
		assert.Equal(t, false, info["enable_online_topup"])
		assert.Equal(t, true, info["enable_stripe_topup"])
	})
}

func TestEpayCallbackCompletesOrderPlacedBeforeMethodsMovedToStripe(t *testing.T) {
	// Every method is now routed through Stripe, but an order placed through
	// Epay before the change is still waiting for its callback.
	fixture := setupStripePayMethodTest(t, true, `[{"name":"Alipay","type":"alipay","provider":"stripe"},{"name":"WeChat","type":"wxpay","provider":"stripe"}]`)
	require.NoError(t, model.DB.Create(&model.TopUp{
		UserId: fixture.userID, Amount: 10, Money: 73, TradeNo: "USR4201NOpending",
		PaymentMethod: "alipay", PaymentProvider: model.PaymentProviderEpay, Status: common.TopUpStatusPending,
	}).Error)
	callback, err := GetEpayClient().SignParams(map[string]string{
		"type": "alipay", "money": "73.00", "name": "TUC10", "out_trade_no": "USR4201NOpending", "trade_status": "TRADE_SUCCESS",
	})
	require.NoError(t, err)
	query := url.Values{}
	for key, value := range callback {
		query.Set(key, value)
	}

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/user/epay/notify?"+query.Encode(), nil)
	EpayNotify(c)

	assert.Equal(t, "success", recorder.Body.String())
	var order model.TopUp
	require.NoError(t, model.DB.Where("trade_no = ?", "USR4201NOpending").First(&order).Error)
	assert.Equal(t, common.TopUpStatusSuccess, order.Status)
	var user model.User
	require.NoError(t, model.DB.First(&user, fixture.userID).Error)
	assert.Equal(t, int(10*common.QuotaPerUnit), user.Quota)

	// New Epay orders stay closed: no method is routed through Epay any more.
	_, info := topUpInfoForTest(t)
	assert.Equal(t, false, info["enable_online_topup"])
	assert.Contains(t, fixture.post(RequestEpay, `{"amount":10,"payment_method":"alipay"}`), "Payment method does not exist")
}

func TestStripeWebhookCompletesRoutedPayMethodOrdersOnce(t *testing.T) {
	fixture := setupStripePayMethodTest(t, true, stripeRoutedPayMethodsJSON)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id: 4231, Title: "Pro", PriceAmount: 19.99, Currency: "USD", Enabled: true,
		DurationUnit: "month", DurationValue: 1,
	}).Error)
	require.Contains(t, fixture.post(RequestStripePay, `{"amount":20,"payment_method":"alipay"}`), "pay_link")
	require.Contains(t, fixture.post(SubscriptionRequestStripePay, `{"plan_id":4231,"payment_method":"wxpay"}`), "pay_link")
	require.Len(t, fixture.checkout, 2)

	// Stripe delivers each paid Checkout Session twice.
	for _, form := range fixture.checkout {
		payload := fmt.Sprintf(`{"id":"evt_test","object":"event","type":"checkout.session.completed","data":{"object":{"id":"cs_test","object":"checkout.session","client_reference_id":%q,"status":"complete","payment_status":"paid","customer":"cus_test","amount_total":2000,"currency":"usd"}}}`, form.Get("client_reference_id"))
		for range 2 {
			signed := webhook.GenerateTestSignedPayload(&webhook.UnsignedPayload{Payload: []byte(payload), Secret: setting.StripeWebhookSecret})
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			c.Request = httptest.NewRequest(http.MethodPost, "/api/stripe/webhook", strings.NewReader(payload))
			c.Request.Header.Set("Stripe-Signature", signed.Header)
			StripeWebhook(c)
			require.Equal(t, http.StatusOK, recorder.Code)
		}
	}

	var topUp model.TopUp
	require.NoError(t, model.DB.Where("trade_no = ?", fixture.checkout[0].Get("client_reference_id")).First(&topUp).Error)
	assert.Equal(t, common.TopUpStatusSuccess, topUp.Status)
	assert.Equal(t, "alipay", topUp.PaymentMethod)
	var user model.User
	require.NoError(t, model.DB.First(&user, fixture.userID).Error)
	assert.Equal(t, int(20*common.QuotaPerUnit), user.Quota, "the wallet is credited once")

	var order model.SubscriptionOrder
	require.NoError(t, model.DB.Where("trade_no = ?", fixture.checkout[1].Get("client_reference_id")).First(&order).Error)
	assert.Equal(t, common.TopUpStatusSuccess, order.Status)
	assert.Equal(t, "wxpay", order.PaymentMethod)
	var subscriptions int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("user_id = ?", fixture.userID).Count(&subscriptions).Error)
	assert.Equal(t, int64(1), subscriptions, "the plan is granted once")
}
