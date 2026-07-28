package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/stripe/stripe-go/v86"
	stripesubscription "github.com/stripe/stripe-go/v86/subscription"
	"gorm.io/gorm"
)

const (
	stripeSubscriptionReconciliationTickInterval = 15 * time.Minute
	stripeSubscriptionReconciliationBatchSize    = 100
)

var (
	stripeSubscriptionReconciliationOnce               sync.Once
	stripeSubscriptionReconciliationRunning            atomic.Bool
	stripeSubscriptionSnapshotForReconciliation        = getStripeSubscriptionSnapshotForReconciliation
	reconcileStripeInvoiceCollectionForCanceledBinding = reconcileStripeInvoiceCollectionForCanceledBindingNoop
)

func StartStripeSubscriptionReconciliationTask() {
	stripeSubscriptionReconciliationOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			logger.LogInfo(context.Background(), fmt.Sprintf("Stripe subscription reconciliation task started: tick=%s", stripeSubscriptionReconciliationTickInterval))
			ticker := time.NewTicker(stripeSubscriptionReconciliationTickInterval)
			defer ticker.Stop()

			runStripeSubscriptionReconciliationOnceLogged()
			for range ticker.C {
				runStripeSubscriptionReconciliationOnceLogged()
			}
		})
	})
}

func runStripeSubscriptionReconciliationOnceLogged() {
	count, err := RunStripeSubscriptionReconciliationOnce()
	if err != nil {
		logger.LogWarn(context.Background(), fmt.Sprintf("Stripe subscription reconciliation failed after %d binding(s): %v", count, err))
		return
	}
	if common.DebugEnabled && count > 0 {
		logger.LogDebug(context.Background(), "Stripe subscription reconciliation processed_count=%d", count)
	}
}

func RunStripeSubscriptionReconciliationOnce() (int, error) {
	if !common.IsMasterNode {
		return 0, nil
	}
	if !stripeSubscriptionReconciliationRunning.CompareAndSwap(false, true) {
		return 0, nil
	}
	defer stripeSubscriptionReconciliationRunning.Store(false)

	ctx := context.Background()
	var bindings []model.SubscriptionProviderBinding
	processed := 0
	for _, scan := range []func(context.Context) (int, error){
		reconcileExpiredStripeGraceContracts,
		resetExpiredStripeWebhookLeases,
		reconcileCancelDowngradeCompensations,
		reconcileStripeToBalanceCompensations,
		reconcileUnresolvedStripeInvoiceIntents,
		reconcileStalePendingStripePurchases,
		reconcilePendingStripeDowngrades,
		reconcileStripeBindingPointerDrift,
	} {
		count, err := scan(ctx)
		processed += count
		if err != nil {
			return processed, err
		}
	}

	if err := model.DB.Where("provider = ? AND provider_subscription_id <> ? AND ended_at = ?",
		model.PaymentProviderStripe, "", 0).
		Where("provider_status NOT IN ?", []string{"canceled", "incomplete_expired", "unpaid"}).
		Order("id asc").
		Limit(stripeSubscriptionReconciliationBatchSize).
		Find(&bindings).Error; err != nil {
		return processed, err
	}

	for _, binding := range bindings {
		skip, err := skipStripeBindingSnapshotForContractState(binding)
		if err != nil {
			return processed, err
		}
		if skip {
			continue
		}
		snapshot, err := stripeSubscriptionSnapshotForReconciliation(binding.ProviderSubscriptionId)
		if err != nil {
			return processed, err
		}
		if strings.TrimSpace(snapshot.ProviderSubscriptionId) == "" {
			snapshot.ProviderSubscriptionId = binding.ProviderSubscriptionId
		}
		if snapshot.EndedAt > 0 || isTerminalStripeSubscriptionStatus(snapshot.ProviderStatus) {
			updated, err := model.ApplyPassiveProviderSubscriptionTermination(binding.Id, snapshot)
			if err != nil {
				return processed, err
			}
			if err := reconcileStripeInvoiceCollectionForCanceledBinding(*updated); err != nil {
				return processed, err
			}
		} else {
			if _, err := model.ApplyProviderSubscriptionSnapshot(binding.Id, snapshot); err != nil {
				return processed, err
			}
		}
		processed++
	}
	return processed, nil
}

