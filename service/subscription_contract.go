package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	ChangePlanStatusApplied               = "applied"
	ChangePlanStatusScheduled             = "scheduled"
	ChangePlanStatusCheckoutRequired      = "checkout_required"
	ChangePlanStatusPaymentActionRequired = "payment_action_required"
)

var (
	ErrSubscriptionChangeInProgress     = errors.New("subscription change in progress")
	ErrSubscriptionPlanUnchanged        = errors.New("subscription plan unchanged")
	ErrSubscriptionDowngradeUnsupported = errors.New("subscription downgrade scheduling is only supported for active Stripe recurring subscriptions")
	ErrSubscriptionDowngradeDeferred    = ErrSubscriptionDowngradeUnsupported
	ErrStripeCheckoutPendingMigration   = errors.New("stripe checkout pending migration")
)

type ChangePlanCommand struct {
	UserID      int
	PlanID      int
	PaymentMode string
	RequestID   string
	UIMode      string
}

type ChangePlanResult struct {
	Status           string                          `json:"status"`
	Contract         *model.UserSubscriptionContract `json:"contract"`
	Intent           *model.SubscriptionChangeIntent `json:"intent"`
	CheckoutURL      string                          `json:"checkout_url,omitempty"`
	HostedInvoiceURL string                          `json:"hosted_invoice_url,omitempty"`
	ClientSecret     string                          `json:"client_secret,omitempty"`
}

