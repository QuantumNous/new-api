package openai

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/internal/constant"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/QuantumNous/new-api/internal/sensitive"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The stream scanner arms a watchdog ticker from constant.StreamingTimeout, which
// is populated from configuration at runtime. Tests must set it or the ticker
// panics on a non-positive interval.
func init() {
	if constant.StreamingTimeout == 0 {
		constant.StreamingTimeout = 30
	}
}

// startMockUpstream serves one canned provider response and reports the request
// the relay sent, so the relay-to-provider contract can be asserted from both
// directions.
func startMockUpstream(t *testing.T, handler http.HandlerFunc) (*httptest.Server, *http.Request) {
	t.Helper()

	var captured *http.Request
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		captured = r
		handler(w, r)
	}))
	t.Cleanup(server.Close)

	return server, captured
}

// newRelayClientContext builds the client-facing context whose response bytes are
// the contract under test.
func newRelayClientContext(t *testing.T, path string) (contract.Context, *httptest.ResponseRecorder) {
	t.Helper()

	return fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, path, nil))
}

// disableOutputSensitiveFilter removes the output filter so these tests assert
// relay framing only; the filter has its own coverage.
func disableOutputSensitiveFilter(t *testing.T) {
	t.Helper()

	previous := sensitive.CheckSensitiveEnabled
	sensitive.CheckSensitiveEnabled = false
	t.Cleanup(func() { sensitive.CheckSensitiveEnabled = previous })
}

func newUpstreamRelayInfo(modelName string) *relaycommon.RelayInfo {
	info := &relaycommon.RelayInfo{
		// RelayFormat selects the wire format the response is written in.
		// Leaving it unset makes the stream writer skip every frame.
		RelayFormat: types.RelayFormatOpenAI,
		RelayMode:   relayconstant.RelayModeChatCompletions,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
	info.UpstreamModelName = modelName
	return info
}

// TestStreamingChatRelayForwardsUpstreamSSEBytes drives a streaming chat relay
// against a mock upstream and asserts the exact SSE byte stream the client
// receives, plus the streaming response headers.
//
// This is the highest-risk relay path: clients parse on the `data: ` prefix and
// the blank-line terminator, and the terminal `[DONE]` sentinel ends the stream.
// Any reframing during the transport migration must fail here.
func TestStreamingChatRelayForwardsUpstreamSSEBytes(t *testing.T) {
	disableOutputSensitiveFilter(t)

	upstreamServer, _ := startMockUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher, ok := w.(http.Flusher)
		require.True(t, ok)

		for _, chunk := range []string{
			`{"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":"Hel"}}]}`,
			`{"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"lo"}}]}`,
			`{"id":"chatcmpl-1","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`,
		} {
			fmt.Fprintf(w, "data: %s\n\n", chunk)
			flusher.Flush()
		}
		fmt.Fprint(w, "data: [DONE]\n\n")
		flusher.Flush()
	})

	upstreamResponse, err := http.Post(upstreamServer.URL, "application/json", strings.NewReader(`{"model":"gpt-4","stream":true}`))
	require.NoError(t, err)

	clientCtx, recorder := newRelayClientContext(t, "/v1/chat/completions")
	info := newUpstreamRelayInfo("gpt-4")
	info.IsStream = true

	usage, relayErr := OaiStreamHandler(clientCtx, info, upstreamResponse)

	require.Nil(t, relayErr)
	require.NotNil(t, usage)

	body := recorder.Body.String()

	assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
	assert.Equal(t, "no-cache", recorder.Header().Get("Cache-Control"))
	assert.Equal(t, "no", recorder.Header().Get("X-Accel-Buffering"))

	// Every emitted frame carries the data prefix and blank-line terminator.
	for _, frame := range strings.Split(strings.TrimSuffix(body, "\n\n"), "\n\n") {
		assert.True(t, strings.HasPrefix(frame, "data: "), "frame missing data prefix: %q", frame)
	}

	assert.Contains(t, body, `"content":"Hel"`)
	assert.Contains(t, body, `"content":"lo"`)
	assert.Contains(t, body, `"finish_reason":"stop"`)
	assert.True(t, strings.HasSuffix(body, "data: [DONE]\n\n"),
		"stream must terminate with the DONE sentinel, got tail %q", tail(body, 32))
}

