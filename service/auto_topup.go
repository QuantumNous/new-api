package service

// OpenAI-style "credit running low → auto-charge saved card" UX.
//
// Triggered fire-and-forget from PostTextConsumeQuota whenever a request
// finishes settling. Conditions for an actual Stripe charge:
//
//   1. user.AutoTopupEnabled                   — operator opted in
//   2. user.Quota < user.AutoTopupThreshold    — running low (quota units)
//   3. user.AutoTopupAmount > 0                — non-zero charge amount
//   4. user.StripeCustomer != ""               — saved Stripe customer ID
//   5. setting.StripeApiSecret looks like sk_  — gateway has Stripe key
//   6. Redis lock acquired                     — no concurrent charge in-flight
//
// On a successful Stripe charge the user's quota is incremented and a
// consume_log entry of type LogTypeTopup is written. Failures are logged
// and never propagate to the caller — auto-topup is best-effort. If the
// charge fails, the next request will simply hit insufficient_quota; the
// human can fall back to manual top-up.
//
// V0 scope: requires Redis to be enabled. Without Redis we skip + log
// warn (in practice the dev + prod stacks both run Redis).

import (
	"context"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
	"github.com/stripe/stripe-go/v81"
	"github.com/stripe/stripe-go/v81/paymentintent"
)

// AutoTopupResult is the outcome of MaybeAutoTopup. Exposed for testing
// and observability; the caller normally ignores it.
type AutoTopupResult struct {
	Triggered      bool   // we actually ran a Stripe charge
	SkipReason     string // why we skipped (when Triggered=false)
	StripeIntentID string // payment intent id on success
	ChargedCents   int64  // amount charged in cents
	QuotaIncreased int    // quota units added on success
	Err            error  // non-nil if the charge attempt failed
}

// stripeChargeFn is the function we call to actually charge Stripe.
// Swapped out in tests to avoid hitting the real Stripe API.
var stripeChargeFn = stripeOffSessionCharge

// autoTopupPreconditions is the input to the pure decision helper. We
// pull it out as a struct so unit tests can construct it directly
// without going through DB / Redis / Stripe config.
type autoTopupPreconditions struct {
	Enabled        bool
	Amount         int    // quota units to add
	Threshold      int    // quota units; charge when Quota < Threshold
	Quota          int    // current user quota
	StripeCustomer string // cus_xxx
	StripeKey      string // gateway's sk_/rk_ key
	RedisEnabled   bool
}

// decideAutoTopup is the pure decision branch — given the user state and
// gateway config, should we charge, how much in cents, and (if not) why
// did we skip? No IO. Easy to unit test exhaustively.
func decideAutoTopup(p autoTopupPreconditions) (shouldCharge bool, cents int64, skipReason string) {
	if !p.Enabled {
		return false, 0, "auto_topup_disabled"
	}
	if p.Amount <= 0 {
		return false, 0, "auto_topup_amount_zero"
	}
	if p.Quota >= p.Threshold {
		return false, 0, "quota_above_threshold"
	}
	if p.StripeCustomer == "" {
		return false, 0, "no_stripe_customer"
	}
	if !looksLikeStripeKey(p.StripeKey) {
		return false, 0, "stripe_key_not_configured"
	}
	if !p.RedisEnabled {
		return false, 0, "redis_not_enabled"
	}
	// Auto-topup is charged at the SELLING rate, not the cost basis. quotaUnits-
	// ToStripeCents gives the cost-dollar value of the quota; we multiply by the
	// operator-configurable sell multiplier so the platform earns the same markup
	// as a manual top-up instead of selling quota at cost.
	cents = quotaUnitsToStripeCents(p.Amount) * operation_setting.AutoTopupSellMultiplier()
	if cents < operation_setting.AutoTopupMinChargeCents() {
		return false, cents, "amount_below_stripe_minimum"
	}
	return true, cents, ""
}

