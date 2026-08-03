package model

import (
	"fmt"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func seedCreemRecurringOrder(t *testing.T, tradeNo string) {
	t.Helper()
	require.NoError(t, DB.Create(&User{Id: 7001, Username: "creem-user", Password: "password1", Group: "default"}).Error)
	allow := true
	require.NoError(t, DB.Create(&SubscriptionPlan{Id: 7101, Title: "Monthly", PriceAmount: 12, Currency: "USD", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, Enabled: true, AllowWalletOverflow: &allow, CreemProductId: "prod_recurring", TotalAmount: 9000, WeeklyAmount: 4500, MaxActivePerUser: 1, QuotaResetPeriod: SubscriptionResetNever}).Error)
	require.NoError(t, DB.Create(&SubscriptionOrder{UserId: 7001, PlanId: 7101, Money: 12, TradeNo: tradeNo, PaymentMethod: PaymentMethodCreem, PaymentProvider: PaymentProviderCreem, Status: common.TopUpStatusPending, CreateTime: common.GetTimestamp(), ContractSnapshot: true, ProviderProductId: "prod_recurring", Currency: "USD", PlanTitle: "Monthly", AmountTotal: 9000, WeeklyAmount: 4500, MaxActivePerUser: 1, AllowWalletOverflow: true}).Error)
}

func TestCreemCheckoutAndPaidUseTransactionDedupe(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_safe")
	initial := CreemPaymentInput{EventId: "evt_checkout", EventType: "checkout.completed", PayloadHash: "hash1", TradeNo: "sub_ref_safe", OrderId: "ord_1", SubscriptionId: "sub_1", TransactionId: "txn_1", CustomerId: "cus_1", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1704067200, PeriodEnd: 1706745600}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))

	paid := initial
	paid.EventId, paid.EventType, paid.PayloadHash = "evt_paid", "subscription.paid", "hash2"
	require.NoError(t, ProcessCreemRenewal(paid, `{}`))

	var subscriptions, payments, events int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", 7001).Count(&subscriptions).Error)
	require.NoError(t, DB.Model(&CreemSubscriptionPayment{}).Count(&payments).Error)
	require.NoError(t, DB.Model(&CreemWebhookEvent{}).Where("processing_status = ?", "processed").Count(&events).Error)
	assert.EqualValues(t, 1, subscriptions)
	assert.EqualValues(t, 1, payments)
	assert.EqualValues(t, 2, events)
}

func TestCreemPaidBeforeCheckoutCompletesInitialOrderOnce(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_paid_first")
	paid := CreemPaymentInput{EventId: "evt_paid_first", EventType: "subscription.paid", PayloadHash: "paid-first", TradeNo: "sub_ref_paid_first", OrderId: "ord_paid_first", SubscriptionId: "sub_paid_first", TransactionId: "txn_paid_first", CustomerId: "cus_paid_first", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1704067200, PeriodEnd: 1706745600}
	require.ErrorIs(t, ProcessCreemRenewal(paid, `{}`), ErrCreemSubscriptionLinkNotFound)
	require.NoError(t, ProcessCreemInitialPayment(paid, `{}`))

	checkout := paid
	checkout.EventId, checkout.EventType, checkout.PayloadHash = "evt_checkout_after_paid", "checkout.completed", "checkout-after-paid"
	require.NoError(t, ProcessCreemInitialPayment(checkout, `{}`))

	var subscriptions, payments, events int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", 7001).Count(&subscriptions).Error)
	require.NoError(t, DB.Model(&CreemSubscriptionPayment{}).Count(&payments).Error)
	require.NoError(t, DB.Model(&CreemWebhookEvent{}).Where("processing_status = ?", "processed").Count(&events).Error)
	assert.EqualValues(t, 1, subscriptions)
	assert.EqualValues(t, 1, payments)
	assert.EqualValues(t, 2, events)
}

func TestCreemPaymentRejectsPlanAmountAndCurrencyMismatch(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_amount")
	input := CreemPaymentInput{EventId: "evt_amount", EventType: "subscription.paid", PayloadHash: "amount", TradeNo: "sub_ref_amount", SubscriptionId: "sub_amount", TransactionId: "txn_amount", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 100, Currency: "USD", PeriodStart: 1704067200, PeriodEnd: 1706745600}
	require.ErrorContains(t, ProcessCreemInitialPayment(input, `{}`), "amount mismatch")
	input.Amount, input.Currency = 1200, "EUR"
	require.ErrorContains(t, ProcessCreemInitialPayment(input, `{}`), "currency")
	var subscriptions, payments int64
	require.NoError(t, DB.Model(&UserSubscription{}).Count(&subscriptions).Error)
	require.NoError(t, DB.Model(&CreemSubscriptionPayment{}).Count(&payments).Error)
	assert.Zero(t, subscriptions)
	assert.Zero(t, payments)
}

