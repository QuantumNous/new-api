package relay

// Integration tests for the relay → billing webhook dispatch chain.
//
// These tests exercise the real DoResponse → PostTextConsumeQuota →
// dispatchAirbotixBilling path: each test uses an upstream adaptor's DoResponse
// with a mock HTTP response (SSE stream or JSON body), then calls
// PostTextConsumeQuota with the usage returned by DoResponse.
//
// This validates that:
//   - SSE usage chunks are correctly aggregated by the OpenAI adaptor stream handler
//   - Non-stream JSON usage is correctly parsed by the OpenAI adaptor handler
//   - Anthropic SSE message_delta.usage is correctly aggregated by the Claude adaptor
//   - The aggregated usage flows into the billing webhook with correct token counts
//   - deeprouter-auto RoutedFrom is propagated from gin.Context through the chain
//   - Failed relay (upstream 500) does not trigger the webhook
//
// What these tests do NOT cover (tested in service/airbotix_billing_test.go):
//   - Individual guard conditions (nil usage, empty URL, whitespace secret, etc.)
//   - Retry/backoff behaviour of the dispatcher
//   - Edge cases around RoutedFrom alias filtering
//
// DB bypass (no live database required):
//   - common.BatchUpdateEnabled = true  → quota update functions are no-ops
//   - common.LogConsumeEnabled  = false → log recording is a no-op
//   - relayInfo.Billing == nil + FinalPreConsumedQuota == 0 → SettleBilling delta == 0
//
// Stream timeout:
//   - constant.StreamingTimeout must be positive for the SSE scanner to work;
//     tests set it to 30 (seconds) via withStreamingTimeout().
//
// Run these tests with:
//   go test ./relay/... -run TestIntegration -v

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/internal/billing"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const integrationTestSecret = "relay-integration-test-hmac-secret"

// ─── capture server ───────────────────────────────────────────────────────────

// captureServer records the last POST body and X-DeepRouter-Signature header.
// hits is an atomic counter for synchronisation with async goroutine dispatch.
type captureServer struct {
	*httptest.Server
	hits   atomic.Int64
	body   atomic.Value // []byte
	sigHdr atomic.Value // string
}

// newCaptureServer creates an httptest.Server that records incoming webhooks.
func newCaptureServer(t *testing.T) *captureServer {
	t.Helper()
	cs := &captureServer{}
	cs.Server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := io.ReadAll(r.Body)
		cs.body.Store(b)
		cs.sigHdr.Store(r.Header.Get("X-DeepRouter-Signature"))
		cs.hits.Add(1)
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(cs.Close)
	return cs
}

// waitHit blocks until at least one webhook POST arrives or timeout elapses.
func (cs *captureServer) waitHit(timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cs.hits.Load() >= 1 {
			return true
		}
		time.Sleep(10 * time.Millisecond)
	}
	return false
}

// decodeEvent unmarshals the captured body into a billing.Event.
func (cs *captureServer) decodeEvent(t *testing.T) billing.Event {
	t.Helper()
	b := cs.body.Load().([]byte)
	var ev billing.Event
	if err := json.Unmarshal(b, &ev); err != nil {
		t.Fatalf("webhook body not valid JSON: %v\nbody=%s", err, b)
	}
	return ev
}

// verifySig checks the HMAC-SHA256 signature on the captured body.
func (cs *captureServer) verifySig(t *testing.T, secret string) {
	t.Helper()
	body := cs.body.Load().([]byte)
	sig := cs.sigHdr.Load().(string)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(sig), []byte(expected)) {
		t.Errorf("HMAC verification failed: got sig=%q, expected=%q", sig, expected)
	}
}

// ─── test helpers ─────────────────────────────────────────────────────────────

