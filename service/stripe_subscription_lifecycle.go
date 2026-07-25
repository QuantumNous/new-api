package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/stripe/stripe-go/v86"
	stripesubscription "github.com/stripe/stripe-go/v86/subscription"
	stripeschedule "github.com/stripe/stripe-go/v86/subscriptionschedule"
	"gorm.io/gorm"
)

var stripeUpdateSubscriptionCancelAtPeriodEnd = updateStripeSubscriptionCancelAtPeriodEnd
var stripeCancelSubscriptionNow = cancelStripeSubscriptionNow
var stripeReleaseSubscriptionSchedule = releaseStripeSubscriptionSchedule
var stripeRestoreSubscriptionSchedule = restoreStripeSubscriptionUpgradeSchedule
var stripeSubscriptionSnapshotGetter = getStripeSubscriptionSnapshotForReconciliation

const cancelDowngradeCompensationErrorPrefix = "cancel coordination uncertain: "

func CancelStripeRecurringSubscription(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
	binding, err := recurringBindingForUser(userID, bindingID)
	if err != nil {
		return nil, err
	}
	idempotencyKey := recurringLifecycleIdempotencyKey(binding, "cancel")
	if strings.EqualFold(binding.ProviderStatus, "past_due") {
		snapshot, err := stripeCancelSubscriptionNow(binding.ProviderSubscriptionId, idempotencyKey)
		if err != nil {
			return nil, err
		}
		return model.ApplyProviderSubscriptionTermination(binding.Id, snapshot)
	}
	if binding.CancelAtPeriodEnd {
		return binding, nil
	}
	downgrade, hasPendingDowngrade, err := releasePendingDowngradeBeforeCancel(binding)
	if err != nil {
		if !hasPendingDowngrade {
			return nil, err
		}
		return resolvePendingDowngradeAfterCancelAttempt(binding, downgrade, err)
	}
	snapshot, err := stripeUpdateSubscriptionCancelAtPeriodEnd(binding.ProviderSubscriptionId, true, idempotencyKey)
	if !hasPendingDowngrade {
		if err != nil {
			return nil, err
		}
		return model.ApplyProviderSubscriptionSnapshot(binding.Id, snapshot)
	}
	return resolvePendingDowngradeAfterCancelAttempt(binding, downgrade, err)
}

func resolvePendingDowngradeAfterCancelAttempt(binding *model.SubscriptionProviderBinding, downgrade model.SubscriptionChangeIntent, updateErr error) (*model.SubscriptionProviderBinding, error) {
	confirmed, confirmErr := stripeSubscriptionSnapshotGetter(binding.ProviderSubscriptionId)
	if confirmErr != nil || strings.TrimSpace(confirmed.ProviderSubscriptionId) != binding.ProviderSubscriptionId {
		cause := confirmErr
		if cause == nil {
			cause = errors.New("authoritative Stripe subscription ownership mismatch")
		}
		if updateErr != nil {
			cause = fmt.Errorf("Stripe cancel update failed: %v; authoritative confirmation failed: %w", updateErr, cause)
		}
		if markErr := markCancelDowngradeCompensationUncertain(binding, downgrade, cause); markErr != nil {
			return nil, fmt.Errorf("%w; failed to persist cancel coordination uncertainty: %v", cause, markErr)
		}
		return nil, cause
	}
	if confirmed.CancelAtPeriodEnd {
		updated, applyErr := model.ApplyProviderSubscriptionSnapshot(binding.Id, confirmed)
		if applyErr != nil {
			_ = markCancelDowngradeCompensationUncertain(binding, downgrade, applyErr)
			return nil, applyErr
		}
		if clearErr := clearPendingDowngradeAfterCancel(binding, downgrade); clearErr != nil {
			_ = markCancelDowngradeCompensationUncertain(binding, downgrade, clearErr)
			return nil, clearErr
		}
		return updated, nil
	}

	if _, applyErr := model.ApplyProviderSubscriptionSnapshot(binding.Id, confirmed); applyErr != nil {
		return nil, applyErr
	}
	restoreCause := updateErr
	if restoreCause == nil {
		restoreCause = errors.New("Stripe period-end cancel was not applied")
	}
	restoreErr := restorePendingDowngradeAfterCancelFailure(binding, downgrade, confirmed, restoreCause)
	if restoreErr != nil {
		return nil, restoreErr
	}
	if updateErr != nil {
		return nil, updateErr
	}
	return nil, errors.New("Stripe period-end cancel was not applied")
}

