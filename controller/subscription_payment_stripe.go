package controller

import (
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
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
	stripeSubscription "github.com/stripe/stripe-go/v81/subscription"
	"github.com/thanhpk/randstr"
)

var stripeSubscriptionUpdate = stripeSubscription.Update

type SubscriptionStripePayRequest struct {
	PlanId int `json:"plan_id"`
}

type SubscriptionStripeAutoRenewPayRequest struct {
	PlanId int `json:"plan_id"`
}

func SubscriptionRequestStripePay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req SubscriptionStripePayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorI18n(c, i18n.MsgSubscriptionNotEnabled)
		return
	}
	if err := validateOneTimeSubscriptionPlan(plan); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	if plan.PriceAmount < 0.01 {
		common.ApiErrorI18n(c, i18n.MsgPaymentAmountTooLow)
		return
	}
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		common.ApiErrorI18n(c, i18n.MsgPaymentStripeNotConfig)
		return
	}
	if setting.StripeWebhookSecret == "" {
		common.ApiErrorI18n(c, i18n.MsgPaymentWebhookNotConfig)
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorI18n(c, i18n.MsgUserNotExists)
		return
	}

	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorI18n(c, i18n.MsgSubscriptionPurchaseMax)
			return
		}
	}

	reference := fmt.Sprintf("sub-stripe-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "sub_ref_" + common.Sha1([]byte(reference))

	payLink, err := genStripeSubscriptionLink(referenceId, user.StripeCustomer, user.Email, plan)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 订阅支付链接创建失败 trade_no=%s plan_id=%d error=%q", referenceId, plan.Id, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         referenceId,
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	order.ApplyPaymentSnapshot(buildPaymentSnapshot(plan.PriceAmount, plan.PriceAmount, "USD"))
	if err := order.Insert(); err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentCreateFailed)})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": payLink,
			"trade_no": referenceId,
		},
	})
}

func SubscriptionRequestStripeAutoRenew(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req SubscriptionStripeAutoRenewPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorI18n(c, i18n.MsgSubscriptionNotEnabled)
		return
	}
	if plan.BillingMode != model.SubscriptionBillingModeAutoRenew {
		common.ApiErrorMsg(c, "plan is not auto_renew")
		return
	}
	if strings.TrimSpace(plan.StripeRecurringPriceId) == "" {
		common.ApiErrorMsg(c, "stripe_recurring_price_id is required")
		return
	}

	userId := c.GetInt("id")
	hasContract, err := model.HasNonEndedAutoRenewContract(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if hasContract {
		common.ApiErrorMsg(c, "user already has a non-ended auto-renew subscription")
		return
	}
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		common.ApiErrorI18n(c, i18n.MsgPaymentStripeNotConfig)
		return
	}
	if setting.StripeWebhookSecret == "" {
		common.ApiErrorI18n(c, i18n.MsgPaymentWebhookNotConfig)
		return
	}

	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorI18n(c, i18n.MsgUserNotExists)
		return
	}

	checkoutURL, err := genStripeAutoRenewCheckoutURL(user, plan)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe recurring checkout create failed user_id=%d plan_id=%d error=%q", userId, plan.Id, err.Error()))
		common.ApiErrorI18n(c, i18n.MsgPaymentStartFailed)
		return
	}
	common.ApiSuccess(c, gin.H{"checkout_url": checkoutURL})
}

func genStripeSubscriptionLink(referenceId string, customerId string, email string, plan *model.SubscriptionPlan) (string, error) {
	if plan == nil {
		return "", fmt.Errorf("subscription plan is nil")
	}

	unitAmount := int64(math.Round(plan.PriceAmount * 100))
	if unitAmount <= 0 {
		return "", fmt.Errorf("invalid stripe checkout amount")
	}

	currency := strings.ToLower(strings.TrimSpace(plan.Currency))
	if currency == "" {
		currency = "usd"
	}

	stripe.Key = setting.StripeApiSecret

	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceId),
		SuccessURL:        stripe.String(paymentReturnPath("/console/topup")),
		CancelURL:         stripe.String(paymentReturnPath("/console/topup")),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency: stripe.String(currency),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String(plan.Title),
					},
					UnitAmount: stripe.Int64(unitAmount),
				},
				Quantity: stripe.Int64(1),
			},
		},
		Mode:                stripe.String(string(stripe.CheckoutSessionModePayment)),
		AllowPromotionCodes: stripe.Bool(setting.StripePromotionCodesEnabled),
	}

	if "" == customerId {
		if "" != email {
			params.CustomerEmail = stripe.String(email)
		}
		params.CustomerCreation = stripe.String(string(stripe.CheckoutSessionCustomerCreationAlways))
	} else {
		params.Customer = stripe.String(customerId)
	}

	result, err := session.New(params)
	if err != nil {
		return "", err
	}
	return result.URL, nil
}

func genStripeAutoRenewCheckoutURL(user *model.User, plan *model.SubscriptionPlan) (string, error) {
	if user == nil {
		return "", fmt.Errorf("user is nil")
	}
	if plan == nil {
		return "", fmt.Errorf("subscription plan is nil")
	}
	if strings.TrimSpace(plan.StripeRecurringPriceId) == "" {
		return "", fmt.Errorf("stripe recurring price id is empty")
	}

	stripe.Key = setting.StripeApiSecret

	params := &stripe.CheckoutSessionParams{
		Mode: stripe.String(string(stripe.CheckoutSessionModeSubscription)),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(plan.StripeRecurringPriceId),
				Quantity: stripe.Int64(1),
			},
		},
		SuccessURL:          stripe.String(paymentReturnPath("/console/topup")),
		CancelURL:           stripe.String(paymentReturnPath("/console/topup")),
		AllowPromotionCodes: stripe.Bool(setting.StripePromotionCodesEnabled),
	}
	params.AddMetadata("user_id", strconv.Itoa(user.Id))
	params.AddMetadata("plan_id", strconv.Itoa(plan.Id))
	params.AddMetadata("billing_mode", model.SubscriptionBillingModeAutoRenew)

	if user.StripeCustomer == "" {
		if user.Email != "" {
			params.CustomerEmail = stripe.String(user.Email)
		}
		params.CustomerCreation = stripe.String(string(stripe.CheckoutSessionCustomerCreationAlways))
	} else {
		params.Customer = stripe.String(user.StripeCustomer)
	}

	result, err := session.New(params)
	if err != nil {
		return "", err
	}
	return result.URL, nil
}

func cancelStripeAutoRenewAtPeriodEnd(subscriptionID string) (*stripe.Subscription, error) {
	if strings.TrimSpace(subscriptionID) == "" {
		return nil, fmt.Errorf("subscription id is empty")
	}
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return nil, fmt.Errorf("invalid stripe api secret")
	}
	stripe.Key = setting.StripeApiSecret
	params := &stripe.SubscriptionParams{
		CancelAtPeriodEnd: stripe.Bool(true),
	}
	return stripeSubscriptionUpdate(subscriptionID, params)
}
