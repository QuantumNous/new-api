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

type StripeSubscriptionUpgradeInput struct {
	UserID                     int
	ContractID                 int64
	ChangeIntentID             int64
	ChangeVersion              int64
	TargetPlanID               int
	TargetPriceID              string
	ProviderSubscriptionID     string
	ProviderSubscriptionItemID string
	ProviderScheduleID         string
	CancelAtPeriodEnd          bool
	IdempotencyKey             string
}

type StripeSubscriptionUpgradeResult struct {
	Status                    string
	ProviderInvoiceID         string
	HostedInvoiceURL          string
	PreviousScheduleSnapshot  string
	PreserveCancelAtPeriodEnd bool
	Snapshot                  model.ProviderSubscriptionSnapshot
}

type stripeSubscriptionUpgradeScheduleSnapshot struct {
	SubscriptionID string                                           `json:"subscription_id"`
	EndBehavior    string                                           `json:"end_behavior"`
	Metadata       map[string]string                                `json:"metadata,omitempty"`
	Phases         []stripeSubscriptionUpgradeSchedulePhaseSnapshot `json:"phases"`
}

type stripeSubscriptionUpgradeSchedulePhaseSnapshot struct {
	StartDate         int64                                           `json:"start_date"`
	EndDate           int64                                           `json:"end_date"`
	CollectionMethod  string                                          `json:"collection_method,omitempty"`
	ProrationBehavior string                                          `json:"proration_behavior,omitempty"`
	Metadata          map[string]string                               `json:"metadata,omitempty"`
	Items             []stripeSubscriptionUpgradeScheduleItemSnapshot `json:"items"`
}

type stripeSubscriptionUpgradeScheduleItemSnapshot struct {
	PriceID  string `json:"price_id"`
	Quantity int64  `json:"quantity"`
}

var stripeSubscriptionUpgradeExecutor = executeStripeSubscriptionUpgrade

func stripeSubscriptionUpgradeIdempotencyKey(contractID int64, changeVersion int64, targetPlanID int) string {
	return fmt.Sprintf("subscription-upgrade:%d:%d:%d", contractID, changeVersion, targetPlanID)
}

func stripeSubscriptionUpgradeIntentIdempotencyKey(contractID int64, changeVersion int64, targetPlanID int, intentID int64) string {
	return fmt.Sprintf("subscription-upgrade:contract:%d:version:%d:target-plan:%d:intent:%d", contractID, changeVersion, targetPlanID, intentID)
}

func executeStripeSubscriptionUpgrade(ctx context.Context, input StripeSubscriptionUpgradeInput) (*StripeSubscriptionUpgradeResult, error) {
	_ = ctx
	input.normalize()
	if err := input.validate(); err != nil {
		return nil, err
	}
	if err := resolveStripeSubscriptionUpgradeOwnership(&input); err != nil {
		return nil, err
	}
	var targetPlan model.SubscriptionPlan
	if err := model.DB.Where("id = ?", input.TargetPlanID).First(&targetPlan).Error; err != nil {
		return nil, err
	}
	targetPlan.NormalizeDefaults()
	if _, err := ensureStripeSubscriptionUpgradeSnapshotOrder(input, &targetPlan); err != nil {
		return nil, err
	}
	if err := ensureStripeSecretForSubscription(); err != nil {
		return nil, err
	}
	stripe.Key = setting.StripeApiSecret

	current, err := getStripeSubscriptionForUpgrade(input.ProviderSubscriptionID)
	if err != nil {
		return nil, err
	}
	if err := validateStripeSubscriptionForUpgrade(current, input); err != nil {
		return nil, err
	}
	if stripeSubscriptionUpgradeTargetAppliedWithInvoice(current, input) {
		return stripeSubscriptionUpgradeResultFromSubscription(current, "", input.CancelAtPeriodEnd), nil
	}

	previousScheduleSnapshot := ""
	if scheduleID := firstNonEmptyString(input.ProviderScheduleID, stripeSubscriptionScheduleID(current)); scheduleID != "" {
		schedule, err := getStripeSubscriptionScheduleForUpgrade(scheduleID)
		if err != nil {
			return nil, err
		}
		previousScheduleSnapshot, err = captureStripeSubscriptionUpgradeSchedule(schedule, input.ProviderSubscriptionID)
		if err != nil {
			return nil, err
		}
		if err := persistStripeSubscriptionUpgradeScheduleBeforeRelease(input.ChangeIntentID, previousScheduleSnapshot); err != nil {
			return nil, err
		}
		params := &stripe.SubscriptionScheduleReleaseParams{
			PreserveCancelDate: stripe.Bool(true),
		}
		params.SetIdempotencyKey(input.IdempotencyKey + ":release-schedule")
		if _, err := stripeschedule.Release(scheduleID, params); err != nil {
			return nil, err
		}
		current, err = getStripeSubscriptionForUpgrade(input.ProviderSubscriptionID)
		if err != nil {
			return nil, err
		}
		if err := validateStripeSubscriptionForUpgrade(current, input); err != nil {
			return nil, err
		}
	}

	params := &stripe.SubscriptionParams{
		BillingCycleAnchorNow: stripe.Bool(true),
		PaymentBehavior:       stripe.String("pending_if_incomplete"),
		ProrationBehavior:     stripe.String("none"),
		Items: []*stripe.SubscriptionItemsParams{
			{
				ID:       stripe.String(input.ProviderSubscriptionItemID),
				Price:    stripe.String(input.TargetPriceID),
				Quantity: stripe.Int64(1),
			},
		},
		Metadata: map[string]string{
			"user_id":          fmt.Sprintf("%d", input.UserID),
			"plan_id":          fmt.Sprintf("%d", input.TargetPlanID),
			"contract_id":      fmt.Sprintf("%d", input.ContractID),
			"change_intent_id": fmt.Sprintf("%d", input.ChangeIntentID),
			"change_version":   fmt.Sprintf("%d", input.ChangeVersion),
		},
	}
	params.SetIdempotencyKey(input.IdempotencyKey)
	params.AddExpand("latest_invoice")
	params.AddExpand("pending_update")
	params.AddExpand("items.data.price")
	params.AddExpand("customer")
	updated, err := stripesubscription.Update(input.ProviderSubscriptionID, params)
	if err != nil {
		if previousScheduleSnapshot != "" {
			restoredScheduleID, restoreErr := restoreStripeSubscriptionUpgradeSchedule(previousScheduleSnapshot, input.IdempotencyKey)
			if restoreErr != nil {
				_ = markStripeSubscriptionUpgradeRecoveryUncertain(input.ChangeIntentID, err, restoreErr)
				return nil, fmt.Errorf("Stripe subscription upgrade failed and schedule restoration is uncertain: %w", err)
			}
			if persistErr := persistStripeSubscriptionUpgradeScheduleRestored(input.ChangeIntentID, restoredScheduleID, err); persistErr != nil {
				_ = markStripeSubscriptionUpgradeRecoveryUncertain(input.ChangeIntentID, err, persistErr)
				return nil, fmt.Errorf("Stripe subscription upgrade failed after schedule restoration: %w", persistErr)
			}
		}
		return nil, err
	}
	return stripeSubscriptionUpgradeResultFromSubscription(updated, previousScheduleSnapshot, input.CancelAtPeriodEnd), nil
}

