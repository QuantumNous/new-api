package controller

import (
	"context"
	"errors"
	"fmt"
	"math"
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
	stripecoupon "github.com/stripe/stripe-go/v86/coupon"
	"gorm.io/gorm"
)

type SubscriptionStripePayRequest struct {
	PlanId      int    `json:"plan_id"`
	RecallClaim string `json:"recall_claim,omitempty"`
	RequestId   string `json:"request_id"`
	GAClientID  string `json:"ga_client_id,omitempty"`
	GASessionID string `json:"ga_session_id,omitempty"`
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
	gaClientID, gaSessionID := service.ResolveGAIdentifiers(c.Request, req.GAClientID, req.GASessionID)
	req.GAClientID, req.GASessionID = gaClientID, gaSessionID
	replayCmd := service.PurchaseSubscriptionCommand{
		UserID:        userId,
		PlanID:        req.PlanId,
		PaymentChoice: service.SubscriptionPaymentChoiceStripeRecurring,
		Months:        1,
		RequestID:     requestID,
		RecallClaim:   strings.TrimSpace(req.RecallClaim),
		GAClientID:    gaClientID,
		GASessionID:   gaSessionID,
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
	if rejectSubscriptionPurchasePendingMigration(c) {
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

func applySubscriptionCheckoutDiscountSelection(order *model.SubscriptionOrder, plan *model.SubscriptionPlan, recall *service.RecallCheckoutDiscount) error {
	if order == nil || plan == nil || recall == nil || recall.DiscountAmountMinor <= 0 {
		return nil
	}
	if order.DiscountUSD > 0 {
		if !strings.EqualFold(strings.TrimSpace(plan.Currency), "USD") {
			return nil
		}
		inviteDiscountMinor, err := service.StripeMinorUnitAmountForSubscription(order.DiscountUSD, plan.Currency)
		if err != nil {
			return err
		}
		if inviteDiscountMinor >= recall.DiscountAmountMinor {
			return nil
		}
		order.DiscountUSD = 0
		order.Money = plan.PriceAmount
	}
	order.RecallCampaignId = recall.CampaignID
	order.RecallRecipientId = recall.RecipientID
	order.RecallPromotionCodeId = recall.PromotionCodeID
	order.RecallDiscountAmountMinor = recall.DiscountAmountMinor
	return order.Update()
}

func genStripeSubscriptionLink(referenceId string, customerId string, email string, priceId string, userId int, planId int, discountUSD float64, recall *service.RecallCheckoutDiscount) (*stripe.CheckoutSession, error) {
	stripe.Key = setting.StripeApiSecret

	params := buildStripeSubscriptionCheckoutSessionParams(referenceId, customerId, email, priceId, userId, planId)
	params.SetIdempotencyKey("subscription-stripe:" + strings.TrimSpace(referenceId))
	if recall != nil {
		params.Discounts = append(params.Discounts, &stripe.CheckoutSessionDiscountParams{
			PromotionCode: stripe.String(recall.PromotionCodeID),
		})
		params.Metadata["recall_campaign_id"] = strconv.FormatInt(recall.CampaignID, 10)
		params.Metadata["recall_recipient_id"] = strconv.FormatInt(recall.RecipientID, 10)
		params.SubscriptionData.Metadata["recall_campaign_id"] = strconv.FormatInt(recall.CampaignID, 10)
		params.SubscriptionData.Metadata["recall_recipient_id"] = strconv.FormatInt(recall.RecipientID, 10)
	} else if discountUSD <= 0 {
		params.AllowPromotionCodes = stripe.Bool(true)
	}
	if discountUSD > 0 {
		couponParams := &stripe.CouponParams{
			AmountOff: stripe.Int64(int64(math.Round(discountUSD * 100))),
			Currency:  stripe.String(string(stripe.CurrencyUSD)),
			Duration:  stripe.String(string(stripe.CouponDurationOnce)),
			Name:      stripe.String("Invite first-month discount"),
		}
		cp, err := stripecoupon.New(couponParams)
		if err != nil {
			return nil, fmt.Errorf("create invite discount coupon: %w", err)
		}
		params.Discounts = append(params.Discounts, &stripe.CheckoutSessionDiscountParams{Coupon: stripe.String(cp.ID)})
	}

	result, err := session.New(params)
	if err != nil {
		return nil, err
	}
	return result, nil
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
		GAClientID:    service.NormalizeGAIdentifier(req.GAClientID),
		GASessionID:   service.NormalizeGAIdentifier(req.GASessionID),
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
	StripePriceId    string  `json:"stripe_price_id"`
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
var stripeOneTimeRecallClient service.RecallStripeClient = service.NewStripeRecallClient()

func createOneTimeStripeCheckoutSession(ctx context.Context, order *model.SubscriptionOrder, user *model.User, presentations ...service.StripeCheckoutPresentation) (*oneTimeStripeCheckoutSession, error) {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return nil, errors.New("invalid Stripe API key")
	}
	params, err := buildOneTimePlanCheckoutSessionParams(order, user, presentations...)
	if err != nil {
		return nil, err
	}
	recallProductID, err := validateOneTimePlanRecallPromotionForCheckout(ctx, order)
	if err != nil {
		return nil, err
	}
	applyOneTimeRecallScopedProduct(params, recallProductID)
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

func validateOneTimePlanRecallPromotionForCheckout(ctx context.Context, order *model.SubscriptionOrder) (string, error) {
	if order == nil {
		return "", errors.New("subscription order is required")
	}
	if order.RecallDiscountAmountMinor <= 0 {
		return "", nil
	}
	client := stripeOneTimeRecallClient
	if client == nil {
		client = service.NewStripeRecallClient()
	}
	quote, err := oneTimePlanQuoteFromOrder(order)
	if err != nil {
		return "", err
	}
	priceID, err := oneTimePlanStripePriceIDForRecallValidation(order)
	if err != nil {
		return "", err
	}
	price, err := client.GetPrice(ctx, priceID)
	if err != nil {
		return "", fmt.Errorf("validate one-time recall price: %w", err)
	}
	if price == nil || price.Deleted || !price.Active || strings.TrimSpace(price.ID) != priceID {
		return "", errors.New("one-time recall Stripe price is unavailable")
	}
	productID := ""
	if price.Product != nil {
		productID = strings.TrimSpace(price.Product.ID)
	}
	if productID == "" {
		return "", errors.New("one-time recall Stripe price product is unavailable")
	}
	promotion, err := client.GetPromotionCode(ctx, strings.TrimSpace(order.RecallPromotionCodeId))
	if err != nil {
		return "", fmt.Errorf("validate one-time recall promotion code: %w", err)
	}
	couponID := ""
	if promotion != nil && promotion.Promotion != nil && promotion.Promotion.Coupon != nil {
		couponID = strings.TrimSpace(promotion.Promotion.Coupon.ID)
	}
	if promotion == nil || strings.TrimSpace(promotion.ID) != strings.TrimSpace(order.RecallPromotionCodeId) ||
		!promotion.Active || couponID == "" {
		return "", errors.New("one-time recall promotion code is unavailable")
	}
	if promotion.Restrictions != nil {
		if promotion.Restrictions.FirstTimeTransaction || len(promotion.Restrictions.CurrencyOptions) > 0 {
			return "", errors.New("one-time recall promotion restrictions are unsupported")
		}
		if promotion.Restrictions.MinimumAmount > 0 {
			if !strings.EqualFold(string(promotion.Restrictions.MinimumAmountCurrency), quote.Currency) ||
				quote.TotalAmountMinor < promotion.Restrictions.MinimumAmount {
				return "", errors.New("one-time recall promotion minimum amount mismatch")
			}
		}
	}
	if promotion.MaxRedemptions > 0 && promotion.TimesRedeemed >= promotion.MaxRedemptions {
		return "", errors.New("one-time recall promotion code is exhausted")
	}
	if promotion.ExpiresAt > 0 && promotion.ExpiresAt <= time.Now().Unix() {
		return "", errors.New("one-time recall promotion code is expired")
	}
	coupon, err := client.GetCoupon(ctx, couponID)
	if err != nil {
		return "", fmt.Errorf("validate one-time recall coupon: %w", err)
	}
	if coupon == nil || coupon.Deleted || !coupon.Valid {
		return "", errors.New("one-time recall coupon is unavailable")
	}
	if coupon.RedeemBy > 0 && coupon.RedeemBy <= time.Now().Unix() {
		return "", errors.New("one-time recall coupon is expired")
	}
	if coupon.Duration != stripe.CouponDurationOnce {
		return "", errors.New("one-time recall coupon duration mismatch")
	}
	if coupon.MaxRedemptions > 0 && coupon.TimesRedeemed >= coupon.MaxRedemptions {
		return "", errors.New("one-time recall coupon is exhausted")
	}
	if coupon.AppliesTo != nil && len(coupon.AppliesTo.Products) > 0 && !oneTimeRecallProductScopeContains(coupon.AppliesTo.Products, productID) {
		return "", errors.New("one-time recall coupon product scope mismatch")
	}
	actualDiscount := oneTimeRecallDiscountAmountMinor(coupon, quote.Currency, quote.TotalAmountMinor)
	if actualDiscount != order.RecallDiscountAmountMinor {
		return "", fmt.Errorf("one-time recall discount mismatch: expected %d got %d", order.RecallDiscountAmountMinor, actualDiscount)
	}
	if quote.TotalAmountMinor-actualDiscount != order.PaymentAmountMinor {
		return "", errors.New("one-time recall payment amount mismatch")
	}
	return productID, nil
}

func applyOneTimeRecallScopedProduct(params *stripe.CheckoutSessionParams, productID string) {
	productID = strings.TrimSpace(productID)
	if params == nil || productID == "" {
		return
	}
	for _, item := range params.LineItems {
		if item == nil || item.PriceData == nil {
			continue
		}
		item.PriceData.Product = stripe.String(productID)
		item.PriceData.ProductData = nil
	}
}

func oneTimePlanStripePriceIDForRecallValidation(order *model.SubscriptionOrder) (string, error) {
	snapshot := oneTimePlanSnapshotFromOrder(order)
	if priceID := strings.TrimSpace(snapshot.StripePriceId); priceID != "" {
		return priceID, nil
	}
	if order.PlanId <= 0 {
		return "", errors.New("one-time recall Stripe price id is required")
	}
	plan, err := model.GetSubscriptionPlanById(order.PlanId)
	if err != nil {
		return "", err
	}
	if plan == nil || strings.TrimSpace(plan.StripePriceId) == "" {
		return "", errors.New("one-time recall Stripe price id is required")
	}
	return strings.TrimSpace(plan.StripePriceId), nil
}

func oneTimeRecallProductScopeContains(products []string, productID string) bool {
	productID = strings.TrimSpace(productID)
	for _, product := range products {
		if strings.TrimSpace(product) == productID {
			return true
		}
	}
	return false
}

func oneTimeRecallDiscountAmountMinor(coupon *stripe.Coupon, currency string, amountMinor int64) int64 {
	if coupon == nil || amountMinor <= 0 {
		return 0
	}
	currency = strings.ToLower(strings.TrimSpace(currency))
	var discount int64
	if coupon.PercentOff > 0 {
		if coupon.PercentOff >= 100 {
			return amountMinor
		}
		discount = int64(math.Round(float64(amountMinor) * coupon.PercentOff / 100))
	} else {
		option, found := coupon.CurrencyOptions[currency]
		if found && option != nil {
			discount = option.AmountOff
		} else {
			if !strings.EqualFold(string(coupon.Currency), currency) {
				return 0
			}
			discount = coupon.AmountOff
		}
	}
	if discount < 0 {
		return 0
	}
	if discount > amountMinor {
		return amountMinor
	}
	return discount
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