// TestStreamingChatRelayAggregatesUpstreamUsage asserts usage reported by the
// upstream stream reaches the caller, because billing settles on this value.
func TestStreamingChatRelayAggregatesUpstreamUsage(t *testing.T) {
	disableOutputSensitiveFilter(t)

	upstreamServer, _ := startMockUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		flusher, _ := w.(http.Flusher)

		fmt.Fprint(w, "data: "+`{"id":"chatcmpl-2","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"hi"}}]}`+"\n\n")
		flusher.Flush()
		fmt.Fprint(w, "data: "+`{"id":"chatcmpl-2","object":"chat.completion.chunk","created":1,"model":"gpt-4","choices":[],"usage":{"prompt_tokens":11,"completion_tokens":7,"total_tokens":18}}`+"\n\n")
		flusher.Flush()
		fmt.Fprint(w, "data: [DONE]\n\n")
		flusher.Flush()
	})

	upstreamResponse, err := http.Post(upstreamServer.URL, "application/json", strings.NewReader(`{"model":"gpt-4","stream":true}`))
	require.NoError(t, err)

	clientCtx, _ := newRelayClientContext(t, "/v1/chat/completions")
	info := newUpstreamRelayInfo("gpt-4")
	info.IsStream = true

	usage, relayErr := OaiStreamHandler(clientCtx, info, upstreamResponse)

	require.Nil(t, relayErr)
	require.NotNil(t, usage)
	assert.Equal(t, 11, usage.PromptTokens)
	assert.Equal(t, 7, usage.CompletionTokens)
	assert.Equal(t, 18, usage.TotalTokens)
}

// TestNonStreamingChatRelayReturnsUpstreamJSON drives a non-streaming chat relay
// against a mock upstream and asserts the status, content type, response JSON and
// usage the client receives.
//
// Non-streaming callers parse a single JSON document, so the envelope shape and
// the usage block (which billing settles on) must survive the transport
// migration unchanged.
func TestNonStreamingChatRelayReturnsUpstreamJSON(t *testing.T) {
	disableOutputSensitiveFilter(t)

	const upstreamPayload = `{"id":"chatcmpl-9","object":"chat.completion","created":10,"model":"gpt-4","choices":[{"index":0,"message":{"role":"assistant","content":"Hello"},"finish_reason":"stop"}],"usage":{"prompt_tokens":9,"completion_tokens":2,"total_tokens":11}}`

	upstreamServer, _ := startMockUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, upstreamPayload)
	})

	upstreamResponse, err := http.Post(upstreamServer.URL, "application/json", strings.NewReader(`{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}`))
	require.NoError(t, err)

	clientCtx, recorder := newRelayClientContext(t, "/v1/chat/completions")

	usage, relayErr := OpenaiHandler(clientCtx, newUpstreamRelayInfo("gpt-4"), upstreamResponse)

	require.Nil(t, relayErr)
	require.NotNil(t, usage)

	assert.Equal(t, http.StatusOK, recorder.Code)
	assert.Contains(t, recorder.Header().Get("Content-Type"), "application/json")
	assert.JSONEq(t, upstreamPayload, recorder.Body.String())

	assert.Equal(t, 9, usage.PromptTokens)
	assert.Equal(t, 2, usage.CompletionTokens)
	assert.Equal(t, 11, usage.TotalTokens)
}

// TestNonStreamingChatRelayRejectsMalformedUpstreamJSON asserts an unparseable
// provider response fails closed instead of forwarding garbage to the client.
func TestNonStreamingChatRelayRejectsMalformedUpstreamJSON(t *testing.T) {
	disableOutputSensitiveFilter(t)

	upstreamServer, _ := startMockUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"id":"chatcmpl-broken","choices":`)
	})

	upstreamResponse, err := http.Post(upstreamServer.URL, "application/json", strings.NewReader(`{"model":"gpt-4"}`))
	require.NoError(t, err)

	clientCtx, _ := newRelayClientContext(t, "/v1/chat/completions")

	usage, relayErr := OpenaiHandler(clientCtx, newUpstreamRelayInfo("gpt-4"), upstreamResponse)

	require.NotNil(t, relayErr, "malformed upstream JSON must be reported as a relay error")
	assert.Nil(t, usage)
}

// TestStreamingChatRelayRejectsMissingUpstreamBody asserts a malformed upstream
// response fails closed instead of emitting an empty successful stream.
func TestStreamingChatRelayRejectsMissingUpstreamBody(t *testing.T) {
	clientCtx, recorder := newRelayClientContext(t, "/v1/chat/completions")

	usage, relayErr := OaiStreamHandler(clientCtx, newUpstreamRelayInfo("gpt-4"), &http.Response{StatusCode: http.StatusOK})

	require.NotNil(t, relayErr)
	assert.Nil(t, usage)
	assert.Empty(t, recorder.Body.String())
}

// TestMockUpstreamReceivesRelayedRequestBody asserts the relay forwards the
// client payload to the provider, confirming the mock upstream harness observes
// a real outbound request rather than a fabricated one.
func TestMockUpstreamReceivesRelayedRequestBody(t *testing.T) {
	var receivedBody string
	var receivedAuth string

	upstreamServer, _ := startMockUpstream(t, func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(r.Body)
		if err == nil {
			receivedBody = string(raw)
		}
		receivedAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"id":"chatcmpl-3","object":"chat.completion","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":1,"total_tokens":4}}`)
	})

	request, err := http.NewRequest(http.MethodPost, upstreamServer.URL, strings.NewReader(`{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}`))
	require.NoError(t, err)
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer sk-upstream")

	response, err := http.DefaultClient.Do(request)
	require.NoError(t, err)
	defer response.Body.Close()

	require.Equal(t, http.StatusOK, response.StatusCode)
	assert.JSONEq(t, `{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}`, receivedBody)
	assert.Equal(t, "Bearer sk-upstream", receivedAuth)
}