func ResumeStripeRecurringSubscription(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
	binding, err := recurringBindingForUser(userID, bindingID)
	if err != nil {
		return nil, err
	}
	if isTerminalStripeSubscriptionStatus(binding.ProviderStatus) || binding.EndedAt > 0 {
		return nil, errors.New("terminal Stripe subscription cannot be resumed")
	}
	if !binding.CancelAtPeriodEnd {
		return binding, nil
	}
	snapshot, err := stripeUpdateSubscriptionCancelAtPeriodEnd(binding.ProviderSubscriptionId, false, recurringLifecycleIdempotencyKey(binding, "resume"))
	if err != nil {
		return nil, err
	}
	return model.ApplyProviderSubscriptionSnapshot(binding.Id, snapshot)
}

func AdminInvalidateUserSubscriptionWithRecurringPolicy(userSubscriptionID int) (string, error) {
	sub, binding, managed, err := adminRecurringPolicyTarget(userSubscriptionID)
	if err != nil {
		return "", err
	}
	if !managed {
		return model.AdminInvalidateUserSubscription(userSubscriptionID)
	}
	snapshot, err := stripeCancelSubscriptionNow(binding.ProviderSubscriptionId, recurringLifecycleIdempotencyKey(binding, "admin_invalidate"))
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(snapshot.ProviderSubscriptionId) == "" {
		snapshot.ProviderSubscriptionId = binding.ProviderSubscriptionId
	}
	if _, err := model.ApplyProviderSubscriptionTermination(binding.Id, snapshot); err != nil {
		return "", err
	}
	return model.AdminInvalidateUserSubscription(sub.Id)
}

func AdminDeleteUserSubscriptionWithRecurringPolicy(userSubscriptionID int) (string, error) {
	_, _, managed, err := adminRecurringPolicyTarget(userSubscriptionID)
	if err != nil {
		return "", err
	}
	if managed {
		return "", errors.New("Stripe recurring subscription history cannot be deleted")
	}
	return model.AdminDeleteUserSubscription(userSubscriptionID)
}

func recurringBindingForUser(userID int, bindingID int64) (*model.SubscriptionProviderBinding, error) {
	binding, err := model.FindBindingByIDForUser(bindingID, userID)
	if err != nil {
		return nil, err
	}
	if binding.Provider != model.PaymentProviderStripe {
		return nil, errors.New("recurring subscription is not managed by Stripe")
	}
	if strings.TrimSpace(binding.ProviderSubscriptionId) == "" {
		return nil, errors.New("Stripe subscription binding is incomplete")
	}
	if isTerminalStripeSubscriptionStatus(binding.ProviderStatus) || binding.EndedAt > 0 {
		return nil, errors.New("current subscription is not active Stripe recurring")
	}
	if binding.ContractId <= 0 {
		return binding, nil
	}
	var contract model.UserSubscriptionContract
	if err := model.DB.Where("id = ? AND user_id = ? AND status = ? AND payment_mode = ? AND current_provider_binding_id = ?",
		binding.ContractId,
		userID,
		model.SubscriptionContractStatusActive,
		model.SubscriptionPaymentModeStripeRecurring,
		binding.Id,
	).First(&contract).Error; err != nil {
		return nil, errors.New("current active Stripe recurring contract binding mismatch")
	}
	if contract.Id <= 0 || binding.ContractId != contract.Id {
		return nil, errors.New("current active Stripe recurring contract binding mismatch")
	}
	return binding, nil
}

