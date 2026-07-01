package controller

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/checkout/session"
	stripecustomer "github.com/stripe/stripe-go/v81/customer"
	stripeinvoice "github.com/stripe/stripe-go/v81/invoice"
	stripeinvoiceitem "github.com/stripe/stripe-go/v81/invoiceitem"
	stripeprice "github.com/stripe/stripe-go/v81/price"
	stripetaxid "github.com/stripe/stripe-go/v81/taxid"
	"github.com/stripe/stripe-go/v81/webhook"
	"github.com/thanhpk/randstr"
)

var stripeAdaptor = &StripeAdaptor{}

// StripePayRequest represents a payment request for Stripe checkout.
type StripePayRequest struct {
	// Amount is the quantity of units to purchase.
	Amount int64 `json:"amount"`
	// PaymentMethod specifies the payment method (e.g., "stripe").
	PaymentMethod string `json:"payment_method"`
	// StripeCurrency opts into the supported Stripe top-up package flow.
	// Stripe Checkout chooses presentment currency from customer location.
	StripeCurrency string `json:"stripe_currency,omitempty"`
	// SuccessURL is the optional custom URL to redirect after successful payment.
	// If empty, defaults to the server's console log page.
	SuccessURL string `json:"success_url,omitempty"`
	// CancelURL is the optional custom URL to redirect when payment is canceled.
	// If empty, defaults to the server's console topup page.
	CancelURL string `json:"cancel_url,omitempty"`
	// InvoiceRequested enables Stripe invoice creation for this Checkout Session.
	InvoiceRequested bool `json:"invoice_requested,omitempty"`
	// InvoiceProfile is snapshotted to the local order when InvoiceRequested is true.
	InvoiceProfile *model.InvoiceProfileFields `json:"invoice_profile,omitempty"`
	// SaveCard, when true (onboarding promo top-ups), saves the card during payment via
	// setup_future_usage so it can be charged off-session later.
	SaveCard    bool   `json:"save_card,omitempty"`
	GAClientID  string `json:"ga_client_id,omitempty"`
	GASessionID string `json:"ga_session_id,omitempty"`
}

type StripeAdaptor struct {
}

const (
	stripeTopUpLineQuantity int64 = 1
)

type stripeTopUpCheckout struct {
	PriceId         string
	Quantity        int64
	Money           float64
	PaymentCurrency string
	AmountMinor     int64
}

type stripeTopUpCurrencyPackage struct {
	PriceId string
}

type stripeCheckoutPaymentContract struct {
	SessionId           string
	PriceId             string
	Quantity            int64
	AmountSubtotalMinor int64
	AmountTotalMinor    int64
	Currency            string
}

func resolveStripeTopUpCheckout(req *StripePayRequest, normalizedAmount int64, group string) (*stripeTopUpCheckout, error) {
	if req == nil {
		return nil, errors.New("invalid Stripe checkout request")
	}

	requestedCurrency := strings.ToUpper(strings.TrimSpace(req.StripeCurrency))
	if requestedCurrency == "" {
		return nil, errors.New("Stripe checkout currency is required")
	}

	if !stripeTopUpCurrencySupported(requestedCurrency) {
		return nil, errors.New("unsupported Stripe checkout currency")
	}

	pkg, ok := stripeTopUpPackageFor(normalizedAmount)
	if !ok {
		return nil, fmt.Errorf("Stripe checkout package requires one of configured preset amounts: %s USD credits", stripeTopUpPresetAmountLabel())
	}
	if strings.TrimSpace(pkg.PriceId) == "" {
		return nil, fmt.Errorf("Stripe %d Price ID is not configured", normalizedAmount)
	}
	priceId := strings.TrimSpace(pkg.PriceId)
	amountMinor, err := stripePriceAmountMinorForCheckoutCurrency(priceId, requestedCurrency)
	if err != nil {
		return nil, err
	}
	if err := validateStripeTopUpPriceContract(priceId, requestedCurrency, normalizedAmount, amountMinor); err != nil {
		return nil, err
	}

	return &stripeTopUpCheckout{
		PriceId:         priceId,
		Quantity:        stripeTopUpLineQuantity,
		Money:           float64(normalizedAmount),
		PaymentCurrency: requestedCurrency,
		AmountMinor:     amountMinor,
	}, nil
}

func stripeTopUpCurrencySupported(currency string) bool {
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case "USD", "JPY", "BRL":
		return true
	default:
		return false
	}
}

var stripePriceAmountMinorForCheckoutCurrency = getStripePriceAmountMinorForCurrency
var stripePriceGetter = stripeprice.Get

func getStripePriceAmountMinorForCurrency(priceId string, requestedCurrency string) (int64, error) {
	priceId = strings.TrimSpace(priceId)
	normalizedCurrency := strings.ToUpper(strings.TrimSpace(requestedCurrency))
	if priceId == "" {
		return 0, errors.New("Stripe Price ID is not configured")
	}
	if normalizedCurrency == "" {
		return 0, errors.New("Stripe checkout currency is required")
	}
	if err := ensureStripeKey(); err != nil {
		return 0, err
	}

	params := &stripe.PriceParams{}
	params.AddExpand("currency_options")
	price, err := stripePriceGetter(priceId, params)
	if err != nil {
		return 0, err
	}
	amountMinor, ok := stripePriceAmountMinorForCurrency(price, normalizedCurrency)
	if !ok {
		return 0, fmt.Errorf("Stripe Price %s does not support %s", priceId, normalizedCurrency)
	}
	if amountMinor <= 0 {
		return 0, fmt.Errorf("Stripe Price %s has invalid %s amount", priceId, normalizedCurrency)
	}
	return amountMinor, nil
}

func validateStripeTopUpPriceContract(priceId string, requestedCurrency string, packageAmount int64, amountMinor int64) error {
	normalizedCurrency := strings.ToUpper(strings.TrimSpace(requestedCurrency))
	expectedAmountMinor, ok := expectedStripeTopUpAmountMinor(normalizedCurrency, packageAmount)
	if !ok {
		return fmt.Errorf("Stripe top-up price contract is not configured for %d %s package", packageAmount, normalizedCurrency)
	}
	if amountMinor != expectedAmountMinor {
		return fmt.Errorf("Stripe Price %s has invalid %s amount for %d package: expected %d got %d", strings.TrimSpace(priceId), normalizedCurrency, packageAmount, expectedAmountMinor, amountMinor)
	}
	return nil
}

func expectedStripeTopUpAmountMinor(currency string, packageAmount int64) (int64, bool) {
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case "USD":
		switch packageAmount {
		case 10:
			return 1000, true
		case 20:
			return 2000, true
		case 200:
			return 20000, true
		}
	case "JPY":
		switch packageAmount {
		case 10:
			return 1500, true
		case 20:
			return 3000, true
		case 200:
			return 30000, true
		}
	case "BRL":
		switch packageAmount {
		case 10:
			return 4990, true
		case 20:
			return 9990, true
		case 200:
			return 99000, true
		}
	}
	return 0, false
}

