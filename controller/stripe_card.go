package controller

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"

	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v81"
	stripecustomer "github.com/stripe/stripe-go/v81/customer"
	stripepaymentintent "github.com/stripe/stripe-go/v81/paymentintent"
	stripepaymentmethod "github.com/stripe/stripe-go/v81/paymentmethod"
	stripeprice "github.com/stripe/stripe-go/v81/price"
)

// stripeCardBindReferencePrefix tags the client_reference_id so the webhook can
// distinguish a card-binding setup session from a regular top-up payment.
const stripeCardBindReferencePrefix = "cardbind_"

func ensureStripeKey() error {
	if !strings.HasPrefix(setting.StripeApiSecret, "sk_") && !strings.HasPrefix(setting.StripeApiSecret, "rk_") {
		return fmt.Errorf("无效的Stripe API密钥")
	}
	stripe.Key = setting.StripeApiSecret
	return nil
}

// resolveStripeCurrency returns the lowercase ISO currency to charge in, taken from the
// configured template price; falls back to "usd" when the price is unavailable.
func resolveStripeCurrency() string {
	priceId := strings.TrimSpace(setting.StripePriceId)
	if priceId == "" {
		logger.LogWarn(nil, "Stripe 货币解析：未配置 StripePriceId，回退到 usd（请确认计费货币是否正确）")
		return "usd"
	}
	tp, err := stripeprice.Get(priceId, nil)
	if err != nil || tp == nil || tp.Currency == "" {
		errMsg := ""
		if err != nil {
			errMsg = err.Error()
		}
		logger.LogError(nil, fmt.Sprintf("Stripe 货币解析：读取 Price 失败，回退到 usd（可能 live/test Price 配错）price_id=%s error=%q", priceId, errMsg))
		return "usd"
	}
	return strings.ToLower(string(tp.Currency))
}

// ensureStripeCustomerForUser returns the user's Stripe customer id, creating one if needed
// and persisting it back to the user row.
func ensureStripeCustomerForUser(user *model.User) (string, error) {
	customerId := strings.TrimSpace(user.StripeCustomer)
	if customerId != "" {
		return customerId, nil
	}

	params := &stripe.CustomerParams{}
	if strings.TrimSpace(user.Email) != "" {
		params.Email = stripe.String(strings.TrimSpace(user.Email))
	}
	if strings.TrimSpace(user.Username) != "" {
		params.Name = stripe.String(strings.TrimSpace(user.Username))
	}
	customer, err := stripecustomer.New(params)
	if err != nil {
		return "", err
	}
	if customer == nil || strings.TrimSpace(customer.ID) == "" {
		return "", errors.New("Stripe customer is unavailable")
	}
	customerId = strings.TrimSpace(customer.ID)

	if err := model.DB.Model(&model.User{}).Where("id = ?", user.Id).Update("stripe_customer", customerId).Error; err != nil {
		logger.LogWarn(nil, fmt.Sprintf("Stripe 绑卡：保存 customer 失败 user_id=%d customer=%s error=%q", user.Id, customerId, err.Error()))
	}
	user.StripeCustomer = customerId
	return customerId, nil
}

// StripeCardStatus is the card-binding status returned to the frontend.
type StripeCardStatus struct {
	CardBound  bool   `json:"card_bound"`
	BonusGiven bool   `json:"bonus_given"`
	Brand      string `json:"brand,omitempty"`
	Last4      string `json:"last4,omitempty"`
}

// GetStripeCardStatus returns whether the current user has a bound card, plus brand/last4
// pulled from Stripe when available.
func GetStripeCardStatus(c *gin.Context) {
	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		common.ApiErrorMsg(c, "用户不存在")
		return
	}

	status := StripeCardStatus{
		CardBound:  user.StripeCardBound,
		BonusGiven: user.NewUserBonusGiven,
	}

	// Best-effort enrichment: fetch default payment method brand/last4.
	if user.StripeCardBound && strings.TrimSpace(user.StripeCustomer) != "" {
		if err := ensureStripeKey(); err == nil {
			if brand, last4 := fetchDefaultCard(strings.TrimSpace(user.StripeCustomer)); brand != "" {
				status.Brand = brand
				status.Last4 = last4
			}
		}
	}

	common.ApiSuccess(c, status)
}

