package service

import (
	"context"
	"errors"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
)

func TestStripeSubscriptionReconciliationClosesExpiredGraceAfterAuthoritativeUnpaidFetch(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.PaymentWebhookEvent{}))
	contract, binding, entitlement := seedStripeRenewalContract(t, 9130, 9230, "sub_grace_expired")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("id = ?", entitlement.Id).Updates(map[string]interface{}{
		"access_end_time": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id": "in_grace_unpaid",
		"provider_status":            "past_due",
		"grace_period_end":           now - 10,
	}).Error)

	originalIsMaster := common.IsMasterNode
	originalInvoiceGetter := stripeInvoiceGetter
	originalInvoiceVoider := stripeInvoiceVoider
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		common.IsMasterNode = originalIsMaster
		stripeInvoiceGetter = originalInvoiceGetter
		stripeInvoiceVoider = originalInvoiceVoider
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
	})
	common.IsMasterNode = true
	var fetchedInvoice bool
	var fetchedSubscription bool
	var cancelledSubscriptionID string
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		require.Equal(t, "in_grace_unpaid", invoiceID)
		fetchedInvoice = true
		inv := stripeInvoiceFixture(invoiceID, "sub_grace_expired")
		markStripeInvoiceUnpaid(inv)
		inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
		return inv, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		require.Equal(t, "sub_grace_expired", subscriptionID)
		require.True(t, fetchedInvoice, "scanner must fetch invoice before subscription status decision")
		fetchedSubscription = true
		return stripeSubscriptionFixture("sub_grace_expired", map[string]string{}), nil
	}
	stripeInvoiceVoider = func(ctx context.Context, invoiceID string, idempotencyKey string) (*stripe.Invoice, error) {
		require.Equal(t, "in_grace_unpaid", invoiceID)
		require.NotEmpty(t, idempotencyKey)
		return &stripe.Invoice{ID: invoiceID, Status: stripe.InvoiceStatusVoid}, nil
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		require.True(t, fetchedInvoice)
		require.True(t, fetchedSubscription)
		cancelledSubscriptionID = providerSubscriptionID
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:  providerSubscriptionID,
			ProviderCustomerId:      "cus_invoice",
			ProviderPriceId:         "price_invoice_plan",
			ProviderLatestInvoiceId: "in_grace_unpaid",
			ProviderStatus:          "canceled",
			EndedAt:                 common.GetTimestamp(),
		}, nil
	}

	count, err := RunStripeSubscriptionReconciliationOnce()
	require.NoError(t, err)
	secondCount, err := RunStripeSubscriptionReconciliationOnce()

	require.NoError(t, err)
	require.Equal(t, 1, count)
	require.Equal(t, 0, secondCount)
	require.Equal(t, "sub_grace_expired", cancelledSubscriptionID)
	var closedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&closedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusEnded, closedContract.Status)
	require.Zero(t, closedContract.CurrentProviderBindingId)
	require.Zero(t, closedContract.CurrentEntitlementId)
	require.Zero(t, closedContract.GracePeriodEnd)
	var archived model.UserSubscription
	require.NoError(t, model.DB.First(&archived, "id = ?", entitlement.Id).Error)
	require.Nil(t, archived.CurrentSlot)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, archived.Status)
	require.Equal(t, model.SubscriptionEntitlementEndReasonExpired, archived.EndReason)
	var endedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&endedBinding, "id = ?", binding.Id).Error)
	require.Equal(t, "canceled", endedBinding.ProviderStatus)
	require.Greater(t, endedBinding.EndedAt, int64(0))
}

func TestStripeSubscriptionReconciliationDoesNotCancelWhenGraceInvoicePaysBeforeRemoteCancel(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.PaymentWebhookEvent{}))
	contract, binding, entitlement := seedStripeRenewalContract(t, 9134, 9234, "sub_grace_paid_race")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id": "in_grace_paid_race",
		"provider_status":            "past_due",
		"grace_period_end":           now - 10,
	}).Error)

	originalIsMaster := common.IsMasterNode
	originalInvoiceGetter := stripeInvoiceGetter
	originalInvoiceVoider := stripeInvoiceVoider
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		common.IsMasterNode = originalIsMaster
		stripeInvoiceGetter = originalInvoiceGetter
		stripeInvoiceVoider = originalInvoiceVoider
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
	})
	common.IsMasterNode = true

	paymentArrived := false
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		require.Equal(t, "in_grace_paid_race", invoiceID)
		if !paymentArrived {
			inv := stripeInvoiceFixture(invoiceID, "sub_grace_paid_race")
			markStripeInvoiceUnpaid(inv)
			inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
			return inv, nil
		}
		paid := stripeInvoiceFixture(invoiceID, "sub_grace_paid_race")
		paid.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
		return paid, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		sub := stripeSubscriptionFixture(subscriptionID, map[string]string{})
		setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
		sub.LatestInvoice = &stripe.Invoice{ID: "in_grace_paid_race"}
		return sub, nil
	}
	stripeInvoiceVoider = func(ctx context.Context, invoiceID string, idempotencyKey string) (*stripe.Invoice, error) {
		require.Equal(t, "in_grace_paid_race", invoiceID)
		require.NotEmpty(t, idempotencyKey)
		paymentArrived = true
		return nil, errors.New("invoice is already paid")
	}
	cancelCalled := false
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		cancelCalled = true
		return model.ProviderSubscriptionSnapshot{}, errors.New("paid invoice must prevent subscription cancellation")
	}

	var graceContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&graceContract, "id = ?", contract.Id).Error)
	applied, err := reconcileExpiredStripeGraceContract(context.Background(), graceContract)
	require.NoError(t, err)
	require.True(t, applied)
	require.False(t, cancelCalled, "a paid grace invoice must fence remote subscription cancellation")
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
	var current model.UserSubscription
	require.NoError(t, model.DB.First(&current, "id = ?", reloadedContract.CurrentEntitlementId).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusActive, current.Status)
	require.Equal(t, "stripe:in_grace_paid_race", *current.GrantKey)
}