func reconcilePendingStripeDowngrades(ctx context.Context) (int, error) {
	if !stripeReconciliationTableAvailable(&model.UserSubscriptionContract{}) ||
		!stripeReconciliationTableAvailable(&model.SubscriptionChangeIntent{}) ||
		!stripeReconciliationTableAvailable(&model.SubscriptionProviderBinding{}) {
		return 0, nil
	}
	var contracts []model.UserSubscriptionContract
	if err := model.DB.
		Where("payment_mode = ? AND status = ? AND pending_plan_id > ? AND pending_effective_at > ? AND latest_change_intent_id > ?",
			model.SubscriptionPaymentModeStripeRecurring,
			model.SubscriptionContractStatusActive,
			0,
			0,
			0).
		Order("id asc").
		Limit(stripeSubscriptionReconciliationBatchSize).
		Find(&contracts).Error; err != nil {
		return 0, err
	}
	processed := 0
	for _, contract := range contracts {
		applied, err := reconcilePendingStripeDowngrade(ctx, contract)
		if err != nil {
			return processed, err
		}
		if applied {
			processed++
		}
	}
	return processed, nil
}

func reconcilePendingStripeDowngrade(ctx context.Context, contract model.UserSubscriptionContract) (bool, error) {
	var intent model.SubscriptionChangeIntent
	err := model.DB.Where("id = ? AND contract_id = ? AND kind = ? AND status IN ?",
		contract.LatestChangeIntentId,
		contract.Id,
		model.SubscriptionChangeIntentKindDowngrade,
		[]string{model.SubscriptionChangeIntentStatusSyncing, model.SubscriptionChangeIntentStatusScheduled},
	).First(&intent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	var binding model.SubscriptionProviderBinding
	if err := model.DB.Where("id = ? AND contract_id = ? AND user_id = ? AND provider = ?",
		intent.ProviderBindingId,
		contract.Id,
		contract.UserId,
		model.PaymentProviderStripe,
	).First(&binding).Error; err != nil {
		return false, err
	}
	var currentPlan model.SubscriptionPlan
	if err := model.DB.Where("id = ?", contract.CurrentPlanId).First(&currentPlan).Error; err != nil {
		return false, err
	}
	var targetPlan model.SubscriptionPlan
	if err := model.DB.Where("id = ?", intent.ToPlanId).First(&targetPlan).Error; err != nil {
		return false, err
	}
	idempotencyKey := strings.TrimSpace(intent.ProviderIdempotencyKey)
	if idempotencyKey == "" {
		idempotencyKey = stripeSubscriptionDowngradeIntentIdempotencyKey(contract.Id, intent.ChangeVersion, intent.ToPlanId, intent.Id)
	}
	result, err := stripeSubscriptionDowngradeExecutor(ctx, StripeSubscriptionDowngradeInput{
		UserID:                     intent.UserId,
		ContractID:                 contract.Id,
		ChangeIntentID:             intent.Id,
		ChangeVersion:              intent.ChangeVersion,
		CurrentPlanID:              contract.CurrentPlanId,
		TargetPlanID:               intent.ToPlanId,
		CurrentPriceID:             firstNonEmptyString(binding.ProviderPriceId, currentPlan.StripePriceId),
		TargetPriceID:              strings.TrimSpace(targetPlan.StripePriceId),
		ProviderSubscriptionID:     strings.TrimSpace(binding.ProviderSubscriptionId),
		ProviderSubscriptionItemID: strings.TrimSpace(binding.ProviderSubscriptionItemId),
		ProviderScheduleID:         strings.TrimSpace(binding.ProviderScheduleId),
		CurrentPeriodStart:         firstPositiveInt64(binding.CurrentPeriodStart, contract.CurrentPeriodStart),
		CurrentPeriodEnd:           firstPositiveInt64(contract.PendingEffectiveAt, binding.CurrentPeriodEnd, contract.CurrentPeriodEnd),
		IdempotencyKey:             idempotencyKey,
	})
	if err != nil {
		if markErr := markStripeSubscriptionDowngradeFailed(intent.Id, err); markErr != nil {
			return false, markErr
		}
		return false, nil
	}
	if err := persistStripeSubscriptionDowngradeResult(intent.Id, result); err != nil {
		return false, err
	}
	return true, nil
}

func skipStripeBindingSnapshotForContractState(binding model.SubscriptionProviderBinding) (bool, error) {
	if binding.ContractId <= 0 || !stripeReconciliationTableAvailable(&model.UserSubscriptionContract{}) {
		return false, nil
	}
	var contract model.UserSubscriptionContract
	err := model.DB.Where("id = ? AND user_id = ?", binding.ContractId, binding.UserId).First(&contract).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	switch contract.Status {
	case model.SubscriptionContractStatusActive, model.SubscriptionContractStatusGrace:
		return false, nil
	default:
		return true, nil
	}
}

func reconcileExpiredStripeGraceContracts(ctx context.Context) (int, error) {
	if !stripeReconciliationTableAvailable(&model.UserSubscriptionContract{}) ||
		!stripeReconciliationTableAvailable(&model.SubscriptionProviderBinding{}) ||
		!stripeReconciliationTableAvailable(&model.UserSubscription{}) {
		return 0, nil
	}
	now := common.GetTimestamp()
	var contracts []model.UserSubscriptionContract
	if err := model.DB.
		Where("status = ? AND payment_mode = ? AND grace_period_end > ? AND grace_period_end <= ? AND current_provider_binding_id > ?",
			model.SubscriptionContractStatusGrace,
			model.SubscriptionPaymentModeStripeRecurring,
			0,
			now,
			0).
		Order("id asc").
		Limit(stripeSubscriptionReconciliationBatchSize).
		Find(&contracts).Error; err != nil {
		return 0, err
	}
	processed := 0
	for _, contract := range contracts {
		applied, err := reconcileExpiredStripeGraceContract(ctx, contract)
		if err != nil {
			return processed, err
		}
		if applied {
			processed++
		}
	}
	return processed, nil
}

func reconcileExpiredStripeGraceContract(ctx context.Context, contract model.UserSubscriptionContract) (bool, error) {
	binding, entitlement, ok, err := currentStripeGraceFacts(contract)
	if err != nil || !ok {
		return false, err
	}
	if binding.EndedAt > 0 || isTerminalStripeSubscriptionStatus(binding.ProviderStatus) {
		return true, closeExpiredStripeGraceContract(contract, binding, entitlement)
	}
	invoiceID := strings.TrimSpace(binding.ProviderLatestInvoiceId)
	if invoiceID == "" {
		return false, markStripeGraceContractNeedsAttention(contract.Id, "Stripe grace deadline reached without latest invoice id")
	}
	inv, err := stripeInvoiceGetter(ctx, invoiceID)
	if err != nil {
		return false, err
	}
	if inv == nil || strings.TrimSpace(inv.ID) == "" {
		return false, errors.New("Stripe invoice is missing")
	}
	subscriptionID := stripeInvoiceSubscriptionID(inv)
	if subscriptionID == "" {
		return false, PermanentPaidInvoiceError(errors.New("Stripe invoice subscription id is missing"))
	}
	if subscriptionID != strings.TrimSpace(binding.ProviderSubscriptionId) {
		return false, PermanentPaidInvoiceError(errors.New("Stripe invoice subscription mismatch"))
	}
	sub, err := stripeSubscriptionGetter(ctx, subscriptionID)
	if err != nil {
		return false, err
	}
	if sub == nil || strings.TrimSpace(sub.ID) == "" {
		return false, errors.New("Stripe subscription is missing")
	}
	if strings.TrimSpace(sub.ID) != subscriptionID {
		return false, PermanentPaidInvoiceError(errors.New("Stripe subscription mismatch"))
	}
	if err := validateStripeGraceRemoteFacts(inv, sub, binding); err != nil {
		return true, markStripeGraceContractNeedsAttention(contract.Id, err.Error())
	}
	if stripeInvoiceIsPaid(inv) {
		reservation, hasReservation, reservationErr := stripeGracePaidInvoiceReservation(binding.Id)
		if reservationErr != nil {
			return false, reservationErr
		}
		if hasReservation {
			_, err := ReconcilePaidInvoiceWithLifecycleReservation(ctx, invoiceID, reservation)
			return err == nil, err
		}
		_, err := ReconcilePaidInvoice(ctx, invoiceID)
		return err == nil, err
	}
	reservation, reservedBinding, err := reserveStripeSubscriptionLifecycle(&binding, model.SubscriptionProviderLifecycleActionGraceCancel)
	if err != nil {
		return false, err
	}
	fenceResult, err := fenceStripeGraceInvoiceBeforeCancel(ctx, invoiceID, *reservedBinding)
	if err != nil {
		if releaseErr := model.ReleaseSubscriptionProviderLifecycleReservation(reservation); releaseErr != nil {
			return false, fmt.Errorf("%w; failed to release lifecycle reservation: %v", err, releaseErr)
		}
		return false, err
	}
	if fenceResult == stripeGraceInvoiceFencePaid {
		// Keep the reservation on reconciliation failure. The paid invoice may
		// already be authoritative, and releasing here would let cancel/resume
		// race the retry with a different lifecycle sequence.
		_, err := ReconcilePaidInvoiceWithLifecycleReservation(ctx, invoiceID, reservation)
		return err == nil, err
	}
	if fenceResult != stripeGraceInvoiceFenceCancel {
		if releaseErr := model.ReleaseSubscriptionProviderLifecycleReservation(reservation); releaseErr != nil {
			return false, releaseErr
		}
		return false, errors.New("Stripe grace invoice fence returned invalid state")
	}
	snapshot, cancelErr := stripeCancelSubscriptionNow(reservedBinding.ProviderSubscriptionId, recurringLifecycleIdempotencyKey(reservedBinding, "grace_expired"))
	if cancelErr != nil {
		// A transport error does not prove the Stripe mutation failed. Retain
		// the exact reservation until authoritative confirmation or lease expiry
		// so a retry reuses the same lifecycle sequence and idempotency key.
		confirmed, confirmErr := stripeSubscriptionSnapshotGetter(reservedBinding.ProviderSubscriptionId)
		if confirmErr != nil {
			return false, fmt.Errorf("%w; authoritative Stripe subscription confirmation failed: %v", cancelErr, confirmErr)
		}
		if strings.TrimSpace(confirmed.ProviderSubscriptionId) != strings.TrimSpace(reservedBinding.ProviderSubscriptionId) {
			return false, fmt.Errorf("%w; authoritative Stripe subscription ownership mismatch", cancelErr)
		}
		if confirmed.EndedAt <= 0 && !isTerminalStripeSubscriptionStatus(confirmed.ProviderStatus) {
			if releaseErr := model.ReleaseSubscriptionProviderLifecycleReservation(reservation); releaseErr != nil {
				return false, fmt.Errorf("%w; failed to release lifecycle reservation: %v", cancelErr, releaseErr)
			}
			return false, cancelErr
		}
		snapshot = confirmed
	}
	if strings.TrimSpace(snapshot.ProviderSubscriptionId) == "" {
		snapshot.ProviderSubscriptionId = reservedBinding.ProviderSubscriptionId
	}
	if strings.TrimSpace(snapshot.ProviderLatestInvoiceId) == "" {
		snapshot.ProviderLatestInvoiceId = invoiceID
	}
	if _, err := model.ApplyProviderSubscriptionTerminationWithReservation(reservation, snapshot); err != nil {
		return false, err
	}
	return true, closeExpiredStripeGraceContract(contract, binding, entitlement)
}

func stripeGracePaidInvoiceReservation(bindingID int64) (*model.SubscriptionProviderLifecycleReservation, bool, error) {
	reservation, err := model.GetActiveSubscriptionProviderLifecycleReservation(bindingID, model.SubscriptionProviderLifecycleActionGraceCancel)
	if err == nil {
		return reservation, true, nil
	}
	if !errors.Is(err, model.ErrSubscriptionProviderLifecycleConflict) {
		return nil, false, err
	}
	reservation, err = model.GetSubscriptionProviderLifecycleReservation(bindingID, model.SubscriptionProviderLifecycleActionGraceCancel)
	if err == nil {
		return reservation, true, nil
	}
	if !errors.Is(err, model.ErrSubscriptionProviderLifecycleConflict) {
		return nil, false, err
	}
	return nil, false, nil
}

type stripeGraceInvoiceFenceResult string

const (
	stripeGraceInvoiceFenceCancel stripeGraceInvoiceFenceResult = "cancel"
	stripeGraceInvoiceFencePaid   stripeGraceInvoiceFenceResult = "paid"
)

func fenceStripeGraceInvoiceBeforeCancel(ctx context.Context, invoiceID string, binding model.SubscriptionProviderBinding) (stripeGraceInvoiceFenceResult, error) {
	voided, voidErr := stripeInvoiceVoider(ctx, invoiceID, recurringLifecycleIdempotencyKey(&binding, "grace_invoice_void"))
	if voidErr == nil {
		if voided == nil || strings.TrimSpace(voided.ID) != invoiceID || voided.Status != stripe.InvoiceStatusVoid {
			return "", errors.New("Stripe grace invoice void returned invalid state")
		}
		return stripeGraceInvoiceFenceCancel, nil
	}

	authoritative, fetchErr := stripeInvoiceGetter(ctx, invoiceID)
	if fetchErr != nil {
		return "", fmt.Errorf("Stripe grace invoice void failed: %v; authoritative refetch failed: %w", voidErr, fetchErr)
	}
	if authoritative == nil || strings.TrimSpace(authoritative.ID) != invoiceID {
		return "", errors.New("Stripe grace invoice is missing after void failure")
	}
	if stripeInvoiceIsPaid(authoritative) {
		return stripeGraceInvoiceFencePaid, nil
	}
	if isTerminalStripeInvoiceStatus(authoritative.Status) {
		return stripeGraceInvoiceFenceCancel, nil
	}
	return "", voidErr
}

func currentStripeGraceFacts(contract model.UserSubscriptionContract) (model.SubscriptionProviderBinding, model.UserSubscription, bool, error) {
	if contract.Id <= 0 || contract.CurrentProviderBindingId <= 0 || contract.CurrentEntitlementId <= 0 {
		return model.SubscriptionProviderBinding{}, model.UserSubscription{}, false, nil
	}
	var binding model.SubscriptionProviderBinding
	if err := model.DB.Where("id = ? AND contract_id = ? AND user_id = ? AND provider = ?",
		contract.CurrentProviderBindingId,
		contract.Id,
		contract.UserId,
		model.PaymentProviderStripe).
		First(&binding).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.SubscriptionProviderBinding{}, model.UserSubscription{}, false, markStripeGraceContractNeedsAttention(contract.Id, "Stripe grace current binding is missing")
		}
		return model.SubscriptionProviderBinding{}, model.UserSubscription{}, false, err
	}
	var entitlement model.UserSubscription
	if err := model.DB.Where("id = ? AND contract_id = ? AND user_id = ?",
		contract.CurrentEntitlementId,
		contract.Id,
		contract.UserId).
		First(&entitlement).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return model.SubscriptionProviderBinding{}, model.UserSubscription{}, false, markStripeGraceContractNeedsAttention(contract.Id, "Stripe grace current entitlement is missing")
		}
		return model.SubscriptionProviderBinding{}, model.UserSubscription{}, false, err
	}
	return binding, entitlement, true, nil
}

