package service

// Tests for dispatchAirbotixBilling — DR-25 Phase 2 acceptance criteria.
//
// Coverage map:
//   Unit (this file):
//     - Happy path: correct payload fields, HMAC signature, timestamps
//     - Provider routing: OpenAI vs Anthropic channel types
//     - deeprouter-auto routing: RoutedFrom populated only for virtual model
//     - Ordinary alias: RoutedFrom NOT populated for non-auto aliases
//     - Guard conditions: nil usage, zero tokens, missing URL/secret, nil relayInfo
//     - Zero-price model: webhook fires even when quota==0 (token accounting)
//     - KidProfileID: propagated from X-Tenant-User header
//     - Retry behaviour: 5xx retries, 4xx permanent stop (via Dispatcher)
//     - Header: X-DeepRouter-Event present
//     - HMAC validity: each dispatch produces a verifiable signature
//
//   Integration (relay/airbotix_billing_relay_test.go):
//     - Full relay chain: DoResponse → PostTextConsumeQuota → dispatch
//     - Stream vs non-stream token aggregation paths
//
// Test infrastructure:
//   webhookServer:  httptest.Server that captures the last POST body + sig header
//   billingTestCtx: minimal *gin.Context with model.User pre-loaded
//   testRelayInfo:  minimal *relaycommon.RelayInfo for a given request
//   testUsage:      *dto.Usage helper

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

// ─── test infrastructure ─────────────────────────────────────────────────────

const testSecret = "test-hmac-secret-for-billing-test"

// webhookServer is a test HTTP server that captures the most-recent POST body,
// the X-DeepRouter-Signature header value, and a hit count for concurrency
// proofs. The response status code is configurable.
type webhookServer struct {
	*httptest.Server
	hits   atomic.Int64
	body   atomic.Value // stores []byte
	sigHdr atomic.Value // stores string
	status int          // HTTP response status (default 200)
}

// newWebhookServer creates a webhookServer that responds with the given status
// code and registers t.Cleanup to close it.
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

// waitHits polls until the server has received at least n requests or the
// deadline elapses. Returns true if the threshold was met.
// Using a poll rather than a fixed sleep keeps the suite fast on quick machines.
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

// verifyHMAC returns true when sig equals HMAC-SHA256(body, secret) as a
// lowercase hex string (no "sha256=" prefix, matching Send()'s format).
func verifyHMAC(body []byte, sig, secret string) bool {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return hmac.Equal([]byte(sig), []byte(hex.EncodeToString(mac.Sum(nil))))
}

// billingTestCtx constructs a minimal *gin.Context with a *model.User
// pre-loaded as ContextKeyAirbotixUser. Optionally sets the X-Tenant-User
// header when kidHeader is non-empty.
func billingTestCtx(webhookURL, secret, kidHeader string) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	if kidHeader != "" {
		c.Request.Header.Set("X-Tenant-User", kidHeader)
	}
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

// testRelayInfo builds a minimal RelayInfo for the given request ID, model
// name, and channel type. StartTime is set 2 s in the past to give non-empty
// StartedAt/FinishedAt with a measurable gap.
func testRelayInfo(reqID, modelName string, channelType int) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RequestId:       reqID,
		OriginModelName: modelName,
		StartTime:       time.Now().Add(-2 * time.Second),
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: channelType,
		},
	}
}

// testUsage constructs a dto.Usage with the given prompt and completion counts.
func testUsage(prompt, completion int) *dto.Usage {
	return &dto.Usage{
		PromptTokens:     prompt,
		CompletionTokens: completion,
		TotalTokens:      prompt + completion,
	}
}

// decodeEvent deserialises the last body captured by ws into a billing.Event.
func decodeEvent(t *testing.T, ws *webhookServer) billing.Event {
	t.Helper()
	var ev billing.Event
	if err := json.Unmarshal(ws.getBody(), &ev); err != nil {
		t.Fatalf("webhook body is not valid JSON: %v\nbody=%s", err, ws.getBody())
	}
	return ev
}

// ─── tests ────────────────────────────────────────────────────────────────────

