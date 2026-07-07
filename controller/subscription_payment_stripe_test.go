package controller

import (
	"bytes"
	"crypto/tls"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/stripe/stripe-go/v81"
)

type subscriptionStripePayResponse struct {
	Message string                 `json:"message"`
	Data    map[string]interface{} `json:"data"`
}

func TestSubscriptionRequestStripePayReturnsTradeNo(t *testing.T) {
	require.NoError(t, i18n.Init())
	gin.SetMode(gin.TestMode)
	confirmPaymentComplianceForTest(t)
	setupSubscriptionAlipayTestDB(t)

	originalStripeSecret := setting.StripeApiSecret
	originalWebhookSecret := setting.StripeWebhookSecret
	originalStripeKey := stripe.Key
	originalBackend := stripe.GetBackend(stripe.APIBackend)
	t.Cleanup(func() {
		setting.StripeApiSecret = originalStripeSecret
		setting.StripeWebhookSecret = originalWebhookSecret
		stripe.Key = originalStripeKey
		stripe.SetBackend(stripe.APIBackend, originalBackend)
	})

	setting.StripeApiSecret = "sk_test_subscription"
	setting.StripeWebhookSecret = "whsec_subscription"

	mockStripe := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, http.MethodPost, r.Method)
		require.Equal(t, "/v1/checkout/sessions", r.URL.Path)
		w.Header().Set("Content-Type", "application/json")
		_, err := fmt.Fprint(w, `{"id":"cs_test_subscription","object":"checkout.session","url":"https://checkout.stripe.com/c/pay/cs_test_subscription"}`)
		require.NoError(t, err)
	}))
	defer mockStripe.Close()

	mockClient := mockStripe.Client()
	transport, ok := mockClient.Transport.(*http.Transport)
	require.True(t, ok)
	transport.TLSClientConfig = &tls.Config{InsecureSkipVerify: true}

	stripe.SetBackend(stripe.APIBackend, stripe.GetBackendWithConfig(stripe.APIBackend, &stripe.BackendConfig{
		URL:        stripe.String(mockStripe.URL),
		HTTPClient: mockClient,
	}))

	require.NoError(t, model.DB.Create(&model.User{
		Id:             301,
		Username:       "stripe-sub-user",
		Email:          "stripe-sub-user@example.com",
		Status:         common.UserStatusEnabled,
		StripeCustomer: "",
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            401,
		Title:         "Stripe Pro",
		PriceAmount:   19.99,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   1000,
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 301)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/stripe/pay", bytes.NewBufferString(`{"plan_id":401}`))
	c.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestStripePay(c)

	require.Equal(t, http.StatusOK, recorder.Code)

	var payload subscriptionStripePayResponse
	require.NoError(t, common.Unmarshal(recorder.Body.Bytes(), &payload))
	require.Equal(t, "success", payload.Message)
	require.Equal(t, "https://checkout.stripe.com/c/pay/cs_test_subscription", payload.Data["pay_link"])

	tradeNo, ok := payload.Data["trade_no"].(string)
	require.True(t, ok)
	require.NotEmpty(t, tradeNo)
	require.Contains(t, tradeNo, "sub_ref_")

	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	require.NotNil(t, order)
	require.Equal(t, 301, order.UserId)
	require.Equal(t, 401, order.PlanId)
	require.Equal(t, tradeNo, order.TradeNo)
}