func validateStripeGraceRemoteFacts(inv *stripe.Invoice, sub *stripe.Subscription, binding model.SubscriptionProviderBinding) error {
	if inv == nil || sub == nil {
		return errors.New("Stripe grace remote facts are missing")
	}
	invoiceCustomer := stripeCustomerID(inv.Customer)
	subscriptionCustomer := stripeCustomerID(sub.Customer)
	if invoiceCustomer == "" || subscriptionCustomer == "" || invoiceCustomer != subscriptionCustomer {
		return errors.New("Stripe grace customer mismatch")
	}
	if strings.TrimSpace(binding.ProviderCustomerId) == "" || strings.TrimSpace(binding.ProviderCustomerId) != invoiceCustomer {
		return errors.New("local Stripe customer mismatch")
	}
	if inv.Livemode != sub.Livemode || binding.Livemode != inv.Livemode {
		return errors.New("Stripe grace livemode mismatch")
	}
	var user model.User
	if err := model.DB.Where("id = ?", binding.UserId).First(&user).Error; err != nil {
		return err
	}
	if strings.TrimSpace(user.StripeCustomer) != "" && strings.TrimSpace(user.StripeCustomer) != invoiceCustomer {
		return errors.New("local Stripe customer mismatch")
	}
	return nil
}