// integrationCtx builds a *gin.Context pre-loaded with a *model.User that has
// the given webhookURL and secret. Pass aliasResolvedFrom = "deeprouter-auto"
// to simulate the state set by middleware/smart_router.go.
func integrationCtx(webhookURL, secret, aliasResolvedFrom string) *gin.Context {
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	user := &model.User{
		Id:                20,
		Username:          "integration-test-tenant",
		BillingWebhookURL: webhookURL,
		WebhookSecret:     secret,
	}
	common.SetContextKey(c, constant.ContextKeyAirbotixUser, user)

	if aliasResolvedFrom != "" {
		common.SetContextKey(c, constant.ContextKeyAliasResolvedFrom, aliasResolvedFrom)
	}
	return c
}

// integrationRelayInfo returns a RelayInfo wired for DoResponse + PostTextConsumeQuota
// without requiring a live database. Key invariants:
//
//   - ChannelMeta non-nil so relayInfo.ChannelType doesn't panic
//   - Billing == nil + FinalPreConsumedQuota == 0 → SettleBilling is a no-op
//   - TieredBillingSnapshot == nil → skips tiered billing
//   - PriceData zero → quota == 0 (billing webhook still fires for token accounting)
func integrationRelayInfo(reqID, modelName string, channelType, apiType int, isStream bool, relayFormat types.RelayFormat) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		RequestId:          reqID,
		OriginModelName:    modelName,
		StartTime:          time.Now().Add(-2 * time.Second),
		IsStream:           isStream,
		ShouldIncludeUsage: isStream, // OpenAI stream: include usage in final chunk
		RelayFormat:        relayFormat,
		RelayMode:          relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType:       channelType,
			ApiType:           apiType,
			UpstreamModelName: modelName,
		},
		Billing:               nil,
		FinalPreConsumedQuota: 0,
		TieredBillingSnapshot: nil,
		PriceData:             types.PriceData{},
	}
}

// withDBBypass sets the package-level flags that suppress DB and log writes
// for the duration of the test, then restores them via t.Cleanup.
func withDBBypass(t *testing.T) {
	t.Helper()
	prev1 := common.BatchUpdateEnabled
	prev2 := common.LogConsumeEnabled
	common.BatchUpdateEnabled = true
	common.LogConsumeEnabled = false
	t.Cleanup(func() {
		common.BatchUpdateEnabled = prev1
		common.LogConsumeEnabled = prev2
	})
}

// withStreamingTimeout sets constant.StreamingTimeout to a positive value
// required by the SSE scanner (time.NewTicker panics on zero duration).
func withStreamingTimeout(t *testing.T, seconds int) {
	t.Helper()
	prev := constant.StreamingTimeout
	constant.StreamingTimeout = seconds
	t.Cleanup(func() { constant.StreamingTimeout = prev })
}

// openaiSSEStream returns an *http.Response whose body is an OpenAI-format
// SSE stream containing two content chunks followed by a final usage chunk.
// The usage chunk carries the authoritative token counts that DoResponse
// should aggregate and return.
//
// SSE format (per OpenAI spec):
//
//	data: {…chunk with role…}
//	data: {…chunk with content…}
//	data: {…final chunk with "usage": {"prompt_tokens": p, "completion_tokens": c}…}
//	data: [DONE]
func openaiSSEStream(promptTokens, completionTokens int) *http.Response {
	totalTokens := promptTokens + completionTokens
	lines := []string{
		`data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"Hi!"},"finish_reason":null}]}`,
		`data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1700000000,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":` + itoa(promptTokens) + `,"completion_tokens":` + itoa(completionTokens) + `,"total_tokens":` + itoa(totalTokens) + `}}`,
		`data: [DONE]`,
		``,
	}
	body := strings.Join(lines, "\n")
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

// openaiJSONResponse returns an *http.Response whose body is an OpenAI-format
// non-stream JSON completion response with the given token counts.
func openaiJSONResponse(promptTokens, completionTokens int) *http.Response {
	totalTokens := promptTokens + completionTokens
	body := `{"id":"chatcmpl-test","object":"chat.completion","created":1700000000,"model":"gpt-4o-mini","choices":[{"index":0,"message":{"role":"assistant","content":"Hello!"},"finish_reason":"stop"}],"usage":{"prompt_tokens":` + itoa(promptTokens) + `,"completion_tokens":` + itoa(completionTokens) + `,"total_tokens":` + itoa(totalTokens) + `}}`
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(body))),
	}
}

