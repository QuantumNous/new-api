package service

// Airwallex off-session (merchant-initiated, MIT) auto-charge — the Airwallex
// counterpart of stripeOffSessionCharge. Charges a saved PaymentConsent when a
// user's balance runs low. NOT wired into MaybeAutoTopup here (PR-7 does the
// provider split); this file only provides the charge primitive + its request
// shape so it can be unit-tested in isolation.
//
// Package boundary note: getAirwallexAccessToken lives in the controller
// package (can't import without a cycle), so we re-implement a minimal login
// here against setting.AirwallexClientId/ApiKey. Off-session charges are
// infrequent, so a per-call token (no cache) is acceptable.

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// airwallexChargeRequest mirrors stripeChargeRequest. Amount is in MAJOR
// currency units (Airwallex uses major units, not cents).
type airwallexChargeRequest struct {
	Amount        float64 // e.g. 5.00
	Currency      string  // "AUD"
	CustomerID    string  // cus_...
	ConsentID     string  // cst_... — the off-session mandate
	PaymentMethod string  // pm_...
	OriginalTxnID string  // payment_method_transaction_id (boosts MIT accept rate)
	RequestID     string  // idempotency root; reused across retries of one logical charge
}

// airwallexChargeFn is the seam PR-7 / tests override to avoid real API calls.
var airwallexChargeFn = airwallexOffSessionCharge

// airwallexAutoTopupMaxFailures disables a user's auto-topup after this many
// consecutive charge failures (resets on any success).
const airwallexAutoTopupMaxFailures = 3

// airwallexAutoTopupPreconditions is the pure-decision input for the Airwallex
// off-session path (parallel to autoTopupPreconditions for Stripe).
type airwallexAutoTopupPreconditions struct {
	Enabled        bool   // user.AutoTopupEnabled
	FlagEnabled    bool   // operator master flag (AutoTopupAirwallexEnabled)
	Amount         int    // quota units to add
	Threshold      int    // quota units; charge when Quota < Threshold
	Quota          int    // current user quota
	ConsentID      string // user.AirwallexConsentID (the off-session mandate)
	MinChargeCents int64  // AUD min, in cents
	RedisEnabled   bool
}

// decideAirwallexAutoTopup mirrors decideAutoTopup for the Airwallex path.
// Returns whether to charge, the major-unit amount (e.g. 5.00), and a skip
// reason. Pure — no IO.
func decideAirwallexAutoTopup(p airwallexAutoTopupPreconditions) (shouldCharge bool, amountMajor float64, skipReason string) {
	if !p.FlagEnabled {
		return false, 0, "airwallex_autotopup_disabled"
	}
	if !p.Enabled {
		return false, 0, "auto_topup_disabled"
	}
	if p.Amount <= 0 {
		return false, 0, "auto_topup_amount_zero"
	}
	if p.Quota >= p.Threshold {
		return false, 0, "quota_above_threshold"
	}
	if p.ConsentID == "" {
		return false, 0, "no_airwallex_consent"
	}
	if !p.RedisEnabled {
		return false, 0, "redis_not_enabled"
	}
	amountMajor = quotaUnitsToMajorAmount(p.Amount)
	if int64(amountMajor*100) < p.MinChargeCents {
		return false, amountMajor, "amount_below_minimum"
	}
	return true, amountMajor, ""
}

// buildAirwallexCreateBody builds the PaymentIntent create payload.
func buildAirwallexCreateBody(req airwallexChargeRequest) map[string]interface{} {
	return map[string]interface{}{
		"request_id":        req.RequestID + "-create",
		"merchant_order_id": req.RequestID,
		"amount":            req.Amount,
		"currency":          req.Currency,
		"customer_id":       req.CustomerID,
		"descriptor":        "DeepRouter Auto Recharge",
	}
}

// buildAirwallexConfirmBody builds the confirm payload for an off-session MIT
// charge against a saved consent.
func buildAirwallexConfirmBody(req airwallexChargeRequest) map[string]interface{} {
	rec := map[string]interface{}{"merchant_trigger_reason": "unscheduled"}
	if req.OriginalTxnID != "" {
		rec["original_transaction_id"] = req.OriginalTxnID
	}
	body := map[string]interface{}{
		"request_id":              req.RequestID + "-confirm",
		"payment_consent_id":      req.ConsentID,
		"triggered_by":            "merchant", // this charge is merchant-initiated
		"external_recurring_data": rec,
	}
	if req.PaymentMethod != "" {
		body["payment_method"] = map[string]interface{}{"id": req.PaymentMethod}
	}
	return body
}

func airwallexLogin(ctx context.Context) (string, error) {
	if setting.AirwallexClientId == "" || setting.AirwallexApiKey == "" {
		return "", fmt.Errorf("airwallex credentials not configured")
	}
	url := setting.AirwallexApiBaseURL() + "/api/v1/authentication/login"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("x-client-id", setting.AirwallexClientId)
	req.Header.Set("x-api-key", setting.AirwallexApiKey)
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode/100 != 2 {
		return "", fmt.Errorf("airwallex login %d: %s", resp.StatusCode, string(b))
	}
	var parsed struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(b, &parsed); err != nil || parsed.Token == "" {
		return "", fmt.Errorf("airwallex login: missing token: %s", string(b))
	}
	return parsed.Token, nil
}

func airwallexPost(ctx context.Context, token, path string, body interface{}) (map[string]interface{}, error) {
	payload, _ := json.Marshal(body)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, setting.AirwallexApiBaseURL()+path, bytes.NewReader(payload))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	if resp.StatusCode/100 != 2 {
		return nil, fmt.Errorf("airwallex %s -> %d: %s", path, resp.StatusCode, string(b))
	}
	var out map[string]interface{}
	if err := json.Unmarshal(b, &out); err != nil {
		return nil, fmt.Errorf("airwallex %s decode: %w", path, err)
	}
	return out, nil
}