func TestCreemRenewalCreatesExactNewPeriodAndReplayIsNoOp(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_renew")
	initial := CreemPaymentInput{EventId: "evt_initial", EventType: "checkout.completed", PayloadHash: "h1", TradeNo: "sub_ref_renew", OrderId: "ord_2", SubscriptionId: "sub_2", TransactionId: "txn_initial", CustomerId: "cus_2", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1704067200, PeriodEnd: 1706745600}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))
	renewal := initial
	renewal.EventId, renewal.EventType, renewal.PayloadHash, renewal.TransactionId = "evt_renew", "subscription.paid", "h2", "txn_renew"
	renewal.PeriodStart, renewal.PeriodEnd = 1706745600, 1709251200
	require.NoError(t, ProcessCreemRenewal(renewal, `{}`))
	require.NoError(t, ProcessCreemRenewal(renewal, `{}`))
	var subscriptions []UserSubscription
	require.NoError(t, DB.Where("user_id = ?", 7001).Order("id").Find(&subscriptions).Error)
	require.Len(t, subscriptions, 2)
	assert.Equal(t, CreemRecurringSource, subscriptions[1].Source)
	assert.EqualValues(t, renewal.PeriodStart, subscriptions[1].StartTime)
	assert.EqualValues(t, renewal.PeriodEnd, subscriptions[1].EndTime)
	assert.EqualValues(t, 9000, subscriptions[1].AmountTotal)
	assert.Zero(t, subscriptions[1].AmountUsed)
	assert.EqualValues(t, 4500, subscriptions[1].WeeklyAmountTotal)
	assert.Zero(t, subscriptions[1].WeeklyAmountUsed)
	assert.Greater(t, subscriptions[1].NextWeeklyResetTime, renewal.PeriodStart)
	assert.LessOrEqual(t, subscriptions[1].NextWeeklyResetTime, renewal.PeriodEnd)
	var renewalLogs []Log
	require.NoError(t, DB.Where("user_id = ? AND type = ? AND content = ?", 7001, LogTypeTopup, "订阅续费成功，套餐: Monthly，支付金额: 12.00，支付方式: creem").Find(&renewalLogs).Error)
	assert.Len(t, renewalLogs, 1)
}

func TestCreemRenewalUsesImmutableContractAfterPlanEdit(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_snapshot")
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", 7101).Updates(map[string]any{"price_amount": 99, "currency": "EUR", "creem_product_id": "prod_changed", "total_amount": 1}).Error)

	initial := CreemPaymentInput{EventId: "evt_snapshot_initial", EventType: "subscription.paid", PayloadHash: "snapshot-initial", TradeNo: "sub_ref_snapshot", SubscriptionId: "sub_snapshot", TransactionId: "txn_snapshot_initial", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1704067200, PeriodEnd: 1706745600, EventCreatedAt: 100}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))

	renewal := initial
	renewal.EventId, renewal.PayloadHash, renewal.TransactionId = "evt_snapshot_renew", "snapshot-renew", "txn_snapshot_renew"
	renewal.PeriodStart, renewal.PeriodEnd, renewal.EventCreatedAt = 1706745600, 1709251200, 200
	require.NoError(t, ProcessCreemRenewal(renewal, `{}`))

	var subscriptions []UserSubscription
	require.NoError(t, DB.Where("user_id = ?", 7001).Order("id").Find(&subscriptions).Error)
	require.Len(t, subscriptions, 2)
	assert.EqualValues(t, 9000, subscriptions[0].AmountTotal)
	assert.EqualValues(t, 9000, subscriptions[1].AmountTotal)
	assert.True(t, subscriptions[1].AllowWalletOverflow)
}

func TestCreemStalePaidAndTerminalEventsDoNotReplaceCurrentPeriod(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_stale")
	initial := CreemPaymentInput{EventId: "evt_stale_initial", EventType: "subscription.paid", PayloadHash: "stale-initial", TradeNo: "sub_ref_stale", SubscriptionId: "sub_stale", TransactionId: "txn_stale_initial", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1704067200, PeriodEnd: 1706745600, EventCreatedAt: 100}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))

	renewal := initial
	renewal.EventId, renewal.PayloadHash, renewal.TransactionId = "evt_stale_renew", "stale-renew", "txn_stale_renew"
	renewal.PeriodStart, renewal.PeriodEnd, renewal.EventCreatedAt = 1706745600, 1709251200, 200
	require.NoError(t, ProcessCreemRenewal(renewal, `{}`))

	stalePaid := initial
	stalePaid.EventId, stalePaid.PayloadHash, stalePaid.TransactionId, stalePaid.EventCreatedAt = "evt_stale_paid", "stale-paid", "txn_stale_late", 150
	require.NoError(t, ProcessCreemRenewal(stalePaid, `{}`))
	staleTerminal := CreemPaymentInput{EventId: "evt_stale_terminal", EventType: "subscription.expired", PayloadHash: "stale-terminal", SubscriptionId: "sub_stale", ProviderStatus: "expired", PeriodStart: initial.PeriodStart, PeriodEnd: initial.PeriodEnd, EventCreatedAt: 160}
	require.NoError(t, ProcessCreemLifecycle(staleTerminal, false, true))

	var link CreemSubscriptionLink
	require.NoError(t, DB.Where("creem_subscription_id = ?", "sub_stale").First(&link).Error)
	assert.EqualValues(t, renewal.PeriodStart, link.PeriodStart)
	assert.EqualValues(t, renewal.PeriodEnd, link.PeriodEnd)
	assert.Equal(t, "active", link.ProviderStatus)
	var current UserSubscription
	require.NoError(t, DB.First(&current, link.CurrentUserSubscriptionId).Error)
	assert.Equal(t, "active", current.Status)
	var subscriptions, payments int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", 7001).Count(&subscriptions).Error)
	require.NoError(t, DB.Model(&CreemSubscriptionPayment{}).Where("user_id = ?", 7001).Count(&payments).Error)
	assert.EqualValues(t, 2, subscriptions)
	assert.EqualValues(t, 3, payments)
}