func ensureStripeSubscriptionUpgradeSnapshotOrder(input StripeSubscriptionUpgradeInput, plan *model.SubscriptionPlan) (*model.SubscriptionOrder, error) {
	if input.ChangeIntentID <= 0 || input.UserID <= 0 || input.TargetPlanID <= 0 || plan == nil {
		return nil, errors.New("Stripe subscription upgrade snapshot facts are incomplete")
	}
	var order model.SubscriptionOrder
	query := model.DB.Where(
		"change_intent_id = ? AND payment_provider = ? AND purchase_intent = ?",
		input.ChangeIntentID,
		model.PaymentProviderStripe,
		model.SubscriptionChangeIntentKindUpgrade,
	).Order("id desc").Limit(1).Find(&order)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected > 0 {
		return &order, nil
	}
	order, err := buildStripeSubscriptionUpgradeSnapshotOrder(input, plan)
	if err != nil {
		return nil, err
	}
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		return model.CreateSubscriptionOrderWithPendingPurchaseLifecycleTx(tx, &order, stripeSubscriptionUpgradeSnapshotLifecycleSourceRef(input.ChangeIntentID))
	})
	if err != nil {
		var existing model.SubscriptionOrder
		if findErr := model.DB.Where("trade_no = ?", order.TradeNo).First(&existing).Error; findErr == nil {
			return &existing, nil
		}
		return nil, err
	}
	return &order, nil
}

func buildStripeSubscriptionUpgradeSnapshotOrder(input StripeSubscriptionUpgradeInput, plan *model.SubscriptionPlan) (model.SubscriptionOrder, error) {
	snapshot, err := subscriptionPurchasePlanSnapshot(plan)
	if err != nil {
		return model.SubscriptionOrder{}, err
	}
	minorAmount, err := stripeMinorUnitAmountForSubscription(plan.PriceAmount, plan.Currency)
	if err != nil {
		return model.SubscriptionOrder{}, err
	}
	return model.SubscriptionOrder{
		UserId:             input.UserID,
		PlanId:             input.TargetPlanID,
		Money:              plan.PriceAmount,
		TradeNo:            fmt.Sprintf("SUBUPGINT%d", input.ChangeIntentID),
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		Status:             common.TopUpStatusPending,
		CreateTime:         common.GetTimestamp(),
		PurchaseMonths:     1,
		UnitPrice:          plan.PriceAmount,
		PaymentCurrency:    strings.ToUpper(strings.TrimSpace(plan.Currency)),
		PaymentAmountMinor: minorAmount,
		PlanSnapshot:       snapshot,
		PurchaseIntent:     model.SubscriptionChangeIntentKindUpgrade,
		RenewalSource:      model.SubscriptionRenewalSourceProvider,
		ProviderPayload:    fmt.Sprintf("contract_id=%d;change_intent_id=%d", input.ContractID, input.ChangeIntentID),
		ChangeIntentId:     input.ChangeIntentID,
	}, nil
}

func stripeSubscriptionUpgradeSnapshotLifecycleSourceRef(changeIntentID int64) string {
	return fmt.Sprintf("stripe.subscription_upgrade.%d", changeIntentID)
}

func stripeSubscriptionUpgradeTargetAppliedWithInvoice(sub *stripe.Subscription, input StripeSubscriptionUpgradeInput) bool {
	return strings.TrimSpace(stripeSubscriptionFirstPriceID(sub)) == input.TargetPriceID &&
		sub != nil &&
		sub.LatestInvoice != nil &&
		strings.TrimSpace(sub.LatestInvoice.ID) != ""
}

func stripeSubscriptionUpgradeResultFromSubscription(sub *stripe.Subscription, previousScheduleSnapshot string, preserveCancelAtPeriodEnd bool) *StripeSubscriptionUpgradeResult {
	result := &StripeSubscriptionUpgradeResult{
		Status:                    model.SubscriptionChangeIntentStatusSyncing,
		PreviousScheduleSnapshot:  previousScheduleSnapshot,
		PreserveCancelAtPeriodEnd: preserveCancelAtPeriodEnd,
		Snapshot:                  providerSubscriptionSnapshotFromStripe(sub),
	}
	if sub != nil && sub.LatestInvoice != nil {
		result.ProviderInvoiceID = strings.TrimSpace(sub.LatestInvoice.ID)
		result.HostedInvoiceURL = strings.TrimSpace(sub.LatestInvoice.HostedInvoiceURL)
		if stripeInvoiceIsPaid(sub.LatestInvoice) {
			result.Status = model.SubscriptionChangeIntentStatusSyncing
		} else {
			result.Status = model.SubscriptionChangeIntentStatusAwaitingPayment
		}
	}
	if sub != nil && sub.PendingUpdate != nil {
		result.Status = model.SubscriptionChangeIntentStatusAwaitingPayment
	}
	return result
}