func ChangeSubscriptionPlan(cmd ChangePlanCommand) (*ChangePlanResult, error) {
	cmd.normalize()
	if err := cmd.validate(); err != nil {
		return nil, err
	}

	var result *ChangePlanResult
	var balanceEffects *balanceOnePeriodSideEffects
	var checkoutInput *StripeSubscriptionCheckoutInput
	var upgradeInput *StripeSubscriptionUpgradeInput
	var downgradeInput *StripeSubscriptionDowngradeInput
	var upgradeReplayInvoiceID string
	var upgradeReplaySubscriptionID string
	var supersededCheckouts []supersededStripeCheckout
	if cmd.PaymentMode == model.SubscriptionPaymentModeStripeRecurring {
		var err error
		supersededCheckouts, err = supersedeReplaceablePendingStripeCheckouts(context.Background(), cmd.UserID, cmd.RequestID)
		if err != nil {
			return nil, err
		}
	}
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := subscriptionCommandLock(tx).Where("id = ?", cmd.UserID).First(&user).Error; err != nil {
			return err
		}
		if existing, found, err := findIntentByRequestTx(tx, cmd.UserID, cmd.RequestID); err != nil {
			return err
		} else if found {
			var contract model.UserSubscriptionContract
			if err := subscriptionCommandLock(tx).
				Where("id = ? AND user_id = ?", existing.ContractId, cmd.UserID).
				First(&contract).Error; err != nil {
				return err
			}
			if existing.Kind == model.SubscriptionChangeIntentKindUpgrade &&
				existing.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
				existing.ProviderBindingId > 0 &&
				(existing.Status == model.SubscriptionChangeIntentStatusSyncing ||
					existing.Status == model.SubscriptionChangeIntentStatusAwaitingPayment) {
				var binding model.SubscriptionProviderBinding
				if err := subscriptionCommandLock(tx).
					Where("id = ? AND user_id = ? AND contract_id = ? AND provider = ?",
						existing.ProviderBindingId, cmd.UserID, contract.Id, model.PaymentProviderStripe).
					First(&binding).Error; err != nil {
					return err
				}
				providerSubscriptionID := strings.TrimSpace(binding.ProviderSubscriptionId)
				if providerSubscriptionID == "" {
					return errors.New("Stripe subscription binding is incomplete")
				}
				if strings.TrimSpace(existing.ProviderInvoiceId) != "" {
					upgradeReplayInvoiceID = strings.TrimSpace(existing.ProviderInvoiceId)
					upgradeReplaySubscriptionID = providerSubscriptionID
					result = &ChangePlanResult{
						Status:   ChangePlanStatusPaymentActionRequired,
						Contract: &contract,
						Intent:   existing,
					}
					return nil
				}
				var plan model.SubscriptionPlan
				if err := tx.Where("id = ?", existing.ToPlanId).First(&plan).Error; err != nil {
					return err
				}
				if strings.TrimSpace(plan.StripePriceId) == "" {
					return errors.New("subscription plan Stripe price id is required")
				}
				idempotencyKey := strings.TrimSpace(existing.ProviderIdempotencyKey)
				if idempotencyKey == "" {
					return errors.New("Stripe subscription upgrade idempotency key is required")
				}
				upgradeInput = &StripeSubscriptionUpgradeInput{
					UserID:                     existing.UserId,
					ContractID:                 contract.Id,
					ChangeIntentID:             existing.Id,
					ChangeVersion:              existing.ChangeVersion,
					TargetPlanID:               plan.Id,
					TargetPriceID:              strings.TrimSpace(plan.StripePriceId),
					ProviderSubscriptionID:     providerSubscriptionID,
					ProviderSubscriptionItemID: strings.TrimSpace(binding.ProviderSubscriptionItemId),
					ProviderScheduleID:         strings.TrimSpace(binding.ProviderScheduleId),
					CancelAtPeriodEnd:          binding.CancelAtPeriodEnd,
					IdempotencyKey:             idempotencyKey,
				}
				if upgradeInput.ProviderSubscriptionItemID == "" {
					return errors.New("Stripe subscription binding is incomplete")
				}
				result = &ChangePlanResult{
					Status:   ChangePlanStatusPaymentActionRequired,
					Contract: &contract,
					Intent:   existing,
				}
				return nil
			}
			if existing.Kind == model.SubscriptionChangeIntentKindDowngrade &&
				existing.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
				(existing.Status == model.SubscriptionChangeIntentStatusSyncing || existing.Status == model.SubscriptionChangeIntentStatusScheduled) {
				if existing.Status == model.SubscriptionChangeIntentStatusSyncing {
					var binding model.SubscriptionProviderBinding
					if err := subscriptionCommandLock(tx).
						Where("id = ? AND user_id = ? AND contract_id = ? AND provider = ?",
							existing.ProviderBindingId, cmd.UserID, contract.Id, model.PaymentProviderStripe).
						First(&binding).Error; err != nil {
						return err
					}
					var currentPlan model.SubscriptionPlan
					if err := tx.Where("id = ?", existing.FromPlanId).First(&currentPlan).Error; err != nil {
						return err
					}
					var targetPlan model.SubscriptionPlan
					if err := tx.Where("id = ?", existing.ToPlanId).First(&targetPlan).Error; err != nil {
						return err
					}
					idempotencyKey := strings.TrimSpace(existing.ProviderIdempotencyKey)
					if idempotencyKey == "" {
						idempotencyKey = stripeSubscriptionDowngradeIntentIdempotencyKey(contract.Id, existing.ChangeVersion, existing.ToPlanId, existing.Id)
						if err := tx.Model(existing).Update("provider_idempotency_key", idempotencyKey).Error; err != nil {
							return err
						}
					}
					downgradeInput = &StripeSubscriptionDowngradeInput{
						UserID:                     existing.UserId,
						ContractID:                 contract.Id,
						ChangeIntentID:             existing.Id,
						ChangeVersion:              existing.ChangeVersion,
						CurrentPlanID:              existing.FromPlanId,
						TargetPlanID:               existing.ToPlanId,
						CurrentPriceID:             strings.TrimSpace(currentPlan.StripePriceId),
						TargetPriceID:              strings.TrimSpace(targetPlan.StripePriceId),
						ProviderSubscriptionID:     strings.TrimSpace(binding.ProviderSubscriptionId),
						ProviderSubscriptionItemID: strings.TrimSpace(binding.ProviderSubscriptionItemId),
						ProviderScheduleID:         strings.TrimSpace(binding.ProviderScheduleId),
						CurrentPeriodStart:         binding.CurrentPeriodStart,
						CurrentPeriodEnd:           firstPositiveInt64(existing.EffectiveAt, binding.CurrentPeriodEnd, contract.CurrentPeriodEnd),
						IdempotencyKey:             idempotencyKey,
					}
				}
				result = buildChangePlanResultTx(tx, existing, &contract)
				return nil
			}
			result = buildChangePlanResultTx(tx, existing, &contract)
			if existing.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
				existing.Status == model.SubscriptionChangeIntentStatusAwaitingPayment &&
				strings.TrimSpace(result.CheckoutURL) == "" {
				var order model.SubscriptionOrder
				if err := subscriptionCommandLock(tx).
					Where("change_intent_id = ? AND payment_provider = ?", existing.Id, model.PaymentProviderStripe).
					Order("id desc").
					First(&order).Error; err != nil {
					return err
				}
				if strings.TrimSpace(order.ProviderSessionId) != "" {
					return nil
				}
				var plan model.SubscriptionPlan
				if err := tx.Where("id = ?", existing.ToPlanId).First(&plan).Error; err != nil {
					return err
				}
				if strings.TrimSpace(existing.ProviderIdempotencyKey) == "" {
					existing.ProviderIdempotencyKey = stripeSubscriptionCheckoutIdempotencyKey(contract.Id, existing.ChangeVersion, existing.Id)
					if err := tx.Model(existing).Update("provider_idempotency_key", existing.ProviderIdempotencyKey).Error; err != nil {
						return err
					}
				}
				checkoutInput = &StripeSubscriptionCheckoutInput{
					TradeNo:        order.TradeNo,
					UserID:         user.Id,
					PlanID:         plan.Id,
					ContractID:     contract.Id,
					ChangeIntentID: existing.Id,
					CustomerID:     strings.TrimSpace(user.StripeCustomer),
					Email:          strings.TrimSpace(user.Email),
					PriceID:        strings.TrimSpace(plan.StripePriceId),
					IdempotencyKey: existing.ProviderIdempotencyKey,
					Presentation:   ResolveStripeCheckoutPresentation(cmd.UIMode),
				}
			}
			return nil
		}
		if common.SubscriptionSingleContractEnabled {
			migration, err := auditLegacySubscriptionForUserTx(tx, cmd.UserID)
			if err != nil {
				return err
			}
			if IsLegacySubscriptionMigrationBlocking(migration.Classification) {
				return ErrSubscriptionMigrationRequiresAdmin
			}
		}

		if err := validateChangePaymentMode(cmd.PaymentMode); err != nil {
			return err
		}

		contract, err := getOrCreateContractForUserTx(tx, cmd.UserID)
		if err != nil {
			return err
		}

		plan, err := loadEnabledSubscriptionPlanTx(tx, cmd.PlanID)
		if err != nil {
			return err
		}
		kind, err := classifyPlanChangeTx(tx, contract, plan)
		if err != nil {
			return err
		}
		if kind != model.SubscriptionChangeIntentKindDowngrade {
			if cmd.PaymentMode == model.SubscriptionPaymentModeBalanceOnePeriod && plan.AllowBalancePay != nil && !*plan.AllowBalancePay {
				return errors.New("subscription plan does not allow balance payment")
			}
			if err := enforceMaxPurchasePerUserTx(tx, cmd.UserID, plan); err != nil {
				return err
			}
		}
		if err := rejectUnresolvedPlanChangeTx(tx, cmd.UserID, kind == model.SubscriptionChangeIntentKindDowngrade); err != nil {
			return err
		}
		if kind == model.SubscriptionChangeIntentKindDowngrade && !canScheduleSubscriptionDowngrade(contract) {
			return ErrSubscriptionDowngradeUnsupported
		}

		intentPaymentMode := cmd.PaymentMode
		if kind == model.SubscriptionChangeIntentKindDowngrade {
			intentPaymentMode = model.SubscriptionPaymentModeStripeRecurring
		}
		intent := &model.SubscriptionChangeIntent{
			ContractId:    contract.Id,
			UserId:        cmd.UserID,
			RequestId:     cmd.RequestID,
			ChangeVersion: contract.ChangeVersion + 1,
			Kind:          kind,
			PaymentMode:   intentPaymentMode,
			Status:        model.SubscriptionChangeIntentStatusCreated,
			FromPlanId:    contract.CurrentPlanId,
			ToPlanId:      plan.Id,
			EffectiveAt:   common.GetTimestamp(),
		}
		if err := tx.Create(intent).Error; err != nil {
			return err
		}
		if len(supersededCheckouts) > 0 {
			var ids []int64
			for _, superseded := range supersededCheckouts {
				if superseded.IntentID > 0 {
					ids = append(ids, superseded.IntentID)
				}
			}
			if len(ids) > 0 {
				if err := tx.Model(&model.SubscriptionChangeIntent{}).
					Where("id IN ? AND status = ?", ids, model.SubscriptionChangeIntentStatusSuperseded).
					Update("superseded_by_id", intent.Id).Error; err != nil {
					return err
				}
			}
		}
		if err := tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).
			Update("latest_change_intent_id", intent.Id).Error; err != nil {
			return err
		}
		contract.LatestChangeIntentId = intent.Id

		switch cmd.PaymentMode {
		case model.SubscriptionPaymentModeBalanceOnePeriod:
			if kind == model.SubscriptionChangeIntentKindDowngrade {
				input, err := prepareStripeSubscriptionDowngradeTx(tx, cmd.UserID, contract, intent, plan)
				if err != nil {
					return err
				}
				downgradeInput = input
				result = &ChangePlanResult{
					Status:   ChangePlanStatusScheduled,
					Contract: contract,
					Intent:   intent,
				}
				return nil
			}
			if kind == model.SubscriptionChangeIntentKindUpgrade &&
				contract.Status == model.SubscriptionContractStatusActive &&
				contract.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
				contract.CurrentProviderBindingId > 0 {
				result = &ChangePlanResult{
					Status:   ChangePlanStatusCheckoutRequired,
					Contract: contract,
					Intent:   intent,
				}
				return prepareStripeToBalanceCompensationTx(tx, &user, contract, intent, plan)
			}
			effects, err := applyBalanceOnePeriodChangeTx(tx, &user, contract, intent, plan)
			if err != nil {
				return err
			}
			balanceEffects = effects
			result = &ChangePlanResult{
				Status:   ChangePlanStatusApplied,
				Contract: contract,
				Intent:   intent,
			}
			return nil
		case model.SubscriptionPaymentModeStripeRecurring:
			if kind == model.SubscriptionChangeIntentKindDowngrade {
				input, err := prepareStripeSubscriptionDowngradeTx(tx, cmd.UserID, contract, intent, plan)
				if err != nil {
					return err
				}
				downgradeInput = input
				result = &ChangePlanResult{
					Status:   ChangePlanStatusScheduled,
					Contract: contract,
					Intent:   intent,
				}
				return nil
			}
			if kind == model.SubscriptionChangeIntentKindUpgrade {
				if strings.TrimSpace(plan.StripePriceId) == "" {
					return errors.New("subscription plan Stripe price id is required")
				}
				if contract.PaymentMode == model.SubscriptionPaymentModeStripeRecurring && contract.CurrentProviderBindingId > 0 {
					var binding model.SubscriptionProviderBinding
					if err := subscriptionCommandLock(tx).
						Where("id = ? AND user_id = ? AND contract_id = ? AND provider = ?",
							contract.CurrentProviderBindingId, cmd.UserID, contract.Id, model.PaymentProviderStripe).
						First(&binding).Error; err != nil {
						return err
					}
					if strings.TrimSpace(binding.ProviderSubscriptionId) == "" || strings.TrimSpace(binding.ProviderSubscriptionItemId) == "" {
						return errors.New("Stripe subscription binding is incomplete")
					}
					intent.Status = model.SubscriptionChangeIntentStatusSyncing
					intent.ProviderBindingId = binding.Id
					idempotencyKey := stripeSubscriptionUpgradeIntentIdempotencyKey(contract.Id, intent.ChangeVersion, plan.Id, intent.Id)
					if err := tx.Model(intent).Updates(map[string]interface{}{
						"status":                   intent.Status,
						"provider_binding_id":      intent.ProviderBindingId,
						"provider_idempotency_key": idempotencyKey,
						"updated_at":               common.GetTimestamp(),
					}).Error; err != nil {
						return err
					}
					intent.ProviderIdempotencyKey = idempotencyKey
					upgradeInput = &StripeSubscriptionUpgradeInput{
						ContractID:                 contract.Id,
						ChangeVersion:              intent.ChangeVersion,
						TargetPlanID:               plan.Id,
						TargetPriceID:              strings.TrimSpace(plan.StripePriceId),
						ProviderSubscriptionID:     binding.ProviderSubscriptionId,
						ProviderSubscriptionItemID: binding.ProviderSubscriptionItemId,
						ProviderScheduleID:         binding.ProviderScheduleId,
						CancelAtPeriodEnd:          binding.CancelAtPeriodEnd,
						IdempotencyKey:             idempotencyKey,
					}
					result = &ChangePlanResult{
						Status:   ChangePlanStatusPaymentActionRequired,
						Contract: contract,
						Intent:   intent,
					}
					return nil
				}
				if contract.Status != model.SubscriptionContractStatusActive ||
					contract.CurrentProviderBindingId != 0 ||
					(contract.PaymentMode != model.SubscriptionPaymentModeBalanceOnePeriod &&
						contract.PaymentMode != model.SubscriptionPaymentModeExternalOnePeriod) {
					return errors.New("current subscription is not Stripe recurring")
				}
				input, err := prepareStripeSubscriptionCheckoutPaymentTx(tx, &user, contract, intent, plan)
				if err != nil {
					return err
				}
				input.Presentation = ResolveStripeCheckoutPresentation(cmd.UIMode)
				checkoutInput = input
				result = &ChangePlanResult{
					Status:   ChangePlanStatusCheckoutRequired,
					Contract: contract,
					Intent:   intent,
				}
				return nil
			}
			if kind != model.SubscriptionChangeIntentKindPurchase {
				return ErrStripeCheckoutPendingMigration
			}
			if strings.TrimSpace(plan.StripePriceId) == "" {
				return errors.New("subscription plan Stripe price id is required")
			}
			input, err := prepareStripeSubscriptionCheckoutPaymentTx(tx, &user, contract, intent, plan)
			if err != nil {
				return err
			}
			input.Presentation = ResolveStripeCheckoutPresentation(cmd.UIMode)
			checkoutInput = input
			result = &ChangePlanResult{
				Status:   ChangePlanStatusCheckoutRequired,
				Contract: contract,
				Intent:   intent,
			}
			return nil
		default:
			return errors.New("unsupported subscription payment mode")
		}
	})
	if err != nil {
		return nil, err
	}
	for _, superseded := range supersededCheckouts {
		if strings.TrimSpace(superseded.TradeNo) != "" {
			if err := model.SyncSubscriptionOrderTopUpHistory(superseded.TradeNo); err != nil {
				return nil, err
			}
		}
	}
	if upgradeReplayInvoiceID != "" {
		invoice, err := stripeInvoiceGetter(context.Background(), upgradeReplayInvoiceID)
		if err != nil {
			return nil, err
		}
		if invoice == nil || strings.TrimSpace(invoice.ID) != upgradeReplayInvoiceID {
			return nil, errors.New("Stripe upgrade invoice could not be authenticated")
		}
		if stripeInvoiceSubscriptionID(invoice) != upgradeReplaySubscriptionID {
			return nil, errors.New("Stripe upgrade invoice subscription mismatch")
		}
		if stripeInvoiceIsPaid(invoice) {
			if _, err := ReconcilePaidInvoice(context.Background(), upgradeReplayInvoiceID); err != nil {
				return nil, err
			}
			if err := model.DB.Where("id = ?", result.Intent.Id).First(result.Intent).Error; err != nil {
				return nil, err
			}
			if err := model.DB.Where("id = ?", result.Contract.Id).First(result.Contract).Error; err != nil {
				return nil, err
			}
			result.Status = changePlanResultStatus(result.Intent.Status)
		} else {
			hostedInvoiceURL := strings.TrimSpace(invoice.HostedInvoiceURL)
			if hostedInvoiceURL == "" {
				return nil, errors.New("Stripe upgrade hosted invoice url is missing")
			}
			if result.Intent.Status == model.SubscriptionChangeIntentStatusSyncing {
				update := model.DB.Model(&model.SubscriptionChangeIntent{}).
					Where("id = ? AND status = ?", result.Intent.Id, model.SubscriptionChangeIntentStatusSyncing).
					Updates(map[string]interface{}{
						"status":     model.SubscriptionChangeIntentStatusAwaitingPayment,
						"updated_at": common.GetTimestamp(),
					})
				if update.Error != nil {
					return nil, update.Error
				}
				if err := model.DB.Where("id = ?", result.Intent.Id).First(result.Intent).Error; err != nil {
					return nil, err
				}
				if result.Intent.Status != model.SubscriptionChangeIntentStatusAwaitingPayment {
					if err := model.DB.Where("id = ?", result.Contract.Id).First(result.Contract).Error; err != nil {
						return nil, err
					}
					result.Status = changePlanResultStatus(result.Intent.Status)
					return result, nil
				}
			}
			result.Status = ChangePlanStatusPaymentActionRequired
			result.HostedInvoiceURL = hostedInvoiceURL
		}
	}
	if checkoutInput != nil {
		checkout, err := stripeSubscriptionCheckoutCreator(context.Background(), *checkoutInput)
		if err != nil {
			_ = TerminatePendingStripePurchase(context.Background(), checkoutInput.TradeNo, model.SubscriptionChangeIntentStatusFailed)
			return nil, err
		}
		if err := persistStripeCheckoutSession(checkoutInput.ChangeIntentID, checkout.ID, checkout.URL); err != nil {
			return nil, err
		}
		result.CheckoutURL = checkout.URL
		result.ClientSecret = checkout.ClientSecret
	} else if result != nil && result.Status == ChangePlanStatusCheckoutRequired && result.Intent != nil &&
		result.Intent.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
		strings.TrimSpace(result.CheckoutURL) == "" {
		if err := hydrateStripeCheckoutSessionResult(context.Background(), result); err != nil {
			return nil, err
		}
	}
	if upgradeInput != nil {
		upgrade, err := stripeSubscriptionUpgradeExecutor(context.Background(), *upgradeInput)
		if err != nil {
			_ = markStripeSubscriptionUpgradeFailed(result.Intent.Id, err)
			return nil, err
		}
		if err := persistStripeSubscriptionUpgradeResult(result.Intent.Id, upgrade); err != nil {
			return nil, err
		}
		if err := model.DB.Where("id = ?", result.Intent.Id).First(result.Intent).Error; err != nil {
			return nil, err
		}
		if err := model.DB.Where("id = ?", result.Contract.Id).First(result.Contract).Error; err != nil {
			return nil, err
		}
		result.Status = ChangePlanStatusPaymentActionRequired
		result.HostedInvoiceURL = upgrade.HostedInvoiceURL
	}
	if downgradeInput != nil {
		downgrade, err := stripeSubscriptionDowngradeExecutor(context.Background(), *downgradeInput)
		if err != nil {
			_ = markStripeSubscriptionDowngradeFailed(result.Intent.Id, err)
			return nil, err
		}
		if err := persistStripeSubscriptionDowngradeResult(result.Intent.Id, downgrade); err != nil {
			return nil, err
		}
		if err := model.DB.Where("id = ?", downgrade.ChangeIntentID).First(result.Intent).Error; err != nil {
			return nil, err
		}
		if err := model.DB.Where("id = ?", result.Contract.Id).First(result.Contract).Error; err != nil {
			return nil, err
		}
		result.Status = ChangePlanStatusScheduled
	}
	if result != nil && result.Intent != nil &&
		result.Intent.PaymentMode == model.SubscriptionPaymentModeBalanceOnePeriod &&
		result.Intent.Kind == model.SubscriptionChangeIntentKindUpgrade &&
		(result.Intent.Status == model.SubscriptionChangeIntentStatusSyncing ||
			result.Intent.Status == model.SubscriptionChangeIntentStatusCompensationRequired) {
		if err := executeStripeToBalanceCompensation(context.Background(), result.Intent.Id); err != nil {
			return nil, err
		}
		if err := model.DB.Where("id = ?", result.Intent.Id).First(result.Intent).Error; err != nil {
			return nil, err
		}
		if err := model.DB.Where("id = ?", result.Contract.Id).First(result.Contract).Error; err != nil {
			return nil, err
		}
		result.Status = changePlanResultStatus(result.Intent.Status)
	}
	applyBalanceOnePeriodSideEffects(balanceEffects)
	return result, nil
}

