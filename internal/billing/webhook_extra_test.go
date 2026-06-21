// Additional coverage tests for internal/billing.
//
// Gaps filled (relative to webhook_test.go):
//
//	sanitizeURLError — direct unit tests (nil, non-url.Error, nested chain)
//	Send — 429 transient, 3xx retried, body identical across retries, Content-Type, exhausted retries
//	Event JSON — stars/routed_from/family_id/product_line/kid_profile_id omitempty, image_count always present
//	SignPayload — empty payload, empty secret edge cases
package billing

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// ── sanitizeURLError direct unit tests ───────────────────────────────────────

// TestSanitizeURLError_NilReturnsNil confirms the nil-guard: passing nil must
// return nil without panicking. Callers use this as a transparent pass-through.
func TestSanitizeURLError_NilReturnsNil(t *testing.T) {
	if got := sanitizeURLError(nil); got != nil {
		t.Errorf("sanitizeURLError(nil): want nil, got %v", got)
	}
}

// TestSanitizeURLError_NonURLErrorPassthrough confirms that an ordinary error
// (not *url.Error) is returned unchanged — the function must not wrap or
// modify errors that don't carry a URL.
func TestSanitizeURLError_NonURLErrorPassthrough(t *testing.T) {
	plain := errors.New("some network error")
	got := sanitizeURLError(plain)
	if got != plain {
		t.Errorf("sanitizeURLError(plain): want same pointer, got different value: %v", got)
	}
}

// TestSanitizeURLError_RedactsURL confirms the core contract: a *url.Error
// whose URL contains a query-string token is returned with URL replaced by
// "[redacted]" while Op and Err are preserved.
func TestSanitizeURLError_RedactsURL(t *testing.T) {
	original := &url.Error{
		Op:  "Post",
		URL: "https://hooks.example.com/billing?token=super-secret",
		Err: errors.New("connection refused"),
	}

	got := sanitizeURLError(original)

	urlErr, ok := got.(*url.Error)
	if !ok {
		t.Fatalf("expected *url.Error, got %T", got)
	}
	if urlErr.URL != "[redacted]" {
		t.Errorf("URL: want [redacted], got %q", urlErr.URL)
	}
	if urlErr.Op != "Post" {
		t.Errorf("Op: want %q, got %q", "Post", urlErr.Op)
	}
	if !strings.Contains(got.Error(), "connection refused") {
		t.Errorf("inner error must be preserved: %v", got)
	}
	if strings.Contains(got.Error(), "super-secret") {
		t.Errorf("error string must not contain token: %v", got)
	}
}

// TestSanitizeURLError_NestedURLErrorsAllRedacted verifies the recursive path:
// when a *url.Error wraps another *url.Error (possible in some Go net/http
// middleware chains), both URLs are redacted.
func TestSanitizeURLError_NestedURLErrorsAllRedacted(t *testing.T) {
	inner := &url.Error{
		Op:  "dial",
		URL: "https://inner.example.com/?token=inner-secret",
		Err: errors.New("refused"),
	}
	outer := &url.Error{
		Op:  "Post",
		URL: "https://outer.example.com/?token=outer-secret",
		Err: inner,
	}

	got := sanitizeURLError(outer)

	if strings.Contains(got.Error(), "inner-secret") {
		t.Errorf("inner token must be redacted: %v", got)
	}
	if strings.Contains(got.Error(), "outer-secret") {
		t.Errorf("outer token must be redacted: %v", got)
	}

	outerErr, ok := got.(*url.Error)
	if !ok {
		t.Fatalf("expected *url.Error, got %T", got)
	}
	if outerErr.URL != "[redacted]" {
		t.Errorf("outer URL: want [redacted], got %q", outerErr.URL)
	}
	innerErr, ok := outerErr.Err.(*url.Error)
	if !ok {
		t.Fatalf("inner error: expected *url.Error, got %T", outerErr.Err)
	}
	if innerErr.URL != "[redacted]" {
		t.Errorf("inner URL: want [redacted], got %q", innerErr.URL)
	}
}

// ── Dispatcher.Send — additional coverage ────────────────────────────────────