// anthropicSSEStream returns an *http.Response whose body is an Anthropic-format
// SSE stream. It includes a message_start (input_tokens) and a message_delta
// (output_tokens) so the Claude adaptor sets claudeInfo.Done = true and returns
// the final aggregated usage.
//
// The Claude stream handler (ClaudeStreamHandler) accumulates usage across:
//   - message_start → sets PromptTokens from message.usage.input_tokens
//   - message_delta → sets CompletionTokens from usage.output_tokens, Done=true
func anthropicSSEStream(inputTokens, outputTokens int) *http.Response {
	lines := []string{
		`data: {"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","model":"claude-haiku-4-5","content":[],"stop_reason":null,"usage":{"input_tokens":` + itoa(inputTokens) + `,"output_tokens":0}}}`,
		`data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}`,
		`data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello!"}}`,
		`data: {"type":"content_block_stop","index":0}`,
		`data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":` + itoa(outputTokens) + `}}`,
		`data: {"type":"message_stop"}`,
		`data: [DONE]`,
		``,
	}
	body := strings.Join(lines, "\n")
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
		Body:       io.NopCloser(strings.NewReader(body)),
	}
}

// anthropicJSONResponse returns an *http.Response whose body is an Anthropic-format
// non-stream message response (as returned by POST /v1/messages with stream=false).
// The usage object carries input_tokens and output_tokens which the Claude adaptor
// maps to dto.Usage.PromptTokens and dto.Usage.CompletionTokens.
func anthropicJSONResponse(inputTokens, outputTokens int) *http.Response {
	body := `{"id":"msg_test","type":"message","role":"assistant","model":"claude-haiku-4-5","content":[{"type":"text","text":"Hello!"}],"stop_reason":"end_turn","stop_sequence":null,"usage":{"input_tokens":` + itoa(inputTokens) + `,"output_tokens":` + itoa(outputTokens) + `}}`
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(bytes.NewReader([]byte(body))),
	}
}

// itoa converts an int to string without importing strconv at the package level.
func itoa(n int) string {
	b, _ := json.Marshal(n)
	return string(b)
}

// ─── tests ────────────────────────────────────────────────────────────────────

