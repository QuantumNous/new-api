package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stripe/stripe-go/v86"
	stripesubscription "github.com/stripe/stripe-go/v86/subscription"
	"gorm.io/gorm"
)

var stripeCancelSubscriptionImmediately = cancelStripeSubscriptionImmediately
var refundSubscriptionCompensationWalletDebit = refundSubscriptionCompensationWalletDebitDefault

func cancelStripeSubscriptionImmediately(providerSubscriptionID, idempotencyKey string) error {
	if err := ensureStripeLifecycleKey(); err != nil {
		return err
	}
	params := &stripe.SubscriptionCancelParams{
		InvoiceNow: stripe.Bool(false),
		Prorate:    stripe.Bool(false),
	}
	params.SetIdempotencyKey(strings.TrimSpace(idempotencyKey))
	_, err := stripesubscription.Cancel(strings.TrimSpace(providerSubscriptionID), params)
	return err
}

func prepareStripeToBalanceCompensationTx(tx *gorm.DB, user *model.User, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent, target *model.SubscriptionPlan) error {
	if tx == nil || user == nil || contract == nil || intent == nil || target == nil {
		return errors.New("invalid Stripe-to-balance compensation args")
	}
	if contract.UserId != user.Id || intent.UserId != user.Id || intent.ContractId != contract.Id ||
		contract.Status != model.SubscriptionContractStatusActive ||
		contract.PaymentMode != model.SubscriptionPaymentModeStripeRecurring ||
		contract.CurrentProviderBindingId <= 0 {
		return errors.New("current active Stripe recurring contract ownership mismatch")
	}
	var binding model.SubscriptionProviderBinding
	if err := subscriptionCommandLock(tx).Where(
		"id = ? AND contract_id = ? AND user_id = ? AND provider = ? AND ended_at = ?",
		contract.CurrentProviderBindingId, contract.Id, user.Id, model.PaymentProviderStripe, 0,
	).First(&binding).Error; err != nil {
		return err
	}
	if strings.TrimSpace(binding.ProviderSubscriptionId) == "" || isTerminalStripeSubscriptionStatus(binding.ProviderStatus) {
		return errors.New("current subscription is not active Stripe recurring")
	}
	var entitlement model.UserSubscription
	if err := subscriptionCommandLock(tx).Where(
		"id = ? AND contract_id = ? AND user_id = ? AND provider_binding_id = ? AND current_slot = ? AND status = ?",
		contract.CurrentEntitlementId, contract.Id, user.Id, binding.Id, 1, model.SubscriptionEntitlementStatusActive,
	).First(&entitlement).Error; err != nil {
		return errors.New("current Stripe entitlement ownership mismatch")
	}
	requiredQuota, err := subscriptionBalanceQuota(target.PriceAmount)
	if err != nil {
		return err
	}
	if requiredQuota > 0 && user.Quota < requiredQuota {
		return errors.New("insufficient balance")
	}
	tradeNo := fmt.Sprintf("SUBCOMPUSR%dINT%d", user.Id, intent.Id)
	if requiredQuota > 0 {
		debit := tx.Model(&model.User{}).Where("id = ? AND quota >= ?", user.Id, requiredQuota).
			Update("quota", gorm.Expr("quota - ?", requiredQuota))
		if debit.Error != nil {
			return debit.Error
		}
		if debit.RowsAffected != 1 {
			return errors.New("subscription balance debit conditional update failed")
		}
	}
	now := common.GetTimestamp()
	order := &model.SubscriptionOrder{
		UserId:          user.Id,
		PlanId:          target.Id,
		Money:           target.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodBalance,
		PaymentProvider: model.PaymentProviderBalance,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      now,
		CompleteTime:    now,
		ProviderPayload: fmt.Sprintf("charged_quota=%d;change_intent_id=%d;purpose=stripe_to_balance", requiredQuota, intent.Id),
		ChangeIntentId:  intent.Id,
	}
	if err := tx.Create(order).Error; err != nil {
		return err
	}

	previousScheduleSnapshot := ""
	if strings.TrimSpace(binding.ProviderScheduleId) != "" {
		previousScheduleSnapshot, err = stripeToBalanceFallbackScheduleSnapshot(binding)
		if err != nil {
			return err
		}
	}
	intent.Status = model.SubscriptionChangeIntentStatusSyncing
	intent.ProviderBindingId = binding.Id
	intent.ProviderScheduleId = strings.TrimSpace(binding.ProviderScheduleId)
	intent.ProviderIdempotencyKey = fmt.Sprintf("stripe-to-balance:contract:%d:intent:%d", contract.Id, intent.Id)
	intent.PreviousScheduleSnapshot = previousScheduleSnapshot
	intent.WalletDebitTradeNo = tradeNo
	intent.EffectiveAt = now
	return tx.Model(intent).Updates(map[string]interface{}{
		"status":                     intent.Status,
		"provider_binding_id":        intent.ProviderBindingId,
		"provider_schedule_id":       intent.ProviderScheduleId,
		"provider_idempotency_key":   intent.ProviderIdempotencyKey,
		"previous_schedule_snapshot": intent.PreviousScheduleSnapshot,
		"wallet_debit_trade_no":      intent.WalletDebitTradeNo,
		"effective_at":               intent.EffectiveAt,
		"updated_at":                 now,
	}).Error
}

