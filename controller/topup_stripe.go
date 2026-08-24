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
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/shopspring/decimal"
	"github.com/stripe/stripe-go/v86"
	stripecharge "github.com/stripe/stripe-go/v86/charge"
	"github.com/stripe/stripe-go/v86/checkout/session"
	stripecustomer "github.com/stripe/stripe-go/v86/customer"
	stripeinvoice "github.com/stripe/stripe-go/v86/invoice"
	stripeinvoiceitem "github.com/stripe/stripe-go/v86/invoiceitem"
	stripeinvoicepayment "github.com/stripe/stripe-go/v86/invoicepayment"
	stripeprice "github.com/stripe/stripe-go/v86/price"
	stripesubscription "github.com/stripe/stripe-go/v86/subscription"
	stripetaxid "github.com/stripe/stripe-go/v86/taxid"
	"github.com/stripe/stripe-go/v86/webhook"
	"github.com/thanhpk/randstr"
	"golang.org/x/sync/singleflight"
	"gorm.io/gorm"
)

var stripeAdaptor = &StripeAdaptor{}
var stripeCheckoutSessionGetter = session.Get

// StripePayRequest represents a payment request for Stripe checkout.
type StripePayRequest struct {
	// Amount is the quantity of units to purchase.
	Amount int64 `json:"amount"`
	// PaymentMethod specifies the payment method (e.g., "stripe").
	PaymentMethod string `json:"payment_method"`
	// StripeCurrency opts into the supported Stripe top-up package flow.
	// Stripe Checkout chooses presentment currency from customer location.
	StripeCurrency string `json:"stripe_currency,omitempty"`
	RecallClaim    string `json:"recall_claim,omitempty"`
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
	// UIMode selects the Checkout presentation. "embedded" renders Checkout inside the
	// console on our own domain (requires StripePublishableKey to be configured);
	// anything else keeps the hosted checkout.stripe.com redirect.
	UIMode string `json:"ui_mode,omitempty"`
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

var stripeTopUpPriceContract = map[string]map[int64]int64{
	"USD": {10: 1000, 20: 2000, 50: 5000, 100: 10000, 200: 20000},
	"JPY": {10: 1500, 20: 3000, 50: 7500, 100: 15000, 200: 30000},
	"BRL": {10: 4990, 20: 9990, 50: 24990, 100: 49990, 200: 99090},
	"INR": {10: 89900, 20: 179900, 50: 449900, 100: 899900, 200: 1799000},
}

const (
	stripeTopUpCurrencyPriceCacheTTL    = 5 * time.Minute
	stripeTopUpCurrencyPriceMaxStaleAge = 30 * time.Minute
)

type stripeTopUpCurrencyPriceCacheEntry struct {
	prices     map[string]int64
	expiresAt  time.Time
	staleUntil time.Time
}

var stripeTopUpCurrencyPriceCache = struct {
	sync.RWMutex
	entries map[string]stripeTopUpCurrencyPriceCacheEntry
}{entries: make(map[string]stripeTopUpCurrencyPriceCacheEntry)}

var stripeTopUpCurrencyPriceNow = time.Now
var stripeTopUpCurrencyPriceSingleflight singleflight.Group

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
	_, ok := stripeTopUpPriceContract[strings.ToUpper(strings.TrimSpace(currency))]
	return ok
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
	prices, ok := stripeTopUpPriceContract[strings.ToUpper(strings.TrimSpace(currency))]
	if !ok {
		return 0, false
	}
	amountMinor, ok := prices[packageAmount]
	return amountMinor, ok
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

func cachedStripeTopUpCurrencyPrices(priceID string) (map[string]int64, error) {
	priceID = strings.TrimSpace(priceID)
	if priceID == "" {
		return map[string]int64{}, nil
	}

	pricesAny, err, _ := stripeTopUpCurrencyPriceSingleflight.Do(priceID, func() (any, error) {
		now := stripeTopUpCurrencyPriceNow()
		stripeTopUpCurrencyPriceCache.RLock()
		entry, ok := stripeTopUpCurrencyPriceCache.entries[priceID]
		stripeTopUpCurrencyPriceCache.RUnlock()
		if ok && now.Before(entry.expiresAt) {
			return cloneStripeTopUpCurrencyPrices(entry.prices), nil
		}

		if err := ensureStripeKey(); err != nil {
			if ok && len(entry.prices) > 0 && now.Before(entry.staleUntil) {
				return cloneStripeTopUpCurrencyPrices(entry.prices), fmt.Errorf(
					"refresh Stripe Price %s: %w (using stale prices)",
					priceID,
					err,
				)
			}
			return nil, err
		}
		params := &stripe.PriceParams{}
		params.AddExpand("currency_options")
		price, err := stripePriceGetter(priceID, params)
		if err != nil {
			if ok && len(entry.prices) > 0 && now.Before(entry.staleUntil) {
				return cloneStripeTopUpCurrencyPrices(entry.prices), fmt.Errorf(
					"refresh Stripe Price %s: %w (using stale prices)",
					priceID,
					err,
				)
			}
			return nil, err
		}

		prices := make(map[string]int64)
		for currency := range stripeTopUpPriceContract {
			minor, supported := stripePriceAmountMinorForCurrency(price, currency)
			if supported && minor > 0 {
				prices[currency] = minor
			}
		}
		stripeTopUpCurrencyPriceCache.Lock()
		stripeTopUpCurrencyPriceCache.entries[priceID] = stripeTopUpCurrencyPriceCacheEntry{
			prices:     cloneStripeTopUpCurrencyPrices(prices),
			expiresAt:  now.Add(stripeTopUpCurrencyPriceCacheTTL),
			staleUntil: now.Add(stripeTopUpCurrencyPriceMaxStaleAge),
		}
		stripeTopUpCurrencyPriceCache.Unlock()
		return prices, nil
	})
	prices, ok := pricesAny.(map[string]int64)
	if !ok {
		if err != nil {
			return nil, err
		}
		return nil, errors.New("invalid cached Stripe top-up currency prices")
	}
	return cloneStripeTopUpCurrencyPrices(prices), err
}

func cloneStripeTopUpCurrencyPrices(prices map[string]int64) map[string]int64 {
	cloned := make(map[string]int64, len(prices))
	for currency, amount := range prices {
		cloned[currency] = amount
	}
	return cloned
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

	service.RecordRecallClaimAttribution(c.Request.Context(), id, req.RecallClaim)
	resolvedRecallOffer, err := service.GetRecallRuntime().Claims.ResolveBestRecallOffer(
		c.Request.Context(),
		id,
		service.RecallPurchaseKindTopUp,
		checkout.PriceId,
		checkout.PaymentCurrency,
		checkout.AmountMinor*checkout.Quantity,
	)
	if err != nil {
		logger.LogWarn(c.Request.Context(), fmt.Sprintf("Stripe top-up recall offer resolution failed user_id=%d price_id=%s error=%q", id, checkout.PriceId, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": i18n.T(c, i18n.MsgPaymentRecallClaimUnavailable)})
		return
	}
	recallDiscount := service.RecallCheckoutDiscountFromResolvedOffer(resolvedRecallOffer)

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
			_ = model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusFailed)
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
			_ = model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusFailed)
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
			_ = model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusFailed)
			_ = model.UpdatePaymentInvoiceStatus(referenceId, model.PaymentInvoiceStatusFailed)
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
			return
		}
		customerId, err := ensureStripeInvoiceCustomer(topUp, user, invoiceFields)
		if err != nil {
			logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 开票准备客户失败 user_id=%d trade_no=%s error=%q", id, referenceId, err.Error()))
			_ = model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusFailed)
			_ = model.UpdatePaymentInvoiceStatus(referenceId, model.PaymentInvoiceStatusFailed)
			c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
			return
		}
		checkoutCustomerId = customerId
	}

	// Embedded mode needs the publishable key on the client to mount Checkout; without
	// it configured we silently keep the hosted redirect so payment never breaks.
	embedded := strings.EqualFold(strings.TrimSpace(req.UIMode), "embedded") &&
		strings.TrimSpace(setting.StripePublishableKey) != ""

	checkoutSession, err := genStripeLink(referenceId, checkoutCustomerId, checkoutEmail, checkout, req.SuccessURL, req.CancelURL, invoiceRequested, req.SaveCard, embedded, stripeCheckoutSubmitMessage(normalizedAmount, bonusAmount), recallDiscount)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe 创建 Checkout Session 失败 user_id=%d trade_no=%s amount=%d error=%q", id, referenceId, req.Amount, err.Error()))
		_ = model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusFailed)
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

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Stripe 充值订单创建成功 user_id=%d trade_no=%s amount=%d normalized_amount=%d money=%.2f currency=%s embedded=%t", id, referenceId, req.Amount, normalizedAmount, checkout.Money, checkout.PaymentCurrency, embedded))

	failMissingPayload := func(what string) {
		logger.LogError(c.Request.Context(), fmt.Sprintf("Stripe Checkout Session 缺少%s user_id=%d trade_no=%s", what, id, referenceId))
		_ = model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusFailed)
		if invoiceRequested {
			_ = model.UpdatePaymentInvoiceStatus(referenceId, model.PaymentInvoiceStatusFailed)
		}
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "拉起支付失败"})
	}

	if embedded {
		if checkoutSession == nil || strings.TrimSpace(checkoutSession.ClientSecret) == "" {
			failMissingPayload("client secret")
			return
		}
		// The embedded dialog renders its own bonus banner above the Stripe form.
		// Amounts are trustworthy only in USD display mode (token display amounts are
		// huge and unreadable in a headline), mirroring stripeCheckoutSubmitMessage.
		c.JSON(http.StatusOK, gin.H{
			"message": "success",
			"data": gin.H{
				"client_secret":   checkoutSession.ClientSecret,
				"publishable_key": setting.StripePublishableKey,
				"topup_summary": gin.H{
					"pay_amount":    normalizedAmount,
					"bonus_amount":  bonusAmount,
					"credit_amount": normalizedAmount + bonusAmount,
					// Only surface USD amounts: the displayed "$" figures are USD, so a
					// non-USD Checkout (JPY/BRL/INR/…) would misrepresent the charge.
					"show_amounts": operation_setting.GetQuotaDisplayType() != operation_setting.QuotaDisplayTypeTokens && strings.EqualFold(checkout.PaymentCurrency, "USD"),
				},
			},
		})
		return
	}

	if checkoutSession == nil || strings.TrimSpace(checkoutSession.URL) == "" {
		failMissingPayload("支付链接")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"pay_link": checkoutSession.URL,
		},
	})
}

