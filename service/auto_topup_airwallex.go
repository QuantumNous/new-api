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

	"github.com/QuantumNous/new-api/setting"
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