func stripeToBalanceFallbackScheduleSnapshot(binding model.SubscriptionProviderBinding) (string, error) {
	if strings.TrimSpace(binding.ProviderSubscriptionId) == "" || strings.TrimSpace(binding.ProviderPriceId) == "" ||
		binding.CurrentPeriodStart <= 0 || binding.CurrentPeriodEnd <= binding.CurrentPeriodStart {
		return "", errors.New("Stripe schedule fallback snapshot is incomplete")
	}
	snapshot := stripeSubscriptionUpgradeScheduleSnapshot{
		SubscriptionID: strings.TrimSpace(binding.ProviderSubscriptionId),
		EndBehavior:    "release",
		Phases: []stripeSubscriptionUpgradeSchedulePhaseSnapshot{{
			StartDate:         binding.CurrentPeriodStart,
			EndDate:           binding.CurrentPeriodEnd,
			ProrationBehavior: "none",
			Items: []stripeSubscriptionUpgradeScheduleItemSnapshot{{
				PriceID:  strings.TrimSpace(binding.ProviderPriceId),
				Quantity: 1,
			}},
		}},
	}
	raw, err := common.Marshal(snapshot)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func executeStripeToBalanceCompensation(ctx context.Context, intentID int64) error {
	intent, contract, binding, err := loadStripeToBalanceCompensation(intentID)
	if err != nil {
		return err
	}
	if intent.Status == model.SubscriptionChangeIntentStatusApplied {
		return nil
	}

	if intent.Status == model.SubscriptionChangeIntentStatusSyncing {
		if scheduleID := strings.TrimSpace(intent.ProviderScheduleId); scheduleID != "" && strings.TrimSpace(binding.ProviderScheduleId) == scheduleID {
			if err := stripeReleaseSubscriptionSchedule(scheduleID, intent.ProviderIdempotencyKey+":release-schedule"); err != nil {
				return markStripeToBalanceCompensationUncertain(intent, contract, err)
			}
			if err := model.DB.Model(&model.SubscriptionProviderBinding{}).
				Where("id = ? AND contract_id = ? AND user_id = ? AND provider_schedule_id = ?", binding.Id, contract.Id, contract.UserId, scheduleID).
				Updates(map[string]interface{}{"provider_schedule_id": "", "updated_at": common.GetTimestamp()}).Error; err != nil {
				return markStripeToBalanceCompensationUncertain(intent, contract, err)
			}
			binding.ProviderScheduleId = ""
		}
		cancelErr := stripeCancelSubscriptionImmediately(binding.ProviderSubscriptionId, intent.ProviderIdempotencyKey+":cancel")
		snapshot, getErr := stripeSubscriptionSnapshotGetter(binding.ProviderSubscriptionId)
		if getErr != nil {
			if cancelErr != nil {
				getErr = fmt.Errorf("Stripe cancel failed: %v; authoritative fetch failed: %w", cancelErr, getErr)
			}
			return markStripeToBalanceCompensationUncertain(intent, contract, getErr)
		}
		return resolveStripeToBalanceSnapshot(ctx, intent, contract, binding, snapshot)
	}

	snapshot, err := stripeSubscriptionSnapshotGetter(binding.ProviderSubscriptionId)
	if err != nil {
		return markStripeToBalanceCompensationUncertain(intent, contract, err)
	}
	return resolveStripeToBalanceSnapshot(ctx, intent, contract, binding, snapshot)
}

func loadStripeToBalanceCompensation(intentID int64) (model.SubscriptionChangeIntent, model.UserSubscriptionContract, model.SubscriptionProviderBinding, error) {
	var intent model.SubscriptionChangeIntent
	if err := model.DB.Where("id = ?", intentID).First(&intent).Error; err != nil {
		return intent, model.UserSubscriptionContract{}, model.SubscriptionProviderBinding{}, err
	}
	if intent.Kind != model.SubscriptionChangeIntentKindUpgrade || intent.PaymentMode != model.SubscriptionPaymentModeBalanceOnePeriod ||
		(intent.Status != model.SubscriptionChangeIntentStatusSyncing && intent.Status != model.SubscriptionChangeIntentStatusCompensationRequired && intent.Status != model.SubscriptionChangeIntentStatusApplied) ||
		intent.ProviderBindingId <= 0 || strings.TrimSpace(intent.WalletDebitTradeNo) == "" || strings.TrimSpace(intent.ProviderIdempotencyKey) == "" {
		return intent, model.UserSubscriptionContract{}, model.SubscriptionProviderBinding{}, errors.New("invalid Stripe-to-balance compensation intent")
	}
	var contract model.UserSubscriptionContract
	if err := model.DB.Where("id = ? AND user_id = ?", intent.ContractId, intent.UserId).First(&contract).Error; err != nil {
		return intent, contract, model.SubscriptionProviderBinding{}, err
	}
	var binding model.SubscriptionProviderBinding
	if err := model.DB.Where("id = ? AND contract_id = ? AND user_id = ? AND provider = ?",
		intent.ProviderBindingId, contract.Id, contract.UserId, model.PaymentProviderStripe).First(&binding).Error; err != nil {
		return intent, contract, binding, err
	}
	if strings.TrimSpace(binding.ProviderSubscriptionId) == "" ||
		(intent.Status != model.SubscriptionChangeIntentStatusApplied && contract.CurrentProviderBindingId != binding.Id) ||
		(intent.Status != model.SubscriptionChangeIntentStatusApplied && contract.PaymentMode != model.SubscriptionPaymentModeStripeRecurring) {
		return intent, contract, binding, errors.New("Stripe-to-balance compensation ownership mismatch")
	}
	return intent, contract, binding, nil
}

func resolveStripeToBalanceSnapshot(ctx context.Context, intent model.SubscriptionChangeIntent, contract model.UserSubscriptionContract, binding model.SubscriptionProviderBinding, snapshot model.ProviderSubscriptionSnapshot) error {
	if strings.TrimSpace(snapshot.ProviderSubscriptionId) != strings.TrimSpace(binding.ProviderSubscriptionId) {
		return markStripeToBalanceCompensationUncertain(intent, contract, errors.New("authoritative Stripe subscription ownership mismatch"))
	}
	if snapshot.EndedAt > 0 || isTerminalStripeSubscriptionStatus(snapshot.ProviderStatus) {
		if _, err := model.ApplyProviderSubscriptionTermination(binding.Id, snapshot); err != nil {
			return err
		}
		return grantStripeToBalanceEntitlement(intent.Id)
	}

	if strings.TrimSpace(intent.PreviousScheduleSnapshot) != "" && (!snapshot.ProviderScheduleIdObserved || strings.TrimSpace(snapshot.ProviderScheduleId) == "") {
		scheduleID, err := stripeRestoreSubscriptionSchedule(intent.PreviousScheduleSnapshot, intent.ProviderIdempotencyKey+":restore-schedule")
		if err != nil {
			return markStripeToBalanceCompensationUncertain(intent, contract, err)
		}
		snapshot.ProviderScheduleId = strings.TrimSpace(scheduleID)
		snapshot.ProviderScheduleIdObserved = true
	}
	if _, err := model.ApplyProviderSubscriptionSnapshot(binding.Id, snapshot); err != nil {
		return err
	}
	if err := refundSubscriptionCompensationWalletDebit(ctx, intent.Id); err != nil {
		return markStripeToBalanceCompensationUncertain(intent, contract, err)
	}
	return nil
}

func grantStripeToBalanceEntitlement(intentID int64) error {
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var intent model.SubscriptionChangeIntent
		if err := subscriptionCommandLock(tx).Where("id = ?", intentID).First(&intent).Error; err != nil {
			return err
		}
		if intent.Status == model.SubscriptionChangeIntentStatusApplied {
			return nil
		}
		if intent.Status != model.SubscriptionChangeIntentStatusSyncing && intent.Status != model.SubscriptionChangeIntentStatusCompensationRequired {
			return errors.New("Stripe-to-balance compensation intent status mismatch")
		}
		var contract model.UserSubscriptionContract
		if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ? AND current_provider_binding_id = ?",
			intent.ContractId, intent.UserId, intent.ProviderBindingId).First(&contract).Error; err != nil {
			return err
		}
		var target model.SubscriptionPlan
		if err := tx.Where("id = ?", intent.ToPlanId).First(&target).Error; err != nil {
			return err
		}
		periodStart := intent.EffectiveAt
		if periodStart <= 0 {
			periodStart = common.GetTimestamp()
		}
		periodEnd, err := subscriptionPlanPeriodEnd(periodStart, &target)
		if err != nil {
			return err
		}
		if _, err := model.RotateCurrentEntitlementTx(tx, model.GrantEntitlementInput{
			ContractId:           contract.Id,
			UserId:               intent.UserId,
			PlanId:               target.Id,
			ProviderBindingId:    0,
			GrantKey:             "balance:" + strings.TrimSpace(intent.WalletDebitTradeNo),
			PaymentMode:          model.SubscriptionPaymentModeBalanceOnePeriod,
			AmountTotal:          target.TotalAmount,
			PeriodStart:          periodStart,
			PeriodEnd:            periodEnd,
			EndReasonForPrevious: model.SubscriptionEntitlementEndReasonUpgraded,
			Source:               model.PaymentMethodBalance,
		}); err != nil {
			return err
		}
		return tx.Model(&model.SubscriptionChangeIntent{}).Where("id = ?", intent.Id).Updates(map[string]interface{}{
			"status":       model.SubscriptionChangeIntentStatusApplied,
			"effective_at": periodStart,
			"last_error":   "",
			"updated_at":   common.GetTimestamp(),
		}).Error
	})
}