// ResumeStripeTopUpCheckout returns the still-open Stripe Checkout session for
// a pending order owned by the current user. It never creates a second order or
// session, so retrying the endpoint cannot double-charge the customer.
func ResumeStripeTopUpCheckout(c *gin.Context) {
	tradeNo := strings.TrimSpace(c.Param("trade_no"))
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil || topUp.UserId != c.GetInt("id") || topUp.PaymentProvider != model.PaymentProviderStripe {
		common.ApiErrorI18n(c, i18n.MsgTopupOrderNotExists)
		return
	}
	if topUp.Status != common.TopUpStatusPending {
		common.ApiErrorI18n(c, i18n.MsgTopupOrderStatus)
		return
	}
	sessionID := strings.TrimSpace(topUp.GatewayTradeNo)
	if sessionID == "" {
		common.ApiErrorI18n(c, i18n.MsgPaymentStartFailed)
		return
	}
	if err := ensureStripeKey(); err != nil {
		common.ApiErrorI18n(c, i18n.MsgPaymentStripeNotConfig)
		return
	}
	checkoutSession, err := stripeCheckoutSessionGetter(sessionID, nil)
	if err != nil || checkoutSession == nil {
		common.ApiErrorI18n(c, i18n.MsgPaymentStartFailed)
		return
	}
	if string(checkoutSession.Status) == "expired" || (checkoutSession.ExpiresAt > 0 && checkoutSession.ExpiresAt <= time.Now().Unix()) {
		_ = model.UpdatePendingTopUpStatus(topUp.TradeNo, model.PaymentProviderStripe, common.TopUpStatusExpired)
		common.ApiErrorI18n(c, i18n.MsgTopupOrderStatus)
		return
	}
	if string(checkoutSession.PaymentStatus) == "paid" || string(checkoutSession.Status) == "complete" {
		common.ApiErrorI18n(c, i18n.MsgTopupOrderStatus)
		return
	}

	data := gin.H{}
	if secret := strings.TrimSpace(checkoutSession.ClientSecret); secret != "" && strings.TrimSpace(setting.StripePublishableKey) != "" {
		data["client_secret"] = secret
		data["publishable_key"] = setting.StripePublishableKey
		data["topup_summary"] = gin.H{
			"pay_amount":    topUp.Amount,
			"bonus_amount":  topUp.BonusAmount,
			"credit_amount": topUp.Amount + topUp.BonusAmount,
			"show_amounts":  operation_setting.GetQuotaDisplayType() != operation_setting.QuotaDisplayTypeTokens && strings.EqualFold(topUp.PaymentCurrency, "USD"),
		}
	} else if payLink := strings.TrimSpace(checkoutSession.URL); payLink != "" {
		data["pay_link"] = payLink
	} else {
		common.ApiErrorI18n(c, i18n.MsgPaymentStartFailed)
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true, "message": "success", "data": data})
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
	var processingErr error
	switch event.Type {
	case stripe.EventTypeCheckoutSessionCompleted:
		processingErr = sessionCompleted(ctx, event, callerIp)
	case stripe.EventTypeCheckoutSessionExpired:
		processingErr = sessionExpired(ctx, event)
	case stripe.EventTypeCheckoutSessionAsyncPaymentSucceeded:
		processingErr = sessionAsyncPaymentSucceeded(ctx, event, callerIp)
	case stripe.EventTypeCheckoutSessionAsyncPaymentFailed:
		processingErr = sessionAsyncPaymentFailed(ctx, event, callerIp)
	case stripe.EventTypeChargeRefunded:
		processingErr = chargeReversed(ctx, event)
	case stripe.EventTypeChargeDisputeCreated:
		processingErr = chargeReversed(ctx, event)
	case stripe.EventTypeInvoicePaid:
		processingErr = handleStripeInvoicePaid(ctx, event)
	case stripe.EventTypeInvoiceCreated:
		processingErr = handleStripeInvoiceCreated(ctx, event)
	case stripe.EventTypeInvoicePaymentFailed:
		processingErr = handleStripeInvoicePaymentFailed(ctx, event)
	case stripe.EventTypeInvoiceVoided:
		processingErr = handleStripeInvoiceVoided(ctx, event)
	case stripe.EventTypeInvoiceMarkedUncollectible:
		processingErr = handleStripeInvoiceMarkedUncollectible(ctx, event)
	case stripe.EventTypeCustomerSubscriptionUpdated:
		processingErr = handleStripeSubscriptionUpdated(ctx, event)
	case stripe.EventTypeCustomerSubscriptionDeleted:
		processingErr = handleStripeSubscriptionDeleted(ctx, event)
	default:
		logger.LogInfo(ctx, fmt.Sprintf("Stripe webhook 忽略事件 event_type=%s client_ip=%s", string(event.Type), callerIp))
	}

	if processingErr != nil {
		if isRetryableStripeWebhookProcessingError(processingErr) {
			logger.LogError(ctx, fmt.Sprintf("Stripe webhook processing failed, returning retry event_type=%s client_ip=%s error=%q", string(event.Type), callerIp, processingErr.Error()))
			c.String(http.StatusInternalServerError, "retry")
			return
		}
		logger.LogError(ctx, fmt.Sprintf("Stripe webhook processing failed permanently, acknowledging event_type=%s client_ip=%s error=%q", string(event.Type), callerIp, processingErr.Error()))
		c.Status(http.StatusOK)
		return
	}

	c.Status(http.StatusOK)
}

type stripeWebhookPermanentError struct {
	err error
}

func (e stripeWebhookPermanentError) Error() string {
	if e.err == nil {
		return ""
	}
	return e.err.Error()
}

func (e stripeWebhookPermanentError) Unwrap() error {
	return e.err
}

func permanentStripeWebhookProcessingError(err error) error {
	if err == nil {
		return nil
	}
	var permanent stripeWebhookPermanentError
	if errors.As(err, &permanent) {
		return err
	}
	return stripeWebhookPermanentError{err: err}
}

func isRetryableStripeWebhookProcessingError(err error) bool {
	if err == nil {
		return false
	}
	var permanent stripeWebhookPermanentError
	return !errors.As(err, &permanent)
}

func sessionCompleted(ctx context.Context, event stripe.Event, callerIp string) error {
	customerId := event.GetObjectValue("customer")
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if "complete" != status {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe checkout.completed 状态异常，忽略处理 trade_no=%s status=%s client_ip=%s", referenceId, status, callerIp))
		return nil
	}

	// The old setup-mode card-bind flow (送 $10 绑卡) has been retired. Cards are now saved
	// during a paid recharge (save_card → setup_future_usage), handled in fulfillOrder. Any
	// lingering setup-mode session (e.g. a delayed redelivery of a pre-retirement bind) carries
	// no payment, so just acknowledge and ignore it — never grant a bonus.
	if event.GetObjectValue("mode") == string(stripe.CheckoutSessionModeSetup) || strings.HasPrefix(referenceId, stripeCardBindReferencePrefix) {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 收到已下线的 setup-mode 绑卡会话，忽略 trade_no=%s client_ip=%s", referenceId, callerIp))
		return nil
	}

	paymentStatus := event.GetObjectValue("payment_status")
	if paymentStatus != string(stripe.CheckoutSessionPaymentStatusPaid) &&
		paymentStatus != string(stripe.CheckoutSessionPaymentStatusNoPaymentRequired) {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe Checkout 支付未完成，等待异步结果 trade_no=%s payment_status=%s client_ip=%s", referenceId, paymentStatus, callerIp))
		return nil
	}

	if event.GetObjectValue("mode") == string(stripe.CheckoutSessionModeSubscription) {
		return reconcileStripeRecurringCheckoutSession(ctx, event)
	}
	if order := model.GetSubscriptionOrderByTradeNo(referenceId); isOneTimePlanStripeOrder(order) {
		return handleStripeOneTimePlanPaid(ctx, event, referenceId, callerIp)
	}
	return fulfillOrder(ctx, event, referenceId, customerId, callerIp)
}

// sessionAsyncPaymentSucceeded handles delayed payment methods (bank transfer, SEPA, etc.)
// that confirm payment after the checkout session completes.
func sessionAsyncPaymentSucceeded(ctx context.Context, event stripe.Event, callerIp string) error {
	customerId := event.GetObjectValue("customer")
	referenceId := event.GetObjectValue("client_reference_id")
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 异步支付成功 trade_no=%s client_ip=%s", referenceId, callerIp))

	if event.GetObjectValue("mode") == string(stripe.CheckoutSessionModeSubscription) {
		return reconcileStripeRecurringCheckoutSession(ctx, event)
	}
	if order := model.GetSubscriptionOrderByTradeNo(referenceId); isOneTimePlanStripeOrder(order) {
		return handleStripeOneTimePlanPaid(ctx, event, referenceId, callerIp)
	}
	return fulfillOrder(ctx, event, referenceId, customerId, callerIp)
}

// sessionAsyncPaymentFailed marks orders as failed when delayed payment methods
// ultimately fail (e.g. bank transfer not received, SEPA rejected).
func sessionAsyncPaymentFailed(ctx context.Context, event stripe.Event, callerIp string) error {
	referenceId := event.GetObjectValue("client_reference_id")
	logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败 trade_no=%s client_ip=%s", referenceId, callerIp))

	if len(referenceId) == 0 {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败事件缺少订单号 client_ip=%s", callerIp))
		return nil
	}

	if event.GetObjectValue("mode") == string(stripe.CheckoutSessionModeSubscription) {
		if err := terminatePendingStripePurchase(ctx, referenceId, model.SubscriptionChangeIntentStatusFailed); err != nil {
			logger.LogError(ctx, fmt.Sprintf("Stripe recurring checkout async failure handling failed trade_no=%s client_ip=%s error=%q", referenceId, callerIp, err.Error()))
			return err
		}
		return nil
	}
	if order := model.GetSubscriptionOrderByTradeNo(referenceId); isOneTimePlanStripeOrder(order) {
		return handleStripeOneTimePlanTerminal(ctx, event, referenceId, model.SubscriptionChangeIntentStatusFailed)
	}

	LockOrder(referenceId)
	defer UnlockOrder(referenceId)

	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败但本地订单不存在 trade_no=%s client_ip=%s", referenceId, callerIp))
		return nil
	}

	if topUp.PaymentProvider != model.PaymentProviderStripe {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 异步支付失败但订单支付网关不匹配 trade_no=%s payment_provider=%s client_ip=%s", referenceId, topUp.PaymentProvider, callerIp))
		return nil
	}

	if topUp.Status != common.TopUpStatusPending {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 异步支付失败但订单状态非 pending，忽略处理 trade_no=%s status=%s client_ip=%s", referenceId, topUp.Status, callerIp))
		return nil
	}

	if err := model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusFailed); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 标记充值订单失败状态失败 trade_no=%s client_ip=%s error=%q", referenceId, callerIp, err.Error()))
		return nil
	}
	if err := model.UpdatePaymentInvoiceStatus(referenceId, model.PaymentInvoiceStatusFailed); err != nil && !errors.Is(err, model.ErrPaymentInvoiceNotFound) {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 标记开票失败状态失败 trade_no=%s client_ip=%s error=%q", referenceId, callerIp, err.Error()))
	}
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值订单已标记为失败 trade_no=%s client_ip=%s", referenceId, callerIp))
	return nil
}

