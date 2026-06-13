// Tests for the billing webhook dispatcher.
//
// These tests focus on the HTTP dispatch mechanics and HMAC signing.
// Event field business logic (StartedAt/FinishedAt population, RoutedFrom
// selection, guard conditions) is tested in service/airbotix_billing_test.go,
// which has access to the gin.Context and relay metadata needed to exercise
// the full orchestration path.
package billing

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

// ── helpers ──────────────────────────────────────────────────────────────────

// minimalEvent returns an Event with only the fields required to produce a
// valid, non-empty JSON payload for dispatcher tests. It is intentionally
// sparse — dispatcher tests care about HTTP behaviour, not field semantics.
func minimalEvent(reqID string) *Event {
	return &Event{
		RequestID:        reqID,
		TenantID:         "test-tenant",
		Provider:         "openai",
		Model:            "gpt-4o-mini",
		PromptTokens:     100,
		CompletionTokens: 50,
		CostUSD:          0.0003,
		PolicyViolations: []string{}, // always non-nil per PRD §7.3
		StartedAt:        time.Now().UTC().Add(-2 * time.Second).Format(time.RFC3339),
		FinishedAt:       time.Now().UTC().Format(time.RFC3339),
	}
}

// ── SignPayload ───────────────────────────────────────────────────────────────

// TestSignPayload_StableAndVerifiable confirms that SignPayload produces the
// correct HMAC-SHA256 digest and that calling it twice with identical inputs
// yields the same result (determinism is required for retry idempotency).
func TestSignPayload_StableAndVerifiable(t *testing.T) {
	payload := []byte(`{"request_id":"r1","provider":"openai"}`)
	secret := []byte("test-secret")

	sig := SignPayload(payload, secret)

	// Independent re-computation to verify correctness.
	mac := hmac.New(sha256.New, secret)
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))

	if sig != expected {
		t.Errorf("SignPayload mismatch: got %q, want %q", sig, expected)
	}

	// Determinism: same inputs must produce identical output.
	sig2 := SignPayload(payload, secret)
	if sig != sig2 {
		t.Errorf("SignPayload is not deterministic: %q != %q", sig, sig2)
	}
}

// ── Dispatcher.Send ───────────────────────────────────────────────────────────

// TestDispatcher_Send_Success verifies the happy path:
//   - exactly one HTTP POST is made
//   - X-DeepRouter-Signature header is present
//   - X-DeepRouter-Event header is "request.completed"
//   - no error is returned on 2xx
func TestDispatcher_Send_Success(t *testing.T) {
	var hits atomic.Int32
	var gotSig, gotEvent string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		gotSig = r.Header.Get("X-DeepRouter-Signature")
		gotEvent = r.Header.Get("X-DeepRouter-Event")
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	d := NewDispatcher()
	d.Client.Timeout = 2 * time.Second

	status, err := d.Send(srv.URL, []byte("secret"), minimalEvent("req-success-001"))
	if err != nil {
		t.Fatalf("Send returned unexpected error: %v", err)
	}
	if status != http.StatusOK {
		t.Errorf("expected status 200, got %d", status)
	}
	if hits.Load() != 1 {
		t.Errorf("expected exactly 1 HTTP call, got %d", hits.Load())
	}
	if gotSig == "" {
		t.Error("X-DeepRouter-Signature header must be present and non-empty")
	}
	if gotEvent != "request.completed" {
		t.Errorf("X-DeepRouter-Event: want %q, got %q", "request.completed", gotEvent)
	}
}

// TestDispatcher_Send_RetriesOn5xx verifies exponential backoff retry logic.
// The server returns 500 for the first two attempts, then 200. The test
// asserts that Send retried and ultimately succeeded.
func TestDispatcher_Send_RetriesOn5xx(t *testing.T) {
	var hits atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := hits.Add(1)
		if n < 3 {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	d := NewDispatcher()
	d.MaxRetries = 3
	d.Client.Timeout = 2 * time.Second

	status, err := d.Send(srv.URL, []byte("s"), minimalEvent("req-retry-001"))
	if err != nil {
		t.Fatalf("expected eventual success after retries, got error: %v", err)
	}
	if status != http.StatusOK {
		t.Errorf("expected final status 200, got %d", status)
	}
	if hits.Load() < 3 {
		t.Errorf("expected at least 3 attempts, got %d", hits.Load())
	}
}

// TestDispatcher_Send_StopsOn4xx verifies that a permanent 4xx client error
// causes Send to return immediately without retry. This prevents hammering a
// receiver that is rejecting requests for a protocol/auth reason.
func TestDispatcher_Send_StopsOn4xx(t *testing.T) {
	var hits atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		w.WriteHeader(http.StatusBadRequest) // 400: permanent error
	}))
	defer srv.Close()

	d := NewDispatcher()
	d.MaxRetries = 5 // high, to confirm early exit
	d.Client.Timeout = 2 * time.Second

	status, err := d.Send(srv.URL, []byte("s"), minimalEvent("req-4xx-001"))
	if err == nil {
		t.Fatal("expected error for 400, got nil")
	}
	if status != http.StatusBadRequest {
		t.Errorf("expected status 400, got %d", status)
	}
	if got := hits.Load(); got != 1 {
		t.Errorf("expected exactly 1 attempt on permanent 4xx, got %d", got)
	}
}