func closeExpiredStripeGraceContract(contract model.UserSubscriptionContract, binding model.SubscriptionProviderBinding, entitlement model.UserSubscription) error {
	return model.DB.Transaction(func(tx *gorm.DB) error {
		now, err := subscriptionLifecycleDBTimestampTx(tx)
		if err != nil {
			return err
		}
		var lockedBinding model.SubscriptionProviderBinding
		if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", binding.Id, binding.UserId).First(&lockedBinding).Error; err != nil {
			return err
		}
		var locked model.UserSubscriptionContract
		if err := subscriptionCommandLock(tx).Where("id = ?", contract.Id).First(&locked).Error; err != nil {
			return err
		}
		if locked.Status == model.SubscriptionContractStatusEnded && locked.CurrentProviderBindingId == 0 && locked.CurrentEntitlementId == 0 {
			return nil
		}
		if locked.Status != model.SubscriptionContractStatusGrace ||
			locked.CurrentProviderBindingId != lockedBinding.Id ||
			locked.CurrentEntitlementId != entitlement.Id ||
			lockedBinding.ContractId != locked.Id ||
			lockedBinding.UserId != locked.UserId {
			return nil
		}
		if subscriptionProviderBindingHasActiveLifecycleReservation(&lockedBinding, now) {
			return model.ErrSubscriptionProviderLifecycleConflict
		}
		if err := tx.Model(&model.UserSubscription{}).
			Where("id = ? AND contract_id = ? AND user_id = ?", entitlement.Id, contract.Id, contract.UserId).
			Updates(map[string]interface{}{
				"current_slot":    nil,
				"status":          model.SubscriptionEntitlementStatusHistorical,
				"end_time":        now,
				"access_end_time": now,
				"end_reason":      model.SubscriptionEntitlementEndReasonExpired,
				"updated_at":      now,
			}).Error; err != nil {
			return err
		}
		return tx.Model(&model.UserSubscriptionContract{}).
			Where("id = ?", contract.Id).
			Updates(map[string]interface{}{
				"status":                      model.SubscriptionContractStatusEnded,
				"current_entitlement_id":      0,
				"current_provider_binding_id": 0,
				"pending_plan_id":             0,
				"pending_effective_at":        0,
				"grace_period_end":            0,
				"updated_at":                  now,
			}).Error
	})
}