func (cmd *ChangePlanCommand) normalize() {
	cmd.PaymentMode = strings.TrimSpace(cmd.PaymentMode)
	cmd.RequestID = strings.TrimSpace(cmd.RequestID)
	cmd.UIMode = strings.ToLower(strings.TrimSpace(cmd.UIMode))
}

func (cmd ChangePlanCommand) validate() error {
	if cmd.UserID <= 0 {
		return errors.New("invalid user id")
	}
	if cmd.PlanID <= 0 {
		return errors.New("invalid plan id")
	}
	if cmd.RequestID == "" {
		return errors.New("request_id is required")
	}
	return nil
}

func validateChangePaymentMode(paymentMode string) error {
	switch paymentMode {
	case model.SubscriptionPaymentModeBalanceOnePeriod, model.SubscriptionPaymentModeStripeRecurring:
		return nil
	default:
		return errors.New("payment_mode is required")
	}
}

func subscriptionCommandLock(tx *gorm.DB) *gorm.DB {
	if common.UsingSQLite {
		return tx
	}
	return tx.Clauses(clause.Locking{Strength: "UPDATE"})
}

func loadEnabledSubscriptionPlanTx(tx *gorm.DB, planID int) (*model.SubscriptionPlan, error) {
	var plan model.SubscriptionPlan
	if err := tx.Where("id = ?", planID).First(&plan).Error; err != nil {
		return nil, err
	}
	plan.NormalizeDefaults()
	if !plan.Enabled {
		return nil, errors.New("subscription plan is disabled")
	}
	if plan.PriceAmount < 0 {
		return nil, errors.New("subscription plan price cannot be negative")
	}
	if plan.TierRank == nil || *plan.TierRank <= 0 {
		return nil, errors.New("subscription plan tier rank is required")
	}
	return &plan, nil
}

