package controller

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v86"
	"github.com/stripe/stripe-go/v86/checkout/session"
	"gorm.io/gorm"
)

type SubscriptionStripePayRequest struct {
	PlanId      int    `json:"plan_id"`
	RecallClaim string `json:"recall_claim,omitempty"`
	RequestId   string `json:"request_id"`
}

func SubscriptionRequestStripePay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req SubscriptionStripePayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "invalid parameters")
		return
	}
	userId := c.GetInt("id")
	requestID := strings.TrimSpace(req.RequestId)
	if !isStableSubscriptionRequestID(requestID) {
		common.ApiErrorMsg(c, "request_id is required")
		return
	}
	replayCmd := service.PurchaseSubscriptionCommand{
		UserID:        userId,
		PlanID:        req.PlanId,
		PaymentChoice: service.SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     requestID,
		RecallClaim:   strings.TrimSpace(req.RecallClaim),
	}
	if replay, found, err := service.ReplaySubscriptionPurchase(replayCmd); err != nil {
		common.ApiError(c, err)
		return
	} else if found {
		c.JSON(http.StatusOK, gin.H{
			"message": "success",
			"data": gin.H{
				"pay_link": replay.CheckoutURL,
			},
		})
		return
	}
	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "subscription plan is disabled")
		return
	}
	if plan.StripePriceId == "" {
		common.ApiErrorMsg(c, "subscription plan StripePriceId is not configured")
		return
	}
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		common.ApiErrorMsg(c, "Stripe is not configured or the secret key is invalid")
		return
	}
	if setting.StripeWebhookSecret == "" {
		common.ApiErrorMsg(c, "Stripe webhook is not configured")
		return
	}

	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorMsg(c, "user does not exist")
		return
	}

	result, err := requestStripeRecurringSubscriptionViaPurchasePath(userId, plan, req)
	if err != nil {
		if errors.Is(err, service.ErrRecallDisabled) ||
			errors.Is(err, service.ErrRecallClaimUnknown) ||
			errors.Is(err, service.ErrRecallClaimWrongUser) ||
			errors.Is(err, service.ErrRecallClaimExpired) ||
			errors.Is(err, service.ErrRecallClaimConverted) ||
			errors.Is(err, service.ErrRecallClaimSuppressed) ||
			errors.Is(err, service.ErrRecallClaimInactive) ||
			errors.Is(err, service.ErrRecallClaimPromotionInvalid) ||
			errors.Is(err, service.ErrRecallClaimWrongPrice) ||
			errors.Is(err, service.ErrRecallClaimPurchaseKind) ||
			errors.Is(err, service.ErrRecallClaimInvalidConfig) {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("Stripe subscription recall claim rejected user_id=%d plan_id=%d error=%q", userId, plan.Id, err.Error()))
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentRecallClaimUnavailable)})
			return
		}
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe subscription purchase checkout failed user_id=%d plan_id=%d error=%q", userId, plan.Id, err.Error()))
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": result.CheckoutURL,
		},
	})
}

