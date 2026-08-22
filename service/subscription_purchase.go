package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	SubscriptionPaymentChoiceStripeRecurring = "stripe_recurring"
	SubscriptionPaymentChoiceEpay            = "epay"
	SubscriptionPaymentChoiceAlipay          = "alipay"
	SubscriptionPaymentChoicePix             = "pix"
	SubscriptionPaymentChoiceUPI             = "upi"
	SubscriptionPaymentChoiceBalance         = "balance"

	subscriptionPurchaseOrderTTL = time.Hour
)

type PurchaseSubscriptionCommand struct {
	UserID        int
	PlanID        int
	PaymentChoice string
	PaymentMethod string
	Months        int
	RequestID     string
	VerifiedQuote *SubscriptionPurchaseQuote
	UIMode        string
	RecallClaim   string
	GAClientID    string
	GASessionID   string
}

type PurchaseSubscriptionResult struct {
	Status           string
	Contract         *model.UserSubscriptionContract
	Intent           *model.SubscriptionChangeIntent
	CheckoutURL      string
	HostedInvoiceURL string
	ClientSecret     string
	Order            *model.SubscriptionOrder
	Entitlement      *model.UserSubscription
}

type SubscriptionPurchaseQuote struct {
	Currency                      string
	UnitPrice                     float64
	UnitAmountMinor               int64
	OriginalTotal                 float64
	OriginalTotalAmountMinor      int64
	DiscountKind                  string
	DiscountAmount                float64
	DiscountAmountMinor           int64
	Total                         float64
	PaymentAmountMinor            int64
	InvitationAvailableUSDMinor   int64
	InvitationDiscountUSDMinor    int64
	InvitationDiscountAmountMinor int64
	InvitationRemainingUSDMinor   int64
	OtherDiscountKind             string
	OtherDiscountAmountMinor      int64
	RecallCampaignID              int64
	RecallRecipientID             int64
	RecallPromotionCodeID         string
}

type PrepaidTermAllocation struct {
	CanonicalWalletUnitPrice float64
}

var subscriptionPurchaseQuoteResolver = defaultSubscriptionPurchaseQuote
var subscriptionPurchaseAfterQuoteValidationHook func()
var subscriptionPurchaseAfterProviderExpirationHook func()
var tryGrantInviteSubscriptionRewardAfterOrderCompleted = model.TryGrantInviteSubscriptionRewardAfterOrderCompleted

var ErrSubscriptionPurchaseQuoteUnavailable = errors.New("subscription purchase quote unavailable")
var ErrSubscriptionPurchaseQuoteRequired = errors.New("subscription purchase quote is required")
var ErrSubscriptionPurchaseInvitationReservationRequired = errors.New("subscription purchase invitation discount requires reservation support")

type SubscriptionPurchaseQuoteResult struct {
	Available                     bool    `json:"available"`
	UnavailableReason             string  `json:"unavailable_reason,omitempty"`
	Currency                      string  `json:"currency,omitempty"`
	UnitPrice                     float64 `json:"unit_price,omitempty"`
	UnitAmountMinor               int64   `json:"unit_amount_minor,omitempty"`
	OriginalTotal                 float64 `json:"original_total,omitempty"`
	OriginalTotalAmountMinor      int64   `json:"original_total_amount_minor,omitempty"`
	DiscountKind                  string  `json:"discount_kind,omitempty"`
	DiscountAmount                float64 `json:"discount_amount,omitempty"`
	DiscountAmountMinor           int64   `json:"discount_amount_minor,omitempty"`
	Total                         float64 `json:"total,omitempty"`
	PaymentAmountMinor            int64   `json:"payment_amount_minor,omitempty"`
	InvitationAvailableUSDMinor   int64   `json:"invitation_available_usd_minor,omitempty"`
	InvitationDiscountUSDMinor    int64   `json:"invitation_discount_usd_minor,omitempty"`
	InvitationDiscountAmountMinor int64   `json:"invitation_discount_amount_minor,omitempty"`
	InvitationRemainingUSDMinor   int64   `json:"invitation_remaining_usd_minor,omitempty"`
	OtherDiscountKind             string  `json:"other_discount_kind,omitempty"`
	OtherDiscountAmountMinor      int64   `json:"other_discount_amount_minor,omitempty"`
	RecallCampaignID              int64   `json:"recall_campaign_id,omitempty"`
	RecallRecipientID             int64   `json:"recall_recipient_id,omitempty"`
	RecallPromotionCodeID         string  `json:"recall_promotion_code_id,omitempty"`
}

func RecallCheckoutDiscountFromResolvedOffer(offer *RecallResolvedOffer) *RecallCheckoutDiscount {
	if offer == nil {
		return nil
	}
	return &RecallCheckoutDiscount{
		PromotionCodeID:     offer.PromotionCodeID,
		CampaignID:          offer.View.CampaignID,
		RecipientID:         offer.View.RecipientID,
		DiscountAmountMinor: offer.DiscountMinor,
	}
}

func RecordRecallClaimAttribution(ctx context.Context, userID int, claim string) {
	claim = strings.TrimSpace(claim)
	if claim == "" {
		return
	}
	if _, err := GetRecallRuntime().Claims.ValidateClaim(ctx, userID, claim); err != nil {
		common.SysLog(fmt.Sprintf("recall claim attribution ignored user_id=%d error=%q", userID, err.Error()))
	}
}

type purchasePlanSnapshot struct {
	PlanID              int     `json:"plan_id"`
	Title               string  `json:"title"`
	PriceAmount         float64 `json:"price_amount"`
	Currency            string  `json:"currency"`
	StripePriceID       string  `json:"stripe_price_id"`
	DurationUnit        string  `json:"duration_unit"`
	DurationValue       int     `json:"duration_value"`
	TotalAmount         int64   `json:"total_amount"`
	Window5hAmount      int64   `json:"window_5h_amount"`
	WindowWeekAmount    int64   `json:"window_week_amount"`
	MediaCreditsMonthly int64   `json:"media_credits_monthly,omitempty"`
	QuotaResetPeriod    string  `json:"quota_reset_period"`
	UpgradeGroup        string  `json:"upgrade_group"`
}

func QuoteSubscriptionPurchase(cmd PurchaseSubscriptionCommand) (*SubscriptionPurchaseQuoteResult, error) {
	cmd.normalize()
	if err := cmd.validateQuote(); err != nil {
		return nil, err
	}
	var result *SubscriptionPurchaseQuoteResult
	var planSnapshot *model.SubscriptionPlan
	var baseQuote SubscriptionPurchaseQuote
	var invitationAvailableUSDMinor int64
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.Where("id = ?", cmd.UserID).First(&user).Error; err != nil {
			return err
		}
		if err := model.RepairInviteeRegistrationSubscriptionDiscountTx(tx, &user); err != nil {
			return err
		}
		plan, err := loadEnabledSubscriptionPlanTx(tx, cmd.PlanID)
		if err != nil {
			return err
		}
		if cmd.PaymentChoice != SubscriptionPaymentChoiceStripeRecurring {
			if err := validateFlexiblePrepaidPlan(plan); err != nil {
				return err
			}
			if cmd.PaymentChoice == SubscriptionPaymentChoiceBalance && plan.AllowBalancePay != nil && !*plan.AllowBalancePay {
				return errors.New("subscription plan does not allow balance payment")
			}
		}
		quote, err := resolveSubscriptionPurchaseQuote(*plan, cmd.PaymentChoice, cmd.Months)
		if err != nil {
			if errors.Is(err, ErrSubscriptionPurchaseQuoteUnavailable) {
				result = &SubscriptionPurchaseQuoteResult{Available: false, UnavailableReason: err.Error()}
				return nil
			}
			return err
		}
		account, err := model.GetSubscriptionDiscountAccountTx(tx, user.Id)
		if err != nil {
			return err
		}
		planCopy := *plan
		planSnapshot = &planCopy
		baseQuote = quote
		invitationAvailableUSDMinor = account.AvailableUSDMinor
		return nil
	})
	if err != nil {
		return nil, err
	}
	if planSnapshot != nil {
		discounted, err := applySubscriptionPurchaseDiscounts(context.Background(), cmd.UserID, cmd.RecallClaim, *planSnapshot, baseQuote, invitationAvailableUSDMinor, cmd.Months)
		if err != nil {
			return nil, err
		}
		result = subscriptionPurchaseQuoteResult(discounted)
	}
	return result, nil
}