func getStripeSubscriptionScheduleForUpgrade(scheduleID string) (*stripe.SubscriptionSchedule, error) {
	params := &stripe.SubscriptionScheduleParams{}
	params.AddExpand("subscription")
	params.AddExpand("phases.items.price")
	schedule, err := stripeschedule.Get(strings.TrimSpace(scheduleID), params)
	if err != nil {
		return nil, err
	}
	if schedule == nil || strings.TrimSpace(schedule.ID) == "" {
		return nil, errors.New("Stripe subscription schedule is missing")
	}
	return schedule, nil
}

func captureStripeSubscriptionUpgradeSchedule(schedule *stripe.SubscriptionSchedule, subscriptionID string) (string, error) {
	if schedule == nil || schedule.Subscription == nil || strings.TrimSpace(schedule.Subscription.ID) != strings.TrimSpace(subscriptionID) {
		return "", errors.New("Stripe subscription schedule ownership mismatch")
	}
	snapshot := stripeSubscriptionUpgradeScheduleSnapshot{
		SubscriptionID: strings.TrimSpace(subscriptionID),
		EndBehavior:    string(schedule.EndBehavior),
		Metadata:       schedule.Metadata,
	}
	currentStart := int64(0)
	if schedule.CurrentPhase != nil {
		currentStart = schedule.CurrentPhase.StartDate
	}
	for _, phase := range schedule.Phases {
		if phase == nil || (currentStart > 0 && phase.EndDate > 0 && phase.EndDate <= currentStart) {
			continue
		}
		captured := stripeSubscriptionUpgradeSchedulePhaseSnapshot{
			StartDate:         phase.StartDate,
			EndDate:           phase.EndDate,
			ProrationBehavior: string(phase.ProrationBehavior),
			Metadata:          phase.Metadata,
		}
		if phase.CollectionMethod != nil {
			captured.CollectionMethod = string(*phase.CollectionMethod)
		}
		for _, item := range phase.Items {
			if item == nil || item.Price == nil || strings.TrimSpace(item.Price.ID) == "" {
				return "", errors.New("Stripe subscription schedule phase price is missing")
			}
			quantity := item.Quantity
			if quantity <= 0 {
				quantity = 1
			}
			captured.Items = append(captured.Items, stripeSubscriptionUpgradeScheduleItemSnapshot{
				PriceID:  strings.TrimSpace(item.Price.ID),
				Quantity: quantity,
			})
		}
		if len(captured.Items) == 0 {
			return "", errors.New("Stripe subscription schedule phase items are missing")
		}
		snapshot.Phases = append(snapshot.Phases, captured)
	}
	if len(snapshot.Phases) == 0 {
		return "", errors.New("Stripe subscription schedule phases are missing")
	}
	raw, err := common.Marshal(snapshot)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

func persistStripeSubscriptionUpgradeScheduleBeforeRelease(intentID int64, snapshot string) error {
	if intentID <= 0 || strings.TrimSpace(snapshot) == "" {
		return errors.New("Stripe subscription upgrade schedule snapshot is required")
	}
	return model.DB.Model(&model.SubscriptionChangeIntent{}).Where("id = ?", intentID).Updates(map[string]interface{}{
		"previous_schedule_snapshot": strings.TrimSpace(snapshot),
		"updated_at":                 common.GetTimestamp(),
	}).Error
}

func restoreStripeSubscriptionUpgradeSchedule(rawSnapshot string, idempotencyKey string) (string, error) {
	var snapshot stripeSubscriptionUpgradeScheduleSnapshot
	if err := common.Unmarshal([]byte(rawSnapshot), &snapshot); err != nil {
		return "", err
	}
	if strings.TrimSpace(snapshot.SubscriptionID) == "" || len(snapshot.Phases) == 0 {
		return "", errors.New("Stripe subscription upgrade schedule snapshot is incomplete")
	}
	createParams := &stripe.SubscriptionScheduleParams{FromSubscription: stripe.String(snapshot.SubscriptionID)}
	ctx, cancel := context.WithTimeout(context.Background(), stripeSubscriptionLifecycleRequestTimeout)
	defer cancel()
	createParams.Context = ctx
	createParams.SetIdempotencyKey(idempotencyKey + ":restore-schedule:create")
	created, err := stripeschedule.New(createParams)
	if err != nil {
		return "", err
	}
	if created == nil || strings.TrimSpace(created.ID) == "" {
		return "", errors.New("restored Stripe subscription schedule is missing")
	}
	updateParams := &stripe.SubscriptionScheduleParams{
		EndBehavior: stripe.String(snapshot.EndBehavior),
		Metadata:    snapshot.Metadata,
	}
	updateCtx, updateCancel := context.WithTimeout(context.Background(), stripeSubscriptionLifecycleRequestTimeout)
	defer updateCancel()
	updateParams.Context = updateCtx
	for _, phase := range snapshot.Phases {
		phaseParams := &stripe.SubscriptionSchedulePhaseParams{
			StartDate: stripe.Int64(phase.StartDate),
			EndDate:   stripe.Int64(phase.EndDate),
			Metadata:  phase.Metadata,
		}
		if phase.CollectionMethod != "" {
			phaseParams.CollectionMethod = stripe.String(phase.CollectionMethod)
		}
		if phase.ProrationBehavior != "" {
			phaseParams.ProrationBehavior = stripe.String(phase.ProrationBehavior)
		}
		for _, item := range phase.Items {
			phaseParams.Items = append(phaseParams.Items, &stripe.SubscriptionSchedulePhaseItemParams{
				Price:    stripe.String(item.PriceID),
				Quantity: stripe.Int64(item.Quantity),
			})
		}
		updateParams.Phases = append(updateParams.Phases, phaseParams)
	}
	updateParams.SetIdempotencyKey(idempotencyKey + ":restore-schedule:update")
	restored, err := stripeschedule.Update(created.ID, updateParams)
	if err != nil {
		return "", err
	}
	if restored == nil || strings.TrimSpace(restored.ID) != strings.TrimSpace(created.ID) || restored.Subscription == nil || strings.TrimSpace(restored.Subscription.ID) != snapshot.SubscriptionID || len(restored.Phases) != len(snapshot.Phases) {
		return "", errors.New("restored Stripe subscription schedule could not be confirmed")
	}
	return strings.TrimSpace(restored.ID), nil
}

func persistStripeSubscriptionUpgradeScheduleRestored(intentID int64, scheduleID string, upgradeErr error) error {
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var intent model.SubscriptionChangeIntent
		if err := subscriptionCommandLock(tx).Where("id = ?", intentID).First(&intent).Error; err != nil {
			return err
		}
		if err := tx.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", intent.ProviderBindingId).Updates(map[string]interface{}{
			"provider_schedule_id": scheduleID,
			"last_synced_at":       common.GetTimestamp(),
			"updated_at":           common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		return tx.Model(&intent).Updates(map[string]interface{}{
			"status":                     model.SubscriptionChangeIntentStatusFailed,
			"previous_schedule_snapshot": "",
			"last_error":                 upgradeErr.Error(),
			"updated_at":                 common.GetTimestamp(),
		}).Error
	})
}

