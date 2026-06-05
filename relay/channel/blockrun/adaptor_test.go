package blockrun

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// Note on coverage: the DoRequest x402 two-trip flow (unsigned 402 → sign →
// signed retry, plus the retry-still-402 guard against fund-draining loops) is
// exercised by the gated live end-to-end test in x402_e2e_test.go. It needs the
// full channel.DoApiRequest plumbing (HeaderOverride, proxy, request-id, SSE
// keep-alive) and a real upstream that issues a 402, so it is intentionally NOT
// re-implemented here with elaborate HTTP mocking. The unit tests below cover
// the format-agnostic pieces DoRequest relies on (URL dispatch, header safety,
// signature injection, response dispatch) in isolation.

// fakeWalletKey is a syntactically plausible 0x-prefixed 64-hex EVM private key.
// It is deliberately a throwaway value used ONLY to assert that the key NEVER
// reaches an HTTP header (x-api-key / Authorization). It is not a real key.
const fakeWalletKey = "0x" +
	"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

// newTestContext builds a *gin.Context with a real inbound *http.Request so that
// SetupApiRequestHeader (which reads c.Request.Header) does not panic. Optional
// inbound headers can be supplied to exercise anthropic-version / anthropic-beta
// passthrough.
func newTestContext(method, path string, inboundHeaders map[string]string) *gin.Context {
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(method, path, nil)
	for k, v := range inboundHeaders {
		c.Request.Header.Set(k, v)
	}
	return c
}

// ---------------------------------------------------------------------------
// B) Convert methods — native passthrough / unsupported.
// ---------------------------------------------------------------------------

// TestConvertClaudeRequest_Passthrough asserts the inbound Claude request is
// returned verbatim (same pointer): VIP native passthrough does NOT convert to
// OpenAI.
func TestConvertClaudeRequest_Passthrough(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/messages", nil)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
	}
	in := &dto.ClaudeRequest{Model: "anthropic/claude-haiku-4.5"}

	out, err := a.ConvertClaudeRequest(c, info, in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got, ok := out.(*dto.ClaudeRequest)
	if !ok {
		t.Fatalf("expected *dto.ClaudeRequest, got %T", out)
	}
	if got != in {
		t.Fatalf("ConvertClaudeRequest must return the SAME request pointer (native passthrough); got %p want %p", got, in)
	}
}

// TestConvertClaudeRequest_NilRejected asserts a nil request is rejected rather
// than panicking.
func TestConvertClaudeRequest_NilRejected(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/messages", nil)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatClaude}
	if _, err := a.ConvertClaudeRequest(c, info, nil); err == nil {
		t.Fatalf("expected error for nil claude request, got nil")
	}
}

// TestConvertOpenAIRequest_Passthrough asserts the inbound OpenAI request is
// returned as-is (passthrough), so StreamOptions and every other field survive.
func TestConvertOpenAIRequest_Passthrough(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{ChannelBaseUrl: "https://blockrun.ai/api"},
	}
	in := &dto.GeneralOpenAIRequest{Model: "openai/gpt-5.4-nano"}

	out, err := a.ConvertOpenAIRequest(c, info, in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got, ok := out.(*dto.GeneralOpenAIRequest)
	if !ok {
		t.Fatalf("expected *dto.GeneralOpenAIRequest, got %T", out)
	}
	if got != in {
		t.Fatalf("ConvertOpenAIRequest must return the SAME request pointer (passthrough); got %p want %p", got, in)
	}
}

// TestConvertOpenAIRequest_DropsParallelToolCallsWhenNoTools asserts that
// parallel_tool_calls is stripped when no tools are present, since the upstream
// rejects "'parallel_tool_calls' is only allowed when 'tools' are specified".
func TestConvertOpenAIRequest_DropsParallelToolCallsWhenNoTools(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAI}

	ptc := false
	in := &dto.GeneralOpenAIRequest{Model: "openai/gpt-4o-br", ParallelTooCalls: &ptc}

	out, err := a.ConvertOpenAIRequest(c, info, in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := out.(*dto.GeneralOpenAIRequest)
	if got.ParallelTooCalls != nil {
		t.Fatalf("parallel_tool_calls must be nil when no tools; got %v", *got.ParallelTooCalls)
	}
}