func PurchaseSubscription(cmd PurchaseSubscriptionCommand) (*PurchaseSubscriptionResult, error) {
	cmd.normalize()
	if err := cmd.validate(); err != nil {
		return nil, err
	}
	if cmd.PaymentChoice == SubscriptionPaymentChoiceStripeRecurring {
		if existing, found, err := findRecurringPurchaseReplay(cmd.UserID, cmd.RequestID); err != nil {
			return nil, err
		} else if !found {
			validatedQuote, err := validateAuthoritativeSubscriptionPurchaseQuote(context.Background(), cmd)
			if err != nil {
				return nil, err
			}
			cmd.VerifiedQuote = &validatedQuote
			if subscriptionPurchaseAfterQuoteValidationHook != nil {
				subscriptionPurchaseAfterQuoteValidationHook()
			}
		} else if existing.ToPlanId != cmd.PlanID {
			return nil, errors.New("subscription purchase idempotency conflict")
		}
		change, err := ChangeSubscriptionPlan(ChangePlanCommand{
			UserID:        cmd.UserID,
			PlanID:        cmd.PlanID,
			PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
			RequestID:     cmd.RequestID,
			UIMode:        cmd.UIMode,
			RecallClaim:   cmd.RecallClaim,
			GAClientID:    cmd.GAClientID,
			GASessionID:   cmd.GASessionID,
			VerifiedQuote: cmd.VerifiedQuote,
		})
		if err != nil {
			return nil, err
		}
		result := &PurchaseSubscriptionResult{
			Status:           change.Status,
			Contract:         change.Contract,
			Intent:           change.Intent,
			CheckoutURL:      change.CheckoutURL,
			HostedInvoiceURL: change.HostedInvoiceURL,
			ClientSecret:     change.ClientSecret,
		}
		if change.Intent != nil {
			var order model.SubscriptionOrder
			query := model.DB.Where("change_intent_id = ? AND payment_provider = ?", change.Intent.Id, model.PaymentProviderStripe).
				Order("id desc").Limit(1).Find(&order)
			if query.Error != nil {
				return nil, query.Error
			}
			if query.RowsAffected > 0 {
				result.Order = &order
			}
		}
		return result, nil
	}
	if replay, found, err := replayExistingSubscriptionPurchase(cmd); err != nil {
		return nil, err
	} else if found {
		return replay, nil
	}
	if err := rejectConvertedRecallClaimQuoteReuse(context.Background(), cmd); err != nil {
		return nil, err
	}
	validatedQuote, err := validateAuthoritativeSubscriptionPurchaseQuote(context.Background(), cmd)
	if err != nil {
		return nil, err
	}
	cmd.VerifiedQuote = &validatedQuote
	if subscriptionPurchaseAfterQuoteValidationHook != nil {
		subscriptionPurchaseAfterQuoteValidationHook()
	}
	confirmedExpiredProviderSessions := map[string]struct{}{}
	if cmd.PaymentChoice == SubscriptionPaymentChoiceEpay || cmd.PaymentChoice == SubscriptionPaymentChoiceAlipay || cmd.PaymentChoice == SubscriptionPaymentChoicePix || cmd.PaymentChoice == SubscriptionPaymentChoiceUPI || cmd.PaymentChoice == SubscriptionPaymentChoiceBalance {
		pendingProviderSessions, err := findReplaceablePendingStripeCheckoutSessions(cmd.UserID, cmd.RequestID)
		if err != nil {
			return nil, err
		}
		if err := preflightPrepaidPurchaseBeforeProviderExpiration(cmd, validatedQuote); err != nil {
			return nil, err
		}
		confirmed, err := ensureReplaceablePendingStripeCheckoutsProviderExpired(context.Background(), cmd.UserID, cmd.RequestID, pendingProviderSessions)
		if err != nil {
			return nil, err
		}
		confirmedExpiredProviderSessions = confirmed
		if subscriptionPurchaseAfterProviderExpirationHook != nil {
			subscriptionPurchaseAfterProviderExpirationHook()
		}
	}
	var supersededCheckouts []supersededStripeCheckout
	var result *PurchaseSubscriptionResult
	var effects *balanceOnePeriodSideEffects
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := subscriptionCommandLock(tx).Where("id = ?", cmd.UserID).First(&user).Error; err != nil {
			return err
		}
		if existing, found, err := findIntentByRequestTx(tx, cmd.UserID, cmd.RequestID); err != nil {
			return err
		} else if found {
			replay, err := buildPurchaseReplayResultTx(tx, cmd, existing)
			if err != nil {
				return err
			}
			result = replay
			return nil
		}
		plan, err := loadEnabledSubscriptionPlanTx(tx, cmd.PlanID)
		if err != nil {
			return err
		}
		if err := validateFlexiblePrepaidPlan(plan); err != nil {
			return err
		}
		if cmd.PaymentChoice == SubscriptionPaymentChoiceBalance && plan.AllowBalancePay != nil && !*plan.AllowBalancePay {
			return errors.New("subscription plan does not allow balance payment")
		}
		if err := validateSubscriptionPurchaseQuoteMatchesPlan(*plan, cmd, validatedQuote); err != nil {
			return err
		}
		if err := enforceMaxPurchasePerUserTx(tx, cmd.UserID, plan); err != nil {
			return err
		}
		var replacementReleasedDiscountUSDMinor int64
		if cmd.PaymentChoice == SubscriptionPaymentChoiceEpay || cmd.PaymentChoice == SubscriptionPaymentChoiceAlipay || cmd.PaymentChoice == SubscriptionPaymentChoicePix || cmd.PaymentChoice == SubscriptionPaymentChoiceUPI || cmd.PaymentChoice == SubscriptionPaymentChoiceBalance {
			superseded, err := supersedeReplaceablePendingStripeCheckoutsLocallyTx(tx, cmd.UserID, cmd.RequestID, confirmedExpiredProviderSessions)
			if err != nil {
				return err
			}
			supersededCheckouts = superseded
			for _, checkout := range superseded {
				replacementReleasedDiscountUSDMinor += checkout.ReleasedDiscountUSDMinor
			}
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
		contract, err := getOrCreateContractForUserTx(tx, cmd.UserID)
		if err != nil {
			return err
		}
		if err := rejectUnresolvedPlanChangeTx(tx, cmd.UserID); err != nil {
			return err
		}
		kind, err := classifyPrepaidPurchaseKindTx(tx, contract, plan)
		if err != nil {
			return err
		}
		if err := rejectBalancePrepaidStripeRecurringDowngrade(cmd, contract, kind); err != nil {
			return err
		}
		intent := &model.SubscriptionChangeIntent{
			ContractId:    contract.Id,
			UserId:        cmd.UserID,
			RequestId:     cmd.RequestID,
			ChangeVersion: contract.ChangeVersion + 1,
			Kind:          kind,
			PaymentMode:   model.SubscriptionPaymentModePrepaid,
			Status:        model.SubscriptionChangeIntentStatusCreated,
			FromPlanId:    contract.CurrentPlanId,
			ToPlanId:      plan.Id,
			EffectiveAt:   common.GetTimestamp(),
		}
		if err := tx.Create(intent).Error; err != nil {
			return err
		}
		discountFacts := subscriptionReservationFactsFromValidatedQuote(validatedQuote, replacementReleasedDiscountUSDMinor)
		if err := tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).
			Update("latest_change_intent_id", intent.Id).Error; err != nil {
			return err
		}
		contract.LatestChangeIntentId = intent.Id

		if cmd.PaymentChoice != SubscriptionPaymentChoiceBalance {
			order, err := createPendingOneTimePurchaseOrderTx(tx, &user, contract, intent, plan, cmd, discountFacts)
			if err != nil {
				return err
			}
			intent.Status = model.SubscriptionChangeIntentStatusAwaitingPayment
			if err := tx.Model(intent).Updates(map[string]interface{}{
				"status":     intent.Status,
				"updated_at": common.GetTimestamp(),
			}).Error; err != nil {
				return err
			}
			if err := markSupersededStripeCheckoutReplacementTx(tx, supersededCheckouts, intent.Id, order.TradeNo); err != nil {
				return err
			}
			result = &PurchaseSubscriptionResult{
				Status:   ChangePlanStatusCheckoutRequired,
				Contract: contract,
				Intent:   intent,
				Order:    order,
			}
			return nil
		}

		quote, err := quoteForSubscriptionPurchase(*plan, cmd)
		if err != nil {
			return err
		}
		applied, debitEffects, err := applyBalancePrepaidPurchaseTx(tx, &user, contract, intent, plan, cmd, quote, discountFacts)
		if err != nil {
			return err
		}
		effects = debitEffects
		result = applied
		if result != nil && result.Order != nil {
			if err := markSupersededStripeCheckoutReplacementTx(tx, supersededCheckouts, intent.Id, result.Order.TradeNo); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	if result != nil && result.Order != nil {
		if err := expirePendingSupersededStripeCheckoutsForReplacement(context.Background(), result.Order.TradeNo); err != nil {
			logger.LogWarn(context.Background(), fmt.Sprintf("superseded Stripe checkout expiration failed trade_no=%s error=%q", result.Order.TradeNo, err.Error()))
		}
		deliverInviteSubscriptionRewardAfterOrderCompleted(context.Background(), result.Order.TradeNo)
	}
	applyBalanceOnePeriodSideEffects(effects)
	return result, nil
}

func ReplaySubscriptionPurchase(cmd PurchaseSubscriptionCommand) (*PurchaseSubscriptionResult, bool, error) {
	cmd.normalize()
	if err := cmd.validate(); err != nil {
		return nil, false, err
	}
	if cmd.PaymentChoice == SubscriptionPaymentChoiceStripeRecurring {
		existing, found, err := findRecurringPurchaseReplay(cmd.UserID, cmd.RequestID)
		if err != nil || !found {
			return nil, found, err
		}
		if existing.ToPlanId != cmd.PlanID || existing.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
			return nil, false, errors.New("subscription purchase idempotency conflict")
		}
		change, err := ChangeSubscriptionPlan(ChangePlanCommand{
			UserID:        cmd.UserID,
			PlanID:        cmd.PlanID,
			PaymentMode:   model.SubscriptionPaymentModeStripeRecurring,
			RequestID:     cmd.RequestID,
			UIMode:        cmd.UIMode,
			RecallClaim:   cmd.RecallClaim,
			GAClientID:    cmd.GAClientID,
			GASessionID:   cmd.GASessionID,
			VerifiedQuote: cmd.VerifiedQuote,
		})
		if err != nil {
			return nil, false, err
		}
		result := &PurchaseSubscriptionResult{
			Status:           change.Status,
			Contract:         change.Contract,
			Intent:           change.Intent,
			CheckoutURL:      change.CheckoutURL,
			HostedInvoiceURL: change.HostedInvoiceURL,
			ClientSecret:     change.ClientSecret,
		}
		if change.Intent != nil {
			var order model.SubscriptionOrder
			query := model.DB.Where("change_intent_id = ? AND payment_provider = ?", change.Intent.Id, model.PaymentProviderStripe).
				Order("id desc").Limit(1).Find(&order)
			if query.Error != nil {
				return nil, false, query.Error
			}
			if query.RowsAffected > 0 {
				result.Order = &order
			}
		}
		return result, true, nil
	}
	result, found, err := replayExistingSubscriptionPurchase(cmd)
	if err != nil {
		return nil, false, err
	}
	return result, found, nil
}

func findRecurringPurchaseReplay(userID int, requestID string) (*model.SubscriptionChangeIntent, bool, error) {
	if userID <= 0 || strings.TrimSpace(requestID) == "" {
		return nil, false, nil
	}
	return findIntentByRequestTx(model.DB, userID, strings.TrimSpace(requestID))
}

func (cmd *PurchaseSubscriptionCommand) normalize() {
	cmd.PaymentChoice = strings.TrimSpace(cmd.PaymentChoice)
	cmd.PaymentMethod = strings.TrimSpace(cmd.PaymentMethod)
	cmd.RequestID = strings.TrimSpace(cmd.RequestID)
	cmd.UIMode = strings.ToLower(strings.TrimSpace(cmd.UIMode))
	cmd.RecallClaim = strings.TrimSpace(cmd.RecallClaim)
}

func (cmd PurchaseSubscriptionCommand) validate() error {
	if err := cmd.validateQuote(); err != nil {
		return err
	}
	if cmd.RequestID == "" {
		return errors.New("request_id is required")
	}
	return nil
}