// TestDispatchAirbotixBilling_SendsPayloadAndHMAC is the primary Phase-2
// acceptance test: a configured tenant request triggers a webhook POST whose
// body matches the billing.Event contract and whose X-DeepRouter-Signature
// header is a valid HMAC-SHA256.
func TestDispatchAirbotixBilling_SendsPayloadAndHMAC(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-kids-001", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(150, 80),
		500_000, // 500000 quota = $1.00 at default QuotaPerUnit
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook was not called within 2 s")
	}

	ev := decodeEvent(t, ws)

	// ── required identity fields ───────────────────────────────────────
	if ev.RequestID != "req-kids-001" {
		t.Errorf("RequestID: want %q, got %q", "req-kids-001", ev.RequestID)
	}
	if ev.TenantID != "airbotix-kids" {
		t.Errorf("TenantID: want %q, got %q", "airbotix-kids", ev.TenantID)
	}
	if ev.Model != "gpt-4o-mini" {
		t.Errorf("Model: want %q, got %q", "gpt-4o-mini", ev.Model)
	}

	// ── token counts ──────────────────────────────────────────────────
	if ev.PromptTokens != 150 {
		t.Errorf("PromptTokens: want 150, got %d", ev.PromptTokens)
	}
	if ev.CompletionTokens != 80 {
		t.Errorf("CompletionTokens: want 80, got %d", ev.CompletionTokens)
	}

	// ── cost ──────────────────────────────────────────────────────────
	if ev.CostUSD <= 0 {
		t.Errorf("CostUSD should be positive, got %f", ev.CostUSD)
	}

	// ── DR-25 required timestamps (replaced Timestamp) ────────────────
	if ev.StartedAt == "" {
		t.Error("StartedAt must not be empty")
	}
	if ev.FinishedAt == "" {
		t.Error("FinishedAt must not be empty")
	}

	// ── provider ──────────────────────────────────────────────────────
	// provider must be lowercase wire-format identifier (PRD §7.3)
	if ev.Provider != "openai" {
		t.Errorf("Provider: want %q (lowercase wire ID), got %q", "openai", ev.Provider)
	}

	// ── PolicyViolations must be present as empty array, not null ──────
	// Verify via raw JSON to catch null vs [] distinction.
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(ws.getBody(), &raw); err != nil {
		t.Fatalf("raw unmarshal failed: %v", err)
	}
	if pv, ok := raw["policy_violations"]; !ok || string(pv) == "null" {
		t.Errorf("policy_violations must be [] (not null or missing), got %s", pv)
	}

	// ── HMAC signature ────────────────────────────────────────────────
	sig := ws.getSig()
	if sig == "" {
		t.Fatal("X-DeepRouter-Signature header must be present and non-empty")
	}
	if !verifyHMAC(ws.getBody(), sig, testSecret) {
		t.Errorf("HMAC verification failed: sig=%q", sig)
	}
}

// TestDispatchAirbotixBilling_AnthropicPath verifies that the Provider field
// is correctly derived from an Anthropic channel type, not hardcoded.
func TestDispatchAirbotixBilling_AnthropicPath(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-claude-001", "claude-haiku-4-5", constant.ChannelTypeAnthropic),
		testUsage(200, 100),
		1000,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called for Anthropic path")
	}

	ev := decodeEvent(t, ws)
	if ev.Model != "claude-haiku-4-5" {
		t.Errorf("Model: want %q, got %q", "claude-haiku-4-5", ev.Model)
	}
	if ev.Provider != "anthropic" {
		t.Errorf("Provider: want %q (lowercase wire ID), got %q", "anthropic", ev.Provider)
	}
}

// TestDispatchAirbotixBilling_SmartRouterAutoModel is the DR-25 core acceptance
// test for deeprouter-auto routing. When ContextKeyAliasResolvedFrom is set to
// "deeprouter-auto", RoutedFrom must be populated and Model must be the
// concrete resolved model (not the virtual name).
func TestDispatchAirbotixBilling_SmartRouterAutoModel(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")
	// Simulate smart-router resolving deeprouter-auto → claude-haiku-4-5.
	common.SetContextKey(c, constant.ContextKeyAliasResolvedFrom, virtualModelAuto)

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-auto-001", "claude-haiku-4-5", constant.ChannelTypeAnthropic),
		testUsage(300, 150),
		600,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called for deeprouter-auto path")
	}

	ev := decodeEvent(t, ws)
	if ev.Model != "claude-haiku-4-5" {
		t.Errorf("Model: want concrete model %q, got %q", "claude-haiku-4-5", ev.Model)
	}
	if ev.RoutedFrom != virtualModelAuto {
		t.Errorf("RoutedFrom: want %q, got %q", virtualModelAuto, ev.RoutedFrom)
	}
}