// TestConvertOpenAIRequest_KeepsParallelToolCallsWithTools asserts the field is
// preserved when tools are present (valid upstream combination).
func TestConvertOpenAIRequest_KeepsParallelToolCallsWithTools(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAI}

	ptc := false
	in := &dto.GeneralOpenAIRequest{
		Model:            "openai/gpt-4o-br",
		ParallelTooCalls: &ptc,
		Tools:            []dto.ToolCallRequest{{Type: "function"}},
	}

	out, err := a.ConvertOpenAIRequest(c, info, in)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	got := out.(*dto.GeneralOpenAIRequest)
	if got.ParallelTooCalls == nil || *got.ParallelTooCalls != false {
		t.Fatalf("parallel_tool_calls must be preserved when tools present; got %v", got.ParallelTooCalls)
	}
}

// TestConvertOpenAIRequest_NilRejected asserts a nil request is rejected.
func TestConvertOpenAIRequest_NilRejected(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/chat/completions", nil)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatOpenAI}
	if _, err := a.ConvertOpenAIRequest(c, info, nil); err == nil {
		t.Fatalf("expected error for nil openai request, got nil")
	}
}

// TestConvertGeminiRequest_Unsupported asserts Gemini inbound is rejected with a
// non-nil error (VIP native passthrough supports only Anthropic and OpenAI).
func TestConvertGeminiRequest_Unsupported(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1beta/models/gemini-pro:generateContent", nil)
	info := &relaycommon.RelayInfo{RelayFormat: types.RelayFormatGemini}
	out, err := a.ConvertGeminiRequest(c, info, &dto.GeminiChatRequest{})
	if err == nil {
		t.Fatalf("expected error for gemini request, got nil")
	}
	if out != nil {
		t.Fatalf("expected nil result on unsupported gemini request, got %v", out)
	}
}

// ---------------------------------------------------------------------------
// C) SetupRequestHeader — SECURITY: wallet private key must NEVER hit a header.
// ---------------------------------------------------------------------------

// headerForbidden is the set of header keys that must NEVER appear after
// SetupRequestHeader, because info.ApiKey is the EVM wallet private key for this
// channel. http.Header.Get is case-insensitive (canonicalised), so we probe the
// canonical forms; we ALSO walk every raw key to be defensive against any
// non-canonical insertion.
var headerForbidden = []string{"X-Api-Key", "Authorization"}

// assertNoCredentialHeaders fails if any credential-bearing header is present
// (non-empty) in h. Checks both canonical Get and a raw key walk.
func assertNoCredentialHeaders(t *testing.T, h http.Header) {
	t.Helper()
	for _, k := range headerForbidden {
		if v := h.Get(k); v != "" {
			t.Fatalf("SECURITY: header %q must be empty/absent, got %q", k, v)
		}
	}
	// Defensive: walk every raw key in case something inserted a non-canonical
	// variant that Get would miss.
	for k, vs := range h {
		lower := http.CanonicalHeaderKey(k)
		if lower == "X-Api-Key" || lower == "Authorization" {
			t.Fatalf("SECURITY: forbidden credential header %q present with values %v", k, vs)
		}
	}
}

