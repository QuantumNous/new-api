// Additional coverage tests for service/airbotix_billing.go.
//
// Gaps filled (relative to airbotix_billing_test.go):
//   Guard 1 — ChannelMeta nil → no-op
//   Timestamps — RFC3339 UTC format, FinishedAt > StartedAt
//   V0 invariants — image_count=0, stars absent, family_id/product_line absent
//   policy_violations — non-nil empty slice at the dispatch layer
//   Token guards — prompt-only and completion-only both dispatch
//   KidProfileID — trimmed but non-empty value preserved correctly
//   Wire payload completeness — all required fields present
//   Idempotency key — RequestID propagated from relayInfo.RequestId
//   Concurrency — concurrent dispatches do not race
//   404 receiver — permanent error, exactly 1 attempt
//   Absent X-Tenant-User header — kid_profile_id omitted
package service

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// ── Guard 1: ChannelMeta nil ─────────────────────────────────────────────────

// TestDispatchAirbotixBilling_NoopWhenChannelMetaNil verifies Guard 1:
// when relayInfo.ChannelMeta is nil the function returns immediately without
// dispatching. ChannelMeta is needed to derive Provider; nil would panic.
func TestDispatchAirbotixBilling_NoopWhenChannelMetaNil(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	riNilMeta := &relaycommon.RelayInfo{
		RequestId:       "req-nil-meta",
		OriginModelName: "gpt-4o-mini",
		StartTime:       time.Now().Add(-1 * time.Second),
		ChannelMeta:     nil,
	}

	dispatchAirbotixBilling(c, riNilMeta, testUsage(50, 20), 1000)

	time.Sleep(100 * time.Millisecond)
	if ws.hits.Load() != 0 {
		t.Error("webhook must not be called when ChannelMeta is nil")
	}
}

// ── Timestamp correctness ─────────────────────────────────────────────────────

// TestDispatchAirbotixBilling_TimestampsAreRFC3339UTC verifies that StartedAt
// and FinishedAt in the wire payload are valid RFC3339 UTC strings ending in "Z".
// PRD §7.3 requires all timestamps to be RFC3339 UTC.
func TestDispatchAirbotixBilling_TimestampsAreRFC3339UTC(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-ts-fmt", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(100, 50),
		1000,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}

	ev := decodeEvent(t, ws)

	for _, tc := range []struct{ name, val string }{
		{"StartedAt", ev.StartedAt},
		{"FinishedAt", ev.FinishedAt},
	} {
		if tc.val == "" {
			t.Errorf("%s must not be empty", tc.name)
			continue
		}
		parsed, err := time.Parse(time.RFC3339, tc.val)
		if err != nil {
			t.Errorf("%s=%q is not valid RFC3339: %v", tc.name, tc.val, err)
			continue
		}
		if parsed.Location() != time.UTC {
			t.Errorf("%s=%q must be UTC, got location %v", tc.name, tc.val, parsed.Location())
		}
		if !strings.HasSuffix(tc.val, "Z") {
			t.Errorf("%s=%q must use 'Z' suffix for UTC, not +00:00 notation", tc.name, tc.val)
		}
	}
}

// TestDispatchAirbotixBilling_FinishedAtAfterStartedAt verifies that
// FinishedAt is chronologically after StartedAt. testRelayInfo sets StartTime
// 2 s in the past, so the gap is always measurable.
func TestDispatchAirbotixBilling_FinishedAtAfterStartedAt(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-ts-order", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(100, 50),
		1000,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}

	ev := decodeEvent(t, ws)
	started, err1 := time.Parse(time.RFC3339, ev.StartedAt)
	finished, err2 := time.Parse(time.RFC3339, ev.FinishedAt)
	if err1 != nil || err2 != nil {
		t.Fatalf("timestamp parse errors: started=%v finished=%v", err1, err2)
	}
	if !finished.After(started) {
		t.Errorf("FinishedAt (%s) must be after StartedAt (%s)", ev.FinishedAt, ev.StartedAt)
	}
}

// ── V0 wire invariants ────────────────────────────────────────────────────────