// TestDispatchAirbotixBilling_OtherAliasNotRoutedFrom verifies that ordinary
// SimpleMode alias rewrites (set by distributor.go, e.g. "deeprouter-coding")
// do NOT populate RoutedFrom. Only the "deeprouter-auto" virtual model qualifies.
// This is the critical boundary preventing alias pollution of the RoutedFrom field.
func TestDispatchAirbotixBilling_OtherAliasNotRoutedFrom(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")
	// Simulate distributor.go resolving a SimpleMode alias (not deeprouter-auto).
	common.SetContextKey(c, constant.ContextKeyAliasResolvedFrom, "deeprouter-coding")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-alias-001", "claude-3-5-haiku", constant.ChannelTypeAnthropic),
		testUsage(100, 50),
		300,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}

	ev := decodeEvent(t, ws)
	if ev.RoutedFrom != "" {
		t.Errorf("RoutedFrom: want empty for non-auto alias, got %q", ev.RoutedFrom)
	}
}

// TestDispatchAirbotixBilling_KidProfileIDFromHeader verifies that the
// X-Tenant-User request header is propagated to event.KidProfileID.
func TestDispatchAirbotixBilling_KidProfileIDFromHeader(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "kid_abc123")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-kid-001", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(50, 20),
		200,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}

	ev := decodeEvent(t, ws)
	if ev.KidProfileID != "kid_abc123" {
		t.Errorf("KidProfileID: want %q, got %q", "kid_abc123", ev.KidProfileID)
	}
}

// TestDispatchAirbotixBilling_ZeroTokens_NoDispatch verifies that requests with
// zero prompt + completion tokens do NOT trigger the webhook (metered completion
// guard). This covers upstream timeouts or responses with no token usage.
func TestDispatchAirbotixBilling_ZeroTokens_NoDispatch(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-zero-tokens", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(0, 0), // zero tokens = not a metered completion
		0,
	)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Errorf("webhook must not fire when PromptTokens+CompletionTokens==0, got %d calls", ws.hits.Load())
	}
}

// TestDispatchAirbotixBilling_ZeroQuotaButRealUsage_StillDispatches verifies
// that zero-cost models (quota==0) still trigger the webhook when token counts
// are non-zero. The receiver needs token accounting data even when cost is $0.
func TestDispatchAirbotixBilling_ZeroQuotaButRealUsage_StillDispatches(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-free-model", "free-llm", constant.ChannelTypeOpenAI),
		testUsage(1200, 480), // real usage
		0,                   // quota == 0: zero-cost model
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook must fire for zero-cost model with real token usage")
	}

	ev := decodeEvent(t, ws)
	if ev.CostUSD != 0 {
		t.Errorf("CostUSD: want 0 for zero-quota model, got %f", ev.CostUSD)
	}
	if ev.PromptTokens != 1200 || ev.CompletionTokens != 480 {
		t.Errorf("token counts: want 1200/480, got %d/%d", ev.PromptTokens, ev.CompletionTokens)
	}
}

// ── no-op guard tests ─────────────────────────────────────────────────────────

// TestDispatchAirbotixBilling_NoopWhenNoUser verifies that the function is a
// no-op when ContextKeyAirbotixUser is absent (non-Airbotix request path).
func TestDispatchAirbotixBilling_NoopWhenNoUser(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	// Deliberately NOT setting ContextKeyAirbotixUser.

	dispatchAirbotixBilling(c, testRelayInfo("req-noop", "gpt-4o-mini", constant.ChannelTypeOpenAI), testUsage(10, 5), 1000)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Error("webhook must not be called when user is absent from context")
	}
}

// TestDispatchAirbotixBilling_NoopWhenEmptyURL verifies no webhook call when
// the tenant has BillingWebhookURL == "".
func TestDispatchAirbotixBilling_NoopWhenEmptyURL(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx("", testSecret, "") // empty URL

	dispatchAirbotixBilling(c, testRelayInfo("req-empty-url", "gpt-4o-mini", constant.ChannelTypeOpenAI), testUsage(10, 5), 1000)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Error("webhook must not be called when BillingWebhookURL is empty")
	}
}

// TestDispatchAirbotixBilling_NoopWhenEmptySecret verifies that a blank
// WebhookSecret prevents dispatch (a trivially guessable HMAC key).
func TestDispatchAirbotixBilling_NoopWhenEmptySecret(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, "", "") // empty secret

	dispatchAirbotixBilling(c, testRelayInfo("req-no-secret", "gpt-4o-mini", constant.ChannelTypeOpenAI), testUsage(10, 5), 1000)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Error("webhook must not be called when WebhookSecret is empty")
	}
}