func refundSubscriptionCompensationWalletDebitDefault(ctx context.Context, intentID int64) error {
	_ = ctx
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var intent model.SubscriptionChangeIntent
		if err := subscriptionCommandLock(tx).Where("id = ?", intentID).First(&intent).Error; err != nil {
			return err
		}
		if intent.Status == model.SubscriptionChangeIntentStatusApplied {
			return nil
		}
		var order model.SubscriptionOrder
		if err := subscriptionCommandLock(tx).Where(
			"trade_no = ? AND change_intent_id = ? AND user_id = ? AND plan_id = ? AND payment_provider = ?",
			intent.WalletDebitTradeNo, intent.Id, intent.UserId, intent.ToPlanId, model.PaymentProviderBalance,
		).First(&order).Error; err != nil {
			return err
		}
		chargedQuota, err := stripeToBalanceChargedQuota(order.ProviderPayload)
		if err != nil {
			return err
		}
		if order.Status == common.TopUpStatusSuccess {
			transition := tx.Model(&model.SubscriptionOrder{}).Where(
				"id = ? AND trade_no = ? AND change_intent_id = ? AND user_id = ? AND plan_id = ? AND payment_provider = ? AND status = ?",
				order.Id, intent.WalletDebitTradeNo, intent.Id, intent.UserId, intent.ToPlanId, model.PaymentProviderBalance, common.TopUpStatusSuccess,
			).
				Updates(map[string]interface{}{
					"status":           common.TopUpStatusFailed,
					"provider_payload": order.ProviderPayload + fmt.Sprintf(";refunded_quota=%d", chargedQuota),
				})
			if transition.Error != nil {
				return transition.Error
			}
			if transition.RowsAffected != 1 {
				return errors.New("Stripe-to-balance refund order transition failed")
			}
			if chargedQuota > 0 {
				credit := tx.Model(&model.User{}).Where("id = ?", intent.UserId).
					Update("quota", gorm.Expr("quota + ?", chargedQuota))
				if credit.Error != nil {
					return credit.Error
				}
				if credit.RowsAffected != 1 {
					return errors.New("Stripe-to-balance refund quota credit failed")
				}
			}
		} else if order.Status != common.TopUpStatusFailed || !strings.Contains(order.ProviderPayload, "refunded_quota=") {
			return errors.New("Stripe-to-balance wallet debit state mismatch")
		}
		if err := tx.Model(&model.SubscriptionChangeIntent{}).Where("id = ?", intent.Id).Updates(map[string]interface{}{
			"status":     model.SubscriptionChangeIntentStatusApplied,
			"last_error": "",
			"updated_at": common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		return tx.Model(&model.UserSubscriptionContract{}).Where("id = ? AND user_id = ?", intent.ContractId, intent.UserId).Updates(map[string]interface{}{
			"status":     model.SubscriptionContractStatusActive,
			"updated_at": common.GetTimestamp(),
		}).Error
	})
}