func markStripeGraceContractNeedsAttention(contractID int64, reason string) error {
	if contractID <= 0 {
		return nil
	}
	return model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ? AND status = ?", contractID, model.SubscriptionContractStatusGrace).
		Updates(map[string]interface{}{
			"status":     model.SubscriptionContractStatusNeedsAttention,
			"updated_at": common.GetTimestamp(),
		}).Error
}

func resetExpiredStripeWebhookLeases(ctx context.Context) (int, error) {
	if !stripeReconciliationTableAvailable(&model.PaymentWebhookEvent{}) {
		return 0, nil
	}
	now := common.GetTimestamp()
	result := model.DB.Model(&model.PaymentWebhookEvent{}).
		Where("provider = ? AND status = ? AND processing_until > ? AND processing_until <= ?",
			model.PaymentProviderStripe,
			model.PaymentWebhookEventStatusProcessing,
			0,
			now).
		Updates(map[string]interface{}{
			"status":           model.PaymentWebhookEventStatusFailed,
			"processing_token": "",
			"processing_until": int64(0),
			"last_error":       "Stripe webhook processing lease expired; queued for reconciliation retry",
			"updated_at":       now,
		})
	return int(result.RowsAffected), result.Error
}

// ReconcileUnresolvedStripeIntentsForUser is the self-serve fast path of
// reconcileUnresolvedStripeInvoiceIntents: it applies this user's paid-but-
// unsettled Stripe change intents inline, so a buyer returning from a Stripe
// hosted-invoice payment sees the new plan on the very next
// GET /api/subscription/self instead of waiting for the invoice webhook
// (whose events may not be delivered) or the 15-minute background tick.
// Errors are logged, never surfaced — this must not break the read path.
// Multi-node safe: ReconcilePaidInvoice is transactional and idempotent.
func ReconcileUnresolvedStripeIntentsForUser(ctx context.Context, userId int) int {
	if userId <= 0 || !common.IsMasterNode {
		return 0
	}
	if err := ensureStripeSecretForSubscription(); err != nil {
		return 0
	}
	var intents []model.SubscriptionChangeIntent
	if err := model.DB.
		Where("user_id = ? AND payment_mode = ? AND status IN ? AND provider_invoice_id <> ?",
			userId,
			model.SubscriptionPaymentModeStripeRecurring,
			[]string{
				model.SubscriptionChangeIntentStatusAwaitingPayment,
				model.SubscriptionChangeIntentStatusSyncing,
			},
			"").
		Order("id asc").
		Limit(3).
		Find(&intents).Error; err != nil {
		return 0
	}
	applied := 0
	for _, intent := range intents {
		invoiceID := strings.TrimSpace(intent.ProviderInvoiceId)
		if invoiceID == "" {
			continue
		}
		inv, err := stripeInvoiceGetter(ctx, invoiceID)
		if err != nil || inv == nil || !stripeInvoiceIsPaid(inv) {
			continue
		}
		if _, err := ReconcilePaidInvoice(ctx, invoiceID); err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("self-serve Stripe intent reconcile failed user=%d intent=%d invoice=%s error=%q", userId, intent.Id, invoiceID, err.Error()))
			continue
		}
		applied++
		logger.LogInfo(ctx, fmt.Sprintf("self-serve Stripe intent reconcile applied user=%d intent=%d invoice=%s", userId, intent.Id, invoiceID))
	}
	return applied
}

