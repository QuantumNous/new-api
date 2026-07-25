package controller

import (
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
)

const subscriptionSelfQuoteTTL = 10 * time.Minute

type SubscriptionSelfPurchaseQuoteRequest struct {
	PlanID        int    `json:"plan_id"`
	PaymentMethod string `json:"payment_method"`
	PaymentChoice string `json:"payment_choice"`
	Months        int    `json:"months"`
	RequestID     string `json:"request_id"`
}

type SubscriptionSelfPurchaseRequest struct {
	PlanID        int    `json:"plan_id"`
	PaymentMethod string `json:"payment_method"`
	PaymentChoice string `json:"payment_choice"`
	Months        int    `json:"months"`
	RequestID     string `json:"request_id"`
	QuoteID       string `json:"quote_id"`
	UIMode        string `json:"ui_mode"`
}

type SubscriptionSelfPurchaseQuoteResponse struct {
	PaymentQuotes map[string]SubscriptionSelfPaymentQuote `json:"payment_quotes,omitempty"`
}

type SubscriptionSelfPaymentQuote struct {
	Currency  string  `json:"currency"`
	Months    int     `json:"months"`
	UnitPrice float64 `json:"unit_price"`
	Total     float64 `json:"total"`
	QuoteID   string  `json:"quote_id,omitempty"`
	ExpiresAt int64   `json:"expires_at,omitempty"`
}

type SubscriptionSelfPurchaseResponse struct {
	Status           string                        `json:"status"`
	Contract         *SubscriptionContractDTO      `json:"contract,omitempty"`
	Intent           *SubscriptionPendingChangeDTO `json:"intent,omitempty"`
	CheckoutURL      string                        `json:"checkout_url,omitempty"`
	HostedInvoiceURL string                        `json:"hosted_invoice_url,omitempty"`
	ClientSecret     string                        `json:"client_secret,omitempty"`
	PublishableKey   string                        `json:"publishable_key,omitempty"`
}

