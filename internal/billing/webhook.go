// Package billing dispatches per-request billing webhooks to tenant-configured
// receivers after each successful LLM relay round-trip.
//
// Architecture: this package is a leaf — it imports only stdlib and the shared
// JSON wrapper from common/. No upstream relay, gin, or GORM types are allowed
// here. Orchestration (reading gin.Context, building Event fields) lives in the
// upstream-adjacent file service/airbotix_billing.go (ADR-0006, 4th sanctioned
// file). This separation keeps the package independently testable and free of
// AGPL-viral surface.
//
// Spec: DeepRouter PRD §7.3 (webhook protocol).
// DR-25: schema extended with started_at / finished_at / policy_violations /
//
//	routed_from. DRS-8 will own future schema evolution; fields added
//	here are the DR-25 minimum required set.
//
// Wire format guarantees:
//   - POST to tenant.BillingWebhookURL
//   - Content-Type: application/json
//   - X-DeepRouter-Signature: lowercase hex HMAC-SHA256(body, secret)
//   - X-DeepRouter-Event: "request.completed"
//   - Retries: up to 3 on 5xx / network error with exponential backoff
//   - 4xx (except 408/429) is treated as permanent — no retry
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
	neturl "net/url"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// Event is the JSON payload POSTed to a tenant's BillingWebhookURL after each
