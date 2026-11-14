package controller

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
	"github.com/thanhpk/randstr"
)

type SubscriptionStripePayRequest struct {
	PlanId int `json:"plan_id"`
	// PaymentMethod is empty or "stripe" for the plan's recurring Stripe price,
	// or an alipay/wxpay method routed through Stripe for a one-time payment.
	PaymentMethod string `json:"payment_method"`
}

func SubscriptionRequestStripePay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	var req SubscriptionStripePayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorT(c, "Invalid parameters")
		return
	}
	paymentMethod := req.PaymentMethod
	if paymentMethod == "" {
		paymentMethod = model.PaymentMethodStripe
	}
	if !isStripeCheckoutPaymentMethod(paymentMethod) {
		common.ApiErrorT(c, "Unsupported payment channel")
		return
	}
	// Alipay and WeChat Pay cannot back a Stripe subscription, so they buy the
	// plan with a one-time payment and do not need the plan's recurring price.
	recurring := paymentMethod == model.PaymentMethodStripe

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorT(c, "Subscription plan is not enabled")
		return
	}
	if recurring && plan.StripePriceId == "" {
		common.ApiErrorT(c, "StripePriceId is not configured for this plan")
		return
	}
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		common.ApiErrorT(c, "Stripe is not configured or key is invalid")
		return
	}
	if setting.StripeWebhookSecret == "" {
		common.ApiErrorT(c, "Stripe webhook is not configured")
		return
	}

	userId := c.GetInt("id")
	user, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if user == nil {
		common.ApiErrorT(c, "User does not exist")
		return
	}

	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorT(c, "Purchase limit for this plan has been reached")
			return
		}
	}

	reference := fmt.Sprintf("sub-stripe-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "sub_ref_" + common.Sha1([]byte(reference))

	var params *stripe.CheckoutSessionParams
	if recurring {
		params = newStripeSubscriptionCheckoutParams(referenceId, user.StripeCustomer, user.Email, plan.StripePriceId)
	} else {
		params, err = newStripeSubscriptionPaymentCheckoutParams(referenceId, user.StripeCustomer, user.Email, paymentMethod, plan)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}

	stripe.Key = setting.StripeApiSecret
	result, err := session.New(params)
	if err != nil {
		logger.LogError(c.Request.Context(), common.LogText("Stripe failed to create subscription payment link trade_no=%s plan_id=%d payment_method=%s error=%q", referenceId, plan.Id, paymentMethod, err.Error()))
		paymentError(c, common.NewMessage("Failed to start payment"))
		return
	}

	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         referenceId,
		PaymentMethod:   paymentMethod,
		PaymentProvider: model.PaymentProviderStripe,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		paymentError(c, common.NewMessage("Failed to create order"))
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": result.URL,
		},
	})
}

// newStripeSubscriptionCheckoutParams buys a plan through its recurring Stripe
// price in subscription mode.
func newStripeSubscriptionCheckoutParams(referenceId string, customerId string, email string, priceId string) *stripe.CheckoutSessionParams {
	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceId),
		SuccessURL:        stripe.String(paymentReturnPath("/wallet")),
		CancelURL:         stripe.String(paymentReturnPath("/wallet")),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(priceId),
				Quantity: stripe.Int64(1),
			},
		},
		Mode: stripe.String(string(stripe.CheckoutSessionModeSubscription)),
	}
	applyStripeCheckoutCustomer(params, customerId, email)
	return params
}

// newStripeSubscriptionPaymentCheckoutParams buys a plan with a one-time
// payment-mode Checkout restricted to Alipay or WeChat Pay. The charge is the
// plan's list price in USD (plans are always priced in USD, the same amount the
// order records as Money), not the plan's recurring StripePriceId, which
// payment mode cannot use. The webhook completes it as a subscription order.
func newStripeSubscriptionPaymentCheckoutParams(referenceId string, customerId string, email string, paymentMethod string, plan *model.SubscriptionPlan) (*stripe.CheckoutSessionParams, error) {
	unitAmount := decimal.NewFromFloat(plan.PriceAmount).Mul(decimal.NewFromInt(100)).Round(0)
	if unitAmount.LessThan(decimal.NewFromInt(1)) {
		return nil, common.NewMessage("Plan amount is too low")
	}
	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceId),
		SuccessURL:        stripe.String(paymentReturnPath("/wallet")),
		CancelURL:         stripe.String(paymentReturnPath("/wallet")),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				PriceData: &stripe.CheckoutSessionLineItemPriceDataParams{
					Currency:   stripe.String(string(stripe.CurrencyUSD)),
					UnitAmount: stripe.Int64(unitAmount.IntPart()),
					ProductData: &stripe.CheckoutSessionLineItemPriceDataProductDataParams{
						Name: stripe.String(plan.Title),
					},
				},
				Quantity: stripe.Int64(1),
			},
		},
		Mode: stripe.String(string(stripe.CheckoutSessionModePayment)),
	}
	applyStripeCheckoutPaymentMethod(params, paymentMethod)
	applyStripeCheckoutCustomer(params, customerId, email)
	return params, nil
}