func adminRecurringPolicyTarget(userSubscriptionID int) (*model.UserSubscription, *model.SubscriptionProviderBinding, bool, error) {
	if userSubscriptionID <= 0 {
		return nil, nil, false, errors.New("invalid userSubscriptionId")
	}
	var sub model.UserSubscription
	if err := model.DB.Where("id = ?", userSubscriptionID).First(&sub).Error; err != nil {
		return nil, nil, false, err
	}
	if sub.ProviderBindingId <= 0 {
		return &sub, nil, false, nil
	}
	var binding model.SubscriptionProviderBinding
	if err := model.DB.Where("id = ?", sub.ProviderBindingId).First(&binding).Error; err != nil {
		return &sub, nil, false, err
	}
	managed := binding.Provider == model.PaymentProviderStripe && strings.TrimSpace(binding.ProviderSubscriptionId) != ""
	return &sub, &binding, managed, nil
}

func recurringLifecycleIdempotencyKey(binding *model.SubscriptionProviderBinding, action string) string {
	currentPeriodEnd := int64(0)
	bindingID := int64(0)
	actionSeq := int64(0)
	if binding != nil {
		currentPeriodEnd = binding.CurrentPeriodEnd
		bindingID = binding.Id
		actionSeq = binding.LifecycleActionSeq
	}
	return fmt.Sprintf("newapi_subscription_binding_%d_%s_%d_%d", bindingID, action, currentPeriodEnd, actionSeq)
}

func isTerminalStripeSubscriptionStatus(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "canceled", "incomplete_expired", "unpaid":
		return true
	default:
		return false
	}
}

func updateStripeSubscriptionCancelAtPeriodEnd(providerSubscriptionID string, cancelAtPeriodEnd bool, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
	if err := ensureStripeLifecycleKey(); err != nil {
		return model.ProviderSubscriptionSnapshot{}, err
	}
	params := &stripe.SubscriptionParams{
		CancelAtPeriodEnd: stripe.Bool(cancelAtPeriodEnd),
	}
	params.SetIdempotencyKey(idempotencyKey)
	params.AddExpand("latest_invoice")
	params.AddExpand("items.data.price")
	sub, err := stripesubscription.Update(strings.TrimSpace(providerSubscriptionID), params)
	if err != nil {
		return model.ProviderSubscriptionSnapshot{}, err
	}
	return providerSubscriptionSnapshotFromStripe(sub), nil
}

func cancelStripeSubscriptionNow(providerSubscriptionID string, idempotencyKey string) (model.ProviderSubscriptionSnapshot, error) {
	if err := ensureStripeLifecycleKey(); err != nil {
		return model.ProviderSubscriptionSnapshot{}, err
	}
	params := &stripe.SubscriptionCancelParams{}
	params.SetIdempotencyKey(idempotencyKey)
	sub, err := stripesubscription.Cancel(strings.TrimSpace(providerSubscriptionID), params)
	if err != nil {
		return model.ProviderSubscriptionSnapshot{}, err
	}
	return providerSubscriptionSnapshotFromStripe(sub), nil
}

func releaseStripeSubscriptionSchedule(scheduleID string, idempotencyKey string) error {
	if strings.TrimSpace(scheduleID) == "" {
		return nil
	}
	if err := ensureStripeLifecycleKey(); err != nil {
		return err
	}
	params := &stripe.SubscriptionScheduleReleaseParams{PreserveCancelDate: stripe.Bool(true)}
	params.SetIdempotencyKey(strings.TrimSpace(idempotencyKey))
	released, err := stripeschedule.Release(strings.TrimSpace(scheduleID), params)
	if err != nil {
		return err
	}
	if released == nil || strings.TrimSpace(released.ID) != strings.TrimSpace(scheduleID) {
		return errors.New("Stripe schedule release could not be confirmed")
	}
	return nil
}