func stripePriceSupportsCurrency(price *stripe.Price, requestedCurrency string) bool {
	_, ok := stripePriceAmountMinorForCurrency(price, requestedCurrency)
	return ok
}

func stripePriceAmountMinorForCurrency(price *stripe.Price, requestedCurrency string) (int64, bool) {
	normalizedCurrency := strings.ToLower(strings.TrimSpace(requestedCurrency))
	if price == nil || normalizedCurrency == "" {
		return 0, false
	}
	if strings.ToLower(string(price.Currency)) == normalizedCurrency {
		return price.UnitAmount, true
	}
	for currency := range price.CurrencyOptions {
		if strings.ToLower(strings.TrimSpace(currency)) == normalizedCurrency {
			option := price.CurrencyOptions[currency]
			if option == nil {
				return 0, false
			}
			return option.UnitAmount, true
		}
	}
	return 0, false
}

func stripeTopUpPackageFor(amount int64) (stripeTopUpCurrencyPackage, bool) {
	if !stripeTopUpPresetAmountConfigured(amount) {
		return stripeTopUpCurrencyPackage{}, false
	}
	return stripeTopUpCurrencyPackage{
		PriceId: setting.StripeTopUpPriceIDForAmount(amount),
	}, true
}

func stripeTopUpPresetAmountConfigured(amount int64) bool {
	for _, preset := range stripeTopUpPresetAmounts() {
		if preset == amount {
			return true
		}
	}
	return false
}

func stripeTopUpPresetAmounts() []int64 {
	seen := map[int64]bool{}
	amounts := make([]int64, 0, len(operation_setting.GetPaymentSetting().AmountOptions))
	for _, amount := range operation_setting.GetPaymentSetting().AmountOptions {
		normalized := int64(amount)
		if normalized <= 0 || seen[normalized] {
			continue
		}
		seen[normalized] = true
		amounts = append(amounts, normalized)
	}
	sort.Slice(amounts, func(i, j int) bool {
		return amounts[i] < amounts[j]
	})
	return amounts
}

func stripeTopUpPresetAmountLabel() string {
	amounts := stripeTopUpPresetAmounts()
	if len(amounts) == 0 {
		return "configured preset amounts"
	}
	parts := make([]string, 0, len(amounts))
	for _, amount := range amounts {
		parts = append(parts, strconv.FormatInt(amount, 10))
	}
	return strings.Join(parts, ", ")
}

func (*StripeAdaptor) RequestAmount(c *gin.Context, req *StripePayRequest) {
	if req.Amount < getStripeMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getStripeMinTopup())})
		return
	}
	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}
	payMoney := getStripePayMoney(float64(req.Amount), group)
	if payMoney <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": strconv.FormatFloat(payMoney, 'f', 2, 64)})
}