// TestDispatcher_Send_Treats429AsTransient verifies that 429 (Too Many Requests)
// is retried like a 5xx, not treated as a permanent client error. 429 is
// explicitly excluded from the 4xx short-circuit in Send.
func TestDispatcher_Send_Treats429AsTransient(t *testing.T) {
	var hits atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := hits.Add(1)
		if n < 2 {
			w.WriteHeader(http.StatusTooManyRequests) // 429: transient
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	d := &Dispatcher{
		Client:     &http.Client{Timeout: 2 * time.Second},
		MaxRetries: 3,
	}

	_, err := d.Send(srv.URL, []byte("s"), minimalEvent("req-429"))
	if err != nil {
		t.Fatalf("429 should be retried; expected success on second attempt, got: %v", err)
	}
	if hits.Load() < 2 {
		t.Errorf("expected at least 2 attempts for 429, got %d", hits.Load())
	}
}

// TestDispatcher_Send_3xxIsRetried confirms that a 3xx response is treated as
// a transient failure (not a 2xx success and not a permanent 4xx). The Go
// http.Client does NOT follow redirects for POST by default, so the raw 3xx
// reaches Send, which should retry it.
func TestDispatcher_Send_3xxIsRetried(t *testing.T) {
	var hits atomic.Int32

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := hits.Add(1)
		if n < 2 {
			// 302 redirect: not 2xx, not 4xx — must be retried
			http.Redirect(w, r, r.URL.String(), http.StatusFound)
			return
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	d := &Dispatcher{
		// Disable redirect-following so the raw 302 reaches our retry logic.
		Client: &http.Client{
			Timeout:       2 * time.Second,
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
		MaxRetries: 3,
	}

	_, err := d.Send(srv.URL, []byte("s"), minimalEvent("req-3xx"))
	if err != nil {
		t.Fatalf("3xx should be retried; expected success on second attempt, got: %v", err)
	}
	if hits.Load() < 2 {
		t.Errorf("expected at least 2 attempts for 3xx, got %d", hits.Load())
	}
}

// TestDispatcher_Send_BodyIdenticalAcrossRetries verifies that the exact same
// request body bytes (and therefore the same HMAC signature) are sent on every
// retry attempt. This is required for idempotency: the receiver deduplicates by
// request_id AND verifies the signature, so body drift would cause false
// signature failures on retry.
func TestDispatcher_Send_BodyIdenticalAcrossRetries(t *testing.T) {
	var mu sync.Mutex
	var bodies [][]byte

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := new(bytes.Buffer)
		buf.ReadFrom(r.Body)
		mu.Lock()
		bodies = append(bodies, buf.Bytes())
		mu.Unlock()
		w.WriteHeader(http.StatusInternalServerError) // always fail to trigger retries
	}))
	defer srv.Close()

	d := &Dispatcher{
		Client:     &http.Client{Timeout: 2 * time.Second},
		MaxRetries: 2, // 3 total attempts
	}

	d.Send(srv.URL, []byte("s"), minimalEvent("req-body-stability")) //nolint:errcheck

	// Wait for all retries to land.
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		n := len(bodies)
		mu.Unlock()
		if n >= 3 {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}

	mu.Lock()
	defer mu.Unlock()

	if len(bodies) < 3 {
		t.Fatalf("expected 3 attempts, got %d", len(bodies))
	}
	for i := 1; i < len(bodies); i++ {
		if !bytes.Equal(bodies[0], bodies[i]) {
			t.Errorf("body mismatch between attempt 0 and attempt %d:\nattempt0=%s\nattempt%d=%s",
				i, bodies[0], i, bodies[i])
		}
	}
}

// TestDispatcher_Send_ContentTypeHeader verifies that every POST carries the
// correct Content-Type header. Receivers use this to select a JSON parser
// without inspecting the body first.
func TestDispatcher_Send_ContentTypeHeader(t *testing.T) {
	var gotCT atomic.Value

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotCT.Store(r.Header.Get("Content-Type"))
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	d := &Dispatcher{
		Client:     &http.Client{Timeout: 2 * time.Second},
		MaxRetries: 0,
	}

	d.Send(srv.URL, []byte("s"), minimalEvent("req-ct")) //nolint:errcheck

	ct, _ := gotCT.Load().(string)
	if ct != "application/json" {
		t.Errorf("Content-Type: want %q, got %q", "application/json", ct)
	}
}

// TestDispatcher_Send_ExhaustsRetriesAndReturnsError verifies that when all
// retries fail, Send returns the last error with a non-nil value. This
// confirms callers can always detect total failure.
func TestDispatcher_Send_ExhaustsRetriesAndReturnsError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()

	d := &Dispatcher{
		Client:     &http.Client{Timeout: 2 * time.Second},
		MaxRetries: 1, // 2 total attempts, both fail
	}

	status, err := d.Send(srv.URL, []byte("s"), minimalEvent("req-exhausted"))
	if err == nil {
		t.Fatal("expected error after exhausting retries, got nil")
	}
	if status != http.StatusInternalServerError {
		t.Errorf("expected last status 500, got %d", status)
	}
}

