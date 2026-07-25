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
	"github.com/thanhpk/randstr"
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
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if rejectSubscriptionPurchasePendingMigration(c) {
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "套餐未启用")
		return
	}
	if plan.StripePriceId == "" {
		common.ApiErrorMsg(c, "该套餐未配置 StripePriceId")
		return
	}
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		common.ApiErrorMsg(c, "Stripe 未配置或密钥无效")
		return
	}
	if setting.StripeWebhookSecret == "" {
		common.ApiErrorMsg(c, "Stripe Webhook 未配置")
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorMsg(c, "用户不存在")
		return
	}

	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, "已达到该套餐购买上限")
			return
		}
	}

	reference := fmt.Sprintf("sub-stripe-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "sub_ref_" + common.Sha1([]byte(reference))

	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		TradeNo:         referenceId,
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := model.CreateSubscriptionOrderWithInviteDiscount(order, plan.PriceAmount, 0); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	var recallDiscount *service.RecallCheckoutDiscount
	if strings.TrimSpace(req.RecallClaim) != "" {
		recallDiscount, err = service.GetRecallRuntime().Claims.BuildCheckoutDiscount(
			c.Request.Context(),
			userId,
			req.RecallClaim,
			service.RecallPurchaseKindSubscription,
			plan.StripePriceId,
		)
		if err != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("Stripe subscription recall claim rejected user_id=%d trade_no=%s plan_id=%d error=%q", userId, referenceId, plan.Id, err.Error()))
			order.Status = common.TopUpStatusFailed
			_ = order.Update()
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentRecallClaimUnavailable)})
			return
		}
	}

	checkoutSession, err := genStripeSubscriptionLink(referenceId, user.StripeCustomer, user.Email, plan.StripePriceId, userId, plan.Id, order.DiscountUSD, recallDiscount)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 订阅支付链接创建失败 trade_no=%s plan_id=%d error=%q", referenceId, plan.Id, err.Error()))
		order.Status = common.TopUpStatusFailed
		_ = order.Update()
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": checkoutSession.URL,
		},
	})
}

func genStripeSubscriptionLink(referenceId string, customerId string, email string, priceId string, userId int, planId int, discountUSD float64, recall *service.RecallCheckoutDiscount) (*stripe.CheckoutSession, error) {
	stripe.Key = setting.StripeApiSecret

	params := buildStripeSubscriptionCheckoutSessionParams(referenceId, customerId, email, priceId, userId, planId)
	if recall == nil {
		params.AllowPromotionCodes = stripe.Bool(true)
	} else {
		params.Discounts = append(params.Discounts, &stripe.CheckoutSessionDiscountParams{
			PromotionCode: stripe.String(recall.PromotionCodeID),
		})
		params.Metadata["recall_campaign_id"] = strconv.FormatInt(recall.CampaignID, 10)
		params.Metadata["recall_recipient_id"] = strconv.FormatInt(recall.RecipientID, 10)
		params.SubscriptionData.Metadata["recall_campaign_id"] = strconv.FormatInt(recall.CampaignID, 10)
		params.SubscriptionData.Metadata["recall_recipient_id"] = strconv.FormatInt(recall.RecipientID, 10)
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
	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(strings.TrimSpace(order.TradeNo)),
		SuccessURL:        stripe.String(consolePaymentReturnPath("/console/topup")),
		CancelURL:         stripe.String(consolePaymentReturnPath("/console/topup")),
		Mode:              stripe.String(string(stripe.CheckoutSessionModePayment)),
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

func oneTimePlanQuoteFromOrder(order *model.SubscriptionOrder) (oneTimePlanPaymentQuote, error) {
	if order == nil {
		return oneTimePlanPaymentQuote{}, errors.New("subscription order is required")
	}
	currency := strings.ToUpper(strings.TrimSpace(order.PaymentCurrency))
	if currency == "" || order.PaymentAmountMinor <= 0 {
		return oneTimePlanPaymentQuote{}, errors.New("one-time subscription quote is unavailable")
	}
	return oneTimePlanPaymentQuote{
		Currency:         currency,
		TotalAmountMinor: order.PaymentAmountMinor,
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
	return map[string]string{
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