// TestSetupRequestHeader_NoWalletKeyLeak is the most important test: regardless
// of inbound format, the wallet private key in info.ApiKey must NOT be written
// to x-api-key or Authorization (the claude/openai adaptors would set those by
// default — this adaptor must not).
//
// It ALSO covers the inbound-credential-stripping case: a client that supplies
// its own Authorization / x-api-key must NOT have those forwarded upstream —
// authentication is the EIP-712 x402 signature only, never a passed-through
// secret. We set dummy inbound credentials and assert the outbound header still
// carries neither, for both Claude and OpenAI formats.
func TestSetupRequestHeader_NoWalletKeyLeak(t *testing.T) {
	cases := []struct {
		name        string
		relayFormat types.RelayFormat
		path        string
	}{
		{"claude format", types.RelayFormatClaude, "/v1/messages"},
		{"openai format", types.RelayFormatOpenAI, "/v1/chat/completions"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := &Adaptor{}
			c := newTestContext(http.MethodPost, tc.path, map[string]string{
				"Content-Type": "application/json",
				// Client-supplied credentials that must be stripped, not forwarded.
				"Authorization": "Bearer client-supplied-token",
				"x-api-key":     "client-supplied-key",
			})
			info := &relaycommon.RelayInfo{
				RelayMode:   0, // RelayModeUnknown → standard content-type path in SetupApiRequestHeader
				RelayFormat: tc.relayFormat,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl: "https://blockrun.ai/api",
					ApiKey:         fakeWalletKey, // the wallet PRIVATE KEY
				},
			}

			req := &http.Header{}
			if err := a.SetupRequestHeader(c, req, info); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			assertNoCredentialHeaders(t, *req)

			// Sanity: the wallet key must not appear anywhere in any header value.
			for k, vs := range *req {
				for _, v := range vs {
					if v == fakeWalletKey {
						t.Fatalf("SECURITY: wallet key leaked into header %q", k)
					}
				}
			}

			// Content-Type should still be propagated from the inbound request.
			if got := req.Get("Content-Type"); got != "application/json" {
				t.Fatalf("expected Content-Type application/json, got %q", got)
			}
		})
	}
}

// TestSetupRequestHeader_ClaudeAnthropicVersionDefault asserts that on the Claude
// leg, anthropic-version is set to the default when the client sent none, and is
// passed through unchanged when the client did send one.
func TestSetupRequestHeader_ClaudeAnthropicVersionDefault(t *testing.T) {
	t.Run("default when client sent none", func(t *testing.T) {
		a := &Adaptor{}
		c := newTestContext(http.MethodPost, "/v1/messages", map[string]string{
			"Content-Type": "application/json",
		})
		info := &relaycommon.RelayInfo{
			RelayFormat: types.RelayFormatClaude,
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelBaseUrl: "https://blockrun.ai/api",
				ApiKey:         fakeWalletKey,
			},
		}
		req := &http.Header{}
		if err := a.SetupRequestHeader(c, req, info); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got := req.Get("anthropic-version"); got != defaultAnthropicVersion {
			t.Fatalf("expected default anthropic-version %q, got %q", defaultAnthropicVersion, got)
		}
		// anthropic-beta must be absent when the client did not send it.
		if got := req.Get("anthropic-beta"); got != "" {
			t.Fatalf("expected no anthropic-beta header, got %q", got)
		}
		assertNoCredentialHeaders(t, *req)
	})

	t.Run("passthrough client-supplied version and beta", func(t *testing.T) {
		a := &Adaptor{}
		c := newTestContext(http.MethodPost, "/v1/messages", map[string]string{
			"Content-Type":      "application/json",
			"anthropic-version": "2024-10-22",
			"anthropic-beta":    "prompt-caching-2024-07-31",
		})
		info := &relaycommon.RelayInfo{
			RelayFormat: types.RelayFormatClaude,
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelBaseUrl: "https://blockrun.ai/api",
				ApiKey:         fakeWalletKey,
			},
		}
		req := &http.Header{}
		if err := a.SetupRequestHeader(c, req, info); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if got := req.Get("anthropic-version"); got != "2024-10-22" {
			t.Fatalf("expected client anthropic-version 2024-10-22, got %q", got)
		}
		if got := req.Get("anthropic-beta"); got != "prompt-caching-2024-07-31" {
			t.Fatalf("expected client anthropic-beta passthrough, got %q", got)
		}
		assertNoCredentialHeaders(t, *req)
	})
}