func TestCreemPaymentRejectsInvalidPeriodAndMissingLinkRemainsRetryable(t *testing.T) {
	truncateTables(t)
	invalid := CreemPaymentInput{EventId: "evt_bad", EventType: "subscription.paid", PayloadHash: "bad", SubscriptionId: "sub_missing", TransactionId: "txn_bad", ProductId: "prod_recurring", PeriodStart: 10, PeriodEnd: 10}
	require.Error(t, ProcessCreemRenewal(invalid, `{}`))
	invalid.PeriodEnd = 20
	err := ProcessCreemRenewal(invalid, `{}`)
	require.ErrorIs(t, err, ErrCreemSubscriptionLinkNotFound)
	var count int64
	require.NoError(t, DB.Model(&CreemWebhookEvent{}).Where("provider_event_id = ?", invalid.EventId).Count(&count).Error)
	assert.Zero(t, count)
}

func TestCreemLifecycleScheduledPastDueAndTerminal(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_lifecycle")
	initial := CreemPaymentInput{EventId: "evt_l0", EventType: "checkout.completed", PayloadHash: "l0", TradeNo: "sub_ref_lifecycle", SubscriptionId: "sub_life", TransactionId: "txn_life", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1704067200, PeriodEnd: 4102444800}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))
	scheduled := CreemPaymentInput{EventId: "evt_l1", EventType: "subscription.scheduled_cancel", PayloadHash: "l1", SubscriptionId: "sub_life", ProviderStatus: "scheduled_cancel", PeriodStart: initial.PeriodStart, PeriodEnd: initial.PeriodEnd}
	require.NoError(t, ProcessCreemLifecycle(scheduled, true, false))
	active := scheduled
	active.EventId, active.EventType, active.PayloadHash, active.ProviderStatus = "evt_l_active", "subscription.active", "l-active", "active"
	require.NoError(t, ProcessCreemLifecycle(active, false, false))
	var link CreemSubscriptionLink
	require.NoError(t, DB.Where("creem_subscription_id = ?", "sub_life").First(&link).Error)
	assert.False(t, link.CancelAtPeriodEnd)
	scheduledAgain := scheduled
	scheduledAgain.EventId, scheduledAgain.PayloadHash = "evt_l1_again", "l1-again"
	require.NoError(t, ProcessCreemLifecycle(scheduledAgain, true, false))
	pastDue := scheduledAgain
	pastDue.EventId, pastDue.EventType, pastDue.PayloadHash, pastDue.ProviderStatus = "evt_l2", "subscription.past_due", "l2", "past_due"
	require.NoError(t, ProcessCreemLifecycle(pastDue, false, false))
	require.NoError(t, DB.Where("creem_subscription_id = ?", "sub_life").First(&link).Error)
	assert.True(t, link.CancelAtPeriodEnd)
	var entitlement UserSubscription
	require.NoError(t, DB.First(&entitlement, link.CurrentUserSubscriptionId).Error)
	assert.Equal(t, "active", entitlement.Status)
	canceled := pastDue
	canceled.EventId, canceled.EventType, canceled.PayloadHash, canceled.ProviderStatus = "evt_l3", "subscription.canceled", "l3", "canceled"
	require.NoError(t, ProcessCreemLifecycle(canceled, false, true))
	require.NoError(t, DB.First(&entitlement, entitlement.Id).Error)
	assert.Equal(t, "cancelled", entitlement.Status)
	assert.EqualValues(t, initial.PeriodEnd, entitlement.EndTime)
}

func TestCreemEventIdentityCannotBeReusedWithDifferentPayload(t *testing.T) {
	truncateTables(t)
	input := CreemPaymentInput{EventId: "evt_notice", EventType: "refund.created", PayloadHash: "one"}
	require.NoError(t, RecordCreemInformationalEvent(input))
	input.PayloadHash = "two"
	err := RecordCreemInformationalEvent(input)
	assert.Error(t, err)
}

func TestCreemSubscriptionPaymentsAreScopedToUser(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&CreemSubscriptionPayment{CreemTransactionId: "txn_user_1", CreemSubscriptionId: "sub_user_1", UserId: 1, PlanId: 1, UserSubscriptionId: 1, PeriodStart: 20}).Error)
	require.NoError(t, DB.Create(&CreemSubscriptionPayment{CreemTransactionId: "txn_user_2", CreemSubscriptionId: "sub_user_2", UserId: 2, PlanId: 2, UserSubscriptionId: 2, PeriodStart: 30}).Error)
	payments, err := GetCreemSubscriptionPaymentsByUser(1)
	require.NoError(t, err)
	require.Len(t, payments, 1)
	assert.Equal(t, "txn_user_1", payments[0].CreemTransactionId)
}

func TestCreemScheduledCancelRejectsCrossUserMutation(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&CreemSubscriptionLink{CreemSubscriptionId: "sub_owned", UserId: 8001, PlanId: 8101, ProviderStatus: "active"}).Error)
	require.Error(t, MarkCreemScheduledCancel(8002, "sub_owned"))
	var link CreemSubscriptionLink
	require.NoError(t, DB.Where("creem_subscription_id = ?", "sub_owned").First(&link).Error)
	assert.Equal(t, "active", link.ProviderStatus)
	assert.False(t, link.CancelAtPeriodEnd)
}

