package service

// Integration tests for dispatchAirbotixBilling — Phase 2 acceptance criteria (d):
// "webhook called with correct payload + HMAC"
//
// These tests use httptest.NewServer as the mock billing receiver so no external
// network is needed. dispatchAirbotixBilling fires in a goroutine; tests wait
// with a short poll rather than a fixed sleep so the suite stays fast.

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/billing"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"

	"github.com/gin-gonic/gin"
)

// ─── helpers ─────────────────────────────────────────────────────────────────

const testSecret = "test-hmac-secret-for-billing-test"

// webhookServer returns a test HTTP server that captures the most-recent
// POST body + signature header and a hit-count for concurrency proofs.
type webhookServer struct {
	*httptest.Server
	hits   atomic.Int64
	body   atomic.Value // []byte
	sigHdr atomic.Value // string
	status int          // response status (default 200)
}

func newWebhookServer(t *testing.T, status int) *webhookServer {
	t.Helper()
	ws := &webhookServer{status: status}
	ws.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		ws.body.Store(b)
		ws.sigHdr.Store(r.Header.Get("X-DeepRouter-Signature"))
		ws.hits.Add(1)
		w.WriteHeader(ws.status)
	}))
	t.Cleanup(ws.Close)
	return ws
}

// waitHits polls until the server has received at least n hits or the deadline.
func (ws *webhookServer) waitHits(n int64, timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if ws.hits.Load() >= n {
			return true
		}
		time.Sleep(10 * time.Millisecond)
	}
	return false
}

func (ws *webhookServer) getBody() []byte {
	v := ws.body.Load()
	if v == nil {
		return nil
	}
	return v.([]byte)
}

func (ws *webhookServer) getSig() string {
	v := ws.sigHdr.Load()
	if v == nil {
		return ""
	}
	return v.(string)
}

// verifyHMAC reports whether sig == HMAC-SHA256(body, secret) in hex.
// The X-DeepRouter-Signature header carries the raw hex digest (no "sha256=" prefix).
func verifyHMAC(body []byte, sig, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(sig), []byte(expected))
}

// billingTestCtx creates a minimal *gin.Context pre-loaded with *model.User
// carrying the given webhookURL + secret.
func billingTestCtx(webhookURL, secret string) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	user := &model.User{
		Id:                2,
		Username:          "airbotix-kids",
		KidsMode:          true,
		BillingWebhookURL: webhookURL,
		WebhookSecret:     secret,
	}
	common.SetContextKey(c, constant.ContextKeyAirbotixUser, user)
	return c
}

func testRelayInfo(reqID, model string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RequestId:       reqID,
		OriginModelName: model,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
		},
	}
}

func testUsage(prompt, completion int) *dto.Usage {
	return &dto.Usage{
		PromptTokens:     prompt,
		CompletionTokens: completion,
		TotalTokens:      prompt + completion,
	}
}

// ─── tests ───────────────────────────────────────────────────────────────────