// TestSetupRequestHeader_OpenAINoAnthropicVersion asserts the OpenAI leg does NOT
// inject any Anthropic-specific headers (anthropic-version / anthropic-beta are
// Claude-only).
func TestSetupRequestHeader_OpenAINoAnthropicVersion(t *testing.T) {
	a := &Adaptor{}
	c := newTestContext(http.MethodPost, "/v1/chat/completions", map[string]string{
		"Content-Type": "application/json",
	})
	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://blockrun.ai/api",
			ApiKey:         fakeWalletKey,
		},
	}
	req := &http.Header{}
	if err := a.SetupRequestHeader(c, req, info); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := req.Get("anthropic-version"); got != "" {
		t.Fatalf("openai leg must not set anthropic-version, got %q", got)
	}
	if got := req.Get("anthropic-beta"); got != "" {
		t.Fatalf("openai leg must not set anthropic-beta, got %q", got)
	}
	assertNoCredentialHeaders(t, *req)
}

// TestSetupRequestHeader_PaymentSignatureInjection asserts that the
// PAYMENT-SIGNATURE header is injected only when DoRequest stashed a signature
// in the gin context (the signed retry leg), and is absent on the first leg.
//
// Parameterized over BOTH RelayFormatClaude and RelayFormatOpenAI to document
// the format-agnostic guarantee: the x402 signature lifecycle is identical for
// the /v1/messages and /v1/chat/completions legs.
func TestSetupRequestHeader_PaymentSignatureInjection(t *testing.T) {
	makeInfo := func(format types.RelayFormat) *relaycommon.RelayInfo {
		return &relaycommon.RelayInfo{
			RelayFormat: format,
			ChannelMeta: &relaycommon.ChannelMeta{
				ChannelBaseUrl: "https://blockrun.ai/api",
				ApiKey:         fakeWalletKey,
			},
		}
	}

	formats := []struct {
		name        string
		relayFormat types.RelayFormat
		path        string
	}{
		{"claude format", types.RelayFormatClaude, "/v1/messages"},
		{"openai format", types.RelayFormatOpenAI, "/v1/chat/completions"},
	}

	for _, f := range formats {
		t.Run(f.name, func(t *testing.T) {
			t.Run("absent on first (unsigned) leg", func(t *testing.T) {
				a := &Adaptor{}
				c := newTestContext(http.MethodPost, f.path, map[string]string{
					"Content-Type": "application/json",
				})
				req := &http.Header{}
				if err := a.SetupRequestHeader(c, req, makeInfo(f.relayFormat)); err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if got := req.Get(headerPaymentSignature); got != "" {
					t.Fatalf("expected no PAYMENT-SIGNATURE on first leg, got %q", got)
				}
			})

			t.Run("injected on signed retry leg", func(t *testing.T) {
				a := &Adaptor{}
				c := newTestContext(http.MethodPost, f.path, map[string]string{
					"Content-Type": "application/json",
				})
				const sig = "eyJzaWduYXR1cmUiOiJmYWtlIn0=" // arbitrary base64 stand-in
				c.Set(ctxKeyPaymentSignature, sig)

				req := &http.Header{}
				if err := a.SetupRequestHeader(c, req, makeInfo(f.relayFormat)); err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if got := req.Get(headerPaymentSignature); got != sig {
					t.Fatalf("expected PAYMENT-SIGNATURE %q on signed retry, got %q", sig, got)
				}
				// Even with a signature present, credentials must still be absent.
				assertNoCredentialHeaders(t, *req)
			})
		})
	}
}

// ---------------------------------------------------------------------------
// D) DoResponse — dispatch by RelayFormat to the correct NATIVE handler.
// ---------------------------------------------------------------------------