func TestCreemConfigurationCutoverPersistsAndPublishesTogether(t *testing.T) {
	truncateTables(t)
	originalKey, originalSecret, originalProducts, originalMode := setting.CreemApiKey, setting.CreemWebhookSecret, setting.CreemProducts, setting.CreemTestMode
	t.Cleanup(func() {
		setting.CreemApiKey, setting.CreemWebhookSecret, setting.CreemProducts, setting.CreemTestMode = originalKey, originalSecret, originalProducts, originalMode
	})
	require.NoError(t, UpdateCreemOptionsAtomic("key_safe", "secret_safe", `[{"productId":"prod_safe"}]`, true))
	assert.Equal(t, "key_safe", setting.CreemApiKey)
	assert.Equal(t, "secret_safe", setting.CreemWebhookSecret)
	assert.True(t, setting.CreemTestMode)
	var options []Option
	require.NoError(t, DB.Where("key IN ?", []string{"CreemApiKey", "CreemWebhookSecret", "CreemProducts", "CreemTestMode"}).Find(&options).Error)
	assert.Len(t, options, 4)
}

func TestCreemActiveAndPastDueLinksBlockNewCheckout(t *testing.T) {
	truncateTables(t)
	for index, status := range []string{"active", "scheduled_cancel", "past_due", "canceled"} {
		require.NoError(t, DB.Create(&CreemSubscriptionLink{CreemSubscriptionId: fmt.Sprintf("sub_guard_%d", index), UserId: 9000 + index, PlanId: 1, ProviderStatus: status}).Error)
		blocked, err := HasBlockingCreemSubscription(9000 + index)
		require.NoError(t, err)
		assert.Equal(t, status != "canceled", blocked)
	}
}

func TestCreemCheckoutReservationSerializesAndRecoversExpiredRows(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 9201, Username: "reservation-user", Password: "password1", Group: "default"}).Error)
	allow := true
	require.NoError(t, DB.Create(&SubscriptionPlan{Id: 1, Title: "Reserved", PriceAmount: 1, Currency: "USD", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, Enabled: true, AllowWalletOverflow: &allow}).Error)
	first := &SubscriptionOrder{UserId: 9201, PlanId: 1, TradeNo: "sub_reservation_first", PaymentProvider: PaymentProviderCreem, Status: common.TopUpStatusPending}
	require.NoError(t, ReserveCreemSubscriptionCheckout(9201, first))
	second := &SubscriptionOrder{UserId: 9201, PlanId: 1, TradeNo: "sub_reservation_second", PaymentProvider: PaymentProviderCreem, Status: common.TopUpStatusPending}
	require.ErrorIs(t, ReserveCreemSubscriptionCheckout(9201, second), ErrCreemCheckoutAlreadyPending)

	var orders, reservations int64
	require.NoError(t, DB.Model(&SubscriptionOrder{}).Where("user_id = ?", 9201).Count(&orders).Error)
	require.NoError(t, DB.Model(&CreemSubscriptionCheckoutReservation{}).Where("user_id = ?", 9201).Count(&reservations).Error)
	assert.EqualValues(t, 1, orders)
	assert.EqualValues(t, 1, reservations)

	require.NoError(t, DB.Model(&CreemSubscriptionCheckoutReservation{}).Where("user_id = ?", 9201).Update("expires_at", GetDBTimestamp()-1).Error)
	require.NoError(t, ReserveCreemSubscriptionCheckout(9201, second))
	var expired SubscriptionOrder
	require.NoError(t, DB.Where("trade_no = ?", first.TradeNo).First(&expired).Error)
	assert.Equal(t, common.TopUpStatusExpired, expired.Status)
	require.NoError(t, ReleaseCreemSubscriptionCheckout(second.TradeNo))
	require.NoError(t, DB.Model(&CreemSubscriptionCheckoutReservation{}).Where("user_id = ?", 9201).Count(&reservations).Error)
	assert.Zero(t, reservations)
}

func TestCreemLatePaymentSettlesExpiredReservedOrder(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 9202, Username: "late-payment-user", Password: "password1", Group: "default"}).Error)
	allow := true
	require.NoError(t, DB.Create(&SubscriptionPlan{Id: 7202, Title: "Late Monthly", PriceAmount: 12, Currency: "USD", DurationUnit: SubscriptionDurationMonth, DurationValue: 1, Enabled: true, AllowWalletOverflow: &allow, CreemProductId: "prod_late", TotalAmount: 9000, QuotaResetPeriod: SubscriptionResetNever}).Error)
	order := &SubscriptionOrder{UserId: 9202, PlanId: 7202, Money: 12, TradeNo: "sub_late_expired", PaymentMethod: PaymentMethodCreem, PaymentProvider: PaymentProviderCreem, Status: common.TopUpStatusPending, ContractSnapshot: true, ProviderProductId: "prod_late", Currency: "USD", PlanTitle: "Late Monthly", AmountTotal: 9000, AllowWalletOverflow: true}
	require.NoError(t, ReserveCreemSubscriptionCheckout(9202, order))
	require.NoError(t, DB.Model(&SubscriptionOrder{}).Where("trade_no = ?", order.TradeNo).Updates(map[string]any{"status": common.TopUpStatusExpired, "complete_time": common.GetTimestamp()}).Error)

	input := CreemPaymentInput{EventId: "evt_late", EventType: "subscription.paid", PayloadHash: "late", TradeNo: order.TradeNo, OrderId: "ord_late", SubscriptionId: "sub_late", TransactionId: "txn_late", ProductId: "prod_late", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1893456000, PeriodEnd: 1896134400, EventCreatedAt: 1000}
	require.NoError(t, ProcessCreemInitialPayment(input, `{"transaction_id":"txn_late"}`))

	require.NoError(t, DB.Where("trade_no = ?", order.TradeNo).First(order).Error)
	assert.Equal(t, common.TopUpStatusSuccess, order.Status)
	var entitlements, payments, links int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", 9202).Count(&entitlements).Error)
	require.NoError(t, DB.Model(&CreemSubscriptionPayment{}).Where("creem_transaction_id = ?", input.TransactionId).Count(&payments).Error)
	require.NoError(t, DB.Model(&CreemSubscriptionLink{}).Where("creem_subscription_id = ?", input.SubscriptionId).Count(&links).Error)
	assert.EqualValues(t, 1, entitlements)
	assert.EqualValues(t, 1, payments)
	assert.EqualValues(t, 1, links)
}