func stripeToBalanceChargedQuota(payload string) (int, error) {
	for _, part := range strings.Split(payload, ";") {
		key, value, ok := strings.Cut(part, "=")
		if !ok || strings.TrimSpace(key) != "charged_quota" {
			continue
		}
		quota, err := strconv.Atoi(strings.TrimSpace(value))
		if err != nil || quota < 0 {
			return 0, errors.New("invalid Stripe-to-balance charged quota")
		}
		return quota, nil
	}
	return 0, errors.New("Stripe-to-balance charged quota is missing")
}

func markStripeToBalanceCompensationUncertain(intent model.SubscriptionChangeIntent, contract model.UserSubscriptionContract, cause error) error {
	if cause == nil {
		cause = errors.New("Stripe-to-balance compensation state is uncertain")
	}
	markErr := model.DB.Transaction(func(tx *gorm.DB) error {
		now := common.GetTimestamp()
		if err := tx.Model(&model.SubscriptionChangeIntent{}).
			Where("id = ? AND contract_id = ? AND user_id = ? AND status IN ?", intent.Id, contract.Id, contract.UserId,
				[]string{model.SubscriptionChangeIntentStatusSyncing, model.SubscriptionChangeIntentStatusCompensationRequired}).
			Updates(map[string]interface{}{
				"status":     model.SubscriptionChangeIntentStatusCompensationRequired,
				"last_error": cause.Error(),
				"updated_at": now,
			}).Error; err != nil {
			return err
		}
		return tx.Model(&model.UserSubscriptionContract{}).Where("id = ? AND user_id = ?", contract.Id, contract.UserId).Updates(map[string]interface{}{
			"status":     model.SubscriptionContractStatusNeedsAttention,
			"updated_at": now,
		}).Error
	})
	if markErr != nil {
		return fmt.Errorf("%v; failed to persist compensation state: %w", cause, markErr)
	}
	return cause
}

func ReconcileSubscriptionCompensationRequired(ctx context.Context, limit int) (int, error) {
	if limit <= 0 {
		limit = stripeSubscriptionReconciliationBatchSize
	}
	var intents []model.SubscriptionChangeIntent
	if err := model.DB.Where("kind = ? AND payment_mode = ? AND status IN ? AND provider_binding_id > ? AND wallet_debit_trade_no <> ?",
		model.SubscriptionChangeIntentKindUpgrade,
		model.SubscriptionPaymentModeBalanceOnePeriod,
		[]string{model.SubscriptionChangeIntentStatusSyncing, model.SubscriptionChangeIntentStatusCompensationRequired},
		0,
		"",
	).Order("id asc").Limit(limit).Find(&intents).Error; err != nil {
		return 0, err
	}
	processed := 0
	for _, intent := range intents {
		if err := executeStripeToBalanceCompensation(ctx, intent.Id); err != nil {
			return processed, err
		}
		processed++
	}
	return processed, nil
}

func reconcileStripeToBalanceCompensations(ctx context.Context) (int, error) {
	return ReconcileSubscriptionCompensationRequired(ctx, stripeSubscriptionReconciliationBatchSize)
}