func (cmd PurchaseSubscriptionCommand) validateQuote() error {
	if cmd.UserID <= 0 {
		return errors.New("invalid user id")
	}
	if cmd.PlanID <= 0 {
		return errors.New("invalid plan id")
	}
	switch cmd.PaymentChoice {
	case SubscriptionPaymentChoiceStripeRecurring:
		if cmd.Months != 1 {
			return errors.New("stripe_recurring requires months to be 1")
		}
	case SubscriptionPaymentChoiceEpay:
		if cmd.PaymentMethod == "" {
			return errors.New("epay payment method is required")
		}
		if cmd.Months < 1 || cmd.Months > 12 {
			return errors.New("months must be between 1 and 12")
		}
	case SubscriptionPaymentChoiceAlipay, SubscriptionPaymentChoicePix, SubscriptionPaymentChoiceUPI, SubscriptionPaymentChoiceBalance:
		if cmd.Months < 1 || cmd.Months > 12 {
			return errors.New("months must be between 1 and 12")
		}
	default:
		return errors.New("unsupported payment choice")
	}
	return nil
}

func buildPurchaseReplayResultTx(tx *gorm.DB, cmd PurchaseSubscriptionCommand, intent *model.SubscriptionChangeIntent) (*PurchaseSubscriptionResult, error) {
	if intent.PaymentMode != model.SubscriptionPaymentModePrepaid || intent.ToPlanId != cmd.PlanID {
		return nil, errors.New("subscription purchase idempotency conflict")
	}
	var order model.SubscriptionOrder
	if err := subscriptionCommandLock(tx).
		Where("change_intent_id = ?", intent.Id).
		Order("id desc").
		First(&order).Error; err != nil {
		return nil, err
	}
	expectedMethod := subscriptionPurchaseOrderPaymentMethod(cmd)
	expectedProvider := paymentProviderForPurchaseChoice(cmd.PaymentChoice)
	if order.UserId != cmd.UserID || order.PlanId != cmd.PlanID || order.PurchaseMonths != cmd.Months ||
		order.PaymentMethod != expectedMethod || order.PaymentProvider != expectedProvider {
		return nil, errors.New("subscription purchase idempotency conflict")
	}
	var contract model.UserSubscriptionContract
	if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", intent.ContractId, cmd.UserID).First(&contract).Error; err != nil {
		return nil, err
	}
	var entitlement *model.UserSubscription
	if contract.CurrentEntitlementId > 0 {
		var sub model.UserSubscription
		if err := tx.Where("id = ?", contract.CurrentEntitlementId).First(&sub).Error; err == nil {
			entitlement = &sub
		}
	}
	return &PurchaseSubscriptionResult{
		Status:      changePlanResultStatus(intent.Status),
		Contract:    &contract,
		Intent:      intent,
		Order:       &order,
		Entitlement: entitlement,
	}, nil
}

func markSupersededStripeCheckoutReplacementTx(tx *gorm.DB, supersededCheckouts []supersededStripeCheckout, replacementIntentID int64, replacementTradeNo string) error {
	replacementTradeNo = strings.TrimSpace(replacementTradeNo)
	if tx == nil || len(supersededCheckouts) == 0 || replacementIntentID <= 0 || replacementTradeNo == "" {
		return nil
	}
	intentIDs := make([]int64, 0, len(supersededCheckouts))
	orderIDs := make([]int, 0, len(supersededCheckouts))
	for _, superseded := range supersededCheckouts {
		if superseded.IntentID > 0 {
			intentIDs = append(intentIDs, superseded.IntentID)
		}
		if superseded.OrderID > 0 {
			orderIDs = append(orderIDs, superseded.OrderID)
		}
	}
	if len(intentIDs) > 0 {
		if err := tx.Model(&model.SubscriptionChangeIntent{}).
			Where("id IN ? AND status = ?", intentIDs, model.SubscriptionChangeIntentStatusSuperseded).
			Update("superseded_by_id", replacementIntentID).Error; err != nil {
			return err
		}
	}
	if len(orderIDs) > 0 {
		if err := tx.Model(&model.SubscriptionOrder{}).
			Where("id IN ? AND status = ?", orderIDs, common.TopUpStatusExpired).
			Update("superseded_by_trade_no", replacementTradeNo).Error; err != nil {
			return err
		}
	}
	return nil
}

func expirePendingSupersededStripeCheckoutsForReplacement(ctx context.Context, replacementTradeNo string) error {
	replacementTradeNo = strings.TrimSpace(replacementTradeNo)
	if replacementTradeNo == "" {
		return nil
	}
	var pending []model.SubscriptionOrder
	if err := model.DB.
		Where("superseded_by_trade_no = ? AND provider_expiration_pending = ? AND provider_session_id <> ?",
			replacementTradeNo, true, "").
		Order("id asc").
		Find(&pending).Error; err != nil {
		return err
	}
	for _, order := range pending {
		if err := expireReplaceableStripeCheckout(ctx, order.ProviderSessionId); err != nil {
			if recordErr := recordSupersededStripeCheckoutExpirationFailure(order.Id, err); recordErr != nil {
				return recordErr
			}
			return err
		}
		if err := clearSupersededStripeCheckoutExpirationPending(order.Id); err != nil {
			return err
		}
		if err := model.SyncSubscriptionOrderTopUpHistory(order.TradeNo); err != nil {
			return err
		}
	}
	return nil
}

func preflightPrepaidPurchaseBeforeProviderExpiration(cmd PurchaseSubscriptionCommand, validatedQuote SubscriptionPurchaseQuote) error {
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := subscriptionCommandLock(tx).Where("id = ?", cmd.UserID).First(&user).Error; err != nil {
			return err
		}
		if existing, found, err := findIntentByRequestTx(tx, cmd.UserID, cmd.RequestID); err != nil {
			return err
		} else if found && existing != nil {
			return nil
		}
		plan, err := loadEnabledSubscriptionPlanTx(tx, cmd.PlanID)
		if err != nil {
			return err
		}
		if err := validateFlexiblePrepaidPlan(plan); err != nil {
			return err
		}
		if cmd.PaymentChoice == SubscriptionPaymentChoiceBalance && plan.AllowBalancePay != nil && !*plan.AllowBalancePay {
			return errors.New("subscription plan does not allow balance payment")
		}
		if err := validateSubscriptionPurchaseQuoteMatchesPlan(*plan, cmd, validatedQuote); err != nil {
			return err
		}
		if err := enforceMaxPurchasePerUserTx(tx, cmd.UserID, plan); err != nil {
			return err
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
		return nil
	})
}

func findReplaceablePendingStripeCheckoutSessions(userID int, requestID string) ([]string, error) {
	if userID <= 0 || strings.TrimSpace(requestID) == "" {
		return nil, nil
	}
	if existing, found, err := findIntentByRequestTx(model.DB, userID, requestID); err != nil {
		return nil, err
	} else if found && existing != nil {
		return nil, nil
	}
	var orders []model.SubscriptionOrder
	if err := model.DB.
		Select("subscription_orders.*").
		Joins("JOIN subscription_change_intents ON subscription_change_intents.id = subscription_orders.change_intent_id").
		Where("subscription_orders.user_id = ? AND subscription_orders.payment_provider = ? AND subscription_orders.status = ? AND subscription_orders.provider_session_id <> ? AND subscription_change_intents.request_id <> ? AND subscription_change_intents.payment_mode IN ? AND subscription_change_intents.status = ? AND subscription_change_intents.kind IN ?",
			userID,
			model.PaymentProviderStripe,
			common.TopUpStatusPending,
			"",
			strings.TrimSpace(requestID),
			[]string{model.SubscriptionPaymentModeStripeRecurring, model.SubscriptionPaymentModePrepaid},
			model.SubscriptionChangeIntentStatusAwaitingPayment,
			[]string{model.SubscriptionChangeIntentKindPurchase, model.SubscriptionChangeIntentKindRepurchase, model.SubscriptionChangeIntentKindUpgrade, model.SubscriptionChangeIntentKindDowngrade},
		).
		Order("subscription_orders.id asc").
		Find(&orders).Error; err != nil {
		return nil, err
	}
	providerSessions := make([]string, 0, len(orders))
	for _, order := range orders {
		sessionID := strings.TrimSpace(order.ProviderSessionId)
		if sessionID != "" {
			providerSessions = append(providerSessions, sessionID)
		}
	}
	return providerSessions, nil
}

func ensureReplaceablePendingStripeCheckoutsProviderExpired(ctx context.Context, userID int, requestID string, providerSessions []string) (map[string]struct{}, error) {
	confirmed := map[string]struct{}{}
	if existing, found, err := findIntentByRequestTx(model.DB, userID, requestID); err != nil {
		return nil, err
	} else if found && existing != nil {
		return confirmed, nil
	}
	for _, sessionID := range providerSessions {
		if err := expireReplaceableStripeCheckout(ctx, sessionID); err != nil {
			return nil, err
		}
		confirmed[sessionID] = struct{}{}
	}
	return confirmed, nil
}

func recordSupersededStripeCheckoutExpirationFailure(orderID int, expireErr error) error {
	if orderID <= 0 || expireErr == nil {
		return nil
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var order model.SubscriptionOrder
		if err := subscriptionCommandLock(tx).Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		if !order.ProviderExpirationPending {
			return nil
		}
		return tx.Model(&order).Where("id = ? AND provider_expiration_pending = ?", order.Id, true).
			Updates(map[string]interface{}{
				"provider_expiration_attempt_count": order.ProviderExpirationAttemptCount + 1,
				"provider_expiration_last_error":    expireErr.Error(),
			}).Error
	})
}

func clearSupersededStripeCheckoutExpirationPending(orderID int) error {
	if orderID <= 0 {
		return nil
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var order model.SubscriptionOrder
		if err := subscriptionCommandLock(tx).Where("id = ?", orderID).First(&order).Error; err != nil {
			return err
		}
		if !order.ProviderExpirationPending {
			return nil
		}
		return tx.Model(&order).Where("id = ? AND provider_expiration_pending = ?", order.Id, true).
			Updates(map[string]interface{}{
				"provider_expiration_pending":       false,
				"provider_expiration_attempt_count": order.ProviderExpirationAttemptCount + 1,
				"provider_expiration_last_error":    "",
				"provider_expiration_completed_at":  common.GetTimestamp(),
			}).Error
	})
}