func TestCreemExistingPaymentDoesNotDeleteDifferentLiveReservation(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_existing_first")
	initial := CreemPaymentInput{EventId: "evt_existing_first", EventType: "subscription.paid", PayloadHash: "existing-first", TradeNo: "sub_existing_first", SubscriptionId: "sub_existing", TransactionId: "txn_existing", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1893456000, PeriodEnd: 1896134400, EventCreatedAt: 1000}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))

	require.NoError(t, DB.Create(&User{Id: 9203, Username: "other-reservation-user", Password: "password1", Group: "default", AffCode: "other-reservation"}).Error)
	otherOrder := &SubscriptionOrder{UserId: 9203, PlanId: 7101, TradeNo: "sub_other_live", PaymentProvider: PaymentProviderCreem, Status: common.TopUpStatusPending}
	require.NoError(t, ReserveCreemSubscriptionCheckout(9203, otherOrder))
	replay := initial
	replay.EventId, replay.PayloadHash, replay.TradeNo = "evt_existing_replay", "existing-replay", otherOrder.TradeNo
	require.NoError(t, ProcessCreemInitialPayment(replay, `{}`))

	var reservation CreemSubscriptionCheckoutReservation
	require.NoError(t, DB.Where("trade_no = ?", otherOrder.TradeNo).First(&reservation).Error)
	assert.Equal(t, 9203, reservation.UserId)
}

func TestCreemInitialPaymentStoresOnlyProvidedRedactedSummary(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_payload_safe")
	input := CreemPaymentInput{EventId: "evt_payload_safe", EventType: "subscription.paid", PayloadHash: "payload-safe", TradeNo: "sub_payload_safe", SubscriptionId: "sub_payload", TransactionId: "txn_payload_safe", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1893456000, PeriodEnd: 1896134400}
	require.NoError(t, ProcessCreemInitialPayment(input, `{"event_id":"evt_payload_safe","transaction_id":"txn_payload_safe"}`))
	var order SubscriptionOrder
	require.NoError(t, DB.Where("trade_no = ?", input.TradeNo).First(&order).Error)
	assert.Contains(t, order.ProviderPayload, input.TransactionId)
	assert.NotContains(t, order.ProviderPayload, "person@example.com")
	assert.NotContains(t, strings.ToLower(order.ProviderPayload), "customer")
}

func TestCreemDistinctSamePeriodTransactionsShareExactEntitlement(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_same_period")
	initial := CreemPaymentInput{EventId: "evt_same_initial", EventType: "subscription.paid", PayloadHash: "same-initial", TradeNo: "sub_ref_same_period", SubscriptionId: "sub_same", TransactionId: "txn_same_1", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1704067200, PeriodEnd: 1706745600, EventCreatedAt: 1000}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))
	second := initial
	second.EventId, second.PayloadHash, second.TransactionId, second.EventCreatedAt = "evt_same_second", "same-second", "txn_same_2", 2000
	require.NoError(t, ProcessCreemRenewal(second, `{}`))
	var payments []CreemSubscriptionPayment
	require.NoError(t, DB.Where("creem_subscription_id = ?", "sub_same").Order("id").Find(&payments).Error)
	require.Len(t, payments, 2)
	assert.Equal(t, payments[0].UserSubscriptionId, payments[1].UserSubscriptionId)
	assert.Equal(t, CreemReconciliationResolved, payments[1].ReconciliationStatus)
	var count int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ?", 7001).Count(&count).Error)
	assert.EqualValues(t, 1, count)
}