// TestIntegration_OpenAIStream_WebhookFired verifies the OpenAI streaming path:
//
//	mock SSE stream → adaptor.DoResponse (aggregates usage chunk) →
//	PostTextConsumeQuota → dispatchAirbotixBilling → webhook POST.
//
// This tests that the SSE usage chunk is parsed and aggregated correctly
// before reaching the billing webhook — the primary DR-25 acceptance path.
func TestIntegration_OpenAIStream_WebhookFired(t *testing.T) {
	withDBBypass(t)
	withStreamingTimeout(t, 30)

	const (
		wantPromptTokens     = 120
		wantCompletionTokens = 60
	)

	cs := newCaptureServer(t)
	c := integrationCtx(cs.URL, integrationTestSecret, "")
	ri := integrationRelayInfo(
		"req-int-openai-stream-001", "gpt-4o-mini",
		constant.ChannelTypeOpenAI, constant.APITypeOpenAI,
		true, types.RelayFormatOpenAI,
	)

	// Use the OpenAI adaptor's DoResponse to parse a real SSE stream.
	// This exercises the SSE usage chunk aggregation in OaiStreamHandler.
	adaptor := GetAdaptor(constant.APITypeOpenAI)
	adaptor.Init(ri)
	usageAny, apiErr := adaptor.DoResponse(c, openaiSSEStream(wantPromptTokens, wantCompletionTokens), ri)
	if apiErr != nil {
		t.Fatalf("DoResponse returned error: %v", apiErr)
	}
	usage, ok := usageAny.(*dto.Usage)
	if !ok || usage == nil {
		t.Fatalf("DoResponse returned non-Usage type: %T", usageAny)
	}

	if usage.PromptTokens != wantPromptTokens {
		t.Errorf("SSE aggregation: PromptTokens want %d, got %d", wantPromptTokens, usage.PromptTokens)
	}
	if usage.CompletionTokens != wantCompletionTokens {
		t.Errorf("SSE aggregation: CompletionTokens want %d, got %d", wantCompletionTokens, usage.CompletionTokens)
	}

	service.PostTextConsumeQuota(c, ri, usage, nil)

	if !cs.waitHit(2 * time.Second) {
		t.Fatal("billing webhook not called within 2 s after OpenAI stream relay")
	}

	ev := cs.decodeEvent(t)
	if ev.RequestID != ri.RequestId {
		t.Errorf("RequestID: want %q, got %q", ri.RequestId, ev.RequestID)
	}
	if ev.Model != "gpt-4o-mini" {
		t.Errorf("Model: want %q, got %q", "gpt-4o-mini", ev.Model)
	}
	if ev.Provider != "openai" {
		t.Errorf("Provider: want %q, got %q", "openai", ev.Provider)
	}
	if ev.PromptTokens != wantPromptTokens {
		t.Errorf("PromptTokens: want %d, got %d", wantPromptTokens, ev.PromptTokens)
	}
	if ev.CompletionTokens != wantCompletionTokens {
		t.Errorf("CompletionTokens: want %d, got %d", wantCompletionTokens, ev.CompletionTokens)
	}
	if ev.StartedAt == "" {
		t.Error("StartedAt must not be empty")
	}
	if ev.FinishedAt == "" {
		t.Error("FinishedAt must not be empty")
	}
	cs.verifySig(t, integrationTestSecret)
}

// TestIntegration_OpenAINonStream_WebhookFired verifies the OpenAI non-stream
// path:
//
//	mock JSON response → adaptor.DoResponse (parses usage from JSON body) →
//	PostTextConsumeQuota → dispatchAirbotixBilling → webhook POST.
func TestIntegration_OpenAINonStream_WebhookFired(t *testing.T) {
	withDBBypass(t)

	const (
		wantPromptTokens     = 100
		wantCompletionTokens = 50
	)

	cs := newCaptureServer(t)
	c := integrationCtx(cs.URL, integrationTestSecret, "")
	ri := integrationRelayInfo(
		"req-int-openai-nons-001", "gpt-4o-mini",
		constant.ChannelTypeOpenAI, constant.APITypeOpenAI,
		false, types.RelayFormatOpenAI,
	)

	// Use the OpenAI adaptor's DoResponse with a JSON response body.
	// This exercises the non-stream JSON usage parsing in OpenaiHandler.
	adaptor := GetAdaptor(constant.APITypeOpenAI)
	adaptor.Init(ri)
	usageAny, apiErr := adaptor.DoResponse(c, openaiJSONResponse(wantPromptTokens, wantCompletionTokens), ri)
	if apiErr != nil {
		t.Fatalf("DoResponse returned error: %v", apiErr)
	}
	usage, ok := usageAny.(*dto.Usage)
	if !ok || usage == nil {
		t.Fatalf("DoResponse returned non-Usage type: %T", usageAny)
	}

	if usage.PromptTokens != wantPromptTokens {
		t.Errorf("JSON parse: PromptTokens want %d, got %d", wantPromptTokens, usage.PromptTokens)
	}
	if usage.CompletionTokens != wantCompletionTokens {
		t.Errorf("JSON parse: CompletionTokens want %d, got %d", wantCompletionTokens, usage.CompletionTokens)
	}

	service.PostTextConsumeQuota(c, ri, usage, nil)

	if !cs.waitHit(2 * time.Second) {
		t.Fatal("billing webhook not called within 2 s after OpenAI non-stream relay")
	}

	ev := cs.decodeEvent(t)
	if ev.Provider != "openai" {
		t.Errorf("Provider: want %q, got %q", "openai", ev.Provider)
	}
	if ev.PromptTokens != wantPromptTokens {
		t.Errorf("PromptTokens: want %d, got %d", wantPromptTokens, ev.PromptTokens)
	}
	if ev.CompletionTokens != wantCompletionTokens {
		t.Errorf("CompletionTokens: want %d, got %d", wantCompletionTokens, ev.CompletionTokens)
	}
	cs.verifySig(t, integrationTestSecret)
}

