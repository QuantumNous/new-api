package service

import (
	"context"
	"errors"
	"os"
	"strconv"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
)

func TestStripeReconciliationActiveReservationGuardUsesTransactionDBClock(t *testing.T) {
	source, err := os.ReadFile("subscription_reconciliation_task.go")
	require.NoError(t, err)

	require.NotContains(t, string(source), `now := common.GetTimestamp()
	return model.DB.Transaction(func(tx *gorm.DB) error {`)
	require.Contains(t, string(source), `return model.DB.Transaction(func(tx *gorm.DB) error {
		now, err := subscriptionLifecycleDBTimestampTx(tx)
		if err != nil {
			return err
		}`)
	require.Contains(t, string(source), "subscriptionProviderBindingHasActiveLifecycleReservation(&lockedBinding, now)")
}

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

func TestStripeSubscriptionReconciliationReservesBindingBeforeRemoteTerminalMutation(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.PaymentWebhookEvent{}))
	contract, binding, entitlement := seedStripeRenewalContract(t, 9135, 9235, "sub_grace_reserved_before_remote")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("id = ?", entitlement.Id).Update("access_end_time", now-10).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id": "in_grace_reserved_before_remote",
		"provider_status":            "past_due",
		"grace_period_end":           now - 10,
	}).Error)

	originalInvoiceGetter := stripeInvoiceGetter
	originalInvoiceVoider := stripeInvoiceVoider
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeInvoiceVoider = originalInvoiceVoider
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
	})
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		inv := stripeInvoiceFixture(invoiceID, binding.ProviderSubscriptionId)
		markStripeInvoiceUnpaid(inv)
		inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
		return inv, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		return stripeSubscriptionFixture(subscriptionID, map[string]string{}), nil
	}
	var competingTerminationErr error
	stripeInvoiceVoider = func(ctx context.Context, invoiceID string, idempotencyKey string) (*stripe.Invoice, error) {
		_, competingTerminationErr = model.ApplyProviderSubscriptionTermination(binding.Id, model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId: binding.ProviderSubscriptionId,
			ProviderStatus:         "canceled",
			EndedAt:                common.GetTimestamp(),
		})
		return &stripe.Invoice{ID: invoiceID, Status: stripe.InvoiceStatusVoid}, nil
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:  providerSubscriptionID,
			ProviderCustomerId:      "cus_invoice",
			ProviderPriceId:         "price_invoice_plan",
			ProviderLatestInvoiceId: "in_grace_reserved_before_remote",
			ProviderStatus:          "canceled",
			EndedAt:                 common.GetTimestamp(),
		}, nil
	}

	var graceContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&graceContract, contract.Id).Error)
	applied, err := reconcileExpiredStripeGraceContract(context.Background(), graceContract)

	require.NoError(t, err)
	require.True(t, applied)
	require.ErrorIs(t, competingTerminationErr, model.ErrSubscriptionProviderLifecycleConflict)
}

func TestStripeSubscriptionReconciliationConfirmsTerminalStateAfterCancelResponseIsLost(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 9137, 9237, "sub_grace_cancel_response_lost")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("id = ?", entitlement.Id).Update("access_end_time", now-10).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id": "in_grace_cancel_response_lost",
		"provider_status":            "past_due",
		"grace_period_end":           now - 10,
	}).Error)

	originalInvoiceGetter := stripeInvoiceGetter
	originalInvoiceVoider := stripeInvoiceVoider
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	originalSnapshotGetter := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeInvoiceVoider = originalInvoiceVoider
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
		stripeSubscriptionSnapshotGetter = originalSnapshotGetter
	})
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		inv := stripeInvoiceFixture(invoiceID, binding.ProviderSubscriptionId)
		markStripeInvoiceUnpaid(inv)
		inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
		return inv, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		return stripeSubscriptionFixture(subscriptionID, map[string]string{}), nil
	}
	stripeInvoiceVoider = func(ctx context.Context, invoiceID string, idempotencyKey string) (*stripe.Invoice, error) {
		return &stripe.Invoice{ID: invoiceID, Status: stripe.InvoiceStatusVoid}, nil
	}
	cancelErr := errors.New("Stripe cancel response lost")
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{}, cancelErr
	}
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:  providerSubscriptionID,
			ProviderCustomerId:      binding.ProviderCustomerId,
			ProviderPriceId:         binding.ProviderPriceId,
			ProviderLatestInvoiceId: "in_grace_cancel_response_lost",
			ProviderStatus:          "canceled",
			EndedAt:                 common.GetTimestamp(),
		}, nil
	}
	var graceContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&graceContract, contract.Id).Error)

	applied, err := reconcileExpiredStripeGraceContract(context.Background(), graceContract)

	require.NoError(t, err)
	require.True(t, applied)
	var closedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&closedContract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusEnded, closedContract.Status)
	var endedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&endedBinding, binding.Id).Error)
	require.Equal(t, "canceled", endedBinding.ProviderStatus)
	require.Greater(t, endedBinding.EndedAt, int64(0))
	require.NotEmpty(t, endedBinding.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionGraceCancel, endedBinding.LifecycleReservationAction)
	require.Zero(t, endedBinding.LifecycleReservationUntil)
}