// fetchDefaultCard returns the brand and last4 of the customer's first card payment method.
// Errors are swallowed (best-effort display only).
func fetchDefaultCard(customerId string) (brand string, last4 string) {
	listParams := &stripe.PaymentMethodListParams{
		Customer: stripe.String(customerId),
		Type:     stripe.String(string(stripe.PaymentMethodTypeCard)),
	}
	listParams.Limit = stripe.Int64(1)
	iter := stripepaymentmethod.List(listParams)
	for iter.Next() {
		pm := iter.PaymentMethod()
		if pm != nil && pm.Card != nil {
			return string(pm.Card.Brand), pm.Card.Last4
		}
	}
	return "", ""
}

// fetchCardFingerprint returns the Stripe fingerprint of the customer's first card, or ""
// with a nil error when the customer genuinely has no saved card. A non-nil error means the
// lookup itself failed (key/network/API) and says nothing about whether a card exists —
// callers deciding card_bound must not treat the two the same. The fingerprint is stable for
// the same physical card across customers/accounts, so it is used for anti-abuse dedup.
func fetchCardFingerprint(customerId string) (string, error) {
	if customerId == "" {
		return "", nil
	}
	if err := ensureStripeKey(); err != nil {
		return "", err
	}
	listParams := &stripe.PaymentMethodListParams{
		Customer: stripe.String(customerId),
		Type:     stripe.String(string(stripe.PaymentMethodTypeCard)),
	}
	listParams.Limit = stripe.Int64(1)
	iter := stripepaymentmethod.List(listParams)
	for iter.Next() {
		pm := iter.PaymentMethod()
		if pm != nil && pm.Card != nil {
			return strings.TrimSpace(pm.Card.Fingerprint), nil
		}
	}
	if err := iter.Err(); err != nil {
		return "", err
	}
	return "", nil
}

// RemoveStripeCard detaches the user's saved card(s) and clears the bound flag.
func RemoveStripeCard(c *gin.Context) {
	id := c.GetInt("id")
	user, err := model.GetUserById(id, false)
	if err != nil || user == nil {
		common.ApiErrorMsg(c, "用户不存在")
		return
	}
	if !user.StripeCardBound || strings.TrimSpace(user.StripeCustomer) == "" {
		if err := model.SetStripeCardUnbound(id); err != nil {
			common.ApiErrorMsg(c, "解绑失败")
			return
		}
		common.ApiSuccess(c, gin.H{"card_bound": false})
		return
	}

	if err := ensureStripeKey(); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	customerId := strings.TrimSpace(user.StripeCustomer)
	listParams := &stripe.PaymentMethodListParams{
		Customer: stripe.String(customerId),
		Type:     stripe.String(string(stripe.PaymentMethodTypeCard)),
	}
	iter := stripepaymentmethod.List(listParams)
	for iter.Next() {
		pm := iter.PaymentMethod()
		if pm == nil {
			continue
		}
		if _, derr := stripepaymentmethod.Detach(pm.ID, nil); derr != nil {
			logger.LogWarn(c.Request.Context(), fmt.Sprintf("Stripe 解绑：detach 失败 user_id=%d pm=%s error=%q", id, pm.ID, derr.Error()))
		}
	}

	if err := model.SetStripeCardUnbound(id); err != nil {
		common.ApiErrorMsg(c, "解绑失败")
		return
	}
	logger.LogInfo(c.Request.Context(), fmt.Sprintf("Stripe 解绑成功 user_id=%d", id))
	common.ApiSuccess(c, gin.H{"card_bound": false})
}

// --- Automatic off-session charging ---

// autoChargeInFlight prevents concurrent auto-charges for the same user (e.g. a burst of
// requests all crossing the threshold at once).
var autoChargeInFlight sync.Map