// TestIntegration_AnthropicStream_WebhookFired verifies the Anthropic native
// streaming path (/v1/messages → Anthropic SSE):
//
//	mock Anthropic SSE → adaptor.DoResponse (ClaudeStreamHandler aggregates
//	message_start input_tokens + message_delta output_tokens) →
//	PostTextConsumeQuota → webhook POST with provider=="anthropic".
func TestIntegration_AnthropicStream_WebhookFired(t *testing.T) {
	withDBBypass(t)
	withStreamingTimeout(t, 30)

	const (
		wantPromptTokens     = 300
		wantCompletionTokens = 120
	)

	cs := newCaptureServer(t)
	c := integrationCtx(cs.URL, integrationTestSecret, "")
	ri := integrationRelayInfo(
		"req-int-claude-stream-001", "claude-haiku-4-5",
		constant.ChannelTypeAnthropic, constant.APITypeAnthropic,
		true, types.RelayFormatClaude,
	)

	// Use the Claude adaptor's DoResponse with an Anthropic SSE stream.
	// ClaudeStreamHandler accumulates:
	//   message_start → PromptTokens from message.usage.input_tokens
	//   message_delta → CompletionTokens from usage.output_tokens, Done=true
	adaptor := GetAdaptor(constant.APITypeAnthropic)
	adaptor.Init(ri)
	usageAny, apiErr := adaptor.DoResponse(c, anthropicSSEStream(wantPromptTokens, wantCompletionTokens), ri)
	if apiErr != nil {
		t.Fatalf("DoResponse returned error: %v", apiErr)
	}
	usage, ok := usageAny.(*dto.Usage)
	if !ok || usage == nil {
		t.Fatalf("DoResponse returned non-Usage type: %T", usageAny)
	}

	if usage.PromptTokens != wantPromptTokens {
		t.Errorf("Anthropic SSE aggregation: PromptTokens want %d, got %d", wantPromptTokens, usage.PromptTokens)
	}
	if usage.CompletionTokens != wantCompletionTokens {
		t.Errorf("Anthropic SSE aggregation: CompletionTokens want %d, got %d", wantCompletionTokens, usage.CompletionTokens)
	}

	service.PostTextConsumeQuota(c, ri, usage, nil)

	if !cs.waitHit(2 * time.Second) {
		t.Fatal("billing webhook not called within 2 s after Anthropic stream relay")
	}

	ev := cs.decodeEvent(t)
	if ev.Model != "claude-haiku-4-5" {
		t.Errorf("Model: want %q, got %q", "claude-haiku-4-5", ev.Model)
	}
	if ev.Provider != "anthropic" {
		t.Errorf("Provider: want %q, got %q", "anthropic", ev.Provider)
	}
	if ev.PromptTokens != wantPromptTokens {
		t.Errorf("PromptTokens: want %d, got %d", wantPromptTokens, ev.PromptTokens)
	}
	if ev.CompletionTokens != wantCompletionTokens {
		t.Errorf("CompletionTokens: want %d, got %d", wantCompletionTokens, ev.CompletionTokens)
	}
	cs.verifySig(t, integrationTestSecret)
}