func TestStripeSubscriptionReconciliationClosesExpiredGraceAfterBindingAlreadyTerminated(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.PaymentWebhookEvent{}))
	contract, binding, entitlement := seedStripeRenewalContract(t, 9131, 9231, "sub_grace_recover")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("id = ?", entitlement.Id).Updates(map[string]interface{}{
		"access_end_time": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id": "in_grace_recover",
		"provider_status":            "canceled",
		"ended_at":                   now - 5,
		"grace_period_end":           now - 10,
	}).Error)

	originalIsMaster := common.IsMasterNode
	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		common.IsMasterNode = originalIsMaster
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
	})
	common.IsMasterNode = true
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		t.Fatal("already terminated binding must close locally without refetching Stripe invoice")
		return nil, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		t.Fatal("already terminated binding must close locally without refetching Stripe subscription")
		return nil, nil
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("already terminated binding must not remote cancel again")
		return model.ProviderSubscriptionSnapshot{}, nil
	}

	count, err := RunStripeSubscriptionReconciliationOnce()
	require.NoError(t, err)
	secondCount, err := RunStripeSubscriptionReconciliationOnce()

	require.NoError(t, err)
	require.Equal(t, 1, count)
	require.Equal(t, 0, secondCount)
	var closedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&closedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusEnded, closedContract.Status)
	require.Zero(t, closedContract.CurrentProviderBindingId)
	require.Zero(t, closedContract.CurrentEntitlementId)
	var archived model.UserSubscription
	require.NoError(t, model.DB.First(&archived, "id = ?", entitlement.Id).Error)
	require.Nil(t, archived.CurrentSlot)
	require.Equal(t, model.SubscriptionEntitlementStatusHistorical, archived.Status)
	require.Equal(t, model.SubscriptionEntitlementEndReasonExpired, archived.EndReason)
}

func TestStripeSubscriptionReconciliationMarksGraceNeedsAttentionOnAuthoritativeMismatch(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.PaymentWebhookEvent{}))
	contract, binding, entitlement := seedStripeRenewalContract(t, 9132, 9232, "sub_grace_mismatch")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("id = ?", entitlement.Id).Updates(map[string]interface{}{
		"access_end_time": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id": "in_grace_mismatch",
		"provider_status":            "past_due",
		"grace_period_end":           now - 10,
	}).Error)

	originalIsMaster := common.IsMasterNode
	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		common.IsMasterNode = originalIsMaster
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
	})
	common.IsMasterNode = true
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		inv := stripeInvoiceFixture(invoiceID, "sub_grace_mismatch")
		markStripeInvoiceUnpaid(inv)
		inv.Customer = &stripe.Customer{ID: "cus_other"}
		inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
		return inv, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		subscription := stripeSubscriptionFixture("sub_grace_mismatch", map[string]string{})
		subscription.Customer = &stripe.Customer{ID: "cus_other"}
		return subscription, nil
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("authoritative mismatch must not cancel remote subscription")
		return model.ProviderSubscriptionSnapshot{}, nil
	}

	count, err := RunStripeSubscriptionReconciliationOnce()

	require.NoError(t, err)
	require.Equal(t, 1, count)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusNeedsAttention, reloadedContract.Status)
	require.Equal(t, binding.Id, reloadedContract.CurrentProviderBindingId)
	require.Equal(t, entitlement.Id, reloadedContract.CurrentEntitlementId)
	var current model.UserSubscription
	require.NoError(t, model.DB.First(&current, "id = ?", entitlement.Id).Error)
	require.NotNil(t, current.CurrentSlot)
	require.Equal(t, model.SubscriptionEntitlementStatusActive, current.Status)
}

func TestStripeSubscriptionReconciliationKeepsPendingPurchaseForOpenInvoiceActiveSubscription(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.PaymentWebhookEvent{}))
	_, intent := seedStripeInvoicePurchase(t, 9133, 9233, "sub_pending_open")
	require.NoError(t, model.DB.Model(&model.SubscriptionOrder{}).Where("trade_no = ?", "sub_pending_open").Updates(map[string]interface{}{
		"provider_payload": "invoice_id=in_pending_open;change_intent_id=" + strconv.FormatInt(intent.Id, 10),
		"change_intent_id": intent.Id,
	}).Error)

	originalIsMaster := common.IsMasterNode
	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	t.Cleanup(func() {
		common.IsMasterNode = originalIsMaster
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
	})
	common.IsMasterNode = true
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		require.Equal(t, "in_pending_open", invoiceID)
		inv := stripeInvoiceFixture(invoiceID, "sub_pending_open")
		markStripeInvoiceUnpaid(inv)
		return inv, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		require.Equal(t, "sub_pending_open", subscriptionID)
		return stripeSubscriptionFixture("sub_pending_open", map[string]string{}), nil
	}

	count, err := RunStripeSubscriptionReconciliationOnce()

	require.NoError(t, err)
	require.Equal(t, 0, count)
	var order model.SubscriptionOrder
	require.NoError(t, model.DB.First(&order, "trade_no = ?", "sub_pending_open").Error)
	require.Equal(t, common.TopUpStatusPending, order.Status)
	var reloadedIntent model.SubscriptionChangeIntent
	require.NoError(t, model.DB.First(&reloadedIntent, "id = ?", intent.Id).Error)
	require.Equal(t, model.SubscriptionChangeIntentStatusAwaitingPayment, reloadedIntent.Status)
}