func TestStripeSubscriptionReconciliationKeepsReservationWhenCancelOutcomeCannotBeConfirmed(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 9138, 9238, "sub_grace_cancel_uncertain")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("id = ?", entitlement.Id).Update("access_end_time", now-10).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id": "in_grace_cancel_uncertain",
		"provider_status":            "past_due",
		"grace_period_end":           now - 10,
	}).Error)

	originalInvoiceGetter := stripeInvoiceGetter
	originalInvoiceVoider := stripeInvoiceVoider
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	originalSnapshotGetter := stripeSubscriptionSnapshotGetter
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeInvoiceVoider = originalInvoiceVoider
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
		stripeSubscriptionSnapshotGetter = originalSnapshotGetter
	})
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		inv := stripeInvoiceFixture(invoiceID, binding.ProviderSubscriptionId)
		markStripeInvoiceUnpaid(inv)
		inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
		return inv, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		return stripeSubscriptionFixture(subscriptionID, map[string]string{}), nil
	}
	stripeInvoiceVoider = func(ctx context.Context, invoiceID string, idempotencyKey string) (*stripe.Invoice, error) {
		return &stripe.Invoice{ID: invoiceID, Status: stripe.InvoiceStatusVoid}, nil
	}
	cancelErr := errors.New("Stripe cancel outcome is unknown")
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{}, cancelErr
	}
	confirmErr := errors.New("Stripe confirmation unavailable")
	stripeSubscriptionSnapshotGetter = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{}, confirmErr
	}
	var graceContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&graceContract, contract.Id).Error)

	applied, err := reconcileExpiredStripeGraceContract(context.Background(), graceContract)

	require.False(t, applied)
	require.ErrorIs(t, err, cancelErr)
	var currentBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&currentBinding, binding.Id).Error)
	require.NotEmpty(t, currentBinding.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionGraceCancel, currentBinding.LifecycleReservationAction)
	require.Greater(t, currentBinding.LifecycleReservationUntil, common.GetTimestamp())
}

func TestStripeSubscriptionReconciliationKeepsReservationWhenPaidReconcileFails(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 9139, 9239, "sub_grace_paid_reconcile_failure")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id": "in_grace_paid_reconcile_failure",
		"provider_status":            "past_due",
		"grace_period_end":           now - 10,
	}).Error)

	originalInvoiceGetter := stripeInvoiceGetter
	originalInvoiceVoider := stripeInvoiceVoider
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeInvoiceVoider = originalInvoiceVoider
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
	})
	invoiceFetches := 0
	paidReconcileErr := errors.New("paid invoice reconciliation fetch failed")
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		invoiceFetches++
		if invoiceFetches == 3 {
			return nil, paidReconcileErr
		}
		inv := stripeInvoiceFixture(invoiceID, binding.ProviderSubscriptionId)
		inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
		if invoiceFetches == 1 {
			markStripeInvoiceUnpaid(inv)
		}
		return inv, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		return stripeSubscriptionFixture(subscriptionID, map[string]string{}), nil
	}
	stripeInvoiceVoider = func(ctx context.Context, invoiceID string, idempotencyKey string) (*stripe.Invoice, error) {
		return nil, errors.New("invoice already paid")
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("paid invoice must prevent subscription cancellation")
		return model.ProviderSubscriptionSnapshot{}, nil
	}
	var graceContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&graceContract, contract.Id).Error)

	applied, err := reconcileExpiredStripeGraceContract(context.Background(), graceContract)

	require.False(t, applied)
	require.ErrorIs(t, err, paidReconcileErr)
	var currentBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&currentBinding, binding.Id).Error)
	require.NotEmpty(t, currentBinding.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionGraceCancel, currentBinding.LifecycleReservationAction)
	require.Greater(t, currentBinding.LifecycleReservationUntil, common.GetTimestamp())
}

