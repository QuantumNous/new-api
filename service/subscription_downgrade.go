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

type StripeSubscriptionDowngradeInput struct {
	UserID                     int
	ContractID                 int64
	ChangeIntentID             int64
	ChangeVersion              int64
	CurrentPlanID              int
	TargetPlanID               int
	CurrentPriceID             string
	TargetPriceID              string
	ProviderSubscriptionID     string
	ProviderSubscriptionItemID string
	ProviderScheduleID         string
	CurrentPeriodStart         int64
	CurrentPeriodEnd           int64
	IdempotencyKey             string
}

type StripeSubscriptionDowngradeResult struct {
	Status             string
	ChangeIntentID     int64
	ChangeVersion      int64
	TargetPlanID       int
	ProviderScheduleID string
	Snapshot           model.ProviderSubscriptionSnapshot
}

var stripeSubscriptionDowngradeExecutor = executeStripeSubscriptionDowngrade
var stripeSubscriptionDowngradeAfterLatestRead func()

func stripeSubscriptionDowngradeIntentIdempotencyKey(contractID int64, changeVersion int64, targetPlanID int, intentID int64) string {
	return fmt.Sprintf("subscription-downgrade:contract:%d:version:%d:target-plan:%d:intent:%d", contractID, changeVersion, targetPlanID, intentID)
}

func executeStripeSubscriptionDowngrade(ctx context.Context, input StripeSubscriptionDowngradeInput) (*StripeSubscriptionDowngradeResult, error) {
	_ = ctx
	input.normalize()
	if err := input.validate(); err != nil {
		return nil, err
	}
	if err := ensureStripeSecretForSubscription(); err != nil {
		return nil, err
	}
	stripe.Key = setting.StripeApiSecret

	current, err := getStripeSubscriptionForDowngrade(input.ProviderSubscriptionID)
	if err != nil {
		return nil, err
	}
	if err := validateStripeSubscriptionForDowngrade(current, input); err != nil {
		return nil, err
	}
	latest, targetPlan, err := latestStripeDowngradeScheduleInput(input, current)
	if err != nil {
		return nil, err
	}
	if stripeSubscriptionDowngradeAfterLatestRead != nil {
		stripeSubscriptionDowngradeAfterLatestRead()
	}
	scheduleID := firstNonEmptyString(stripeSubscriptionScheduleID(current), latest.ProviderScheduleID)
	if scheduleID == "" {
		scheduleID, err = createStripeDowngradeSchedule(latest.ProviderSubscriptionID, latest.IdempotencyKey)
		if err != nil {
			refetched, fetchErr := getStripeSubscriptionForDowngrade(latest.ProviderSubscriptionID)
			if fetchErr != nil {
				return nil, fmt.Errorf("Stripe downgrade schedule create failed: %v; refetch failed: %w", err, fetchErr)
			}
			scheduleID = stripeSubscriptionScheduleID(refetched)
			if scheduleID == "" {
				return nil, err
			}
			current = refetched
		}
	}
	for attempt := 0; attempt < 4; attempt++ {
		if err := updateStripeDowngradeSchedule(scheduleID, latest, targetPlan); err != nil {
			return nil, err
		}
		confirmed, err := getStripeSubscriptionForDowngrade(latest.ProviderSubscriptionID)
		if err != nil {
			return nil, err
		}
		confirmedScheduleID := stripeSubscriptionScheduleID(confirmed)
		if confirmedScheduleID == "" {
			return nil, errors.New("Stripe downgrade schedule is not attached to subscription")
		}
		if confirmedScheduleID != scheduleID {
			scheduleID = confirmedScheduleID
		}
		nextLatest, nextTargetPlan, err := latestStripeDowngradeScheduleInput(latest, confirmed)
		if err != nil {
			return nil, err
		}
		if sameStripeDowngradeVersion(latest, nextLatest) {
			snapshot := providerSubscriptionSnapshotFromStripe(confirmed)
			snapshot.ProviderScheduleId = scheduleID
			snapshot.ProviderScheduleIdObserved = true
			if strings.TrimSpace(snapshot.ProviderPriceId) == "" {
				snapshot.ProviderPriceId = latest.CurrentPriceID
			}
			return &StripeSubscriptionDowngradeResult{
				Status:             model.SubscriptionChangeIntentStatusScheduled,
				ChangeIntentID:     latest.ChangeIntentID,
				ChangeVersion:      latest.ChangeVersion,
				TargetPlanID:       latest.TargetPlanID,
				ProviderScheduleID: scheduleID,
				Snapshot:           snapshot,
			}, nil
		}
		latest = nextLatest
		targetPlan = nextTargetPlan
	}
	return nil, errors.New("Stripe downgrade schedule convergence did not settle")
}