func enforceMaxPurchasePerUserTx(tx *gorm.DB, userID int, plan *model.SubscriptionPlan) error {
	if plan == nil || plan.MaxPurchasePerUser <= 0 {
		return nil
	}
	var count int64
	if err := tx.Model(&model.UserSubscription{}).
		Where("user_id = ? AND plan_id = ?", userID, plan.Id).
		Count(&count).Error; err != nil {
		return err
	}
	if count >= int64(plan.MaxPurchasePerUser) {
		return errors.New("subscription plan purchase limit reached")
	}
	return nil
}

func getOrCreateContractForUserTx(tx *gorm.DB, userID int) (*model.UserSubscriptionContract, error) {
	var contract model.UserSubscriptionContract
	query := subscriptionCommandLock(tx).Where("user_id = ?", userID).Limit(1).Find(&contract)
	if query.Error != nil {
		return nil, query.Error
	}
	if query.RowsAffected > 0 {
		return &contract, nil
	}
	contract = model.UserSubscriptionContract{
		UserId:      userID,
		Status:      model.SubscriptionContractStatusEnded,
		PaymentMode: model.SubscriptionPaymentModeExternalOnePeriod,
	}
	if err := tx.Create(&contract).Error; err != nil {
		return nil, err
	}
	if err := subscriptionCommandLock(tx).Where("id = ?", contract.Id).First(&contract).Error; err != nil {
		return nil, err
	}
	return &contract, nil
}