// TestDispatchAirbotixBilling_SendsPayloadAndHMAC is the primary Phase-2
// acceptance test: a kids_mode tenant request triggers a webhook POST whose
// body matches the billing.Event contract and whose X-DeepRouter-Signature
// header is a valid HMAC-SHA256.
func TestDispatchAirbotixBilling_SendsPayloadAndHMAC(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret)

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-kids-001", "gpt-4o-mini"),
		testUsage(150, 80),
		500_000, // ~$1.00 at default QuotaPerUnit
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook was not called within 2s")
	}

	// ── payload structure ──────────────────────────────────────────────────
	body := ws.getBody()
	var ev billing.Event
	if err := json.Unmarshal(body, &ev); err != nil {
		t.Fatalf("webhook body is not valid JSON: %v\nbody=%s", err, body)
	}

	if ev.RequestID != "req-kids-001" {
		t.Errorf("RequestID: want %q, got %q", "req-kids-001", ev.RequestID)
	}
	if ev.TenantID != "airbotix-kids" {
		t.Errorf("TenantID: want %q, got %q", "airbotix-kids", ev.TenantID)
	}
	if ev.Model != "gpt-4o-mini" {
		t.Errorf("Model: want %q, got %q", "gpt-4o-mini", ev.Model)
	}
	if ev.PromptTokens != 150 {
		t.Errorf("PromptTokens: want 150, got %d", ev.PromptTokens)
	}
	if ev.CompletionTokens != 80 {
		t.Errorf("CompletionTokens: want 80, got %d", ev.CompletionTokens)
	}
	if ev.CostUSD <= 0 {
		t.Errorf("CostUSD should be positive, got %f", ev.CostUSD)
	}
	if ev.Timestamp == "" {
		t.Error("Timestamp must not be empty")
	}
	if ev.Provider == "" {
		t.Error("Provider must not be empty")
	}

	// ── HMAC signature ─────────────────────────────────────────────────────
	// X-DeepRouter-Signature carries a raw hex HMAC-SHA256 (no "sha256=" prefix).
	sig := ws.getSig()
	if sig == "" {
		t.Fatal("X-DeepRouter-Signature header must be present and non-empty")
	}
	if !verifyHMAC(body, sig, testSecret) {
		t.Errorf("HMAC verification failed: sig=%q", sig)
	}
}

// TestDispatchAirbotixBilling_NoopWhenNoUser verifies that the function is a
// no-op when ContextKeyAirbotixUser is absent (non-Airbotix request path).
func TestDispatchAirbotixBilling_NoopWhenNoUser(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	// Deliberately NOT setting ContextKeyAirbotixUser

	dispatchAirbotixBilling(c, testRelayInfo("req-noop", "gpt-4o-mini"), testUsage(10, 5), 1000)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Error("webhook should not be called when user is absent from context")
	}
}

// TestDispatchAirbotixBilling_NoopWhenEmptyURL verifies no webhook call when
// the tenant has BillingWebhookURL == "".
func TestDispatchAirbotixBilling_NoopWhenEmptyURL(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	user := &model.User{
		Id:                3,
		Username:          "no-webhook-tenant",
		BillingWebhookURL: "", // empty
		WebhookSecret:     testSecret,
	}
	common.SetContextKey(c, constant.ContextKeyAirbotixUser, user)

	dispatchAirbotixBilling(c, testRelayInfo("req-empty-url", "gpt-4o-mini"), testUsage(10, 5), 1000)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Error("webhook should not be called when BillingWebhookURL is empty")
	}
}

// TestDispatchAirbotixBilling_NoopWhenEmptySecret mirrors empty-URL: if the
// tenant has no webhook secret we must not send (receiver can't verify).
func TestDispatchAirbotixBilling_NoopWhenEmptySecret(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, "") // empty secret

	dispatchAirbotixBilling(c, testRelayInfo("req-no-secret", "gpt-4o-mini"), testUsage(10, 5), 1000)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Error("webhook should not be called when WebhookSecret is empty")
	}
}

// TestDispatchAirbotixBilling_NoopWhenNilUsage verifies the nil-usage guard:
// if the upstream returned no token counts, don't dispatch.
func TestDispatchAirbotixBilling_NoopWhenNilUsage(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret)

	dispatchAirbotixBilling(c, testRelayInfo("req-nil-usage", "gpt-4o-mini"), nil, 0)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Error("webhook should not be called when usage is nil")
	}
}

