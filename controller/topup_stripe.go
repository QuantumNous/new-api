package controller

import (
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
	"github.com/stripe/stripe-go/v81/webhook"
	"github.com/thanhpk/randstr"
)

const (
	PaymentMethodStripe = "stripe"
)

var stripeAdaptor = &StripeAdaptor{}

// StripePayRequest represents a payment request for Stripe checkout.
type StripePayRequest struct {
	// Amount is the quantity of units to purchase.
	Amount int64 `json:"amount"`
	// PaymentMethod specifies the payment method (e.g., "stripe").
	PaymentMethod string `json:"payment_method"`
	// SuccessURL is the optional custom URL to redirect after successful payment.
	// If empty, defaults to the server's console log page.
	SuccessURL string `json:"success_url,omitempty"`
	// CancelURL is the optional custom URL to redirect when payment is canceled.
	// If empty, defaults to the server's console topup page.
	CancelURL string `json:"cancel_url,omitempty"`
}

type StripeAdaptor struct {
}

func (*StripeAdaptor) RequestAmount(c *gin.Context, req *StripePayRequest) {
	if req.Amount < getStripeMinTopup() {
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentMinTopup, map[string]any{"Min": getStripeMinTopup()})})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgUserGetGroupFailed)})
		return
	}
	payMoney := getStripePayMoney(float64(req.Amount), group)
	if payMoney <= 0.01 {
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentAmountTooLow)})
		return
	}
	c.JSON(200, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func (*StripeAdaptor) RequestPay(c *gin.Context, req *StripePayRequest) {
	if req.PaymentMethod != PaymentMethodStripe {
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentMethodNotExists)})
		return
	}
	if req.Amount < getStripeMinTopup() {
		c.JSON(200, gin.H{"message": i18n.T(c, i18n.MsgPaymentMinTopup, map[string]any{"Min": getStripeMinTopup()}), "data": 10})
		return
	}
	if req.Amount > 10000 {
		c.JSON(200, gin.H{"message": i18n.T(c, i18n.MsgPaymentMaxTopup), "data": 10})
		return
	}

	if req.SuccessURL != "" && common.ValidateRedirectURL(req.SuccessURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": i18n.T(c, i18n.MsgPaymentSuccessRedirectUntrusted), "data": ""})
		return
	}

	if req.CancelURL != "" && common.ValidateRedirectURL(req.CancelURL) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": i18n.T(c, i18n.MsgPaymentCancelRedirectUntrusted), "data": ""})
		return
	}

	id := c.GetInt("id")
	user, _ := model.GetUserById(id, false)
	chargedMoney := GetChargedAmount(float64(req.Amount), *user)

	reference := fmt.Sprintf("new-api-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "ref_" + common.Sha1([]byte(reference))

	payLink, err := genStripeLink(referenceId, user.StripeCustomer, user.Email, req.Amount, req.SuccessURL, req.CancelURL)
	if err != nil {
		log.Println("failed to get Stripe Checkout payment link", err)
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentStartFailed)})
		return
	}

	topUp := &model.TopUp{
		UserId:        id,
		Amount:        req.Amount,
		Money:         chargedMoney,
		TradeNo:       referenceId,
		PaymentMethod: PaymentMethodStripe,
		CreateTime:    time.Now().Unix(),
		Status:        common.TopUpStatusPending,
	}
	err = topUp.Insert()
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentCreateFailed)})
		return
	}
	c.JSON(200, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": payLink,
		},
	})
}

func RequestStripeAmount(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgInvalidParams)})
		return
	}
	stripeAdaptor.RequestAmount(c, &req)
}

func RequestStripePay(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(200, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgInvalidParams)})
		return
	}
	stripeAdaptor.RequestPay(c, &req)
}

func StripeWebhook(c *gin.Context) {
	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Printf("failed to parse Stripe webhook payload: %v\n", err)
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}

	signature := c.GetHeader("Stripe-Signature")
	endpointSecret := setting.StripeWebhookSecret
	event, err := webhook.ConstructEventWithOptions(payload, signature, endpointSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})

	if err != nil {
		log.Printf("Stripe webhook signature verification failed: %v\n", err)
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	switch event.Type {
	case stripe.EventTypeCheckoutSessionCompleted:
		sessionCompleted(event)
	case stripe.EventTypeCheckoutSessionExpired:
		sessionExpired(event)
	default:
		log.Printf("unsupported Stripe webhook event type: %s\n", event.Type)
	}

	c.Status(http.StatusOK)
}