func findIntentByRequestTx(tx *gorm.DB, userID int, requestID string) (*model.SubscriptionChangeIntent, bool, error) {
	var intent model.SubscriptionChangeIntent
	query := tx.Where("user_id = ? AND request_id = ?", userID, requestID).Limit(1).Find(&intent)
	if query.Error != nil {
		return nil, false, query.Error
	}
	if query.RowsAffected == 0 {
		return nil, false, nil
	}
	return &intent, true, nil
}

func rejectUnresolvedPlanChangeTx(tx *gorm.DB, userID int, allowDowngradeReplacement ...bool) error {
	allowDowngrade := len(allowDowngradeReplacement) > 0 && allowDowngradeReplacement[0]
	kinds := []string{
		model.SubscriptionChangeIntentKindPurchase,
		model.SubscriptionChangeIntentKindUpgrade,
		model.SubscriptionChangeIntentKindDowngrade,
	}
	if allowDowngrade {
		kinds = []string{
			model.SubscriptionChangeIntentKindPurchase,
			model.SubscriptionChangeIntentKindUpgrade,
		}
	}
	var count int64
	err := tx.Model(&model.SubscriptionChangeIntent{}).
		Where("user_id = ? AND kind IN ? AND status IN ?",
			userID,
			kinds,
			[]string{
				model.SubscriptionChangeIntentStatusCreated,
				model.SubscriptionChangeIntentStatusSyncing,
				model.SubscriptionChangeIntentStatusAwaitingPayment,
				model.SubscriptionChangeIntentStatusScheduled,
				model.SubscriptionChangeIntentStatusCompensationRequired,
			},
		).
		Count(&count).Error
	if err != nil {
		return err
	}
	if count > 0 {
		return ErrSubscriptionChangeInProgress
	}
	return nil
}

func canScheduleSubscriptionDowngrade(contract *model.UserSubscriptionContract) bool {
	return contract != nil &&
		contract.Status == model.SubscriptionContractStatusActive &&
		contract.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
		contract.CurrentProviderBindingId > 0
}