// TestDispatchAirbotixBilling_ImageCountAlwaysZero verifies image_count is 0
// in V0 and is always present in the JSON (no omitempty on that field).
func TestDispatchAirbotixBilling_ImageCountAlwaysZero(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-imgcount", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(80, 40),
		500,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(ws.getBody(), &raw); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	imgRaw, ok := raw["image_count"]
	if !ok {
		t.Fatal("image_count must always be present in JSON (no omitempty)")
	}
	var imgCount int
	if err := json.Unmarshal(imgRaw, &imgCount); err != nil {
		t.Fatalf("image_count is not a number: %v", err)
	}
	if imgCount != 0 {
		t.Errorf("image_count: want 0 in V0, got %d", imgCount)
	}
}

// TestDispatchAirbotixBilling_StarsAbsentFromWirePayload verifies the stars
// field is absent from V0 wire payload (omitempty + always 0).
func TestDispatchAirbotixBilling_StarsAbsentFromWirePayload(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-stars", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(80, 40),
		500,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(ws.getBody(), &raw); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if _, ok := raw["stars"]; ok {
		t.Error("stars must be absent from wire payload in V0 (omitempty)")
	}
}

// TestDispatchAirbotixBilling_FamilyIDProductLineAbsent verifies V1-reserved
// fields family_id and product_line are absent from V0 wire payload.
func TestDispatchAirbotixBilling_FamilyIDProductLineAbsent(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-reserved", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(80, 40),
		500,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(ws.getBody(), &raw); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	for _, field := range []string{"family_id", "product_line"} {
		if _, ok := raw[field]; ok {
			t.Errorf("%s must be absent from V0 wire payload (V1 reserved, always empty)", field)
		}
	}
}

// TestDispatchAirbotixBilling_PolicyViolationsNonNilEmptyArray verifies that
// policy_violations is [] (not null) at the full dispatch layer. The
// orchestration code must set PolicyViolations = []string{}, never nil.
func TestDispatchAirbotixBilling_PolicyViolationsNonNilEmptyArray(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-pv", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(80, 40),
		500,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(ws.getBody(), &raw); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	pv, ok := raw["policy_violations"]
	if !ok {
		t.Fatal("policy_violations must be present in JSON")
	}
	if string(pv) == "null" {
		t.Error("policy_violations must be [] (non-nil empty array), got null")
	}
	if string(pv) != "[]" {
		t.Errorf("policy_violations: want [], got %s", pv)
	}
}

// ── Token guard boundary conditions ──────────────────────────────────────────

// TestDispatchAirbotixBilling_PromptOnlyTokensDispatches verifies that a
// request with prompt tokens but zero completion tokens still fires the webhook.
// Guard 2 is PromptTokens+CompletionTokens > 0, not both non-zero.
func TestDispatchAirbotixBilling_PromptOnlyTokensDispatches(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-prompt-only", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(200, 0),
		800,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook must fire when PromptTokens>0 even if CompletionTokens==0")
	}
	ev := decodeEvent(t, ws)
	if ev.PromptTokens != 200 || ev.CompletionTokens != 0 {
		t.Errorf("tokens: want 200/0, got %d/%d", ev.PromptTokens, ev.CompletionTokens)
	}
}

// TestDispatchAirbotixBilling_CompletionOnlyTokensDispatches verifies that a
// request with completion tokens but zero prompt tokens still fires the webhook.
func TestDispatchAirbotixBilling_CompletionOnlyTokensDispatches(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-completion-only", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(0, 150),
		600,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook must fire when CompletionTokens>0 even if PromptTokens==0")
	}
	ev := decodeEvent(t, ws)
	if ev.PromptTokens != 0 || ev.CompletionTokens != 150 {
		t.Errorf("tokens: want 0/150, got %d/%d", ev.PromptTokens, ev.CompletionTokens)
	}
}

// ── KidProfileID — padded but non-empty ──────────────────────────────────────

// TestDispatchAirbotixBilling_KidProfileIDTrimmedPreservesContent verifies
// that a KidProfileID with surrounding whitespace is trimmed but its content
// is preserved in the wire payload.
func TestDispatchAirbotixBilling_KidProfileIDTrimmedPreservesContent(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "  kid-abc-456  ")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-kid-trim", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(50, 20),
		200,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}
	ev := decodeEvent(t, ws)
	if ev.KidProfileID != "kid-abc-456" {
		t.Errorf("KidProfileID: want %q (trimmed), got %q", "kid-abc-456", ev.KidProfileID)
	}
}

// ── Wire payload completeness ─────────────────────────────────────────────────