func (*StripeAdaptor) RequestPay(c *gin.Context, req *StripePayRequest) {
	if req.PaymentMethod != model.PaymentMethodStripe {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "不支持的支付渠道"})
		return
	}
	if req.Amount < getStripeMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": fmt.Sprintf("充值数量不能小于 %d", getStripeMinTopup()), "data": 10})
		return
	}
	if req.Amount > 10000 {
		c.JSON(http.StatusOK, gin.H{"message": "充值数量不能大于 10000", "data": 10})
		return
	}

	if err := validateStripeRedirectURL(c, req.SuccessURL); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "支付成功重定向URL不在可信任域名列表中", "data": ""})
		return
	}

	if err := validateStripeRedirectURL(c, req.CancelURL); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "支付取消重定向URL不在可信任域名列表中", "data": ""})
		return
	}

	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "用户不存在"})
		return
	}

	normalizedAmount, bonusAmount := configuredTopUpAmounts(req.Amount, user.Group)
	if normalizedAmount <= 0 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值数量无效"})
		return
	}

	checkout, err := resolveStripeTopUpCheckout(req, normalizedAmount, user.Group)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
		return
	}
	if checkout.Money <= 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	var invoiceFields model.InvoiceProfileFields
	var invoiceRequested bool
	if req.InvoiceRequested {
		if req.InvoiceProfile == nil {
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "Invoice profile is required"})
			return
		}
		fields, err := stripeInvoiceProfileForUser(*req.InvoiceProfile, user)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": err.Error()})
			return
		}
		invoiceFields = fields
		invoiceRequested = true
	}

	reference := fmt.Sprintf("new-api-ref-%d-%d-%s", user.Id, time.Now().UnixMilli(), randstr.String(4))
	referenceId := "ref_" + common.Sha1([]byte(reference))

	topUp := &model.TopUp{
		UserId:             id,
		Amount:             normalizedAmount,
		BonusAmount:        bonusAmount,
		BonusTier:          int(req.Amount),
		Money:              checkout.Money,
		TradeNo:            referenceId,
		PaymentMethod:      model.PaymentMethodStripe,
		PaymentProvider:    model.PaymentProviderStripe,
		PaymentCurrency:    checkout.PaymentCurrency,
		PaymentPriceId:     checkout.PriceId,
		PaymentAmountMinor: checkout.AmountMinor,
		GAClientID:         service.NormalizeGAIdentifier(req.GAClientID),
		GASessionID:        service.NormalizeGAIdentifier(req.GASessionID),
		CreateTime:         time.Now().Unix(),
		Status:             common.TopUpStatusPending,
		SaveCard:           req.SaveCard,
	}
	err = topUp.Insert()
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, referenceId, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	if invoiceRequested {
		profile := &model.UserInvoiceProfile{
			UserId:               id,
			InvoiceProfileFields: invoiceFields,
		}
		if err := model.SaveUserInvoiceProfile(profile); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 保存用户开票资料失败 user_id=%d trade_no=%s error=%q", id, referenceId, err.Error()))
			topUp.Status = common.TopUpStatusFailed
			_ = topUp.Update()
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "保存开票资料失败"})
			return
		}
		paymentInvoice := &model.PaymentInvoice{
			TradeNo:              referenceId,
			UserId:               id,
			OrderType:            model.PaymentOrderTypeTopUp,
			PaymentProvider:      model.PaymentProviderStripe,
			InvoiceRequested:     true,
			InvoiceProfileFields: invoiceFields,
			StripeCustomerId:     strings.TrimSpace(user.StripeCustomer),
			InvoiceStatus:        model.PaymentInvoiceStatusRequested,
		}
		if err := model.CreatePaymentInvoiceSnapshot(paymentInvoice); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 创建开票快照失败 user_id=%d trade_no=%s error=%q", id, referenceId, err.Error()))
			topUp.Status = common.TopUpStatusFailed
			_ = topUp.Update()
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建开票快照失败"})
			return
		}
	}

	// Stripe delivers invoice emails to the Customer object's email. When an invoice is
	// requested, make sure the Stripe customer carries the account email from users.email
	// before we open Checkout: new customers are created with it, and existing customers are
	// updated to it (Checkout's customer_update cannot set email, so this is the only hook).
	checkoutEmail := strings.TrimSpace(user.Email)
	checkoutCustomerId := strings.TrimSpace(user.StripeCustomer)
	if invoiceRequested {
		if err := ensureStripeKey(); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 开票准备客户失败（密钥无效）user_id=%d trade_no=%s error=%q", id, referenceId, err.Error()))
			topUp.Status = common.TopUpStatusFailed
			_ = topUp.Update()
			_ = model.UpdatePaymentInvoiceStatus(referenceId, model.PaymentInvoiceStatusFailed)
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
			return
		}
		customerId, err := ensureStripeInvoiceCustomer(topUp, user, invoiceFields)
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 开票准备客户失败 user_id=%d trade_no=%s error=%q", id, referenceId, err.Error()))
			topUp.Status = common.TopUpStatusFailed
			_ = topUp.Update()
			_ = model.UpdatePaymentInvoiceStatus(referenceId, model.PaymentInvoiceStatusFailed)
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
			return
		}
		checkoutCustomerId = customerId
	}

	checkoutSession, err := genStripeLink(referenceId, checkoutCustomerId, checkoutEmail, checkout, req.SuccessURL, req.CancelURL, invoiceRequested, req.SaveCard)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 创建 Checkout Session 失败 user_id=%d trade_no=%s amount=%d error=%q", id, referenceId, req.Amount, err.Error()))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		if invoiceRequested {
			_ = model.UpdatePaymentInvoiceStatus(referenceId, model.PaymentInvoiceStatusFailed)
		}
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
		return
	}
	if checkoutSession != nil {
		topUp.GatewayTradeNo = strings.TrimSpace(checkoutSession.ID)
		if err := topUp.Update(); err != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("Stripe 更新充值订单支付网关信息失败 trade_no=%s session_id=%s error=%q", referenceId, checkoutSession.ID, err.Error()))
		}
	}
	if invoiceRequested && checkoutSession != nil {
		customerId := strings.TrimSpace(user.StripeCustomer)
		if checkoutSession.Customer != nil && strings.TrimSpace(checkoutSession.Customer.ID) != "" {
			customerId = strings.TrimSpace(checkoutSession.Customer.ID)
		}
		if err := model.UpdatePaymentInvoiceStripeSession(referenceId, customerId, checkoutSession.ID); err != nil && !errors.Is(err, model.ErrPaymentInvoiceNotFound) {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("Stripe 更新 Checkout Session 到开票快照失败 trade_no=%s session_id=%s error=%q", referenceId, checkoutSession.ID, err.Error()))
		}
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Stripe 充值订单创建成功 user_id=%d trade_no=%s amount=%d normalized_amount=%d money=%.2f currency=%s", id, referenceId, req.Amount, normalizedAmount, checkout.Money, checkout.PaymentCurrency))
	if checkoutSession == nil || strings.TrimSpace(checkoutSession.URL) == "" {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe Checkout Session 缺少支付链接 user_id=%d trade_no=%s", id, referenceId))
		topUp.Status = common.TopUpStatusFailed
		_ = topUp.Update()
		if invoiceRequested {
			_ = model.UpdatePaymentInvoiceStatus(referenceId, model.PaymentInvoiceStatusFailed)
		}
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

func RequestStripeTopUpInvoice(c *gin.Context) {
	tradeNo := strings.TrimSpace(c.Param("trade_no"))
	if tradeNo == "" {
		common.ApiErrorMsg(c, "Top-up order not found")
		return
	}

	var req model.InvoiceProfileFields
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "Invalid request parameters")
		return
	}

	userId := c.GetInt("id")
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.UserId != userId {
		common.ApiErrorMsg(c, "Top-up order not found")
		return
	}
	if topUp.PaymentProvider != model.PaymentProviderStripe {
		common.ApiErrorMsg(c, "Only Stripe top-ups support invoices")
		return
	}
	if topUp.Status != common.TopUpStatusSuccess {
		common.ApiErrorMsg(c, "Invoice can only be requested after payment succeeds")
		return
	}

	existingInvoice, err := model.GetPaymentInvoiceByTradeNo(tradeNo)
	if err != nil && !errors.Is(err, model.ErrPaymentInvoiceNotFound) {
		common.ApiError(c, err)
		return
	}
	if existingInvoice != nil && strings.TrimSpace(existingInvoice.StripeInvoiceId) != "" {
		common.ApiSuccess(c, existingInvoice)
		return
	}

	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil {
		common.ApiErrorMsg(c, "User not found")
		return
	}
	fields, err := stripeInvoiceProfileForUser(req, user)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	profile := &model.UserInvoiceProfile{
		UserId:               userId,
		InvoiceProfileFields: fields,
	}
	if err := model.SaveUserInvoiceProfile(profile); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 补开发票保存用户开票资料失败 user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
		common.ApiErrorMsg(c, "Failed to save invoice profile")
		return
	}

	if existingInvoice == nil {
		paymentInvoice := &model.PaymentInvoice{
			TradeNo:                 tradeNo,
			UserId:                  userId,
			OrderType:               model.PaymentOrderTypeTopUp,
			PaymentProvider:         model.PaymentProviderStripe,
			InvoiceRequested:        true,
			InvoiceProfileFields:    fields,
			StripeCustomerId:        strings.TrimSpace(user.StripeCustomer),
			StripeCheckoutSessionId: strings.TrimSpace(topUp.GatewayTradeNo),
			InvoiceStatus:           model.PaymentInvoiceStatusPending,
		}
		if err := model.CreatePaymentInvoiceSnapshot(paymentInvoice); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 补开发票创建开票快照失败 user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
			common.ApiErrorMsg(c, "Failed to request invoice")
			return
		}
	} else {
		if err := model.UpdatePaymentInvoiceProfile(tradeNo, fields, model.PaymentInvoiceStatusPending); err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 补开发票更新开票快照失败 user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
			common.ApiErrorMsg(c, "Failed to request invoice")
			return
		}
		_ = model.UpdatePaymentInvoiceStripeSession(tradeNo, strings.TrimSpace(user.StripeCustomer), strings.TrimSpace(topUp.GatewayTradeNo))
	}

	stripeInv, err := createPaidStripeTopUpInvoice(c.Request.Context(), topUp, user, fields)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 补开发票失败 user_id=%d trade_no=%s error=%q", userId, tradeNo, err.Error()))
		_ = model.UpdatePaymentInvoiceStatus(tradeNo, model.PaymentInvoiceStatusFailed)
		common.ApiErrorMsg(c, "Failed to request invoice")
		return
	}

	update := stripeInvoiceUpdateFromInvoice(stripeInv, model.StripeInvoiceUpdate{
		StripeCheckoutSessionId: strings.TrimSpace(topUp.GatewayTradeNo),
	})
	if update.StripeCustomerId == "" {
		update.StripeCustomerId = strings.TrimSpace(user.StripeCustomer)
	}
	if err := model.UpdatePaymentInvoiceStripeInvoice(tradeNo, update); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 补开发票回写失败 user_id=%d trade_no=%s invoice_id=%s error=%q", userId, tradeNo, update.StripeInvoiceId, err.Error()))
		common.ApiError(c, err)
		return
	}

	invoice, err := model.GetPaymentInvoiceByTradeNo(tradeNo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, invoice)
}