func prepareStripeSubscriptionDowngradeTx(tx *gorm.DB, userID int, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent, targetPlan *model.SubscriptionPlan) (*StripeSubscriptionDowngradeInput, error) {
	if tx == nil || contract == nil || intent == nil || targetPlan == nil {
		return nil, errors.New("subscription downgrade facts are incomplete")
	}
	if contract.Status != model.SubscriptionContractStatusActive || contract.PaymentMode != model.SubscriptionPaymentModeStripeRecurring || contract.CurrentProviderBindingId <= 0 {
		if contract.PaymentMode == model.SubscriptionPaymentModeBalanceOnePeriod || contract.PaymentMode == model.SubscriptionPaymentModeExternalOnePeriod {
			return nil, ErrSubscriptionDowngradeUnsupported
		}
		return nil, errors.New("current subscription is not active Stripe recurring")
	}
	if strings.TrimSpace(targetPlan.StripePriceId) == "" {
		return nil, errors.New("subscription plan Stripe price id is required")
	}
	var binding model.SubscriptionProviderBinding
	if err := subscriptionCommandLock(tx).
		Where("id = ? AND user_id = ? AND contract_id = ? AND provider = ?",
			contract.CurrentProviderBindingId, userID, contract.Id, model.PaymentProviderStripe).
		First(&binding).Error; err != nil {
		return nil, err
	}
	if strings.TrimSpace(binding.ProviderSubscriptionId) == "" || strings.TrimSpace(binding.ProviderSubscriptionItemId) == "" {
		return nil, errors.New("Stripe subscription binding is incomplete")
	}
	if isTerminalStripeSubscriptionStatus(binding.ProviderStatus) || binding.EndedAt > 0 {
		return nil, errors.New("current subscription is not active Stripe recurring")
	}
	var currentPlan model.SubscriptionPlan
	if err := tx.Where("id = ?", contract.CurrentPlanId).First(&currentPlan).Error; err != nil {
		return nil, err
	}
	currentPlan.NormalizeDefaults()
	if strings.TrimSpace(currentPlan.StripePriceId) == "" || strings.TrimSpace(binding.ProviderPriceId) == "" {
		return nil, errors.New("current Stripe price id is required")
	}
	idempotencyKey := stripeSubscriptionDowngradeIntentIdempotencyKey(contract.Id, intent.ChangeVersion, targetPlan.Id, intent.Id)
	now := common.GetTimestamp()
	if err := tx.Model(&model.SubscriptionChangeIntent{}).
		Where("contract_id = ? AND kind = ? AND status IN ? AND id <> ?",
			contract.Id,
			model.SubscriptionChangeIntentKindDowngrade,
			[]string{model.SubscriptionChangeIntentStatusCreated, model.SubscriptionChangeIntentStatusSyncing, model.SubscriptionChangeIntentStatusScheduled},
			intent.Id,
		).
		Updates(map[string]interface{}{
			"status":           model.SubscriptionChangeIntentStatusSuperseded,
			"superseded_by_id": intent.Id,
			"updated_at":       now,
		}).Error; err != nil {
		return nil, err
	}
	intent.Status = model.SubscriptionChangeIntentStatusSyncing
	intent.PaymentMode = model.SubscriptionPaymentModeStripeRecurring
	intent.ProviderBindingId = binding.Id
	intent.ProviderIdempotencyKey = idempotencyKey
	intent.EffectiveAt = firstPositiveInt64(binding.CurrentPeriodEnd, contract.CurrentPeriodEnd)
	if intent.EffectiveAt <= 0 {
		return nil, errors.New("current period end is required")
	}
	if err := tx.Model(intent).Updates(map[string]interface{}{
		"status":                   intent.Status,
		"payment_mode":             intent.PaymentMode,
		"provider_binding_id":      intent.ProviderBindingId,
		"provider_idempotency_key": idempotencyKey,
		"effective_at":             intent.EffectiveAt,
		"updated_at":               now,
	}).Error; err != nil {
		return nil, err
	}
	if err := tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"latest_change_intent_id": intent.Id,
		"pending_plan_id":         targetPlan.Id,
		"pending_effective_at":    intent.EffectiveAt,
		"change_version":          intent.ChangeVersion,
		"updated_at":              now,
	}).Error; err != nil {
		return nil, err
	}
	contract.LatestChangeIntentId = intent.Id
	contract.PendingPlanId = targetPlan.Id
	contract.PendingEffectiveAt = intent.EffectiveAt
	contract.ChangeVersion = intent.ChangeVersion
	return &StripeSubscriptionDowngradeInput{
		UserID:                     userID,
		ContractID:                 contract.Id,
		ChangeIntentID:             intent.Id,
		ChangeVersion:              intent.ChangeVersion,
		CurrentPlanID:              contract.CurrentPlanId,
		TargetPlanID:               targetPlan.Id,
		CurrentPriceID:             firstNonEmptyString(binding.ProviderPriceId, currentPlan.StripePriceId),
		TargetPriceID:              strings.TrimSpace(targetPlan.StripePriceId),
		ProviderSubscriptionID:     strings.TrimSpace(binding.ProviderSubscriptionId),
		ProviderSubscriptionItemID: strings.TrimSpace(binding.ProviderSubscriptionItemId),
		ProviderScheduleID:         strings.TrimSpace(binding.ProviderScheduleId),
		CurrentPeriodStart:         firstPositiveInt64(binding.CurrentPeriodStart, contract.CurrentPeriodStart),
		CurrentPeriodEnd:           intent.EffectiveAt,
		IdempotencyKey:             idempotencyKey,
	}, nil
}

func classifyPlanChangeTx(tx *gorm.DB, contract *model.UserSubscriptionContract, target *model.SubscriptionPlan) (string, error) {
	if contract.CurrentPlanId <= 0 {
		return model.SubscriptionChangeIntentKindPurchase, nil
	}
	if contract.CurrentPlanId == target.Id {
		return "", ErrSubscriptionPlanUnchanged
	}
	var current model.SubscriptionPlan
	if err := tx.Where("id = ?", contract.CurrentPlanId).First(&current).Error; err != nil {
		return "", err
	}
	if current.TierRank == nil || *current.TierRank <= 0 {
		return "", errors.New("current subscription plan tier rank is required")
	}
	if *current.TierRank == *target.TierRank {
		return "", ErrSubscriptionPlanUnchanged
	}
	if *target.TierRank > *current.TierRank {
		return model.SubscriptionChangeIntentKindUpgrade, nil
	}
	return model.SubscriptionChangeIntentKindDowngrade, nil
}