func latestStripeDowngradeScheduleInput(input StripeSubscriptionDowngradeInput, sub *stripe.Subscription) (StripeSubscriptionDowngradeInput, *model.SubscriptionPlan, error) {
	latest := input
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var contract model.UserSubscriptionContract
		if err := subscriptionCommandLock(tx).Where("id = ?", input.ContractID).First(&contract).Error; err != nil {
			return err
		}
		var intent model.SubscriptionChangeIntent
		if contract.LatestChangeIntentId > 0 {
			if err := subscriptionCommandLock(tx).Where("id = ? AND contract_id = ? AND kind = ?", contract.LatestChangeIntentId, contract.Id, model.SubscriptionChangeIntentKindDowngrade).First(&intent).Error; err != nil {
				return err
			}
		} else {
			if err := subscriptionCommandLock(tx).
				Where("contract_id = ? AND kind = ? AND status IN ?", contract.Id, model.SubscriptionChangeIntentKindDowngrade, []string{model.SubscriptionChangeIntentStatusCreated, model.SubscriptionChangeIntentStatusSyncing, model.SubscriptionChangeIntentStatusScheduled}).
				Order("change_version desc, id desc").
				First(&intent).Error; err != nil {
				return err
			}
		}
		var binding model.SubscriptionProviderBinding
		if err := subscriptionCommandLock(tx).Where("id = ? AND contract_id = ? AND provider = ?", intent.ProviderBindingId, contract.Id, model.PaymentProviderStripe).First(&binding).Error; err != nil {
			return err
		}
		var target model.SubscriptionPlan
		if err := tx.Where("id = ?", intent.ToPlanId).First(&target).Error; err != nil {
			return err
		}
		target.NormalizeDefaults()
		latest.UserID = intent.UserId
		latest.ContractID = contract.Id
		latest.ChangeIntentID = intent.Id
		latest.ChangeVersion = intent.ChangeVersion
		latest.CurrentPlanID = contract.CurrentPlanId
		latest.TargetPlanID = target.Id
		latest.TargetPriceID = strings.TrimSpace(target.StripePriceId)
		latest.ProviderSubscriptionID = strings.TrimSpace(binding.ProviderSubscriptionId)
		latest.ProviderSubscriptionItemID = strings.TrimSpace(binding.ProviderSubscriptionItemId)
		latest.ProviderScheduleID = strings.TrimSpace(binding.ProviderScheduleId)
		latest.CurrentPeriodStart = firstPositiveInt64(stripeSubscriptionCurrentPeriodStart(sub), binding.CurrentPeriodStart, contract.CurrentPeriodStart)
		latest.CurrentPeriodEnd = firstPositiveInt64(stripeSubscriptionCurrentPeriodEnd(sub), binding.CurrentPeriodEnd, contract.CurrentPeriodEnd, intent.EffectiveAt)
		latest.CurrentPriceID = firstNonEmptyString(stripeSubscriptionFirstPriceID(sub), binding.ProviderPriceId, input.CurrentPriceID)
		latest.IdempotencyKey = strings.TrimSpace(intent.ProviderIdempotencyKey)
		if latest.IdempotencyKey == "" {
			latest.IdempotencyKey = stripeSubscriptionDowngradeIntentIdempotencyKey(contract.Id, intent.ChangeVersion, target.Id, intent.Id)
			if err := tx.Model(&intent).Update("provider_idempotency_key", latest.IdempotencyKey).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return StripeSubscriptionDowngradeInput{}, nil, err
	}
	if err := latest.validate(); err != nil {
		return StripeSubscriptionDowngradeInput{}, nil, err
	}
	var target model.SubscriptionPlan
	if err := model.DB.Where("id = ?", latest.TargetPlanID).First(&target).Error; err != nil {
		return StripeSubscriptionDowngradeInput{}, nil, err
	}
	target.NormalizeDefaults()
	return latest, &target, nil
}