func RequestStripeAmount(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	stripeAdaptor.RequestAmount(c, &req)
}

func RequestStripePay(c *gin.Context) {
	var req StripePayRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}
	stripeAdaptor.RequestPay(c, &req)
}

func StripeWebhook(c *gin.Context) {
	ctx := c.Request.Context()
	if !isStripeWebhookEnabled() {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe webhook 被拒绝 reason=webhook_disabled path=%q client_ip=%s", c.Request.RequestURI, c.ClientIP()))
		c.AbortWithStatus(http.StatusForbidden)
		return
	}

	payload, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe webhook 读取请求体失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusServiceUnavailable)
		return
	}

	signature := c.GetHeader("Stripe-Signature")
	logger.LogInfo(ctx, fmt.Sprintf("Stripe webhook 收到请求 path=%q client_ip=%s signature=%q body=%q", c.Request.RequestURI, c.ClientIP(), signature, string(payload)))
	event, err := webhook.ConstructEventWithOptions(payload, signature, setting.StripeWebhookSecret, webhook.ConstructEventOptions{
		IgnoreAPIVersionMismatch: true,
	})

	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe webhook 验签失败 path=%q client_ip=%s error=%q", c.Request.RequestURI, c.ClientIP(), err.Error()))
		c.AbortWithStatus(http.StatusBadRequest)
		return
	}

	callerIp := c.ClientIP()
	logger.LogInfo(ctx, fmt.Sprintf("Stripe webhook 验签成功 event_type=%s client_ip=%s path=%q", string(event.Type), callerIp, c.Request.RequestURI))
	switch event.Type {
	case stripe.EventTypeCheckoutSessionCompleted:
		sessionCompleted(ctx, event, callerIp)
	case stripe.EventTypeCheckoutSessionExpired:
		sessionExpired(ctx, event)
	case stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded:
		sessionAsyncPaymentSucceeded(ctx, event, callerIp)
	case stripe.EventTypeCheckoutSessionAsyncPaymentFailed:
		sessionAsyncPaymentFailed(ctx, event, callerIp)
	default:
		logger.LogInfo(ctx, fmt.Sprintf("Stripe webhook 忽略事件 event_type=%s client_ip=%s", string(event.Type), callerIp))
	}

	c.Status(http.StatusOK)
}

func sessionCompleted(ctx context.Context, event stripe.Event, callerIp string) {
	customerId := event.GetObjectValue("customer")
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if "complete" != status {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe checkout.completed 状态异常，忽略处理 trade_no=%s status=%s client_ip=%s", referenceId, status, callerIp))
		return
	}

	// The old setup-mode card-bind flow (送 $10 绑卡) has been retired. Cards are now saved
	// during a paid recharge (save_card → setup_future_usage), handled in fulfillOrder. Any
	// lingering setup-mode session (e.g. a delayed redelivery of a pre-retirement bind) carries
	// no payment, so just acknowledge and ignore it — never grant a bonus.
	if event.GetObjectValue("mode") == string(stripe.CheckoutSessionModeSetup) || strings.HasPrefix(referenceId, stripeCardBindReferencePrefix) {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 收到已下线的 setup-mode 绑卡会话，忽略 trade_no=%s client_ip=%s", referenceId, callerIp))
		return
	}

	paymentStatus := event.GetObjectValue("payment_status")
	if paymentStatus != "paid" {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe Checkout 支付未完成，等待异步结果 trade_no=%s payment_status=%s client_ip=%s", referenceId, paymentStatus, callerIp))
		return
	}

	fulfillOrder(ctx, event, referenceId, customerId, callerIp)
}

// sessionAsyncPaymentSucceeded handles delayed payment methods (bank transfer, SEPA, etc.)
// that confirm payment after the checkout session completes.
func sessionAsyncPaymentSucceeded(ctx context.Context, event stripe.Event, callerIp string) {
	customerId := event.GetObjectValue("customer")
	referenceId := event.GetObjectValue("client_reference_id")
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 异步支付成功 trade_no=%s client_ip=%s", referenceId, callerIp))

	fulfillOrder(ctx, event, referenceId, customerId, callerIp)
}

// sessionAsyncPaymentFailed marks orders as failed when delayed payment methods
// ultimately fail (e.g. bank transfer not received, SEPA rejected).
func sessionAsyncPaymentFailed(ctx context.Context, event stripe.Event, callerIp string) {
	referenceId := event.GetObjectValue("client_reference_id")
	logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败 trade_no=%s client_ip=%s", referenceId, callerIp))

	if len(referenceId) == 0 {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败事件缺少订单号 client_ip=%s", callerIp))
		return
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)

	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败但本地订单不存在 trade_no=%s client_ip=%s", referenceId, callerIp))
		return
	}

	if topUp.PaymentProvider != model.PaymentProviderStripe {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败但订单支付网关不匹配 trade_no=%s payment_provider=%s client_ip=%s", referenceId, topUp.PaymentProvider, callerIp))
		return
	}

	if topUp.Status != common.TopUpStatusPending {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 异步支付失败但订单状态非 pending，忽略处理 trade_no=%s status=%s client_ip=%s", referenceId, topUp.Status, callerIp))
		return
	}

	topUp.Status = common.TopUpStatusFailed
	if err := topUp.Update(); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 标记充值订单失败状态失败 trade_no=%s client_ip=%s error=%q", referenceId, callerIp, err.Error()))
		return
	}
	if err := model.UpdatePaymentInvoiceStatus(referenceId, model.PaymentInvoiceStatusFailed); err != nil && !errors.Is(err, model.ErrPaymentInvoiceNotFound) {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 标记开票失败状态失败 trade_no=%s client_ip=%s error=%q", referenceId, callerIp, err.Error()))
	}
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值订单已标记为失败 trade_no=%s client_ip=%s", referenceId, callerIp))
}