func reconcileUnresolvedStripeInvoiceIntents(ctx context.Context) (int, error) {
	if !stripeReconciliationTableAvailable(&model.SubscriptionChangeIntent{}) {
		return 0, nil
	}
	var intents []model.SubscriptionChangeIntent
	if err := model.DB.
		Where("payment_mode = ? AND status IN ? AND provider_invoice_id <> ?",
			model.SubscriptionPaymentModeStripeRecurring,
			[]string{
				model.SubscriptionChangeIntentStatusAwaitingPayment,
				model.SubscriptionChangeIntentStatusSyncing,
				model.SubscriptionChangeIntentStatusCompensationRequired,
			},
			"").
		Order("id asc").
		Limit(stripeSubscriptionReconciliationBatchSize).
		Find(&intents).Error; err != nil {
		return 0, err
	}
	processed := 0
	for _, intent := range intents {
		invoiceID := strings.TrimSpace(intent.ProviderInvoiceId)
		if invoiceID == "" {
			continue
		}
		inv, err := stripeInvoiceGetter(ctx, invoiceID)
		if err != nil {
			return processed, err
		}
		if inv == nil || strings.TrimSpace(inv.ID) == "" {
			return processed, errors.New("Stripe invoice is missing")
		}
		if stripeInvoiceIsPaid(inv) {
			if _, err := ReconcilePaidInvoice(ctx, invoiceID); err != nil {
				return processed, err
			}
			processed++
			continue
		}
		subscriptionID := stripeInvoiceSubscriptionID(inv)
		if subscriptionID != "" {
			if _, err := stripeSubscriptionGetter(ctx, subscriptionID); err != nil {
				return processed, err
			}
		}
	}
	return processed, nil
}