func stripeMajorAmount(minor int64, currency string) float64 {
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case "BIF", "CLP", "DJF", "GNF", "JPY", "KMF", "KRW", "MGA", "PYG", "RWF", "UGX", "VND", "VUV", "XAF", "XOF", "XPF":
		return float64(minor)
	default:
		return float64(minor) / 100
	}
}

// fulfillOrder is the shared logic for crediting quota after payment is confirmed.
func fulfillOrder(ctx context.Context, event stripe.Event, referenceId string, customerId string, callerIp string) (err error) {
	if len(referenceId) == 0 {
		err := permanentStripeWebhookProcessingError(errors.New("Stripe checkout completed without local order reference"))
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 完成订单时缺少订单号 client_ip=%s", callerIp))
		alertStripePaymentProcessingFailure(ctx, event, referenceId, customerId, err)
		return err
	}

	LockOrder(referenceId)
	defer func() {
		UnlockOrder(referenceId)
		alertStripePaymentProcessingFailure(ctx, event, referenceId, customerId, err)
	}()
	payload := stripeSubscriptionProviderPayload(event, referenceId, customerId)
	if order := model.GetSubscriptionOrderByTradeNo(referenceId); order != nil {
		if event.GetObjectValue("mode") == string(stripe.CheckoutSessionModePayment) {
			if err := model.CompleteSubscriptionOrder(referenceId, common.GetJsonString(payload), model.PaymentProviderStripe, model.PaymentMethodStripe); err == nil {
				syncStripePaymentInvoice(ctx, event, referenceId, customerId)
				attributeRecallAfterStripeFulfillment(ctx, event, referenceId, order.UserId)
				logger.LogInfo(ctx, fmt.Sprintf("Stripe one-time subscription order processed trade_no=%s event_type=%s client_ip=%s", referenceId, string(event.Type), callerIp))
				return nil
			} else {
				logger.LogError(ctx, fmt.Sprintf("Stripe one-time subscription order processing failed trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
				return err
			}
		}
		snapshot, snapshotErr := stripeSubscriptionSnapshotFromCheckoutSession(event, order)
		if snapshotErr != nil {
			return snapshotErr
		}
		if _, err := model.CompleteSubscriptionOrderWithProviderBinding(referenceId, common.GetJsonString(payload), model.PaymentProviderStripe, model.PaymentMethodStripe, snapshot); err == nil {
			syncStripePaymentInvoice(ctx, event, referenceId, customerId)
			attributeRecallAfterStripeFulfillment(ctx, event, referenceId, order.UserId)
			logger.LogInfo(ctx, fmt.Sprintf("Stripe subscription order processed trade_no=%s event_type=%s client_ip=%s", referenceId, string(event.Type), callerIp))
			return nil
		} else {
			logger.LogError(ctx, fmt.Sprintf("Stripe subscription order processing failed trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
			return err
		}
	}
	if err := model.CompleteSubscriptionOrder(referenceId, common.GetJsonString(payload), model.PaymentProviderStripe, ""); err == nil {
		order := model.GetSubscriptionOrderByTradeNo(referenceId)
		if order == nil || order.PaymentProvider != model.PaymentProviderStripe || order.Status != common.TopUpStatusSuccess {
			return errors.New("Stripe subscription order did not reach successful state")
		}
		syncStripePaymentInvoice(ctx, event, referenceId, customerId)
		attributeRecallAfterStripeFulfillment(ctx, event, referenceId, order.UserId)
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 订阅订单处理成功 trade_no=%s event_type=%s client_ip=%s", referenceId, string(event.Type), callerIp))
		return nil
	} else if err != nil && !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		logger.LogError(ctx, fmt.Sprintf("Stripe 订阅订单处理失败 trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
		return err
	}

	if err := validateStripeTopUpPaymentContract(event, referenceId); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 鍏呭€煎叆璐︽牎楠屽け璐?trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
		return err
	}

	recharged, err := model.RechargeWithPaymentSnapshot(referenceId, customerId, callerIp, stripePaymentSnapshotFromEvent(event))
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 充值处理失败 trade_no=%s event_type=%s client_ip=%s error=%q", referenceId, string(event.Type), callerIp, err.Error()))
		return err
	}
	topUp := model.GetTopUpByTradeNo(referenceId)
	if topUp == nil || topUp.PaymentProvider != model.PaymentProviderStripe || topUp.Status != common.TopUpStatusSuccess {
		return errors.New("Stripe top-up did not reach successful state")
	}
	if checkoutSessionID := strings.TrimSpace(stripeEventObjectValue(event, "id")); checkoutSessionID != "" {
		if backfillErr := model.BackfillStripeCheckoutSessionID(referenceId, topUp.UserId, checkoutSessionID); backfillErr != nil {
			logger.LogWarn(ctx, fmt.Sprintf("Stripe Checkout Session backfill failed trade_no=%s", referenceId))
		}
	}
	if recharged {
		// For save-card (onboarding promo) top-ups this performs the actual card binding:
		// it verifies via the Stripe API that the customer really has a saved card before
		// setting card_bound (local-method payments finish without saving one), and records
		// the card fingerprint for anti-abuse dedup.
		backfillCardFingerprintFromTopUp(ctx, topUp, customerId, callerIp)
		// Persist the card issuing country as the real payment geography for the
		// ops report. Runs async so the Stripe fetch never extends the order-lock
		// hold; the write is a single-column last-writer-wins analytics update,
		// safe without the lock and under multi-node.
		if topUp != nil {
			paymentIntentId := event.GetObjectValue("payment_intent")
			payerUserId := topUp.UserId
			gopool.Go(func() {
				if cc, ccErr := fetchCardCountry(paymentIntentId, customerId); ccErr == nil && cc != "" {
					model.UpdateUserPayCountry(payerUserId, cc)
				}
			})
		}
	} else if topUp.SaveCard &&
		topUp.Status == common.TopUpStatusSuccess {
		// Webhook redelivery/replay of an already-fulfilled save-card order doubles as the
		// retry lever for card binding. Always re-run the backfill (it is idempotent, one
		// Stripe list call on a rare path) instead of gating on StripeCardBound: bind and
		// the fingerprint's bonus-slot claim are two steps, and a replay must also heal a
		// claim that failed transiently after the bind itself succeeded.
		backfillCardFingerprintFromTopUp(ctx, topUp, customerId, callerIp)
	}

	syncStripePaymentInvoice(ctx, event, referenceId, customerId)
	attributeRecallAfterStripeFulfillment(ctx, event, referenceId, topUp.UserId)
	snapshot := stripePaymentSnapshotFromEvent(event)
	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值成功 trade_no=%s amount_total=%.2f currency=%s event_type=%s client_ip=%s", referenceId, snapshot.Money, snapshot.Currency, string(event.Type), callerIp))
	return nil
}

func stripeSubscriptionProviderPayload(event stripe.Event, tradeNo string, customerID string) map[string]any {
	payload := map[string]any{
		"source_event_id":     strings.TrimSpace(event.ID),
		"checkout_session_id": strings.TrimSpace(stripeEventObjectValue(event, "id")),
		"trade_no":            strings.TrimSpace(tradeNo),
		"customer":            strings.TrimSpace(customerID),
		"event_type":          string(event.Type),
		"amount_total":        event.GetObjectValue("amount_total"),
		"currency":            strings.ToUpper(strings.TrimSpace(stripeEventObjectValue(event, "currency"))),
	}
	if fact, err := service.ParseRecallPayment(event, tradeNo, 0); err == nil {
		payload["checkout_session_id"] = fact.CheckoutSessionID
		payload["discount_amount"] = fact.DiscountAmount
		if fact.ClaimCampaignID > 0 {
			payload["recall_campaign_id"] = fact.ClaimCampaignID
		}
		if fact.ClaimRecipientID > 0 {
			payload["recall_recipient_id"] = fact.ClaimRecipientID
		}
	}
	return payload
}

func attributeRecallAfterStripeFulfillment(ctx context.Context, event stripe.Event, tradeNo string, userID int) {
	if err := attributeRecallAfterStripeFulfillmentResult(ctx, event, tradeNo, userID); err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe recall attribution failed trade_no=%s", tradeNo))
	}
}

func attributeRecallAfterStripeFulfillmentResult(ctx context.Context, event stripe.Event, tradeNo string, userID int) error {
	runtime := service.GetRecallRuntime()
	if runtime == nil || runtime.Attribution == nil {
		return nil
	}
	fact, err := service.ParseRecallPayment(event, tradeNo, userID)
	if err != nil {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe recall attribution parse failed trade_no=%s", tradeNo))
		return err
	}
	if err := runtime.Attribution.Attribute(ctx, fact); err != nil {
		return err
	}
	return nil
}

var stripeCheckoutPaymentContractFromEvent = getStripeCheckoutPaymentContractFromEvent
var stripeSubscriptionSnapshotFromCheckoutSession = getStripeSubscriptionSnapshotFromCheckoutSession
var stripeSubscriptionSnapshotFromSubscriptionEvent = getStripeSubscriptionSnapshotFromSubscriptionEvent
var notifyStripePaymentProcessingFailure = service.NotifyDingTalkPaymentProcessingFailure
var reconcilePaidStripeInvoice = service.ReconcilePaidInvoice
var reconcileFailedStripeInvoice = service.ReconcileFailedInvoice
var prepareStripeSubscriptionDiscountInvoice = service.PrepareStripeSubscriptionDiscountInvoice
var releaseStripeSubscriptionDiscountInvoice = service.ReleaseStripeSubscriptionDiscountInvoice
var terminatePendingStripePurchase = service.TerminatePendingStripePurchase
var fulfillOneTimeStripeSubscriptionPurchase = service.CompleteOneTimeStripeSubscriptionPurchase

func handleStripeInvoicePaid(ctx context.Context, event stripe.Event) (err error) {
	first, processingToken, err := recordStripeSubscriptionWebhookEvent(event)
	if err != nil || !first {
		return err
	}
	defer finishStripeSubscriptionWebhookEvent(event, processingToken, &err)
	invoiceID := strings.TrimSpace(stripeEventObjectValue(event, "id"))
	if invoiceID == "" {
		return permanentStripeWebhookProcessingError(errors.New("Stripe invoice.paid missing invoice id"))
	}
	_, err = reconcilePaidStripeInvoice(ctx, invoiceID)
	if service.IsPermanentPaidInvoiceError(err) {
		return permanentStripeWebhookProcessingError(err)
	}
	return err
}

func handleStripeInvoicePaymentFailed(ctx context.Context, event stripe.Event) (err error) {
	first, processingToken, err := recordStripeSubscriptionWebhookEvent(event)
	if err != nil || !first {
		return err
	}
	defer finishStripeSubscriptionWebhookEvent(event, processingToken, &err)
	invoiceID := strings.TrimSpace(stripeEventObjectValue(event, "id"))
	if invoiceID == "" {
		return permanentStripeWebhookProcessingError(errors.New("Stripe invoice.payment_failed missing invoice id"))
	}
	err = reconcileFailedStripeInvoice(ctx, invoiceID)
	if service.IsPermanentPaidInvoiceError(err) {
		return permanentStripeWebhookProcessingError(err)
	}
	return err
}

func handleStripeInvoiceCreated(ctx context.Context, event stripe.Event) (err error) {
	first, processingToken, err := recordStripeSubscriptionWebhookEvent(event)
	if err != nil || !first {
		return err
	}
	defer finishStripeSubscriptionWebhookEvent(event, processingToken, &err)
	invoiceID := strings.TrimSpace(stripeEventObjectValue(event, "id"))
	if invoiceID == "" {
		return permanentStripeWebhookProcessingError(errors.New("Stripe invoice.created missing invoice id"))
	}
	err = prepareStripeSubscriptionDiscountInvoice(ctx, invoiceID)
	if service.IsPermanentPaidInvoiceError(err) {
		return permanentStripeWebhookProcessingError(err)
	}
	return err
}

func handleStripeInvoiceVoided(ctx context.Context, event stripe.Event) (err error) {
	return handleStripeInvoiceTerminalForDiscountRelease(ctx, event, "invoice.voided")
}

func handleStripeInvoiceMarkedUncollectible(ctx context.Context, event stripe.Event) (err error) {
	return handleStripeInvoiceTerminalForDiscountRelease(ctx, event, "invoice.marked_uncollectible")
}

func handleStripeInvoiceTerminalForDiscountRelease(ctx context.Context, event stripe.Event, eventName string) (err error) {
	first, processingToken, err := recordStripeSubscriptionWebhookEvent(event)
	if err != nil || !first {
		return err
	}
	defer finishStripeSubscriptionWebhookEvent(event, processingToken, &err)
	invoiceID := strings.TrimSpace(stripeEventObjectValue(event, "id"))
	if invoiceID == "" {
		return permanentStripeWebhookProcessingError(fmt.Errorf("Stripe %s missing invoice id", eventName))
	}
	err = releaseStripeSubscriptionDiscountInvoice(ctx, invoiceID)
	if service.IsPermanentPaidInvoiceError(err) {
		return permanentStripeWebhookProcessingError(err)
	}
	return err
}

func reconcileStripeRecurringCheckoutSession(ctx context.Context, event stripe.Event) error {
	invoiceID, err := stripeCheckoutSessionInvoiceID(event)
	if err != nil {
		return err
	}
	_, err = reconcilePaidStripeInvoice(ctx, invoiceID)
	if service.IsPermanentPaidInvoiceError(err) {
		return permanentStripeWebhookProcessingError(err)
	}
	return err
}

func handleStripeOneTimePlanPaid(ctx context.Context, event stripe.Event, referenceId string, callerIp string) (err error) {
	first, processingToken, err := recordStripeSubscriptionWebhookEvent(event)
	if err != nil || !first {
		return err
	}
	defer finishStripeSubscriptionWebhookEvent(event, processingToken, &err)
	order := model.GetSubscriptionOrderByTradeNo(referenceId)
	if !isOneTimePlanStripeOrder(order) {
		return permanentStripeWebhookProcessingError(model.ErrSubscriptionOrderNotFound)
	}
	if !canFulfillOneTimeStripeOrder(order) {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe one-time subscription checkout ignored because local order is not fulfillable trade_no=%s status=%s client_ip=%s", referenceId, order.Status, callerIp))
		return nil
	}
	if err := validateOneTimePlanStripeSessionEvent(event, order); err != nil {
		return permanentStripeWebhookProcessingError(err)
	}
	payload := oneTimePlanStripeProviderPayload(event)
	_, err = fulfillOneTimeStripeSubscriptionPurchase(ctx, referenceId, payload)
	if errors.Is(err, model.ErrSubscriptionOrderStatusInvalid) || errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		return permanentStripeWebhookProcessingError(err)
	}
	if err == nil {
		if order.RecallDiscountAmountMinor > 0 {
			if attributionErr := attributeRecallAfterStripeFulfillmentResult(ctx, event, referenceId, order.UserId); attributionErr != nil {
				logger.LogWarn(ctx, fmt.Sprintf("Stripe one-time recall attribution failed after fulfillment trade_no=%s", referenceId))
				return attributionErr
			}
		} else {
			attributeRecallAfterStripeFulfillment(ctx, event, referenceId, order.UserId)
		}
		logger.LogInfo(ctx, fmt.Sprintf("Stripe one-time subscription order processed trade_no=%s event_type=%s client_ip=%s", referenceId, string(event.Type), callerIp))
	}
	return err
}

func handleStripeOneTimePlanTerminal(ctx context.Context, event stripe.Event, referenceId string, intentStatus string) (err error) {
	first, processingToken, err := recordStripeSubscriptionWebhookEvent(event)
	if err != nil || !first {
		return err
	}
	defer finishStripeSubscriptionWebhookEvent(event, processingToken, &err)
	order := model.GetSubscriptionOrderByTradeNo(referenceId)
	if !isOneTimePlanStripeOrder(order) {
		return nil
	}
	if err := validateOneTimePlanStripeSessionIdentity(event, order); err != nil {
		return permanentStripeWebhookProcessingError(err)
	}
	return terminatePendingStripePurchase(ctx, referenceId, intentStatus)
}

func canFulfillOneTimeStripeOrder(order *model.SubscriptionOrder) bool {
	if order == nil {
		return false
	}
	return order.Status == common.TopUpStatusPending || order.Status == common.TopUpStatusSuccess
}

func isOneTimePlanStripeOrder(order *model.SubscriptionOrder) bool {
	return order != nil && order.PaymentProvider == model.PaymentProviderStripe && isOneTimePlanStripeMethod(order.PaymentMethod)
}

func validateOneTimePlanStripeSessionEvent(event stripe.Event, order *model.SubscriptionOrder) error {
	if err := validateOneTimePlanStripeSessionIdentity(event, order); err != nil {
		return err
	}
	if err := validateOneTimePlanRecallAttributionTuple(order); err != nil {
		return err
	}
	if event.GetObjectValue("mode") != string(stripe.CheckoutSessionModePayment) {
		return errors.New("Stripe one-time checkout mode mismatch")
	}
	paymentStatus := strings.TrimSpace(event.GetObjectValue("payment_status"))
	if paymentStatus != string(stripe.CheckoutSessionPaymentStatusPaid) &&
		paymentStatus != string(stripe.CheckoutSessionPaymentStatusNoPaymentRequired) {
		return errors.New("Stripe one-time checkout is not paid")
	}
	actualAmount := stripeEventAmountMinor(event, "amount_total")
	if actualAmount != order.PaymentAmountMinor {
		return fmt.Errorf("Stripe one-time checkout amount mismatch: expected %d got %d", order.PaymentAmountMinor, actualAmount)
	}
	actualCurrency := strings.ToUpper(strings.TrimSpace(event.GetObjectValue("currency")))
	if actualCurrency != strings.ToUpper(strings.TrimSpace(order.PaymentCurrency)) {
		return fmt.Errorf("Stripe one-time checkout currency mismatch: expected %s got %s", strings.ToUpper(strings.TrimSpace(order.PaymentCurrency)), actualCurrency)
	}
	actualMethod := strings.ToLower(strings.TrimSpace(stripeEventObjectValue(event, "payment_method_types", "0")))
	if actualMethod != strings.ToLower(strings.TrimSpace(order.PaymentMethod)) {
		return fmt.Errorf("Stripe one-time checkout payment method mismatch: expected %s got %s", order.PaymentMethod, actualMethod)
	}
	expectedMetadata := []struct {
		key      string
		expected string
		foldCase bool
	}{
		{key: "user_id", expected: strconv.Itoa(order.UserId)},
		{key: "plan_id", expected: strconv.Itoa(order.PlanId)},
		{key: "change_intent_id", expected: strconv.FormatInt(order.ChangeIntentId, 10)},
		{key: "purchase_intent", expected: strings.TrimSpace(order.PurchaseIntent)},
		{key: "purchase_months", expected: strconv.Itoa(order.PurchaseMonths)},
		{key: "payment_method", expected: strings.ToLower(strings.TrimSpace(order.PaymentMethod)), foldCase: true},
	}
	for _, item := range expectedMetadata {
		actual := strings.TrimSpace(stripeEventObjectValue(event, "metadata", item.key))
		if actual == "" {
			return fmt.Errorf("Stripe one-time checkout metadata %s is missing", item.key)
		}
		if item.foldCase {
			actual = strings.ToLower(actual)
		}
		if actual != item.expected {
			return fmt.Errorf("Stripe one-time checkout metadata %s mismatch", item.key)
		}
	}
	recallMetadata := []struct {
		key      string
		expected string
	}{
		{key: "recall_campaign_id", expected: strconv.FormatInt(order.RecallCampaignId, 10)},
		{key: "recall_recipient_id", expected: strconv.FormatInt(order.RecallRecipientId, 10)},
		{key: "recall_promotion_code_id", expected: strings.TrimSpace(order.RecallPromotionCodeId)},
		{key: "recall_discount_amount_minor", expected: strconv.FormatInt(order.RecallDiscountAmountMinor, 10)},
	}
	for _, item := range recallMetadata {
		actual := strings.TrimSpace(stripeEventObjectValue(event, "metadata", item.key))
		if order.RecallDiscountAmountMinor <= 0 {
			if actual != "" {
				return fmt.Errorf("Stripe one-time checkout metadata %s is unexpected", item.key)
			}
			continue
		}
		if actual == "" {
			return fmt.Errorf("Stripe one-time checkout metadata %s is missing", item.key)
		}
		if actual != item.expected {
			return fmt.Errorf("Stripe one-time checkout metadata %s mismatch", item.key)
		}
	}
	return nil
}

func validateOneTimePlanStripeSessionIdentity(event stripe.Event, order *model.SubscriptionOrder) error {
	if order == nil {
		return errors.New("subscription order is missing")
	}
	sessionID := strings.TrimSpace(event.GetObjectValue("id"))
	if sessionID == "" {
		return errors.New("Stripe one-time checkout session id is missing")
	}
	if expectedSessionID := strings.TrimSpace(order.ProviderSessionId); expectedSessionID != "" && sessionID != expectedSessionID {
		return fmt.Errorf("Stripe one-time checkout session mismatch: expected %s got %s", expectedSessionID, sessionID)
	}
	if strings.TrimSpace(event.GetObjectValue("client_reference_id")) != strings.TrimSpace(order.TradeNo) {
		return errors.New("Stripe one-time checkout client reference mismatch")
	}
	if strings.TrimSpace(stripeEventObjectValue(event, "metadata", "trade_no")) != "" &&
		strings.TrimSpace(stripeEventObjectValue(event, "metadata", "trade_no")) != strings.TrimSpace(order.TradeNo) {
		return errors.New("Stripe one-time checkout metadata trade_no mismatch")
	}
	if strings.TrimSpace(stripeEventObjectValue(event, "metadata", "user_id")) != "" &&
		strings.TrimSpace(stripeEventObjectValue(event, "metadata", "user_id")) != strconv.Itoa(order.UserId) {
		return errors.New("Stripe one-time checkout metadata user_id mismatch")
	}
	if strings.TrimSpace(stripeEventObjectValue(event, "metadata", "plan_id")) != "" &&
		strings.TrimSpace(stripeEventObjectValue(event, "metadata", "plan_id")) != strconv.Itoa(order.PlanId) {
		return errors.New("Stripe one-time checkout metadata plan_id mismatch")
	}
	if order.ChangeIntentId > 0 && strings.TrimSpace(stripeEventObjectValue(event, "metadata", "change_intent_id")) != "" &&
		strings.TrimSpace(stripeEventObjectValue(event, "metadata", "change_intent_id")) != strconv.FormatInt(order.ChangeIntentId, 10) {
		return errors.New("Stripe one-time checkout metadata change_intent_id mismatch")
	}
	if err := validateStripeCheckoutLivemodeForLocalKey(event.Livemode); err != nil {
		return err
	}
	return nil
}

func validateStripeCheckoutLivemodeForLocalKey(livemode bool) error {
	key := strings.TrimSpace(setting.StripeApiSecret)
	if strings.HasPrefix(key, "sk_live_") || strings.HasPrefix(key, "rk_live_") {
		if !livemode {
			return errors.New("Stripe checkout livemode mismatch")
		}
	}
	if strings.HasPrefix(key, "sk_test_") || strings.HasPrefix(key, "rk_test_") {
		if livemode {
			return errors.New("Stripe checkout livemode mismatch")
		}
	}
	return nil
}

func oneTimePlanStripeProviderPayload(event stripe.Event) string {
	payload := map[string]any{
		"checkout_session_id":  strings.TrimSpace(event.GetObjectValue("id")),
		"payment_intent":       strings.TrimSpace(event.GetObjectValue("payment_intent")),
		"amount_total":         event.GetObjectValue("amount_total"),
		"currency":             strings.ToUpper(strings.TrimSpace(event.GetObjectValue("currency"))),
		"payment_method_types": stripeEventObjectValue(event, "payment_method_types", "0"),
		"event_type":           string(event.Type),
	}
	return common.GetJsonString(payload)
}

func stripeCheckoutSessionInvoiceID(event stripe.Event) (string, error) {
	if invoiceID := strings.TrimSpace(stripeEventObjectValue(event, "invoice", "id")); invoiceID != "" {
		return invoiceID, nil
	}
	if invoiceID := strings.TrimSpace(event.GetObjectValue("invoice")); invoiceID != "" && !strings.HasPrefix(invoiceID, "map[") {
		return invoiceID, nil
	}
	sessionID := strings.TrimSpace(event.GetObjectValue("id"))
	if sessionID == "" {
		return "", permanentStripeWebhookProcessingError(errors.New("Stripe checkout session missing invoice id"))
	}
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return "", errors.New("invalid Stripe API key")
	}
	stripe.Key = setting.StripeApiSecret
	params := &stripe.CheckoutSessionParams{}
	params.AddExpand("invoice")
	checkoutSession, err := session.Get(sessionID, params)
	if err != nil {
		return "", err
	}
	if checkoutSession != nil && checkoutSession.Invoice != nil && strings.TrimSpace(checkoutSession.Invoice.ID) != "" {
		return strings.TrimSpace(checkoutSession.Invoice.ID), nil
	}
	return "", errors.New("Stripe checkout session invoice id is unavailable")
}