func markStripeSubscriptionUpgradeRecoveryUncertain(intentID int64, upgradeErr error, recoveryErr error) error {
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var intent model.SubscriptionChangeIntent
		if err := subscriptionCommandLock(tx).Where("id = ?", intentID).First(&intent).Error; err != nil {
			return err
		}
		lastError := fmt.Sprintf("upgrade failed: %v; schedule recovery failed: %v", upgradeErr, recoveryErr)
		if err := tx.Model(&intent).Updates(map[string]interface{}{
			"status":     model.SubscriptionChangeIntentStatusCompensationRequired,
			"last_error": lastError,
			"updated_at": common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		return tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", intent.ContractId).Updates(map[string]interface{}{
			"status":     model.SubscriptionContractStatusNeedsAttention,
			"updated_at": common.GetTimestamp(),
		}).Error
	})
}

func resolveStripeSubscriptionUpgradeOwnership(input *StripeSubscriptionUpgradeInput) error {
	if input == nil {
		return errors.New("Stripe subscription upgrade input is required")
	}
	var intent model.SubscriptionChangeIntent
	if err := model.DB.Where(
		"contract_id = ? AND change_version = ? AND to_plan_id = ? AND kind = ?",
		input.ContractID,
		input.ChangeVersion,
		input.TargetPlanID,
		model.SubscriptionChangeIntentKindUpgrade,
	).First(&intent).Error; err != nil {
		return err
	}
	if input.UserID > 0 && input.UserID != intent.UserId {
		return errors.New("Stripe subscription upgrade user mismatch")
	}
	if input.ChangeIntentID > 0 && input.ChangeIntentID != intent.Id {
		return errors.New("Stripe subscription upgrade intent mismatch")
	}
	input.UserID = intent.UserId
	input.ChangeIntentID = intent.Id
	return nil
}

func persistStripeSubscriptionUpgradeResult(intentID int64, result *StripeSubscriptionUpgradeResult) error {
	if intentID <= 0 {
		return errors.New("invalid change intent id")
	}
	if result == nil {
		return errors.New("Stripe subscription upgrade result is required")
	}
	status := strings.TrimSpace(result.Status)
	if status == "" {
		status = model.SubscriptionChangeIntentStatusSyncing
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var intent model.SubscriptionChangeIntent
		if err := subscriptionCommandLock(tx).Where("id = ?", intentID).First(&intent).Error; err != nil {
			return err
		}
		if intent.ProviderBindingId > 0 {
			snapshot := result.Snapshot
			if result.PreserveCancelAtPeriodEnd {
				snapshot.CancelAtPeriodEnd = true
			}
			if err := applyStripeSubscriptionUpgradeBindingSnapshotTx(tx, intent.ProviderBindingId, snapshot); err != nil {
				return err
			}
		}
		updates := map[string]interface{}{
			"status":     status,
			"last_error": "",
			"updated_at": common.GetTimestamp(),
		}
		if strings.TrimSpace(result.ProviderInvoiceID) != "" {
			updates["provider_invoice_id"] = strings.TrimSpace(result.ProviderInvoiceID)
		}
		if strings.TrimSpace(result.PreviousScheduleSnapshot) != "" {
			updates["previous_schedule_snapshot"] = strings.TrimSpace(result.PreviousScheduleSnapshot)
		}
		return tx.Model(&intent).Updates(updates).Error
	})
}

func markStripeSubscriptionUpgradeFailed(intentID int64, upgradeErr error) error {
	if intentID <= 0 {
		return nil
	}
	lastError := ""
	if upgradeErr != nil {
		lastError = upgradeErr.Error()
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var intent model.SubscriptionChangeIntent
		if err := subscriptionCommandLock(tx).Where("id = ?", intentID).First(&intent).Error; err != nil {
			return err
		}
		if intent.Status != model.SubscriptionChangeIntentStatusCreated &&
			intent.Status != model.SubscriptionChangeIntentStatusSyncing &&
			intent.Status != model.SubscriptionChangeIntentStatusAwaitingPayment {
			return nil
		}
		status := model.SubscriptionChangeIntentStatusFailed
		if strings.TrimSpace(intent.PreviousScheduleSnapshot) != "" {
			status = model.SubscriptionChangeIntentStatusCompensationRequired
			if err := tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", intent.ContractId).Updates(map[string]interface{}{
				"status":     model.SubscriptionContractStatusNeedsAttention,
				"updated_at": common.GetTimestamp(),
			}).Error; err != nil {
				return err
			}
		}
		return tx.Model(&intent).Updates(map[string]interface{}{
			"status":     status,
			"last_error": lastError,
			"updated_at": common.GetTimestamp(),
		}).Error
	})
}

func ReconcilePaidSubscriptionUpgradeInvoice(ctx context.Context, invoiceID string) (*PaidInvoiceReconcileResult, error) {
	return ReconcilePaidInvoice(ctx, invoiceID)
}