func TestStripeSubscriptionReconciliationInitialPaidRetryReusesCancelReservation(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 9140, 9240, "sub_grace_paid_retry_reserved")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id": "in_grace_paid_retry_reserved",
		"provider_status":            "past_due",
		"grace_period_end":           now - 10,
	}).Error)

	originalInvoiceGetter := stripeInvoiceGetter
	originalInvoiceVoider := stripeInvoiceVoider
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeInvoiceVoider = originalInvoiceVoider
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
	})
	invoiceFetches := 0
	paidReconcileErr := errors.New("first paid invoice reconciliation fetch failed")
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		require.Equal(t, "in_grace_paid_retry_reserved", invoiceID)
		invoiceFetches++
		if invoiceFetches == 3 {
			return nil, paidReconcileErr
		}
		inv := stripeInvoiceFixture(invoiceID, binding.ProviderSubscriptionId)
		inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
		if invoiceFetches == 1 {
			markStripeInvoiceUnpaid(inv)
		}
		return inv, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		require.Equal(t, binding.ProviderSubscriptionId, subscriptionID)
		sub := stripeSubscriptionFixture(subscriptionID, map[string]string{})
		setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
		sub.LatestInvoice = &stripe.Invoice{ID: "in_grace_paid_retry_reserved"}
		return sub, nil
	}
	stripeInvoiceVoider = func(ctx context.Context, invoiceID string, idempotencyKey string) (*stripe.Invoice, error) {
		require.Equal(t, "in_grace_paid_retry_reserved", invoiceID)
		require.NotEmpty(t, idempotencyKey)
		return nil, errors.New("invoice already paid")
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("paid invoice must prevent subscription cancellation")
		return model.ProviderSubscriptionSnapshot{}, nil
	}
	var graceContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&graceContract, contract.Id).Error)

	applied, err := reconcileExpiredStripeGraceContract(context.Background(), graceContract)

	require.False(t, applied)
	require.ErrorIs(t, err, paidReconcileErr)
	var reservedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reservedBinding, binding.Id).Error)
	require.NotEmpty(t, reservedBinding.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionGraceCancel, reservedBinding.LifecycleReservationAction)
	reservedToken := reservedBinding.LifecycleReservationToken
	reservedUntil := reservedBinding.LifecycleReservationUntil

	applied, err = reconcileExpiredStripeGraceContract(context.Background(), graceContract)

	require.NoError(t, err)
	require.True(t, applied)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
	var current model.UserSubscription
	require.NoError(t, model.DB.First(&current, reloadedContract.CurrentEntitlementId).Error)
	require.Equal(t, "stripe:in_grace_paid_retry_reserved", *current.GrantKey)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, binding.Id).Error)
	require.Equal(t, reservedToken, reloadedBinding.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionGraceCancel, reloadedBinding.LifecycleReservationAction)
	require.Zero(t, reloadedBinding.LifecycleReservationUntil)
	require.NotEqual(t, reservedUntil, reloadedBinding.LifecycleReservationUntil)
}

func TestStripeSubscriptionReconciliationInitialPaidRetryIgnoresExpiredCancelReservation(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 9141, 9241, "sub_grace_paid_retry_expired_reserved")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	expiredUntil := now - 3600
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id":   "in_grace_paid_retry_expired_reserved",
		"provider_status":              "past_due",
		"grace_period_end":             now - 10,
		"lifecycle_action_seq":         binding.LifecycleActionSeq + 1,
		"lifecycle_reservation_token":  "expired-cancel-reservation",
		"lifecycle_reservation_action": model.SubscriptionProviderLifecycleActionGraceCancel,
		"lifecycle_reservation_until":  expiredUntil,
	}).Error)

	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
	})
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		require.Equal(t, "in_grace_paid_retry_expired_reserved", invoiceID)
		inv := stripeInvoiceFixture(invoiceID, binding.ProviderSubscriptionId)
		inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
		return inv, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		require.Equal(t, binding.ProviderSubscriptionId, subscriptionID)
		sub := stripeSubscriptionFixture(subscriptionID, map[string]string{})
		setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
		sub.LatestInvoice = &stripe.Invoice{ID: "in_grace_paid_retry_expired_reserved"}
		return sub, nil
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("paid invoice must prevent subscription cancellation")
		return model.ProviderSubscriptionSnapshot{}, nil
	}
	var graceContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&graceContract, contract.Id).Error)

	applied, err := reconcileExpiredStripeGraceContract(context.Background(), graceContract)

	require.NoError(t, err)
	require.True(t, applied)
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
	var current model.UserSubscription
	require.NoError(t, model.DB.First(&current, reloadedContract.CurrentEntitlementId).Error)
	require.Equal(t, "stripe:in_grace_paid_retry_expired_reserved", *current.GrantKey)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, binding.Id).Error)
	require.Equal(t, "expired-cancel-reservation", reloadedBinding.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionGraceCancel, reloadedBinding.LifecycleReservationAction)
	require.Equal(t, expiredUntil, reloadedBinding.LifecycleReservationUntil)
}