func TestCreemUnpaidGraceAndCurrentPeriodRecovery(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_recovery")
	initial := CreemPaymentInput{EventId: "evt_recovery_initial", EventType: "subscription.paid", PayloadHash: "recovery-initial", TradeNo: "sub_ref_recovery", SubscriptionId: "sub_recovery", TransactionId: "txn_recovery_1", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1893456000, PeriodEnd: 4102444800, EventCreatedAt: 1000}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))
	unpaid := CreemPaymentInput{EventId: "evt_recovery_unpaid", EventType: "subscription.unpaid", PayloadHash: "recovery-unpaid", SubscriptionId: initial.SubscriptionId, ProviderStatus: "unpaid", PeriodStart: initial.PeriodStart, PeriodEnd: initial.PeriodEnd, EventCreatedAt: 2000}
	require.NoError(t, ProcessCreemLifecycle(unpaid, false, false))
	var link CreemSubscriptionLink
	require.NoError(t, DB.Where("creem_subscription_id = ?", initial.SubscriptionId).First(&link).Error)
	var entitlement UserSubscription
	require.NoError(t, DB.First(&entitlement, link.CurrentUserSubscriptionId).Error)
	assert.Equal(t, "active", entitlement.Status)

	canceled := unpaid
	canceled.EventId, canceled.EventType, canceled.PayloadHash, canceled.ProviderStatus, canceled.EventCreatedAt = "evt_recovery_canceled", "subscription.canceled", "recovery-canceled", "canceled", 3000
	require.NoError(t, ProcessCreemLifecycle(canceled, false, true))
	paid := initial
	paid.EventId, paid.PayloadHash, paid.TransactionId, paid.EventCreatedAt = "evt_recovery_paid", "recovery-paid", "txn_recovery_2", 4000
	require.NoError(t, ProcessCreemRenewal(paid, `{}`))
	require.NoError(t, DB.First(&entitlement, entitlement.Id).Error)
	assert.Equal(t, "active", entitlement.Status)

	require.NoError(t, ProcessCreemLifecycle(CreemPaymentInput{EventId: "evt_recovery_canceled_2", EventType: "subscription.canceled", PayloadHash: "recovery-canceled-2", SubscriptionId: initial.SubscriptionId, ProviderStatus: "canceled", PeriodStart: initial.PeriodStart, PeriodEnd: initial.PeriodEnd, EventCreatedAt: 5000}, false, true))
	require.NoError(t, ProcessCreemLifecycle(CreemPaymentInput{EventId: "evt_recovery_active", EventType: "subscription.active", PayloadHash: "recovery-active", SubscriptionId: initial.SubscriptionId, ProviderStatus: "active", PeriodStart: initial.PeriodStart, PeriodEnd: initial.PeriodEnd, EventCreatedAt: 6000}, false, false))
	require.NoError(t, DB.First(&entitlement, entitlement.Id).Error)
	assert.Equal(t, "active", entitlement.Status)
}

func TestCreemOlderSamePeriodPaymentAfterCancelRecordsLedgerWithoutReactivation(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_stale_reattach")
	initial := CreemPaymentInput{EventId: "evt_stale_initial", EventType: "subscription.paid", PayloadHash: "stale-initial", TradeNo: "sub_ref_stale_reattach", SubscriptionId: "sub_stale_reattach", TransactionId: "txn_stale_1", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1893456000, PeriodEnd: 4102444800, EventCreatedAt: 1000}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))
	canceled := CreemPaymentInput{EventId: "evt_stale_cancel", EventType: "subscription.canceled", PayloadHash: "stale-cancel", SubscriptionId: initial.SubscriptionId, ProviderStatus: "canceled", PeriodStart: initial.PeriodStart, PeriodEnd: initial.PeriodEnd, EventCreatedAt: 3000}
	require.NoError(t, ProcessCreemLifecycle(canceled, false, true))
	olderPaid := initial
	olderPaid.EventId, olderPaid.PayloadHash, olderPaid.TransactionId, olderPaid.EventCreatedAt = "evt_stale_paid", "stale-paid", "txn_stale_2", 2000
	require.NoError(t, ProcessCreemRenewal(olderPaid, `{}`))

	var link CreemSubscriptionLink
	require.NoError(t, DB.Where("creem_subscription_id = ?", initial.SubscriptionId).First(&link).Error)
	assert.Equal(t, "canceled", link.ProviderStatus)
	assert.EqualValues(t, 3000, link.LastEventAt)
	var entitlement UserSubscription
	require.NoError(t, DB.First(&entitlement, link.CurrentUserSubscriptionId).Error)
	assert.Equal(t, "cancelled", entitlement.Status)
	var payments int64
	require.NoError(t, DB.Model(&CreemSubscriptionPayment{}).Where("creem_subscription_id = ?", initial.SubscriptionId).Count(&payments).Error)
	assert.EqualValues(t, 2, payments)
}