func handleStripeSubscriptionUpdated(ctx context.Context, event stripe.Event) (err error) {
	first, processingToken, err := recordStripeSubscriptionWebhookEvent(event)
	if err != nil || !first {
		return err
	}
	defer finishStripeSubscriptionWebhookEvent(event, processingToken, &err)
	snapshot, err := stripeSubscriptionSnapshotFromSubscriptionEvent(event)
	if err != nil {
		return err
	}
	binding, err := model.FindBindingByProviderSubscriptionID(model.PaymentProviderStripe, snapshot.ProviderSubscriptionId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := repairMissingStripeSubscriptionBindingFromEvent(event, snapshot); err != nil {
				return err
			}
			logger.LogInfo(ctx, fmt.Sprintf("Stripe subscription updated ignored for unbound subscription_id=%s", snapshot.ProviderSubscriptionId))
			return nil
		}
		return err
	}
	if snapshot.EndedAt > 0 || isTerminalRecurringProviderStatus(snapshot.ProviderStatus) {
		_, err = model.ApplyPassiveProviderSubscriptionTermination(binding.Id, snapshot)
		return err
	}
	if binding.EndedAt > 0 || isTerminalRecurringProviderStatus(binding.ProviderStatus) {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe subscription updated ignored for terminal binding_id=%d subscription_id=%s", binding.Id, binding.ProviderSubscriptionId))
		return nil
	}
	_, err = model.ApplyProviderSubscriptionSnapshot(binding.Id, snapshot)
	return err
}