func requestStripeRecurringSubscriptionViaPurchasePath(userID int, plan *model.SubscriptionPlan, req SubscriptionStripePayRequest) (*service.PurchaseSubscriptionResult, error) {
	requestID := strings.TrimSpace(req.RequestId)
	if !isStableSubscriptionRequestID(requestID) {
		return nil, errors.New("request_id is required")
	}
	cmd := service.PurchaseSubscriptionCommand{
		UserID:        userID,
		PlanID:        plan.Id,
		PaymentChoice: service.SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     requestID,
		RecallClaim:   req.RecallClaim,
	}
	if replay, found, err := service.ReplaySubscriptionPurchase(cmd); err != nil {
		return nil, err
	} else if found {
		return replay, nil
	}
	quoteResult, err := service.QuoteSubscriptionPurchase(cmd)
	if err != nil {
		return nil, err
	}
	if quoteResult == nil || !quoteResult.Available {
		if quoteResult != nil && strings.TrimSpace(quoteResult.UnavailableReason) != "" {
			return nil, errors.New(quoteResult.UnavailableReason)
		}
		return nil, errors.New("subscription purchase quote unavailable")
	}
	expiresAt := time.Now().Add(subscriptionSelfQuoteTTL).Unix()
	token, err := service.SignSubscriptionPurchaseQuoteToken(service.SubscriptionPurchaseQuoteTokenClaims{
		Version:                       2,
		UserID:                        userID,
		PlanID:                        plan.Id,
		PaymentChoice:                 service.SubscriptionPaymentChoiceStripeRecurring,
		Months:                        1,
		RequestID:                     cmd.RequestID,
		Currency:                      strings.ToUpper(strings.TrimSpace(quoteResult.Currency)),
		UnitAmountMinor:               quoteResult.UnitAmountMinor,
		TotalAmountMinor:              quoteResult.PaymentAmountMinor,
		DiscountKind:                  quoteResult.DiscountKind,
		DiscountAmountMinor:           quoteResult.DiscountAmountMinor,
		InvitationAvailableUSDMinor:   quoteResult.InvitationAvailableUSDMinor,
		InvitationDiscountUSDMinor:    quoteResult.InvitationDiscountUSDMinor,
		InvitationDiscountAmountMinor: quoteResult.InvitationDiscountAmountMinor,
		InvitationRemainingUSDMinor:   quoteResult.InvitationRemainingUSDMinor,
		OtherDiscountKind:             quoteResult.OtherDiscountKind,
		OtherDiscountAmountMinor:      quoteResult.OtherDiscountAmountMinor,
		RecallCampaignID:              quoteResult.RecallCampaignID,
		RecallRecipientID:             quoteResult.RecallRecipientID,
		RecallPromotionCodeID:         quoteResult.RecallPromotionCodeID,
		PlanRevision:                  subscriptionPurchasePlanRevision(plan),
		ExpiresAt:                     expiresAt,
	})
	if err != nil {
		return nil, err
	}
	claims, err := service.VerifySubscriptionPurchaseQuoteToken(token, time.Now())
	if err != nil {
		return nil, err
	}
	if claims.PlanRevision != subscriptionPurchasePlanRevision(plan) {
		return nil, errors.New("subscription purchase quote expired")
	}
	cmd.VerifiedQuote = subscriptionPurchaseQuoteFromClaims(claims, true)
	return service.PurchaseSubscription(cmd)
}

func buildStripeSubscriptionCheckoutSessionParams(referenceId string, customerId string, email string, priceId string, userId int, planId int) *stripe.CheckoutSessionParams {
	metadata := map[string]string{
		"newapi_trade_no": strings.TrimSpace(referenceId),
		"newapi_user_id":  strconv.Itoa(userId),
		"newapi_plan_id":  strconv.Itoa(planId),
	}
	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceId),
		SuccessURL:        stripe.String(consolePaymentReturnPath("/console/topup")),
		CancelURL:         stripe.String(consolePaymentReturnPath("/console/topup")),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceId),
				Quantity: stripe.Int64(1),
			},
		},
		Mode:     stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		Metadata: metadata,
		SubscriptionData: &stripe.CheckoutSessionSubscriptionDataParams{
			Metadata: metadata,
		},
		PaymentMethodOptions: &stripe.CheckoutSessionPaymentMethodOptionsParams{
			Card: &stripe.CheckoutSessionPaymentMethodOptionsCardParams{
				RequestThreeDSecure: stripe.String(string(stripe.CheckoutSessionPaymentMethodOptionsCardRequestThreeDSecureAny)),
			},
		},
	}
	if "" == customerId {
		if "" != email {
			params.CustomerEmail = stripe.String(email)
		}
	} else {
		params.Customer = stripe.String(customerId)
	}
	return params
}

type oneTimePlanSnapshot struct {
	Title            string  `json:"title"`
	PriceAmount      float64 `json:"price_amount"`
	Currency         string  `json:"currency"`
	DurationUnit     string  `json:"duration_unit"`
	DurationValue    int     `json:"duration_value"`
	TotalAmount      int64   `json:"total_amount"`
	UpgradeGroup     string  `json:"upgrade_group"`
	QuotaResetPeriod string  `json:"quota_reset_period"`
}

type oneTimePlanPaymentQuote struct {
	Currency         string
	TotalAmountMinor int64
}

type oneTimeStripeCheckoutSession struct {
	ID           string
	URL          string
	ClientSecret string
}

var stripeOneTimeCheckoutSessionCreator = createOneTimeStripeCheckoutSession
var stripeOneTimeCheckoutSessionGetter = getOneTimeStripeCheckoutSession