// TestDispatchAirbotixBilling_AllRequiredFieldsPresentInWirePayload verifies
// that every non-omitempty field in billing.Event appears in the JSON payload.
func TestDispatchAirbotixBilling_AllRequiredFieldsPresentInWirePayload(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-complete", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(120, 60),
		5000,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(ws.getBody(), &raw); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}

	required := []string{
		"request_id", "tenant_id", "provider", "model",
		"prompt_tokens", "completion_tokens", "image_count",
		"cost_usd", "policy_violations", "started_at", "finished_at",
	}
	for _, field := range required {
		if _, ok := raw[field]; !ok {
			t.Errorf("required field %q missing from wire payload", field)
		}
	}
}

// ── RequestID propagation ─────────────────────────────────────────────────────

// TestDispatchAirbotixBilling_RequestIDMatchesRelayInfo verifies that the
// RequestID in the wire payload equals relayInfo.RequestId exactly.
// This is the idempotency key; incorrect propagation breaks receiver dedup.
func TestDispatchAirbotixBilling_RequestIDMatchesRelayInfo(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "")
	const wantID = "idempotency-key-xyz-9876"

	dispatchAirbotixBilling(
		c,
		testRelayInfo(wantID, "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(100, 50),
		1000,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}
	ev := decodeEvent(t, ws)
	if ev.RequestID != wantID {
		t.Errorf("RequestID: want %q, got %q", wantID, ev.RequestID)
	}
}

// ── Concurrent dispatch safety ────────────────────────────────────────────────

// TestDispatchAirbotixBilling_ConcurrentDispatchesDoNotRace verifies that
// concurrent dispatchAirbotixBilling calls do not race on shared state.
// Run with -race to catch data races.
func TestDispatchAirbotixBilling_ConcurrentDispatchesDoNotRace(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	const n = 5
	done := make(chan struct{}, n)

	for i := 0; i < n; i++ {
		i := i
		go func() {
			defer func() { done <- struct{}{} }()
			c := billingTestCtx(ws.URL, testSecret, "")
			dispatchAirbotixBilling(
				c,
				testRelayInfo("req-concurrent-"+string(rune('0'+i)), "gpt-4o-mini", constant.ChannelTypeOpenAI),
				testUsage(100, 50),
				1000,
			)
		}()
	}
	for i := 0; i < n; i++ {
		<-done
	}
	if !ws.waitHits(int64(n), 5*time.Second) {
		t.Errorf("expected %d webhook calls from concurrent dispatches, got %d", n, ws.hits.Load())
	}
}

// ── 404 receiver — permanent error ───────────────────────────────────────────

// TestDispatchAirbotixBilling_404ReceiverDoesNotRetry verifies that a 404
// from the webhook receiver is treated as a permanent error: exactly 1 HTTP
// attempt, then the goroutine logs a warning and exits.
func TestDispatchAirbotixBilling_404ReceiverDoesNotRetry(t *testing.T) {
	ws := newWebhookServer(t, http.StatusNotFound)
	c := billingTestCtx(ws.URL, testSecret, "")

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-404", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(100, 50),
		1000,
	)

	time.Sleep(300 * time.Millisecond)
	if got := ws.hits.Load(); got != 1 {
		t.Errorf("expected exactly 1 attempt on 404, got %d", got)
	}
}

// ── Absent X-Tenant-User header ───────────────────────────────────────────────

// TestDispatchAirbotixBilling_AbsentHeaderOmitsKidProfileID verifies that when
// X-Tenant-User header is entirely absent, kid_profile_id is omitted from the
// wire payload. billingTestCtx("", "") does not set the header.
func TestDispatchAirbotixBilling_AbsentHeaderOmitsKidProfileID(t *testing.T) {
	ws := newWebhookServer(t, http.StatusOK)
	c := billingTestCtx(ws.URL, testSecret, "") // no X-Tenant-User header

	dispatchAirbotixBilling(
		c,
		testRelayInfo("req-no-kid-hdr", "gpt-4o-mini", constant.ChannelTypeOpenAI),
		testUsage(80, 40),
		500,
	)

	if !ws.waitHits(1, 2*time.Second) {
		t.Fatal("webhook not called")
	}

	var raw map[string]json.RawMessage
	if err := json.Unmarshal(ws.getBody(), &raw); err != nil {
		t.Fatalf("invalid JSON: %v", err)
	}
	if _, ok := raw["kid_profile_id"]; ok {
		t.Error("kid_profile_id must be absent when X-Tenant-User header is not set")
	}
}