func handleStripeSubscriptionDeleted(ctx context.Context, event stripe.Event) (err error) {
	first, processingToken, err := recordStripeSubscriptionWebhookEvent(event)
	if err != nil || !first {
		return err
	}
	defer finishStripeSubscriptionWebhookEvent(event, processingToken, &err)
	snapshot, err := stripeSubscriptionSnapshotFromSubscriptionEvent(event)
	if err != nil {
		return err
	}
	binding, err := model.FindBindingByProviderSubscriptionID(model.PaymentProviderStripe, snapshot.ProviderSubscriptionId)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if newAPIStripeSubscriptionTradeNo(event) != "" {
				return fmt.Errorf("Stripe subscription deleted missing local binding for NewAPI trade_no=%s", newAPIStripeSubscriptionTradeNo(event))
			}
			logger.LogInfo(ctx, fmt.Sprintf("Stripe subscription deleted ignored for unbound subscription_id=%s", snapshot.ProviderSubscriptionId))
			return nil
		}
		return err
	}
	if snapshot.EndedAt <= 0 && !isTerminalRecurringProviderStatus(snapshot.ProviderStatus) {
		if _, err = model.ApplyProviderSubscriptionSnapshot(binding.Id, snapshot); err != nil {
			if errors.Is(err, model.ErrSubscriptionProviderLifecycleConflict) {
				logger.LogInfo(ctx, fmt.Sprintf("Stripe subscription deleted treated as stale no-op for subscription_id=%s status=%s", snapshot.ProviderSubscriptionId, snapshot.ProviderStatus))
				return nil
			}
			return err
		}
		return nil
	}
	_, err = model.ApplyPassiveProviderSubscriptionTermination(binding.Id, snapshot)
	return err
}

func recordStripeSubscriptionWebhookEvent(event stripe.Event) (bool, string, error) {
	eventID := strings.TrimSpace(event.ID)
	if eventID == "" {
		return true, "", nil
	}
	processingToken := eventID + ":" + common.GetRandomString(12)
	claimed, err := model.ClaimPaymentWebhookEventLease(
		model.PaymentProviderStripe,
		eventID,
		string(event.Type),
		strings.TrimSpace(stripeEventObjectValue(event, "id")),
		event.Created,
		"",
		processingToken,
		common.GetTimestamp()+300,
	)
	if err != nil || claimed {
		return claimed, processingToken, err
	}
	state, err := model.GetPaymentWebhookEventClaimState(model.PaymentProviderStripe, eventID)
	if err != nil {
		return false, processingToken, err
	}
	if state.Exists && state.Status == model.PaymentWebhookEventStatusProcessed {
		return false, processingToken, nil
	}
	return false, processingToken, errors.New("Stripe webhook event is already processing")
}

func finishStripeSubscriptionWebhookEvent(event stripe.Event, processingToken string, processingErr *error) {
	eventID := strings.TrimSpace(event.ID)
	if eventID == "" || processingErr == nil {
		return
	}
	if *processingErr != nil {
		_ = model.MarkPaymentWebhookEventFailedByToken(model.PaymentProviderStripe, eventID, processingToken, *processingErr)
		return
	}
	if err := model.MarkPaymentWebhookEventProcessedByToken(model.PaymentProviderStripe, eventID, processingToken); err != nil {
		*processingErr = err
	}
}

func repairMissingStripeSubscriptionBindingFromEvent(event stripe.Event, snapshot model.ProviderSubscriptionSnapshot) error {
	tradeNo := newAPIStripeSubscriptionTradeNo(event)
	if tradeNo == "" {
		return nil
	}
	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil {
		return fmt.Errorf("Stripe subscription metadata references missing local order trade_no=%s", tradeNo)
	}
	if strings.TrimSpace(stripeEventObjectValue(event, "metadata", "newapi_user_id")) != strconv.Itoa(order.UserId) {
		return errors.New("Stripe subscription metadata user_id mismatch")
	}
	if strings.TrimSpace(stripeEventObjectValue(event, "metadata", "newapi_plan_id")) != strconv.Itoa(order.PlanId) {
		return errors.New("Stripe subscription metadata plan_id mismatch")
	}
	_, err := model.CompleteSubscriptionOrderWithProviderBinding(tradeNo, "", model.PaymentProviderStripe, model.PaymentMethodStripe, snapshot)
	return err
}

func newAPIStripeSubscriptionTradeNo(event stripe.Event) string {
	return strings.TrimSpace(stripeEventObjectValue(event, "metadata", "newapi_trade_no"))
}

func getStripeSubscriptionSnapshotFromCheckoutSession(event stripe.Event, order *model.SubscriptionOrder) (model.ProviderSubscriptionSnapshot, error) {
	if order == nil {
		return model.ProviderSubscriptionSnapshot{}, errors.New("subscription order is missing")
	}
	subscriptionID := strings.TrimSpace(stripeEventObjectValue(event, "subscription"))
	if subscriptionID == "" {
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe checkout session missing subscription id")
	}
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return model.ProviderSubscriptionSnapshot{}, fmt.Errorf("invalid Stripe API key")
	}
	stripe.Key = setting.StripeApiSecret
	params := &stripe.SubscriptionParams{}
	params.AddExpand("latest_invoice")
	params.AddExpand("items.data.price")
	sub, err := stripesubscription.Get(subscriptionID, params)
	if err != nil {
		return model.ProviderSubscriptionSnapshot{}, err
	}
	return stripeSubscriptionSnapshotFromSubscription(event, sub, order)
}