func TestStripeSubscriptionReconciliationReleasesReservationWhenInvoiceFenceFailsBeforeCancel(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	require.NoError(t, model.DB.AutoMigrate(&model.PaymentWebhookEvent{}))
	contract, binding, entitlement := seedStripeRenewalContract(t, 9136, 9236, "sub_grace_fence_failure")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("id = ?", entitlement.Id).Update("access_end_time", now-10).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id": "in_grace_fence_failure",
		"provider_status":            "past_due",
		"grace_period_end":           now - 10,
	}).Error)

	originalInvoiceGetter := stripeInvoiceGetter
	originalInvoiceVoider := stripeInvoiceVoider
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeInvoiceVoider = originalInvoiceVoider
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
	})
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		inv := stripeInvoiceFixture(invoiceID, binding.ProviderSubscriptionId)
		markStripeInvoiceUnpaid(inv)
		inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
		return inv, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		return stripeSubscriptionFixture(subscriptionID, map[string]string{}), nil
	}
	voidErr := errors.New("Stripe invoice void failed")
	stripeInvoiceVoider = func(ctx context.Context, invoiceID string, idempotencyKey string) (*stripe.Invoice, error) {
		return nil, voidErr
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		return model.ProviderSubscriptionSnapshot{}, errors.New("subscription cancel must not run after invoice fence failure")
	}

	var graceContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&graceContract, contract.Id).Error)
	applied, err := reconcileExpiredStripeGraceContract(context.Background(), graceContract)

	require.False(t, applied)
	require.ErrorIs(t, err, voidErr)
	var currentBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&currentBinding, binding.Id).Error)
	require.Empty(t, currentBinding.LifecycleReservationToken)
	reservation, _, reserveErr := model.ReserveSubscriptionProviderLifecycle(
		currentBinding.Id,
		currentBinding.UserId,
		currentBinding.ProviderSubscriptionId,
		currentBinding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionResume,
		"reservation-after-fence-failure",
		300,
	)
	require.NoError(t, reserveErr)
	require.NotNil(t, reservation)
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
	paidFetches := 0
	var competingReservationErr error
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		require.Equal(t, "in_grace_paid_race", invoiceID)
		if !paymentArrived {
			inv := stripeInvoiceFixture(invoiceID, "sub_grace_paid_race")
			markStripeInvoiceUnpaid(inv)
			inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
			return inv, nil
		}
		paidFetches++
		if paidFetches == 2 {
			var currentBinding model.SubscriptionProviderBinding
			require.NoError(t, model.DB.First(&currentBinding, binding.Id).Error)
			_, _, competingReservationErr = model.ReserveSubscriptionProviderLifecycle(
				currentBinding.Id,
				currentBinding.UserId,
				currentBinding.ProviderSubscriptionId,
				currentBinding.LifecycleActionSeq,
				model.SubscriptionProviderLifecycleActionResume,
				"paid-reconcile-competing-reservation",
				300,
			)
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
	require.ErrorIs(t, competingReservationErr, model.ErrSubscriptionProviderLifecycleConflict)
	require.False(t, cancelCalled, "a paid grace invoice must fence remote subscription cancellation")
	var reloadedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloadedContract, "id = ?", contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusActive, reloadedContract.Status)
	var current model.UserSubscription
	require.NoError(t, model.DB.First(&current, "id = ?", reloadedContract.CurrentEntitlementId).Error)
	require.Equal(t, model.SubscriptionEntitlementStatusActive, current.Status)
	require.Equal(t, "stripe:in_grace_paid_race", *current.GrantKey)
	replayed, err := ReconcilePaidInvoice(context.Background(), "in_grace_paid_race")
	require.NoError(t, err)
	require.False(t, replayed.Applied)
	require.NotNil(t, replayed.Entitlement)
	require.Equal(t, current.Id, replayed.Entitlement.Id)
	var grantCount int64
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("contract_id = ?", contract.Id).Count(&grantCount).Error)
	require.Equal(t, int64(2), grantCount)
	var reloadedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&reloadedBinding, binding.Id).Error)
	require.NotEmpty(t, reloadedBinding.LifecycleReservationToken)
	require.Equal(t, model.SubscriptionProviderLifecycleActionGraceCancel, reloadedBinding.LifecycleReservationAction)
	require.Zero(t, reloadedBinding.LifecycleReservationUntil)
}

