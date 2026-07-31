package controller

import (
	"context"
	"encoding/json"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestCreemSignatureVerification(t *testing.T) {
	payload := `{"id":"evt_safe"}`
	signature := generateCreemSignature(payload, "whsec_safe")
	assert.True(t, verifyCreemSignature(payload, signature, "whsec_safe"))
	assert.False(t, verifyCreemSignature(payload, signature, "wrong"))
	assert.False(t, verifyCreemSignature(payload, signature, ""))
}

func TestCreemRuntimeCatalogReturnsSafeFieldsAndMode(t *testing.T) {
	originalProducts, originalMode := setting.CreemProducts, setting.CreemTestMode
	t.Cleanup(func() { setting.CreemProducts, setting.CreemTestMode = originalProducts, originalMode })
	setting.CreemProducts = `[{"productId":"prod_public","name":"Starter","price":9.5,"currency":"USD","quota":1000,"popular":true}]`
	setting.CreemTestMode = true
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	GetCreemProducts(context)
	assert.Contains(t, recorder.Body.String(), `"product_id":"prod_public"`)
	assert.Contains(t, recorder.Body.String(), `"mode":"test"`)
	assert.NotContains(t, recorder.Body.String(), "api_key")
}

func TestCreemLiveConfigurationValidationDoesNotEchoSecrets(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest("PUT", "/api/option/creem/configuration", strings.NewReader(`{"api_key":"api_key_must_not_echo","webhook_secret":"","products":[],"test_mode":false}`))
	UpdateCreemConfiguration(context)
	assert.NotContains(t, recorder.Body.String(), "api_key_must_not_echo")
	assert.Contains(t, recorder.Body.String(), "webhook secret")
}

func TestCreemFlexibleObjectOrIDParsing(t *testing.T) {
	for _, raw := range []string{`{"id":"evt_1","eventType":"checkout.completed","object":{"subscription":{"id":"sub_object","product":{"id":"prod_object"},"customer":"cus_string"}}}`, `{"id":"evt_2","eventType":"checkout.completed","object":{"subscription":"sub_string"}}`} {
		var event CreemWebhookPayload
		require.NoError(t, common.Unmarshal([]byte(raw), &event))
		subscription, err := event.subscription()
		require.NoError(t, err)
		assert.NotEmpty(t, subscription.Id)
	}
}

func TestCreemTimestampsAcceptRFC3339AndNumeric(t *testing.T) {
	var event CreemWebhookPayload
	require.NoError(t, common.Unmarshal([]byte(`{"id":"evt","eventType":"subscription.paid","object":{"id":"sub","current_period_start_date":"2024-01-01T00:00:00Z","current_period_end_date":1706745600000}}`), &event))
	subscription, err := event.subscription()
	require.NoError(t, err)
	assert.EqualValues(t, 1704067200, subscription.CurrentPeriodStart)
	assert.EqualValues(t, 1706745600, subscription.CurrentPeriodEnd)
}

func TestCreemEventTimestampsNormalizeToMilliseconds(t *testing.T) {
	for _, test := range []struct {
		raw      string
		expected int64
	}{
		{raw: `1704067200`, expected: 1704067200000},
		{raw: `1704067200123`, expected: 1704067200123},
		{raw: `"2024-01-01T00:00:00.123Z"`, expected: 1704067200123},
	} {
		var event CreemWebhookPayload
		require.NoError(t, common.Unmarshal([]byte(`{"id":"evt","eventType":"subscription.active","created_at":`+test.raw+`,"object":{}}`), &event))
		assert.Equal(t, test.expected, int64(event.CreatedAt))
	}
}

func TestCreemOnetimeContractUsesDocumentedFallbackFields(t *testing.T) {
	body := []byte(`{"id":"evt_onetime","eventType":"checkout.completed","created_at":1704067200,"object":{"request_id":"ref_onetime","order":{"id":"ord_onetime","type":"onetime","status":"paid","transaction":"txn_onetime","product":{"id":"prod_onetime","price":950,"currency":"USD"}}}}`)
	var event CreemWebhookPayload
	require.NoError(t, common.Unmarshal(body, &event))
	input := creemOnetimePaymentInput(&event, body)
	assert.Equal(t, "prod_onetime", input.ProductId)
	assert.EqualValues(t, 950, input.Amount)
	assert.Equal(t, "USD", input.Currency)
	assert.Equal(t, "txn_onetime", input.TransactionId)
	assert.EqualValues(t, 1704067200000, input.EventCreatedAt)
}

func readCreemFixture(t *testing.T, name string) []byte {
	t.Helper()
	body, err := os.ReadFile(filepath.Join("testdata", "creem", name))
	require.NoError(t, err)
	return body
}

func TestCreemRealRecurringFixturesExtractStablePaymentIdentity(t *testing.T) {
	paidBody := readCreemFixture(t, "subscription_paid.json")
	checkoutBody := readCreemFixture(t, "checkout_completed_recurring.json")
	var paid, checkout CreemWebhookPayload
	require.NoError(t, common.Unmarshal(paidBody, &paid))
	require.NoError(t, common.Unmarshal(checkoutBody, &checkout))

	paidSubscription, err := paid.subscription()
	require.NoError(t, err)
	checkoutSubscription, err := checkout.subscription()
	require.NoError(t, err)
	paidInput := creemPaymentInput(&paid, paidBody, paidSubscription)
	checkoutInput := creemPaymentInput(&checkout, checkoutBody, checkoutSubscription)

	assert.Equal(t, "subscription.paid", paid.EventType)
	assert.Less(t, int64(paid.CreatedAt), int64(checkout.CreatedAt))
	assert.Equal(t, "fixture_trade_001", paidInput.TradeNo)
	assert.Equal(t, checkoutInput.TradeNo, paidInput.TradeNo)
	assert.Equal(t, checkoutInput.SubscriptionId, paidInput.SubscriptionId)
	assert.Equal(t, checkoutInput.TransactionId, paidInput.TransactionId)
	assert.Equal(t, checkoutInput.ProductId, paidInput.ProductId)
	assert.Equal(t, checkoutInput.PeriodStart, paidInput.PeriodStart)
	assert.Equal(t, checkoutInput.PeriodEnd, paidInput.PeriodEnd)
	assert.EqualValues(t, 1900, paidInput.Amount)
	assert.Equal(t, "USD", paidInput.Currency)
}

func TestCreemDocumentedPaymentFieldsPopulateValidationIdentity(t *testing.T) {
	paidBody := []byte(`{"id":"evt_doc_paid","eventType":"subscription.paid","created_at":1704067200000,"object":{"id":"sub_doc","status":"active","last_transaction_id":"txn_doc","product":{"id":"prod_doc","price":1900,"currency":"USD"},"customer":"cus_doc","current_period_start_date":"2024-01-01T00:00:00Z","current_period_end_date":"2024-02-01T00:00:00Z","metadata":{"trade_no":"trade_doc"}}}`)
	var paid CreemWebhookPayload
	require.NoError(t, common.Unmarshal(paidBody, &paid))
	subscription, err := paid.subscription()
	require.NoError(t, err)
	input := creemPaymentInput(&paid, paidBody, subscription)
	assert.Equal(t, "txn_doc", input.TransactionId)
	assert.EqualValues(t, 1900, input.Amount)
	assert.Equal(t, "USD", input.Currency)
	assert.EqualValues(t, 1704067200000, input.EventCreatedAt)

	checkoutBody := []byte(`{"id":"evt_doc_checkout","eventType":"checkout.completed","created_at":1704067200000,"object":{"request_id":"trade_doc","order":{"id":"ord_doc","status":"paid","type":"recurring","transaction":"txn_doc","amount":1900,"currency":"USD"},"subscription":{"id":"sub_doc","product":"prod_doc","customer":"cus_doc","current_period_start_date":"2024-01-01T00:00:00Z","current_period_end_date":"2024-02-01T00:00:00Z"}}}`)
	var checkout CreemWebhookPayload
	require.NoError(t, common.Unmarshal(checkoutBody, &checkout))
	subscription, err = checkout.subscription()
	require.NoError(t, err)
	input = creemPaymentInput(&checkout, checkoutBody, subscription)
	assert.EqualValues(t, 1900, input.Amount)
	assert.Equal(t, "USD", input.Currency)
}

func TestCreemWebhookSummaryExcludesCustomerAndMetadata(t *testing.T) {
	body := []byte(`{"id":"evt_summary","eventType":"subscription.paid","created_at":1704067200000,"object":{"id":"sub_summary","status":"active","last_transaction_id":"txn_summary","product":{"id":"prod_summary","price":1900,"currency":"USD"},"customer":{"id":"cus_summary","email":"person@example.com","name":"Private Person"},"current_period_start_date":"2024-01-01T00:00:00Z","current_period_end_date":"2024-02-01T00:00:00Z","metadata":{"trade_no":"trade_summary","private":"secret"}}}`)
	var event CreemWebhookPayload
	require.NoError(t, common.Unmarshal(body, &event))
	subscription, err := event.subscription()
	require.NoError(t, err)
	input := creemPaymentInput(&event, body, subscription)
	summary, err := creemWebhookSummary(&event, input)
	require.NoError(t, err)
	assert.Contains(t, summary, "txn_summary")
	assert.Contains(t, summary, "trade_summary")
	assert.NotContains(t, summary, "person@example.com")
	assert.NotContains(t, strings.ToLower(summary), "customer")
	assert.NotContains(t, summary, "metadata")
}

func TestScheduleCreemSubscriptionCancelCallsProviderAfterReactivationAndWhenUnpaid(t *testing.T) {
	oldDB := model.DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	t.Cleanup(func() { model.DB = oldDB })
	require.NoError(t, db.AutoMigrate(&model.CreemSubscriptionLink{}))

	originalKey := setting.CreemApiKey
	setting.CreemApiKey = "test_key"
	t.Cleanup(func() { setting.CreemApiKey = originalKey })
	originalRequest := requestCreemScheduledCancel
	calls := make(map[string]int)
	requestCreemScheduledCancel = func(_ context.Context, _ creemConfigSnapshot, subscriptionId string) error {
		calls[subscriptionId]++
		return nil
	}
	t.Cleanup(func() { requestCreemScheduledCancel = originalRequest })

	for _, test := range []struct {
		name   string
		userId int
		status string
	}{
		{name: "reactivated", userId: 9501, status: "active"},
		{name: "unpaid", userId: 9502, status: "unpaid"},
	} {
		t.Run(test.name, func(t *testing.T) {
			subscriptionId := "sub_cancel_" + test.name
			require.NoError(t, db.Create(&model.CreemSubscriptionLink{CreemSubscriptionId: subscriptionId, UserId: test.userId, PlanId: 1, ProviderStatus: test.status, CancelAtPeriodEnd: true}).Error)
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Set("id", test.userId)
			ctx.Request = httptest.NewRequest("POST", "/api/subscription/creem/cancel", strings.NewReader(`{"subscription_id":"`+subscriptionId+`"}`))
			ScheduleCreemSubscriptionCancel(ctx)
			assert.Equal(t, 200, recorder.Code)
			assert.Equal(t, 1, calls[subscriptionId])
			var link model.CreemSubscriptionLink
			require.NoError(t, db.Where("creem_subscription_id = ?", subscriptionId).First(&link).Error)
			assert.Equal(t, "scheduled_cancel", link.ProviderStatus)
		})
	}
}

func TestGenericOptionEndpointRejectsPartialCreemCutover(t *testing.T) {
	recorder := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(recorder)
	context.Request = httptest.NewRequest("PUT", "/api/option", strings.NewReader(`{"key":"CreemApiKey","value":"secret_must_not_echo"}`))
	UpdateOption(context)
	assert.Contains(t, recorder.Body.String(), "updated atomically")
	assert.NotContains(t, recorder.Body.String(), "secret_must_not_echo")
}

func TestCreemSubscriptionPaymentDTOExposesOnlyUserBillingFields(t *testing.T) {
	payments := mapCreemSubscriptionPayments([]model.CreemSubscriptionPayment{{
		Id:                  1,
		CreemTransactionId:  "txn_internal",
		CreemEventId:        "evt_internal",
		CreemOrderId:        "ord_internal",
		CreemSubscriptionId: "sub_internal",
		UserId:              42,
		PlanId:              7,
		UserSubscriptionId:  8,
		Amount:              1900,
		Currency:            "USD",
		PeriodStart:         1704067200,
		PeriodEnd:           1706745600,
		CreatedAt:           1704067201,
	}})
	body, err := json.Marshal(payments)
	require.NoError(t, err)
	assert.JSONEq(t, `[{"id":1,"plan_id":7,"user_subscription_id":8,"amount":1900,"currency":"USD","period_start":1704067200,"period_end":1706745600,"created_at":1704067201}]`, string(body))
	assert.NotContains(t, string(body), "txn_internal")
	assert.NotContains(t, string(body), "user_id")
}