// fulfillOrder is the shared logic for crediting quota after payment is confirmed.
func fulfillOrder(ctx context.Context, event stripe.Event, referenceId string, customerId string, callerIp string) {
	if len(referenceId) == 0 {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 完成订单时缺少订单号 client_ip=%s", callerIp))
		return
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	payload := map[string]any{
		"customer":     customerId,
		"amount_total": event.GetObjectValue("amount_total"),
		"currency":     strings.ToUpper(event.GetObjectValue("currency")),
		"event_type":   string(event.Type),
	}
	if err := model.CompleteSubscriptionOrder(referenceId, common.GetJsonString(payload), model.PaymentProviderStripe, ""); err == nil {
		syncStripePaymentInvoice(ctx, event, referenceId, customerId)
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 订阅订单处理成功 trade_no=%s event_type=%s client_ip=%s", referenceId, string(event.Type), callerIp))
		return
	} else if err != nil && !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		logger.LogError(ctx, fmt.Sprintf("Stripe 订阅订单处理失败 trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
		return
	}

	if err := validateStripeTopUpPaymentContract(event, referenceId); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 鍏呭€煎叆璐︽牎楠屽け璐?trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
		return
	}

	recharged, err := model.RechargeWithPaymentSnapshot(referenceId, customerId, callerIp, stripePaymentSnapshotFromEvent(event))
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 充值处理失败 trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
		return
	}
	if recharged {
		topUp := model.GetTopUpByTradeNo(referenceId)
		sendPaymentSuccessGA(ctx, topUp)
		// For save-card (onboarding promo) top-ups the card is already marked bound atomically
		// inside model.Recharge's transaction. Here we only best-effort backfill the card's
		// fingerprint (a Stripe API call, too slow/failure-prone for the credit transaction),
		// used for anti-abuse dedup. Only on first fulfillment (recharged==true).
		backfillCardFingerprintFromTopUp(ctx, topUp, customerId, callerIp)
	}

	syncStripePaymentInvoice(ctx, event, referenceId, customerId)
	snapshot := stripePaymentSnapshotFromEvent(event)
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值成功 trade_no=%s amount_total=%.2f currency=%s event_type=%s client_ip=%s", referenceId, snapshot.Money, snapshot.Currency, string(event.Type), callerIp))
}

var stripeCheckoutPaymentContractFromEvent = getStripeCheckoutPaymentContractFromEvent

func validateStripeTopUpPaymentContract(event stripe.Event, referenceId string) error {
	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil {
		return model.ErrTopUpNotFound
	}
	if topUp.PaymentProvider != model.PaymentProviderStripe {
		return model.ErrPaymentMethodMismatch
	}
	if topUp.Status == common.TopUpStatusSuccess {
		return nil
	}
	if topUp.Status != common.TopUpStatusPending {
		return model.ErrTopUpStatusInvalid
	}

	expectedPriceId := strings.TrimSpace(topUp.PaymentPriceId)
	expectedCurrency := strings.ToUpper(strings.TrimSpace(topUp.PaymentCurrency))
	if expectedPriceId == "" || expectedCurrency == "" || topUp.PaymentAmountMinor <= 0 {
		return errors.New("Stripe top-up expected payment contract is missing")
	}

	actual, err := stripeCheckoutPaymentContractFromEvent(event)
	if err != nil {
		return err
	}

	expectedSessionId := strings.TrimSpace(topUp.GatewayTradeNo)
	if actual.SessionId != "" && expectedSessionId != "" && actual.SessionId != expectedSessionId {
		return fmt.Errorf("Stripe checkout session mismatch: expected %s got %s", expectedSessionId, actual.SessionId)
	}
	if actual.PriceId != expectedPriceId {
		return fmt.Errorf("Stripe checkout price mismatch: expected %s got %s", expectedPriceId, actual.PriceId)
	}
	if actual.Quantity != stripeTopUpLineQuantity {
		return fmt.Errorf("Stripe checkout quantity mismatch: expected %d got %d", stripeTopUpLineQuantity, actual.Quantity)
	}
	if actual.AmountSubtotalMinor != topUp.PaymentAmountMinor {
		return fmt.Errorf("Stripe checkout amount mismatch: expected %d got %d", topUp.PaymentAmountMinor, actual.AmountSubtotalMinor)
	}
	if actual.AmountTotalMinor < topUp.PaymentAmountMinor {
		return fmt.Errorf("Stripe checkout total mismatch: expected at least %d got %d", topUp.PaymentAmountMinor, actual.AmountTotalMinor)
	}
	if strings.ToUpper(strings.TrimSpace(actual.Currency)) != expectedCurrency {
		return fmt.Errorf("Stripe checkout currency mismatch: expected %s got %s", expectedCurrency, actual.Currency)
	}
	return nil
}

func getStripeCheckoutPaymentContractFromEvent(event stripe.Event) (stripeCheckoutPaymentContract, error) {
	sessionId := strings.TrimSpace(event.GetObjectValue("id"))
	if sessionId == "" {
		return stripeCheckoutPaymentContract{}, errors.New("Stripe checkout session id is missing")
	}
	if err := ensureStripeKey(); err != nil {
		return stripeCheckoutPaymentContract{}, err
	}

	params := &stripe.CheckoutSessionListLineItemsParams{
		Session: stripe.String(sessionId),
	}
	params.AddExpand("data.price")
	iter := session.ListLineItems(params)

	var contract stripeCheckoutPaymentContract
	for iter.Next() {
		item := iter.LineItem()
		if item == nil {
			continue
		}
		if contract.PriceId != "" {
			return stripeCheckoutPaymentContract{}, errors.New("Stripe checkout contains multiple line items")
		}
		if item.Price == nil || strings.TrimSpace(item.Price.ID) == "" {
			return stripeCheckoutPaymentContract{}, errors.New("Stripe checkout line item price is missing")
		}
		contract = stripeCheckoutPaymentContract{
			SessionId:           sessionId,
			PriceId:             strings.TrimSpace(item.Price.ID),
			Quantity:            item.Quantity,
			AmountSubtotalMinor: item.AmountSubtotal,
			AmountTotalMinor:    item.AmountTotal,
			Currency:            strings.ToUpper(string(item.Currency)),
		}
	}
	if err := iter.Err(); err != nil {
		return stripeCheckoutPaymentContract{}, err
	}
	if contract.PriceId == "" {
		return stripeCheckoutPaymentContract{}, errors.New("Stripe checkout line item is missing")
	}
	return contract, nil
}