func createOneTimeStripeCheckoutSession(ctx context.Context, order *model.SubscriptionOrder, user *model.User, presentations ...service.StripeCheckoutPresentation) (*oneTimeStripeCheckoutSession, error) {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return nil, errors.New("invalid Stripe API key")
	}
	params, err := buildOneTimePlanCheckoutSessionParams(order, user, presentations...)
	if err != nil {
		return nil, err
	}
	stripe.Key = setting.StripeApiSecret
	created, err := session.New(params)
	if err != nil {
		return nil, err
	}
	presentation := service.StripeCheckoutPresentation{}
	if len(presentations) > 0 {
		presentation = presentations[0]
	}
	if created == nil || strings.TrimSpace(created.ID) == "" {
		return nil, errors.New("Stripe checkout session missing id")
	}
	if presentation.Embedded {
		if strings.TrimSpace(created.ClientSecret) == "" {
			return nil, errors.New("Stripe embedded checkout session missing client secret")
		}
	} else if strings.TrimSpace(created.URL) == "" {
		return nil, errors.New("Stripe checkout session missing url")
	}
	if err := persistOneTimeStripeCheckoutSession(order.TradeNo, created.ID, created.URL); err != nil {
		return nil, err
	}
	return &oneTimeStripeCheckoutSession{ID: strings.TrimSpace(created.ID), URL: strings.TrimSpace(created.URL), ClientSecret: strings.TrimSpace(created.ClientSecret)}, nil
}

func getOneTimeStripeCheckoutSession(ctx context.Context, sessionID string) (*oneTimeStripeCheckoutSession, error) {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return nil, errors.New("invalid Stripe API key")
	}
	stripe.Key = setting.StripeApiSecret
	checkoutSession, err := session.Get(strings.TrimSpace(sessionID), nil)
	if err != nil {
		return nil, err
	}
	if checkoutSession == nil {
		return nil, nil
	}
	return &oneTimeStripeCheckoutSession{
		ID:           strings.TrimSpace(checkoutSession.ID),
		URL:          strings.TrimSpace(checkoutSession.URL),
		ClientSecret: strings.TrimSpace(checkoutSession.ClientSecret),
	}, nil
}

func persistOneTimeStripeCheckoutSession(tradeNo string, sessionID string, sessionURL string) error {
	tradeNo = strings.TrimSpace(tradeNo)
	sessionID = strings.TrimSpace(sessionID)
	sessionURL = strings.TrimSpace(sessionURL)
	if tradeNo == "" || sessionID == "" {
		return errors.New("Stripe checkout session id is required")
	}
	return model.DB.Transaction(func(tx *gorm.DB) error {
		var order model.SubscriptionOrder
		if err := tx.Set("gorm:query_option", "FOR UPDATE").Where("trade_no = ?", tradeNo).First(&order).Error; err != nil {
			return err
		}
		if !isOneTimePlanStripeMethod(order.PaymentMethod) {
			return errors.New("subscription order is not a one-time Stripe checkout order")
		}
		if strings.TrimSpace(order.ProviderSessionId) != "" && strings.TrimSpace(order.ProviderSessionId) != sessionID {
			return errors.New("Stripe checkout session mismatch")
		}
		updates := map[string]interface{}{"provider_session_id": sessionID}
		if sessionURL != "" {
			updates["provider_session_url"] = sessionURL
		}
		return tx.Model(&order).Updates(updates).Error
	})
}