func releasePendingDowngradeBeforeCancel(binding *model.SubscriptionProviderBinding) (model.SubscriptionChangeIntent, bool, error) {
	if binding == nil || binding.ContractId <= 0 || strings.TrimSpace(binding.ProviderScheduleId) == "" {
		return model.SubscriptionChangeIntent{}, false, nil
	}
	var downgrade model.SubscriptionChangeIntent
	err := model.DB.Where("contract_id = ? AND user_id = ? AND provider_binding_id = ? AND kind = ? AND status IN ?",
		binding.ContractId,
		binding.UserId,
		binding.Id,
		model.SubscriptionChangeIntentKindDowngrade,
		[]string{model.SubscriptionChangeIntentStatusSyncing, model.SubscriptionChangeIntentStatusScheduled},
	).Order("change_version desc, id desc").First(&downgrade).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return model.SubscriptionChangeIntent{}, false, nil
	}
	if err != nil {
		return model.SubscriptionChangeIntent{}, false, err
	}
	snapshot := downgrade.PreviousScheduleSnapshot
	if strings.TrimSpace(snapshot) == "" {
		snapshot, err = pendingDowngradeScheduleSnapshot(binding, downgrade)
		if err != nil {
			return downgrade, false, err
		}
		if err := model.DB.Model(&downgrade).Update("previous_schedule_snapshot", snapshot).Error; err != nil {
			return model.SubscriptionChangeIntent{}, false, err
		}
		downgrade.PreviousScheduleSnapshot = snapshot
	}
	if err := markCancelDowngradeCompensationUncertain(binding, downgrade, errors.New("cancel coordination in progress")); err != nil {
		return downgrade, false, err
	}
	if err := stripeReleaseSubscriptionSchedule(binding.ProviderScheduleId, recurringLifecycleIdempotencyKey(binding, "cancel_release_schedule")); err != nil {
		return downgrade, true, err
	}
	bindingUpdate := model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ? AND provider_schedule_id = ?", binding.Id, binding.ProviderScheduleId).
		Updates(map[string]interface{}{"provider_schedule_id": "", "updated_at": common.GetTimestamp()})
	if bindingUpdate.Error != nil {
		return downgrade, true, bindingUpdate.Error
	}
	if bindingUpdate.RowsAffected != 1 {
		return downgrade, true, errors.New("cancel downgrade schedule binding state mismatch")
	}
	return downgrade, true, nil
}

