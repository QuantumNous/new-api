package service

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

const (
	SubscriptionPaymentChoiceStripeRecurring = "stripe_recurring"
	SubscriptionPaymentChoiceAlipay          = "alipay"
	SubscriptionPaymentChoicePix             = "pix"
	SubscriptionPaymentChoiceUPI             = "upi"
	SubscriptionPaymentChoiceBalance         = "balance"
)

type PurchaseSubscriptionCommand struct {
	UserID        int
	PlanID        int
	PaymentChoice string
	Months        int
	RequestID     string
	VerifiedQuote *SubscriptionPurchaseQuote
	UIMode        string
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
	Currency           string
	UnitPrice          float64
	Total              float64
	PaymentAmountMinor int64
}

type PrepaidTermAllocation struct {
	CanonicalWalletUnitPrice float64
}

var subscriptionPurchaseQuoteResolver = defaultSubscriptionPurchaseQuote

var ErrSubscriptionPurchaseQuoteUnavailable = errors.New("subscription purchase quote unavailable")

type SubscriptionPurchaseQuoteResult struct {
	Available          bool    `json:"available"`
	UnavailableReason  string  `json:"unavailable_reason,omitempty"`
	Currency           string  `json:"currency,omitempty"`
	UnitPrice          float64 `json:"unit_price,omitempty"`
	Total              float64 `json:"total,omitempty"`
	PaymentAmountMinor int64   `json:"payment_amount_minor,omitempty"`
}

type purchasePlanSnapshot struct {
	PlanID              int     `json:"plan_id"`
	Title               string  `json:"title"`
	PriceAmount         float64 `json:"price_amount"`
	Currency            string  `json:"currency"`
	DurationUnit        string  `json:"duration_unit"`
	DurationValue       int     `json:"duration_value"`
	TotalAmount         int64   `json:"total_amount"`
	Window5hAmount      int64   `json:"window_5h_amount"`
	WindowWeekAmount    int64   `json:"window_week_amount"`
	MediaCreditsMonthly int64   `json:"media_credits_monthly"`
	QuotaResetPeriod    string  `json:"quota_reset_period"`
	UpgradeGroup        string  `json:"upgrade_group"`
}