// autoChargeCooldownSeconds is the minimum gap between two automatic charges for one user,
// guarding against repeated charges before the credited quota propagates.
const autoChargeCooldownSeconds int64 = 120

// autoChargeLastAt tracks the last auto-charge time per user (unix seconds).
var autoChargeLastAt sync.Map

func init() {
	// Register the controller-side implementation with the service hook.
	service.TriggerStripeAutoCharge = performStripeAutoCharge
}

// performStripeAutoCharge charges the user's bound card off-session for the configured amount
// and credits the resulting quota. It is invoked asynchronously from the relay hot path, so it
// must never panic the caller; all failures are logged and left for the next trigger.
func performStripeAutoCharge(userId int) {
	if userId <= 0 || !setting.StripeAutoChargeEnabled {
		return
	}

	// In-flight dedup: only one charge per user at a time.
	if _, loaded := autoChargeInFlight.LoadOrStore(userId, true); loaded {
		return
	}
	defer autoChargeInFlight.Delete(userId)

	// Cooldown: skip if we charged very recently.
	now := time.Now().Unix()
	if last, ok := autoChargeLastAt.Load(userId); ok {
		if lastAt, ok2 := last.(int64); ok2 && now-lastAt < autoChargeCooldownSeconds {
			return
		}
	}

	// Persistent cooldown (cross-instance / restart-safe): the in-memory guard above
	// is lost on restart and not shared between replicas, so also check the DB for a
	// recent auto-charge before billing the card again.
	if recent, err := model.HasRecentStripeAutoCharge(userId, autoChargeCooldownSeconds); err != nil {
		logger.LogWarn(nil, fmt.Sprintf("Stripe 自动扣费：查询近期扣费记录失败，跳过本次以防重复扣款 user_id=%d error=%q", userId, err.Error()))
		return
	} else if recent {
		return
	}

	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil {
		return
	}
	if !user.StripeCardBound || strings.TrimSpace(user.StripeCustomer) == "" {
		return
	}

	// Re-check balance against the threshold with fresh data to avoid racing a manual top-up.
	freshQuota, err := model.GetUserQuota(userId, false)
	if err != nil {
		return
	}
	threshold := setting.StripeAutoChargeThreshold * int(common.QuotaPerUnit)
	if threshold <= 0 || freshQuota >= threshold {
		return
	}

	amountUnits := setting.StripeAutoChargeAmount
	if amountUnits <= 0 {
		return
	}

	if err := ensureStripeKey(); err != nil {
		logger.LogError(nil, fmt.Sprintf("Stripe 自动扣费：密钥无效 user_id=%d error=%q", userId, err.Error()))
		return
	}

	// Resolve currency from the configured template price (same source as manual top-up).
	currency := resolveStripeCurrency()

	money := float64(amountUnits) * setting.StripeUnitPrice
	minorAmount, err := stripeMinorUnitAmount(money, currency)
	if err != nil {
		logger.LogError(nil, fmt.Sprintf("Stripe 自动扣费：金额换算失败 user_id=%d error=%q", userId, err.Error()))
		return
	}

	// A unique key for this attempt window, used for the in-flight cooldown row's trade_no
	// so concurrent failures don't collide on the unique index.
	attemptKey := strconv.Itoa(userId) + "_" + strconv.FormatInt(now, 10)
	// markFailedCooldown records a failed attempt to both the in-memory and the persistent
	// (cross-instance / restart-safe) cooldown, so a declined/unusable card does not trigger
	// a charge attempt on every relay request.
	markFailedCooldown := func() {
		autoChargeLastAt.Store(userId, time.Now().Unix())
		model.RecordStripeAutoChargeAttempt(userId, amountUnits, attemptKey)
	}

	// Find the customer's default card payment method.
	customerId := strings.TrimSpace(user.StripeCustomer)
	paymentMethodId := findDefaultPaymentMethodId(customerId)
	if paymentMethodId == "" {
		logger.LogWarn(nil, fmt.Sprintf("Stripe 自动扣费：未找到可用支付方式 user_id=%d customer=%s", userId, customerId))
		markFailedCooldown()
		model.RecordStripeAutoChargeFailure(userId, amountUnits, "未找到可用的支付方式")
		return
	}

	params := &stripe.PaymentIntentParams{
		Amount:        stripe.Int64(minorAmount),
		Currency:      stripe.String(currency),
		Customer:      stripe.String(customerId),
		PaymentMethod: stripe.String(paymentMethodId),
		Confirm:       stripe.Bool(true),
		OffSession:    stripe.Bool(true),
	}
	params.Metadata = map[string]string{
		"user_id": strconv.Itoa(userId),
		"purpose": "auto_charge",
	}
	// Idempotency key guards against stripe-go retrying on a network error and double-charging.
	// Scoped to the attempt window so a genuine later charge (new window) is not blocked.
	params.SetIdempotencyKey("autocharge_" + attemptKey)

	intent, err := stripepaymentintent.New(params)
	if err != nil {
		// Off-session failures (e.g. authentication_required / declined) are expected; log and bail.
		logger.LogWarn(nil, fmt.Sprintf("Stripe 自动扣费失败 user_id=%d amount_units=%d error=%q", userId, amountUnits, err.Error()))
		markFailedCooldown()
		model.RecordStripeAutoChargeFailure(userId, amountUnits, "扣款被拒绝或需要验证")
		return
	}
	if intent == nil || intent.Status != stripe.PaymentIntentStatusSucceeded {
		status := ""
		if intent != nil {
			status = string(intent.Status)
		}
		logger.LogWarn(nil, fmt.Sprintf("Stripe 自动扣费未成功 user_id=%d status=%s", userId, status))
		markFailedCooldown()
		model.RecordStripeAutoChargeFailure(userId, amountUnits, "扣款未完成")
		return
	}

	autoChargeLastAt.Store(userId, time.Now().Unix())

	if err := model.CreditStripeAutoCharge(userId, amountUnits, money, intent.ID, common.GetIp()); err != nil {
		// Money was captured but crediting failed. Persist a cooldown row so a restart can't
		// re-charge this user within the window, and flag it for manual reconcile.
		markFailedCooldown()
		logger.LogError(nil, fmt.Sprintf("Stripe 自动扣费已扣款但充值入账失败 user_id=%d payment_intent=%s amount_units=%d error=%q", userId, intent.ID, amountUnits, err.Error()))
		model.RecordLog(userId, model.LogTypeSystem, fmt.Sprintf(
			"自动扣费已成功扣款 $%d，但额度入账失败（支付单号 %s），我们将尽快为您处理，如未到账请联系客服。",
			amountUnits, intent.ID,
		))
		return
	}
	logger.LogInfo(nil, fmt.Sprintf("Stripe 自动扣费成功 user_id=%d payment_intent=%s amount_units=%d money=%.2f", userId, intent.ID, amountUnits, money))
}

// findDefaultPaymentMethodId returns the customer's default card payment method id, falling
// back to the first card on file. Preferring invoice_settings.default_payment_method ensures
// a multi-card customer is charged on the card they designated as default.
func findDefaultPaymentMethodId(customerId string) string {
	// Prefer the customer's explicitly designated default payment method.
	if cust, err := stripecustomer.Get(customerId, nil); err == nil && cust != nil {
		if is := cust.InvoiceSettings; is != nil && is.DefaultPaymentMethod != nil {
			if id := strings.TrimSpace(is.DefaultPaymentMethod.ID); id != "" {
				return id
			}
		}
	}

	// Fall back to the first card on file.
	listParams := &stripe.PaymentMethodListParams{
		Customer: stripe.String(customerId),
		Type:     stripe.String(string(stripe.PaymentMethodTypeCard)),
	}
	listParams.Limit = stripe.Int64(1)
	iter := stripepaymentmethod.List(listParams)
	for iter.Next() {
		pm := iter.PaymentMethod()
		if pm != nil && strings.TrimSpace(pm.ID) != "" {
			return pm.ID
		}
	}
	return ""
}