func stripePaymentSnapshotFromEvent(event stripe.Event) model.PaymentSnapshot {
	currency := strings.ToUpper(strings.TrimSpace(event.GetObjectValue("currency")))
	rawTotal := event.GetObjectValue("amount_total")
	total, err := strconv.ParseFloat(rawTotal, 64)
	if err != nil || total < 0 || currency == "" {
		logger.LogWarn(nil, fmt.Sprintf("Stripe 支付快照字段缺失 event_type=%s amount_total=%q currency=%q", string(event.Type), rawTotal, currency))
		return model.PaymentSnapshot{}
	}
	scale := 2.0
	switch currency {
	case "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF":
		scale = 0
	}
	if scale == 0 {
		return model.PaymentSnapshot{Money: total, Currency: currency}
	}
	return model.PaymentSnapshot{Money: total / 100, Currency: currency}
}

// backfillCardFingerprintFromTopUp best-effort records the saved card's Stripe fingerprint
// (used for anti-abuse dedup) after a save-card top-up. The card is already marked bound
// atomically inside model.Recharge; this only adds the fingerprint, which requires a slow
// Stripe API call unsuitable for the credit transaction. No-op for ordinary wallet top-ups.
// Failures are logged, not fatal. Call only on first fulfillment.
func backfillCardFingerprintFromTopUp(ctx context.Context, topUp *model.TopUp, customerId string, callerIp string) {
	if topUp == nil || topUp.UserId <= 0 {
		return
	}
	// Only save-card (onboarding promo) top-ups have a card to record.
	if !topUp.SaveCard {
		return
	}
	customerId = strings.TrimSpace(customerId)
	// The checkout.session.completed event sometimes omits the customer id; fall back to the
	// customer recorded on the user (Recharge persisted it from this same event, or pre-existing).
	if customerId == "" {
		if user, err := model.GetUserById(topUp.UserId, false); err == nil && user != nil {
			customerId = strings.TrimSpace(user.StripeCustomer)
		}
	}
	if customerId == "" {
		// No customer to query: binding (if any) was handled in the transaction; nothing to add.
		return
	}
	fingerprint := fetchCardFingerprint(customerId)
	if strings.TrimSpace(fingerprint) == "" {
		return
	}
	// Idempotently persist customer + fingerprint (and ensure card_bound) — safe to repeat.
	if err := model.SetStripeCardBound(topUp.UserId, customerId, fingerprint); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 充值绑卡：记录卡指纹失败 user_id=%d trade_no=%s error=%q", topUp.UserId, topUp.TradeNo, err.Error()))
		return
	}
	// Consume this card's one-time new-user-bonus slot so the same physical card cannot later
	// farm the free new-user bonus on other accounts via the setup-mode bind path (both guard on
	// the StripeBonusClaim unique index). The promo flow already rewarded the user with a paid
	// deposit bonus, so it doesn't grant the free bonus itself — it only claims the slot.
	if err := model.ClaimStripeCardFingerprint(topUp.UserId, fingerprint); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 充值绑卡：占用卡指纹名额失败 user_id=%d trade_no=%s error=%q", topUp.UserId, topUp.TradeNo, err.Error()))
	}
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值绑卡：已记录卡指纹 user_id=%d trade_no=%s client_ip=%s", topUp.UserId, topUp.TradeNo, callerIp))
}

func sessionExpired(ctx context.Context, event stripe.Event) {
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if "expired" != status {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe checkout.expired 状态异常，忽略处理 trade_no=%s status=%s", referenceId, status))
		return
	}

	if len(referenceId) == 0 {
		logger.LogWarn(ctx, "Stripe checkout.expired 缺少订单号")
		return
	}

	// Subscription order expiration
	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	if err := model.ExpireSubscriptionOrder(referenceId, model.PaymentProviderStripe); err == nil {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 订阅订单已过期 trade_no=%s", referenceId))
		return
	} else if err != nil && !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		logger.LogError(ctx, fmt.Sprintf("Stripe 订阅订单过期处理失败 trade_no=%s error=%q", referenceId, err.Error()))
		return
	}

	err := model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusExpired)
	if errors.Is(err, model.ErrTopUpNotFound) {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 充值订单不存在，无法标记过期 trade_no=%s", referenceId))
		return
	}
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 充值订单过期处理失败 trade_no=%s error=%q", referenceId, err.Error()))
		return
	}
	if err := model.UpdatePaymentInvoiceStatus(referenceId, model.PaymentInvoiceStatusExpired); err != nil && !errors.Is(err, model.ErrPaymentInvoiceNotFound) {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 标记开票过期状态失败 trade_no=%s error=%q", referenceId, err.Error()))
	}

	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值订单已过期 trade_no=%s", referenceId))
}

func syncStripePaymentInvoice(ctx context.Context, event stripe.Event, referenceId string, customerId string) {
	if _, err := model.GetPaymentInvoiceByTradeNo(referenceId); err != nil {
		if !errors.Is(err, model.ErrPaymentInvoiceNotFound) {
			logger.LogWarn(ctx, fmt.Sprintf("Stripe 查询开票快照失败 trade_no=%s error=%q", referenceId, err.Error()))
		}
		return
	}

	sessionId := strings.TrimSpace(event.GetObjectValue("id"))
	invoiceId := strings.TrimSpace(event.GetObjectValue("invoice"))
	update := model.StripeInvoiceUpdate{
		StripeCustomerId:        customerId,
		StripeCheckoutSessionId: sessionId,
		StripeInvoiceId:         invoiceId,
		InvoiceStatus:           model.PaymentInvoiceStatusPending,
	}

	if invoiceId != "" {
		stripe.Key = setting.StripeApiSecret
		inv, err := stripeinvoice.Get(invoiceId, nil)
		if err != nil {
			logger.LogWarn(ctx, fmt.Sprintf("Stripe 获取 invoice 失败 trade_no=%s invoice_id=%s error=%q", referenceId, invoiceId, err.Error()))
		} else if inv != nil {
			update = stripeInvoiceUpdateFromInvoice(inv, update)
		}
	}

	if err := model.UpdatePaymentInvoiceStripeInvoice(referenceId, update); err != nil && !errors.Is(err, model.ErrPaymentInvoiceNotFound) {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 更新开票快照失败 trade_no=%s invoice_id=%s error=%q", referenceId, invoiceId, err.Error()))
	}
}

func stripeInvoiceUpdateFromInvoice(inv *stripe.Invoice, update model.StripeInvoiceUpdate) model.StripeInvoiceUpdate {
	if inv == nil {
		return update
	}
	if inv.Customer != nil && strings.TrimSpace(inv.Customer.ID) != "" {
		update.StripeCustomerId = strings.TrimSpace(inv.Customer.ID)
	}
	update.StripeInvoiceId = strings.TrimSpace(inv.ID)
	update.StripeInvoiceNumber = inv.Number
	update.StripeInvoiceUrl = inv.HostedInvoiceURL
	update.StripeInvoicePdf = inv.InvoicePDF
	update.InvoiceStatus = mapStripeInvoiceStatus(inv.Status)
	return update
}