type balanceOnePeriodSideEffects struct {
	userID       int
	planTitle    string
	money        float64
	chargedQuota int
}

func applyBalanceOnePeriodChangeTx(tx *gorm.DB, user *model.User, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent, plan *model.SubscriptionPlan) (*balanceOnePeriodSideEffects, error) {
	requiredQuota, err := subscriptionBalanceQuota(plan.PriceAmount)
	if err != nil {
		return nil, err
	}
	if requiredQuota > 0 && user.Quota < requiredQuota {
		return nil, errors.New("insufficient balance")
	}
	if requiredQuota > 0 {
		if err := tx.Model(&model.User{}).Where("id = ?", user.Id).
			Update("quota", gorm.Expr("quota - ?", requiredQuota)).Error; err != nil {
			return nil, err
		}
	}

	now := common.GetTimestamp()
	tradeNo := fmt.Sprintf("SUBCONUSR%dINT%dNO%s%d", user.Id, intent.Id, common.GetRandomString(6), time.Now().UnixNano())
	order := &model.SubscriptionOrder{
		UserId:          user.Id,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodBalance,
		PaymentProvider: model.PaymentProviderBalance,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      now,
		CompleteTime:    now,
		ProviderPayload: fmt.Sprintf("charged_quota=%d;change_intent_id=%d", requiredQuota, intent.Id),
	}
	if err := tx.Create(order).Error; err != nil {
		return nil, err
	}

	periodStart := common.GetTimestamp()
	periodEnd, err := subscriptionPlanPeriodEnd(periodStart, plan)
	if err != nil {
		return nil, err
	}
	grant, err := model.RotateCurrentEntitlementTx(tx, model.GrantEntitlementInput{
		ContractId:           contract.Id,
		UserId:               user.Id,
		PlanId:               plan.Id,
		ProviderBindingId:    0,
		GrantKey:             "balance:" + tradeNo,
		PaymentMode:          model.SubscriptionPaymentModeBalanceOnePeriod,
		AmountTotal:          plan.TotalAmount,
		PeriodStart:          periodStart,
		PeriodEnd:            periodEnd,
		EndReasonForPrevious: previousEntitlementEndReason(intent.Kind),
		Source:               model.PaymentMethodBalance,
	})
	if err != nil {
		return nil, err
	}

	intent.Status = model.SubscriptionChangeIntentStatusApplied
	intent.WalletDebitTradeNo = tradeNo
	intent.EffectiveAt = periodStart
	if err := tx.Model(intent).Updates(map[string]interface{}{
		"status":                intent.Status,
		"wallet_debit_trade_no": intent.WalletDebitTradeNo,
		"effective_at":          intent.EffectiveAt,
		"updated_at":            common.GetTimestamp(),
	}).Error; err != nil {
		return nil, err
	}
	if err := tx.Where("id = ?", contract.Id).First(contract).Error; err != nil {
		return nil, err
	}
	if grant != nil && grant.Entitlement != nil {
		contract.CurrentEntitlementId = grant.Entitlement.Id
	}
	return &balanceOnePeriodSideEffects{
		userID:       user.Id,
		planTitle:    plan.Title,
		money:        plan.PriceAmount,
		chargedQuota: requiredQuota,
	}, nil
}

func applyBalanceOnePeriodSideEffects(effects *balanceOnePeriodSideEffects) {
	if effects == nil || effects.userID <= 0 {
		return
	}
	if err := model.InvalidateUserCache(effects.userID); err != nil {
		common.SysLog("failed to invalidate user cache after subscription balance purchase: " + err.Error())
	}
	model.RecordLog(
		effects.userID,
		model.LogTypeTopup,
		fmt.Sprintf("Subscription balance purchase succeeded, plan: %s, amount: %.2f, charged quota: %d", effects.planTitle, effects.money, effects.chargedQuota),
	)
}

func subscriptionBalanceQuota(priceAmount float64) (int, error) {
	if priceAmount <= 0 {
		return 0, nil
	}
	if common.QuotaPerUnit <= 0 {
		return 0, errors.New("quota unit is invalid")
	}
	quota := decimal.NewFromFloat(priceAmount).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Ceil().
		IntPart()
	return int(quota), nil
}

func subscriptionPlanPeriodEnd(startUnix int64, plan *model.SubscriptionPlan) (int64, error) {
	if plan == nil {
		return 0, errors.New("plan is nil")
	}
	start := time.Unix(startUnix, 0)
	if plan.DurationValue <= 0 && plan.DurationUnit != model.SubscriptionDurationCustom {
		return 0, errors.New("duration_value must be > 0")
	}
	switch plan.DurationUnit {
	case model.SubscriptionDurationYear:
		return start.AddDate(plan.DurationValue, 0, 0).Unix(), nil
	case model.SubscriptionDurationMonth:
		return start.AddDate(0, plan.DurationValue, 0).Unix(), nil
	case model.SubscriptionDurationDay:
		return start.Add(time.Duration(plan.DurationValue) * 24 * time.Hour).Unix(), nil
	case model.SubscriptionDurationHour:
		return start.Add(time.Duration(plan.DurationValue) * time.Hour).Unix(), nil
	case model.SubscriptionDurationCustom:
		if plan.CustomSeconds <= 0 {
			return 0, errors.New("custom_seconds must be > 0")
		}
		return start.Add(time.Duration(plan.CustomSeconds) * time.Second).Unix(), nil
	default:
		return 0, fmt.Errorf("invalid duration_unit: %s", plan.DurationUnit)
	}
}

func previousEntitlementEndReason(kind string) string {
	switch kind {
	case model.SubscriptionChangeIntentKindUpgrade:
		return model.SubscriptionEntitlementEndReasonUpgraded
	default:
		return model.SubscriptionEntitlementEndReasonRenewed
	}
}

func buildChangePlanResult(intent *model.SubscriptionChangeIntent, contract *model.UserSubscriptionContract) *ChangePlanResult {
	return buildChangePlanResultTx(model.DB, intent, contract)
}