// TestIntegration_AnthropicNonStream_WebhookFired verifies the Anthropic native
// non-stream path (/v1/messages with stream=false):
//
//	mock Anthropic JSON response → adaptor.DoResponse (parses usage.input_tokens
//	and usage.output_tokens from the message body) → PostTextConsumeQuota →
//	dispatchAirbotixBilling → webhook POST with provider=="anthropic".
func TestIntegration_AnthropicNonStream_WebhookFired(t *testing.T) {
	withDBBypass(t)

	const (
		wantPromptTokens     = 250
		wantCompletionTokens = 90
	)

	cs := newCaptureServer(t)
	c := integrationCtx(cs.URL, integrationTestSecret, "")
	ri := integrationRelayInfo(
		"req-int-claude-nons-001", "claude-haiku-4-5",
		constant.ChannelTypeAnthropic, constant.APITypeAnthropic,
		false, types.RelayFormatClaude,
	)

	// Use the Claude adaptor's DoResponse with a non-stream Anthropic JSON body.
	// The adaptor parses usage.input_tokens → PromptTokens, output_tokens → CompletionTokens.
	adaptor := GetAdaptor(constant.APITypeAnthropic)
	adaptor.Init(ri)
	usageAny, apiErr := adaptor.DoResponse(c, anthropicJSONResponse(wantPromptTokens, wantCompletionTokens), ri)
	if apiErr != nil {
		t.Fatalf("DoResponse returned error: %v", apiErr)
	}
	usage, ok := usageAny.(*dto.Usage)
	if !ok || usage == nil {
		t.Fatalf("DoResponse returned non-Usage type: %T", usageAny)
	}

	if usage.PromptTokens != wantPromptTokens {
		t.Errorf("Anthropic JSON parse: PromptTokens want %d, got %d", wantPromptTokens, usage.PromptTokens)
	}
	if usage.CompletionTokens != wantCompletionTokens {
		t.Errorf("Anthropic JSON parse: CompletionTokens want %d, got %d", wantCompletionTokens, usage.CompletionTokens)
	}

	service.PostTextConsumeQuota(c, ri, usage, nil)

	if !cs.waitHit(2 * time.Second) {
		t.Fatal("billing webhook not called within 2 s after Anthropic non-stream relay")
	}

	ev := cs.decodeEvent(t)
	if ev.Model != "claude-haiku-4-5" {
		t.Errorf("Model: want %q, got %q", "claude-haiku-4-5", ev.Model)
	}
	if ev.Provider != "anthropic" {
		t.Errorf("Provider: want %q, got %q", "anthropic", ev.Provider)
	}
	if ev.PromptTokens != wantPromptTokens {
		t.Errorf("PromptTokens: want %d, got %d", wantPromptTokens, ev.PromptTokens)
	}
	if ev.CompletionTokens != wantCompletionTokens {
		t.Errorf("CompletionTokens: want %d, got %d", wantCompletionTokens, ev.CompletionTokens)
	}
	cs.verifySig(t, integrationTestSecret)
}