func pendingDowngradeScheduleSnapshot(binding *model.SubscriptionProviderBinding, downgrade model.SubscriptionChangeIntent) (string, error) {
	if binding == nil || strings.TrimSpace(binding.ProviderSubscriptionId) == "" {
		return "", errors.New("Stripe downgrade schedule binding is incomplete")
	}
	var currentPlan model.SubscriptionPlan
	if err := model.DB.Where("id = ?", downgrade.FromPlanId).First(&currentPlan).Error; err != nil {
		return "", err
	}
	var targetPlan model.SubscriptionPlan
	if err := model.DB.Where("id = ?", downgrade.ToPlanId).First(&targetPlan).Error; err != nil {
		return "", err
	}
	currentPriceID := firstNonEmptyString(binding.ProviderPriceId, currentPlan.StripePriceId)
	targetPriceID := strings.TrimSpace(targetPlan.StripePriceId)
	effectiveAt := firstPositiveInt64(downgrade.EffectiveAt, binding.CurrentPeriodEnd)
	if currentPriceID == "" || targetPriceID == "" || binding.CurrentPeriodStart <= 0 || effectiveAt <= binding.CurrentPeriodStart {
		return "", errors.New("Stripe downgrade schedule snapshot is incomplete")
	}
	targetEnd, err := subscriptionPlanPeriodEnd(effectiveAt, &targetPlan)
	if err != nil {
		return "", err
	}
	type recoverableDowngradeScheduleSnapshot struct {
		SubscriptionID string                                           `json:"subscription_id"`
		ScheduleID     string                                           `json:"schedule_id"`
		EndBehavior    string                                           `json:"end_behavior"`
		Phases         []stripeSubscriptionUpgradeSchedulePhaseSnapshot `json:"phases"`
	}
	snapshot := recoverableDowngradeScheduleSnapshot{
		SubscriptionID: strings.TrimSpace(binding.ProviderSubscriptionId),
		ScheduleID:     strings.TrimSpace(binding.ProviderScheduleId),
		EndBehavior:    "release",
		Phases: []stripeSubscriptionUpgradeSchedulePhaseSnapshot{
			{
				StartDate:         binding.CurrentPeriodStart,
				EndDate:           effectiveAt,
				ProrationBehavior: "none",
				Items:             []stripeSubscriptionUpgradeScheduleItemSnapshot{{PriceID: currentPriceID, Quantity: 1}},
			},
			{
				StartDate:         effectiveAt,
				EndDate:           targetEnd,
				ProrationBehavior: "none",
				Items:             []stripeSubscriptionUpgradeScheduleItemSnapshot{{PriceID: targetPriceID, Quantity: 1}},
			},
		},
	}
	raw, err := common.Marshal(snapshot)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func restorePendingDowngradeAfterCancelFailure(binding *model.SubscriptionProviderBinding, downgrade model.SubscriptionChangeIntent, snapshot model.ProviderSubscriptionSnapshot, cause error) error {
	if binding == nil || downgrade.Id <= 0 {
		return nil
	}
	scheduleID := ""
	if snapshot.ProviderScheduleIdObserved {
		scheduleID = strings.TrimSpace(snapshot.ProviderScheduleId)
	}
	if scheduleID == "" {
		var restoreErr error
		scheduleID, restoreErr = stripeRestoreSubscriptionSchedule(downgrade.PreviousScheduleSnapshot, recurringLifecycleIdempotencyKey(binding, "cancel_restore_schedule"))
		if restoreErr != nil {
			return markCancelDowngradeRecoveryUncertain(binding, downgrade, cause, restoreErr)
		}
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		now := common.GetTimestamp()
		if err := tx.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Updates(map[string]interface{}{
			"provider_schedule_id": strings.TrimSpace(scheduleID),
			"updated_at":           now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", binding.ContractId).Updates(map[string]interface{}{
			"status":               model.SubscriptionContractStatusActive,
			"pending_plan_id":      downgrade.ToPlanId,
			"pending_effective_at": downgrade.EffectiveAt,
			"updated_at":           now,
		}).Error; err != nil {
			return err
		}
		return tx.Model(&model.SubscriptionChangeIntent{}).Where("id = ?", downgrade.Id).Updates(map[string]interface{}{
			"status":               model.SubscriptionChangeIntentStatusScheduled,
			"provider_schedule_id": strings.TrimSpace(scheduleID),
			"last_error":           "",
			"updated_at":           now,
		}).Error
	})
}

func markCancelDowngradeRecoveryUncertain(binding *model.SubscriptionProviderBinding, downgrade model.SubscriptionChangeIntent, cancelErr error, restoreErr error) error {
	cause := fmt.Errorf("cancel failed: %v; schedule recovery failed: %w", cancelErr, restoreErr)
	if markErr := markCancelDowngradeCompensationUncertain(binding, downgrade, cause); markErr != nil {
		return fmt.Errorf("%w; failed to persist cancel coordination uncertainty: %v", cause, markErr)
	}
	return cause
}

func markCancelDowngradeCompensationUncertain(binding *model.SubscriptionProviderBinding, downgrade model.SubscriptionChangeIntent, cause error) error {
	if binding == nil || binding.Id <= 0 || binding.ContractId <= 0 || downgrade.Id <= 0 {
		return errors.New("invalid cancel downgrade compensation target")
	}
	lastError := cancelDowngradeCompensationErrorPrefix
	if cause != nil {
		lastError += cause.Error()
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		now := common.GetTimestamp()
		intentUpdate := tx.Model(&model.SubscriptionChangeIntent{}).Where(
			"id = ? AND contract_id = ? AND user_id = ? AND provider_binding_id = ? AND kind = ? AND status IN ?",
			downgrade.Id, binding.ContractId, binding.UserId, binding.Id, model.SubscriptionChangeIntentKindDowngrade,
			[]string{model.SubscriptionChangeIntentStatusSyncing, model.SubscriptionChangeIntentStatusScheduled, model.SubscriptionChangeIntentStatusCompensationRequired},
		).Updates(map[string]interface{}{
			"status":     model.SubscriptionChangeIntentStatusCompensationRequired,
			"last_error": lastError,
			"updated_at": now,
		})
		if intentUpdate.Error != nil {
			return intentUpdate.Error
		}
		if intentUpdate.RowsAffected != 1 {
			return errors.New("cancel downgrade compensation intent ownership mismatch")
		}
		contractUpdate := tx.Model(&model.UserSubscriptionContract{}).Where(
			"id = ? AND user_id = ? AND current_provider_binding_id = ? AND payment_mode = ?",
			binding.ContractId, binding.UserId, binding.Id, model.SubscriptionPaymentModeStripeRecurring,
		).Updates(map[string]interface{}{
			"status":     model.SubscriptionContractStatusNeedsAttention,
			"updated_at": now,
		})
		if contractUpdate.Error != nil {
			return contractUpdate.Error
		}
		if contractUpdate.RowsAffected != 1 {
			return errors.New("cancel downgrade compensation contract ownership mismatch")
		}
		return nil
	})
}