func isStripeRecurringSubscriptionUpgrade(facts paidInvoiceFacts) (bool, error) {
	if facts.ChangeIntentID <= 0 || facts.ContractID <= 0 || facts.UserID <= 0 {
		return false, nil
	}
	var intent model.SubscriptionChangeIntent
	err := model.DB.Select("id", "kind", "provider_binding_id").
		Where("id = ? AND user_id = ? AND contract_id = ?", facts.ChangeIntentID, facts.UserID, facts.ContractID).
		First(&intent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if intent.Kind != model.SubscriptionChangeIntentKindUpgrade || intent.ProviderBindingId <= 0 {
		return false, nil
	}
	var count int64
	if err := model.DB.Model(&model.SubscriptionProviderBinding{}).Where(
		"id = ? AND user_id = ? AND contract_id = ? AND provider = ? AND provider_subscription_id = ?",
		intent.ProviderBindingId,
		facts.UserID,
		facts.ContractID,
		model.PaymentProviderStripe,
		facts.SubscriptionID,
	).Count(&count).Error; err != nil {
		return false, err
	}
	return count == 1, nil
}

func resumeStripeSubscriptionUpgradeIfNeeded(facts paidInvoiceFacts) (paidInvoiceFacts, error) {
	var intent model.SubscriptionChangeIntent
	if err := model.DB.Where("id = ? AND user_id = ? AND contract_id = ?", facts.ChangeIntentID, facts.UserID, facts.ContractID).First(&intent).Error; err != nil {
		return facts, err
	}
	if err := validateStripeUpgradeIntentForPaidInvoice(facts, &intent); err != nil {
		return facts, PermanentPaidInvoiceError(err)
	}
	var contract model.UserSubscriptionContract
	if err := model.DB.Where("id = ? AND user_id = ?", intent.ContractId, intent.UserId).First(&contract).Error; err != nil {
		return facts, err
	}
	var binding model.SubscriptionProviderBinding
	if err := model.DB.Where(
		"id = ? AND user_id = ? AND contract_id = ? AND provider = ?",
		intent.ProviderBindingId,
		intent.UserId,
		intent.ContractId,
		model.PaymentProviderStripe,
	).First(&binding).Error; err != nil {
		return facts, err
	}
	var plan model.SubscriptionPlan
	if err := model.DB.Where("id = ?", intent.ToPlanId).First(&plan).Error; err != nil {
		return facts, err
	}
	plan.NormalizeDefaults()
	planSnapshot, err := recurringPlanSnapshotForUpgradeIntentTx(model.DB, &intent)
	if err != nil {
		return facts, PermanentPaidInvoiceError(err)
	}
	var user model.User
	if err := model.DB.Where("id = ?", intent.UserId).First(&user).Error; err != nil {
		return facts, err
	}
	if err := validateStripeUpgradePaidInvoiceFacts(facts, &intent, &contract, &binding, &plan, &user, planSnapshot); err != nil {
		return facts, PermanentPaidInvoiceError(err)
	}
	if !binding.CancelAtPeriodEnd {
		return facts, nil
	}
	idempotencyKey := strings.TrimSpace(intent.ProviderIdempotencyKey)
	if idempotencyKey == "" {
		idempotencyKey = stripeSubscriptionUpgradeIntentIdempotencyKey(contract.Id, intent.ChangeVersion, intent.ToPlanId, intent.Id)
	}
	snapshot, err := stripeUpdateSubscriptionCancelAtPeriodEnd(
		binding.ProviderSubscriptionId,
		false,
		idempotencyKey+":resume-recurring",
	)
	if err != nil {
		return facts, err
	}
	if snapshot.CancelAtPeriodEnd || strings.TrimSpace(snapshot.ProviderSubscriptionId) != facts.SubscriptionID || strings.TrimSpace(snapshot.ProviderSubscriptionItemId) != facts.SubscriptionItemID || strings.TrimSpace(snapshot.ProviderPriceId) != facts.PriceID {
		return facts, errors.New("Stripe subscription recurring resume could not be confirmed")
	}
	facts.CancelAtPeriodEnd = false
	return facts, nil
}

func applyStripeSubscriptionUpgradeBindingSnapshotTx(tx *gorm.DB, bindingID int64, snapshot model.ProviderSubscriptionSnapshot) error {
	if tx == nil || bindingID <= 0 {
		return nil
	}
	updates := map[string]interface{}{
		"last_synced_at": common.GetTimestamp(),
		"updated_at":     common.GetTimestamp(),
	}
	if strings.TrimSpace(snapshot.ProviderSubscriptionItemId) != "" {
		updates["provider_subscription_item_id"] = strings.TrimSpace(snapshot.ProviderSubscriptionItemId)
	}
	if strings.TrimSpace(snapshot.ProviderCustomerId) != "" {
		updates["provider_customer_id"] = strings.TrimSpace(snapshot.ProviderCustomerId)
	}
	if strings.TrimSpace(snapshot.ProviderPriceId) != "" {
		updates["provider_price_id"] = strings.TrimSpace(snapshot.ProviderPriceId)
	}
	if strings.TrimSpace(snapshot.ProviderLatestInvoiceId) != "" {
		updates["provider_latest_invoice_id"] = strings.TrimSpace(snapshot.ProviderLatestInvoiceId)
	}
	if strings.TrimSpace(snapshot.ProviderStatus) != "" {
		updates["provider_status"] = strings.TrimSpace(snapshot.ProviderStatus)
	}
	if snapshot.CurrentPeriodStart > 0 {
		updates["current_period_start"] = snapshot.CurrentPeriodStart
	}
	if snapshot.CurrentPeriodEnd > 0 {
		updates["current_period_end"] = snapshot.CurrentPeriodEnd
	}
	if snapshot.ProviderScheduleIdObserved {
		updates["provider_schedule_id"] = strings.TrimSpace(snapshot.ProviderScheduleId)
	}
	updates["cancel_at_period_end"] = snapshot.CancelAtPeriodEnd
	updates["grace_period_end"] = snapshot.GracePeriodEnd
	updates["canceled_at"] = snapshot.CanceledAt
	updates["ended_at"] = snapshot.EndedAt
	updates["livemode"] = snapshot.Livemode
	return tx.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", bindingID).Updates(updates).Error
}

func reconcilePaidInvoiceUpgradeTx(tx *gorm.DB, facts paidInvoiceFacts, result *PaidInvoiceReconcileResult) (bool, error) {
	if tx == nil || facts.ChangeIntentID <= 0 || facts.ContractID <= 0 || facts.UserID <= 0 || facts.PlanID <= 0 {
		return false, nil
	}
	var intent model.SubscriptionChangeIntent
	err := subscriptionCommandLock(tx).
		Where("id = ? AND user_id = ? AND contract_id = ?", facts.ChangeIntentID, facts.UserID, facts.ContractID).
		First(&intent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if intent.Kind != model.SubscriptionChangeIntentKindUpgrade {
		return false, nil
	}
	if err := validateStripeUpgradeIntentForPaidInvoice(facts, &intent); err != nil {
		return true, PermanentPaidInvoiceError(err)
	}

	binding, err := lockStripeUpgradeIntentBinding(tx, &intent)
	if err != nil {
		return true, err
	}
	var contract model.UserSubscriptionContract
	if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", intent.ContractId, intent.UserId).First(&contract).Error; err != nil {
		return true, err
	}
	var plan model.SubscriptionPlan
	if err := tx.Where("id = ?", intent.ToPlanId).First(&plan).Error; err != nil {
		return true, err
	}
	plan.NormalizeDefaults()
	planSnapshot, err := recurringPlanSnapshotForUpgradeIntentTx(tx, &intent)
	if err != nil {
		return true, PermanentPaidInvoiceError(err)
	}
	var user model.User
	if err := subscriptionCommandLock(tx).Where("id = ?", intent.UserId).First(&user).Error; err != nil {
		return true, err
	}
	if err := validateStripeUpgradePaidInvoiceFacts(facts, &intent, &contract, &binding, &plan, &user, planSnapshot); err != nil {
		return true, PermanentPaidInvoiceError(err)
	}
	// Legacy upgrade intents created before snapshot orders cannot emit order-scoped lifecycle events.
	if !planSnapshot.Found {
		return reconcilePaidInvoiceUpgradeWithoutSnapshotOrderTx(tx, facts, result, &intent, &contract, &binding, &plan, planSnapshot)
	}
	var upgradeOrder model.SubscriptionOrder
	if err := tx.Where("id = ? AND user_id = ? AND change_intent_id = ?", planSnapshot.OrderID, intent.UserId, intent.Id).First(&upgradeOrder).Error; err != nil {
		return true, err
	}

	var grant *model.GrantEntitlementResult
	now := common.GetTimestamp()
	applied, err := model.PersistSubscriptionPurchaseLifecycleTransitionWithWinner(tx, model.PurchaseLifecycleTransition{
		SourceID:   int64(upgradeOrder.Id),
		TradeNo:    upgradeOrder.TradeNo,
		UserID:     upgradeOrder.UserId,
		FromStatus: []string{common.TopUpStatusPending, common.TopUpStatusFailed, common.TopUpStatusExpired, "cancelled", "canceled"},
		ToStatus:   common.TopUpStatusSuccess,
		OccurredAt: now,
		SourceRef:  "stripe.invoice." + facts.InvoiceID,
	}, func(tx *gorm.DB, locked *model.SubscriptionOrder, transition *model.PurchaseLifecycleTransition) error {
		grant, err = model.RotateCurrentEntitlementTx(tx, model.GrantEntitlementInput{
			ContractId:           contract.Id,
			UserId:               binding.UserId,
			PlanId:               plan.Id,
			ProviderBindingId:    binding.Id,
			GrantKey:             "stripe:" + facts.InvoiceID,
			PaymentMode:          model.SubscriptionPaymentModeStripeRecurring,
			AmountTotal:          recurringInvoiceGrantAmountTotal(&plan, planSnapshot),
			Window5hAmount:       recurringInvoiceGrantWindow5h(&plan, planSnapshot),
			WindowWeekAmount:     recurringInvoiceGrantWindowWeek(&plan, planSnapshot),
			UpgradeGroup:         recurringInvoiceGrantUpgradeGroup(&plan, planSnapshot),
			PeriodStart:          facts.PeriodStart,
			PeriodEnd:            facts.PeriodEnd,
			EndReasonForPrevious: model.SubscriptionEntitlementEndReasonUpgraded,
			Source:               model.PaymentMethodStripe,
		})
		if err != nil {
			return err
		}
		if grant != nil && grant.Entitlement != nil {
			transition.SubscriptionScopeID = int64(grant.Entitlement.Id)
		}
		locked.ProviderPayload = fmt.Sprintf("invoice_id=%s;subscription_id=%s;change_intent_id=%d", facts.InvoiceID, facts.SubscriptionID, intent.Id)
		return tx.Model(locked).Where("id = ?", locked.Id).Update("provider_payload", locked.ProviderPayload).Error
	})
	if err != nil {
		return true, err
	}
	if err := tx.Model(&binding).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"plan_id":                       plan.Id,
		"initial_order_id":              recurringInvoiceInitialOrderID(binding.InitialOrderId, planSnapshot),
		"provider_subscription_item_id": strings.TrimSpace(facts.SubscriptionItemID),
		"provider_customer_id":          strings.TrimSpace(facts.CustomerID),
		"provider_price_id":             strings.TrimSpace(facts.PriceID),
		"provider_latest_invoice_id":    facts.InvoiceID,
		"provider_status":               strings.TrimSpace(facts.ProviderStatus),
		"cancel_at_period_end":          facts.CancelAtPeriodEnd,
		"current_period_start":          facts.PeriodStart,
		"current_period_end":            facts.PeriodEnd,
		"grace_period_end":              0,
		"livemode":                      facts.Livemode,
		"last_synced_at":                now,
		"updated_at":                    now,
	}).Error; err != nil {
		return true, err
	}
	if err := tx.Model(&intent).Where("id = ?", intent.Id).Updates(map[string]interface{}{
		"status":              model.SubscriptionChangeIntentStatusApplied,
		"provider_invoice_id": facts.InvoiceID,
		"effective_at":        facts.PeriodStart,
		"last_error":          "",
		"updated_at":          now,
	}).Error; err != nil {
		return true, err
	}
	if err := tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":                  model.SubscriptionContractStatusActive,
		"payment_mode":            model.SubscriptionPaymentModeStripeRecurring,
		"latest_change_intent_id": intent.Id,
		"pending_plan_id":         0,
		"pending_effective_at":    0,
		"grace_period_end":        0,
		"updated_at":              now,
	}).Error; err != nil {
		return true, err
	}
	result.Binding = &binding
	if grant != nil {
		result.Entitlement = grant.Entitlement
	}
	result.Applied = applied
	return true, nil
}