func buildOneTimePlanCheckoutSessionParams(order *model.SubscriptionOrder, user *model.User, presentations ...service.StripeCheckoutPresentation) (*stripe.CheckoutSessionParams, error) {
	if order == nil {
		return nil, errors.New("subscription order is required")
	}
	if strings.TrimSpace(order.TradeNo) == "" {
		return nil, errors.New("subscription order trade_no is required")
	}
	quote, err := oneTimePlanQuoteFromOrder(order)
	if err != nil {
		return nil, err
	}
	if err := validateOneTimePlanMethodCurrency(order.PaymentMethod, quote.Currency); err != nil {
		return nil, err
	}
	if err := validateOneTimePlanRecallAttributionTuple(order); err != nil {
		return nil, err
	}
	method := strings.ToLower(strings.TrimSpace(order.PaymentMethod))
	if !isOneTimePlanStripeMethod(method) {
		return nil, errors.New("unsupported one-time Stripe payment method")
	}
	stripeMethodType, err := stripePaymentMethodTypeForOneTimePlan(method)
	if err != nil {
		return nil, err
	}
	productName, productDescription := oneTimePlanProductText(order)
	metadata := oneTimePlanMetadata(order, method)
	expiresAt, err := oneTimePlanCheckoutExpiresAt(order)
	if err != nil {
		return nil, err
	}
	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(strings.TrimSpace(order.TradeNo)),
		SuccessURL:        stripe.String(consolePaymentReturnPath("/console/topup")),
		CancelURL:         stripe.String(consolePaymentReturnPath("/console/topup")),
		Mode:              stripe.String(string(stripe.CheckoutSessionModePayment)),
		ExpiresAt:         stripe.Int64(expiresAt),
		PaymentMethodTypes: []*string{
			stripe.String(string(stripeMethodType)),
		},
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Quantity: stripe.Int64(1),
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency:   stripe.String(strings.ToLower(quote.Currency)),
					UnitAmount: stripe.Int64(quote.TotalAmountMinor),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name:        stripe.String(productName),
						Description: stripe.String(productDescription),
					},
				},
			},
		},
		Metadata: metadata,
		PaymentIntentData: &stripe.CheckoutSessionPaymentIntentDataParams{
			Metadata: metadata,
		},
	}
	if order.RecallDiscountAmountMinor > 0 {
		params.Discounts = []*stripe.CheckoutSessionDiscountParams{
			{PromotionCode: stripe.String(strings.TrimSpace(order.RecallPromotionCodeId))},
		}
	}
	if user != nil {
		if strings.TrimSpace(user.StripeCustomer) != "" {
			params.Customer = stripe.String(strings.TrimSpace(user.StripeCustomer))
		} else if strings.TrimSpace(user.Email) != "" {
			params.CustomerEmail = stripe.String(strings.TrimSpace(user.Email))
		}
	}
	if len(presentations) > 0 {
		service.ApplyStripeCheckoutPresentation(params, presentations[0], order.TradeNo)
	}
	params.SetIdempotencyKey("subscription-one-time:" + strings.TrimSpace(order.TradeNo))
	return params, nil
}

func oneTimePlanCheckoutExpiresAt(order *model.SubscriptionOrder) (int64, error) {
	if order == nil {
		return 0, errors.New("subscription order is required")
	}
	createdAt := order.CreateTime
	if createdAt <= 0 {
		createdAt = common.GetTimestamp()
	}
	expiresAt := service.SubscriptionPurchaseOrderExpiresAt(createdAt)
	ttl := expiresAt - common.GetTimestamp()
	if ttl < int64((30*time.Minute).Seconds()) || ttl > int64((24*time.Hour).Seconds()) {
		return 0, errors.New("Stripe checkout expiration is outside the supported window")
	}
	return expiresAt, nil
}

func oneTimePlanQuoteFromOrder(order *model.SubscriptionOrder) (oneTimePlanPaymentQuote, error) {
	if order == nil {
		return oneTimePlanPaymentQuote{}, errors.New("subscription order is required")
	}
	currency := strings.ToUpper(strings.TrimSpace(order.PaymentCurrency))
	if currency == "" || order.PaymentAmountMinor < 0 || order.RecallDiscountAmountMinor < 0 ||
		order.PaymentAmountMinor > math.MaxInt64-order.RecallDiscountAmountMinor {
		return oneTimePlanPaymentQuote{}, errors.New("one-time subscription quote is unavailable")
	}
	checkoutAmountMinor := order.PaymentAmountMinor + order.RecallDiscountAmountMinor
	if checkoutAmountMinor <= 0 {
		return oneTimePlanPaymentQuote{}, errors.New("one-time subscription quote is unavailable")
	}
	return oneTimePlanPaymentQuote{
		Currency:         currency,
		TotalAmountMinor: checkoutAmountMinor,
	}, nil
}

func validateOneTimePlanMethodCurrency(method string, currency string) error {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case service.SubscriptionPaymentChoicePix:
		if strings.ToUpper(strings.TrimSpace(currency)) != "BRL" {
			return errors.New("Pix requires BRL quote")
		}
	case service.SubscriptionPaymentChoiceUPI:
		if strings.ToUpper(strings.TrimSpace(currency)) != "INR" {
			return errors.New("UPI requires INR quote")
		}
	case service.SubscriptionPaymentChoiceAlipay:
		if strings.ToUpper(strings.TrimSpace(currency)) == "" {
			return errors.New("Alipay quote currency is required")
		}
	default:
		return errors.New("unsupported one-time Stripe payment method")
	}
	return nil
}

func stripePaymentMethodTypeForOneTimePlan(method string) (stripe.PaymentMethodType, error) {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case service.SubscriptionPaymentChoiceAlipay:
		return stripe.PaymentMethodTypeAlipay, nil
	case service.SubscriptionPaymentChoicePix:
		return stripe.PaymentMethodTypePix, nil
	case service.SubscriptionPaymentChoiceUPI:
		return stripe.PaymentMethodTypeUpi, nil
	default:
		return "", errors.New("unsupported one-time Stripe payment method")
	}
}