// airwallexOffSessionCharge creates + confirms an Airwallex PaymentIntent
// against a saved consent (off-session MIT). Returns the intent id on terminal
// success; any non-SUCCEEDED status is an error (off-session must not need a
// challenge — the caller logs and may disable auto-topup).
func airwallexOffSessionCharge(req airwallexChargeRequest) (string, error) {
	ctx := context.Background()
	token, err := airwallexLogin(ctx)
	if err != nil {
		return "", err
	}

	created, err := airwallexPost(ctx, token, "/api/v1/pa/payment_intents/create", buildAirwallexCreateBody(req))
	if err != nil {
		return "", err
	}
	intentID, _ := created["id"].(string)
	if intentID == "" {
		return "", fmt.Errorf("airwallex create intent: missing id")
	}

	confirmed, err := airwallexPost(ctx, token,
		fmt.Sprintf("/api/v1/pa/payment_intents/%s/confirm", intentID),
		buildAirwallexConfirmBody(req))
	if err != nil {
		return intentID, err
	}
	if status, _ := confirmed["status"].(string); status != "SUCCEEDED" {
		return intentID, fmt.Errorf("airwallex off-session not succeeded: status=%v", status)
	}
	return intentID, nil
}

// maybeAirwallexAutoTopup runs the Airwallex off-session auto-charge for a user
// (the Airwallex counterpart of the Stripe branch in MaybeAutoTopup). Called
// only when the operator flag is on AND the user has a saved consent. Mirrors
// the Stripe path: decide → Redis lock → charge → credit → log.
func maybeAirwallexAutoTopup(ctx *gin.Context, user *model.User) AutoTopupResult {
	should, amountMajor, reason := decideAirwallexAutoTopup(airwallexAutoTopupPreconditions{
		Enabled:        user.AutoTopupEnabled,
		FlagEnabled:    operation_setting.AutoTopupAirwallexEnabled(),
		Amount:         user.AutoTopupAmount,
		Threshold:      user.AutoTopupThreshold,
		Quota:          user.Quota,
		ConsentID:      user.AirwallexConsentID,
		MinChargeCents: operation_setting.AutoTopupMinChargeAUDCents(),
		RedisEnabled:   common.RedisEnabled,
	})
	if !should {
		return AutoTopupResult{SkipReason: reason}
	}

	// Same lock key as the Stripe path — a user has only one auto-topup in
	// flight regardless of provider.
	lockKey := fmt.Sprintf("auto_topup_lock:%d", user.Id)
	acquired, err := common.RDB.SetNX(context.Background(), lockKey, "1", 60*time.Second).Result()
	if err != nil {
		return AutoTopupResult{SkipReason: "lock_error", Err: err}
	}
	if !acquired {
		return AutoTopupResult{SkipReason: "lock_held"}
	}

	intentID, chargeErr := airwallexChargeFn(airwallexChargeRequest{
		Amount:        amountMajor,
		Currency:      "AUD",
		CustomerID:    user.AirwallexCustomer,
		ConsentID:     user.AirwallexConsentID,
		PaymentMethod: user.AirwallexPaymentMethod,
		OriginalTxnID: user.AirwallexOriginalTxnID,
		RequestID:     fmt.Sprintf("aw-autotopup-%d-%d", user.Id, time.Now().Unix()/60),
	})
	if chargeErr != nil {
		if ctx != nil {
			logger.LogError(ctx, fmt.Sprintf("airwallex auto-topup charge failed for user %d: %v", user.Id, chargeErr))
		}
		// Failure backoff: after N consecutive failures, disable the user's
		// auto-topup so we stop hammering a declining card (they can re-enable).
		if common.RedisEnabled {
			failKey := fmt.Sprintf("airwallex_autotopup_fail:%d", user.Id)
			n, _ := common.RDB.Incr(context.Background(), failKey).Result()
			common.RDB.Expire(context.Background(), failKey, 24*time.Hour)
			if n >= airwallexAutoTopupMaxFailures {
				user.AutoTopupEnabled = false
				if derr := user.UpdateAutoTopup(); derr == nil && ctx != nil {
					logger.LogWarn(ctx, fmt.Sprintf("airwallex auto-topup disabled for user %d after %d consecutive failures", user.Id, n))
				}
				common.RDB.Del(context.Background(), failKey)
			}
		}
		return AutoTopupResult{Triggered: true, Err: chargeErr}
	}

	// Success → reset the failure counter.
	if common.RedisEnabled {
		common.RDB.Del(context.Background(), fmt.Sprintf("airwallex_autotopup_fail:%d", user.Id))
	}

	if err := model.IncreaseUserQuota(user.Id, user.AutoTopupAmount, true); err != nil {
		if ctx != nil {
			logger.LogError(ctx, fmt.Sprintf("CRITICAL airwallex auto-topup user %d: charged (%s) but quota credit failed: %v", user.Id, intentID, err))
		}
		return AutoTopupResult{Triggered: true, StripeIntentID: intentID, Err: err}
	}

	model.RecordLog(user.Id, model.LogTypeTopup, fmt.Sprintf("auto-topup via Airwallex %s, A$%.2f → +%d quota", intentID, amountMajor, user.AutoTopupAmount))
	return AutoTopupResult{
		Triggered:      true,
		StripeIntentID: intentID, // reused field: holds the provider intent id
		ChargedCents:   int64(amountMajor * 100),
		QuotaIncreased: user.AutoTopupAmount,
	}
}