func validateFlexiblePrepaidPlan(plan *model.SubscriptionPlan) error {
	if plan == nil {
		return errors.New("subscription plan is nil")
	}
	if plan.DurationUnit != model.SubscriptionDurationMonth || plan.DurationValue != 1 {
		return errors.New("flexible prepaid purchase requires one-month subscription plan duration")
	}
	return nil
}

func classifyPrepaidPurchaseKindTx(tx *gorm.DB, contract *model.UserSubscriptionContract, target *model.SubscriptionPlan) (string, error) {
	if contract.CurrentPlanId <= 0 {
		return model.SubscriptionChangeIntentKindPurchase, nil
	}
	if contract.CurrentPlanId == target.Id {
		return model.SubscriptionChangeIntentKindRepurchase, nil
	}
	var current model.SubscriptionPlan
	if err := tx.Where("id = ?", contract.CurrentPlanId).First(&current).Error; err != nil {
		return "", err
	}
	if current.TierRank == nil || target.TierRank == nil {
		return model.SubscriptionChangeIntentKindPurchase, nil
	}
	if *target.TierRank > *current.TierRank {
		return model.SubscriptionChangeIntentKindUpgrade, nil
	}
	return model.SubscriptionChangeIntentKindDowngrade, nil
}

func rejectBalancePrepaidStripeRecurringDowngrade(cmd PurchaseSubscriptionCommand, contract *model.UserSubscriptionContract, kind string) error {
	if cmd.PaymentChoice != SubscriptionPaymentChoiceBalance || kind != model.SubscriptionChangeIntentKindDowngrade || contract == nil {
		return nil
	}
	if contract.Status == model.SubscriptionContractStatusActive &&
		contract.PaymentMode == model.SubscriptionPaymentModeStripeRecurring &&
		contract.CurrentProviderBindingId > 0 {
		return errors.New("active Stripe recurring downgrade must use Stripe recurring scheduling")
	}
	return nil
}

func createPendingOneTimePurchaseOrderTx(tx *gorm.DB, user *model.User, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent, plan *model.SubscriptionPlan, cmd PurchaseSubscriptionCommand, discountFacts subscriptionReservationDiscountFacts) (*model.SubscriptionOrder, error) {
	snapshot, err := subscriptionPurchasePlanSnapshot(plan)
	if err != nil {
		return nil, err
	}
	quote, err := quoteForSubscriptionPurchase(*plan, cmd)
	if err != nil {
		return nil, err
	}
	recallCampaignID, recallRecipientID, recallPromotionCodeID, recallDiscountAmountMinor := subscriptionPurchaseRecallAttribution(quote)
	now := common.GetTimestamp()
	order := &model.SubscriptionOrder{
		UserId:                    user.Id,
		PlanId:                    plan.Id,
		Money:                     quote.Total,
		TradeNo:                   subscriptionPurchaseTradeNo(user.Id, intent.Id),
		PaymentMethod:             subscriptionPurchaseOrderPaymentMethod(cmd),
		PaymentProvider:           paymentProviderForPurchaseChoice(cmd.PaymentChoice),
		GAClientID:                NormalizeGAIdentifier(cmd.GAClientID),
		GASessionID:               NormalizeGAIdentifier(cmd.GASessionID),
		CreateTime:                now,
		PurchaseMonths:            cmd.Months,
		UnitPrice:                 quote.UnitPrice,
		PaymentCurrency:           quote.Currency,
		PaymentAmountMinor:        quote.PaymentAmountMinor,
		PlanSnapshot:              snapshot,
		PurchaseIntent:            intent.Kind,
		RecallCampaignId:          recallCampaignID,
		RecallRecipientId:         recallRecipientID,
		RecallPromotionCodeId:     recallPromotionCodeID,
		RecallDiscountAmountMinor: recallDiscountAmountMinor,
		ProviderPayload:           fmt.Sprintf("choice=%s;method=%s;months=%d;contract_id=%d;change_intent_id=%d", cmd.PaymentChoice, subscriptionPurchaseOrderPaymentMethod(cmd), cmd.Months, contract.Id, intent.Id),
		ChangeIntentId:            intent.Id,
	}
	if err := model.CreateSubscriptionOrderWithPendingPurchaseLifecycleTx(tx, order, "subscription_purchase.pending_order"); err != nil {
		return nil, err
	}
	if err := reserveSubscriptionDiscountForOrderTx(tx, order, plan, cmd, quote, discountFacts, subscriptionPurchaseOrderExpiresAt(now)); err != nil {
		return nil, err
	}
	if err := tx.Save(order).Error; err != nil {
		return nil, err
	}
	return order, nil
}

func applyBalancePrepaidPurchaseTx(tx *gorm.DB, user *model.User, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent, plan *model.SubscriptionPlan, cmd PurchaseSubscriptionCommand, quote SubscriptionPurchaseQuote, discountFacts subscriptionReservationDiscountFacts) (*PurchaseSubscriptionResult, *balanceOnePeriodSideEffects, error) {
	if err := enforcePrepaidReplacementLimitTx(tx, contract.Id, cmd.Months); err != nil {
		return nil, nil, err
	}
	refundQuota, err := refundPrepaidNotStartedTermsTx(tx, user.Id, contract.Id)
	if err != nil {
		return nil, nil, err
	}
	requiredQuota, err := subscriptionBalanceQuota(quote.Total)
	if err != nil {
		return nil, nil, err
	}
	availableQuota := user.Quota + int(refundQuota)
	if requiredQuota > 0 && availableQuota < requiredQuota {
		return nil, nil, errors.New("insufficient balance")
	}
	netDelta := refundQuota - int64(requiredQuota)
	if netDelta != 0 {
		requireAtLeast := int64(0)
		if netDelta < 0 {
			requireAtLeast = -netDelta
		}
		result, err := model.ApplyWalletQuotaMutationTx(tx, user.Id, netDelta, requireAtLeast, "subscription_purchase_balance", fmt.Sprintf("subscription:purchase:intent:%d", intent.Id))
		if err != nil {
			return nil, nil, err
		}
		if !result.Applied {
			return nil, nil, errors.New("insufficient balance")
		}
		user.Quota = int(result.CurrentBalance)
	} else {
		user.Quota = availableQuota - requiredQuota
	}

	snapshot, err := subscriptionPurchasePlanSnapshot(plan)
	if err != nil {
		return nil, nil, err
	}
	recallCampaignID, recallRecipientID, recallPromotionCodeID, recallDiscountAmountMinor := subscriptionPurchaseRecallAttribution(quote)
	now := common.GetTimestamp()
	order := &model.SubscriptionOrder{
		UserId:                    user.Id,
		PlanId:                    plan.Id,
		Money:                     quote.Total,
		TradeNo:                   subscriptionPurchaseTradeNo(user.Id, intent.Id),
		PaymentMethod:             model.PaymentMethodBalance,
		PaymentProvider:           model.PaymentProviderBalance,
		CreateTime:                now,
		PurchaseMonths:            cmd.Months,
		UnitPrice:                 quote.UnitPrice,
		PaymentCurrency:           quote.Currency,
		PaymentAmountMinor:        quote.PaymentAmountMinor,
		PlanSnapshot:              snapshot,
		PurchaseIntent:            intent.Kind,
		RenewalSource:             model.SubscriptionRenewalSourceWallet,
		RecallCampaignId:          recallCampaignID,
		RecallRecipientId:         recallRecipientID,
		RecallPromotionCodeId:     recallPromotionCodeID,
		RecallDiscountAmountMinor: recallDiscountAmountMinor,
		ProviderPayload:           fmt.Sprintf("charged_quota=%d;refunded_quota=%d;choice=%s;months=%d;contract_id=%d;change_intent_id=%d", requiredQuota, refundQuota, cmd.PaymentChoice, cmd.Months, contract.Id, intent.Id),
		ChangeIntentId:            intent.Id,
	}
	var grant *model.GrantEntitlementResult
	applied, err := model.CreateSubscriptionOrderWithSuccessPurchaseLifecycleTx(tx, order, "subscription_purchase.balance_prepaid", func(tx *gorm.DB, locked *model.SubscriptionOrder, transition *model.PurchaseLifecycleTransition) error {
		periodStart := now
		periodEnd := time.Unix(periodStart, 0).AddDate(0, cmd.Months, 0).Unix()
		var err error
		grant, err = model.RotateCurrentEntitlementTx(tx, model.GrantEntitlementInput{
			ContractId:           contract.Id,
			UserId:               user.Id,
			PlanId:               plan.Id,
			ProviderBindingId:    0,
			GrantKey:             "prepaid:" + locked.TradeNo,
			PaymentMode:          model.SubscriptionPaymentModePrepaid,
			AmountTotal:          plan.TotalAmount,
			Window5hAmount:       common.GetPointer(plan.Window5hAmount),
			WindowWeekAmount:     common.GetPointer(plan.WindowWeekAmount),
			UpgradeGroup:         common.GetPointer(plan.UpgradeGroup),
			PeriodStart:          periodStart,
			PeriodEnd:            periodEnd,
			EndReasonForPrevious: previousEntitlementEndReason(intent.Kind),
			Source:               model.PaymentMethodBalance,
		})
		if err != nil {
			return err
		}
		if grant != nil && grant.Entitlement != nil {
			transition.SubscriptionScopeID = int64(grant.Entitlement.Id)
		}
		if err := createPrepaidTermSegmentsTx(tx, contract.Id, locked.Id, plan.Id, PrepaidTermAllocation{
			CanonicalWalletUnitPrice: plan.PriceAmount,
		}, periodStart, cmd.Months); err != nil {
			return err
		}
		return markPrepaidPurchaseAppliedTx(tx, contract, intent, plan, periodStart, periodEnd, locked.TradeNo, locked.PaymentMethod)
	})
	if err != nil {
		return nil, nil, err
	}
	if !applied {
		return nil, nil, errors.New("subscription purchase lifecycle transition was not applied")
	}
	order.Status = common.TopUpStatusSuccess
	order.CompleteTime = now
	if err := reserveSubscriptionDiscountForOrderTx(tx, order, plan, cmd, quote, discountFacts, subscriptionPurchaseOrderExpiresAt(now)); err != nil {
		return nil, nil, err
	}
	if err := tx.Save(order).Error; err != nil {
		return nil, nil, err
	}
	if quote.DiscountKind == SubscriptionDiscountKindRecall && quote.DiscountAmountMinor > 0 {
		eventData, err := common.Marshal(map[string]any{
			"trade_no":         order.TradeNo,
			"conversion_kind":  model.RecallConversionDirect,
			"currency":         strings.ToUpper(strings.TrimSpace(quote.Currency)),
			"amount_total":     quote.PaymentAmountMinor,
			"discount_amount":  quote.DiscountAmountMinor,
			"payment_category": model.RecallRevenueCategoryBalanceSubscription,
		})
		if err != nil {
			return nil, nil, err
		}
		converted, err := model.RecordRecallConversionTx(tx, model.RecallConversionRecord{
			RecipientId:    quote.RecallRecipientID,
			CampaignId:     quote.RecallCampaignID,
			UserId:         user.Id,
			Kind:           model.RecallConversionDirect,
			TradeNo:        order.TradeNo,
			Currency:       strings.ToUpper(strings.TrimSpace(quote.Currency)),
			Amount:         quote.PaymentAmountMinor,
			DiscountAmount: quote.DiscountAmountMinor,
			Source:         "balance",
			SourceEventId:  "balance:" + order.TradeNo,
			EventData:      string(eventData),
			ConvertedAt:    now,
		})
		if err != nil {
			return nil, nil, err
		}
		if !converted {
			return nil, nil, ErrRecallClaimConverted
		}
	}
	if requiredQuota > 0 {
		if err := tx.Create(&model.WalletLedgerEntry{
			UserId:      user.Id,
			EntryKey:    fmt.Sprintf("subscription:purchase:debit:%s", order.TradeNo),
			QuotaDelta:  -int64(requiredQuota),
			MoneyAmount: order.Money,
			EntryType:   model.WalletLedgerEntryTypePrepaidDebit,
			OrderId:     order.Id,
		}).Error; err != nil {
			return nil, nil, err
		}
	}

	if strings.TrimSpace(order.SubscriptionDiscountReservationKey) != "" {
		if _, err := model.CommitSubscriptionDiscountTx(tx, order.SubscriptionDiscountReservationKey); err != nil {
			return nil, nil, err
		}
	}
	if err := tx.Where("id = ?", contract.Id).First(contract).Error; err != nil {
		return nil, nil, err
	}
	entitlement := grant.Entitlement
	return &PurchaseSubscriptionResult{
			Status:      ChangePlanStatusApplied,
			Contract:    contract,
			Intent:      intent,
			Order:       order,
			Entitlement: entitlement,
		}, &balanceOnePeriodSideEffects{
			userID:       user.Id,
			planTitle:    plan.Title,
			money:        order.Money,
			chargedQuota: requiredQuota,
		}, nil
}