func reconcilePaidInvoiceUpgradeWithoutSnapshotOrderTx(
	tx *gorm.DB,
	facts paidInvoiceFacts,
	result *PaidInvoiceReconcileResult,
	intent *model.SubscriptionChangeIntent,
	contract *model.UserSubscriptionContract,
	binding *model.SubscriptionProviderBinding,
	plan *model.SubscriptionPlan,
	planSnapshot recurringInvoicePlanSnapshot,
) (bool, error) {
	grant, err := model.RotateCurrentEntitlementTx(tx, model.GrantEntitlementInput{
		ContractId:           contract.Id,
		UserId:               binding.UserId,
		PlanId:               plan.Id,
		ProviderBindingId:    binding.Id,
		GrantKey:             "stripe:" + facts.InvoiceID,
		PaymentMode:          model.SubscriptionPaymentModeStripeRecurring,
		AmountTotal:          recurringInvoiceGrantAmountTotal(plan, planSnapshot),
		Window5hAmount:       recurringInvoiceGrantWindow5h(plan, planSnapshot),
		WindowWeekAmount:     recurringInvoiceGrantWindowWeek(plan, planSnapshot),
		UpgradeGroup:         recurringInvoiceGrantUpgradeGroup(plan, planSnapshot),
		PeriodStart:          facts.PeriodStart,
		PeriodEnd:            facts.PeriodEnd,
		EndReasonForPrevious: model.SubscriptionEntitlementEndReasonUpgraded,
		Source:               model.PaymentMethodStripe,
	})
	if err != nil {
		return true, err
	}
	now := common.GetTimestamp()
	if err := tx.Model(binding).Where("id = ?", binding.Id).Updates(map[string]interface{}{
		"plan_id":                       plan.Id,
		"initial_order_id":              recurringInvoiceInitialOrderID(binding.InitialOrderId, planSnapshot),
		"provider_subscription_item_id": strings.TrimSpace(facts.SubscriptionItemID),
		"provider_customer_id":          strings.TrimSpace(facts.CustomerID),
		"provider_price_id":             strings.TrimSpace(facts.PriceID),
		"provider_latest_invoice_id":    facts.InvoiceID,
		"provider_status":               strings.TrimSpace(facts.ProviderStatus),
		"cancel_at_period_end":          facts.CancelAtPeriodEnd,
		"current_period_start":          facts.PeriodStart,
		"current_period_end":            facts.PeriodEnd,
		"grace_period_end":              0,
		"livemode":                      facts.Livemode,
		"last_synced_at":                now,
		"updated_at":                    now,
	}).Error; err != nil {
		return true, err
	}
	if err := tx.Model(intent).Where("id = ?", intent.Id).Updates(map[string]interface{}{
		"status":              model.SubscriptionChangeIntentStatusApplied,
		"provider_invoice_id": facts.InvoiceID,
		"effective_at":        facts.PeriodStart,
		"last_error":          "",
		"updated_at":          now,
	}).Error; err != nil {
		return true, err
	}
	if err := tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"status":                  model.SubscriptionContractStatusActive,
		"payment_mode":            model.SubscriptionPaymentModeStripeRecurring,
		"latest_change_intent_id": intent.Id,
		"pending_plan_id":         0,
		"pending_effective_at":    0,
		"grace_period_end":        0,
		"updated_at":              now,
	}).Error; err != nil {
		return true, err
	}
	result.Binding = binding
	if grant != nil {
		result.Entitlement = grant.Entitlement
		result.Applied = grant.Applied
	}
	return true, nil
}