func reconcileStalePendingStripePurchases(ctx context.Context) (int, error) {
	if !stripeReconciliationTableAvailable(&model.SubscriptionOrder{}) ||
		!stripeReconciliationTableAvailable(&model.SubscriptionChangeIntent{}) {
		return 0, nil
	}
	var orders []model.SubscriptionOrder
	if err := model.DB.
		Where("payment_provider = ? AND status = ? AND provider_payload LIKE ?",
			model.PaymentProviderStripe,
			common.TopUpStatusPending,
			"%invoice_id=%").
		Order("id asc").
		Limit(stripeSubscriptionReconciliationBatchSize).
		Find(&orders).Error; err != nil {
		return 0, err
	}
	processed := 0
	for _, order := range orders {
		invoiceID := parseInvoiceIDFromPayload(order.ProviderPayload)
		if invoiceID == "" {
			continue
		}
		inv, err := stripeInvoiceGetter(ctx, invoiceID)
		if err != nil {
			return processed, err
		}
		if inv == nil || strings.TrimSpace(inv.ID) == "" {
			return processed, errors.New("Stripe invoice is missing")
		}
		if stripeInvoiceIsPaid(inv) {
			if _, err := ReconcilePaidInvoice(ctx, invoiceID); err != nil {
				return processed, err
			}
			processed++
			continue
		}
		if subscriptionID := stripeInvoiceSubscriptionID(inv); subscriptionID != "" {
			sub, err := stripeSubscriptionGetter(ctx, subscriptionID)
			if err != nil {
				return processed, err
			}
			if sub != nil && isTerminalStripeSubscriptionStatus(string(sub.Status)) {
				if err := TerminatePendingStripePurchase(ctx, order.TradeNo, model.SubscriptionChangeIntentStatusFailed); err != nil {
					return processed, err
				}
				processed++
				continue
			}
		}
		if !isTerminalStripeInvoiceStatus(inv.Status) {
			continue
		}
		if err := TerminatePendingStripePurchase(ctx, order.TradeNo, model.SubscriptionChangeIntentStatusFailed); err != nil {
			return processed, err
		}
		processed++
	}
	return processed, nil
}

func parseInvoiceIDFromPayload(payload string) string {
	for _, part := range strings.Split(payload, ";") {
		key, value, ok := strings.Cut(part, "=")
		if !ok || strings.TrimSpace(key) != "invoice_id" {
			continue
		}
		return strings.TrimSpace(value)
	}
	return ""
}