func subscriptionPurchaseRecallAttribution(quote SubscriptionPurchaseQuote) (int64, int64, string, int64) {
	if quote.DiscountKind != SubscriptionDiscountKindRecall {
		return 0, 0, "", 0
	}
	return quote.RecallCampaignID, quote.RecallRecipientID, quote.RecallPromotionCodeID, quote.DiscountAmountMinor
}

func subscriptionPurchaseOrderPaymentMethod(cmd PurchaseSubscriptionCommand) string {
	if cmd.PaymentChoice == SubscriptionPaymentChoiceEpay && strings.TrimSpace(cmd.PaymentMethod) != "" {
		return strings.TrimSpace(cmd.PaymentMethod)
	}
	return strings.TrimSpace(cmd.PaymentChoice)
}

type subscriptionDiscountPricingSnapshot struct {
	DiscountKind                       string `json:"discount_kind"`
	Currency                           string `json:"currency"`
	UnitAmountMinor                    int64  `json:"unit_amount_minor"`
	OriginalTotalAmountMinor           int64  `json:"original_total_amount_minor"`
	PaymentAmountMinor                 int64  `json:"payment_amount_minor"`
	DiscountAmountMinor                int64  `json:"discount_amount_minor"`
	InvitationAvailableUSDMinor        int64  `json:"invitation_available_usd_minor"`
	InvitationDiscountUSDMinor         int64  `json:"invitation_discount_usd_minor"`
	InvitationDiscountAmountMinor      int64  `json:"invitation_discount_amount_minor"`
	InvitationRemainingUSDMinor        int64  `json:"invitation_remaining_usd_minor"`
	OtherDiscountKind                  string `json:"other_discount_kind,omitempty"`
	OtherDiscountAmountMinor           int64  `json:"other_discount_amount_minor,omitempty"`
	RecallCampaignID                   int64  `json:"recall_campaign_id,omitempty"`
	RecallRecipientID                  int64  `json:"recall_recipient_id,omitempty"`
	RecallPromotionCodeID              string `json:"recall_promotion_code_id,omitempty"`
	SubscriptionDiscountReservationKey string `json:"subscription_discount_reservation_key,omitempty"`
}

type subscriptionReservationDiscountFacts struct {
	OtherDiscountKind           string
	OtherDiscountAmountMinor    int64
	ReplacementReleasedUSDMinor int64
}

func subscriptionReservationFactsFromValidatedQuote(quote SubscriptionPurchaseQuote, replacementReleasedUSDMinor int64) subscriptionReservationDiscountFacts {
	return subscriptionReservationDiscountFacts{
		OtherDiscountKind:           strings.TrimSpace(quote.OtherDiscountKind),
		OtherDiscountAmountMinor:    quote.OtherDiscountAmountMinor,
		ReplacementReleasedUSDMinor: replacementReleasedUSDMinor,
	}
}

func reserveSubscriptionDiscountForOrderTx(tx *gorm.DB, order *model.SubscriptionOrder, plan *model.SubscriptionPlan, cmd PurchaseSubscriptionCommand, quote SubscriptionPurchaseQuote, discountFacts subscriptionReservationDiscountFacts, expiresAt int64) error {
	if tx == nil || order == nil {
		return errors.New("subscription discount reservation order is required")
	}
	quote.DiscountKind = strings.TrimSpace(quote.DiscountKind)
	if quote.DiscountKind == "" {
		quote.DiscountKind = SubscriptionDiscountKindNone
	}
	order.DiscountKind = quote.DiscountKind
	order.SubscriptionDiscountUSDMinor = 0
	order.SubscriptionDiscountAmountMinor = 0
	order.SubscriptionDiscountReservationKey = ""
	snapshot, err := subscriptionDiscountSnapshotJSON(quote, "")
	if err != nil {
		return err
	}
	order.DiscountPricingSnapshot = snapshot
	switch quote.DiscountKind {
	case SubscriptionDiscountKindNone, SubscriptionDiscountKindRecall:
		return nil
	case SubscriptionDiscountKindInvitation:
	default:
		return fmt.Errorf("%w: unsupported discount kind", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if quote.InvitationDiscountUSDMinor <= 0 || quote.InvitationDiscountAmountMinor <= 0 {
		return fmt.Errorf("%w: invitation discount missing amount", ErrSubscriptionPurchaseQuoteInvalid)
	}
	if err := validateCurrentInvitationQuoteForReservationTx(tx, order, plan, cmd, quote, discountFacts); err != nil {
		return err
	}
	reservationKey := "subscription-order:" + strings.TrimSpace(order.TradeNo) + ":reserve"
	snapshot, err = subscriptionDiscountSnapshotJSON(quote, reservationKey)
	if err != nil {
		return err
	}
	created, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
		UserID:             order.UserId,
		USDMinor:           quote.InvitationDiscountUSDMinor,
		OrderID:            order.Id,
		TradeNo:            order.TradeNo,
		PaymentCurrency:    quote.Currency,
		AppliedAmountMinor: quote.InvitationDiscountAmountMinor,
		PricingSnapshot:    snapshot,
		IdempotencyKey:     reservationKey,
		ExpiresAt:          expiresAt,
	})
	if err != nil {
		if errors.Is(err, model.ErrSubscriptionDiscountInsufficient) {
			return fmt.Errorf("%w: invitation credit changed", ErrSubscriptionPurchaseQuoteInvalid)
		}
		return err
	}
	if !created {
		return fmt.Errorf("%w: duplicate reservation", ErrSubscriptionPurchaseQuoteInvalid)
	}
	order.SubscriptionDiscountUSDMinor = quote.InvitationDiscountUSDMinor
	order.SubscriptionDiscountAmountMinor = quote.InvitationDiscountAmountMinor
	order.SubscriptionDiscountReservationKey = reservationKey
	order.DiscountPricingSnapshot = snapshot
	return nil
}

func validateCurrentInvitationQuoteForReservationTx(tx *gorm.DB, order *model.SubscriptionOrder, plan *model.SubscriptionPlan, cmd PurchaseSubscriptionCommand, quote SubscriptionPurchaseQuote, discountFacts subscriptionReservationDiscountFacts) error {
	if tx == nil || order == nil || plan == nil {
		return errors.New("subscription discount reservation quote context is required")
	}
	var account model.SubscriptionDiscountAccount
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("user_id = ?", order.UserId).First(&account).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		account = model.SubscriptionDiscountAccount{UserID: order.UserId}
	} else if err != nil {
		return err
	}
	base, err := resolveSubscriptionPurchaseQuote(*plan, cmd.PaymentChoice, cmd.Months)
	if err != nil {
		return err
	}
	effectiveAvailableUSDMinor := account.AvailableUSDMinor - discountFacts.ReplacementReleasedUSDMinor
	if effectiveAvailableUSDMinor < 0 {
		return fmt.Errorf("%w: invitation credit changed", ErrSubscriptionPurchaseQuoteInvalid)
	}
	canonicalUSDQuote := subscriptionPurchaseQuoteFromUnitPrice(plan.Currency, plan.PriceAmount, cmd.Months)
	discountQuote, err := BuildSubscriptionDiscountQuote(SubscriptionDiscountQuoteInput{
		Currency:                 base.Currency,
		OriginalAmountMinor:      base.OriginalTotalAmountMinor,
		OriginalUSDMinor:         canonicalUSDQuote.OriginalTotalAmountMinor,
		AvailableUSDMinor:        effectiveAvailableUSDMinor,
		OtherDiscountKind:        discountFacts.OtherDiscountKind,
		OtherDiscountAmountMinor: discountFacts.OtherDiscountAmountMinor,
	})
	if err != nil {
		return err
	}
	expected := base
	expected.DiscountKind = discountQuote.SelectedKind
	expected.DiscountAmountMinor = discountQuote.SelectedDiscountAmountMinor
	expected.DiscountAmount = float64(expected.DiscountAmountMinor) / 100
	expected.PaymentAmountMinor = discountQuote.FinalAmountMinor
	expected.Total = float64(expected.PaymentAmountMinor) / 100
	expected.InvitationAvailableUSDMinor = discountQuote.InvitationAvailableUSDMinor
	expected.InvitationDiscountUSDMinor = discountQuote.InvitationDiscountUSDMinor
	expected.InvitationDiscountAmountMinor = discountQuote.InvitationDiscountAmountMinor
	expected.InvitationRemainingUSDMinor = discountQuote.InvitationRemainingUSDMinor
	expected.OtherDiscountKind = discountQuote.OtherDiscountKind
	expected.OtherDiscountAmountMinor = discountQuote.OtherDiscountAmountMinor
	if err := compareSubscriptionPurchaseQuotes(expected, quote); err != nil {
		return fmt.Errorf("%w: %v", ErrSubscriptionPurchaseQuoteInvalid, err)
	}
	return nil
}

