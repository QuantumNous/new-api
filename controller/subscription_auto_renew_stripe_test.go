package controller

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v81"
	"gorm.io/gorm"
)

func stripeTestSignature(payload string, secret string) string {
	timestamp := time.Now().Unix()
	signedPayload := fmt.Sprintf("%d.%s", timestamp, payload)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(signedPayload))
	return fmt.Sprintf("t=%d,v1=%s", timestamp, hex.EncodeToString(mac.Sum(nil)))
}

func TestStripeWebhookRetriesRecurringHandlerFailure(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	originalWebhookSecret := setting.StripeWebhookSecret
	t.Cleanup(func() {
		setting.StripeWebhookSecret = originalWebhookSecret
	})
	setting.StripeWebhookSecret = "whsec_recurring_retry"

	payload := `{"id":"evt_recurring_retry","type":"invoice.paid","data":{"object":{"id":"in_invalid_period","subscription":"sub_invalid_period","status":"paid","lines":{"data":[]}}}}`
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/stripe/webhook", strings.NewReader(payload))
	c.Request.Header.Set("Stripe-Signature", stripeTestSignature(payload, setting.StripeWebhookSecret))

	StripeWebhook(c)

	require.Equal(t, http.StatusInternalServerError, recorder.Code)
}

func TestAdminCreateSubscriptionPlan_RejectsAutoRenewWithoutStripeRecurringPriceID(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	setupSubscriptionControllerTestDB(t)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/admin/plans",
		strings.NewReader(`{"plan":{"title":"Auto Renew","price_amount":19.99,"currency":"USD","duration_unit":"month","duration_value":1,"total_amount":1000,"billing_mode":"auto_renew","enabled":true}}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	AdminCreateSubscriptionPlan(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), `"success":false`)

	var count int64
	require.NoError(t, model.DB.Model(&model.SubscriptionPlan{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestSubscriptionRequestStripeAutoRenew_RejectsSecondRecurringContract(t *testing.T) {
	confirmPaymentComplianceForTest(t)
	setupSubscriptionControllerTestDB(t)

	require.NoError(t, model.DB.Create(&model.User{
		Id:       301,
		Username: "stripe-recurring-user",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:                     401,
		Title:                  "Stripe Recurring Pro",
		PriceAmount:            19.99,
		Currency:               "USD",
		DurationUnit:           model.SubscriptionDurationMonth,
		DurationValue:          1,
		Enabled:                true,
		TotalAmount:            1000,
		BillingMode:            model.SubscriptionBillingModeAutoRenew,
		StripeRecurringPriceId: "price_recurring_pro",
	}).Error)
	require.NoError(t, model.DB.Create(&model.BillingSubscription{
		UserId:                 301,
		PlanId:                 401,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_existing_1",
		Status:                 "active",
		CurrentPeriodEnd:       common.GetTimestamp() + 3600,
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 301)
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/api/subscription/stripe/checkout/auto-renew",
		strings.NewReader(`{"plan_id":401}`),
	)
	c.Request.Header.Set("Content-Type", "application/json")

	SubscriptionRequestStripeAutoRenew(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), "auto-renew")
}

func TestValidateOneTimeSubscriptionPlan_RejectsAutoRenewPlans(t *testing.T) {
	err := validateOneTimeSubscriptionPlan(&model.SubscriptionPlan{
		BillingMode: model.SubscriptionBillingModeAutoRenew,
	})

	require.EqualError(t, err, "auto_renew plans must use the recurring checkout endpoints")
}

func TestHandleRecurringCheckoutSessionCompleted_UpsertsBillingSubscription(t *testing.T) {
	setupSubscriptionControllerTestDB(t)

	raw, err := common.Marshal(map[string]any{
		"id":           "cs_test_recurring_1",
		"mode":         "subscription",
		"subscription": "sub_auto_renew_123",
		"customer":     "cus_auto_renew_123",
		"metadata": map[string]string{
			"user_id": "401",
			"plan_id": "501",
		},
	})
	require.NoError(t, err)

	event := stripe.Event{
		Type: stripe.EventTypeCheckoutSessionCompleted,
		Data: &stripe.EventData{
			Raw: raw,
		},
	}

	require.NoError(t, handleRecurringCheckoutSessionCompleted(event))

	sub, err := model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_auto_renew_123")
	require.NoError(t, err)
	require.Equal(t, 401, sub.UserId)
	require.Equal(t, 501, sub.PlanId)
	require.Equal(t, "cus_auto_renew_123", sub.ProviderCustomerId)
	require.Equal(t, "incomplete", sub.Status)
}

func TestHandleRecurringInvoicePaid_CreatesCycleSubscriptionIdempotently(t *testing.T) {
	setupSubscriptionControllerTestDB(t)

	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:                     601,
		Title:                  "Stripe Recurring Cycle",
		PriceAmount:            29.99,
		Currency:               "USD",
		DurationUnit:           model.SubscriptionDurationMonth,
		DurationValue:          1,
		Enabled:                true,
		TotalAmount:            3000,
		BillingMode:            model.SubscriptionBillingModeAutoRenew,
		StripeRecurringPriceId: "price_cycle_601",
	}).Error)
	require.NoError(t, model.DB.Create(&model.BillingSubscription{
		UserId:                 701,
		PlanId:                 601,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_cycle_paid_1",
		Status:                 "incomplete",
	}).Error)

	raw, err := common.Marshal(map[string]any{
		"id":           "in_cycle_123",
		"subscription": "sub_cycle_paid_1",
		"customer":     "cus_cycle_123",
		"status":       "paid",
		"lines": map[string]any{
			"data": []map[string]any{
				{
					"period": map[string]any{
						"start": int64(1761955200),
						"end":   int64(1764547200),
					},
				},
			},
		},
	})
	require.NoError(t, err)

	event := stripe.Event{
		Type: stripe.EventTypeInvoicePaid,
		Data: &stripe.EventData{
			Raw: raw,
		},
	}

	require.NoError(t, handleRecurringInvoicePaid(event))
	require.NoError(t, handleRecurringInvoicePaid(event))

	var subs []model.UserSubscription
	require.NoError(t, model.DB.Where("provider_invoice_id = ?", "in_cycle_123").Find(&subs).Error)
	require.Len(t, subs, 1)
	require.Equal(t, 701, subs[0].UserId)
	require.Equal(t, 601, subs[0].PlanId)
	require.Equal(t, "auto_renew", subs[0].Source)

	var attempts []model.RecurringChargeAttempt
	require.NoError(t, model.DB.Where("provider = ? AND provider_invoice_id = ?", "stripe", "in_cycle_123").Find(&attempts).Error)
	require.Len(t, attempts, 1)
	require.Equal(t, "paid", attempts[0].Status)

	contract, err := model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_cycle_paid_1")
	require.NoError(t, err)
	require.Equal(t, "active", contract.Status)
	require.Equal(t, "in_cycle_123", contract.LastInvoiceId)
	require.Equal(t, int64(1761955200), contract.CurrentPeriodStart)
	require.Equal(t, int64(1764547200), contract.CurrentPeriodEnd)
}

func TestHandleRecurringInvoicePaid_PersistsBeforeCheckoutCompletion(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{Id: 711, Username: "out-of-order-user", Status: common.UserStatusEnabled}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{
		Id:                     712,
		Title:                  "Out of Order Plan",
		PriceAmount:            19.99,
		Currency:               "USD",
		DurationUnit:           model.SubscriptionDurationMonth,
		DurationValue:          1,
		Enabled:                true,
		TotalAmount:            3000,
		BillingMode:            model.SubscriptionBillingModeAutoRenew,
		StripeRecurringPriceId: "price_out_of_order",
	}).Error)

	raw, err := common.Marshal(map[string]any{
		"id":           "in_before_checkout",
		"subscription": "sub_before_checkout",
		"status":       "paid",
		"lines":        map[string]any{"data": []map[string]any{{"period": map[string]any{"start": int64(1761955200), "end": int64(1764547200)}}}},
	})
	require.NoError(t, err)
	require.NoError(t, handleRecurringInvoicePaid(stripe.Event{Type: stripe.EventTypeInvoicePaid, Data: &stripe.EventData{Raw: raw}}))

	var attempts []model.RecurringChargeAttempt
	require.NoError(t, model.DB.Where("provider = ? AND provider_invoice_id = ?", "stripe", "in_before_checkout").Find(&attempts).Error)
	require.Len(t, attempts, 1)
	require.Equal(t, "pending_contract", attempts[0].Status)
	require.Equal(t, "sub_before_checkout", attempts[0].ProviderSubscriptionId)
}

func TestHandleRecurringCheckoutSessionCompleted_FulfillsPendingInvoice(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{Id: 721, Username: "pending-invoice-user", Status: common.UserStatusEnabled}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{Id: 722, Title: "Pending Invoice Plan", PriceAmount: 19.99, Currency: "USD", DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1, Enabled: true, TotalAmount: 3000, BillingMode: model.SubscriptionBillingModeAutoRenew, StripeRecurringPriceId: "price_pending_invoice"}).Error)
	_, err := model.CreatePendingStripeAutoRenewSignup(721, 722, "signup_pending_invoice")
	require.NoError(t, err)
	require.NoError(t, model.RecordPendingStripeInvoice(&model.RecurringChargeAttempt{ProviderInvoiceId: "in_pending_invoice", ProviderSubscriptionId: "sub_pending_invoice", PeriodStart: 1761955200, PeriodEnd: 1764547200, ProviderPayload: `{"status":"paid","customer":"cus_pending_invoice"}`}))

	raw, err := common.Marshal(map[string]any{"id": "cs_pending_invoice", "mode": "subscription", "subscription": "sub_pending_invoice", "customer": "cus_pending_invoice", "metadata": map[string]string{"user_id": "721", "plan_id": "722", "signup_reference": "signup_pending_invoice"}})
	require.NoError(t, err)
	require.NoError(t, handleRecurringCheckoutSessionCompleted(stripe.Event{Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Raw: raw}}))

	var subscriptions []model.UserSubscription
	require.NoError(t, model.DB.Where("provider_invoice_id = ?", "in_pending_invoice").Find(&subscriptions).Error)
	require.Len(t, subscriptions, 1)

	contract, err := model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_pending_invoice")
	require.NoError(t, err)
	require.Equal(t, "active", contract.Status)
	require.Equal(t, int64(1761955200), contract.CurrentPeriodStart)
	require.Equal(t, int64(1764547200), contract.CurrentPeriodEnd)
	require.Equal(t, "in_pending_invoice", contract.LastInvoiceId)
	require.Equal(t, "paid", contract.LastPaymentStatus)
}

func TestHandleRecurringCheckoutSessionCompleted_ReplayDoesNotDowngradeActiveContract(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{Id: 725, Username: "replayed-checkout-user", Status: common.UserStatusEnabled}).Error)
	require.NoError(t, model.DB.Create(&model.SubscriptionPlan{Id: 726, Title: "Replayed Checkout Plan", PriceAmount: 19.99, Currency: "USD", DurationUnit: model.SubscriptionDurationMonth, DurationValue: 1, Enabled: true, TotalAmount: 3000, BillingMode: model.SubscriptionBillingModeAutoRenew, StripeRecurringPriceId: "price_replayed_checkout"}).Error)
	require.NoError(t, func() error {
		_, err := model.CreatePendingStripeAutoRenewSignup(725, 726, "signup_replayed_checkout")
		return err
	}())

	raw, err := common.Marshal(map[string]any{"id": "cs_replayed_checkout", "mode": "subscription", "subscription": "sub_replayed_checkout", "customer": "cus_replayed_checkout", "metadata": map[string]string{"user_id": "725", "plan_id": "726", "signup_reference": "signup_replayed_checkout"}})
	require.NoError(t, err)
	event := stripe.Event{Type: stripe.EventTypeCheckoutSessionCompleted, Data: &stripe.EventData{Raw: raw}}
	require.NoError(t, handleRecurringCheckoutSessionCompleted(event))

	contract, err := model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_replayed_checkout")
	require.NoError(t, err)
	require.NoError(t, model.FulfillRecurringInvoice(&model.RecurringChargeAttempt{BillingSubscriptionId: contract.Id, Provider: "stripe", ProviderInvoiceId: "in_replayed_checkout", PeriodStart: 1761955200, PeriodEnd: 1764547200, PaymentStatus: "paid", ProviderPayload: `{"status":"paid"}`}))

	require.NoError(t, handleRecurringCheckoutSessionCompleted(event))
	contract, err = model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_replayed_checkout")
	require.NoError(t, err)
	require.Equal(t, "active", contract.Status)
	require.Equal(t, int64(1761955200), contract.CurrentPeriodStart)
	require.Equal(t, int64(1764547200), contract.CurrentPeriodEnd)
}

func TestHandleRecurringCheckoutSessionExpired_ReleasesPendingSignup(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.User{Id: 731, Username: "expired-signup-user", Status: common.UserStatusEnabled}).Error)
	contract, err := model.CreatePendingStripeAutoRenewSignup(731, 732, "signup_expired_1")
	require.NoError(t, err)

	raw, err := common.Marshal(map[string]any{"id": "cs_expired_1", "mode": "subscription", "metadata": map[string]string{"signup_reference": "signup_expired_1"}})
	require.NoError(t, err)
	require.NoError(t, handleRecurringCheckoutSessionExpired(stripe.Event{Type: stripe.EventTypeCheckoutSessionExpired, Data: &stripe.EventData{Raw: raw}}))

	var updated model.BillingSubscription
	require.NoError(t, model.DB.First(&updated, contract.Id).Error)
	require.Equal(t, "signup_expired", updated.Status)

	blocked, err := model.HasNonEndedAutoRenewContract(731)
	require.NoError(t, err)
	require.False(t, blocked)
}

func TestHandleRecurringInvoicePaymentFailed_MarksContractPastDue(t *testing.T) {
	setupSubscriptionControllerTestDB(t)

	require.NoError(t, model.DB.Create(&model.BillingSubscription{
		UserId:                 801,
		PlanId:                 802,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_failed_1",
		ProviderCustomerId:     "cus_failed_1",
		Status:                 "active",
		CurrentPeriodStart:     1761955200,
		CurrentPeriodEnd:       1764547200,
	}).Error)

	raw, err := common.Marshal(map[string]any{
		"id":           "in_failed_123",
		"subscription": "sub_failed_1",
		"customer":     "cus_failed_1",
		"status":       "open",
	})
	require.NoError(t, err)

	event := stripe.Event{
		Type: stripe.EventTypeInvoicePaymentFailed,
		Data: &stripe.EventData{Raw: raw},
	}

	require.NoError(t, handleRecurringInvoicePaymentFailed(event))

	contract, err := model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_failed_1")
	require.NoError(t, err)
	require.Equal(t, "past_due", contract.Status)
	require.Equal(t, "in_failed_123", contract.LastInvoiceId)
	require.Equal(t, "open", contract.LastPaymentStatus)

	var attempts []model.RecurringChargeAttempt
	require.NoError(t, model.DB.Where("provider = ? AND provider_invoice_id = ?", "stripe", "in_failed_123").Find(&attempts).Error)
	require.Len(t, attempts, 1)
	require.Equal(t, "failed", attempts[0].Status)
}

func TestHandleRecurringInvoicePaymentFailed_DoesNotDowngradePaidInvoice(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.BillingSubscription{UserId: 811, PlanId: 812, Provider: "stripe", ProviderSubscriptionId: "sub_paid_failure_1", Status: "active"}).Error)
	contract, err := model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_paid_failure_1")
	require.NoError(t, err)
	require.NoError(t, model.DB.Create(&model.RecurringChargeAttempt{BillingSubscriptionId: contract.Id, Provider: "stripe", ProviderInvoiceId: "in_paid_failure_1", Status: "paid"}).Error)

	raw, err := common.Marshal(map[string]any{"id": "in_paid_failure_1", "subscription": "sub_paid_failure_1", "customer": "cus_paid_failure_1", "status": "open"})
	require.NoError(t, err)
	require.NoError(t, handleRecurringInvoicePaymentFailed(stripe.Event{Type: stripe.EventTypeInvoicePaymentFailed, Data: &stripe.EventData{Raw: raw}}))

	contract, err = model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_paid_failure_1")
	require.NoError(t, err)
	require.Equal(t, "active", contract.Status)
	var attempt model.RecurringChargeAttempt
	require.NoError(t, model.DB.Where("provider = ? AND provider_invoice_id = ?", "stripe", "in_paid_failure_1").First(&attempt).Error)
	require.Equal(t, "paid", attempt.Status)
}

func TestHandleRecurringInvoicePaymentFailed_RequiresInvoiceID(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.BillingSubscription{UserId: 821, PlanId: 822, Provider: "stripe", ProviderSubscriptionId: "sub_no_invoice_id", Status: "active"}).Error)

	raw, err := common.Marshal(map[string]any{"subscription": "sub_no_invoice_id", "customer": "cus_no_invoice_id", "status": "open"})
	require.NoError(t, err)
	err = handleRecurringInvoicePaymentFailed(stripe.Event{Type: stripe.EventTypeInvoicePaymentFailed, Data: &stripe.EventData{Raw: raw}})
	require.Error(t, err)

	contract, err := model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_no_invoice_id")
	require.NoError(t, err)
	require.Equal(t, "active", contract.Status)
}

func TestHandleRecurringSubscriptionUpdated_SyncsCancelAtPeriodEnd(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.BillingSubscription{
		UserId:                 831,
		PlanId:                 832,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_updated_1",
		Status:                 "active",
		CancelAtPeriodEnd:      false,
		CurrentPeriodStart:     1761955200,
		CurrentPeriodEnd:       1764547200,
	}).Error)

	raw, err := common.Marshal(map[string]any{
		"id":                   "sub_updated_1",
		"customer":             "cus_updated_1",
		"status":               "active",
		"cancel_at_period_end": true,
		"current_period_start": int64(1761955200),
		"current_period_end":   int64(1764547200),
	})
	require.NoError(t, err)
	require.NoError(t, handleRecurringSubscriptionUpdated(stripe.Event{
		Type: stripe.EventTypeCustomerSubscriptionUpdated,
		Data: &stripe.EventData{Raw: raw},
	}))

	contract, err := model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_updated_1")
	require.NoError(t, err)
	require.True(t, contract.CancelAtPeriodEnd)
	require.Equal(t, "active", contract.Status)
}

func TestHandleRecurringSubscriptionUpdated_DoesNotReopenCanceled(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	require.NoError(t, model.DB.Create(&model.BillingSubscription{
		UserId:                 841,
		PlanId:                 842,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_updated_canceled",
		Status:                 "canceled",
	}).Error)

	raw, err := common.Marshal(map[string]any{
		"id":                   "sub_updated_canceled",
		"status":               "active",
		"cancel_at_period_end": false,
		"current_period_start": int64(1761955200),
		"current_period_end":   int64(1764547200),
	})
	require.NoError(t, err)
	require.NoError(t, handleRecurringSubscriptionUpdated(stripe.Event{
		Type: stripe.EventTypeCustomerSubscriptionUpdated,
		Data: &stripe.EventData{Raw: raw},
	}))

	contract, err := model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_updated_canceled")
	require.NoError(t, err)
	require.Equal(t, "canceled", contract.Status)
}

func TestHandleRecurringSubscriptionDeleted_MarksContractCanceled(t *testing.T) {
	setupSubscriptionControllerTestDB(t)

	require.NoError(t, model.DB.Create(&model.BillingSubscription{
		UserId:                 901,
		PlanId:                 902,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_deleted_1",
		ProviderCustomerId:     "cus_deleted_1",
		Status:                 "active",
		LastInvoiceId:          "in_deleted_prev",
		LastPaymentStatus:      "paid",
		CurrentPeriodStart:     1761955200,
		CurrentPeriodEnd:       1764547200,
	}).Error)

	raw, err := common.Marshal(map[string]any{
		"id":                   "sub_deleted_1",
		"customer":             "cus_deleted_1",
		"status":               "canceled",
		"cancel_at_period_end": true,
		"current_period_start": int64(1761955200),
		"current_period_end":   int64(1764547200),
	})
	require.NoError(t, err)

	event := stripe.Event{
		Type: stripe.EventTypeCustomerSubscriptionDeleted,
		Data: &stripe.EventData{Raw: raw},
	}

	require.NoError(t, handleRecurringSubscriptionDeleted(event))

	contract, err := model.GetBillingSubscriptionByProviderSubscriptionID("stripe", "sub_deleted_1")
	require.NoError(t, err)
	require.Equal(t, "canceled", contract.Status)
	require.True(t, contract.CancelAtPeriodEnd)
	require.Equal(t, "paid", contract.LastPaymentStatus)
	require.Equal(t, "in_deleted_prev", contract.LastInvoiceId)
}

func TestGetSubscriptionSelf_IncludesAutoRenewSubscription(t *testing.T) {
	setupSubscriptionControllerTestDB(t)

	require.NoError(t, model.DB.Create(&model.User{
		Id:       1001,
		Username: "sub-self-user",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.BillingSubscription{
		UserId:                 1001,
		PlanId:                 1002,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_self_1",
		Status:                 "active",
		CancelAtPeriodEnd:      false,
		CurrentPeriodStart:     1761955200,
		CurrentPeriodEnd:       1764547200,
	}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 1001)
	c.Request = httptest.NewRequest(http.MethodGet, "/api/subscription/self", nil)

	GetSubscriptionSelf(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), "auto_renew_subscription")
	require.Contains(t, recorder.Body.String(), "sub_self_1")
}

func TestCancelSubscriptionRenewal_SetsCancelAtPeriodEnd(t *testing.T) {
	setupSubscriptionControllerTestDB(t)
	originalStripeAPISecret := setting.StripeApiSecret
	t.Cleanup(func() {
		setting.StripeApiSecret = originalStripeAPISecret
	})
	setting.StripeApiSecret = "sk_test_mock"

	require.NoError(t, model.DB.Create(&model.User{
		Id:       1101,
		Username: "cancel-renew-user",
		Status:   common.UserStatusEnabled,
	}).Error)
	require.NoError(t, model.DB.Create(&model.BillingSubscription{
		UserId:                 1101,
		PlanId:                 1102,
		Provider:               "stripe",
		ProviderSubscriptionId: "sub_cancel_1",
		ProviderCustomerId:     "cus_cancel_1",
		Status:                 "active",
		CancelAtPeriodEnd:      false,
		CurrentPeriodStart:     1761955200,
		CurrentPeriodEnd:       1764547200,
	}).Error)

	originalUpdate := stripeSubscriptionUpdate
	stripeSubscriptionUpdate = func(id string, params *stripe.SubscriptionParams) (*stripe.Subscription, error) {
		require.Equal(t, "sub_cancel_1", id)
		require.NotNil(t, params.CancelAtPeriodEnd)
		require.True(t, *params.CancelAtPeriodEnd)
		return &stripe.Subscription{
			ID:                 id,
			CancelAtPeriodEnd:  true,
			CurrentPeriodStart: 1761955200,
			CurrentPeriodEnd:   1764547200,
			Status:             stripe.SubscriptionStatusActive,
			Customer: &stripe.Customer{
				ID: "cus_cancel_1",
			},
		}, nil
	}
	t.Cleanup(func() {
		stripeSubscriptionUpdate = originalUpdate
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Set("id", 1101)
	c.Request = httptest.NewRequest(http.MethodPost, "/api/subscription/self/cancel-renewal", nil)

	CancelSubscriptionRenewal(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.Contains(t, recorder.Body.String(), "auto_renew_subscription")
	require.Contains(t, recorder.Body.String(), "\"cancel_at_period_end\":true")

	contract, err := model.GetCurrentBillingSubscriptionByUserID(1101)
	require.NoError(t, err)
	require.True(t, contract.CancelAtPeriodEnd)
	require.Equal(t, "active", contract.Status)
}

func setupSubscriptionControllerTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	gin.SetMode(gin.TestMode)
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false
	common.RedisEnabled = false

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	model.DB = db
	model.LOG_DB = db

	require.NoError(t, db.AutoMigrate(&model.User{}, &model.SubscriptionPlan{}, &model.BillingSubscription{}, &model.RecurringChargeAttempt{}, &model.UserSubscription{}))

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			_ = sqlDB.Close()
		}
	})

	return db
}