func validateStripeUpgradeIntentForPaidInvoice(facts paidInvoiceFacts, intent *model.SubscriptionChangeIntent) error {
	if intent == nil {
		return errors.New("local change intent is missing")
	}
	if intent.Status != model.SubscriptionChangeIntentStatusAwaitingPayment &&
		intent.Status != model.SubscriptionChangeIntentStatusSyncing &&
		intent.Status != model.SubscriptionChangeIntentStatusApplied {
		return errors.New("local change intent status mismatch")
	}
	if intent.ToPlanId != facts.PlanID || intent.UserId != facts.UserID || intent.ContractId != facts.ContractID {
		return errors.New("local change intent ownership mismatch")
	}
	if strings.TrimSpace(intent.ProviderInvoiceId) != "" && strings.TrimSpace(intent.ProviderInvoiceId) != facts.InvoiceID {
		return errors.New("Stripe invoice intent mismatch")
	}
	if intent.ProviderBindingId <= 0 {
		return errors.New("Stripe upgrade binding is missing")
	}
	return nil
}

func recurringPlanSnapshotForUpgradeIntentTx(tx *gorm.DB, intent *model.SubscriptionChangeIntent) (recurringInvoicePlanSnapshot, error) {
	if tx == nil || intent == nil || intent.Id <= 0 {
		return recurringInvoicePlanSnapshot{}, nil
	}
	var order model.SubscriptionOrder
	query := tx.Where(
		"change_intent_id = ? AND payment_provider = ? AND purchase_intent = ?",
		intent.Id,
		model.PaymentProviderStripe,
		model.SubscriptionChangeIntentKindUpgrade,
	).Order("id desc").Limit(1).Find(&order)
	if query.Error != nil {
		return recurringInvoicePlanSnapshot{}, query.Error
	}
	if query.RowsAffected == 0 {
		return recurringInvoicePlanSnapshot{}, nil
	}
	return recurringPlanSnapshotFromOrder(&order)
}