func subscriptionDiscountSnapshotJSON(quote SubscriptionPurchaseQuote, reservationKey string) (string, error) {
	payload := subscriptionDiscountPricingSnapshot{
		DiscountKind:                       strings.TrimSpace(quote.DiscountKind),
		Currency:                           strings.ToUpper(strings.TrimSpace(quote.Currency)),
		UnitAmountMinor:                    quote.UnitAmountMinor,
		OriginalTotalAmountMinor:           quote.OriginalTotalAmountMinor,
		PaymentAmountMinor:                 quote.PaymentAmountMinor,
		DiscountAmountMinor:                quote.DiscountAmountMinor,
		InvitationAvailableUSDMinor:        quote.InvitationAvailableUSDMinor,
		InvitationDiscountUSDMinor:         quote.InvitationDiscountUSDMinor,
		InvitationDiscountAmountMinor:      quote.InvitationDiscountAmountMinor,
		InvitationRemainingUSDMinor:        quote.InvitationRemainingUSDMinor,
		OtherDiscountKind:                  strings.TrimSpace(quote.OtherDiscountKind),
		OtherDiscountAmountMinor:           quote.OtherDiscountAmountMinor,
		RecallCampaignID:                   quote.RecallCampaignID,
		RecallRecipientID:                  quote.RecallRecipientID,
		RecallPromotionCodeID:              strings.TrimSpace(quote.RecallPromotionCodeID),
		SubscriptionDiscountReservationKey: strings.TrimSpace(reservationKey),
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func SubscriptionPurchaseOrderExpiresAt(createdAt int64) int64 {
	if createdAt <= 0 {
		createdAt = common.GetTimestamp()
	}
	return createdAt + int64(subscriptionPurchaseOrderTTL.Seconds())
}

func subscriptionPurchaseOrderExpiresAt(createdAt int64) int64 {
	return SubscriptionPurchaseOrderExpiresAt(createdAt)
}

func enforcePrepaidReplacementLimitTx(tx *gorm.DB, contractID int64, purchaseMonths int) error {
	if purchaseMonths < 1 || purchaseMonths > 12 {
		return errors.New("months must be between 1 and 12")
	}
	if purchaseMonths-1 > 12 {
		return errors.New("prepaid purchase would exceed 12 not-started months")
	}
	return nil
}

func refundPrepaidNotStartedTermsTx(tx *gorm.DB, userID int, contractID int64) (int64, error) {
	if err := tx.Model(&model.SubscriptionTermSegment{}).
		Where("contract_id = ? AND status = ?", contractID, model.SubscriptionTermStatusActive).
		Updates(map[string]interface{}{
			"status": model.SubscriptionTermStatusReplaced,
		}).Error; err != nil {
		return 0, err
	}
	var terms []model.SubscriptionTermSegment
	if err := subscriptionCommandLock(tx).
		Where("contract_id = ? AND status = ?", contractID, model.SubscriptionTermStatusNotStarted).
		Order("start_time asc, id asc").
		Find(&terms).Error; err != nil {
		return 0, err
	}
	var totalQuota int64
	for _, term := range terms {
		refundKey := fmt.Sprintf("subscription:term:refund:%d", term.Id)
		refundQuota, err := subscriptionMoneyQuota(term.AllocatedMoney)
		if err != nil {
			return 0, err
		}
		if err := tx.Create(&model.WalletLedgerEntry{
			UserId:        userID,
			EntryKey:      refundKey,
			QuotaDelta:    int64(refundQuota),
			MoneyAmount:   term.AllocatedMoney,
			EntryType:     model.WalletLedgerEntryTypePrepaidRefund,
			OrderId:       term.OrderId,
			TermSegmentId: term.Id,
		}).Error; err != nil {
			return 0, err
		}
		if err := tx.Model(&model.SubscriptionTermSegment{}).Where("id = ? AND status = ?", term.Id, model.SubscriptionTermStatusNotStarted).
			Updates(map[string]interface{}{
				"status":     model.SubscriptionTermStatusRefunded,
				"refund_key": refundKey,
			}).Error; err != nil {
			return 0, err
		}
		totalQuota += int64(refundQuota)
	}
	return totalQuota, nil
}

func createPrepaidTermSegmentsTx(tx *gorm.DB, contractID int64, orderID int, planID int, allocation PrepaidTermAllocation, periodStart int64, months int) error {
	if allocation.CanonicalWalletUnitPrice < 0 {
		return errors.New("canonical wallet unit price cannot be negative")
	}
	start := time.Unix(periodStart, 0)
	for i := 0; i < months; i++ {
		status := model.SubscriptionTermStatusNotStarted
		if i == 0 {
			status = model.SubscriptionTermStatusActive
		}
		segment := &model.SubscriptionTermSegment{
			ContractId:     contractID,
			OrderId:        orderID,
			PlanId:         planID,
			SegmentIndex:   i,
			StartTime:      start.AddDate(0, i, 0).Unix(),
			EndTime:        start.AddDate(0, i+1, 0).Unix(),
			AllocatedMoney: allocation.CanonicalWalletUnitPrice,
			Status:         status,
		}
		if err := tx.Create(segment).Error; err != nil {
			return err
		}
	}
	return nil
}

func markPrepaidPurchaseAppliedTx(tx *gorm.DB, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent, plan *model.SubscriptionPlan, periodStart int64, periodEnd int64, tradeNo string, paymentMethod string) error {
	intent.Status = model.SubscriptionChangeIntentStatusApplied
	intent.WalletDebitTradeNo = tradeNo
	intent.EffectiveAt = periodStart
	if err := tx.Model(intent).Updates(map[string]interface{}{
		"status":                intent.Status,
		"wallet_debit_trade_no": intent.WalletDebitTradeNo,
		"effective_at":          intent.EffectiveAt,
		"updated_at":            common.GetTimestamp(),
	}).Error; err != nil {
		return err
	}
	renewalSource, renewalStatus := "", ""
	// Confirmed Flatkey product behavior: a successful wallet-balance purchase
	// opts into Flatkey wallet auto-renew by default. Pix, UPI, Alipay, and
	// other prepaid methods keep the canonical renewal fields empty.
	if strings.TrimSpace(paymentMethod) == model.PaymentMethodBalance {
		renewalSource = model.SubscriptionRenewalSourceWallet
		renewalStatus = model.SubscriptionRenewalStatusEnabled
	}
	return tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"current_plan_id":             plan.Id,
		"current_provider_binding_id": 0,
		"latest_change_intent_id":     intent.Id,
		"pending_plan_id":             0,
		"pending_effective_at":        0,
		"current_period_start":        periodStart,
		"current_period_end":          periodEnd,
		"payment_mode":                model.SubscriptionPaymentModePrepaid,
		"renewal_source":              renewalSource,
		"renewal_status":              renewalStatus,
		"status":                      model.SubscriptionContractStatusActive,
		"change_version":              intent.ChangeVersion,
	}).Error
}

func subscriptionPurchasePlanSnapshot(plan *model.SubscriptionPlan) (string, error) {
	payload := purchasePlanSnapshot{
		PlanID:           plan.Id,
		Title:            plan.Title,
		PriceAmount:      plan.PriceAmount,
		Currency:         plan.Currency,
		StripePriceID:    strings.TrimSpace(plan.StripePriceId),
		DurationUnit:     plan.DurationUnit,
		DurationValue:    plan.DurationValue,
		TotalAmount:      plan.TotalAmount,
		Window5hAmount:   plan.Window5hAmount,
		WindowWeekAmount: plan.WindowWeekAmount,
		QuotaResetPeriod: plan.QuotaResetPeriod,
		UpgradeGroup:     plan.UpgradeGroup,
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func subscriptionPurchaseMoney(unitPrice float64, months int) float64 {
	return decimal.NewFromFloat(unitPrice).Mul(decimal.NewFromInt(int64(months))).InexactFloat64()
}

func resolveSubscriptionPurchaseQuote(plan model.SubscriptionPlan, choice string, months int) (SubscriptionPurchaseQuote, error) {
	quote, err := subscriptionPurchaseQuoteResolver(plan, choice, months)
	if err != nil {
		return SubscriptionPurchaseQuote{}, err
	}
	return validateSubscriptionPurchaseQuoteForChoice(quote, choice, months)
}

func quoteForSubscriptionPurchase(plan model.SubscriptionPlan, cmd PurchaseSubscriptionCommand) (SubscriptionPurchaseQuote, error) {
	if cmd.VerifiedQuote == nil {
		return SubscriptionPurchaseQuote{}, ErrSubscriptionPurchaseQuoteRequired
	}
	if cmd.PaymentChoice == SubscriptionPaymentChoiceStripeRecurring {
		return SubscriptionPurchaseQuote{}, errors.New("stripe_recurring does not accept a one-time quote")
	}
	return validateSubscriptionPurchaseQuoteForChoice(*cmd.VerifiedQuote, cmd.PaymentChoice, cmd.Months)
}

func replayExistingSubscriptionPurchase(cmd PurchaseSubscriptionCommand) (*PurchaseSubscriptionResult, bool, error) {
	var result *PurchaseSubscriptionResult
	foundReplay := false
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := subscriptionCommandLock(tx).Where("id = ?", cmd.UserID).First(&user).Error; err != nil {
			return err
		}
		existing, found, err := findIntentByRequestTx(tx, cmd.UserID, cmd.RequestID)
		if err != nil || !found {
			return err
		}
		replay, err := buildPurchaseReplayResultTx(tx, cmd, existing)
		if err != nil {
			return err
		}
		result = replay
		foundReplay = true
		return nil
	})
	if err != nil {
		return nil, false, err
	}
	if foundReplay && result != nil && result.Order != nil {
		if err := expirePendingSupersededStripeCheckoutsForReplacement(context.Background(), result.Order.TradeNo); err != nil {
			return nil, false, err
		}
	}
	return result, foundReplay, nil
}