func createStripeDowngradeSchedule(subscriptionID string, idempotencyKey string) (string, error) {
	params := &stripe.SubscriptionScheduleParams{FromSubscription: stripe.String(subscriptionID)}
	params.SetIdempotencyKey(idempotencyKey + ":create-schedule")
	created, err := stripeschedule.New(params)
	if err != nil {
		return "", err
	}
	if created == nil || strings.TrimSpace(created.ID) == "" {
		return "", errors.New("Stripe downgrade schedule is missing")
	}
	return strings.TrimSpace(created.ID), nil
}

func updateStripeDowngradeSchedule(scheduleID string, input StripeSubscriptionDowngradeInput, targetPlan *model.SubscriptionPlan) error {
	nextEnd, err := subscriptionPlanPeriodEnd(input.CurrentPeriodEnd, targetPlan)
	if err != nil {
		return err
	}
	params := &stripe.SubscriptionScheduleParams{EndBehavior: stripe.String("release")}
	params.Phases = []*stripe.SubscriptionSchedulePhaseParams{
		{
			StartDate:         stripe.Int64(input.CurrentPeriodStart),
			EndDate:           stripe.Int64(input.CurrentPeriodEnd),
			ProrationBehavior: stripe.String("none"),
			Items: []*stripe.SubscriptionSchedulePhaseItemParams{{
				Price:    stripe.String(input.CurrentPriceID),
				Quantity: stripe.Int64(1),
			}},
		},
		{
			StartDate:         stripe.Int64(input.CurrentPeriodEnd),
			EndDate:           stripe.Int64(nextEnd),
			ProrationBehavior: stripe.String("none"),
			Items: []*stripe.SubscriptionSchedulePhaseItemParams{{
				Price:    stripe.String(input.TargetPriceID),
				Quantity: stripe.Int64(1),
			}},
		},
	}
	params.SetIdempotencyKey(input.IdempotencyKey + ":update-schedule")
	updated, err := stripeschedule.Update(scheduleID, params)
	if err != nil {
		return err
	}
	if updated == nil || strings.TrimSpace(updated.ID) != strings.TrimSpace(scheduleID) {
		return errors.New("Stripe downgrade schedule update could not be confirmed")
	}
	return nil
}