func recurringInvoiceInitialOrderID(current int, planSnapshot recurringInvoicePlanSnapshot) int {
	if planSnapshot.Found && planSnapshot.OrderID > 0 {
		return planSnapshot.OrderID
	}
	return current
}

func lockStripeUpgradeIntentBinding(tx *gorm.DB, intent *model.SubscriptionChangeIntent) (model.SubscriptionProviderBinding, error) {
	var binding model.SubscriptionProviderBinding
	if tx == nil || intent == nil || intent.ProviderBindingId <= 0 {
		return binding, errors.New("Stripe upgrade intent binding is required")
	}
	err := subscriptionCommandLock(tx).
		Where("id = ? AND user_id = ? AND contract_id = ? AND provider = ?",
			intent.ProviderBindingId, intent.UserId, intent.ContractId, model.PaymentProviderStripe).
		First(&binding).Error
	return binding, err
}

func validateStripeUpgradePaidInvoiceFacts(facts paidInvoiceFacts, intent *model.SubscriptionChangeIntent, contract *model.UserSubscriptionContract, binding *model.SubscriptionProviderBinding, plan *model.SubscriptionPlan, user *model.User, planSnapshot recurringInvoicePlanSnapshot) error {
	if contract.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
		return errors.New("local contract payment mode mismatch")
	}
	if contract.CurrentProviderBindingId != binding.Id || binding.ContractId != contract.Id || binding.UserId != contract.UserId {
		return errors.New("local contract binding mismatch")
	}
	if strings.TrimSpace(binding.ProviderSubscriptionId) != facts.SubscriptionID {
		return errors.New("Stripe subscription mismatch")
	}
	if strings.TrimSpace(binding.ProviderSubscriptionItemId) == "" || strings.TrimSpace(binding.ProviderSubscriptionItemId) != facts.SubscriptionItemID {
		return errors.New("Stripe subscription item mismatch")
	}
	if strings.TrimSpace(binding.ProviderCustomerId) == "" || strings.TrimSpace(binding.ProviderCustomerId) != facts.CustomerID {
		return errors.New("local Stripe customer mismatch")
	}
	if strings.TrimSpace(user.StripeCustomer) != "" && strings.TrimSpace(user.StripeCustomer) != facts.CustomerID {
		return errors.New("local Stripe customer mismatch")
	}
	if binding.Livemode != facts.Livemode {
		return errors.New("Stripe invoice livemode mismatch")
	}
	if plan.Id != intent.ToPlanId || (!plan.Enabled && !planSnapshot.Found) {
		return errors.New("local plan is not enabled")
	}
	if strings.TrimSpace(plan.StripePriceId) == "" || strings.TrimSpace(plan.StripePriceId) != facts.PriceID {
		return errors.New("Stripe price mismatch")
	}
	expectedCurrency := strings.ToUpper(strings.TrimSpace(plan.Currency))
	if planSnapshot.Found {
		expectedCurrency = strings.ToUpper(strings.TrimSpace(planSnapshot.Snapshot.Currency))
	}
	if expectedCurrency != facts.Currency {
		return errors.New("Stripe invoice currency mismatch")
	}
	expectedPrice := plan.PriceAmount
	if planSnapshot.Found {
		expectedPrice = planSnapshot.Snapshot.PriceAmount
	}
	expectedMinor, err := stripeMinorUnitAmountForSubscription(expectedPrice, facts.Currency)
	if err != nil {
		return err
	}
	if expectedMinor != facts.AmountPaid {
		return fmt.Errorf("Stripe invoice amount mismatch: expected %d got %d", expectedMinor, facts.AmountPaid)
	}
	return nil
}

func getStripeSubscriptionForUpgrade(providerSubscriptionID string) (*stripe.Subscription, error) {
	params := &stripe.SubscriptionParams{}
	params.AddExpand("latest_invoice")
	params.AddExpand("items.data.price")
	params.AddExpand("customer")
	sub, err := stripesubscription.Get(strings.TrimSpace(providerSubscriptionID), params)
	if err != nil {
		return nil, err
	}
	if sub == nil || strings.TrimSpace(sub.ID) == "" {
		return nil, errors.New("Stripe subscription is missing")
	}
	return sub, nil
}

func validateStripeSubscriptionForUpgrade(sub *stripe.Subscription, input StripeSubscriptionUpgradeInput) error {
	if strings.TrimSpace(sub.ID) != input.ProviderSubscriptionID {
		return errors.New("Stripe subscription mismatch")
	}
	if stripeSubscriptionFirstItemID(sub) != input.ProviderSubscriptionItemID {
		return errors.New("Stripe subscription item mismatch")
	}
	return nil
}

func stripeSubscriptionScheduleID(sub *stripe.Subscription) string {
	if sub == nil || sub.Schedule == nil {
		return ""
	}
	return strings.TrimSpace(sub.Schedule.ID)
}

func (input *StripeSubscriptionUpgradeInput) normalize() {
	input.TargetPriceID = strings.TrimSpace(input.TargetPriceID)
	input.ProviderSubscriptionID = strings.TrimSpace(input.ProviderSubscriptionID)
	input.ProviderSubscriptionItemID = strings.TrimSpace(input.ProviderSubscriptionItemID)
	input.ProviderScheduleID = strings.TrimSpace(input.ProviderScheduleID)
	input.IdempotencyKey = strings.TrimSpace(input.IdempotencyKey)
}

func (input StripeSubscriptionUpgradeInput) validate() error {
	if input.ContractID <= 0 {
		return errors.New("contract id is required")
	}
	if input.ChangeVersion <= 0 {
		return errors.New("change version is required")
	}
	if input.TargetPlanID <= 0 {
		return errors.New("target plan id is required")
	}
	if input.TargetPriceID == "" {
		return errors.New("Stripe subscription price id is required")
	}
	if input.ProviderSubscriptionID == "" {
		return errors.New("Stripe subscription id is required")
	}
	if input.ProviderSubscriptionItemID == "" {
		return errors.New("Stripe subscription item id is required")
	}
	if input.IdempotencyKey == "" {
		return errors.New("Stripe subscription upgrade idempotency key is required")
	}
	return nil
}