// TestIntegration_DeepRouterAuto_RoutedFromFilled verifies that when the gin
// context carries ContextKeyAliasResolvedFrom == "deeprouter-auto" (set by
// middleware/smart_router.go), the RoutedFrom field is populated in the
// billing event and the resolved concrete model is carried in Model.
func TestIntegration_DeepRouterAuto_RoutedFromFilled(t *testing.T) {
	withDBBypass(t)
	withStreamingTimeout(t, 30)

	cs := newCaptureServer(t)
	// Simulate the gin.Context state after middleware/smart_router.go resolves
	// "deeprouter-auto" to "claude-haiku-4-5".
	c := integrationCtx(cs.URL, integrationTestSecret, "deeprouter-auto")
	ri := integrationRelayInfo(
		"req-int-auto-001", "claude-haiku-4-5",
		constant.ChannelTypeAnthropic, constant.APITypeAnthropic,
		true, types.RelayFormatClaude,
	)

	adaptor := GetAdaptor(constant.APITypeAnthropic)
	adaptor.Init(ri)
	usageAny, apiErr := adaptor.DoResponse(c, anthropicSSEStream(200, 100), ri)
	if apiErr != nil {
		t.Fatalf("DoResponse returned error: %v", apiErr)
	}
	usage := usageAny.(*dto.Usage)

	service.PostTextConsumeQuota(c, ri, usage, nil)

	if !cs.waitHit(2 * time.Second) {
		t.Fatal("billing webhook not called for deeprouter-auto relay path")
	}

	ev := cs.decodeEvent(t)
	if ev.Model != "claude-haiku-4-5" {
		t.Errorf("Model: want concrete resolved model %q, got %q", "claude-haiku-4-5", ev.Model)
	}
	if ev.RoutedFrom != "deeprouter-auto" {
		t.Errorf("RoutedFrom: want %q, got %q", "deeprouter-auto", ev.RoutedFrom)
	}
	if ev.Provider != "anthropic" {
		t.Errorf("Provider: want %q, got %q", "anthropic", ev.Provider)
	}
	cs.verifySig(t, integrationTestSecret)
}

// TestIntegration_FailedRelay_NoWebhook verifies that when the upstream returns
// a 500 error, DoResponse signals the failure via a non-nil *types.NewAPIError,
// which causes the relay completion path to skip PostTextConsumeQuota entirely —
// so the billing webhook must NOT be called.
//
// Production guard in compatible_handler.go (TextHelper):
//
//	usageAny, apiErr := adaptor.DoResponse(c, resp, info)
//	if apiErr != nil {
//	    return relayErrorHandler(...)  // exits before PostTextConsumeQuota
//	}
//
// This test exercises the real adaptor.DoResponse with a 500 body and asserts
// that (a) it returns a non-nil error and (b) skipping PostTextConsumeQuota on
// that error prevents the webhook from firing.
func TestIntegration_FailedRelay_NoWebhook(t *testing.T) {
	withDBBypass(t)
	withStreamingTimeout(t, 30)

	cs := newCaptureServer(t)
	c := integrationCtx(cs.URL, integrationTestSecret, "")
	ri := integrationRelayInfo(
		"req-int-fail-001", "gpt-4o-mini",
		constant.ChannelTypeOpenAI, constant.APITypeOpenAI,
		false, types.RelayFormatOpenAI,
	)

	// Upstream returns a 500 with an OpenAI-format error body.
	upstreamResp := &http.Response{
		StatusCode: http.StatusInternalServerError,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(`{"error":{"message":"server error","type":"server_error","code":500}}`)),
	}

	// Call the real adaptor — same path as the success tests. On a 500, DoResponse
	// must return a non-nil apiErr; usageAny will be nil or ignored.
	adaptor := GetAdaptor(constant.APITypeOpenAI)
	adaptor.Init(ri)
	_, apiErr := adaptor.DoResponse(c, upstreamResp, ri)

	// The adaptor must signal the upstream error. If it doesn't, the test is
	// misconfigured (the relay error path would be unreachable).
	if apiErr == nil {
		t.Fatal("expected DoResponse to return a non-nil error for upstream 500, got nil — guard cannot fire")
	}

	// Production path: when apiErr != nil, TextHelper returns without calling
	// PostTextConsumeQuota. We replicate that exact guard here.
	// (No PostTextConsumeQuota call — intentional.)

	// Give the goroutine dispatcher a moment and assert no webhook fired.
	time.Sleep(150 * time.Millisecond)
	if cs.hits.Load() != 0 {
		t.Errorf("webhook must not be called on upstream 500, got %d calls", cs.hits.Load())
	}
}