// TestDispatchAirbotixBilling_NoopWhenWhitespaceSecret verifies that a
// whitespace-only secret is rejected (would produce a guessable HMAC key).
func TestDispatchAirbotixBilling_NoopWhenWhitespaceSecret(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, "   ", "") // whitespace-only

	dispatchAirbotixBilling(c, testRelayInfo("req-ws-secret", "gpt-4o-mini", constant.ChannelTypeOpenAI), testUsage(10, 5), 1000)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Error("webhook must not be called when WebhookSecret is whitespace-only")
	}
}

// TestDispatchAirbotixBilling_NoopWhenNilUsage verifies the nil-usage guard:
// upstream returned no token counts, so dispatch must be skipped.
func TestDispatchAirbotixBilling_NoopWhenNilUsage(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(c, testRelayInfo("req-nil-usage", "gpt-4o-mini", constant.ChannelTypeOpenAI), nil, 0)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Error("webhook must not be called when usage is nil")
	}
}

// TestDispatchAirbotixBilling_NoopWhenNilRelayInfo verifies that a nil
// relayInfo is handled gracefully (no panic, no dispatch).
func TestDispatchAirbotixBilling_NoopWhenNilRelayInfo(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(c, nil, testUsage(100, 50), 1000)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Error("webhook must not be called when relayInfo is nil")
	}
}

// ── retry / header tests ──────────────────────────────────────────────────────

// TestDispatchAirbotixBilling_RetriesOn5xx verifies that a 5xx response from
// the webhook server triggers retries (3 additional attempts per Dispatcher
// default). We use a server that always returns 500 and assert hit count >= 4.
func TestDispatchAirbotixBilling_RetriesOn5xx(t *testing.T) {
	ws := newWebhookServer(t, http.StatusInternalServerError)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(c, testRelayInfo("req-retry", "gpt-4o-mini", constant.ChannelTypeOpenAI), testUsage(50, 20), 100_000)

	// Dispatcher: 1 initial + MaxRetries(3) = 4 total attempts.
	// Backoff: 200 ms + 400 ms + 800 ms ≈ 1.4 s; allow 5 s for CI headroom.
	if !ws.waitHits(4, 5*time.Second) {
		t.Errorf("expected 4 total attempts (1 initial + 3 retries), got %d", ws.hits.Load())
	}
}

// TestDispatchAirbotixBilling_NoRetryOn4xx verifies that a permanent 4xx
// (client error) stops dispatch immediately without retry.
func TestDispatchAirbotixBilling_NoRetryOn4xx(t *testing.T) {
	ws := newWebhookServer(t, http.StatusBadRequest)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(c, testRelayInfo("req-4xx", "gpt-4o-mini", constant.ChannelTypeOpenAI), testUsage(50, 20), 100_000)

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

	c := billingTestCtx(srv.URL, testSecret, "")
	dispatchAirbotixBilling(c, testRelayInfo("req-hdr", "gpt-4o-mini", constant.ChannelTypeOpenAI), testUsage(10, 5), 5000)

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

// TestDispatchAirbotixBilling_SignaturesAreValid verifies that each independent
// dispatch produces a well-formed, verifiable HMAC-SHA256 signature.
// HMAC determinism (same body → same digest) is a mathematical property tested
// at the leaf-package level (billing.TestSignPayload_StableAndVerifiable).
// Asserting sig1==sig2 here would be a flaky test: dispatchAirbotixBilling
// stamps a fresh FinishedAt on every call, so RFC3339 timestamps differ whenever
// two calls straddle a second boundary.
func TestDispatchAirbotixBilling_SignaturesAreValid(t *testing.T) {
	var mu sync.Mutex
	type capture struct {
		body []byte
		sig  string
	}
	var calls []capture

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		sig := r.Header.Get("X-DeepRouter-Signature")
		w.WriteHeader(http.StatusOK)
		mu.Lock()
		calls = append(calls, capture{b, sig})
		mu.Unlock()
	}))
	t.Cleanup(srv.Close)

	for i := 0; i < 2; i++ {
		c := billingTestCtx(srv.URL, testSecret, "")
		dispatchAirbotixBilling(
			c,
			testRelayInfo("req-idem-001", "gpt-4o-mini", constant.ChannelTypeOpenAI),
			testUsage(100, 50),
			500_000,
		)
	}

	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) {
		mu.Lock()
		n := len(calls)
		mu.Unlock()
		if n >= 2 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	mu.Lock()
	defer mu.Unlock()

	if len(calls) < 2 {
		t.Fatalf("expected 2 webhook calls, got %d", len(calls))
	}
	for i, entry := range calls {
		if !verifyHMAC(entry.body, entry.sig, testSecret) {
			t.Errorf("call %d: HMAC verification failed: sig=%q", i+1, entry.sig)
		}
	}
}