func persistStripeSubscriptionDowngradeResult(intentID int64, result *StripeSubscriptionDowngradeResult) error {
	if intentID <= 0 || result == nil {
		return errors.New("Stripe subscription downgrade result is required")
	}
	if result.ChangeIntentID <= 0 {
		result.ChangeIntentID = intentID
	}
	status := strings.TrimSpace(result.Status)
	if status == "" {
		status = model.SubscriptionChangeIntentStatusScheduled
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var intent model.SubscriptionChangeIntent
		if err := subscriptionCommandLock(tx).Where("id = ?", result.ChangeIntentID).First(&intent).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if result.ChangeIntentID != intentID {
			if err := tx.Model(&model.SubscriptionChangeIntent{}).
				Where("id = ? AND status IN ?", intentID, []string{model.SubscriptionChangeIntentStatusCreated, model.SubscriptionChangeIntentStatusSyncing, model.SubscriptionChangeIntentStatusScheduled}).
				Updates(map[string]interface{}{"status": model.SubscriptionChangeIntentStatusSuperseded, "superseded_by_id": result.ChangeIntentID, "updated_at": common.GetTimestamp()}).Error; err != nil {
				return err
			}
		}
		if intent.ProviderBindingId > 0 {
			if err := applyStripeSubscriptionUpgradeBindingSnapshotTx(tx, intent.ProviderBindingId, result.Snapshot); err != nil {
				return err
			}
		}
		if err := tx.Model(&intent).Updates(map[string]interface{}{
			"status":               status,
			"provider_schedule_id": strings.TrimSpace(result.ProviderScheduleID),
			"last_error":           "",
			"updated_at":           common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		return nil
	})
}

func markStripeSubscriptionDowngradeFailed(intentID int64, downgradeErr error) error {
	if intentID <= 0 {
		return nil
	}
	lastError := ""
	if downgradeErr != nil {
		lastError = downgradeErr.Error()
	}
	return model.DB.Model(&model.SubscriptionChangeIntent{}).
		Where("id = ? AND status IN ?", intentID, []string{model.SubscriptionChangeIntentStatusCreated, model.SubscriptionChangeIntentStatusSyncing}).
		Updates(map[string]interface{}{"status": model.SubscriptionChangeIntentStatusSyncing, "last_error": lastError, "updated_at": common.GetTimestamp()}).Error
}

func getStripeSubscriptionForDowngrade(providerSubscriptionID string) (*stripe.Subscription, error) {
	params := &stripe.SubscriptionParams{}
	params.AddExpand("items.data.price")
	params.AddExpand("schedule")
	sub, err := stripesubscription.Get(strings.TrimSpace(providerSubscriptionID), params)
	if err != nil {
		return nil, err
	}
	if sub == nil || strings.TrimSpace(sub.ID) == "" {
		return nil, errors.New("Stripe subscription is missing")
	}
	return sub, nil
}

func validateStripeSubscriptionForDowngrade(sub *stripe.Subscription, input StripeSubscriptionDowngradeInput) error {
	if strings.TrimSpace(sub.ID) != input.ProviderSubscriptionID {
		return errors.New("Stripe subscription mismatch")
	}
	if stripeSubscriptionFirstItemID(sub) != input.ProviderSubscriptionItemID {
		return errors.New("Stripe subscription item mismatch")
	}
	if isTerminalStripeSubscriptionStatus(string(sub.Status)) || sub.Status != stripe.SubscriptionStatusActive {
		return errors.New("Stripe subscription is not active")
	}
	return nil
}

func (input *StripeSubscriptionDowngradeInput) normalize() {
	input.CurrentPriceID = strings.TrimSpace(input.CurrentPriceID)
	input.TargetPriceID = strings.TrimSpace(input.TargetPriceID)
	input.ProviderSubscriptionID = strings.TrimSpace(input.ProviderSubscriptionID)
	input.ProviderSubscriptionItemID = strings.TrimSpace(input.ProviderSubscriptionItemID)
	input.ProviderScheduleID = strings.TrimSpace(input.ProviderScheduleID)
	input.IdempotencyKey = strings.TrimSpace(input.IdempotencyKey)
}

func (input StripeSubscriptionDowngradeInput) validate() error {
	if input.ContractID <= 0 {
		return errors.New("contract id is required")
	}
	if input.ChangeVersion <= 0 {
		return errors.New("change version is required")
	}
	if input.TargetPlanID <= 0 {
		return errors.New("target plan id is required")
	}
	if input.CurrentPriceID == "" || input.TargetPriceID == "" {
		return errors.New("Stripe subscription price id is required")
	}
	if input.ProviderSubscriptionID == "" {
		return errors.New("Stripe subscription id is required")
	}
	if input.ProviderSubscriptionItemID == "" {
		return errors.New("Stripe subscription item id is required")
	}
	if input.CurrentPeriodEnd <= 0 {
		return errors.New("current period end is required")
	}
	if input.IdempotencyKey == "" {
		return errors.New("Stripe subscription downgrade idempotency key is required")
	}
	return nil
}

func sameStripeDowngradeVersion(left StripeSubscriptionDowngradeInput, right StripeSubscriptionDowngradeInput) bool {
	return left.ChangeIntentID == right.ChangeIntentID &&
		left.ChangeVersion == right.ChangeVersion &&
		left.TargetPlanID == right.TargetPlanID &&
		left.TargetPriceID == right.TargetPriceID
}

func stripeSubscriptionCurrentPeriodStart(sub *stripe.Subscription) int64 {
	start, _ := stripeSubscriptionCurrentPeriod(sub)
	return start
}

func stripeSubscriptionCurrentPeriodEnd(sub *stripe.Subscription) int64 {
	_, end := stripeSubscriptionCurrentPeriod(sub)
	return end
}

func firstPositiveInt64(values ...int64) int64 {
	for _, value := range values {
		if value > 0 {
			return value
		}
	}
	return 0
}