// TestDispatcher_Send_Treats408As Transient verifies that 408 (Request Timeout)
// is retried like a 5xx, not treated as a permanent client error.
func TestDispatcher_Send_Treats408AsTransient(t *testing.T) {
	var hits atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := hits.Add(1)
		if n < 2 {
			w.WriteHeader(http.StatusRequestTimeout) // 408: transient
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	d := NewDispatcher()
	d.MaxRetries = 3
	d.Client.Timeout = 2 * time.Second

	_, err := d.Send(srv.URL, []byte("s"), minimalEvent("req-408-001"))
	if err != nil {
		t.Fatalf("408 should be retried; expected success on second attempt, got: %v", err)
	}
	if hits.Load() < 2 {
		t.Errorf("expected at least 2 attempts for 408, got %d", hits.Load())
	}
}

// ── URL sanitization (sanitizeURLError) ─────────────────────────────────────

// failingRoundTripper simulates a network error whose *url.Error wraps the
// full request URL (including a query-string token), so the test can verify
// sanitizeURLError strips it before Send returns.
type failingRoundTripper struct{}

func (failingRoundTripper) RoundTrip(*http.Request) (*http.Response, error) {
	return nil, &url.Error{
		Op:  "Post",
		URL: "http://example.test/webhook?token=secret-token-value",
		Err: errors.New("connection refused"),
	}
}

// TestDispatcher_BuildRequestErrorDoesNotContainWebhookURL verifies that when
// http.NewRequest fails to build the outbound request (e.g. an invalid URL),
// the error returned by Send does not leak the webhook URL — which may carry
// a signing token in its query string (PRD §7.3).
func TestDispatcher_BuildRequestErrorDoesNotContainWebhookURL(t *testing.T) {
	d := NewDispatcher()

	// A NUL byte makes url.Parse (called by http.NewRequest) fail with
	// "net/url: invalid control character in URL".
	badURL := "http://example.test/webhook?token=secret-token-value\x00"

	_, err := d.Send(badURL, []byte("s"), minimalEvent("req-bad-url"))
	if err == nil {
		t.Fatal("expected error for invalid URL, got nil")
	}
	if strings.Contains(err.Error(), "secret-token-value") {
		t.Errorf("error must not contain the webhook URL's query string, got: %v", err)
	}
	if strings.Contains(err.Error(), "/webhook") {
		t.Errorf("error must not contain the webhook URL's path, got: %v", err)
	}
}

// TestDispatcher_ErrorsDoNotContainWebhookURL verifies that a network error
// from Client.Do — which net/http wraps in *url.Error containing the request
// URL — does not leak the webhook URL via sanitizeURLError.
func TestDispatcher_ErrorsDoNotContainWebhookURL(t *testing.T) {
	d := &Dispatcher{
		Client:     &http.Client{Transport: failingRoundTripper{}},
		MaxRetries: 0,
	}

	webhookURL := "http://example.test/webhook?token=secret-token-value"

	_, err := d.Send(webhookURL, []byte("s"), minimalEvent("req-network-error"))
	if err == nil {
		t.Fatal("expected error for failed RoundTrip, got nil")
	}
	if strings.Contains(err.Error(), "secret-token-value") {
		t.Errorf("error must not contain the webhook URL's query string, got: %v", err)
	}
	if strings.Contains(err.Error(), "/webhook") {
		t.Errorf("error must not contain the webhook URL's path, got: %v", err)
	}
}

// TestEvent_PolicyViolations_SerializesAsEmptyArray verifies that an explicitly
// initialised empty PolicyViolations slice serialises as [] rather than null.
//
// Go semantics: nil slice → JSON null; []string{} → JSON [].
// Callers (service/airbotix_billing.go) MUST initialise PolicyViolations as
// []string{} (never nil) so PRD §7.3's "always-present array" contract holds.
// Receivers can then safely range / len without a nil-check.
func TestEvent_PolicyViolations_SerializesAsEmptyArray(t *testing.T) {
	ev := &Event{
		RequestID:        "r1",
		PolicyViolations: []string{}, // must be non-nil empty slice, not nil
	}

	// Use the same serialisation path that Send() uses (common.Marshal wraps
	// encoding/json but respects AGENTS.md Rule 1). For this structural test
	// standard json.Marshal is sufficient to verify the tag behaviour.
	b, err := json.Marshal(ev)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}

	// policy_violations must appear as [] not null.
	var out map[string]json.RawMessage
	if err := json.Unmarshal(b, &out); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}

	raw, ok := out["policy_violations"]
	if !ok {
		t.Fatal("policy_violations field missing from JSON output")
	}
	if string(raw) == "null" {
		t.Error("policy_violations must serialize as [] when nil, got null")
	}
}

// panicRoundTripper fails the test if RoundTrip is ever called — used to
// assert that Send("") returns without making any HTTP call.
type panicRoundTripper struct{ t *testing.T }

func (p panicRoundTripper) RoundTrip(*http.Request) (*http.Response, error) {
	p.t.Fatal("unexpected HTTP call for empty webhook URL")
	return nil, nil
}

// TestDispatcher_Send_EmptyURL verifies that an empty webhook URL is a
// deliberate no-op: (0, nil), with no HTTP call attempted. Tenants without a
// configured BillingWebhookURL must not produce error-log noise on every
// metered request (service/airbotix_billing.go dispatches unconditionally).
func TestDispatcher_Send_EmptyURL(t *testing.T) {
	d := &Dispatcher{
		Client:     &http.Client{Transport: panicRoundTripper{t: t}},
		MaxRetries: 0,
	}

	status, err := d.Send("", []byte("s"), minimalEvent("req-empty-url"))
	if err != nil {
		t.Errorf("expected nil error for empty URL, got: %v", err)
	}
	if status != 0 {
		t.Errorf("expected status 0 for empty URL, got %d", status)
	}
}
