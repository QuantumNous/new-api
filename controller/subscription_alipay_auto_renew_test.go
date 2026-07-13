package controller

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSubscriptionRequestAlipayAutoRenew_RejectsOneTimePlan(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	setupSubscriptionControllerTestDB(t)

	originalCycle := setting.AlipayCyclePayEnabled
	originalEnabled := setting.AlipayEnabled
	originalApp := setting.AlipayAppID
	originalPrivate := setting.AlipayPrivateKey
	originalPublic := setting.AlipayPublicKey
	originalGateway := setting.AlipayGateway
	t.Cleanup(func() {
		setting.AlipayCyclePayEnabled = originalCycle
		setting.AlipayEnabled = originalEnabled
		setting.AlipayAppID = originalApp
		setting.AlipayPrivateKey = originalPrivate
		setting.AlipayPublicKey = originalPublic
		setting.AlipayGateway = originalGateway
	})
	setting.AlipayCyclePayEnabled = true
	setting.AlipayEnabled = true
	setting.AlipayAppID = "app"
	setting.AlipayPrivateKey = "key"
	setting.AlipayPublicKey = "pub"
	setting.AlipayGateway = "https://openapi.alipay.com/gateway.do"

	require.NoError(t, model.DB.Create(&model.User{Id: 901, Username: "ali-ar-user", Status: common.UserStatusEnabled}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            902,
		Title:         "One Time",
		PriceAmount:   10,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		BillingMode:   model.SubscriptionBillingModeOneTime,
		AlipayEnabled: true,
		TotalAmount:   1000,
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 901)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/alipay/checkout/auto-renew", strings.NewReader(`{"plan_id":902}`))
	c.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestAlipayAutoRenew(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), "auto_renew")
}

func TestHandleAlipayAutoRenewAgreementNotify_CompletesSignup(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{Id: 911, Username: "ali-sign-user", Status: common.UserStatusEnabled}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:            912,
		Title:         "Ali AR",
		PriceAmount:   19.99,
		Currency:      "USD",
		DurationUnit:  model.SubscriptionDurationMonth,
		DurationValue: 1,
		Enabled:       true,
		BillingMode:   model.SubscriptionBillingModeAutoRenew,
		AlipayEnabled: true,
		TotalAmount:   2000,
	}).Error)
	_, err := model.CreateOrReusePendingAutoRenewSignup(model.PaymentProviderAlipay, 911, 912, "signup_ali_1")
	require.NoError(t, err)

	// Disable real charge by turning cycle pay config off after signup exists.
	// Agreement notify still completes the contract binding.
	originalCycle := setting.AlipayCyclePayEnabled
	t.Cleanup(func() { setting.AlipayCyclePayEnabled = originalCycle })
	setting.AlipayCyclePayEnabled = false

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/alipay/notify", nil)

	normalized := map[string]string{
		"external_agreement_no": "signup_ali_1",
		"agreement_no":          "2026000000001",
		"status":                "NORMAL",
		"alipay_user_id":        "208800000",
		"notify_type":           "dut_user_sign",
	}
	require.True(t, handleAlipayAutoRenewAgreementNotify(c, normalized))
	require.Equal(t, http.StatusOK, recorder.Code)

	contract, err := model.GetBillingSubscriptionByProviderSubscriptionID(model.PaymentProviderAlipay, "2026000000001")
	require.NoError(t, err)
	require.Equal(t, 911, contract.UserId)
	require.Equal(t, "pending_first_charge", contract.Status)
	require.Equal(t, "208800000", contract.ProviderCustomerId)
}

func TestHandleAlipayAutoRenewAgreementNotify_UnsignMarksCanceled(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.BillingSubscription{
		UserId:                 921,
		PlanId:                 922,
		Provider:               model.PaymentProviderAlipay,
		ProviderSubscriptionId: "agr_unsign_1",
		SignupReference:        "signup_unsign_1",
		Status:                 "active",
		CurrentPeriodEnd:       common.GetTimestamp() + 3600,
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/alipay/notify", nil)
	form := url.Values{}
	_ = form
	normalized := map[string]string{
		"external_agreement_no": "signup_unsign_1",
		"agreement_no":          "agr_unsign_1",
		"status":                "UNSIGN",
		"notify_type":           "dut_user_unsign",
	}
	require.True(t, handleAlipayAutoRenewAgreementNotify(c, normalized))

	contract, err := model.GetBillingSubscriptionByProviderSubscriptionID(model.PaymentProviderAlipay, "agr_unsign_1")
	require.NoError(t, err)
	require.Equal(t, "canceled", contract.Status)
	require.True(t, contract.CancelAtPeriodEnd)
}