func isTerminalStripeInvoiceStatus(status stripe.InvoiceStatus) bool {
	switch strings.ToLower(strings.TrimSpace(string(status))) {
	case "void", "uncollectible":
		return true
	default:
		return false
	}
}

func reconcileStripeBindingPointerDrift(ctx context.Context) (int, error) {
	if !stripeReconciliationTableAvailable(&model.UserSubscriptionContract{}) ||
		!stripeReconciliationTableAvailable(&model.SubscriptionProviderBinding{}) {
		return 0, nil
	}
	var contracts []model.UserSubscriptionContract
	if err := model.DB.
		Where("payment_mode = ? AND status IN ? AND current_provider_binding_id > ?",
			model.SubscriptionPaymentModeStripeRecurring,
			[]string{model.SubscriptionContractStatusActive, model.SubscriptionContractStatusGrace},
			0).
		Order("id asc").
		Limit(stripeSubscriptionReconciliationBatchSize).
		Find(&contracts).Error; err != nil {
		return 0, err
	}
	processed := 0
	for _, contract := range contracts {
		var binding model.SubscriptionProviderBinding
		err := model.DB.Where("id = ? AND provider = ?", contract.CurrentProviderBindingId, model.PaymentProviderStripe).First(&binding).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := markStripeContractNeedsAttention(contract.Id); err != nil {
				return processed, err
			}
			processed++
			continue
		}
		if err != nil {
			return processed, err
		}
		if binding.ContractId != contract.Id || binding.UserId != contract.UserId || isTerminalStripeSubscriptionStatus(binding.ProviderStatus) || binding.EndedAt > 0 {
			if err := markStripeContractNeedsAttention(contract.Id); err != nil {
				return processed, err
			}
			processed++
			continue
		}
		if strings.TrimSpace(binding.ProviderScheduleId) != "" {
			snapshot, err := stripeSubscriptionSnapshotForReconciliation(binding.ProviderSubscriptionId)
			if err != nil {
				return processed, err
			}
			if snapshot.EndedAt > 0 || isTerminalStripeSubscriptionStatus(snapshot.ProviderStatus) {
				if _, err := model.ApplyPassiveProviderSubscriptionTermination(binding.Id, snapshot); err != nil {
					return processed, err
				}
				if err := markStripeContractNeedsAttention(contract.Id); err != nil {
					return processed, err
				}
				processed++
				continue
			}
			if snapshot.ProviderScheduleIdObserved && strings.TrimSpace(snapshot.ProviderScheduleId) != strings.TrimSpace(binding.ProviderScheduleId) {
				if _, err := model.ApplyProviderSubscriptionSnapshot(binding.Id, snapshot); err != nil {
					return processed, err
				}
				processed++
			}
		}
	}
	return processed, nil
}

func markStripeContractNeedsAttention(contractID int64) error {
	if contractID <= 0 {
		return nil
	}
	return model.DB.Model(&model.UserSubscriptionContract{}).
		Where("id = ? AND status <> ?", contractID, model.SubscriptionContractStatusEnded).
		Updates(map[string]interface{}{
			"status":     model.SubscriptionContractStatusNeedsAttention,
			"updated_at": common.GetTimestamp(),
		}).Error
}

func stripeReconciliationTableAvailable(value interface{}) bool {
	return model.DB != nil && model.DB.Migrator().HasTable(value)
}

func getStripeSubscriptionSnapshotForReconciliation(providerSubscriptionID string) (model.ProviderSubscriptionSnapshot, error) {
	if err := ensureStripeLifecycleKey(); err != nil {
		return model.ProviderSubscriptionSnapshot{}, err
	}
	params := &stripe.SubscriptionParams{}
	ctx, cancel := context.WithTimeout(context.Background(), stripeSubscriptionLifecycleRequestTimeout)
	defer cancel()
	params.Context = ctx
	params.AddExpand("latest_invoice")
	params.AddExpand("items.data.price")
	sub, err := stripesubscription.Get(strings.TrimSpace(providerSubscriptionID), params)
	if err != nil {
		return model.ProviderSubscriptionSnapshot{}, err
	}
	return providerSubscriptionSnapshotFromStripe(sub), nil
}

func reconcileStripeInvoiceCollectionForCanceledBindingNoop(binding model.SubscriptionProviderBinding) error {
	return nil
}