func validateAuthoritativeSubscriptionPurchaseQuote(ctx context.Context, cmd PurchaseSubscriptionCommand) (SubscriptionPurchaseQuote, error) {
	if cmd.VerifiedQuote == nil {
		return SubscriptionPurchaseQuote{}, ErrSubscriptionPurchaseQuoteRequired
	}
	plan, err := model.GetSubscriptionPlanById(cmd.PlanID)
	if err != nil {
		return SubscriptionPurchaseQuote{}, err
	}
	plan.NormalizeDefaults()
	expected, err := resolveSubscriptionPurchaseQuote(*plan, cmd.PaymentChoice, cmd.Months)
	if err != nil {
		return SubscriptionPurchaseQuote{}, err
	}
	account, err := model.GetSubscriptionDiscountAccount(cmd.UserID)
	if err != nil {
		return SubscriptionPurchaseQuote{}, err
	}
	expected, err = applySubscriptionPurchaseDiscounts(ctx, cmd.UserID, cmd.RecallClaim, *plan, expected, account.AvailableUSDMinor, cmd.Months)
	if err != nil {
		return SubscriptionPurchaseQuote{}, err
	}
	tokenQuote, err := validateSubscriptionPurchaseQuoteForChoice(*cmd.VerifiedQuote, cmd.PaymentChoice, cmd.Months)
	if err != nil {
		return SubscriptionPurchaseQuote{}, err
	}
	if tokenQuote.DiscountKind == SubscriptionDiscountKindRecall && expected.DiscountKind != SubscriptionDiscountKindRecall {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase recall claim is required")
	}
	if err := compareSubscriptionPurchaseQuotes(expected, tokenQuote); err != nil {
		return SubscriptionPurchaseQuote{}, fmt.Errorf("%w: %v", ErrSubscriptionPurchaseQuoteInvalid, err)
	}
	if cmd.PaymentChoice == SubscriptionPaymentChoiceStripeRecurring &&
		expected.DiscountKind == SubscriptionDiscountKindRecall &&
		strings.TrimSpace(expected.RecallPromotionCodeID) != strings.TrimSpace(tokenQuote.RecallPromotionCodeID) {
		return SubscriptionPurchaseQuote{}, fmt.Errorf("%w: subscription purchase quote mismatch", ErrSubscriptionPurchaseQuoteInvalid)
	}
	return expected, nil
}

func rejectConvertedRecallClaimQuoteReuse(ctx context.Context, cmd PurchaseSubscriptionCommand) error {
	claim := strings.TrimSpace(cmd.RecallClaim)
	if claim == "" || cmd.VerifiedQuote == nil || cmd.VerifiedQuote.DiscountAmountMinor <= 0 {
		return nil
	}
	record, found, err := model.FindRecallClaimByHashWithContext(ctx, recallClaimTokenHash(claim))
	if err != nil || !found {
		return nil
	}
	if record.Recipient.State == model.RecallRecipientConverted &&
		cmd.VerifiedQuote.RecallCampaignID == record.Campaign.Id &&
		cmd.VerifiedQuote.RecallRecipientID == record.Recipient.Id {
		return ErrRecallClaimConverted
	}
	return nil
}

func validateSubscriptionPurchaseQuoteMatchesPlan(plan model.SubscriptionPlan, cmd PurchaseSubscriptionCommand, quote SubscriptionPurchaseQuote) error {
	base, err := resolveSubscriptionPurchaseQuote(plan, cmd.PaymentChoice, cmd.Months)
	if err != nil {
		return err
	}
	if base.Currency != quote.Currency ||
		base.UnitAmountMinor != quote.UnitAmountMinor ||
		base.OriginalTotalAmountMinor != quote.OriginalTotalAmountMinor {
		return fmt.Errorf("%w: subscription purchase quote mismatch", ErrSubscriptionPurchaseQuoteInvalid)
	}
	return nil
}

func applyRecallFirstMonthDiscount(ctx context.Context, userID int, claim string, plan model.SubscriptionPlan, quote SubscriptionPurchaseQuote) (SubscriptionPurchaseQuote, error) {
	claim = strings.TrimSpace(claim)
	RecordRecallClaimAttribution(ctx, userID, claim)
	if !operation_setting.IsRecallCampaignEnabled() || strings.TrimSpace(plan.StripePriceId) == "" {
		return quote, nil
	}
	offer, err := GetRecallRuntime().Claims.ResolveBestRecallOffer(
		ctx,
		userID,
		RecallPurchaseKindSubscription,
		strings.TrimSpace(plan.StripePriceId),
		quote.Currency,
		quote.UnitAmountMinor,
	)
	if err != nil {
		common.SysLog(fmt.Sprintf("subscription purchase recall offer resolution failed user_id=%d plan_id=%d price_id=%s error=%q", userID, plan.Id, plan.StripePriceId, err.Error()))
		return quote, nil
	}
	if offer == nil || offer.DiscountMinor <= 0 {
		return quote, nil
	}
	discountMinor := offer.DiscountMinor
	quote.DiscountAmountMinor = discountMinor
	quote.DiscountAmount = subscriptionPurchaseAmountFromMinor(discountMinor, quote.Currency)
	quote.PaymentAmountMinor = quote.OriginalTotalAmountMinor - discountMinor
	quote.Total = subscriptionPurchaseAmountFromMinor(quote.PaymentAmountMinor, quote.Currency)
	quote.RecallCampaignID = offer.View.CampaignID
	quote.RecallRecipientID = offer.View.RecipientID
	quote.RecallPromotionCodeID = offer.PromotionCodeID
	return quote, nil
}

func applySubscriptionPurchaseDiscounts(ctx context.Context, userID int, recallClaim string, plan model.SubscriptionPlan, quote SubscriptionPurchaseQuote, invitationAvailableUSDMinor int64, months int) (SubscriptionPurchaseQuote, error) {
	recallQuote, err := applyRecallFirstMonthDiscount(ctx, userID, recallClaim, plan, quote)
	if err != nil {
		return SubscriptionPurchaseQuote{}, err
	}
	otherKind := ""
	otherAmountMinor := int64(0)
	if recallQuote.DiscountAmountMinor > 0 {
		otherKind = SubscriptionDiscountKindRecall
		otherAmountMinor = recallQuote.DiscountAmountMinor
	}
	canonicalUSDQuote := subscriptionPurchaseQuoteFromUnitPrice(plan.Currency, plan.PriceAmount, months)
	discountQuote, err := BuildSubscriptionDiscountQuote(SubscriptionDiscountQuoteInput{
		Currency:                 quote.Currency,
		OriginalAmountMinor:      quote.OriginalTotalAmountMinor,
		OriginalUSDMinor:         canonicalUSDQuote.OriginalTotalAmountMinor,
		AvailableUSDMinor:        invitationAvailableUSDMinor,
		OtherDiscountKind:        otherKind,
		OtherDiscountAmountMinor: otherAmountMinor,
	})
	if err != nil {
		return SubscriptionPurchaseQuote{}, err
	}
	quote.DiscountKind = discountQuote.SelectedKind
	quote.DiscountAmountMinor = discountQuote.SelectedDiscountAmountMinor
	quote.DiscountAmount = subscriptionPurchaseAmountFromMinor(quote.DiscountAmountMinor, quote.Currency)
	quote.PaymentAmountMinor = discountQuote.FinalAmountMinor
	quote.Total = subscriptionPurchaseAmountFromMinor(quote.PaymentAmountMinor, quote.Currency)
	quote.InvitationAvailableUSDMinor = discountQuote.InvitationAvailableUSDMinor
	quote.InvitationDiscountUSDMinor = discountQuote.InvitationDiscountUSDMinor
	quote.InvitationDiscountAmountMinor = discountQuote.InvitationDiscountAmountMinor
	quote.InvitationRemainingUSDMinor = discountQuote.InvitationRemainingUSDMinor
	quote.OtherDiscountKind = discountQuote.OtherDiscountKind
	quote.OtherDiscountAmountMinor = discountQuote.OtherDiscountAmountMinor
	if discountQuote.SelectedKind == SubscriptionDiscountKindRecall {
		quote.RecallCampaignID = recallQuote.RecallCampaignID
		quote.RecallRecipientID = recallQuote.RecallRecipientID
		quote.RecallPromotionCodeID = recallQuote.RecallPromotionCodeID
	}
	return quote, nil
}

func compareSubscriptionPurchaseQuotes(expected SubscriptionPurchaseQuote, actual SubscriptionPurchaseQuote) error {
	if expected.Currency != actual.Currency ||
		expected.UnitAmountMinor != actual.UnitAmountMinor ||
		expected.OriginalTotalAmountMinor != actual.OriginalTotalAmountMinor ||
		expected.DiscountKind != actual.DiscountKind ||
		expected.DiscountAmountMinor != actual.DiscountAmountMinor ||
		expected.PaymentAmountMinor != actual.PaymentAmountMinor ||
		expected.InvitationAvailableUSDMinor != actual.InvitationAvailableUSDMinor ||
		expected.InvitationDiscountUSDMinor != actual.InvitationDiscountUSDMinor ||
		expected.InvitationDiscountAmountMinor != actual.InvitationDiscountAmountMinor ||
		expected.InvitationRemainingUSDMinor != actual.InvitationRemainingUSDMinor ||
		expected.OtherDiscountKind != actual.OtherDiscountKind ||
		expected.OtherDiscountAmountMinor != actual.OtherDiscountAmountMinor ||
		expected.RecallCampaignID != actual.RecallCampaignID ||
		expected.RecallRecipientID != actual.RecallRecipientID {
		return errors.New("subscription purchase quote mismatch")
	}
	return nil
}