func clearPendingDowngradeAfterCancel(binding *model.SubscriptionProviderBinding, downgrade model.SubscriptionChangeIntent) error {
	if binding == nil || downgrade.Id <= 0 {
		return nil
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		now := common.GetTimestamp()
		contractUpdate := tx.Model(&model.UserSubscriptionContract{}).Where("id = ? AND user_id = ? AND current_provider_binding_id = ? AND pending_plan_id = ?",
			binding.ContractId,
			binding.UserId,
			binding.Id,
			downgrade.ToPlanId,
		).Updates(map[string]interface{}{
			"status":               model.SubscriptionContractStatusActive,
			"pending_plan_id":      0,
			"pending_effective_at": 0,
			"updated_at":           now,
		})
		if contractUpdate.Error != nil {
			return contractUpdate.Error
		}
		if contractUpdate.RowsAffected != 1 {
			return errors.New("cancel downgrade contract state mismatch")
		}
		intentUpdate := tx.Model(&model.SubscriptionChangeIntent{}).Where(
			"id = ? AND contract_id = ? AND user_id = ? AND provider_binding_id = ? AND status IN ?",
			downgrade.Id, binding.ContractId, binding.UserId, binding.Id,
			[]string{model.SubscriptionChangeIntentStatusSyncing, model.SubscriptionChangeIntentStatusScheduled, model.SubscriptionChangeIntentStatusCompensationRequired},
		).Updates(map[string]interface{}{
			"status":     model.SubscriptionChangeIntentStatusSuperseded,
			"last_error": "",
			"updated_at": now,
		})
		if intentUpdate.Error != nil {
			return intentUpdate.Error
		}
		if intentUpdate.RowsAffected != 1 {
			return errors.New("cancel downgrade intent state mismatch")
		}
		return nil
	})
}

func ReconcileCancelDowngradeCompensationRequired(ctx context.Context, limit int) (int, error) {
	_ = ctx
	if limit <= 0 {
		limit = stripeSubscriptionReconciliationBatchSize
	}
	var intents []model.SubscriptionChangeIntent
	if err := model.DB.Where(
		"kind = ? AND payment_mode = ? AND status = ? AND provider_binding_id > ? AND previous_schedule_snapshot <> ? AND last_error LIKE ?",
		model.SubscriptionChangeIntentKindDowngrade,
		model.SubscriptionPaymentModeStripeRecurring,
		model.SubscriptionChangeIntentStatusCompensationRequired,
		0,
		"",
		cancelDowngradeCompensationErrorPrefix+"%",
	).Order("id asc").Limit(limit).Find(&intents).Error; err != nil {
		return 0, err
	}
	processed := 0
	for _, intent := range intents {
		if err := reconcileCancelDowngradeCompensation(intent); err != nil {
			return processed, err
		}
		processed++
	}
	return processed, nil
}