// ── Event JSON serialisation completeness ────────────────────────────────────

// TestEvent_StarsOmittedWhenZero verifies that the stars field (V1 reserved)
// is absent from the wire payload when its value is 0, per the omitempty tag.
// Receivers on V0 should not see this field.
func TestEvent_StarsOmittedWhenZero(t *testing.T) {
	ev := minimalEvent("req-stars")
	// Stars is already 0 (zero value) — should be omitted.

	b, err := json.Marshal(ev)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(b, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := raw["stars"]; ok {
		t.Error("stars must be absent from JSON when value is 0 (omitempty)")
	}
}

// TestEvent_ImageCountAlwaysPresentEvenWhenZero verifies that image_count has
// NO omitempty and is always present in the wire payload — even when 0.
// Receivers rely on this field always being present for multimodal accounting.
func TestEvent_ImageCountAlwaysPresentEvenWhenZero(t *testing.T) {
	ev := minimalEvent("req-imgcount")
	// ImageCount is 0 (zero value) — must still appear in JSON.

	b, err := json.Marshal(ev)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(b, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if _, ok := raw["image_count"]; !ok {
		t.Error("image_count must always be present in JSON (no omitempty) — even when 0")
	}
}

// TestEvent_OmitemptyFieldsAbsentWhenEmpty verifies that RoutedFrom, FamilyID,
// ProductLine, and KidProfileID are all absent from the JSON payload when empty,
// per their omitempty tags. These are conditional fields: absent = not applicable.
func TestEvent_OmitemptyFieldsAbsentWhenEmpty(t *testing.T) {
	ev := minimalEvent("req-omit")
	// All these fields default to "" and should be omitted.

	b, err := json.Marshal(ev)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(b, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	for _, field := range []string{"routed_from", "family_id", "product_line", "kid_profile_id"} {
		if _, ok := raw[field]; ok {
			t.Errorf("%s must be absent from JSON when empty (omitempty)", field)
		}
	}
}

// TestEvent_RequiredFieldsAlwaysPresent verifies that non-omitempty fields
// (request_id, tenant_id, provider, model, prompt_tokens, completion_tokens,
// image_count, cost_usd, policy_violations, started_at, finished_at) are always
// present in the JSON payload, even at their zero values.
func TestEvent_RequiredFieldsAlwaysPresent(t *testing.T) {
	ev := &Event{
		PolicyViolations: []string{},
	}

	b, err := json.Marshal(ev)
	if err != nil {
		t.Fatalf("json.Marshal: %v", err)
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(b, &raw); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	required := []string{
		"request_id", "tenant_id", "provider", "model",
		"prompt_tokens", "completion_tokens", "image_count",
		"cost_usd", "policy_violations", "started_at", "finished_at",
	}
	for _, field := range required {
		if _, ok := raw[field]; !ok {
			t.Errorf("required field %q must always be present in JSON", field)
		}
	}
}

// ── SignPayload edge cases ────────────────────────────────────────────────────

// TestSignPayload_EmptyPayloadAndSecret verifies that SignPayload handles
// degenerate inputs (empty payload, empty secret) without panicking and
// returns a valid 64-char hex string (HMAC-SHA256 always produces 32 bytes).
func TestSignPayload_EmptyPayloadAndSecret(t *testing.T) {
	sig := SignPayload([]byte{}, []byte{})
	if len(sig) != 64 {
		t.Errorf("HMAC-SHA256 hex must be 64 chars, got %d: %q", len(sig), sig)
	}
	for _, c := range sig {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			t.Errorf("signature must be lowercase hex, got char %q in %q", c, sig)
			break
		}
	}
}

// TestSignPayload_DifferentSecretsProduceDifferentSigs verifies that changing
// the secret changes the output — a basic HMAC property that must hold for the
// receiver's verification to be meaningful.
func TestSignPayload_DifferentSecretsProduceDifferentSigs(t *testing.T) {
	payload := []byte(`{"request_id":"r1"}`)
	sig1 := SignPayload(payload, []byte("secret-a"))
	sig2 := SignPayload(payload, []byte("secret-b"))
	if sig1 == sig2 {
		t.Error("different secrets must produce different HMAC signatures")
	}
}