func TestStripeSubscriptionReconciliationDoesNotConsumePreexistingPaidInvoiceReservation(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 9137, 9237, "sub_grace_paid_preexisting_owner")
	now := common.GetTimestamp()
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":           model.SubscriptionContractStatusGrace,
		"grace_period_end": now - 10,
	}).Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"provider_latest_invoice_id": "in_grace_paid_preexisting_owner",
		"provider_status":            "past_due",
		"grace_period_end":           now - 10,
	}).Error)
	var currentBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&currentBinding, binding.Id).Error)
	reservation, _, err := model.ReserveSubscriptionProviderLifecycle(
		currentBinding.Id,
		currentBinding.UserId,
		currentBinding.ProviderSubscriptionId,
		currentBinding.LifecycleActionSeq,
		model.SubscriptionProviderLifecycleActionCancel,
		"preexisting-paid-invoice-owner",
		300,
	)
	require.NoError(t, err)

	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	originalCancelNow := stripeCancelSubscriptionNow
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
		stripeCancelSubscriptionNow = originalCancelNow
	})
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		paid := stripeInvoiceFixture(invoiceID, binding.ProviderSubscriptionId)
		paid.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
		return paid, nil
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		sub := stripeSubscriptionFixture(subscriptionID, map[string]string{})
		setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
		sub.LatestInvoice = &stripe.Invoice{ID: "in_grace_paid_preexisting_owner"}
		return sub, nil
	}
	stripeCancelSubscriptionNow = func(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
		t.Fatal("already-paid invoice must not trigger remote cancellation")
		return model.ProviderSubscriptionSnapshot{}, nil
	}

	var graceContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&graceContract, contract.Id).Error)
	applied, err := reconcileExpiredStripeGraceContract(context.Background(), graceContract)

	require.False(t, applied)
	require.ErrorIs(t, err, model.ErrSubscriptionProviderLifecycleConflict)
	require.NoError(t, model.DB.First(&currentBinding, binding.Id).Error)
	require.Equal(t, reservation.Token, currentBinding.LifecycleReservationToken)
	require.Equal(t, reservation.Action, currentBinding.LifecycleReservationAction)
	require.Equal(t, reservation.ExpiresAt, currentBinding.LifecycleReservationUntil)
}

func TestStripeBindingPointerDriftRoutesTerminalSnapshotToTermination(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, _ := seedStripeRenewalContract(t, 9135, 9235, "sub_pointer_drift_terminal")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("provider_schedule_id", "sched_pointer_drift").Error)
	originalSnapshot := stripeSubscriptionSnapshotForReconciliation
	t.Cleanup(func() { stripeSubscriptionSnapshotForReconciliation = originalSnapshot })
	stripeSubscriptionSnapshotForReconciliation = func(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
		require.Equal(t, binding.ProviderSubscriptionId, providerSubscriptionID)
		return model.ProviderSubscriptionSnapshot{
			ProviderSubscriptionId:     providerSubscriptionID,
			ProviderStatus:             "unpaid",
			ProviderScheduleIdObserved: true,
		}, nil
	}

	count, err := reconcileStripeBindingPointerDrift(context.Background())

	require.NoError(t, err)
	require.Equal(t, 1, count)
	var updatedBinding model.SubscriptionProviderBinding
	require.NoError(t, model.DB.First(&updatedBinding, binding.Id).Error)
	require.Equal(t, "unpaid", updatedBinding.ProviderStatus)
	require.Greater(t, updatedBinding.EndedAt, int64(0))
	var updatedEntitlement model.UserSubscription
	require.NoError(t, model.DB.First(&updatedEntitlement, contract.CurrentEntitlementId).Error)
	require.Equal(t, "cancelled", updatedEntitlement.Status)
	var updatedContract model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&updatedContract, contract.Id).Error)
	require.Equal(t, model.SubscriptionContractStatusNeedsAttention, updatedContract.Status)
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