func TestCreemMillisecondStaleAndEqualTerminalCannotOverrideActiveRecovery(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_equal_time")
	initial := CreemPaymentInput{EventId: "evt_equal_initial", EventType: "subscription.paid", PayloadHash: "equal-initial", TradeNo: "sub_ref_equal_time", SubscriptionId: "sub_equal", TransactionId: "txn_equal", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1893456000, PeriodEnd: 4102444800, EventCreatedAt: 1704067200123}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))
	older := CreemPaymentInput{EventId: "evt_older_terminal", EventType: "subscription.canceled", PayloadHash: "older-terminal", SubscriptionId: initial.SubscriptionId, ProviderStatus: "canceled", PeriodStart: initial.PeriodStart, PeriodEnd: initial.PeriodEnd, EventCreatedAt: 1704067200122}
	require.NoError(t, ProcessCreemLifecycle(older, false, true))
	terminal := CreemPaymentInput{EventId: "evt_equal_terminal", EventType: "subscription.expired", PayloadHash: "equal-terminal", SubscriptionId: initial.SubscriptionId, ProviderStatus: "expired", PeriodStart: initial.PeriodStart, PeriodEnd: initial.PeriodEnd, EventCreatedAt: initial.EventCreatedAt}
	require.NoError(t, ProcessCreemLifecycle(terminal, false, true))
	var link CreemSubscriptionLink
	require.NoError(t, DB.Where("creem_subscription_id = ?", initial.SubscriptionId).First(&link).Error)
	assert.Equal(t, "active", link.ProviderStatus)
	var entitlement UserSubscription
	require.NoError(t, DB.First(&entitlement, link.CurrentUserSubscriptionId).Error)
	assert.Equal(t, "active", entitlement.Status)

	newerTerminal := terminal
	newerTerminal.EventId, newerTerminal.PayloadHash, newerTerminal.ProviderStatus, newerTerminal.EventType, newerTerminal.EventCreatedAt = "evt_cancel_then_paid", "cancel-then-paid", "canceled", "subscription.canceled", initial.EventCreatedAt+1
	require.NoError(t, ProcessCreemLifecycle(newerTerminal, false, true))
	paid := initial
	paid.EventId, paid.PayloadHash, paid.TransactionId, paid.EventCreatedAt = "evt_paid_after_equal_cancel", "paid-after-equal-cancel", "txn_equal_recovery", newerTerminal.EventCreatedAt
	require.NoError(t, ProcessCreemRenewal(paid, `{}`))
	require.NoError(t, DB.Where("creem_subscription_id = ?", initial.SubscriptionId).First(&link).Error)
	assert.Equal(t, "active", link.ProviderStatus)
	require.NoError(t, DB.First(&entitlement, link.CurrentUserSubscriptionId).Error)
	assert.Equal(t, "active", entitlement.Status)
}

func TestCreemRenewalsPreserveOriginalGroupForFinalDowngrade(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_group")
	require.NoError(t, DB.Model(&SubscriptionPlan{}).Where("id = ?", 7101).Update("upgrade_group", "vip").Error)
	require.NoError(t, DB.Model(&SubscriptionOrder{}).Where("trade_no = ?", "sub_ref_group").Update("upgrade_group", "vip").Error)
	now := GetDBTimestamp()
	initial := CreemPaymentInput{EventId: "evt_group_initial", EventType: "subscription.paid", PayloadHash: "group-initial", TradeNo: "sub_ref_group", SubscriptionId: "sub_group", TransactionId: "txn_group_1", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: now - 200, PeriodEnd: now - 100, EventCreatedAt: 1000}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))
	renewal := initial
	renewal.EventId, renewal.PayloadHash, renewal.TransactionId = "evt_group_renewal", "group-renewal", "txn_group_2"
	renewal.PeriodStart, renewal.PeriodEnd, renewal.EventCreatedAt = now-100, now+10000, 2000
	require.NoError(t, ProcessCreemRenewal(renewal, `{}`))
	var link CreemSubscriptionLink
	require.NoError(t, DB.Where("creem_subscription_id = ?", initial.SubscriptionId).First(&link).Error)
	assert.Equal(t, "default", link.PrevUserGroup)
	var current UserSubscription
	require.NoError(t, DB.First(&current, link.CurrentUserSubscriptionId).Error)
	assert.Equal(t, "default", current.PrevUserGroup)
	require.NoError(t, ProcessCreemLifecycle(CreemPaymentInput{EventId: "evt_group_cancel", EventType: "subscription.canceled", PayloadHash: "group-cancel", SubscriptionId: initial.SubscriptionId, ProviderStatus: "canceled", PeriodStart: renewal.PeriodStart, PeriodEnd: renewal.PeriodEnd, EventCreatedAt: 3000}, false, true))
	var user User
	require.NoError(t, DB.First(&user, 7001).Error)
	assert.Equal(t, "default", user.Group)
}

func TestCreemHistoricalPaymentWithoutExactEntitlementIsUnresolved(t *testing.T) {
	truncateTables(t)
	seedCreemRecurringOrder(t, "sub_ref_unresolved")
	initial := CreemPaymentInput{EventId: "evt_unresolved_initial", EventType: "subscription.paid", PayloadHash: "unresolved-initial", TradeNo: "sub_ref_unresolved", SubscriptionId: "sub_unresolved", TransactionId: "txn_unresolved_1", ProductId: "prod_recurring", ProviderStatus: "active", Amount: 1200, Currency: "USD", PeriodStart: 1704067200, PeriodEnd: 1706745600, EventCreatedAt: 2000}
	require.NoError(t, ProcessCreemInitialPayment(initial, `{}`))
	historical := initial
	historical.EventId, historical.PayloadHash, historical.TransactionId, historical.EventCreatedAt = "evt_unresolved_historical", "unresolved-historical", "txn_unresolved_2", 1000
	historical.PeriodStart, historical.PeriodEnd = 1600000000, 1602678400
	require.NoError(t, ProcessCreemRenewal(historical, `{}`))
	var payment CreemSubscriptionPayment
	require.NoError(t, DB.Where("creem_transaction_id = ?", historical.TransactionId).First(&payment).Error)
	assert.Zero(t, payment.UserSubscriptionId)
	assert.Equal(t, CreemReconciliationUnresolved, payment.ReconciliationStatus)
}