func stripeSubscriptionSnapshotFromSubscription(event stripe.Event, sub *stripe.Subscription, order *model.SubscriptionOrder) (model.ProviderSubscriptionSnapshot, error) {
	if sub == nil || strings.TrimSpace(sub.ID) == "" {
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe subscription is missing")
	}
	if order == nil {
		return model.ProviderSubscriptionSnapshot{}, errors.New("subscription order is missing")
	}
	if strings.TrimSpace(sub.Metadata["newapi_trade_no"]) != order.TradeNo {
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe subscription metadata trade_no mismatch")
	}
	if strings.TrimSpace(sub.Metadata["newapi_user_id"]) != strconv.Itoa(order.UserId) {
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe subscription metadata user_id mismatch")
	}
	if strings.TrimSpace(sub.Metadata["newapi_plan_id"]) != strconv.Itoa(order.PlanId) {
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe subscription metadata plan_id mismatch")
	}
	customerID := ""
	if sub.Customer != nil {
		customerID = strings.TrimSpace(sub.Customer.ID)
	}
	eventCustomerID := strings.TrimSpace(stripeEventObjectValue(event, "customer"))
	if eventCustomerID != "" && customerID != "" && eventCustomerID != customerID {
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe subscription customer mismatch")
	}
	priceID := stripeSubscriptionFirstPriceID(sub)
	plan, err := model.GetSubscriptionPlanById(order.PlanId)
	if err != nil {
		return model.ProviderSubscriptionSnapshot{}, err
	}
	if strings.TrimSpace(plan.StripePriceId) != "" && priceID != strings.TrimSpace(plan.StripePriceId) {
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe subscription price mismatch")
	}
	if event.Livemode != sub.Livemode {
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe subscription livemode mismatch")
	}
	latestInvoiceID := ""
	if sub.LatestInvoice != nil {
		latestInvoiceID = strings.TrimSpace(sub.LatestInvoice.ID)
	}
	periodStart, periodEnd := stripeSubscriptionCurrentPeriod(sub)
	return model.ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:     strings.TrimSpace(sub.ID),
		ProviderSubscriptionItemId: stripeSubscriptionFirstItemID(sub),
		ProviderScheduleId:         stripeSubscriptionScheduleID(sub),
		ProviderScheduleIdObserved: true,
		ProviderCustomerId:         customerID,
		ProviderPriceId:            priceID,
		ProviderLatestInvoiceId:    latestInvoiceID,
		ProviderStatus:             string(sub.Status),
		CancelAtPeriodEnd:          sub.CancelAtPeriodEnd,
		CurrentPeriodStart:         periodStart,
		CurrentPeriodEnd:           periodEnd,
		CanceledAt:                 sub.CanceledAt,
		EndedAt:                    sub.EndedAt,
		Livemode:                   sub.Livemode,
	}, nil
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

func stripeSubscriptionScheduleID(sub *stripe.Subscription) string {
	if sub == nil || sub.Schedule == nil {
		return ""
	}
	return strings.TrimSpace(sub.Schedule.ID)
}

func getStripeSubscriptionSnapshotFromSubscriptionEvent(event stripe.Event) (model.ProviderSubscriptionSnapshot, error) {
	subscriptionID := strings.TrimSpace(stripeEventObjectValue(event, "id"))
	if subscriptionID == "" {
		return model.ProviderSubscriptionSnapshot{}, errors.New("Stripe subscription event missing subscription id")
	}
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return model.ProviderSubscriptionSnapshot{}, fmt.Errorf("invalid Stripe API key")
	}
	stripe.Key = setting.StripeApiSecret
	params := &stripe.SubscriptionParams{}
	params.AddExpand("latest_invoice")
	params.AddExpand("items.data.price")
	sub, err := stripesubscription.Get(subscriptionID, params)
	if err != nil {
		return model.ProviderSubscriptionSnapshot{}, err
	}
	return stripeSubscriptionSnapshotFromStripeSubscription(sub), nil
}

func stripeSubscriptionSnapshotFromStripeSubscription(sub *stripe.Subscription) model.ProviderSubscriptionSnapshot {
	if sub == nil {
		return model.ProviderSubscriptionSnapshot{}
	}
	customerID := ""
	if sub.Customer != nil {
		customerID = strings.TrimSpace(sub.Customer.ID)
	}
	latestInvoiceID := ""
	if sub.LatestInvoice != nil {
		latestInvoiceID = strings.TrimSpace(sub.LatestInvoice.ID)
	}
	periodStart, periodEnd := stripeSubscriptionCurrentPeriod(sub)
	return model.ProviderSubscriptionSnapshot{
		ProviderSubscriptionId:     strings.TrimSpace(sub.ID),
		ProviderSubscriptionItemId: stripeSubscriptionFirstItemID(sub),
		ProviderScheduleId:         stripeSubscriptionScheduleID(sub),
		ProviderScheduleIdObserved: true,
		ProviderCustomerId:         customerID,
		ProviderPriceId:            stripeSubscriptionFirstPriceID(sub),
		ProviderLatestInvoiceId:    latestInvoiceID,
		ProviderStatus:             string(sub.Status),
		CancelAtPeriodEnd:          sub.CancelAtPeriodEnd,
		CurrentPeriodStart:         periodStart,
		CurrentPeriodEnd:           periodEnd,
		CanceledAt:                 sub.CanceledAt,
		EndedAt:                    sub.EndedAt,
		Livemode:                   sub.Livemode,
	}
}

func stripeEventUnix(event stripe.Event, keys ...string) int64 {
	raw := strings.TrimSpace(stripeEventObjectValue(event, keys...))
	if raw == "" {
		return 0
	}
	value, err := decimal.NewFromString(raw)
	if err != nil || value.IsNegative() {
		return 0
	}
	return value.IntPart()
}

func alertStripePaymentProcessingFailure(ctx context.Context, event stripe.Event, referenceId string, customerId string, processingErr error) {
	if processingErr == nil {
		return
	}
	alert := buildStripePaymentProcessingAlert(event, referenceId, customerId, processingErr)
	if err := notifyStripePaymentProcessingFailure(alert); err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe payment processing DingTalk alert failed trade_no=%s event_type=%s error=%q", alert.TradeNo, alert.EventType, err.Error()))
	}
}

func buildStripePaymentProcessingAlert(event stripe.Event, referenceId string, customerId string, processingErr error) service.DingTalkPaymentProcessingAlert {
	tradeNo := strings.TrimSpace(referenceId)
	if tradeNo == "" {
		tradeNo = strings.TrimSpace(stripeEventObjectValue(event, "client_reference_id"))
	}
	eventType := string(event.Type)
	customer := strings.TrimSpace(customerId)
	if customer == "" {
		customer = strings.TrimSpace(stripeEventObjectValue(event, "customer"))
	}

	actualCurrency := strings.ToUpper(strings.TrimSpace(stripeEventObjectValue(event, "currency")))
	actualAmountMinor := stripeEventAmountMinor(event, "amount_total")
	expectedCurrency := ""
	var expectedAmountMinor int64
	if tradeNo != "" {
		topUp := model.GetTopUpByTradeNo(tradeNo)
		if topUp != nil {
			expectedCurrency = strings.ToUpper(strings.TrimSpace(topUp.PaymentCurrency))
			expectedAmountMinor = topUp.PaymentAmountMinor
		}
	}

	return service.DingTalkPaymentProcessingAlert{
		Provider:            model.PaymentProviderStripe,
		TradeNo:             tradeNo,
		EventType:           eventType,
		CustomerID:          customer,
		CustomerEmail:       strings.TrimSpace(stripeEventObjectValue(event, "customer_details", "email")),
		ExpectedCurrency:    expectedCurrency,
		ExpectedAmountMinor: expectedAmountMinor,
		ActualCurrency:      actualCurrency,
		ActualAmountMinor:   actualAmountMinor,
		ErrorClass:          stripePaymentProcessingErrorClass(processingErr),
		Error:               processingErr.Error(),
		Now:                 time.Now(),
	}
}

func stripePaymentProcessingErrorClass(err error) string {
	if err == nil {
		return ""
	}
	if errors.Is(err, model.ErrTopUpNotFound) {
		return "topup_not_found"
	}
	if errors.Is(err, model.ErrPaymentMethodMismatch) {
		return "payment_method_mismatch"
	}
	if errors.Is(err, model.ErrTopUpStatusInvalid) {
		return "topup_status_invalid"
	}
	if errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		return "subscription_order_not_found"
	}

	message := strings.ToLower(err.Error())
	switch {
	case strings.Contains(message, "without local order reference"):
		return "missing_order_reference"
	case strings.Contains(message, "expected payment contract is missing"),
		strings.Contains(message, "checkout session mismatch"),
		strings.Contains(message, "checkout price mismatch"),
		strings.Contains(message, "checkout quantity mismatch"),
		strings.Contains(message, "checkout currency is missing"),
		strings.Contains(message, "checkout session id is missing"),
		strings.Contains(message, "checkout contains multiple line items"),
		strings.Contains(message, "checkout line item price is missing"),
		strings.Contains(message, "checkout line item is missing"):
		return "contract_mismatch"
	case isRetryableStripeWebhookProcessingError(err):
		return "dependency_error"
	default:
		return "payment_processing_error"
	}
}

func stripeEventAmountMinor(event stripe.Event, key string) int64 {
	rawAmount := strings.TrimSpace(stripeEventObjectValue(event, key))
	if rawAmount == "" {
		return 0
	}
	amount, err := decimal.NewFromString(rawAmount)
	if err != nil || amount.IsNegative() {
		return 0
	}
	return amount.IntPart()
}

func stripeEventObjectValue(event stripe.Event, keys ...string) string {
	if event.Data == nil || len(keys) == 0 {
		return ""
	}
	var node any = event.Data.Object
	for _, key := range keys {
		switch typed := node.(type) {
		case map[string]interface{}:
			node = typed[key]
		case []interface{}:
			index, err := strconv.Atoi(key)
			if err != nil || index < 0 || index >= len(typed) {
				return ""
			}
			node = typed[index]
		default:
			return ""
		}
	}
	if node == nil {
		return ""
	}
	return fmt.Sprintf("%v", node)
}