func QuoteSubscriptionSelfPurchase(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	userID := c.GetInt("id")
	var req SubscriptionSelfPurchaseQuoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid subscription purchase quote request")
		return
	}
	choice := normalizeSubscriptionSelfPaymentChoice(req.PaymentMethod, req.PaymentChoice)
	if choice == service.SubscriptionPaymentChoiceStripeRecurring {
		common.ApiErrorMsg(c, "stripe_recurring does not require a one-time quote")
		return
	}
	req.RequestID = strings.TrimSpace(req.RequestID)
	if req.RequestID == "" {
		common.ApiErrorMsg(c, "request_id is required")
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanID)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	quote, err := service.QuoteSubscriptionPurchase(service.PurchaseSubscriptionCommand{
		UserID:        userID,
		PlanID:        req.PlanID,
		PaymentChoice: choice,
		Months:        req.Months,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if quote == nil || !quote.Available {
		reason := "subscription purchase quote unavailable"
		if quote != nil && strings.TrimSpace(quote.UnavailableReason) != "" {
			reason = quote.UnavailableReason
		}
		common.ApiErrorMsg(c, reason)
		return
	}
	unitAmount := quote.PaymentAmountMinor / int64(req.Months)
	expiresAt := time.Now().Add(subscriptionSelfQuoteTTL).Unix()
	token, err := service.SignSubscriptionPurchaseQuoteToken(service.SubscriptionPurchaseQuoteTokenClaims{
		Version:          1,
		UserID:           userID,
		PlanID:           req.PlanID,
		PaymentChoice:    choice,
		Months:           req.Months,
		RequestID:        req.RequestID,
		Currency:         strings.ToUpper(strings.TrimSpace(quote.Currency)),
		UnitAmountMinor:  unitAmount,
		TotalAmountMinor: quote.PaymentAmountMinor,
		PlanRevision:     subscriptionPurchasePlanRevision(plan),
		ExpiresAt:        expiresAt,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, SubscriptionSelfPurchaseQuoteResponse{
		PaymentQuotes: map[string]SubscriptionSelfPaymentQuote{
			choice: {
				Currency:  strings.ToUpper(strings.TrimSpace(quote.Currency)),
				Months:    req.Months,
				UnitPrice: quote.UnitPrice,
				Total:     quote.Total,
				QuoteID:   token,
				ExpiresAt: expiresAt,
			},
		},
	})
}

func PurchaseSubscriptionSelf(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}
	userID := c.GetInt("id")
	var req SubscriptionSelfPurchaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid subscription purchase request")
		return
	}
	choice := normalizeSubscriptionSelfPaymentChoice(req.PaymentMethod, req.PaymentChoice)
	if choice == "" {
		choice = service.SubscriptionPaymentChoiceStripeRecurring
	}
	if req.Months == 0 && choice == service.SubscriptionPaymentChoiceStripeRecurring {
		req.Months = 1
	}
	req.RequestID = strings.TrimSpace(req.RequestID)
	if req.RequestID == "" {
		common.ApiErrorMsg(c, "request_id is required")
		return
	}
	var claims service.SubscriptionPurchaseQuoteTokenClaims
	requiresQuote := isOneTimePlanStripeMethod(choice)
	if requiresQuote {
		var err error
		claims, err = validateSubscriptionSelfPurchaseQuote(req, userID, choice)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}

	result, err := service.PurchaseSubscription(service.PurchaseSubscriptionCommand{
		UserID:        userID,
		PlanID:        req.PlanID,
		PaymentChoice: choice,
		Months:        req.Months,
		RequestID:     req.RequestID,
		VerifiedQuote: subscriptionPurchaseQuoteFromClaims(claims, requiresQuote),
		UIMode:        req.UIMode,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if requiresQuote && result != nil && result.Order != nil {
		if result.Order.PaymentCurrency != claims.Currency || result.Order.PaymentAmountMinor != claims.TotalAmountMinor {
			common.ApiErrorMsg(c, "subscription purchase quote mismatch")
			return
		}
	}
	if isOneTimePlanStripeMethod(choice) {
		checkoutURL, err := ensureSubscriptionSelfOneTimeCheckout(c, result, req.UIMode)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		common.ApiSuccess(c, subscriptionSelfPurchaseResponse(result, checkoutURL))
		return
	}
	if err := syncSubscriptionSelfRecurringCheckoutHistory(result); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, subscriptionSelfPurchaseResponse(result, ""))
}

func syncSubscriptionSelfRecurringCheckoutHistory(result *service.PurchaseSubscriptionResult) error {
	if result == nil || result.Status != service.ChangePlanStatusCheckoutRequired || result.Intent == nil ||
		result.Intent.PaymentMode != model.SubscriptionPaymentModeStripeRecurring {
		return nil
	}
	var order model.SubscriptionOrder
	if err := model.DB.Where("change_intent_id = ? AND payment_provider = ?", result.Intent.Id, model.PaymentProviderStripe).
		Order("id desc").
		First(&order).Error; err != nil {
		return err
	}
	return model.SyncSubscriptionOrderTopUpHistory(order.TradeNo)
}

func validateSubscriptionSelfPurchaseQuote(req SubscriptionSelfPurchaseRequest, userID int, choice string) (service.SubscriptionPurchaseQuoteTokenClaims, error) {
	if strings.TrimSpace(req.QuoteID) == "" {
		return service.SubscriptionPurchaseQuoteTokenClaims{}, errors.New("quote_id is required")
	}
	claims, err := service.VerifySubscriptionPurchaseQuoteToken(req.QuoteID, time.Now())
	if err != nil {
		return service.SubscriptionPurchaseQuoteTokenClaims{}, err
	}
	if claims.UserID != userID ||
		claims.PlanID != req.PlanID ||
		claims.PaymentChoice != choice ||
		claims.Months != req.Months ||
		claims.RequestID != req.RequestID {
		return service.SubscriptionPurchaseQuoteTokenClaims{}, errors.New("subscription purchase quote does not match request")
	}
	plan, err := model.GetSubscriptionPlanById(req.PlanID)
	if err != nil {
		return service.SubscriptionPurchaseQuoteTokenClaims{}, err
	}
	if claims.PlanRevision != subscriptionPurchasePlanRevision(plan) {
		return service.SubscriptionPurchaseQuoteTokenClaims{}, errors.New("subscription purchase quote is stale")
	}
	return claims, nil
}

func subscriptionPurchaseQuoteFromClaims(claims service.SubscriptionPurchaseQuoteTokenClaims, required bool) *service.SubscriptionPurchaseQuote {
	if !required {
		return nil
	}
	return &service.SubscriptionPurchaseQuote{
		Currency:           claims.Currency,
		UnitPrice:          float64(claims.UnitAmountMinor) / 100,
		Total:              float64(claims.TotalAmountMinor) / 100,
		PaymentAmountMinor: claims.TotalAmountMinor,
	}
}

func ensureSubscriptionSelfOneTimeCheckout(c *gin.Context, result *service.PurchaseSubscriptionResult, uiMode string) (string, error) {
	if result == nil || result.Order == nil {
		return "", errors.New("subscription checkout order is missing")
	}
	order := result.Order
	presentation := service.ResolveStripeCheckoutPresentation(uiMode)
	if strings.TrimSpace(order.ProviderSessionURL) != "" {
		if err := model.SyncSubscriptionOrderTopUpHistory(order.TradeNo); err != nil {
			return "", err
		}
		return strings.TrimSpace(order.ProviderSessionURL), nil
	}
	if strings.TrimSpace(order.ProviderSessionId) != "" {
		checkoutSession, err := stripeOneTimeCheckoutSessionGetter(c.Request.Context(), order.ProviderSessionId)
		if err != nil {
			return "", err
		}
		if checkoutSession == nil || strings.TrimSpace(checkoutSession.ID) != strings.TrimSpace(order.ProviderSessionId) {
			return "", errors.New("Stripe checkout session could not be authenticated")
		}
		if strings.TrimSpace(checkoutSession.URL) != "" {
			order.ProviderSessionURL = strings.TrimSpace(checkoutSession.URL)
		}
		result.ClientSecret = strings.TrimSpace(checkoutSession.ClientSecret)
		if strings.TrimSpace(order.ProviderSessionURL) == "" && result.ClientSecret == "" {
			return "", errors.New("Stripe checkout session missing url or client secret")
		}
		if err := model.SyncSubscriptionOrderTopUpHistory(order.TradeNo); err != nil {
			return "", err
		}
		return strings.TrimSpace(order.ProviderSessionURL), nil
	}
	user, err := model.GetUserById(order.UserId, false)
	if err != nil {
		return "", err
	}
	if user == nil {
		return "", errors.New("user not found")
	}
	checkoutSession, err := stripeOneTimeCheckoutSessionCreator(c.Request.Context(), order, user, presentation)
	if err != nil {
		return "", err
	}
	if checkoutSession == nil || strings.TrimSpace(checkoutSession.ID) == "" {
		return "", errors.New("Stripe checkout session ID is missing")
	}
	if presentation.Embedded {
		if strings.TrimSpace(checkoutSession.ClientSecret) == "" {
			return "", errors.New("Stripe embedded checkout session client secret is missing")
		}
	} else if strings.TrimSpace(checkoutSession.URL) == "" {
		return "", errors.New("Stripe checkout session URL is missing")
	}
	if err := persistOneTimeStripeCheckoutSession(order.TradeNo, checkoutSession.ID, checkoutSession.URL); err != nil {
		return "", err
	}
	order.ProviderSessionId = strings.TrimSpace(checkoutSession.ID)
	order.ProviderSessionURL = strings.TrimSpace(checkoutSession.URL)
	result.ClientSecret = strings.TrimSpace(checkoutSession.ClientSecret)
	if err := model.SyncSubscriptionOrderTopUpHistory(order.TradeNo); err != nil {
		return "", err
	}
	return order.ProviderSessionURL, nil
}

func subscriptionSelfPurchaseResponse(result *service.PurchaseSubscriptionResult, checkoutURL string) SubscriptionSelfPurchaseResponse {
	if result == nil {
		return SubscriptionSelfPurchaseResponse{}
	}
	checkoutURL = strings.TrimSpace(checkoutURL)
	if checkoutURL == "" {
		checkoutURL = strings.TrimSpace(result.CheckoutURL)
	}
	response := SubscriptionSelfPurchaseResponse{
		Status:           result.Status,
		CheckoutURL:      checkoutURL,
		HostedInvoiceURL: strings.TrimSpace(result.HostedInvoiceURL),
		ClientSecret:     strings.TrimSpace(result.ClientSecret),
	}
	if response.ClientSecret != "" {
		response.PublishableKey = strings.TrimSpace(setting.StripePublishableKey)
	}
	if result.Contract != nil && result.Contract.Id > 0 {
		response.Contract = subscriptionContractDTO(result.Contract)
	}
	if result.Intent != nil && result.Intent.Id > 0 {
		response.Intent = subscriptionPendingChangeDTO(result.Intent)
	}
	return response
}

func normalizeSubscriptionSelfPaymentChoice(paymentMethod string, paymentChoice string) string {
	choice := strings.TrimSpace(paymentMethod)
	if choice == "" {
		choice = strings.TrimSpace(paymentChoice)
	}
	return strings.ToLower(choice)
}

func subscriptionPurchasePlanRevision(plan *model.SubscriptionPlan) int64 {
	if plan == nil {
		return 0
	}
	payload := struct {
		ID                  int
		Enabled             bool
		PriceAmount         string
		Currency            string
		PixPriceBRL         string
		UpiPriceINR         string
		DurationUnit        string
		DurationValue       int
		CustomSeconds       int64
		TotalAmount         int64
		Window5hAmount      int64
		WindowWeekAmount    int64
		MediaCreditsMonthly int64
		QuotaResetPeriod    string
		UpgradeGroup        string
	}{
		ID:                  plan.Id,
		Enabled:             plan.Enabled,
		PriceAmount:         formatSubscriptionRevisionMoney(plan.PriceAmount),
		Currency:            strings.ToUpper(strings.TrimSpace(plan.Currency)),
		PixPriceBRL:         formatSubscriptionRevisionMoneyPtr(plan.PixPriceBRL),
		UpiPriceINR:         formatSubscriptionRevisionMoneyPtr(plan.UpiPriceINR),
		DurationUnit:        strings.TrimSpace(plan.DurationUnit),
		DurationValue:       plan.DurationValue,
		CustomSeconds:       plan.CustomSeconds,
		TotalAmount:         plan.TotalAmount,
		Window5hAmount:      plan.Window5hAmount,
		WindowWeekAmount:    plan.WindowWeekAmount,
		MediaCreditsMonthly: plan.MediaCreditsMonthly,
		QuotaResetPeriod:    strings.TrimSpace(plan.QuotaResetPeriod),
		UpgradeGroup:        strings.TrimSpace(plan.UpgradeGroup),
	}
	data, err := common.Marshal(payload)
	if err != nil {
		return 0
	}
	sum := sha256.Sum256(data)
	revision := int64(binary.BigEndian.Uint64(sum[:8]) & 0x7fffffffffffffff)
	if revision == 0 {
		return 1
	}
	return revision
}

func formatSubscriptionRevisionMoney(value float64) string {
	return strconv.FormatFloat(value, 'f', 6, 64)
}

func formatSubscriptionRevisionMoneyPtr(value *float64) string {
	if value == nil {
		return ""
	}
	return formatSubscriptionRevisionMoney(*value)
}