func isOneTimePlanStripeMethod(method string) bool {
	switch strings.ToLower(strings.TrimSpace(method)) {
	case service.SubscriptionPaymentChoiceAlipay, service.SubscriptionPaymentChoicePix, service.SubscriptionPaymentChoiceUPI:
		return true
	default:
		return false
	}
}

func oneTimePlanMetadata(order *model.SubscriptionOrder, method string) map[string]string {
	metadata := map[string]string{
		"trade_no":             strings.TrimSpace(order.TradeNo),
		"user_id":              strconv.Itoa(order.UserId),
		"plan_id":              strconv.Itoa(order.PlanId),
		"change_intent_id":     strconv.FormatInt(order.ChangeIntentId, 10),
		"purchase_intent":      strings.TrimSpace(order.PurchaseIntent),
		"purchase_months":      strconv.Itoa(order.PurchaseMonths),
		"payment_method":       method,
		"payment_currency":     strings.ToUpper(strings.TrimSpace(order.PaymentCurrency)),
		"payment_amount_minor": strconv.FormatInt(order.PaymentAmountMinor, 10),
		"newapi_trade_no":      strings.TrimSpace(order.TradeNo),
		"newapi_user_id":       strconv.Itoa(order.UserId),
		"newapi_plan_id":       strconv.Itoa(order.PlanId),
	}
	if strings.TrimSpace(order.DiscountKind) != "" {
		metadata["discount_kind"] = strings.TrimSpace(order.DiscountKind)
	}
	if strings.TrimSpace(order.SubscriptionDiscountReservationKey) != "" {
		metadata["subscription_discount_reservation_key"] = strings.TrimSpace(order.SubscriptionDiscountReservationKey)
	}
	if order.SubscriptionDiscountUSDMinor > 0 {
		metadata["subscription_discount_usd_minor"] = strconv.FormatInt(order.SubscriptionDiscountUSDMinor, 10)
	}
	if order.SubscriptionDiscountAmountMinor > 0 {
		metadata["subscription_discount_amount_minor"] = strconv.FormatInt(order.SubscriptionDiscountAmountMinor, 10)
	}
	if order.RecallDiscountAmountMinor > 0 {
		metadata["recall_campaign_id"] = strconv.FormatInt(order.RecallCampaignId, 10)
		metadata["recall_recipient_id"] = strconv.FormatInt(order.RecallRecipientId, 10)
		metadata["recall_promotion_code_id"] = strings.TrimSpace(order.RecallPromotionCodeId)
		metadata["recall_discount_amount_minor"] = strconv.FormatInt(order.RecallDiscountAmountMinor, 10)
	}
	return metadata
}

func validateOneTimePlanRecallAttributionTuple(order *model.SubscriptionOrder) error {
	if order == nil {
		return errors.New("subscription order is required")
	}
	hasRecallIdentity := order.RecallCampaignId > 0 ||
		order.RecallRecipientId > 0 ||
		strings.TrimSpace(order.RecallPromotionCodeId) != ""
	if order.RecallDiscountAmountMinor <= 0 {
		if hasRecallIdentity {
			return errors.New("one-time recall attribution tuple requires discount amount")
		}
		return nil
	}
	if order.RecallCampaignId <= 0 ||
		order.RecallRecipientId <= 0 ||
		strings.TrimSpace(order.RecallPromotionCodeId) == "" {
		return errors.New("one-time recall attribution tuple is incomplete")
	}
	return nil
}

func oneTimePlanProductText(order *model.SubscriptionOrder) (string, string) {
	snapshot := oneTimePlanSnapshotFromOrder(order)
	name := strings.TrimSpace(snapshot.Title)
	if name == "" {
		name = fmt.Sprintf("Subscription plan %d", order.PlanId)
	}
	description := fmt.Sprintf("%d month subscription", order.PurchaseMonths)
	if order.PurchaseMonths != 1 {
		description = fmt.Sprintf("%d months subscription", order.PurchaseMonths)
	}
	return name, description
}

func oneTimePlanSnapshotFromOrder(order *model.SubscriptionOrder) oneTimePlanSnapshot {
	if order == nil || strings.TrimSpace(order.PlanSnapshot) == "" {
		return oneTimePlanSnapshot{}
	}
	var snapshot oneTimePlanSnapshot
	if err := common.Unmarshal([]byte(order.PlanSnapshot), &snapshot); err != nil {
		return oneTimePlanSnapshot{}
	}
	return snapshot
}