func mapStripeInvoiceStatus(status stripe.InvoiceStatus) string {
	switch status {
	case stripe.InvoiceStatusPaid:
		return model.PaymentInvoiceStatusPaid
	case stripe.InvoiceStatusVoid, stripe.InvoiceStatusUncollectible:
		return model.PaymentInvoiceStatusFailed
	case stripe.InvoiceStatusDraft, stripe.InvoiceStatusOpen:
		return model.PaymentInvoiceStatusPending
	default:
		return model.PaymentInvoiceStatusPending
	}
}

func createPaidStripeTopUpInvoice(ctx context.Context, topUp *model.TopUp, user *model.User, fields model.InvoiceProfileFields) (*stripe.Invoice, error) {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return nil, fmt.Errorf("无效的Stripe API密钥")
	}

	stripe.Key = setting.StripeApiSecret
	customerId, err := ensureStripeInvoiceCustomer(topUp, user, fields)
	if err != nil {
		return nil, err
	}
	if customerId == "" {
		return nil, errors.New("Stripe customer is unavailable")
	}

	if err := ensureStripeCustomerTaxID(ctx, customerId, fields); err != nil {
		return nil, err
	}

	currency := strings.ToLower(strings.TrimSpace(topUp.PaymentCurrency))
	if currency == "" {
		templatePrice, err := stripeprice.Get(setting.StripePriceId, nil)
		if err != nil {
			return nil, err
		}
		if templatePrice == nil || templatePrice.Currency == "" {
			return nil, errors.New("Stripe Price 币种无效")
		}
		currency = strings.ToLower(string(templatePrice.Currency))
	}
	minorAmount, err := stripeMinorUnitAmount(topUp.Money, currency)
	if err != nil {
		return nil, err
	}

	inv, err := stripeinvoice.New(&stripe.InvoiceParams{
		AutoAdvance:      stripe.Bool(false),
		CollectionMethod: stripe.String(string(stripe.InvoiceCollectionMethodChargeAutomatically)),
		Customer:         stripe.String(customerId),
		Metadata: map[string]string{
			"trade_no": topUp.TradeNo,
			"source":   "new-api",
		},
	})
	if err != nil {
		return nil, err
	}

	_, err = stripeinvoiceitem.New(&stripe.InvoiceItemParams{
		Amount:      stripe.Int64(minorAmount),
		Currency:    stripe.String(currency),
		Customer:    stripe.String(customerId),
		Description: stripe.String(fmt.Sprintf("Wallet top-up %s", topUp.TradeNo)),
		Invoice:     stripe.String(inv.ID),
		Metadata: map[string]string{
			"trade_no": topUp.TradeNo,
			"source":   "new-api",
		},
	})
	if err != nil {
		return nil, err
	}

	finalized, err := stripeinvoice.FinalizeInvoice(inv.ID, &stripe.InvoiceFinalizeInvoiceParams{})
	if err != nil {
		return nil, err
	}
	paid, err := stripeinvoice.Pay(finalized.ID, &stripe.InvoicePayParams{
		PaidOutOfBand: stripe.Bool(true),
	})
	if err != nil {
		return nil, err
	}

	// A charge_automatically invoice marked paid out-of-band is never emailed by Stripe
	// on its own, so deliver it explicitly. For an already-paid invoice the email omits
	// any payment reference and simply hands the customer their finalized invoice + PDF.
	// Best-effort: the invoice is already created, finalized and persisted for in-app
	// download, so a send failure must not fail the whole top-up invoice request.
	sent, err := stripeinvoice.SendInvoice(paid.ID, &stripe.InvoiceSendInvoiceParams{})
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 发送发票邮件失败 trade_no=%s invoice_id=%s error=%q", topUp.TradeNo, paid.ID, err.Error()))
		return paid, nil
	}
	return sent, nil
}

func ensureStripeInvoiceCustomer(topUp *model.TopUp, user *model.User, fields model.InvoiceProfileFields) (string, error) {
	customerId := strings.TrimSpace(user.StripeCustomer)
	if customerId == "" && topUp != nil && strings.TrimSpace(topUp.GatewayTradeNo) != "" {
		checkoutSession, err := session.Get(strings.TrimSpace(topUp.GatewayTradeNo), nil)
		if err != nil {
			return "", err
		}
		if checkoutSession != nil && checkoutSession.Customer != nil {
			customerId = strings.TrimSpace(checkoutSession.Customer.ID)
		}
	}

	params := stripeCustomerParamsForInvoice(user, fields)
	if customerId == "" {
		customer, err := stripecustomer.New(params)
		if err != nil {
			return "", err
		}
		if customer == nil || strings.TrimSpace(customer.ID) == "" {
			return "", errors.New("Stripe customer is unavailable")
		}
		return strings.TrimSpace(customer.ID), nil
	}

	if _, err := stripecustomer.Update(customerId, params); err != nil {
		return "", err
	}
	return customerId, nil
}

func stripeCustomerParamsForInvoice(user *model.User, fields model.InvoiceProfileFields) *stripe.CustomerParams {
	email := ""
	if user != nil {
		email = strings.TrimSpace(user.Email)
	}
	params := &stripe.CustomerParams{
		Address: &stripe.AddressParams{
			City:       stripe.String(fields.City),
			Country:    stripe.String(fields.Country),
			Line1:      stripe.String(fields.AddressLine1),
			Line2:      stripe.String(fields.AddressLine2),
			PostalCode: stripe.String(fields.PostalCode),
			State:      stripe.String(fields.State),
		},
		Name: stripe.String(fields.CompanyName),
		Metadata: map[string]string{
			"source": "new-api",
		},
	}
	if email != "" {
		params.Email = stripe.String(email)
		params.Metadata["user_email"] = email
	}
	if strings.TrimSpace(fields.Phone) != "" {
		params.Phone = stripe.String(fields.Phone)
	}
	return params
}

func ensureStripeCustomerTaxID(ctx context.Context, customerId string, fields model.InvoiceProfileFields) error {
	taxIDType := strings.TrimSpace(fields.TaxIDType)
	taxIDValue := strings.TrimSpace(fields.TaxID)
	if customerId == "" || taxIDType == "" || taxIDValue == "" {
		return nil
	}

	iter := stripetaxid.List(&stripe.TaxIDListParams{
		Customer: stripe.String(customerId),
	})
	for iter.Next() {
		existing := iter.TaxID()
		if existing != nil && string(existing.Type) == taxIDType && strings.TrimSpace(existing.Value) == taxIDValue {
			return nil
		}
	}
	if err := iter.Err(); err != nil {
		return err
	}

	if _, err := stripetaxid.New(&stripe.TaxIDParams{
		Customer: stripe.String(customerId),
		Type:     stripe.String(taxIDType),
		Value:    stripe.String(taxIDValue),
	}); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 创建 customer tax id 失败 customer_id=%s tax_id_type=%s error=%q", customerId, taxIDType, err.Error()))
		return err
	}
	return nil
}