func validateStripeTopUpPaymentContract(event stripe.Event, referenceId string) error {
	topUp, err := model.GetTopUpByTradeNoWithError(referenceId)
	if err != nil {
		if errors.Is(err, model.ErrTopUpNotFound) {
			return permanentStripeWebhookProcessingError(model.ErrTopUpNotFound)
		}
		return err
	}
	if topUp.PaymentProvider != model.PaymentProviderStripe {
		return permanentStripeWebhookProcessingError(model.ErrPaymentMethodMismatch)
	}
	if topUp.Status == common.TopUpStatusSuccess {
		return nil
	}
	if !modelPurchaseCanBeCorrectedToStripeSuccess(topUp.Status) {
		return permanentStripeWebhookProcessingError(model.ErrTopUpStatusInvalid)
	}

	expectedPriceId := strings.TrimSpace(topUp.PaymentPriceId)
	if expectedPriceId == "" {
		return permanentStripeWebhookProcessingError(errors.New("Stripe top-up expected payment contract is missing"))
	}

	actual, err := stripeCheckoutPaymentContractFromEvent(event)
	if err != nil {
		return err
	}

	expectedSessionId := strings.TrimSpace(topUp.GatewayTradeNo)
	if actual.SessionId != "" && expectedSessionId != "" && actual.SessionId != expectedSessionId {
		return permanentStripeWebhookProcessingError(fmt.Errorf("Stripe checkout session mismatch: expected %s got %s", expectedSessionId, actual.SessionId))
	}
	if actual.PriceId != expectedPriceId {
		return permanentStripeWebhookProcessingError(fmt.Errorf("Stripe checkout price mismatch: expected %s got %s", expectedPriceId, actual.PriceId))
	}
	if actual.Quantity != stripeTopUpLineQuantity {
		return permanentStripeWebhookProcessingError(fmt.Errorf("Stripe checkout quantity mismatch: expected %d got %d", stripeTopUpLineQuantity, actual.Quantity))
	}
	actualCurrency := strings.ToUpper(strings.TrimSpace(actual.Currency))
	if actualCurrency == "" {
		return permanentStripeWebhookProcessingError(errors.New("Stripe checkout currency is missing"))
	}
	// Do not compare Stripe line-item amounts with locally stored package amounts.
	// Coupons, Adaptive Pricing, taxes, and display-price configuration can change
	// Stripe amounts independently from our local top-up package value. The trusted
	// contract is the Checkout session's price id and quantity.
	return nil
}

func modelPurchaseCanBeCorrectedToStripeSuccess(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case common.TopUpStatusPending, common.TopUpStatusFailed, common.TopUpStatusExpired, "cancelled", "canceled":
		return true
	default:
		return false
	}
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

// backfillCardFingerprintFromTopUp binds the card after a save-card top-up. Save-card
// Checkouts keep local payment methods available (setup_future_usage is card-scoped), so a
// completed top-up does not by itself prove a card was saved; this queries the Stripe API for
// a card actually attached to the customer and only then sets card_bound plus the fingerprint
// (anti-abuse dedup). No-op for ordinary wallet top-ups and when no card was saved. Failures
// are logged, not fatal. Call only on first fulfillment.
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
		// No customer to query means no off-session charge is possible anyway; leave unbound.
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 充值绑卡：缺少 customer，跳过绑卡 user_id=%d trade_no=%s", topUp.UserId, topUp.TradeNo))
		return
	}
	// "No saved card" (skip is correct: local-method payment saved nothing) must not be
	// conflated with "lookup failed": a swallowed transient failure would leave a genuinely
	// saved card permanently unbound. Bounded retry rides out blips; if all attempts fail,
	// log at error level — replaying the webhook event re-runs the bind (see fulfillOrder).
	var fingerprint string
	var lookupErr error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 2 * time.Second)
		}
		fingerprint, lookupErr = fetchCardFingerprint(customerId)
		if lookupErr == nil {
			break
		}
	}
	if lookupErr != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 充值绑卡：查询已存卡失败，本次放弃绑卡（可从 Stripe 后台重放该 webhook 事件补绑）user_id=%d trade_no=%s customer=%s error=%q", topUp.UserId, topUp.TradeNo, customerId, lookupErr.Error()))
		return
	}
	if strings.TrimSpace(fingerprint) == "" {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值绑卡：customer 无已存卡，跳过绑卡 user_id=%d trade_no=%s customer=%s", topUp.UserId, topUp.TradeNo, customerId))
		return
	}
	// Idempotently persist customer + fingerprint (and set card_bound) — safe to repeat.
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

// chargeReversed handles charge.refunded / charge.dispute.created. It maps the
// reversed charge back to the checkout session's client_reference_id (our
// trade_no) and queues attributed top-up refunds as Google Ads conversion
// adjustments. Product balance bookkeeping remains a separate ops concern.
//
// Lookup covers both checkout modes:
//   - mode=payment: the session carries the charge's payment_intent directly.
//   - mode=subscription: the session has no payment_intent (the charge belongs
//     to the subscription invoice), so walk charge → invoice → subscription and
//     list sessions by subscription id.
func chargeReversed(ctx context.Context, event stripe.Event) error {
	referenceId := strings.TrimSpace(stripeEventObjectValue(event, "metadata", "trade_no"))
	if referenceId == "" &&
		!strings.HasPrefix(setting.StripeApiSecret, "sk_") &&
		!strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		logger.LogWarn(ctx, "Stripe API 密钥未配置，无法回查 checkout session，跳过邀请奖励回收")
		return nil
	}
	if referenceId == "" {
		stripe.Key = setting.StripeApiSecret
	}

	paymentIntentId := event.GetObjectValue("payment_intent")
	// charge.refunded delivers a charge object (its id IS the charge id);
	// charge.dispute.created delivers a dispute pointing at its charge.
	chargeId := event.GetObjectValue("id")
	if event.Type == stripe.EventTypeChargeDisputeCreated {
		chargeId = event.GetObjectValue("charge")
	}

	if referenceId == "" && paymentIntentId != "" {
		listParams := &stripe.CheckoutSessionListParams{
			PaymentIntent: stripe.String(paymentIntentId),
		}
		listParams.Limit = stripe.Int64(1)
		iter := session.List(listParams)
		for iter.Next() {
			if s := iter.CheckoutSession(); s != nil {
				referenceId = s.ClientReferenceID
			}
			break
		}
		if err := iter.Err(); err != nil {
			logger.LogError(ctx, fmt.Sprintf("Stripe 回查 checkout session 失败 payment_intent=%s error=%q", paymentIntentId, err.Error()))
			// 4xx（权限/对象不存在/参数）重投也不会好，标记永久防止 Stripe 长期重投；
			// 网络/5xx/限流保持可重试，回收不丢。
			return classifyStripeLookupError(err)
		}
	}

	if referenceId == "" && chargeId != "" {
		subscriptionId, err := stripeSubscriptionIdForCharge(chargeId)
		if err != nil {
			logger.LogError(ctx, fmt.Sprintf("Stripe 回查 charge→invoice_payment→subscription 失败 charge=%s error=%q", chargeId, err.Error()))
			return classifyStripeLookupError(err)
		}
		if subscriptionId != "" {
			listParams := &stripe.CheckoutSessionListParams{
				Subscription: stripe.String(subscriptionId),
			}
			listParams.Limit = stripe.Int64(1)
			iter := session.List(listParams)
			for iter.Next() {
				if s := iter.CheckoutSession(); s != nil {
					referenceId = s.ClientReferenceID
				}
				break
			}
			if err := iter.Err(); err != nil {
				logger.LogError(ctx, fmt.Sprintf("Stripe 按 subscription 回查 checkout session 失败 subscription=%s error=%q", subscriptionId, err.Error()))
				return classifyStripeLookupError(err)
			}
		}
	}

	if referenceId == "" {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe %s 未关联 checkout session，跳过邀请奖励回收 payment_intent=%s charge=%s", string(event.Type), paymentIntentId, chargeId))
		return nil
	}
	if event.Type == stripe.EventTypeChargeRefunded {
		topUp := model.GetTopUpByTradeNo(referenceId)
		if topUp != nil && topUp.PaymentProvider == model.PaymentProviderStripe {
			currency := strings.ToUpper(strings.TrimSpace(stripeEventObjectValue(event, "currency")))
			if currency == "" || !strings.EqualFold(currency, topUp.PaymentCurrency) {
				return permanentStripeWebhookProcessingError(
					fmt.Errorf("Stripe refund currency mismatch trade_no=%s", referenceId),
				)
			}
			refundedMinor := stripeEventAmountMinor(event, "amount_refunded")
			if refundedMinor <= 0 {
				return permanentStripeWebhookProcessingError(
					fmt.Errorf("Stripe refund amount invalid trade_no=%s", referenceId),
				)
			}
			refunded := stripeMajorAmount(refundedMinor, currency)
			adjustedValue := topUp.Money - refunded
			if adjustedValue < -0.005 {
				return permanentStripeWebhookProcessingError(
					fmt.Errorf("Stripe refund exceeds original payment trade_no=%s", referenceId),
				)
			}
			if adjustedValue < 0 {
				adjustedValue = 0
			}
			occurredAt := time.Unix(event.Created, 0)
			if event.Created <= 0 {
				occurredAt = time.Now()
			}
			if err := model.EnqueueAdsRefund(event.ID, topUp, refunded, adjustedValue, occurredAt); err != nil {
				return err
			}
			logger.LogInfo(ctx, fmt.Sprintf(
				"Stripe refund queued for Ads attribution trade_no=%s event_id=%s amount=%.2f currency=%s",
				referenceId, event.ID, refunded, currency,
			))
		}
	}
	return nil
}

// classifyStripeLookupError marks non-recoverable Stripe API failures (4xx
// other than 429: bad key permissions, missing/cross-account objects, bad
// params) as permanent so the webhook is acknowledged instead of redelivered
// forever; everything else (network, 5xx, 429) stays retryable.
func classifyStripeLookupError(err error) error {
	var sErr *stripe.Error
	if errors.As(err, &sErr) {
		code := sErr.HTTPStatusCode
		if code >= 400 && code < 500 && code != http.StatusTooManyRequests {
			return stripeWebhookPermanentError{err: err}
		}
	}
	return err
}

// stripeSubscriptionIdForCharge resolves charge → payment_intent → invoice_payment → subscription.
// Returns "" (no error) when the charge is not tied to a subscription invoice.
func stripeSubscriptionIdForCharge(chargeId string) (string, error) {
	ch, err := stripecharge.Get(chargeId, nil)
	if err != nil {
		return "", err
	}
	if ch == nil || ch.PaymentIntent == nil || strings.TrimSpace(ch.PaymentIntent.ID) == "" {
		return "", nil
	}
	params := &stripe.InvoicePaymentListParams{
		Payment: &stripe.InvoicePaymentListPaymentParams{
			PaymentIntent: stripe.String(strings.TrimSpace(ch.PaymentIntent.ID)),
			Type:          stripe.String(string(stripe.InvoicePaymentPaymentTypePaymentIntent)),
		},
	}
	params.Limit = stripe.Int64(2)
	params.AddExpand("data.invoice.parent.subscription_details.subscription")
	iter := stripeinvoicepayment.List(params)
	subscriptionID := ""
	for iter.Next() {
		invoicePayment := iter.InvoicePayment()
		if invoicePayment == nil {
			continue
		}
		currentID, err := stripeSubscriptionIdFromInvoice(invoicePayment.Invoice)
		if err != nil {
			return "", err
		}
		if currentID == "" {
			continue
		}
		if subscriptionID != "" && subscriptionID != currentID {
			return "", fmt.Errorf("Stripe charge maps to multiple subscription invoices")
		}
		subscriptionID = currentID
	}
	if err := iter.Err(); err != nil {
		return "", err
	}
	return subscriptionID, nil
}