// successful, metered relay request.
//
// Field contract (PRD §7.3 + DR-25 ticket):
//   - All string timestamps are RFC3339 UTC.
//   - CostUSD = float64(quota) / common.QuotaPerUnit.
//   - Receiver-side end-user billing, Stars conversion, wallet deduction, and
//     terminal charging semantics are outside DR-8's scope.
//   - PolicyViolations is always present (empty slice, not null) so receivers
//     can use it without nil-checking. Phase 4 content moderation will populate it.
//   - RoutedFrom is non-empty only when the smart-router resolved a virtual model
//     (e.g. "deeprouter-auto") to a concrete upstream model. Direct requests
//     (model name is already concrete) leave this field absent.
//
// JSON serialisation MUST use common.Marshal (AGENTS.md Rule 1).
type Event struct {
	// RequestID is the per-request idempotency key propagated from the relay
	// layer. Receivers must deduplicate by this field (PRD §7.3).
	RequestID string `json:"request_id"`

	// TenantID identifies the tenant (= model.User.Username).
	TenantID string `json:"tenant_id"`

	// FamilyID and ProductLine are optional tenant-hierarchy fields reserved
	// for future multi-family / multi-product deployments.
	FamilyID    string `json:"family_id,omitempty"`
	ProductLine string `json:"product_line,omitempty"`

	// KidProfileID is the end-user child profile within the tenant, passed by
	// the caller as the X-Tenant-User request header (PRD §7.3).
	KidProfileID string `json:"kid_profile_id,omitempty"`

	// Provider is the stable, lowercase wire-format upstream provider identifier
	// (e.g. "openai", "anthropic"). Set by channelTypeProviderID() in
	// service/airbotix_billing.go, NOT from constant.GetChannelTypeName() which
	// returns display names for UI.
	Provider string `json:"provider"`

	// Model is the concrete upstream model that was actually called
	// (e.g. "claude-haiku-4-5"). For deeprouter-auto requests this is the
	// smart-router's resolved model, not the virtual name the client sent.
	Model string `json:"model"`

	// RoutedFrom is the virtual model name originally requested by the client
	// (e.g. "deeprouter-auto"). Non-empty only when the smart-router performed
	// Layer-1 routing. Absent for direct model requests.
	// DR-25: only "deeprouter-auto" triggers this field; ordinary alias rewrites
	// (distributor.go SimpleMode) do not qualify.
	RoutedFrom string `json:"routed_from,omitempty"`

	// PromptTokens and CompletionTokens are the actual token counts returned by
	// the upstream provider in the final usage chunk (stream) or response body
	// (non-stream). These are the authoritative figures for token accounting.
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`

	// ImageCount tracks multi-modal image inputs. Always 0 in V0 — image
	// counting is a V1 feature. Field is always present per PRD §7.3 wire contract.
	ImageCount int `json:"image_count"`

	// CostUSD is the USD cost computed as float64(quota)/common.QuotaPerUnit.
	// Calculated after SettleBilling so it reflects the final settled amount.
	CostUSD float64 `json:"cost_usd"`

	// Stars is a V1 reserved field retained for compatibility with main.
	// Always 0 in V0. DR-8 does not define Stars conversion or terminal
	// charging semantics; receivers should ignore this field in V0.
	Stars int `json:"stars,omitempty"`

	// PolicyViolations lists policy rule IDs triggered during this request
	// (e.g. ["kids_mode:blocked_model"]). Empty slice (never nil) when no
	// violations occurred. Phase 4 content moderation will populate this.
	PolicyViolations []string `json:"policy_violations"`

	// StartedAt is the RFC3339 UTC timestamp when the relay request began
	// (relay/common.RelayInfo.StartTime).
	StartedAt string `json:"started_at"`

	// FinishedAt is the RFC3339 UTC timestamp when token counts were tallied
	// and this dispatch was triggered (time.Now() at dispatch call site).
	FinishedAt string `json:"finished_at"`
}

// SignPayload computes the lowercase hex-encoded HMAC-SHA256 of payload using
// secret as the key. The result is placed in the X-DeepRouter-Signature header
// so receivers can verify authenticity without parsing the body first.
//
// Algorithm: HMAC-SHA256(secret, payload) → hex string (no "sha256=" prefix).
func SignPayload(payload, secret []byte) string {
	mac := hmac.New(sha256.New, secret)
	mac.Write(payload)
	return hex.EncodeToString(mac.Sum(nil))
}

// sanitizeURLError redacts the URL field of any *url.Error in err's chain,
// replacing it with "[redacted]". Both http.NewRequest (invalid URL) and
// http.Client.Do (network error) return *url.Error with URL set to the
// request URL, which for billing webhooks may include a signing token in
// the query string (PRD §7.3). Without this, that token could leak into
// returned errors and logs. Non-*url.Error values are returned unchanged.
func sanitizeURLError(err error) error {
	if err == nil {
		return nil
	}
	var urlErr *neturl.Error
	if errors.As(err, &urlErr) {
		return &neturl.Error{
			Op:  urlErr.Op,
			URL: "[redacted]",
			Err: sanitizeURLError(urlErr.Err),
		}
	}
	return err
}

// Dispatcher sends Events to a tenant's webhook endpoint with best-effort
// retries. It is stateless: create one per dispatch call via NewDispatcher().
type Dispatcher struct {
	// Client is the HTTP client used for outbound webhook calls. Exposed for
	// test injection (replace with httptest-backed transport).
	Client *http.Client

	// MaxRetries is the number of additional attempts after the first failure.
	// Total attempts = MaxRetries + 1. Default: 3 (set by NewDispatcher).
	MaxRetries int
}

// NewDispatcher returns a Dispatcher with production-safe defaults:
//   - 5 s per-request timeout (generous for a fire-and-forget path)
//   - 3 retries (covers transient network blips and momentary 5xx)
func NewDispatcher() *Dispatcher {
	return &Dispatcher{
		Client:     &http.Client{Timeout: 5 * time.Second},
		MaxRetries: 3,
	}
}

// Send serialises ev to JSON, signs the payload with HMAC-SHA256, and POSTs
// it to url. It retries on transient failures (network errors, 5xx, 408, 429)
// using exponential backoff (200 ms → 400 ms → 800 ms). Permanent client
// errors (4xx except 408/429) short-circuit immediately without retry.
//
// Returns the final HTTP status code and any error. A nil error means the
// receiver acknowledged with a 2xx response.
//
// Retry logic:
//   - attempt 0 : immediate
//   - attempt 1 : sleep 200 ms
//   - attempt 2 : sleep 400 ms
//   - attempt 3 : sleep 800 ms
//     Total wall time for full failure: ≈ 1.4 s + 4 × network RTT
func (d *Dispatcher) Send(url string, secret []byte, ev *Event) (int, error) {
	if url == "" {
		// No webhook configured for this tenant: a deliberate no-op, not an
		// error. Callers (service/airbotix_billing.go) dispatch unconditionally
		// for every metered request, so an empty BillingWebhookURL must not
		// surface as an error in logs.
		return 0, nil
	}

	// Serialise once; reuse the same bytes for every retry attempt so the
	// HMAC signature remains stable (identical body → identical digest).
	payload, err := common.Marshal(ev)
	if err != nil {
		return 0, fmt.Errorf("billing.Send: marshal: %w", err)
	}
	sig := SignPayload(payload, secret)

	var lastErr error
	var lastStatus int

	for attempt := 0; attempt <= d.MaxRetries; attempt++ {
		// Rebuild the request body reader on each attempt — bytes.Reader is
		// not reusable after the first Read without an explicit Seek.
		req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(payload))
		if err != nil {
			return 0, fmt.Errorf("billing.Send: build request: %w", sanitizeURLError(err))
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-DeepRouter-Signature", sig)
		// X-DeepRouter-Event lets receivers route/filter without parsing body.
		req.Header.Set("X-DeepRouter-Event", "request.completed")

		resp, err := d.Client.Do(req)
		if err != nil {
			lastErr = sanitizeURLError(err)
			lastStatus = 0
		} else {
			lastStatus = resp.StatusCode
			// Drain and close to allow connection reuse (net/http requirement).
			_, _ = io.Copy(io.Discard, resp.Body)
			_ = resp.Body.Close()

			if resp.StatusCode >= 200 && resp.StatusCode < 300 {
				return resp.StatusCode, nil
			}

			lastErr = fmt.Errorf("billing.Send: non-2xx %d", resp.StatusCode)

			// Permanent client error: retrying will not help. 408 (Request
			// Timeout) and 429 (Too Many Requests) are the exceptions — both
			// can succeed on retry.
			if resp.StatusCode >= 400 && resp.StatusCode < 500 &&
				resp.StatusCode != 408 && resp.StatusCode != 429 {
				return resp.StatusCode, lastErr
			}
		}

		// Exponential backoff before the next attempt. Skip on the last one.
		if attempt < d.MaxRetries {
			time.Sleep(time.Duration(200*(1<<attempt)) * time.Millisecond)
		}
	}

	return lastStatus, lastErr
}