func validateSubscriptionPurchaseQuoteForChoice(quote SubscriptionPurchaseQuote, choice string, months int) (SubscriptionPurchaseQuote, error) {
	if months < 1 {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote months must be positive")
	}
	quote.Currency = strings.ToUpper(strings.TrimSpace(quote.Currency))
	if quote.Currency == "" {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote currency is required")
	}
	if quote.UnitPrice < 0 || quote.Total < 0 || quote.PaymentAmountMinor < 0 || quote.DiscountAmountMinor < 0 {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote price cannot be negative")
	}
	if quote.InvitationAvailableUSDMinor < 0 || quote.InvitationDiscountUSDMinor < 0 ||
		quote.InvitationDiscountAmountMinor < 0 || quote.InvitationRemainingUSDMinor < 0 ||
		quote.OtherDiscountAmountMinor < 0 {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote discount amount cannot be negative")
	}
	if quote.Total > 0 && quote.PaymentAmountMinor == 0 {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote minor amount is required")
	}
	if quote.PaymentAmountMinor != subscriptionPurchaseMinorAmountForCurrency(quote.Total, quote.Currency) {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote minor amount does not match total")
	}
	unitAmountMinor := quote.UnitAmountMinor
	if unitAmountMinor == 0 {
		unitAmountMinor = subscriptionPurchaseMinorAmountForCurrency(quote.UnitPrice, quote.Currency)
	}
	originalTotalMinor := quote.OriginalTotalAmountMinor
	if originalTotalMinor == 0 {
		originalTotalMinor = unitAmountMinor * int64(months)
	}
	if unitAmountMinor > math.MaxInt64/int64(months) || originalTotalMinor != unitAmountMinor*int64(months) {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote total does not match rounded monthly minor amount")
	}
	if quote.PaymentAmountMinor != originalTotalMinor-quote.DiscountAmountMinor {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote discounted total does not match original total")
	}
	quote.DiscountKind = strings.TrimSpace(quote.DiscountKind)
	if quote.DiscountKind == "" {
		if quote.DiscountAmountMinor > 0 {
			quote.DiscountKind = SubscriptionDiscountKindRecall
		} else {
			quote.DiscountKind = SubscriptionDiscountKindNone
		}
	}
	quote.OtherDiscountKind = strings.TrimSpace(quote.OtherDiscountKind)
	switch quote.DiscountKind {
	case SubscriptionDiscountKindNone:
		if quote.DiscountAmountMinor != 0 {
			return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote discount kind is invalid")
		}
	case SubscriptionDiscountKindInvitation:
		if quote.DiscountAmountMinor > originalTotalMinor {
			return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote discount exceeds original total")
		}
		if quote.RecallCampaignID != 0 || quote.RecallRecipientID != 0 || strings.TrimSpace(quote.RecallPromotionCodeID) != "" {
			return SubscriptionPurchaseQuote{}, errors.New("subscription purchase invitation discount cannot carry recall identity")
		}
	case SubscriptionDiscountKindRecall:
		if quote.DiscountAmountMinor <= 0 {
			return SubscriptionPurchaseQuote{}, errors.New("subscription purchase recall discount requires discount")
		}
		if quote.DiscountAmountMinor > unitAmountMinor {
			return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote discount exceeds first month")
		}
		if quote.RecallCampaignID <= 0 || quote.RecallRecipientID <= 0 {
			return SubscriptionPurchaseQuote{}, errors.New("subscription purchase recall identity is required")
		}
		if quote.OtherDiscountKind == "" {
			quote.OtherDiscountKind = SubscriptionDiscountKindRecall
		}
		if quote.OtherDiscountAmountMinor == 0 {
			quote.OtherDiscountAmountMinor = quote.DiscountAmountMinor
		}
		quote.RecallPromotionCodeID = strings.TrimSpace(quote.RecallPromotionCodeID)
	default:
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote discount kind is invalid")
	}
	if quote.DiscountKind != SubscriptionDiscountKindRecall &&
		(quote.RecallCampaignID != 0 || quote.RecallRecipientID != 0 || strings.TrimSpace(quote.RecallPromotionCodeID) != "") {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase recall identity requires recall discount")
	}
	switch choice {
	case SubscriptionPaymentChoicePix:
		if quote.Currency != "BRL" {
			return SubscriptionPurchaseQuote{}, errors.New("Pix subscription purchase quote must be BRL")
		}
	case SubscriptionPaymentChoiceUPI:
		if quote.Currency != "INR" {
			return SubscriptionPurchaseQuote{}, errors.New("UPI subscription purchase quote must be INR")
		}
	}
	quote.UnitAmountMinor = unitAmountMinor
	quote.OriginalTotalAmountMinor = originalTotalMinor
	quote.UnitPrice = subscriptionPurchaseAmountFromMinor(unitAmountMinor, quote.Currency)
	quote.OriginalTotal = subscriptionPurchaseAmountFromMinor(originalTotalMinor, quote.Currency)
	quote.DiscountAmount = subscriptionPurchaseAmountFromMinor(quote.DiscountAmountMinor, quote.Currency)
	quote.Total = subscriptionPurchaseAmountFromMinor(quote.PaymentAmountMinor, quote.Currency)
	return quote, nil
}

func defaultSubscriptionPurchaseQuote(plan model.SubscriptionPlan, choice string, months int) (SubscriptionPurchaseQuote, error) {
	switch choice {
	case SubscriptionPaymentChoicePix:
		if plan.PixPriceBRL == nil {
			return SubscriptionPurchaseQuote{}, fmt.Errorf("%w: Pix local quote is not configured", ErrSubscriptionPurchaseQuoteUnavailable)
		}
		return subscriptionPurchaseQuoteFromUnitPrice("BRL", *plan.PixPriceBRL, months), nil
	case SubscriptionPaymentChoiceUPI:
		if plan.UpiPriceINR == nil {
			return SubscriptionPurchaseQuote{}, fmt.Errorf("%w: UPI local quote is not configured", ErrSubscriptionPurchaseQuoteUnavailable)
		}
		return subscriptionPurchaseQuoteFromUnitPrice("INR", *plan.UpiPriceINR, months), nil
	default:
		return subscriptionPurchaseQuoteFromUnitPrice(plan.Currency, plan.PriceAmount, months), nil
	}
}

func subscriptionPurchaseQuoteFromUnitPrice(currency string, unitPrice float64, months int) SubscriptionPurchaseQuote {
	currency = strings.ToUpper(strings.TrimSpace(currency))
	unitAmountMinor := subscriptionPurchaseMinorAmountForCurrency(unitPrice, currency)
	totalAmountMinor := unitAmountMinor * int64(months)
	return SubscriptionPurchaseQuote{
		Currency:                 currency,
		UnitPrice:                subscriptionPurchaseAmountFromMinor(unitAmountMinor, currency),
		UnitAmountMinor:          unitAmountMinor,
		OriginalTotal:            subscriptionPurchaseAmountFromMinor(totalAmountMinor, currency),
		OriginalTotalAmountMinor: totalAmountMinor,
		Total:                    subscriptionPurchaseAmountFromMinor(totalAmountMinor, currency),
		PaymentAmountMinor:       totalAmountMinor,
	}
}

func subscriptionPurchaseQuoteResult(quote SubscriptionPurchaseQuote) *SubscriptionPurchaseQuoteResult {
	return &SubscriptionPurchaseQuoteResult{
		Available:                     true,
		Currency:                      quote.Currency,
		UnitPrice:                     quote.UnitPrice,
		UnitAmountMinor:               quote.UnitAmountMinor,
		OriginalTotal:                 quote.OriginalTotal,
		OriginalTotalAmountMinor:      quote.OriginalTotalAmountMinor,
		DiscountKind:                  quote.DiscountKind,
		DiscountAmount:                quote.DiscountAmount,
		DiscountAmountMinor:           quote.DiscountAmountMinor,
		Total:                         quote.Total,
		PaymentAmountMinor:            quote.PaymentAmountMinor,
		InvitationAvailableUSDMinor:   quote.InvitationAvailableUSDMinor,
		InvitationDiscountUSDMinor:    quote.InvitationDiscountUSDMinor,
		InvitationDiscountAmountMinor: quote.InvitationDiscountAmountMinor,
		InvitationRemainingUSDMinor:   quote.InvitationRemainingUSDMinor,
		OtherDiscountKind:             quote.OtherDiscountKind,
		OtherDiscountAmountMinor:      quote.OtherDiscountAmountMinor,
		RecallCampaignID:              quote.RecallCampaignID,
		RecallRecipientID:             quote.RecallRecipientID,
		RecallPromotionCodeID:         quote.RecallPromotionCodeID,
	}
}

func subscriptionPurchaseMinorAmount(total float64) int64 {
	return decimal.NewFromFloat(total).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
}

func subscriptionPurchaseMinorAmountForCurrency(total float64, currency string) int64 {
	amount, _ := stripeMinorUnitAmountForSubscription(total, currency)
	return amount
}

func SubscriptionPurchaseAmountFromMinor(minor int64, currency string) float64 {
	scale := int32(2)
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF":
		scale = 0
	}
	return decimal.NewFromInt(minor).Shift(-scale).InexactFloat64()
}

func subscriptionPurchaseAmountFromMinor(minor int64, currency string) float64 {
	return SubscriptionPurchaseAmountFromMinor(minor, currency)
}

func deliverInviteSubscriptionRewardAfterOrderCompleted(ctx context.Context, tradeNo string) {
	tradeNo = strings.TrimSpace(tradeNo)
	if tradeNo == "" {
		return
	}
	if err := tryGrantInviteSubscriptionRewardAfterOrderCompleted(tradeNo); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("invite subscription reward delivery failed trade_no=%s error=%q", tradeNo, err.Error()))
	}
}

func subscriptionMoneyQuota(money float64) (int, error) {
	return subscriptionBalanceQuota(money)
}

func subscriptionPurchaseTradeNo(userID int, intentID int64) string {
	return fmt.Sprintf("SUBPURUSR%dINT%dNO%s%d", userID, intentID, common.GetRandomString(6), time.Now().UnixNano())
}

func paymentProviderForPurchaseChoice(choice string) string {
	switch choice {
	case SubscriptionPaymentChoiceBalance:
		return model.PaymentProviderBalance
	case SubscriptionPaymentChoiceEpay:
		return model.PaymentProviderEpay
	case SubscriptionPaymentChoiceAlipay, SubscriptionPaymentChoicePix, SubscriptionPaymentChoiceUPI:
		return model.PaymentProviderStripe
	default:
		return ""
	}
}