func stripeSubscriptionIdFromInvoice(inv *stripe.Invoice) (string, error) {
	if inv == nil || inv.Parent == nil || inv.Parent.SubscriptionDetails == nil || inv.Parent.SubscriptionDetails.Subscription == nil {
		if inv == nil || strings.TrimSpace(inv.ID) == "" {
			return "", nil
		}
		fetched, err := stripeinvoice.Get(strings.TrimSpace(inv.ID), nil)
		if err != nil {
			return "", err
		}
		inv = fetched
	}
	if inv == nil || inv.Parent == nil || inv.Parent.SubscriptionDetails == nil || inv.Parent.SubscriptionDetails.Subscription == nil {
		return "", nil
	}
	return strings.TrimSpace(inv.Parent.SubscriptionDetails.Subscription.ID), nil
}
func sessionExpired(ctx context.Context, event stripe.Event) error {
	referenceId := event.GetObjectValue("client_reference_id")
	status := event.GetObjectValue("status")
	if "expired" != status {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe checkout.expired 状态异常，忽略处理 trade_no=%s status=%s", referenceId, status))
		return nil
	}

	if len(referenceId) == 0 {
		logger.LogWarn(ctx, "Stripe checkout.expired 缺少订单号")
		return nil
	}

	if event.GetObjectValue("mode") == string(stripe.CheckoutSessionModeSubscription) {
		if err := terminatePendingStripePurchase(ctx, referenceId, model.SubscriptionChangeIntentStatusExpired); err != nil {
			logger.LogError(ctx, fmt.Sprintf("Stripe recurring checkout expiration handling failed trade_no=%s error=%q", referenceId, err.Error()))
			return err
		}
		return nil
	}
	if order := model.GetSubscriptionOrderByTradeNo(referenceId); isOneTimePlanStripeOrder(order) {
		return handleStripeOneTimePlanTerminal(ctx, event, referenceId, model.SubscriptionChangeIntentStatusExpired)
	}

	// Subscription order expiration
	LockOrder(referenceId)
	defer UnlockOrder(referenceId)
	if err := model.ExpireSubscriptionOrder(referenceId, model.PaymentProviderStripe); err == nil {
		logger.LogInfo(ctx, fmt.Sprintf("Stripe 订阅订单已过期 trade_no=%s", referenceId))
		return nil
	} else if err != nil && !errors.Is(err, model.ErrSubscriptionOrderNotFound) {
		logger.LogError(ctx, fmt.Sprintf("Stripe 订阅订单过期处理失败 trade_no=%s error=%q", referenceId, err.Error()))
		return nil
	}

	err := model.UpdatePendingTopUpStatus(referenceId, model.PaymentProviderStripe, common.TopUpStatusExpired)
	if errors.Is(err, model.ErrTopUpNotFound) {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 充值订单不存在，无法标记过期 trade_no=%s", referenceId))
		return nil
	}
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("Stripe 充值订单过期处理失败 trade_no=%s error=%q", referenceId, err.Error()))
		return nil
	}
	if err := model.UpdatePaymentInvoiceStatus(referenceId, model.PaymentInvoiceStatusExpired); err != nil && !errors.Is(err, model.ErrPaymentInvoiceNotFound) {
		logger.LogWarn(ctx, fmt.Sprintf("Stripe 标记开票过期状态失败 trade_no=%s error=%q", referenceId, err.Error()))
	}

	logger.LogInfo(ctx, fmt.Sprintf("Stripe 充值订单已过期 trade_no=%s", referenceId))
	return nil
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
func genStripeLink(referenceId string, customerId string, email string, checkout *stripeTopUpCheckout, successURL string, cancelURL string, invoiceRequested bool, saveCard bool, embedded bool, submitMessage string, recall *service.RecallCheckoutDiscount) (*stripe.CheckoutSession, error) {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return nil, fmt.Errorf("无效的Stripe API密钥")
	}

	stripe.Key = setting.StripeApiSecret
	if checkout == nil || strings.TrimSpace(checkout.PriceId) == "" {
		return nil, fmt.Errorf("Stripe Price ID 未配置")
	}

	// Use custom URLs if provided, otherwise use defaults
	if successURL == "" {
		successURL = consolePaymentReturnPath("/console/log")
	}
	if cancelURL == "" {
		cancelURL = consolePaymentReturnPath("/console/topup")
	}

	params := buildStripeCheckoutSessionParams(referenceId, customerId, strings.TrimSpace(email), checkout.PriceId, checkout.Quantity, checkout.PaymentCurrency, successURL, cancelURL, invoiceRequested, saveCard, embedded, submitMessage, recall)
	params.SetIdempotencyKey("topup-stripe:" + strings.TrimSpace(referenceId))

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

// stripeCheckoutSubmitMessage renders the reassurance line Checkout shows above the Pay
// button: what will be credited, that the bonus is included, and that it lands instantly.
// This is the only place the advertised top-up bonus is visible on the Stripe-hosted page,
// since the bonus is granted server-side after payment rather than as a Stripe discount.
// Amounts are spelled out only in USD display mode; token display amounts are too large
// to read naturally in Checkout's plain-text field, so those get a number-free line.
func stripeCheckoutSubmitMessage(amount int64, bonusAmount int64) string {
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		if bonusAmount > 0 {
			return "Your top-up bonus is included and will be credited to your account together with this payment."
		}
		return "Credits are added to your account immediately after payment."
	}
	if bonusAmount > 0 {
		return fmt.Sprintf("$%d in credits ($%d + $%d bonus) will be added to your account immediately after payment.", amount+bonusAmount, amount, bonusAmount)
	}
	return fmt.Sprintf("$%d in credits will be added to your account immediately after payment.", amount)
}

func buildStripeCheckoutSessionParams(referenceId string, customerId string, email string, priceId string, quantity int64, currency string, successURL string, cancelURL string, invoiceRequested bool, saveCard bool, embedded bool, submitMessage string, recall *service.RecallCheckoutDiscount) *stripe.CheckoutSessionParams {
	params := &stripe.CheckoutSessionParams{
		ClientReferenceID: stripe.String(referenceId),
		LineItems: []*stripe.CheckoutSessionLineItemParams{
			buildStripeTopUpLineItem(priceId, quantity),
		},
		Mode: stripe.String(string(stripe.CheckoutSessionModePayment)),
	}
	if recall != nil {
		params.Discounts = []*stripe.CheckoutSessionDiscountParams{{
			PromotionCode: stripe.String(recall.PromotionCodeID),
		}}
		params.Metadata = map[string]string{
			"recall_campaign_id":  strconv.FormatInt(recall.CampaignID, 10),
			"recall_recipient_id": strconv.FormatInt(recall.RecipientID, 10),
		}
	}

	if embedded {
		// Embedded sessions reject success_url/cancel_url. return_url is still required
		// because redirect-based payment methods (Alipay, WeChat Pay, Pix...) leave the
		// page and need somewhere to land; the success URL is the natural target.
		params.UIMode = stripe.String(string(stripe.CheckoutSessionUIModeEmbeddedPage))
		// Carry the Stripe session id and our trade_no back so the frontend can
		// locate this Checkout Session / order and recover status when a
		// redirect-based method returns to the page. {CHECKOUT_SESSION_ID} is
		// substituted by Stripe.
		returnURL := successURL
		separator := "?"
		if strings.Contains(returnURL, "?") {
			separator = "&"
		}
		returnURL = returnURL + separator + "session_id={CHECKOUT_SESSION_ID}&trade_no=" + url.QueryEscape(referenceId)
		params.ReturnURL = stripe.String(returnURL)
	} else {
		params.SuccessURL = stripe.String(successURL)
		params.CancelURL = stripe.String(cancelURL)
	}

	// The Stripe account's statement descriptor is the company name, which buyers of this
	// product don't recognize. The suffix makes card statements read "<company>* FLATKEY"
	// so the charge is attributable to the product they bought.
	params.PaymentIntentData = &stripe.CheckoutSessionPaymentIntentDataParams{
		StatementDescriptorSuffix: stripe.String("FLATKEY"),
		Metadata: map[string]string{
			"trade_no": referenceId,
			"source":   "new-api",
		},
	}

	// Ask issuers to run 3D Secure whenever the card is enrolled ("any"): card-testing
	// bots holding stolen numbers can't pass the cardholder challenge, and liability for
	// fraudulent-use disputes shifts to the issuer. Enrolled cards mostly clear through a
	// frictionless flow, so legitimate friction stays minimal.
	cardOptions := &stripe.CheckoutSessionPaymentMethodOptionsCardParams{
		RequestThreeDSecure: stripe.String(string(stripe.CheckoutSessionPaymentMethodOptionsCardRequestThreeDSecureAny)),
	}
	// For onboarding promo top-ups, save the card while paying so it can be charged
	// off-session later (postpaid auto-charge). Plain wallet top-ups don't save the card.
	// Scoped to payment_method_options.card (not payment_intent_data.setup_future_usage):
	// a top-level setup_future_usage makes Stripe hide every payment method that can't be
	// saved for off-session reuse (Alipay/Pix/UPI/WeChat...), leaving card-only checkouts.
	// Card payments still bind the card; local-method payments simply skip binding
	// (backfillCardFingerprintFromTopUp tolerates the missing card).
	if saveCard {
		cardOptions.SetupFutureUsage = stripe.String("off_session")
	}
	params.PaymentMethodOptions = &stripe.CheckoutSessionPaymentMethodOptionsParams{
		Card: cardOptions,
	}

	if submitMessage != "" {
		params.CustomText = &stripe.CheckoutSessionCustomTextParams{
			Submit: &stripe.CheckoutSessionCustomTextSubmitParams{
				Message: stripe.String(submitMessage),
			},
		}
	}

	// An explicit non-USD pick must reach Stripe, or Checkout renders the Price's default
	// (USD) and the UI promise, the local order record, and the actual charge diverge.
	// USD stays unset on purpose: it is the Price default anyway, and leaving it out keeps
	// Stripe adaptive pricing available for users who explicitly choose USD.
	currency = strings.ToUpper(strings.TrimSpace(currency))
	if currency != "" && currency != "USD" {
		params.Currency = stripe.String(strings.ToLower(currency))
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
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		amount = amount / common.QuotaPerUnit
	}
	// Using float64 for monetary calculations is acceptable here due to the small amounts involved.
	payMoney := amount * setting.StripeUnitPrice
	return payMoney
}

func getStripeMinTopup() int64 {
	minTopup := setting.StripeMinTopUp
	if operation_setting.GetQuotaDisplayType() == operation_setting.QuotaDisplayTypeTokens {
		minTopup = minTopup * int(common.QuotaPerUnit)
	}
	return int64(minTopup)
}