func TestCreemOneTimeContractMismatchFailsBeforeQuotaCredit(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 9301, Username: "topup-contract", Password: "password1", Group: "default", Quota: 10}).Error)
	topup := TopUp{UserId: 9301, Amount: 500, Money: 9.5, TradeNo: "creem_topup_contract", PaymentMethod: PaymentMethodCreem, PaymentProvider: PaymentProviderCreem, Status: common.TopUpStatusPending, ContractSnapshot: true, ExpectedProviderProductId: "prod_expected", ExpectedAmountMinor: 950, ExpectedCurrency: "USD"}
	require.NoError(t, DB.Create(&topup).Error)
	input := CreemPaymentInput{EventId: "evt_topup_contract", EventType: "checkout.completed", PayloadHash: "topup-contract", ProductId: "prod_wrong", Amount: 950, Currency: "USD"}
	require.Error(t, RechargeCreem(input, topup.TradeNo, "", "", "127.0.0.1"))
	var user User
	require.NoError(t, DB.First(&user, 9301).Error)
	assert.Equal(t, 10, user.Quota)
	var eventCount int64
	require.NoError(t, DB.Model(&CreemWebhookEvent{}).Where("provider_event_id = ?", input.EventId).Count(&eventCount).Error)
	assert.Zero(t, eventCount)
}

func TestLegacyCreemOneTimeOrderFailsClosed(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&User{Id: 9302, Username: "legacy-topup", Password: "password1", Group: "default", Quota: 10}).Error)
	topup := TopUp{UserId: 9302, Amount: 500, Money: 9.5, TradeNo: "creem_topup_legacy", PaymentMethod: PaymentMethodCreem, PaymentProvider: PaymentProviderCreem, Status: common.TopUpStatusPending}
	require.NoError(t, DB.Create(&topup).Error)
	input := CreemPaymentInput{EventId: "evt_topup_legacy", EventType: "checkout.completed", PayloadHash: "topup-legacy", ProductId: "prod_expected", Amount: 950, Currency: "USD"}
	require.Error(t, RechargeCreem(input, topup.TradeNo, "", "", "127.0.0.1"))
	var user User
	require.NoError(t, DB.First(&user, 9302).Error)
	assert.Equal(t, 10, user.Quota)
	require.NoError(t, DB.First(&topup, topup.Id).Error)
	assert.Equal(t, common.TopUpStatusPending, topup.Status)
}

func TestCreemFinancialNoticeIsDurableLinkedAndIdempotent(t *testing.T) {
	truncateTables(t)
	require.NoError(t, DB.Create(&CreemSubscriptionPayment{CreemTransactionId: "txn_notice", CreemSubscriptionId: "sub_notice", UserId: 9401, PlanId: 1, UserSubscriptionId: 0, ReconciliationStatus: CreemReconciliationUnresolved}).Error)
	input := CreemFinancialNoticeInput{EventId: "evt_notice_durable", EventType: "refund.created", PayloadHash: "notice-durable", ObjectId: "refund_notice", TransactionId: "txn_notice", Amount: 600, Currency: "USD", ProviderStatus: "pending"}
	require.NoError(t, RecordCreemFinancialNotice(input))
	require.NoError(t, RecordCreemFinancialNotice(input))
	var notices []CreemFinancialNotice
	require.NoError(t, DB.Where("provider_event_id = ?", input.EventId).Find(&notices).Error)
	require.Len(t, notices, 1)
	assert.NotZero(t, notices[0].CreemPaymentId)
	assert.Equal(t, 9401, notices[0].UserId)
	assert.Equal(t, "sub_notice", notices[0].CreemSubscriptionId)
	assert.Equal(t, CreemFinancialNoticePendingManualReview, notices[0].Status)
	assert.Equal(t, CreemFinancialDecisionRecordOnly, notices[0].Decision)
}

func TestBackgroundCreemOptionPublicationLoadsQuartetAndRetainsMissingLegacyValues(t *testing.T) {
	truncateTables(t)
	originalKey, originalSecret, originalProducts, originalMode := setting.CreemApiKey, setting.CreemWebhookSecret, setting.CreemProducts, setting.CreemTestMode
	t.Cleanup(func() {
		setting.CreemApiKey, setting.CreemWebhookSecret, setting.CreemProducts, setting.CreemTestMode = originalKey, originalSecret, originalProducts, originalMode
	})
	common.OptionMapRWMutex.Lock()
	common.OptionMap = map[string]string{"CreemWebhookSecret": "legacy_secret"}
	setting.CreemWebhookSecret = "legacy_secret"
	common.OptionMapRWMutex.Unlock()
	require.NoError(t, DB.Create(&[]Option{{Key: "CreemApiKey", Value: "db_key"}, {Key: "CreemProducts", Value: `[{"productId":"db_product"}]`}, {Key: "CreemTestMode", Value: "true"}}).Error)
	loadOptionsFromDatabase()
	config := map[string]string{}
	common.OptionMapRWMutex.RLock()
	for _, key := range []string{"CreemApiKey", "CreemWebhookSecret", "CreemProducts", "CreemTestMode"} {
		config[key] = common.OptionMap[key]
	}
	common.OptionMapRWMutex.RUnlock()
	assert.Equal(t, "db_key", config["CreemApiKey"])
	assert.Equal(t, "legacy_secret", config["CreemWebhookSecret"])
	assert.Equal(t, `[{"productId":"db_product"}]`, config["CreemProducts"])
	assert.Equal(t, "true", config["CreemTestMode"])
	assert.Equal(t, "legacy_secret", setting.CreemWebhookSecret)
	assert.True(t, setting.CreemTestMode)
}