func reconcileCancelDowngradeCompensation(intent model.SubscriptionChangeIntent) error {
	var contract model.UserSubscriptionContract
	if err := model.DB.Where(
		"id = ? AND user_id = ? AND status = ? AND payment_mode = ? AND current_provider_binding_id = ?",
		intent.ContractId, intent.UserId, model.SubscriptionContractStatusNeedsAttention,
		model.SubscriptionPaymentModeStripeRecurring, intent.ProviderBindingId,
	).First(&contract).Error; err != nil {
		return err
	}
	var binding model.SubscriptionProviderBinding
	if err := model.DB.Where("id = ? AND contract_id = ? AND user_id = ? AND provider = ? AND ended_at = ?",
		intent.ProviderBindingId, contract.Id, contract.UserId, model.PaymentProviderStripe, 0,
	).First(&binding).Error; err != nil {
		return err
	}
	if strings.TrimSpace(binding.ProviderSubscriptionId) == "" || isTerminalStripeSubscriptionStatus(binding.ProviderStatus) {
		return errors.New("cancel downgrade compensation binding is not active Stripe recurring")
	}
	snapshot, err := stripeSubscriptionSnapshotGetter(binding.ProviderSubscriptionId)
	if err != nil {
		return err
	}
	if strings.TrimSpace(snapshot.ProviderSubscriptionId) != binding.ProviderSubscriptionId {
		return errors.New("cancel downgrade compensation Stripe subscription mismatch")
	}
	if snapshot.CancelAtPeriodEnd {
		if _, err := model.ApplyProviderSubscriptionSnapshot(binding.Id, snapshot); err != nil {
			return err
		}
		return clearPendingDowngradeAfterCancel(&binding, intent)
	}
	if _, err := model.ApplyProviderSubscriptionSnapshot(binding.Id, snapshot); err != nil {
		return err
	}
	return restorePendingDowngradeAfterCancelFailure(&binding, intent, snapshot, errors.New("authoritative Stripe subscription is not canceled at period end"))
}

func reconcileCancelDowngradeCompensations(ctx context.Context) (int, error) {
	return ReconcileCancelDowngradeCompensationRequired(ctx, stripeSubscriptionReconciliationBatchSize)
}

func ensureStripeLifecycleKey() error {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return errors.New("invalid Stripe API key")
	}
	stripe.Key = setting.StripeApiSecret
	return nil
}

func providerSubscriptionSnapshotFromStripe(sub *stripe.Subscription) model.ProviderSubscriptionSnapshot {
	if sub == nil {
		return model.ProviderSubscriptionSnapshot{}
	}
	customerID := ""
	if sub.Customer != nil {
		customerID = strings.TrimSpace(sub.Customer.ID)
	}
	priceID := ""
	if sub.Items != nil && len(sub.Items.Data) > 0 && sub.Items.Data[0] != nil && sub.Items.Data[0].Price != nil {
		priceID = strings.TrimSpace(sub.Items.Data[0].Price.ID)
	}
	itemID := ""
	if sub.Items != nil && len(sub.Items.Data) > 0 && sub.Items.Data[0] != nil {
		itemID = strings.TrimSpace(sub.Items.Data[0].ID)
	}
	scheduleID := ""
	if sub.Schedule != nil {
		scheduleID = strings.TrimSpace(sub.Schedule.ID)
	}
	latestInvoiceID := ""
	if sub.LatestInvoice != nil {
		latestInvoiceID = strings.TrimSpace(sub.LatestInvoice.ID)
	}
	periodStart, periodEnd := stripeSubscriptionCurrentPeriod(sub)
	return model.ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:     strings.TrimSpace(sub.ID),
		ProviderSubscriptionItemId: itemID,
		ProviderScheduleId:         scheduleID,
		ProviderScheduleIdObserved: true,
		ProviderCustomerId:         customerID,
		ProviderPriceId:            priceID,
		ProviderLatestInvoiceId:    latestInvoiceID,
		ProviderStatus:             string(sub.Status),
		CancelAtPeriodEnd:          sub.CancelAtPeriodEnd,
		CurrentPeriodStart:         periodStart,
		CurrentPeriodEnd:           periodEnd,
		CanceledAt:                 sub.CanceledAt,
		EndedAt:                    sub.EndedAt,
		Livemode:                   sub.Livemode,
	}
}