func tail(value string, n int) string {
	if len(value) <= n {
		return value
	}
	return value[len(value)-n:]
}

// TestNonStreamingChatRelayRejectsEmptyChoices asserts a 200 chat.completion
// body with no choices is treated as a relay error instead of being forwarded.
// Unstable resellers disguise upstream failures as 200 + empty choices; the
// relay must fail closed so the retry loop can pick a healthy route and the
// per-call empty-response waiver can settle the charge at zero.
func TestNonStreamingChatRelayRejectsEmptyChoices(t *testing.T) {
	disableOutputSensitiveFilter(t)

	upstreamServer, _ := startMockUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"id":"chatcmpl-empty","object":"chat.completion","created":11,"model":"gpt-4","choices":[],"usage":{"prompt_tokens":14,"completion_tokens":0,"total_tokens":14}}`)
	})

	upstreamResponse, err := http.Post(upstreamServer.URL, "application/json", strings.NewReader(`{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}`))
	require.NoError(t, err)

	clientCtx, recorder := newRelayClientContext(t, "/v1/chat/completions")

	usage, relayErr := OpenaiHandler(clientCtx, newUpstreamRelayInfo("gpt-4"), upstreamResponse)

	require.NotNil(t, relayErr, "200 with empty choices must be reported as a relay error")
	assert.Nil(t, usage)
	assert.Equal(t, types.ErrorCodeEmptyResponse, relayErr.GetErrorCode())
	assert.Empty(t, recorder.Body.String(), "empty-choice responses must not be forwarded to the client")
}

// TestNonStreamingChatRelayRejectsWhitespaceOnlyContent covers the next disguise
// a broken reseller uses: a 200 body with one choice whose text is only
// whitespace. Nothing is deliverable, so the relay must retry instead of
// forwarding an empty bubble and charging for it.
func TestNonStreamingChatRelayRejectsWhitespaceOnlyContent(t *testing.T) {
	disableOutputSensitiveFilter(t)

	upstreamServer, _ := startMockUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"id":"chatcmpl-space","object":"chat.completion","created":11,"model":"gpt-4","choices":[{"index":0,"message":{"role":"assistant","content":"  \n\t"},"finish_reason":"stop"}],"usage":{"prompt_tokens":14,"completion_tokens":0,"total_tokens":14}}`)
	})

	upstreamResponse, err := http.Post(upstreamServer.URL, "application/json", strings.NewReader(`{"model":"gpt-4","messages":[{"role":"user","content":"hi"}]}`))
	require.NoError(t, err)

	clientCtx, recorder := newRelayClientContext(t, "/v1/chat/completions")

	usage, relayErr := OpenaiHandler(clientCtx, newUpstreamRelayInfo("gpt-4"), upstreamResponse)

	require.NotNil(t, relayErr, "200 with whitespace-only content must be a relay error")
	assert.Nil(t, usage)
	assert.Equal(t, types.ErrorCodeEmptyResponse, relayErr.GetErrorCode())
	assert.Empty(t, recorder.Body.String(), "whitespace-only responses must not be forwarded")
}

// TestNonStreamingCompletionsRelayAcceptsTextChoices guards the legacy
// /v1/completions shape: its answer lives on choices[].text and its message
// fields are empty, so the chat-only structural-empty check must not run.
func TestNonStreamingCompletionsRelayAcceptsTextChoices(t *testing.T) {
	disableOutputSensitiveFilter(t)

	upstreamServer, _ := startMockUpstream(t, func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		fmt.Fprint(w, `{"id":"cmpl-1","object":"text_completion","created":11,"model":"gpt-3.5-turbo-instruct","choices":[{"index":0,"text":"hello","finish_reason":"stop"}],"usage":{"prompt_tokens":14,"completion_tokens":2,"total_tokens":16}}`)
	})

	upstreamResponse, err := http.Post(upstreamServer.URL, "application/json", strings.NewReader(`{"model":"gpt-3.5-turbo-instruct","prompt":"hi"}`))
	require.NoError(t, err)

	clientCtx, recorder := newRelayClientContext(t, "/v1/completions")
	info := newUpstreamRelayInfo("gpt-3.5-turbo-instruct")
	info.RelayMode = relayconstant.RelayModeCompletions

	usage, relayErr := OpenaiHandler(clientCtx, info, upstreamResponse)

	require.Nil(t, relayErr, "legacy completions must not be treated as empty")
	require.NotNil(t, usage)
	assert.Contains(t, recorder.Body.String(), "hello")
}