// MaybeAutoTopup checks the user's auto-topup config and, if conditions
// are met, charges the saved Stripe payment method and increments the
// user's quota. Safe to call concurrently — uses a Redis SETNX lock.
func MaybeAutoTopup(ctx *gin.Context, userId int) AutoTopupResult {
	user, err := model.GetUserById(userId, false)
	if err != nil || user == nil {
		return AutoTopupResult{SkipReason: "user_not_found", Err: err}
	}

	shouldCharge, cents, skipReason := decideAutoTopup(autoTopupPreconditions{
		Enabled:        user.AutoTopupEnabled,
		Amount:         user.AutoTopupAmount,
		Threshold:      user.AutoTopupThreshold,
		Quota:          user.Quota,
		StripeCustomer: user.StripeCustomer,
		StripeKey:      setting.StripeApiSecret,
		RedisEnabled:   common.RedisEnabled,
	})
	if !shouldCharge {
		if skipReason == "no_stripe_customer" && ctx != nil {
			logger.LogWarn(ctx, fmt.Sprintf("auto-topup skipped for user %d: no Stripe customer on file", userId))
		}
		return AutoTopupResult{SkipReason: skipReason, ChargedCents: cents}
	}

	// Distributed lock: SETNX with a 60s TTL keeps concurrent triggers
	// from the same user collapsing into one Stripe charge. We do NOT
	// release the lock on success — instead we let it expire naturally,
	// so that even if PostConsume fires again immediately after quota
	// is incremented, we won't re-charge until the TTL elapses.
	lockKey := fmt.Sprintf("auto_topup_lock:%d", userId)
	acquired, err := common.RDB.SetNX(context.Background(), lockKey, "1", 60*time.Second).Result()
	if err != nil {
		return AutoTopupResult{SkipReason: "lock_error", Err: err}
	}
	if !acquired {
		return AutoTopupResult{SkipReason: "lock_held"}
	}

	intentID, chargeErr := stripeChargeFn(stripeChargeRequest{
		Amount:         cents,
		Currency:       "usd",
		CustomerID:     user.StripeCustomer,
		IdempotencyKey: fmt.Sprintf("auto-topup:%d:%d", userId, time.Now().Unix()/60),
		ApiSecret:      setting.StripeApiSecret,
	})
	if chargeErr != nil {
		if ctx != nil {
			logger.LogError(ctx, fmt.Sprintf("auto-topup Stripe charge failed for user %d: %v", userId, chargeErr))
		}
		return AutoTopupResult{Triggered: true, Err: chargeErr, ChargedCents: cents}
	}

	if err := model.IncreaseUserQuota(userId, user.AutoTopupAmount, true); err != nil {
		// Stripe charged but we failed to credit — log loudly so an
		// operator can manually reconcile. Returns the error so callers
		// can alert if they care.
		if ctx != nil {
			logger.LogError(ctx, fmt.Sprintf("CRITICAL auto-topup user %d: Stripe charged (%s, %d cents) but quota credit failed: %v", userId, intentID, cents, err))
		}
		return AutoTopupResult{Triggered: true, StripeIntentID: intentID, ChargedCents: cents, Err: err}
	}

	model.RecordLog(userId, model.LogTypeTopup, fmt.Sprintf("auto-topup via Stripe payment intent %s, %d cents → +%d quota", intentID, cents, user.AutoTopupAmount))
	return AutoTopupResult{
		Triggered:      true,
		StripeIntentID: intentID,
		ChargedCents:   cents,
		QuotaIncreased: user.AutoTopupAmount,
	}
}

// stripeChargeRequest is the input to stripeChargeFn — kept as a struct
// so tests can mock without depending on the Stripe SDK directly.
type stripeChargeRequest struct {
	Amount         int64  // cents
	Currency       string // "usd"
	CustomerID     string // cus_xxx
	IdempotencyKey string
	ApiSecret      string
}

// stripeOffSessionCharge is the real production charge implementation.
// Tests override stripeChargeFn to inject a mock that records the call
// and returns whatever the test scenario requires.
func stripeOffSessionCharge(req stripeChargeRequest) (string, error) {
	stripe.Key = req.ApiSecret

	params := &stripe.PaymentIntentParams{
		Amount:        stripe.Int64(req.Amount),
		Currency:      stripe.String(req.Currency),
		Customer:      stripe.String(req.CustomerID),
		Confirm:       stripe.Bool(true),
		OffSession:    stripe.Bool(true),
		PaymentMethod: nil, // Stripe will use the customer's default payment method
	}
	if req.IdempotencyKey != "" {
		params.SetIdempotencyKey(req.IdempotencyKey)
	}

	intent, err := paymentintent.New(params)
	if err != nil {
		return "", err
	}
	if intent.Status != stripe.PaymentIntentStatusSucceeded {
		return intent.ID, fmt.Errorf("payment intent not succeeded: status=%s", intent.Status)
	}
	return intent.ID, nil
}

// quotaUnitsToStripeCents converts our internal quota units to Stripe
// charge amount in cents. common.QuotaPerUnit is "quota units per $1".
func quotaUnitsToStripeCents(quotaUnits int) int64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	dollars := float64(quotaUnits) / common.QuotaPerUnit
	return int64(dollars * 100)
}

// quotaUnitsToMajorAmount converts quota units to a charge amount in MAJOR
// currency units (e.g. 5.00) at the selling multiplier — Airwallex amounts are
// major units, not cents. The number is currency-neutral; the caller pairs it
// with the right ISO code (AUD for the Airwallex path).
//
// NOTE: uses the same SellMultiplier markup as Stripe. Aligning auto-topup to
// the per-currency AirwallexCurrencies unit_price (so manual & auto Airwallex
// prices match exactly) is a future refinement.
func quotaUnitsToMajorAmount(quotaUnits int) float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	costDollars := float64(quotaUnits) / common.QuotaPerUnit
	return costDollars * float64(operation_setting.AutoTopupSellMultiplier())
}

func looksLikeStripeKey(s string) bool {
	if len(s) < 3 {
		return false
	}
	return s[:3] == "sk_" || s[:3] == "rk_"
}