func buildChangePlanResultTx(tx *gorm.DB, intent *model.SubscriptionChangeIntent, contract *model.UserSubscriptionContract) *ChangePlanResult {
	status := changePlanResultStatus(intent.Status)
	result := &ChangePlanResult{
		Status:   status,
		Contract: contract,
		Intent:   intent,
	}
	if tx != nil && intent != nil && intent.PaymentMode == model.SubscriptionPaymentModeStripeRecurring && status == ChangePlanStatusCheckoutRequired {
		var order model.SubscriptionOrder
		query := tx.Where("change_intent_id = ? AND payment_provider = ?", intent.Id, model.PaymentProviderStripe).
			Order("id desc").
			Limit(1).
			Find(&order)
		if query.Error == nil && query.RowsAffected > 0 {
			result.CheckoutURL = strings.TrimSpace(order.ProviderSessionURL)
		}
	}
	return result
}

func hydrateStripeCheckoutSessionResult(ctx context.Context, result *ChangePlanResult) error {
	if result == nil || result.Intent == nil || result.Intent.Id <= 0 {
		return nil
	}
	var order model.SubscriptionOrder
	query := model.DB.Where("change_intent_id = ? AND payment_provider = ?", result.Intent.Id, model.PaymentProviderStripe).
		Order("id desc").
		Limit(1).
		Find(&order)
	if query.Error != nil {
		return query.Error
	}
	if query.RowsAffected == 0 || strings.TrimSpace(order.ProviderSessionId) == "" {
		return nil
	}
	checkoutSession, err := stripeCheckoutSessionGetter(ctx, order.ProviderSessionId)
	if err != nil {
		return err
	}
	if checkoutSession == nil || strings.TrimSpace(checkoutSession.ID) != strings.TrimSpace(order.ProviderSessionId) {
		return errors.New("Stripe checkout session could not be authenticated")
	}
	if strings.TrimSpace(checkoutSession.URL) != "" {
		result.CheckoutURL = strings.TrimSpace(checkoutSession.URL)
	}
	if strings.TrimSpace(result.CheckoutURL) == "" {
		result.CheckoutURL = strings.TrimSpace(order.ProviderSessionURL)
	}
	result.ClientSecret = strings.TrimSpace(checkoutSession.ClientSecret)
	if strings.TrimSpace(result.CheckoutURL) == "" && result.ClientSecret == "" {
		return errors.New("Stripe checkout session missing url or client secret")
	}
	return nil
}

func changePlanResultStatus(intentStatus string) string {
	switch intentStatus {
	case model.SubscriptionChangeIntentStatusApplied:
		return ChangePlanStatusApplied
	case model.SubscriptionChangeIntentStatusScheduled:
		return ChangePlanStatusScheduled
	case model.SubscriptionChangeIntentStatusAwaitingPayment, model.SubscriptionChangeIntentStatusSyncing:
		return ChangePlanStatusCheckoutRequired
	default:
		return intentStatus
	}
}

func stripeSubscriptionCheckoutIdempotencyKey(contractID int64, changeVersion int64, intentID int64) string {
	return fmt.Sprintf("newapi:stripe-subscription-checkout:contract:%d:version:%d:intent:%d", contractID, changeVersion, intentID)
}

func prepareStripeSubscriptionCheckoutPaymentTx(tx *gorm.DB, user *model.User, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent, plan *model.SubscriptionPlan) (*StripeSubscriptionCheckoutInput, error) {
	if tx == nil || user == nil || contract == nil || intent == nil || plan == nil {
		return nil, errors.New("Stripe checkout facts are incomplete")
	}
	intent.Status = model.SubscriptionChangeIntentStatusAwaitingPayment
	tradeNo := fmt.Sprintf("SUBSTRUSR%dINT%dNO%s%d", user.Id, intent.Id, common.GetRandomString(6), time.Now().UnixNano())
	idempotencyKey := stripeSubscriptionCheckoutIdempotencyKey(contract.Id, intent.ChangeVersion, intent.Id)
	if err := tx.Model(intent).Updates(map[string]interface{}{
		"status":                   intent.Status,
		"provider_idempotency_key": idempotencyKey,
		"updated_at":               common.GetTimestamp(),
	}).Error; err != nil {
		return nil, err
	}
	intent.ProviderIdempotencyKey = idempotencyKey
	order := &model.SubscriptionOrder{
		UserId:          user.Id,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
		CreateTime:      common.GetTimestamp(),
		ProviderPayload: fmt.Sprintf("change_intent_id=%d", intent.Id),
		ChangeIntentId:  intent.Id,
	}
	if err := tx.Create(order).Error; err != nil {
		return nil, err
	}
	return &StripeSubscriptionCheckoutInput{
		TradeNo:        tradeNo,
		UserID:         user.Id,
		PlanID:         plan.Id,
		ContractID:     contract.Id,
		ChangeIntentID: intent.Id,
		CustomerID:     strings.TrimSpace(user.StripeCustomer),
		Email:          strings.TrimSpace(user.Email),
		PriceID:        strings.TrimSpace(plan.StripePriceId),
		IdempotencyKey: idempotencyKey,
		Presentation:   ResolveStripeCheckoutPresentation(""),
	}, nil
}

func persistStripeCheckoutSession(intentID int64, sessionID string, sessionURL string) error {
	if intentID <= 0 {
		return errors.New("invalid change intent id")
	}
	sessionID = strings.TrimSpace(sessionID)
	sessionURL = strings.TrimSpace(sessionURL)
	if sessionID == "" {
		return errors.New("Stripe checkout session id is required")
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var order model.SubscriptionOrder
		if err := subscriptionCommandLock(tx).
			Where("change_intent_id = ? AND payment_provider = ?", intentID, model.PaymentProviderStripe).
			Order("id desc").
			First(&order).Error; err != nil {
			return err
		}
		if order.ProviderSessionId != "" && order.ProviderSessionId != sessionID {
			return errors.New("Stripe checkout session mismatch")
		}
		updates := map[string]interface{}{"provider_session_id": sessionID}
		if sessionURL != "" {
			updates["provider_session_url"] = sessionURL
		}
		return tx.Model(&order).Updates(updates).Error
	})
}