// genStripeLink generates a Stripe Checkout session URL for payment.
// It creates a new checkout session with the specified parameters and returns the payment URL.
//
// Parameters:
//   - referenceId: unique reference identifier for the transaction
//   - customerId: existing Stripe customer ID (empty string if new customer)
//   - email: customer email address for new customer creation
//   - checkout: server-resolved Stripe Price, quantity, and expected payment amount
//   - successURL: custom URL to redirect after successful payment (empty for default)
//   - cancelURL: custom URL to redirect when payment is canceled (empty for default)
//
// Returns the checkout session URL or an error if the session creation fails.
func genStripeLink(referenceId string, customerId string, email string, checkout *stripeTopUpCheckout, successURL string, cancelURL string, invoiceRequested bool, saveCard bool) (*stripe.CheckoutSession, error) {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return nil, fmt.Errorf("无效的Stripe API密钥")
	}

	stripe.Key = setting.StripeApiSecret
	if checkout == nil || strings.TrimSpace(checkout.PriceId) == "" {
		return nil, fmt.Errorf("Stripe Price ID 未配置")
	}

	// Use custom URLs if provided, otherwise use defaults
	if successURL == "" {
		successURL = paymentReturnPath("/console/log")
	}
	if cancelURL == "" {
		cancelURL = paymentReturnPath("/console/topup")
	}

	params := buildStripeCheckoutSessionParams(referenceId, customerId, strings.TrimSpace(email), checkout.PriceId, checkout.Quantity, successURL, cancelURL, invoiceRequested, saveCard)

	// For onboarding promo top-ups, save the card while paying so it can be charged
	// off-session later (postpaid auto-charge). Plain wallet top-ups don't save the card.
	if saveCard {
		params.PaymentIntentData = &stripe.CheckoutSessionPaymentIntentDataParams{
			SetupFutureUsage: stripe.String("off_session"),
		}
	}

	result, err := session.New(params)
	if err != nil {
		return nil, err
	}

	return result, nil
}

func validateStripeRedirectURL(c *gin.Context, rawURL string) error {
	if rawURL == "" {
		return nil
	}

	err := common.ValidateRedirectURL(rawURL)
	if err == nil {
		return nil
	}

	if isSameRequestHostRedirect(c, rawURL) {
		return nil
	}

	return err
}

func isSameRequestHostRedirect(c *gin.Context, rawURL string) bool {
	parsedURL, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return false
	}

	redirectHost := canonicalRedirectHostname(parsedURL.Host)
	if redirectHost == "" {
		return false
	}

	for _, requestHost := range stripeRedirectTrustedHostsFromRequest(c) {
		if redirectHost == requestHost {
			return true
		}
	}
	return false
}

func stripeRedirectTrustedHostsFromRequest(c *gin.Context) []string {
	hostSet := make(map[string]struct{})
	addHost := func(host string) {
		normalizedHost := canonicalRedirectHostname(host)
		if normalizedHost != "" {
			hostSet[normalizedHost] = struct{}{}
		}
	}
	addURLHost := func(rawURL string) {
		parsedURL, err := url.Parse(strings.TrimSpace(rawURL))
		if err != nil {
			return
		}
		if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
			return
		}
		addHost(parsedURL.Host)
	}

	addHost(c.Request.Host)
	for _, forwardedHost := range strings.Split(c.GetHeader("X-Forwarded-Host"), ",") {
		addHost(forwardedHost)
	}
	addURLHost(c.GetHeader("Origin"))
	addURLHost(c.GetHeader("Referer"))

	hosts := make([]string, 0, len(hostSet))
	for host := range hostSet {
		hosts = append(hosts, host)
	}
	return hosts
}

func canonicalRedirectHostname(host string) string {
	parsedHost, err := url.Parse("//" + strings.TrimSpace(host))
	if err != nil {
		return ""
	}
	return strings.TrimSuffix(strings.ToLower(parsedHost.Hostname()), ".")
}

func buildStripeCheckoutSessionParams(referenceId string, customerId string, email string, priceId string, quantity int64, successURL string, cancelURL string, invoiceRequested bool, saveCard bool) *stripe.CheckoutSessionParams {
	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceId),
		SuccessURL:        stripe.String(successURL),
		CancelURL:         stripe.String(cancelURL),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			buildStripeTopUpLineItem(priceId, quantity),
		},
		Mode:                stripe.String(string(stripe.CheckoutSessionModePayment)),
		AllowPromotionCodes: stripe.Bool(true),
	}

	if "" == customerId {
		if "" != email {
			params.CustomerEmail = stripe.String(email)
		}

		params.CustomerCreation = stripe.String(string(stripe.CheckoutSessionCustomerCreationAlways))
	} else {
		params.Customer = stripe.String(customerId)
	}

	if invoiceRequested {
		params.BillingAddressCollection = stripe.String(string(stripe.CheckoutSessionBillingAddressCollectionRequired))
		params.TaxIDCollection = &stripe.CheckoutSessionTaxIDCollectionParams{
			Enabled:  stripe.Bool(true),
			Required: stripe.String(string(stripe.CheckoutSessionTaxIDCollectionRequiredNever)),
		}
		params.InvoiceCreation = &stripe.CheckoutSessionInvoiceCreationParams{
			Enabled: stripe.Bool(true),
			InvoiceData: &stripe.CheckoutSessionInvoiceCreationInvoiceDataParams{
				Metadata: map[string]string{
					"trade_no": referenceId,
					"source":   "new-api",
				},
			},
		}
		if customerId != "" {
			params.CustomerUpdate = &stripe.CheckoutSessionCustomerUpdateParams{
				Name:    stripe.String("auto"),
				Address: stripe.String("auto"),
			}
		}
	}

	return params
}

func buildStripeTopUpLineItem(priceId string, amount int64) *stripe.CheckoutSessionLineItemParams {
	return &stripe.CheckoutSessionLineItemParams{
		Price:    stripe.String(strings.TrimSpace(priceId)),
		Quantity: stripe.Int64(amount),
	}
}

func stripeMinorUnitAmount(amount float64, currency string) (int64, error) {
	if amount <= 0 {
		return 0, errors.New("invalid amount")
	}
	scale := int32(2)
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF":
		scale = 0
	}
	return decimal.NewFromFloat(amount).Mul(decimal.NewFromInt(1).Shift(scale)).Round(0).IntPart(), nil
}

func normalizeStripeTopUpAmount(amount int64) int64 {
	return normalizeTopUpAmount(amount)
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
