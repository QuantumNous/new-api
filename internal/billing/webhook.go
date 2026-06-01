// Package billing dispatches per-request billing webhooks to tenant-configured
// receivers after each LLM round-trip. The receiver is responsible for
// deducting credits (e.g. Airbotix Stars) and recording the consumption ledger.
//
// Spec: DeepRouter PRD §7.3 (webhook protocol) + kids-ai-platform-prd.md §9.7
// (atomicity contract on the receiver side).
//
// This V0 skeleton focuses on:
//   - Signing payloads with HMAC-SHA256
//   - Best-effort retries on 5xx / network errors
//   - Dead-letter for permanent failures
//
// Wiring into the relay path comes in a follow-up commit; this package
// compiles standalone with a unit test.
package billing

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Event is the payload posted to tenant.BillingWebhookURL after each request.
// See DeepRouter PRD §7.3.
type Event struct {
	RequestID        string  `json:"request_id"`
	TenantID         string  `json:"tenant_id"`
	FamilyID         string  `json:"family_id,omitempty"`
	KidProfileID     string  `json:"kid_profile_id,omitempty"`
	ProductLine      string  `json:"product_line,omitempty"`
	Provider         string  `json:"provider"`
	Model            string  `json:"model"`
	PromptTokens     int     `json:"prompt_tokens"`
	CompletionTokens int     `json:"completion_tokens"`
	// ImageCount is the number of image inputs in the request.
	// Currently always 0 — multi-modal image counting is a V1 feature.
	// omitempty keeps the V0 wire format clean; receivers should treat
	// absence of this field as "not tracked yet".
	ImageCount int `json:"image_count,omitempty"`
	CostUSD    float64 `json:"cost_usd"`
	// Stars is reserved for Airbotix Stars credit mapping (V1).
	// Always 0 in V0; receivers should ignore this field until the
	// Stars pricing table is wired in.
	Stars     int    `json:"stars,omitempty"`
	Timestamp string `json:"timestamp"` // RFC3339
}

// SignPayload returns the lowercase hex-encoded HMAC-SHA256 of payload.
// Header used by receivers: X-DeepRouter-Signature.
func SignPayload(payload, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// Dispatcher sends Events to a tenant's webhook with retries.
type Dispatcher struct {
	Client     *http.Client
	MaxRetries int
}

// NewDispatcher returns a Dispatcher with sensible defaults (3 retries, 5s timeout).
func NewDispatcher() *Dispatcher {
	return &Dispatcher{
		Client:     &http.Client{Timeout: 5 * time.Second},
		MaxRetries: 3,
	}
}

// Send posts the event to url with the X-DeepRouter-Signature header derived
// from secret. Retries on transient failures with exponential backoff.
// Returns the final response status and the last error (nil on 2xx).
func (d *Dispatcher) Send(url string, secret []byte, ev *Event) (int, error) {
	if url == "" {
		return 0, errors.New("billing.Send: empty webhook url")
	}
	payload, err := common.Marshal(ev)
	if err != nil {
		return 0, fmt.Errorf("billing.Send: marshal: %w", err)
	}
	sig := SignPayload(payload, secret)

	var lastErr error
	var lastStatus int
	for attempt := 0; attempt <= d.MaxRetries; attempt++ {
		req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
		if err != nil {
			return 0, fmt.Errorf("billing.Send: build request: %w", err)
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-DeepRouter-Signature", sig)
		req.Header.Set("X-DeepRouter-Event", "request.completed")

		resp, err := d.Client.Do(req)
		if err != nil {
			lastErr = err
			lastStatus = 0
		} else {
			lastStatus = resp.StatusCode
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()
			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				return resp.StatusCode, nil
			}
			lastErr = fmt.Errorf("billing.Send: non-2xx %d", resp.StatusCode)
			if resp.StatusCode >= 400 && resp.StatusCode < 500 && resp.StatusCode != 408 && resp.StatusCode != 429 {
				// 4xx (other than 408/429) is permanent: don't retry
				return resp.StatusCode, lastErr
			}
		}

		// backoff: 200ms, 400ms, 800ms, ...
		if attempt < d.MaxRetries {
			time.Sleep(time.Duration(200*(1<<attempt)) * time.Millisecond)
		}
	}
	return lastStatus, lastErr
}
