package service

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/shopspring/decimal"
	"github.com/stripe/stripe-go/v86"
	"github.com/stripe/stripe-go/v86/checkout/session"
	stripeinvoice "github.com/stripe/stripe-go/v86/invoice"
	stripesubscription "github.com/stripe/stripe-go/v86/subscription"
	"gorm.io/gorm"
)

type StripeSubscriptionCheckoutInput struct {
	TradeNo        string
	UserID         int
	PlanID         int
	ContractID     int64
	ChangeIntentID int64
	CustomerID     string
	Email          string
	PriceID        string
	IdempotencyKey string
	Presentation   StripeCheckoutPresentation
}

type StripeSubscriptionCheckoutSession struct {
	ID           string
	URL          string
	ClientSecret string
}

type StripeCheckoutPresentation struct {
	RequestedUIMode string
	Embedded        bool
}

type PaidInvoiceReconcileResult struct {
	Binding     *model.SubscriptionProviderBinding
	Entitlement *model.UserSubscription
	Applied     bool
}

type paidInvoicePermanentError struct {
	err error
}

func (e paidInvoicePermanentError) Error() string {
	if e.err == nil {
		return ""
	}
	return e.err.Error()
}

func (e paidInvoicePermanentError) Unwrap() error {
	return e.err
}

func PermanentPaidInvoiceError(err error) error {
	if err == nil {
		return nil
	}
	var permanent paidInvoicePermanentError
	if errors.As(err, &permanent) {
		return err
	}
	return paidInvoicePermanentError{err: err}
}

func IsPermanentPaidInvoiceError(err error) bool {
	var permanent paidInvoicePermanentError
	return errors.As(err, &permanent)
}

var stripeInvoiceGetter = getStripeInvoiceForReconcile
var stripeInvoiceVoider = voidStripeInvoiceForReconcile
var stripeSubscriptionGetter = getStripeSubscriptionForReconcile
var stripeSubscriptionCheckoutCreator = createStripeSubscriptionCheckout
var stripeCheckoutSessionGetter = getStripeCheckoutSessionForSubscription
var stripeCheckoutSessionExpirer = expireStripeCheckoutSessionForSubscription

func ResolveStripeCheckoutPresentation(uiMode string) StripeCheckoutPresentation {
	requested := strings.ToLower(strings.TrimSpace(uiMode))
	return StripeCheckoutPresentation{
		RequestedUIMode: requested,
		Embedded:        requested == "embedded" && strings.TrimSpace(setting.StripePublishableKey) != "",
	}
}

func ApplyStripeCheckoutPresentation(params *stripe.CheckoutSessionParams, presentation StripeCheckoutPresentation, tradeNo string) {
	if params == nil || !presentation.Embedded {
		return
	}
	params.UIMode = stripe.String(string(stripe.CheckoutSessionUIModeEmbeddedPage))
	params.ReturnURL = stripe.String(stripeEmbeddedCheckoutReturnURL(tradeNo))
	params.SuccessURL = nil
	params.CancelURL = nil
}

func stripeEmbeddedCheckoutReturnURL(tradeNo string) string {
	base := consoleSubscriptionReturnPath()
	separator := "?"
	if strings.Contains(base, "?") {
		separator = "&"
	}
	return base + separator + "session_id={CHECKOUT_SESSION_ID}&trade_no=" + url.QueryEscape(strings.TrimSpace(tradeNo))
}

func ReplaceStripeCheckoutSessionAccessorsForTest(
	getter func(context.Context, string) (*stripe.CheckoutSession, error),
	expirer func(context.Context, string) (*stripe.CheckoutSession, error),
) func() {
	originalGetter := stripeCheckoutSessionGetter
	originalExpirer := stripeCheckoutSessionExpirer
	if getter != nil {
		stripeCheckoutSessionGetter = getter
	}
	if expirer != nil {
		stripeCheckoutSessionExpirer = expirer
	}
	return func() {
		stripeCheckoutSessionGetter = originalGetter
		stripeCheckoutSessionExpirer = originalExpirer
	}
}

func getStripeInvoiceForReconcile(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
	if err := ensureStripeSecretForSubscription(); err != nil {
		return nil, err
	}
	stripe.Key = setting.StripeApiSecret
	params := &stripe.InvoiceParams{}
	params.AddExpand("lines.data.pricing.price_details.price")
	params.AddExpand("parent.subscription_details.subscription")
	params.AddExpand("customer")
	return stripeinvoice.Get(strings.TrimSpace(invoiceID), params)
}

func voidStripeInvoiceForReconcile(ctx context.Context, invoiceID string, idempotencyKey string) (*stripe.Invoice, error) {
	if err := ensureStripeSecretForSubscription(); err != nil {
		return nil, err
	}
	stripe.Key = setting.StripeApiSecret
	params := &stripe.InvoiceVoidInvoiceParams{}
	if strings.TrimSpace(idempotencyKey) != "" {
		params.SetIdempotencyKey(strings.TrimSpace(idempotencyKey))
	}
	return stripeinvoice.VoidInvoice(strings.TrimSpace(invoiceID), params)
}

func getStripeSubscriptionForReconcile(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
	if err := ensureStripeSecretForSubscription(); err != nil {
		return nil, err
	}
	stripe.Key = setting.StripeApiSecret
	params := &stripe.SubscriptionParams{}
	params.AddExpand("latest_invoice")
	params.AddExpand("items.data.price")
	params.AddExpand("customer")
	return stripesubscription.Get(strings.TrimSpace(subscriptionID), params)
}

func createStripeSubscriptionCheckout(ctx context.Context, input StripeSubscriptionCheckoutInput) (*StripeSubscriptionCheckoutSession, error) {
	if err := ensureStripeSecretForSubscription(); err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.PriceID) == "" {
		return nil, errors.New("Stripe subscription price id is required")
	}
	stripe.Key = setting.StripeApiSecret
	metadata := stripeSubscriptionAuthoritativeMetadata(input.TradeNo, input.UserID, input.PlanID, input.ContractID, input.ChangeIntentID)
	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(input.TradeNo),
		SuccessURL:        stripe.String(consoleSubscriptionReturnPath()),
		CancelURL:         stripe.String(consoleSubscriptionReturnPath()),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(input.PriceID),
				Quantity: stripe.Int64(1),
			},
		},
		Mode:     stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		Metadata: metadata,
		SubscriptionData: &stripe.CheckoutSessionSubscriptionDataParams{
			Metadata: metadata,
		},
	}
	ApplyStripeCheckoutPresentation(params, input.Presentation, input.TradeNo)
	if strings.TrimSpace(input.CustomerID) != "" {
		params.Customer = stripe.String(strings.TrimSpace(input.CustomerID))
	} else {
		if strings.TrimSpace(input.Email) != "" {
			params.CustomerEmail = stripe.String(strings.TrimSpace(input.Email))
		}
	}
	if strings.TrimSpace(input.IdempotencyKey) != "" {
		params.SetIdempotencyKey(strings.TrimSpace(input.IdempotencyKey))
	}
	created, err := session.New(params)
	if err != nil {
		return nil, err
	}
	if created == nil || strings.TrimSpace(created.ID) == "" {
		return nil, errors.New("Stripe checkout session missing id")
	}
	if input.Presentation.Embedded {
		if strings.TrimSpace(created.ClientSecret) == "" {
			return nil, errors.New("Stripe embedded checkout session missing client secret")
		}
	} else if strings.TrimSpace(created.URL) == "" {
		return nil, errors.New("Stripe checkout session missing url")
	}
	return &StripeSubscriptionCheckoutSession{
		ID:           strings.TrimSpace(created.ID),
		URL:          strings.TrimSpace(created.URL),
		ClientSecret: strings.TrimSpace(created.ClientSecret),
	}, nil
}

func getStripeCheckoutSessionForSubscription(ctx context.Context, sessionID string) (*stripe.CheckoutSession, error) {
	if err := ensureStripeSecretForSubscription(); err != nil {
		return nil, err
	}
	stripe.Key = setting.StripeApiSecret
	return session.Get(strings.TrimSpace(sessionID), nil)
}

func expireStripeCheckoutSessionForSubscription(ctx context.Context, sessionID string) (*stripe.CheckoutSession, error) {
	if err := ensureStripeSecretForSubscription(); err != nil {
		return nil, err
	}
	stripe.Key = setting.StripeApiSecret
	return session.Expire(strings.TrimSpace(sessionID), nil)
}