// dispatchProbeBody is a single non-stream JSON body crafted to be parseable by
// BOTH native handlers, but to yield DISTINGUISHABLE usage depending on which
// one ran:
//
//   - openai.OpenaiHandler unmarshals dto.OpenAITextResponse and reports
//     usage.prompt_tokens (11) as PromptTokens; it never sets UsageSemantic.
//   - claude.ClaudeHandler unmarshals dto.ClaudeResponse and maps
//     usage.input_tokens (33) to PromptTokens AND tags UsageSemantic="anthropic".
//
// The two token sets differ (11/22 vs 33/44) precisely so the returned usage
// proves the Claude branch is taken ONLY for RelayFormatClaude and the OpenAI
// branch for every other format — without weakening any assertion.
const dispatchProbeBody = `{
  "id": "probe-1",
  "type": "message",
  "role": "assistant",
  "model": "probe-model",
  "object": "chat.completion",
  "content": [{"type": "text", "text": "hi"}],
  "choices": [{"index": 0, "message": {"role": "assistant", "content": "hi"}, "finish_reason": "stop"}],
  "usage": {
    "prompt_tokens": 11, "completion_tokens": 22,
    "input_tokens": 33, "output_tokens": 44
  }
}`

// newProbeResponse builds a minimal non-stream *http.Response over the probe
// body. A non-nil Header is required because the handlers copy upstream headers
// to the client writer via service.IOCopyBytesGracefully.
func newProbeResponse() *http.Response {
	return &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(dispatchProbeBody)),
	}
}

// TestDoResponse_DispatchByRelayFormat asserts DoResponse routes to the native
// handler selected purely by info.RelayFormat: RelayFormatClaude reaches the
// claude handler, every other format reaches the openai handler. We assert the
// observable difference in the returned *dto.Usage (token mapping + the
// anthropic UsageSemantic tag that only the Claude handler sets).
func TestDoResponse_DispatchByRelayFormat(t *testing.T) {
	cases := []struct {
		name              string
		relayFormat       types.RelayFormat
		path              string
		wantPromptTokens  int
		wantUsageSemantic string // claude handler tags "anthropic"; openai leaves ""
	}{
		{
			name:              "claude format → native claude handler",
			relayFormat:       types.RelayFormatClaude,
			path:              "/v1/messages",
			wantPromptTokens:  33, // input_tokens
			wantUsageSemantic: "anthropic",
		},
		{
			name:              "openai format → native openai handler",
			relayFormat:       types.RelayFormatOpenAI,
			path:              "/v1/chat/completions",
			wantPromptTokens:  11, // prompt_tokens
			wantUsageSemantic: "",
		},
		{
			name:              "default (empty) format → native openai handler",
			relayFormat:       "",
			path:              "/v1/chat/completions",
			wantPromptTokens:  11, // prompt_tokens
			wantUsageSemantic: "",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			a := &Adaptor{}
			c := newTestContext(http.MethodPost, tc.path, nil)
			info := &relaycommon.RelayInfo{
				RelayMode:   0, // default branch in openai.DoResponse → OpenaiHandler (non-stream)
				IsStream:    false,
				RelayFormat: tc.relayFormat,
				ChannelMeta: &relaycommon.ChannelMeta{
					ChannelBaseUrl:    "https://blockrun.ai/api",
					UpstreamModelName: "probe-model",
				},
			}

			usage, apiErr := a.DoResponse(c, newProbeResponse(), info)
			if apiErr != nil {
				t.Fatalf("unexpected DoResponse error: %v", apiErr)
			}
			u, ok := usage.(*dto.Usage)
			if !ok {
				t.Fatalf("expected *dto.Usage, got %T", usage)
			}
			if u.PromptTokens != tc.wantPromptTokens {
				t.Fatalf("wrong handler dispatched: PromptTokens=%d want %d (claude reads input_tokens=33, openai reads prompt_tokens=11)",
					u.PromptTokens, tc.wantPromptTokens)
			}
			if u.UsageSemantic != tc.wantUsageSemantic {
				t.Fatalf("UsageSemantic=%q want %q — only the claude handler tags \"anthropic\"; this proves the Claude branch is taken iff RelayFormatClaude",
					u.UsageSemantic, tc.wantUsageSemantic)
			}
		})
	}
}