func QuoteSubscriptionPurchase(cmd PurchaseSubscriptionCommand) (*SubscriptionPurchaseQuoteResult, error) {
	cmd.normalize()
	if err := cmd.validateQuote(); err != nil {
		return nil, err
	}
	if cmd.PaymentChoice == SubscriptionPaymentChoiceStripeRecurring {
		plan, err := model.GetSubscriptionPlanById(cmd.PlanID)
		if err != nil {
			return nil, err
		}
		plan.NormalizeDefaults()
		quote, err := resolveSubscriptionPurchaseQuote(*plan, cmd.PaymentChoice, cmd.Months)
		if err != nil {
			if errors.Is(err, ErrSubscriptionPurchaseQuoteUnavailable) {
				return &SubscriptionPurchaseQuoteResult{Available: false, UnavailableReason: err.Error()}, nil
			}
			return nil, err
		}
		return subscriptionPurchaseQuoteResult(quote), nil
	}
	var result *SubscriptionPurchaseQuoteResult
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var user model.User
		if err := tx.Where("id = ?", cmd.UserID).First(&user).Error; err != nil {
			return err
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
		quote, err := resolveSubscriptionPurchaseQuote(*plan, cmd.PaymentChoice, cmd.Months)
		if err != nil {
			if errors.Is(err, ErrSubscriptionPurchaseQuoteUnavailable) {
				result = &SubscriptionPurchaseQuoteResult{Available: false, UnavailableReason: err.Error()}
				return nil
			}
			return err
		}
		result = subscriptionPurchaseQuoteResult(quote)
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func PurchaseSubscription(cmd PurchaseSubscriptionCommand) (*PurchaseSubscriptionResult, error) {
	cmd.normalize()
	if err := cmd.validate(); err != nil {
		return nil, err
	}
	if cmd.PaymentChoice == SubscriptionPaymentChoiceStripeRecurring {
		change, err := ChangeSubscriptionPlan(ChangePlanCommand{
			UserID:      cmd.UserID,
			PlanID:      cmd.PlanID,
			PaymentMode: model.SubscriptionPaymentModeStripeRecurring,
			RequestID:   cmd.RequestID,
			UIMode:      cmd.UIMode,
		})
		if err != nil {
			return nil, err
		}
		return &PurchaseSubscriptionResult{
			Status:           change.Status,
			Contract:         change.Contract,
			Intent:           change.Intent,
			CheckoutURL:      change.CheckoutURL,
			HostedInvoiceURL: change.HostedInvoiceURL,
			ClientSecret:     change.ClientSecret,
		}, nil
	}

	var supersededCheckouts []supersededStripeCheckout
	if cmd.PaymentChoice == SubscriptionPaymentChoiceAlipay || cmd.PaymentChoice == SubscriptionPaymentChoicePix || cmd.PaymentChoice == SubscriptionPaymentChoiceUPI || cmd.PaymentChoice == SubscriptionPaymentChoiceBalance {
		var err error
		supersededCheckouts, err = supersedeReplaceablePendingStripeCheckouts(context.Background(), cmd.UserID, cmd.RequestID)
		if err != nil {
			return nil, err
		}
	}
	var result *PurchaseSubscriptionResult
	var effects *balanceOnePeriodSideEffects
	err := model.DB.Transaction(func(tx *gorm.DB) error {
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
		if err := enforceMaxPurchasePerUserTx(tx, cmd.UserID, plan); err != nil {
			return err
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

		if cmd.PaymentChoice != SubscriptionPaymentChoiceBalance {
			order, err := createPendingOneTimePurchaseOrderTx(tx, &user, contract, intent, plan, cmd)
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
		applied, debitEffects, err := applyBalancePrepaidPurchaseTx(tx, &user, contract, intent, plan, cmd, quote)
		if err != nil {
			return err
		}
		effects = debitEffects
		result = applied
		return nil
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
	applyBalanceOnePeriodSideEffects(effects)
	return result, nil
}

func (cmd *PurchaseSubscriptionCommand) normalize() {
	cmd.PaymentChoice = strings.TrimSpace(cmd.PaymentChoice)
	cmd.RequestID = strings.TrimSpace(cmd.RequestID)
	cmd.UIMode = strings.ToLower(strings.TrimSpace(cmd.UIMode))
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
	if order.UserId != cmd.UserID || order.PlanId != cmd.PlanID || order.PurchaseMonths != cmd.Months || order.PaymentMethod != cmd.PaymentChoice {
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

func createPendingOneTimePurchaseOrderTx(tx *gorm.DB, user *model.User, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent, plan *model.SubscriptionPlan, cmd PurchaseSubscriptionCommand) (*model.SubscriptionOrder, error) {
	snapshot, err := subscriptionPurchasePlanSnapshot(plan)
	if err != nil {
		return nil, err
	}
	quote, err := quoteForSubscriptionPurchase(*plan, cmd)
	if err != nil {
		return nil, err
	}
	now := common.GetTimestamp()
	order := &model.SubscriptionOrder{
		UserId:             user.Id,
		PlanId:             plan.Id,
		Money:              quote.Total,
		TradeNo:            subscriptionPurchaseTradeNo(user.Id, intent.Id),
		PaymentMethod:      cmd.PaymentChoice,
		PaymentProvider:    paymentProviderForPurchaseChoice(cmd.PaymentChoice),
		Status:             common.TopUpStatusPending,
		CreateTime:         now,
		PurchaseMonths:     cmd.Months,
		UnitPrice:          quote.UnitPrice,
		PaymentCurrency:    quote.Currency,
		PaymentAmountMinor: quote.PaymentAmountMinor,
		PlanSnapshot:       snapshot,
		PurchaseIntent:     intent.Kind,
		RenewalSource:      model.SubscriptionRenewalSourceWallet,
		ProviderPayload:    fmt.Sprintf("choice=%s;months=%d;contract_id=%d;change_intent_id=%d", cmd.PaymentChoice, cmd.Months, contract.Id, intent.Id),
		ChangeIntentId:     intent.Id,
	}
	if err := tx.Create(order).Error; err != nil {
		return nil, err
	}
	return order, nil
}

func applyBalancePrepaidPurchaseTx(tx *gorm.DB, user *model.User, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent, plan *model.SubscriptionPlan, cmd PurchaseSubscriptionCommand, quote SubscriptionPurchaseQuote) (*PurchaseSubscriptionResult, *balanceOnePeriodSideEffects, error) {
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
	newQuota := availableQuota - requiredQuota
	if err := tx.Model(&model.User{}).Where("id = ?", user.Id).Update("quota", newQuota).Error; err != nil {
		return nil, nil, err
	}
	user.Quota = newQuota

	snapshot, err := subscriptionPurchasePlanSnapshot(plan)
	if err != nil {
		return nil, nil, err
	}
	now := common.GetTimestamp()
	order := &model.SubscriptionOrder{
		UserId:             user.Id,
		PlanId:             plan.Id,
		Money:              quote.Total,
		TradeNo:            subscriptionPurchaseTradeNo(user.Id, intent.Id),
		PaymentMethod:      model.PaymentMethodBalance,
		PaymentProvider:    model.PaymentProviderBalance,
		Status:             common.TopUpStatusSuccess,
		CreateTime:         now,
		CompleteTime:       now,
		PurchaseMonths:     cmd.Months,
		UnitPrice:          quote.UnitPrice,
		PaymentCurrency:    quote.Currency,
		PaymentAmountMinor: quote.PaymentAmountMinor,
		PlanSnapshot:       snapshot,
		PurchaseIntent:     intent.Kind,
		RenewalSource:      model.SubscriptionRenewalSourceWallet,
		ProviderPayload:    fmt.Sprintf("charged_quota=%d;refunded_quota=%d;choice=%s;months=%d;contract_id=%d;change_intent_id=%d", requiredQuota, refundQuota, cmd.PaymentChoice, cmd.Months, contract.Id, intent.Id),
		ChangeIntentId:     intent.Id,
	}
	if err := tx.Create(order).Error; err != nil {
		return nil, nil, err
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

	periodStart := now
	periodEnd := time.Unix(periodStart, 0).AddDate(0, cmd.Months, 0).Unix()
	grant, err := model.RotateCurrentEntitlementTx(tx, model.GrantEntitlementInput{
		ContractId:           contract.Id,
		UserId:               user.Id,
		PlanId:               plan.Id,
		ProviderBindingId:    0,
		GrantKey:             "prepaid:" + order.TradeNo,
		PaymentMode:          model.SubscriptionPaymentModePrepaid,
		AmountTotal:          plan.TotalAmount,
		MediaCreditsTotal:    plan.MediaCreditsMonthly,
		Window5hAmount:       common.GetPointer(plan.Window5hAmount),
		WindowWeekAmount:     common.GetPointer(plan.WindowWeekAmount),
		UpgradeGroup:         common.GetPointer(plan.UpgradeGroup),
		PeriodStart:          periodStart,
		PeriodEnd:            periodEnd,
		EndReasonForPrevious: previousEntitlementEndReason(intent.Kind),
		Source:               model.PaymentMethodBalance,
	})
	if err != nil {
		return nil, nil, err
	}
	if err := createPrepaidTermSegmentsTx(tx, contract.Id, order.Id, plan.Id, PrepaidTermAllocation{
		CanonicalWalletUnitPrice: plan.PriceAmount,
	}, periodStart, cmd.Months); err != nil {
		return nil, nil, err
	}
	if err := markPrepaidPurchaseAppliedTx(tx, contract, intent, plan, periodStart, periodEnd, order.TradeNo); err != nil {
		return nil, nil, err
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

func markPrepaidPurchaseAppliedTx(tx *gorm.DB, contract *model.UserSubscriptionContract, intent *model.SubscriptionChangeIntent, plan *model.SubscriptionPlan, periodStart int64, periodEnd int64, tradeNo string) error {
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
	return tx.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Updates(map[string]interface{}{
		"current_plan_id":             plan.Id,
		"current_provider_binding_id": 0,
		"latest_change_intent_id":     intent.Id,
		"pending_plan_id":             0,
		"pending_effective_at":        0,
		"current_period_start":        periodStart,
		"current_period_end":          periodEnd,
		"payment_mode":                model.SubscriptionPaymentModePrepaid,
		"renewal_source":              model.SubscriptionRenewalSourceWallet,
		"renewal_status":              model.SubscriptionRenewalStatusEnabled,
		"status":                      model.SubscriptionContractStatusActive,
		"change_version":              intent.ChangeVersion,
	}).Error
}

func subscriptionPurchasePlanSnapshot(plan *model.SubscriptionPlan) (string, error) {
	payload := purchasePlanSnapshot{
		PlanID:              plan.Id,
		Title:               plan.Title,
		PriceAmount:         plan.PriceAmount,
		Currency:            plan.Currency,
		DurationUnit:        plan.DurationUnit,
		DurationValue:       plan.DurationValue,
		TotalAmount:         plan.TotalAmount,
		Window5hAmount:      plan.Window5hAmount,
		WindowWeekAmount:    plan.WindowWeekAmount,
		MediaCreditsMonthly: plan.MediaCreditsMonthly,
		QuotaResetPeriod:    plan.QuotaResetPeriod,
		UpgradeGroup:        plan.UpgradeGroup,
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
		return resolveSubscriptionPurchaseQuote(plan, cmd.PaymentChoice, cmd.Months)
	}
	if cmd.PaymentChoice == SubscriptionPaymentChoiceStripeRecurring {
		return SubscriptionPurchaseQuote{}, errors.New("stripe_recurring does not accept a one-time quote")
	}
	return validateSubscriptionPurchaseQuoteForChoice(*cmd.VerifiedQuote, cmd.PaymentChoice, cmd.Months)
}

func validateSubscriptionPurchaseQuoteForChoice(quote SubscriptionPurchaseQuote, choice string, months int) (SubscriptionPurchaseQuote, error) {
	if months < 1 {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote months must be positive")
	}
	quote.Currency = strings.ToUpper(strings.TrimSpace(quote.Currency))
	if quote.Currency == "" {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote currency is required")
	}
	if quote.UnitPrice < 0 || quote.Total < 0 || quote.PaymentAmountMinor < 0 {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote price cannot be negative")
	}
	if quote.Total > 0 && quote.PaymentAmountMinor == 0 {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote minor amount is required")
	}
	if quote.PaymentAmountMinor != subscriptionPurchaseMinorAmount(quote.Total) {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote minor amount does not match total")
	}
	unitAmountMinor := subscriptionPurchaseMinorAmount(quote.UnitPrice)
	if unitAmountMinor > math.MaxInt64/int64(months) ||
		quote.PaymentAmountMinor != unitAmountMinor*int64(months) {
		return SubscriptionPurchaseQuote{}, errors.New("subscription purchase quote total does not match rounded monthly minor amount")
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
	quote.UnitPrice = float64(unitAmountMinor) / 100
	quote.Total = float64(quote.PaymentAmountMinor) / 100
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
	unitAmountMinor := subscriptionPurchaseMinorAmount(unitPrice)
	totalAmountMinor := unitAmountMinor * int64(months)
	return SubscriptionPurchaseQuote{
		Currency:           currency,
		UnitPrice:          float64(unitAmountMinor) / 100,
		Total:              float64(totalAmountMinor) / 100,
		PaymentAmountMinor: totalAmountMinor,
	}
}

func subscriptionPurchaseQuoteResult(quote SubscriptionPurchaseQuote) *SubscriptionPurchaseQuoteResult {
	return &SubscriptionPurchaseQuoteResult{
		Available:          true,
		Currency:           quote.Currency,
		UnitPrice:          quote.UnitPrice,
		Total:              quote.Total,
		PaymentAmountMinor: quote.PaymentAmountMinor,
	}
}

func subscriptionPurchaseMinorAmount(total float64) int64 {
	return decimal.NewFromFloat(total).Mul(decimal.NewFromInt(100)).Round(0).IntPart()
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
	case SubscriptionPaymentChoiceAlipay, SubscriptionPaymentChoicePix, SubscriptionPaymentChoiceUPI:
		return model.PaymentProviderStripe
	default:
		return ""
	}
}