func stripeSubscriptionAuthoritativeMetadata(tradeNo string, userID int, planID int, contractID int64, changeIntentID int64) map[string]string {
	return map[string]string{
		"trade_no":         strings.TrimSpace(tradeNo),
		"user_id":          strconv.Itoa(userID),
		"plan_id":          strconv.Itoa(planID),
		"contract_id":      strconv.FormatInt(contractID, 10),
		"change_intent_id": strconv.FormatInt(changeIntentID, 10),
		"newapi_trade_no":  strings.TrimSpace(tradeNo),
		"newapi_user_id":   strconv.Itoa(userID),
		"newapi_plan_id":   strconv.Itoa(planID),
	}
}

func consoleSubscriptionReturnPath() string {
	base := strings.TrimSpace(system_setting.GetAppConsoleSettings().Origin)
	if normalized, err := system_setting.NormalizeAppConsoleOrigin(base); err == nil && normalized != "" {
		base = normalized
	} else {
		base = system_setting.ServerAddress
	}
	return strings.TrimRight(strings.TrimSpace(base), "/") + "/wallet"
}

func ensureStripeSecretForSubscription() error {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return errors.New("invalid Stripe API key")
	}
	return nil
}

func ReconcilePaidInvoice(ctx context.Context, invoiceID string) (*PaidInvoiceReconcileResult, error) {
	invoiceID = strings.TrimSpace(invoiceID)
	if invoiceID == "" {
		return nil, PermanentPaidInvoiceError(errors.New("Stripe invoice id is required"))
	}
	inv, err := stripeInvoiceGetter(ctx, invoiceID)
	if err != nil {
		return nil, err
	}
	if inv == nil || strings.TrimSpace(inv.ID) == "" {
		return nil, errors.New("Stripe invoice is missing")
	}
	if !stripeInvoiceIsPaid(inv) {
		return nil, errors.New("Stripe invoice is not paid")
	}
	subscriptionID := stripeInvoiceSubscriptionID(inv)
	if subscriptionID == "" {
		return nil, PermanentPaidInvoiceError(errors.New("Stripe invoice subscription id is missing"))
	}
	sub, err := stripeSubscriptionGetter(ctx, subscriptionID)
	if err != nil {
		return nil, err
	}
	facts, err := validatePaidInvoiceFacts(inv, sub)
	if err != nil {
		return nil, err
	}
	recurringUpgrade, err := isStripeRecurringSubscriptionUpgrade(facts)
	if err != nil {
		return nil, err
	}
	if recurringUpgrade {
		facts, err = resumeStripeSubscriptionUpgradeIfNeeded(facts)
		if err != nil {
			return nil, err
		}
	}
	result := &PaidInvoiceReconcileResult{}
	err = model.DB.Transaction(func(tx *gorm.DB) error {
		var existingBinding model.SubscriptionProviderBinding
		if err := tx.Where("provider = ? AND provider_subscription_id = ?", model.PaymentProviderStripe, facts.SubscriptionID).First(&existingBinding).Error; err == nil {
			if recurringUpgrade {
				handled, err := reconcilePaidInvoiceUpgradeTx(tx, facts, result)
				if err != nil {
					return err
				}
				if !handled {
					return PermanentPaidInvoiceError(errors.New("Stripe paid invoice upgrade intent mismatch"))
				}
				return nil
			}
			return reconcilePaidInvoiceRenewalTx(tx, facts, result)
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if !facts.hasCompletePurchaseMetadata() {
			return nil
		}
		order, intent, contract, plan, user, err := lockInvoicePurchaseFactsTx(tx, facts)
		if err != nil {
			return err
		}
		planSnapshot, err := recurringPlanSnapshotFromOrder(order)
		if err != nil {
			return PermanentPaidInvoiceError(err)
		}
		if err := validateLocalInvoiceFacts(facts, order, intent, contract, plan, user, planSnapshot); err != nil {
			return PermanentPaidInvoiceError(err)
		}
		binding, err := createOrLoadStripeInvoiceBindingTx(tx, order, contract.Id, providerSnapshotFromPaidInvoice(facts, invoiceID))
		if err != nil {
			return err
		}
		grant, err := model.RotateCurrentEntitlementTx(tx, model.GrantEntitlementInput{
			ContractId:           contract.Id,
			UserId:               order.UserId,
			PlanId:               order.PlanId,
			ProviderBindingId:    binding.Id,
			GrantKey:             "stripe:" + invoiceID,
			PaymentMode:          model.SubscriptionPaymentModeStripeRecurring,
			AmountTotal:          recurringInvoiceGrantAmountTotal(plan, planSnapshot),
			MediaCreditsTotal:    recurringInvoiceGrantMediaCredits(plan, planSnapshot),
			Window5hAmount:       recurringInvoiceGrantWindow5h(plan, planSnapshot),
			WindowWeekAmount:     recurringInvoiceGrantWindowWeek(plan, planSnapshot),
			UpgradeGroup:         recurringInvoiceGrantUpgradeGroup(plan, planSnapshot),
			PeriodStart:          facts.PeriodStart,
			PeriodEnd:            facts.PeriodEnd,
			EndReasonForPrevious: previousEntitlementEndReason(intent.Kind),
			Source:               model.PaymentMethodStripe,
		})
		if err != nil {
			return err
		}
		order.Status = common.TopUpStatusSuccess
		order.CompleteTime = common.GetTimestamp()
		order.ProviderPayload = fmt.Sprintf("invoice_id=%s;subscription_id=%s;change_intent_id=%d", invoiceID, facts.SubscriptionID, intent.Id)
		if err := tx.Save(order).Error; err != nil {
			return err
		}
		intent.Status = model.SubscriptionChangeIntentStatusApplied
		intent.ProviderInvoiceId = invoiceID
		intent.ProviderBindingId = binding.Id
		intent.EffectiveAt = facts.PeriodStart
		if err := tx.Model(intent).Updates(map[string]interface{}{
			"status":              intent.Status,
			"provider_invoice_id": intent.ProviderInvoiceId,
			"provider_binding_id": intent.ProviderBindingId,
			"effective_at":        intent.EffectiveAt,
			"updated_at":          common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(contract).Where("id = ?", contract.Id).Updates(map[string]interface{}{
			"status":                      model.SubscriptionContractStatusActive,
			"payment_mode":                model.SubscriptionPaymentModeStripeRecurring,
			"current_provider_binding_id": binding.Id,
			"latest_change_intent_id":     intent.Id,
			"pending_plan_id":             0,
			"pending_effective_at":        0,
			"updated_at":                  common.GetTimestamp(),
		}).Error; err != nil {
			return err
		}
		result.Binding = binding
		if grant != nil {
			result.Entitlement = grant.Entitlement
			result.Applied = grant.Applied
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (f paidInvoiceFacts) hasCompletePurchaseMetadata() bool {
	return strings.TrimSpace(f.TradeNo) != "" && f.UserID > 0 && f.PlanID > 0 && f.ContractID > 0 && f.ChangeIntentID > 0
}

func ReconcileFailedInvoice(ctx context.Context, invoiceID string) error {
	invoiceID = strings.TrimSpace(invoiceID)
	if invoiceID == "" {
		return PermanentPaidInvoiceError(errors.New("Stripe invoice id is required"))
	}
	inv, err := stripeInvoiceGetter(ctx, invoiceID)
	if err != nil {
		return err
	}
	if inv == nil || strings.TrimSpace(inv.ID) == "" {
		return errors.New("Stripe invoice is missing")
	}
	if stripeInvoiceIsPaid(inv) {
		_, err := ReconcilePaidInvoice(ctx, invoiceID)
		return err
	}
	subscriptionID := stripeInvoiceSubscriptionID(inv)
	if subscriptionID == "" {
		return PermanentPaidInvoiceError(errors.New("Stripe invoice subscription id is missing"))
	}
	sub, err := stripeSubscriptionGetter(ctx, subscriptionID)
	if err != nil {
		return err
	}
	facts, err := validateStripeInvoiceCommonFacts(inv, sub)
	if err != nil {
		return err
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		binding, contract, plan, user, err := lockRenewalBindingFactsTx(tx, facts)
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		plan, _, err = resolveExpectedRenewalPlanTx(tx, facts, binding, contract, plan)
		if err != nil {
			return err
		}
		if !canApplyFailedInvoiceToBinding(facts, binding, contract) {
			return nil
		}
		planSnapshot, err := recurringPlanSnapshotFromBindingTx(tx, binding)
		if err != nil {
			return PermanentPaidInvoiceError(err)
		}
		if err := validateRenewalInvoiceFacts(facts, binding, contract, plan, user, planSnapshot); err != nil {
			return PermanentPaidInvoiceError(err)
		}
		var entitlement model.UserSubscription
		if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ? AND contract_id = ?", contract.CurrentEntitlementId, contract.UserId, contract.Id).First(&entitlement).Error; err != nil {
			return err
		}
		graceEnd := entitlement.EndTime + int64((72 * time.Hour).Seconds())
		now := common.GetTimestamp()
		if err := tx.Model(&entitlement).Updates(map[string]interface{}{
			"access_end_time": graceEnd,
			"updated_at":      now,
		}).Error; err != nil {
			return err
		}
		if err := tx.Model(contract).Where("id = ?", contract.Id).Updates(map[string]interface{}{
			"status":           model.SubscriptionContractStatusGrace,
			"grace_period_end": graceEnd,
			"updated_at":       now,
		}).Error; err != nil {
			return err
		}
		return tx.Model(binding).Where("id = ?", binding.Id).Updates(map[string]interface{}{
			"provider_latest_invoice_id": facts.InvoiceID,
			"provider_status":            facts.ProviderStatus,
			"grace_period_end":           graceEnd,
			"last_synced_at":             now,
			"updated_at":                 now,
		}).Error
	})
}

type paidInvoiceFacts struct {
	InvoiceID          string
	SubscriptionID     string
	SubscriptionItemID string
	CustomerID         string
	PriceID            string
	TradeNo            string
	UserID             int
	PlanID             int
	ContractID         int64
	ChangeIntentID     int64
	AmountPaid         int64
	Currency           string
	Livemode           bool
	ProviderStatus     string
	CancelAtPeriodEnd  bool
	PeriodStart        int64
	PeriodEnd          int64
}

type stripeInvoiceCommonFacts struct {
	InvoiceID          string
	SubscriptionID     string
	SubscriptionItemID string
	CustomerID         string
	PriceID            string
	Amount             int64
	Currency           string
	Livemode           bool
	ProviderStatus     string
	CancelAtPeriodEnd  bool
	PeriodStart        int64
	PeriodEnd          int64
}

type recurringInvoicePlanSnapshot struct {
	Snapshot purchasePlanSnapshot
	Found    bool
	OrderID  int
}

func validatePaidInvoiceFacts(inv *stripe.Invoice, sub *stripe.Subscription) (paidInvoiceFacts, error) {
	commonFacts, err := validateStripeInvoiceCommonFacts(inv, sub)
	if err != nil {
		return paidInvoiceFacts{}, err
	}
	metadata := sub.Metadata
	tradeNo := strings.TrimSpace(metadata["trade_no"])
	if tradeNo == "" {
		tradeNo = strings.TrimSpace(metadata["newapi_trade_no"])
	}
	userID := 0
	if rawUserID := strings.TrimSpace(metadata["user_id"]); rawUserID != "" {
		userID, err = strconv.Atoi(rawUserID)
	}
	if userID <= 0 {
		if rawUserID := strings.TrimSpace(metadata["newapi_user_id"]); rawUserID != "" {
			userID, err = strconv.Atoi(rawUserID)
		}
	}
	if err != nil {
		return paidInvoiceFacts{}, PermanentPaidInvoiceError(errors.New("Stripe subscription metadata user_id is invalid"))
	}
	planID := 0
	if rawPlanID := strings.TrimSpace(metadata["plan_id"]); rawPlanID != "" {
		planID, err = strconv.Atoi(rawPlanID)
	}
	if planID <= 0 {
		if rawPlanID := strings.TrimSpace(metadata["newapi_plan_id"]); rawPlanID != "" {
			planID, err = strconv.Atoi(rawPlanID)
		}
	}
	if err != nil {
		return paidInvoiceFacts{}, PermanentPaidInvoiceError(errors.New("Stripe subscription metadata plan_id is invalid"))
	}
	contractID := int64(0)
	if rawContractID := strings.TrimSpace(metadata["contract_id"]); rawContractID != "" {
		contractID, err = strconv.ParseInt(rawContractID, 10, 64)
		if err != nil {
			return paidInvoiceFacts{}, PermanentPaidInvoiceError(errors.New("Stripe subscription metadata contract_id is invalid"))
		}
	}
	intentID := int64(0)
	if rawIntentID := strings.TrimSpace(metadata["change_intent_id"]); rawIntentID != "" {
		intentID, err = strconv.ParseInt(rawIntentID, 10, 64)
		if err != nil {
			return paidInvoiceFacts{}, PermanentPaidInvoiceError(errors.New("Stripe subscription metadata change_intent_id is invalid"))
		}
	}
	return paidInvoiceFacts{
		InvoiceID:          commonFacts.InvoiceID,
		SubscriptionID:     commonFacts.SubscriptionID,
		SubscriptionItemID: commonFacts.SubscriptionItemID,
		CustomerID:         commonFacts.CustomerID,
		PriceID:            commonFacts.PriceID,
		TradeNo:            tradeNo,
		UserID:             userID,
		PlanID:             planID,
		ContractID:         contractID,
		ChangeIntentID:     intentID,
		AmountPaid:         commonFacts.Amount,
		Currency:           commonFacts.Currency,
		Livemode:           commonFacts.Livemode,
		ProviderStatus:     commonFacts.ProviderStatus,
		CancelAtPeriodEnd:  commonFacts.CancelAtPeriodEnd,
		PeriodStart:        commonFacts.PeriodStart,
		PeriodEnd:          commonFacts.PeriodEnd,
	}, nil
}

func validateStripeInvoiceCommonFacts(inv *stripe.Invoice, sub *stripe.Subscription) (stripeInvoiceCommonFacts, error) {
	if sub == nil || strings.TrimSpace(sub.ID) == "" {
		return stripeInvoiceCommonFacts{}, errors.New("Stripe subscription is missing")
	}
	if strings.TrimSpace(inv.ID) == "" || strings.TrimSpace(sub.ID) == "" {
		return stripeInvoiceCommonFacts{}, errors.New("Stripe invoice facts are incomplete")
	}
	if stripeInvoiceSubscriptionID(inv) != strings.TrimSpace(sub.ID) {
		return stripeInvoiceCommonFacts{}, PermanentPaidInvoiceError(errors.New("Stripe invoice subscription mismatch"))
	}
	invoiceCustomer := stripeCustomerID(inv.Customer)
	subscriptionCustomer := stripeCustomerID(sub.Customer)
	if invoiceCustomer == "" || subscriptionCustomer == "" {
		return stripeInvoiceCommonFacts{}, PermanentPaidInvoiceError(errors.New("Stripe invoice customer is missing"))
	}
	if invoiceCustomer != subscriptionCustomer {
		return stripeInvoiceCommonFacts{}, PermanentPaidInvoiceError(errors.New("Stripe invoice customer mismatch"))
	}
	if inv.Livemode != sub.Livemode {
		return stripeInvoiceCommonFacts{}, PermanentPaidInvoiceError(errors.New("Stripe invoice subscription livemode mismatch"))
	}
	if err := validateStripeLivemodeForLocalKey(inv.Livemode); err != nil {
		return stripeInvoiceCommonFacts{}, PermanentPaidInvoiceError(err)
	}
	priceID := stripeSubscriptionFirstPriceID(sub)
	if priceID == "" {
		priceID = stripeInvoiceFirstPriceID(inv)
	}
	periodStart, periodEnd := stripeInvoicePeriod(inv, sub)
	return stripeInvoiceCommonFacts{
		InvoiceID:          strings.TrimSpace(inv.ID),
		SubscriptionID:     strings.TrimSpace(sub.ID),
		SubscriptionItemID: stripeSubscriptionFirstItemID(sub),
		CustomerID:         firstNonEmptyString(subscriptionCustomer, invoiceCustomer),
		PriceID:            priceID,
		Amount:             stripeInvoiceAmountForValidation(inv),
		Currency:           strings.ToUpper(string(inv.Currency)),
		Livemode:           inv.Livemode,
		ProviderStatus:     string(sub.Status),
		CancelAtPeriodEnd:  sub.CancelAtPeriodEnd,
		PeriodStart:        periodStart,
		PeriodEnd:          periodEnd,
	}, nil
}

func stripeInvoiceAmountForValidation(inv *stripe.Invoice) int64 {
	if inv == nil {
		return 0
	}
	if inv.AmountPaid > 0 {
		return inv.AmountPaid
	}
	if inv.AmountDue > 0 {
		return inv.AmountDue
	}
	return inv.Total
}

func stripeInvoiceIsPaid(inv *stripe.Invoice) bool {
	if inv == nil {
		return false
	}
	return inv.Status == stripe.InvoiceStatusPaid || inv.AmountPaid > 0
}

func stripeInvoiceSubscriptionID(inv *stripe.Invoice) string {
	if inv == nil {
		return ""
	}
	if inv.Parent != nil && inv.Parent.SubscriptionDetails != nil && inv.Parent.SubscriptionDetails.Subscription != nil {
		if id := strings.TrimSpace(inv.Parent.SubscriptionDetails.Subscription.ID); id != "" {
			return id
		}
	}
	if inv.Lines != nil {
		for _, line := range inv.Lines.Data {
			if line == nil {
				continue
			}
			if line.Subscription != nil && strings.TrimSpace(line.Subscription.ID) != "" {
				return strings.TrimSpace(line.Subscription.ID)
			}
			if line.Parent != nil && line.Parent.SubscriptionItemDetails != nil {
				if id := strings.TrimSpace(line.Parent.SubscriptionItemDetails.Subscription); id != "" {
					return id
				}
			}
		}
	}
	return ""
}

func stripeCustomerID(customer *stripe.Customer) string {
	if customer == nil {
		return ""
	}
	return strings.TrimSpace(customer.ID)
}

func stripeSubscriptionFirstPriceID(sub *stripe.Subscription) string {
	if sub == nil || sub.Items == nil || len(sub.Items.Data) == 0 || sub.Items.Data[0] == nil || sub.Items.Data[0].Price == nil {
		return ""
	}
	return strings.TrimSpace(sub.Items.Data[0].Price.ID)
}

func stripeSubscriptionFirstItemID(sub *stripe.Subscription) string {
	if sub == nil || sub.Items == nil || len(sub.Items.Data) == 0 || sub.Items.Data[0] == nil {
		return ""
	}
	return strings.TrimSpace(sub.Items.Data[0].ID)
}

func stripeInvoiceFirstPriceID(inv *stripe.Invoice) string {
	if inv == nil || inv.Lines == nil {
		return ""
	}
	for _, line := range inv.Lines.Data {
		if line != nil && line.Pricing != nil && line.Pricing.PriceDetails != nil && line.Pricing.PriceDetails.Price != nil && strings.TrimSpace(line.Pricing.PriceDetails.Price.ID) != "" {
			return strings.TrimSpace(line.Pricing.PriceDetails.Price.ID)
		}
	}
	return ""
}

func stripeInvoicePeriod(inv *stripe.Invoice, sub *stripe.Subscription) (int64, int64) {
	if inv != nil && inv.Lines != nil {
		for _, line := range inv.Lines.Data {
			if line != nil && line.Period != nil && line.Period.Start > 0 && line.Period.End > line.Period.Start {
				return line.Period.Start, line.Period.End
			}
		}
	}
	if start, end := stripeSubscriptionCurrentPeriod(sub); start > 0 && end > start {
		return start, end
	}
	now := common.GetTimestamp()
	return now, now + int64((30 * 24 * time.Hour).Seconds())
}

func stripeSubscriptionCurrentPeriod(sub *stripe.Subscription) (int64, int64) {
	if sub == nil || sub.Items == nil {
		return 0, 0
	}
	for _, item := range sub.Items.Data {
		if item != nil && item.CurrentPeriodStart > 0 && item.CurrentPeriodEnd > item.CurrentPeriodStart {
			return item.CurrentPeriodStart, item.CurrentPeriodEnd
		}
	}
	return 0, 0
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func validateStripeLivemodeForLocalKey(livemode bool) error {
	secret := strings.TrimSpace(setting.StripeApiSecret)
	switch {
	case strings.HasPrefix(secret, "sk_live_"), strings.HasPrefix(secret, "rk_live_"):
		if !livemode {
			return errors.New("Stripe invoice livemode mismatch: live key received test invoice")
		}
	case strings.HasPrefix(secret, "sk_test_"), strings.HasPrefix(secret, "rk_test_"):
		if livemode {
			return errors.New("Stripe invoice livemode mismatch: test key received live invoice")
		}
	}
	return nil
}

func lockInvoicePurchaseFactsTx(tx *gorm.DB, facts paidInvoiceFacts) (*model.SubscriptionOrder, *model.SubscriptionChangeIntent, *model.UserSubscriptionContract, *model.SubscriptionPlan, *model.User, error) {
	var order model.SubscriptionOrder
	if err := subscriptionCommandLock(tx).Where("trade_no = ?", facts.TradeNo).First(&order).Error; err != nil {
		return nil, nil, nil, nil, nil, model.ErrSubscriptionOrderNotFound
	}
	var intent model.SubscriptionChangeIntent
	if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ? AND contract_id = ?", facts.ChangeIntentID, facts.UserID, facts.ContractID).First(&intent).Error; err != nil {
		return nil, nil, nil, nil, nil, err
	}
	var contract model.UserSubscriptionContract
	if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", facts.ContractID, facts.UserID).First(&contract).Error; err != nil {
		return nil, nil, nil, nil, nil, err
	}
	var plan model.SubscriptionPlan
	if err := tx.Where("id = ?", facts.PlanID).First(&plan).Error; err != nil {
		return nil, nil, nil, nil, nil, err
	}
	plan.NormalizeDefaults()
	var user model.User
	if err := subscriptionCommandLock(tx).Where("id = ?", facts.UserID).First(&user).Error; err != nil {
		return nil, nil, nil, nil, nil, err
	}
	return &order, &intent, &contract, &plan, &user, nil
}

func recurringPlanSnapshotFromOrder(order *model.SubscriptionOrder) (recurringInvoicePlanSnapshot, error) {
	if order == nil || strings.TrimSpace(order.PlanSnapshot) == "" {
		return recurringInvoicePlanSnapshot{}, nil
	}
	var snapshot purchasePlanSnapshot
	if err := common.Unmarshal([]byte(order.PlanSnapshot), &snapshot); err != nil {
		return recurringInvoicePlanSnapshot{}, err
	}
	if snapshot.PlanID == 0 {
		snapshot.PlanID = order.PlanId
	}
	if snapshot.PlanID != order.PlanId {
		return recurringInvoicePlanSnapshot{}, errors.New("local subscription plan snapshot mismatch")
	}
	if snapshot.PriceAmount < 0 || snapshot.TotalAmount < 0 || snapshot.MediaCreditsMonthly < 0 ||
		snapshot.Window5hAmount < 0 || snapshot.WindowWeekAmount < 0 {
		return recurringInvoicePlanSnapshot{}, errors.New("local subscription plan snapshot values are invalid")
	}
	return recurringInvoicePlanSnapshot{Snapshot: snapshot, Found: true, OrderID: order.Id}, nil
}

func recurringPlanSnapshotFromBindingTx(tx *gorm.DB, binding *model.SubscriptionProviderBinding) (recurringInvoicePlanSnapshot, error) {
	if tx == nil || binding == nil || binding.InitialOrderId <= 0 {
		return recurringInvoicePlanSnapshot{}, nil
	}
	var order model.SubscriptionOrder
	if err := tx.Where("id = ? AND user_id = ? AND plan_id = ?", binding.InitialOrderId, binding.UserId, binding.PlanId).First(&order).Error; err != nil {
		return recurringInvoicePlanSnapshot{}, err
	}
	return recurringPlanSnapshotFromOrder(&order)
}

func recurringInvoiceGrantAmountTotal(plan *model.SubscriptionPlan, planSnapshot recurringInvoicePlanSnapshot) int64 {
	if planSnapshot.Found {
		return planSnapshot.Snapshot.TotalAmount
	}
	return plan.TotalAmount
}

func recurringInvoiceGrantMediaCredits(plan *model.SubscriptionPlan, planSnapshot recurringInvoicePlanSnapshot) int64 {
	if planSnapshot.Found {
		return planSnapshot.Snapshot.MediaCreditsMonthly
	}
	return plan.MediaCreditsMonthly
}

func recurringInvoiceGrantWindow5h(plan *model.SubscriptionPlan, planSnapshot recurringInvoicePlanSnapshot) *int64 {
	value := plan.Window5hAmount
	if planSnapshot.Found {
		value = planSnapshot.Snapshot.Window5hAmount
	}
	return common.GetPointer(value)
}

func recurringInvoiceGrantWindowWeek(plan *model.SubscriptionPlan, planSnapshot recurringInvoicePlanSnapshot) *int64 {
	value := plan.WindowWeekAmount
	if planSnapshot.Found {
		value = planSnapshot.Snapshot.WindowWeekAmount
	}
	return common.GetPointer(value)
}

func recurringInvoiceGrantUpgradeGroup(plan *model.SubscriptionPlan, planSnapshot recurringInvoicePlanSnapshot) *string {
	value := strings.TrimSpace(plan.UpgradeGroup)
	if planSnapshot.Found {
		value = strings.TrimSpace(planSnapshot.Snapshot.UpgradeGroup)
	}
	return common.GetPointer(value)
}

func validateLocalInvoiceFacts(facts paidInvoiceFacts, order *model.SubscriptionOrder, intent *model.SubscriptionChangeIntent, contract *model.UserSubscriptionContract, plan *model.SubscriptionPlan, user *model.User, planSnapshot recurringInvoicePlanSnapshot) error {
	if order.UserId != facts.UserID || order.PlanId != facts.PlanID || order.ChangeIntentId != 0 && order.ChangeIntentId != facts.ChangeIntentID {
		return errors.New("local order ownership mismatch")
	}
	if order.PaymentProvider != model.PaymentProviderStripe {
		return errors.New("local order payment provider mismatch")
	}
	if order.Status != common.TopUpStatusPending && order.Status != common.TopUpStatusSuccess {
		return model.ErrSubscriptionOrderStatusInvalid
	}
	if intent.UserId != facts.UserID || intent.ToPlanId != facts.PlanID || intent.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
		return errors.New("local change intent ownership mismatch")
	}
	if intent.Status != model.SubscriptionChangeIntentStatusAwaitingPayment && intent.Status != model.SubscriptionChangeIntentStatusApplied {
		return errors.New("local change intent status mismatch")
	}
	if contract.UserId != facts.UserID {
		return errors.New("local contract ownership mismatch")
	}
	if strings.TrimSpace(user.StripeCustomer) != "" && strings.TrimSpace(user.StripeCustomer) != facts.CustomerID {
		return errors.New("local Stripe customer mismatch")
	}
	if plan.Id != facts.PlanID || (!plan.Enabled && !planSnapshot.Found) {
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

type supersededStripeCheckout struct {
	IntentID int64
	TradeNo  string
}

func supersedeReplaceablePendingStripeCheckouts(ctx context.Context, userID int, requestID string) ([]supersededStripeCheckout, error) {
	if userID <= 0 || strings.TrimSpace(requestID) == "" {
		return nil, nil
	}
	if existing, found, err := findIntentByRequestTx(model.DB, userID, requestID); err != nil {
		return nil, err
	} else if found && existing != nil {
		return nil, nil
	}
	var intents []model.SubscriptionChangeIntent
	if err := model.DB.
		Where("user_id = ? AND request_id <> ? AND payment_mode IN ? AND status = ? AND kind IN ?",
			userID,
			strings.TrimSpace(requestID),
			[]string{model.SubscriptionPaymentModeStripeRecurring, model.SubscriptionPaymentModePrepaid},
			model.SubscriptionChangeIntentStatusAwaitingPayment,
			[]string{model.SubscriptionChangeIntentKindPurchase, model.SubscriptionChangeIntentKindRepurchase, model.SubscriptionChangeIntentKindUpgrade, model.SubscriptionChangeIntentKindDowngrade},
		).
		Order("id asc").
		Find(&intents).Error; err != nil {
		return nil, err
	}
	var superseded []supersededStripeCheckout
	for _, intent := range intents {
		var order model.SubscriptionOrder
		query := model.DB.
			Where("change_intent_id = ? AND user_id = ? AND payment_provider = ?",
				intent.Id, userID, model.PaymentProviderStripe).
			Order("id desc").
			Limit(1).
			Find(&order)
		if query.Error != nil {
			return nil, query.Error
		}
		if query.RowsAffected == 0 || order.Status != common.TopUpStatusPending || strings.TrimSpace(order.ProviderSessionId) == "" {
			continue
		}
		if err := expireReplaceableStripeCheckout(ctx, order.ProviderSessionId); err != nil {
			return nil, err
		}
		if err := supersedePendingStripeCheckoutLocally(&intent, &order); err != nil {
			return nil, err
		}
		superseded = append(superseded, supersededStripeCheckout{IntentID: intent.Id, TradeNo: order.TradeNo})
	}
	return superseded, nil
}

func expireReplaceableStripeCheckout(ctx context.Context, sessionID string) error {
	sessionID = strings.TrimSpace(sessionID)
	checkoutSession, err := stripeCheckoutSessionGetter(ctx, sessionID)
	if err != nil {
		return err
	}
	if stripeCheckoutSessionIsPaidOrComplete(checkoutSession) {
		return ErrSubscriptionChangeInProgress
	}
	if stripeCheckoutSessionIsOpen(checkoutSession) {
		expiredSession, expireErr := stripeCheckoutSessionExpirer(ctx, sessionID)
		if expireErr != nil {
			refreshed, getErr := stripeCheckoutSessionGetter(ctx, sessionID)
			if getErr != nil {
				return expireErr
			}
			if stripeCheckoutSessionIsPaidOrComplete(refreshed) {
				return ErrSubscriptionChangeInProgress
			}
			if !stripeCheckoutSessionIsExpired(refreshed) {
				return expireErr
			}
		} else if stripeCheckoutSessionIsPaidOrComplete(expiredSession) {
			return ErrSubscriptionChangeInProgress
		} else if !stripeCheckoutSessionIsExpired(expiredSession) {
			return errors.New("Stripe checkout did not expire")
		}
	} else if !stripeCheckoutSessionIsExpired(checkoutSession) {
		return ErrSubscriptionChangeInProgress
	}
	return nil
}

func supersedePendingStripeCheckoutLocally(intent *model.SubscriptionChangeIntent, order *model.SubscriptionOrder) error {
	return model.DB.Transaction(func(tx *gorm.DB) error {
		return supersedePendingStripeCheckoutLocallyTx(tx, intent, order)
	})
}

func supersedePendingStripeCheckoutLocallyTx(tx *gorm.DB, intent *model.SubscriptionChangeIntent, order *model.SubscriptionOrder) error {
	now := common.GetTimestamp()
	if err := tx.Model(order).Where("id = ? AND status = ?", order.Id, common.TopUpStatusPending).
		Updates(map[string]interface{}{"status": common.TopUpStatusExpired, "complete_time": now}).Error; err != nil {
		return err
	}
	if err := tx.Model(intent).Where("id = ? AND status IN ?", intent.Id, []string{
		model.SubscriptionChangeIntentStatusAwaitingPayment,
		model.SubscriptionChangeIntentStatusExpired,
	}).
		Updates(map[string]interface{}{
			"status":     model.SubscriptionChangeIntentStatusSuperseded,
			"last_error": "Stripe checkout was superseded by a newer purchase request",
			"updated_at": now,
		}).Error; err != nil {
		return err
	}
	return tx.Model(&model.UserSubscriptionContract{}).
		Where("id = ? AND latest_change_intent_id = ?", intent.ContractId, intent.Id).
		Updates(map[string]interface{}{"latest_change_intent_id": 0, "updated_at": now}).Error
}

func stripeCheckoutSessionIsOpen(checkoutSession *stripe.CheckoutSession) bool {
	return checkoutSession != nil && checkoutSession.Status == stripe.CheckoutSessionStatusOpen
}

func stripeCheckoutSessionIsExpired(checkoutSession *stripe.CheckoutSession) bool {
	return checkoutSession != nil && checkoutSession.Status == stripe.CheckoutSessionStatusExpired
}

func stripeCheckoutSessionIsPaidOrComplete(checkoutSession *stripe.CheckoutSession) bool {
	return checkoutSession != nil &&
		(checkoutSession.Status == stripe.CheckoutSessionStatusComplete ||
			checkoutSession.PaymentStatus == stripe.CheckoutSessionPaymentStatusPaid)
}

func reconcilePaidInvoiceRenewalTx(tx *gorm.DB, facts paidInvoiceFacts, result *PaidInvoiceReconcileResult) error {
	commonFacts := stripeInvoiceCommonFacts{
		InvoiceID:          facts.InvoiceID,
		SubscriptionID:     facts.SubscriptionID,
		SubscriptionItemID: facts.SubscriptionItemID,
		CustomerID:         facts.CustomerID,
		PriceID:            facts.PriceID,
		Amount:             facts.AmountPaid,
		Currency:           facts.Currency,
		Livemode:           facts.Livemode,
		ProviderStatus:     facts.ProviderStatus,
		CancelAtPeriodEnd:  facts.CancelAtPeriodEnd,
		PeriodStart:        facts.PeriodStart,
		PeriodEnd:          facts.PeriodEnd,
	}
	binding, contract, plan, user, err := lockRenewalBindingFactsTx(tx, commonFacts)
	if err != nil {
		return err
	}
	plan, pendingDowngrade, err := resolveExpectedRenewalPlanTx(tx, commonFacts, binding, contract, plan)
	if err != nil {
		return err
	}
	planSnapshot, err := recurringPlanSnapshotFromBindingTx(tx, binding)
	if err != nil {
		return PermanentPaidInvoiceError(err)
	}
	if err := validateRenewalInvoiceFacts(commonFacts, binding, contract, plan, user, planSnapshot); err != nil {
		return PermanentPaidInvoiceError(err)
	}
	if !canApplyPaidRenewalInvoiceToBinding(commonFacts, binding, contract) {
		return nil
	}
	grant, err := model.RotateCurrentEntitlementTx(tx, model.GrantEntitlementInput{
		ContractId:           contract.Id,
		UserId:               binding.UserId,
		PlanId:               plan.Id,
		ProviderBindingId:    binding.Id,
		GrantKey:             "stripe:" + facts.InvoiceID,
		PaymentMode:          model.SubscriptionPaymentModeStripeRecurring,
		AmountTotal:          recurringInvoiceGrantAmountTotal(plan, planSnapshot),
		MediaCreditsTotal:    recurringInvoiceGrantMediaCredits(plan, planSnapshot),
		Window5hAmount:       recurringInvoiceGrantWindow5h(plan, planSnapshot),
		WindowWeekAmount:     recurringInvoiceGrantWindowWeek(plan, planSnapshot),
		UpgradeGroup:         recurringInvoiceGrantUpgradeGroup(plan, planSnapshot),
		PeriodStart:          facts.PeriodStart,
		PeriodEnd:            facts.PeriodEnd,
		EndReasonForPrevious: model.SubscriptionEntitlementEndReasonRenewed,
		Source:               model.PaymentMethodStripe,
	})
	if err != nil {
		return err
	}
	now := common.GetTimestamp()
	bindingUpdates := map[string]interface{}{
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
	}
	if pendingDowngrade {
		bindingUpdates["plan_id"] = plan.Id
	}
	if err := tx.Model(binding).Where("id = ?", binding.Id).Updates(bindingUpdates).Error; err != nil {
		return err
	}
	contractUpdates := map[string]interface{}{
		"status":           model.SubscriptionContractStatusActive,
		"grace_period_end": 0,
		"updated_at":       now,
	}
	if pendingDowngrade {
		contractUpdates["pending_plan_id"] = 0
		contractUpdates["pending_effective_at"] = 0
		if contract.LatestChangeIntentId > 0 {
			var intent model.SubscriptionChangeIntent
			err := subscriptionCommandLock(tx).Where("id = ? AND contract_id = ? AND kind = ?", contract.LatestChangeIntentId, contract.Id, model.SubscriptionChangeIntentKindDowngrade).First(&intent).Error
			if err == nil && intent.ToPlanId == plan.Id {
				if err := tx.Model(&intent).Updates(map[string]interface{}{
					"status":              model.SubscriptionChangeIntentStatusApplied,
					"provider_invoice_id": facts.InvoiceID,
					"effective_at":        facts.PeriodStart,
					"last_error":          "",
					"updated_at":          now,
				}).Error; err != nil {
					return err
				}
			} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
		}
	}
	if err := tx.Model(contract).Where("id = ?", contract.Id).Updates(contractUpdates).Error; err != nil {
		return err
	}
	result.Binding = binding
	if grant != nil {
		result.Entitlement = grant.Entitlement
		result.Applied = grant.Applied
	}
	return nil
}

func canApplyPaidRenewalInvoiceToBinding(facts stripeInvoiceCommonFacts, binding *model.SubscriptionProviderBinding, contract *model.UserSubscriptionContract) bool {
	if !canApplyInvoiceToBinding(binding, contract) {
		return false
	}
	return contract.CurrentPeriodEnd <= 0 || facts.PeriodEnd > contract.CurrentPeriodEnd
}

func canApplyFailedInvoiceToBinding(facts stripeInvoiceCommonFacts, binding *model.SubscriptionProviderBinding, contract *model.UserSubscriptionContract) bool {
	if !canApplyInvoiceToBinding(binding, contract) {
		return false
	}
	return contract.CurrentPeriodEnd <= 0 || facts.PeriodEnd >= contract.CurrentPeriodEnd
}

func canApplyInvoiceToBinding(binding *model.SubscriptionProviderBinding, contract *model.UserSubscriptionContract) bool {
	if binding == nil || contract == nil {
		return false
	}
	if binding.EndedAt > 0 || isTerminalStripeSubscriptionStatus(binding.ProviderStatus) {
		return false
	}
	if contract.CurrentProviderBindingId != binding.Id {
		return false
	}
	switch contract.Status {
	case model.SubscriptionContractStatusActive, model.SubscriptionContractStatusGrace:
		return true
	default:
		return false
	}
}

func lockRenewalBindingFactsTx(tx *gorm.DB, facts stripeInvoiceCommonFacts) (*model.SubscriptionProviderBinding, *model.UserSubscriptionContract, *model.SubscriptionPlan, *model.User, error) {
	var binding model.SubscriptionProviderBinding
	if err := subscriptionCommandLock(tx).Where("provider = ? AND provider_subscription_id = ?", model.PaymentProviderStripe, facts.SubscriptionID).First(&binding).Error; err != nil {
		return nil, nil, nil, nil, err
	}
	var contract model.UserSubscriptionContract
	if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", binding.ContractId, binding.UserId).First(&contract).Error; err != nil {
		return nil, nil, nil, nil, err
	}
	var plan model.SubscriptionPlan
	if err := tx.Where("id = ?", binding.PlanId).First(&plan).Error; err != nil {
		return nil, nil, nil, nil, err
	}
	plan.NormalizeDefaults()
	var user model.User
	if err := subscriptionCommandLock(tx).Where("id = ?", binding.UserId).First(&user).Error; err != nil {
		return nil, nil, nil, nil, err
	}
	return &binding, &contract, &plan, &user, nil
}

func validateRenewalInvoiceFacts(facts stripeInvoiceCommonFacts, binding *model.SubscriptionProviderBinding, contract *model.UserSubscriptionContract, plan *model.SubscriptionPlan, user *model.User, planSnapshot recurringInvoicePlanSnapshot) error {
	if binding.ContractId <= 0 || contract.Id != binding.ContractId || contract.UserId != binding.UserId {
		return errors.New("local contract ownership mismatch")
	}
	if contract.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
		return errors.New("local contract payment mode mismatch")
	}
	if contract.CurrentProviderBindingId != 0 && contract.CurrentProviderBindingId != binding.Id {
		return errors.New("local contract binding mismatch")
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
	pendingPlanAllowed := contract.PendingPlanId > 0 &&
		plan.Id == contract.PendingPlanId &&
		contract.PendingEffectiveAt > 0 &&
		facts.PeriodStart >= contract.PendingEffectiveAt
	if plan.Id != binding.PlanId && !pendingPlanAllowed {
		return errors.New("local plan mismatch")
	}
	if strings.TrimSpace(plan.StripePriceId) == "" || strings.TrimSpace(plan.StripePriceId) != facts.PriceID {
		return errors.New("Stripe price mismatch")
	}
	if strings.TrimSpace(binding.ProviderPriceId) != facts.PriceID && !pendingPlanAllowed {
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
	if expectedMinor != facts.Amount {
		return fmt.Errorf("Stripe invoice amount mismatch: expected %d got %d", expectedMinor, facts.Amount)
	}
	return nil
}

func resolveExpectedRenewalPlanTx(tx *gorm.DB, facts stripeInvoiceCommonFacts, binding *model.SubscriptionProviderBinding, contract *model.UserSubscriptionContract, currentPlan *model.SubscriptionPlan) (*model.SubscriptionPlan, bool, error) {
	if tx == nil || binding == nil || contract == nil || currentPlan == nil {
		return currentPlan, false, nil
	}
	if contract.PendingPlanId <= 0 || contract.PendingEffectiveAt <= 0 || facts.PeriodStart < contract.PendingEffectiveAt {
		return currentPlan, false, nil
	}
	if contract.LatestChangeIntentId <= 0 {
		return currentPlan, false, nil
	}
	var intent model.SubscriptionChangeIntent
	err := tx.Where("id = ? AND contract_id = ? AND kind = ? AND status IN ?",
		contract.LatestChangeIntentId,
		contract.Id,
		model.SubscriptionChangeIntentKindDowngrade,
		[]string{
			model.SubscriptionChangeIntentStatusScheduled,
			model.SubscriptionChangeIntentStatusSyncing,
			model.SubscriptionChangeIntentStatusApplied,
		},
	).First(&intent).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return currentPlan, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	if intent.ToPlanId != contract.PendingPlanId || intent.ProviderBindingId != binding.Id {
		return currentPlan, false, nil
	}
	var pendingPlan model.SubscriptionPlan
	if err := tx.Where("id = ?", contract.PendingPlanId).First(&pendingPlan).Error; err != nil {
		return nil, false, err
	}
	pendingPlan.NormalizeDefaults()
	if strings.TrimSpace(pendingPlan.StripePriceId) == "" || strings.TrimSpace(pendingPlan.StripePriceId) != facts.PriceID {
		return currentPlan, false, nil
	}
	if strings.ToUpper(strings.TrimSpace(pendingPlan.Currency)) != facts.Currency {
		return currentPlan, false, nil
	}
	expectedMinor, err := stripeMinorUnitAmountForSubscription(pendingPlan.PriceAmount, facts.Currency)
	if err != nil {
		return nil, false, err
	}
	if expectedMinor != facts.Amount {
		return currentPlan, false, nil
	}
	return &pendingPlan, true, nil
}

func providerSnapshotFromPaidInvoice(facts paidInvoiceFacts, invoiceID string) model.ProviderSubscriptionSnapshot {
	return model.ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:     facts.SubscriptionID,
		ProviderSubscriptionItemId: facts.SubscriptionItemID,
		ProviderCustomerId:         facts.CustomerID,
		ProviderPriceId:            facts.PriceID,
		ProviderLatestInvoiceId:    invoiceID,
		ProviderStatus:             facts.ProviderStatus,
		CancelAtPeriodEnd:          facts.CancelAtPeriodEnd,
		CurrentPeriodStart:         facts.PeriodStart,
		CurrentPeriodEnd:           facts.PeriodEnd,
		Livemode:                   facts.Livemode,
	}
}

func createOrLoadStripeInvoiceBindingTx(tx *gorm.DB, order *model.SubscriptionOrder, contractID int64, snapshot model.ProviderSubscriptionSnapshot) (*model.SubscriptionProviderBinding, error) {
	if strings.TrimSpace(snapshot.ProviderSubscriptionId) == "" {
		return nil, errors.New("provider subscription id is empty")
	}
	var binding model.SubscriptionProviderBinding
	err := tx.Where("provider = ? AND provider_subscription_id = ?", model.PaymentProviderStripe, snapshot.ProviderSubscriptionId).First(&binding).Error
	if err == nil {
		if binding.UserId != order.UserId || binding.ContractId != contractID {
			return nil, model.ErrSubscriptionProviderBindingConflict
		}
		updates := map[string]interface{}{
			"provider_subscription_item_id": strings.TrimSpace(snapshot.ProviderSubscriptionItemId),
			"provider_customer_id":          strings.TrimSpace(snapshot.ProviderCustomerId),
			"provider_price_id":             strings.TrimSpace(snapshot.ProviderPriceId),
			"provider_latest_invoice_id":    strings.TrimSpace(snapshot.ProviderLatestInvoiceId),
			"provider_status":               strings.TrimSpace(snapshot.ProviderStatus),
			"cancel_at_period_end":          snapshot.CancelAtPeriodEnd,
			"current_period_start":          snapshot.CurrentPeriodStart,
			"current_period_end":            snapshot.CurrentPeriodEnd,
			"livemode":                      snapshot.Livemode,
			"last_synced_at":                common.GetTimestamp(),
			"updated_at":                    common.GetTimestamp(),
		}
		if err := tx.Model(&binding).Updates(updates).Error; err != nil {
			return nil, err
		}
		if err := tx.First(&binding, "id = ?", binding.Id).Error; err != nil {
			return nil, err
		}
		return &binding, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	binding = model.SubscriptionProviderBinding{
		UserId:                     order.UserId,
		PlanId:                     order.PlanId,
		InitialOrderId:             order.Id,
		ContractId:                 contractID,
		Provider:                   model.PaymentProviderStripe,
		ProviderSubscriptionId:     strings.TrimSpace(snapshot.ProviderSubscriptionId),
		ProviderSubscriptionItemId: strings.TrimSpace(snapshot.ProviderSubscriptionItemId),
		ProviderCustomerId:         strings.TrimSpace(snapshot.ProviderCustomerId),
		ProviderPriceId:            strings.TrimSpace(snapshot.ProviderPriceId),
		ProviderLatestInvoiceId:    strings.TrimSpace(snapshot.ProviderLatestInvoiceId),
		ProviderStatus:             strings.TrimSpace(snapshot.ProviderStatus),
		CancelAtPeriodEnd:          snapshot.CancelAtPeriodEnd,
		CurrentPeriodStart:         snapshot.CurrentPeriodStart,
		CurrentPeriodEnd:           snapshot.CurrentPeriodEnd,
		Livemode:                   snapshot.Livemode,
		LastSyncedAt:               common.GetTimestamp(),
	}
	if err := tx.Create(&binding).Error; err != nil {
		var existing model.SubscriptionProviderBinding
		if findErr := tx.Where("provider = ? AND provider_subscription_id = ?", model.PaymentProviderStripe, snapshot.ProviderSubscriptionId).First(&existing).Error; findErr == nil {
			if existing.UserId == order.UserId && existing.ContractId == contractID {
				return &existing, nil
			}
			return nil, model.ErrSubscriptionProviderBindingConflict
		}
		return nil, err
	}
	return &binding, nil
}

func CompleteOneTimeStripeSubscriptionPurchase(ctx context.Context, tradeNo string, providerPayload string) (*PurchaseSubscriptionResult, error) {
	tradeNo = strings.TrimSpace(tradeNo)
	if tradeNo == "" {
		return nil, errors.New("tradeNo is empty")
	}
	result := &PurchaseSubscriptionResult{}
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var order model.SubscriptionOrder
		if err := subscriptionCommandLock(tx).Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return model.ErrSubscriptionOrderNotFound
			}
			return err
		}
		if !isOneTimeStripeSubscriptionOrder(&order) {
			return model.ErrPaymentMethodMismatch
		}
		if order.Status == common.TopUpStatusSuccess {
			result.Order = &order
			if order.ChangeIntentId > 0 {
				var intent model.SubscriptionChangeIntent
				if err := tx.Where("id = ?", order.ChangeIntentId).First(&intent).Error; err == nil {
					result.Intent = &intent
				}
			}
			return nil
		}
		if order.Status != common.TopUpStatusPending {
			return model.ErrSubscriptionOrderStatusInvalid
		}
		var intent model.SubscriptionChangeIntent
		if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ? AND to_plan_id = ?", order.ChangeIntentId, order.UserId, order.PlanId).First(&intent).Error; err != nil {
			return err
		}
		if intent.PaymentMode != model.SubscriptionPaymentModePrepaid {
			return errors.New("local change intent payment mode mismatch")
		}
		if intent.Status != model.SubscriptionChangeIntentStatusAwaitingPayment && intent.Status != model.SubscriptionChangeIntentStatusApplied {
			return errors.New("local change intent status mismatch")
		}
		var contract model.UserSubscriptionContract
		if err := subscriptionCommandLock(tx).Where("id = ? AND user_id = ?", intent.ContractId, order.UserId).First(&contract).Error; err != nil {
			return err
		}
		snapshot, err := oneTimeStripePlanSnapshotFromOrder(&order)
		if err != nil {
			return PermanentPaidInvoiceError(err)
		}
		if err := validateOneTimeStripeLocalOrderFacts(&order, &intent, snapshot); err != nil {
			return PermanentPaidInvoiceError(err)
		}
		if err := enforcePrepaidReplacementLimitTx(tx, contract.Id, order.PurchaseMonths); err != nil {
			return err
		}
		if _, err := refundPrepaidNotStartedTermsTx(tx, order.UserId, contract.Id); err != nil {
			return err
		}
		now := common.GetTimestamp()
		periodStart := now
		periodEnd := time.Unix(periodStart, 0).AddDate(0, order.PurchaseMonths, 0).Unix()
		grant, err := model.RotateCurrentEntitlementTx(tx, model.GrantEntitlementInput{
			ContractId:           contract.Id,
			UserId:               order.UserId,
			PlanId:               order.PlanId,
			ProviderBindingId:    0,
			GrantKey:             "stripe-one-time:" + order.TradeNo,
			PaymentMode:          model.SubscriptionPaymentModePrepaid,
			AmountTotal:          snapshot.TotalAmount,
			MediaCreditsTotal:    snapshot.MediaCreditsMonthly,
			Window5hAmount:       common.GetPointer(snapshot.Window5hAmount),
			WindowWeekAmount:     common.GetPointer(snapshot.WindowWeekAmount),
			UpgradeGroup:         common.GetPointer(snapshot.UpgradeGroup),
			PeriodStart:          periodStart,
			PeriodEnd:            periodEnd,
			EndReasonForPrevious: previousEntitlementEndReason(intent.Kind),
			Source:               strings.TrimSpace(order.PaymentMethod),
		})
		if err != nil {
			return err
		}
		if err := createPrepaidTermSegmentsTx(tx, contract.Id, order.Id, order.PlanId, PrepaidTermAllocation{
			CanonicalWalletUnitPrice: snapshot.PriceAmount,
		}, periodStart, order.PurchaseMonths); err != nil {
			return err
		}
		plan := model.SubscriptionPlan{Id: order.PlanId}
		if err := markPrepaidPurchaseAppliedTx(tx, &contract, &intent, &plan, periodStart, periodEnd, order.TradeNo); err != nil {
			return err
		}
		order.Status = common.TopUpStatusSuccess
		order.CompleteTime = now
		if strings.TrimSpace(providerPayload) != "" {
			order.ProviderPayload = providerPayload
		}
		if err := tx.Save(&order).Error; err != nil {
			return err
		}
		if err := tx.Where("id = ?", contract.Id).First(&contract).Error; err != nil {
			return err
		}
		result.Status = ChangePlanStatusApplied
		result.Contract = &contract
		result.Intent = &intent
		result.Order = &order
		if grant != nil {
			result.Entitlement = grant.Entitlement
		}
		return nil
	})
	if err != nil {
		if IsPermanentPaidInvoiceError(err) {
			return nil, err
		}
		return nil, err
	}
	if result.Order != nil {
		if err := model.SyncSubscriptionOrderTopUpHistory(tradeNo); err != nil {
			return nil, err
		}
	}
	if result.Order != nil && result.Order.Status == common.TopUpStatusSuccess {
		if err := model.TryGrantInviteSubscriptionRewardAfterOrderCompleted(tradeNo); err != nil {
			common.SysError(fmt.Sprintf("invite subscription reward grant failed for one-time order %s: %v", tradeNo, err))
		}
	}
	return result, nil
}