// TestDispatchAirbotixBilling_RetriesOn5xx verifies that a 5xx response from
// the webhook server triggers a retry (3 attempts total per Dispatcher default).
// We use a server that always returns 500 and assert hit count > 1.
func TestDispatchAirbotixBilling_RetriesOn5xx(t *testing.T) {
	ws := newWebhookServer(t, http.StatusInternalServerError)
	c := billingTestCtx(ws.URL, testSecret)

	dispatchAirbotixBilling(c, testRelayInfo("req-retry", "gpt-4o-mini"), testUsage(50, 20), 100_000)

	// Dispatcher: 1 initial + MaxRetries(3) = 4 total attempts.
	// Backoff: 200ms + 400ms + 800ms ≈ 1.4s; allow 5s for CI headroom.
	if !ws.waitHits(4, 5*time.Second) {
		t.Errorf("expected 4 total attempts (1 initial + 3 retries), got %d", ws.hits.Load())
	}
}

// TestDispatchAirbotixBilling_NoRetryOn4xx verifies that a permanent 4xx
// (client error) stops immediately without retry.
func TestDispatchAirbotixBilling_NoRetryOn4xx(t *testing.T) {
	ws := newWebhookServer(t, http.StatusBadRequest)
	c := billingTestCtx(ws.URL, testSecret)

	dispatchAirbotixBilling(c, testRelayInfo("req-4xx", "gpt-4o-mini"), testUsage(50, 20), 100_000)

	time.Sleep(300 * time.Millisecond)
	if ws.hits.Load() != 1 {
		t.Errorf("expected exactly 1 attempt on 4xx, got %d", ws.hits.Load())
	}
}

// TestDispatchAirbotixBilling_XDeepRouterEventHeader verifies the event-type
// header that receivers can use to route without parsing the body.
func TestDispatchAirbotixBilling_XDeepRouterEventHeader(t *testing.T) {
	var eventHdr atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		eventHdr.Store(r.Header.Get("X-DeepRouter-Event"))
		io.Copy(io.Discard, r.Body) //nolint:errcheck
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(srv.Close)

	c := billingTestCtx(srv.URL, testSecret)
	dispatchAirbotixBilling(c, testRelayInfo("req-hdr", "gpt-4o-mini"), testUsage(10, 5), 5000)

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		if v := eventHdr.Load(); v != nil && v.(string) != "" {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	got, _ := eventHdr.Load().(string)
	if got != "request.completed" {
		t.Errorf("X-DeepRouter-Event: want %q, got %q", "request.completed", got)
	}
}

// TestDispatchAirbotixBilling_HMACIsDeterministic verifies that two calls with
// identical payload produce the same HMAC signature. This is a mathematical
// property of HMAC — same body + same secret → same digest. Receiver-side
// idempotency (charge once per request_id) is enforced by the billing receiver,
// not DeepRouter.
func TestDispatchAirbotixBilling_HMACIsDeterministic(t *testing.T) {
	var mu sync.Mutex
	var sigs []string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sig := r.Header.Get("X-DeepRouter-Signature")
		io.Copy(io.Discard, r.Body) //nolint:errcheck
		w.WriteHeader(http.StatusOK)
		mu.Lock()
		sigs = append(sigs, sig)
		mu.Unlock()
	}))
	t.Cleanup(srv.Close)

	for i := 0; i < 2; i++ {
		c := billingTestCtx(srv.URL, testSecret)
		dispatchAirbotixBilling(c, testRelayInfo("req-idem-001", "gpt-4o-mini"), testUsage(100, 50), 500_000)
	}

	// Hold the lock continuously once we confirm ≥2 hits, so there is no
	// TOCTOU window between the length check and the index reads.
	mu.Lock()
	deadline := time.Now().Add(2 * time.Second)
	for len(sigs) < 2 && time.Now().Before(deadline) {
		mu.Unlock()
		time.Sleep(10 * time.Millisecond)
		mu.Lock()
	}
	defer mu.Unlock()

	if len(sigs) < 2 {
		t.Fatalf("expected 2 webhook calls, got %d", len(sigs))
	}
	if sigs[0] != sigs[1] {
		t.Errorf("same payload must produce same HMAC; sig1=%q sig2=%q", sigs[0], sigs[1])
	}
}