func sessionCompleted(event stripe.Event) {
	customerId := event.GetObjectValue("customer")
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if "complete" != status {
		log.Println("invalid Stripe Checkout completion status:", status, ",", referenceId)
		return
	}

	// Try complete subscription order first
	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	payload := map[string]any{
		"customer":     customerId,
		"amount_total": event.GetObjectValue("amount_total"),
		"currency":     strings.ToUpper(event.GetObjectValue("currency")),
		"event_type":   string(event.Type),
	}
	if err := model.CompleteSubscriptionOrder(referenceId, common.GetJsonString(payload)); err == nil {
		return
	} else if err != nil && !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		log.Println("complete subscription order failed:", err.Error(), referenceId)
		return
	}

	err := model.Recharge(referenceId, customerId)
	if err != nil {
		log.Println(err.Error(), referenceId)
		return
	}

	total, _ := strconv.ParseFloat(event.GetObjectValue("amount_total"), 64)
	currency := strings.ToUpper(event.GetObjectValue("currency"))
	log.Printf("payment received: %s, %.2f(%s)", referenceId, total/100, currency)
}

func sessionExpired(event stripe.Event) {
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if "expired" != status {
		log.Println("invalid Stripe Checkout expired status:", status, ",", referenceId)
		return
	}

	if len(referenceId) == 0 {
		log.Println("payment reference is missing")
		return
	}

	// Subscription order expiration
	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	if err := model.ExpireSubscriptionOrder(referenceId); err == nil {
		return
	} else if err != nil && !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		log.Println("failed to expire subscription order", referenceId, ", err:", err.Error())
		return
	}

	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil {
		log.Println("top-up order does not exist", referenceId)
		return
	}

	if topUp.Status != common.TopUpStatusPending {
		log.Println("top-up order status is invalid", referenceId)
	}

	topUp.Status = common.TopUpStatusExpired
	err := topUp.Update()
	if err != nil {
		log.Println("failed to expire top-up order", referenceId, ", err:", err.Error())
		return
	}

	log.Println("top-up order expired", referenceId)
}

// genStripeLink generates a Stripe Checkout session URL for payment.
// It creates a new checkout session with the specified parameters and returns the payment URL.
//
// Parameters:
//   - referenceId: unique reference identifier for the transaction
//   - customerId: existing Stripe customer ID (empty string if new customer)
//   - email: customer email address for new customer creation
//   - amount: quantity of units to purchase
//   - successURL: custom URL to redirect after successful payment (empty for default)
//   - cancelURL: custom URL to redirect when payment is canceled (empty for default)
//
// Returns the checkout session URL or an error if the session creation fails.
func genStripeLink(referenceId string, customerId string, email string, amount int64, successURL string, cancelURL string) (string, error) {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return "", fmt.Errorf("invalid stripe api key")
	}

	stripe.Key = setting.StripeApiSecret

	// Use custom URLs if provided, otherwise use defaults
	if successURL == "" {
		successURL = system_setting.ServerAddress + "/console/log"
	}
	if cancelURL == "" {
		cancelURL = system_setting.ServerAddress + "/console/topup"
	}

	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceId),
		SuccessURL:        stripe.String(successURL),
		CancelURL:         stripe.String(cancelURL),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			{
				Price:    stripe.String(setting.StripePriceId),
				Quantity: stripe.Int64(amount),
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

func GetChargedAmount(count float64, user model.User) float64 {
	topUpGroupRatio := common.GetTopupGroupRatio(user.Group)
	if topUpGroupRatio == 0 {
		topUpGroupRatio = 1
	}

	return count * topUpGroupRatio
}

func getStripePayMoney(amount float64, group string) float64 {
	originalAmount := amount
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	// Using float64 for monetary calculations is acceptable here due to the small amounts involved
	topupGroupRatio := common.GetTopupGroupRatio(group)
	if topupGroupRatio == 0 {
		topupGroupRatio = 1
	}
	// apply optional preset discount by the original request amount (if configured), default 1.0
	discount := 1.0
	if ds, ok := operation_setting.GetPaymentSetting().AmountDiscount[int(originalAmount)]; ok {
		if ds > 0 {
			discount = ds
		}
	}
	payMoney := amount * setting.StripeUnitPrice * topupGroupRatio * discount
	return payMoney
}

func getStripeMinTopup() int64 {
	minTopup := setting.StripeMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}