func oneTimeStripePlanSnapshotFromOrder(order *model.SubscriptionOrder) (purchasePlanSnapshot, error) {
	if order == nil || strings.TrimSpace(order.PlanSnapshot) == "" {
		return purchasePlanSnapshot{}, errors.New("local one-time subscription plan snapshot is missing")
	}
	var snapshot purchasePlanSnapshot
	if err := common.Unmarshal([]byte(order.PlanSnapshot), &snapshot); err != nil {
		return purchasePlanSnapshot{}, err
	}
	if snapshot.PlanID == 0 {
		snapshot.PlanID = order.PlanId
	}
	return snapshot, nil
}

func validateOneTimeStripeLocalOrderFacts(order *model.SubscriptionOrder, intent *model.SubscriptionChangeIntent, snapshot purchasePlanSnapshot) error {
	if order == nil || intent == nil {
		return errors.New("local one-time subscription facts are missing")
	}
	if order.UserId != intent.UserId || order.PlanId != intent.ToPlanId {
		return errors.New("local one-time subscription ownership mismatch")
	}
	if order.PaymentProvider != model.PaymentProviderStripe {
		return model.ErrPaymentMethodMismatch
	}
	if order.PurchaseMonths < 1 || order.PurchaseMonths > 12 {
		return errors.New("local one-time subscription months mismatch")
	}
	if snapshot.PlanID != order.PlanId {
		return errors.New("local one-time subscription plan snapshot mismatch")
	}
	if snapshot.PriceAmount < 0 || snapshot.TotalAmount < 0 || snapshot.Window5hAmount < 0 ||
		snapshot.WindowWeekAmount < 0 || snapshot.MediaCreditsMonthly < 0 {
		return errors.New("local one-time subscription plan snapshot values are invalid")
	}
	if strings.TrimSpace(order.PaymentCurrency) == "" || order.PaymentAmountMinor <= 0 {
		return errors.New("local one-time subscription payment quote is missing")
	}
	switch strings.TrimSpace(order.PaymentMethod) {
	case SubscriptionPaymentChoicePix:
		if strings.ToUpper(strings.TrimSpace(order.PaymentCurrency)) != "BRL" {
			return errors.New("Pix subscription purchase quote must be BRL")
		}
	case SubscriptionPaymentChoiceUPI:
		if strings.ToUpper(strings.TrimSpace(order.PaymentCurrency)) != "INR" {
			return errors.New("UPI subscription purchase quote must be INR")
		}
	case SubscriptionPaymentChoiceAlipay:
	default:
		return errors.New("unsupported one-time subscription payment method")
	}
	return nil
}

func isOneTimeStripeSubscriptionOrder(order *model.SubscriptionOrder) bool {
	if order == nil {
		return false
	}
	if order.PaymentProvider != model.PaymentProviderStripe {
		return false
	}
	switch strings.TrimSpace(order.PaymentMethod) {
	case SubscriptionPaymentChoiceAlipay, SubscriptionPaymentChoicePix, SubscriptionPaymentChoiceUPI:
		return true
	default:
		return false
	}
}

func TerminatePendingStripePurchase(ctx context.Context, tradeNo string, intentStatus string) error {
	tradeNo = strings.TrimSpace(tradeNo)
	if tradeNo == "" {
		return nil
	}
	switch intentStatus {
	case model.SubscriptionChangeIntentStatusExpired, model.SubscriptionChangeIntentStatusFailed:
	default:
		intentStatus = model.SubscriptionChangeIntentStatusFailed
	}
	orderStatus := common.TopUpStatusFailed
	if intentStatus == model.SubscriptionChangeIntentStatusExpired {
		orderStatus = common.TopUpStatusExpired
	}
	shouldSyncTopUpHistory := false
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		var order model.SubscriptionOrder
		if err := subscriptionCommandLock(tx).Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return nil
			}
			return err
		}
		if order.PaymentProvider != model.PaymentProviderStripe {
			return nil
		}
		shouldSyncTopUpHistory = true
		if order.Status == common.TopUpStatusPending {
			if err := tx.Model(&order).Updates(map[string]interface{}{
				"status":        orderStatus,
				"complete_time": common.GetTimestamp(),
			}).Error; err != nil {
				return err
			}
		}
		intentID := order.ChangeIntentId
		if intentID <= 0 {
			intentID = parseChangeIntentIDFromPayload(order.ProviderPayload)
		}
		if intentID <= 0 {
			return nil
		}
		var intent model.SubscriptionChangeIntent
		if err := subscriptionCommandLock(tx).Where("id = ?", intentID).First(&intent).Error; err != nil {
			return err
		}
		if intent.Status == model.SubscriptionChangeIntentStatusAwaitingPayment || intent.Status == model.SubscriptionChangeIntentStatusCreated || intent.Status == model.SubscriptionChangeIntentStatusSyncing {
			if err := tx.Model(&intent).Updates(map[string]interface{}{
				"status":     intentStatus,
				"last_error": "Stripe checkout ended before first invoice was reconciled",
				"updated_at": common.GetTimestamp(),
			}).Error; err != nil {
				return err
			}
		}
		return tx.Model(&model.UserSubscriptionContract{}).
			Where("id = ? AND latest_change_intent_id = ?", intent.ContractId, intent.Id).
			Updates(map[string]interface{}{
				"latest_change_intent_id": 0,
				"updated_at":              common.GetTimestamp(),
			}).Error
	})
	if err != nil || !shouldSyncTopUpHistory {
		return err
	}
	return model.SyncSubscriptionOrderTopUpHistory(tradeNo)
}

func parseChangeIntentIDFromPayload(payload string) int64 {
	for _, part := range strings.Split(payload, ";") {
		key, value, ok := strings.Cut(part, "=")
		if !ok || strings.TrimSpace(key) != "change_intent_id" {
			continue
		}
		id, _ := strconv.ParseInt(strings.TrimSpace(value), 10, 64)
		return id
	}
	return 0
}

func stripeMinorUnitAmountForSubscription(amount float64, currency string) (int64, error) {
	if amount <= 0 {
		return 0, nil
	}
	scale := int32(2)
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF":
		scale = 0
	}
	return decimal.NewFromFloat(amount).Shift(scale).Round(0).IntPart(), nil
}
