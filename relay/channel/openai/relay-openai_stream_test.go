package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Upstream SSE frames used across scenarios. Content frames must round-trip
// verbatim through the relay (ForceFormat / ThinkingToContent are off).
const (
	frameRole      = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}`
	frameContent1  = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{"content":"hello streaming world"}}]}`
	frameFinish    = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`
	frameEmptyLast = `{"id":"chatcmpl-t","choices":[]}`
	frameUsageOnly = `{"id":"chatcmpl-t","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`
	// Terminal frames that combine finish_reason / tool_calls with usage: the
	// lag-by-one path swallowed these for clients that did not ask for usage,
	// dropping the finish_reason with them.
	frameToolUsage   = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"write","arguments":"{}"}}]}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`
	frameFinishUsage = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`
	// usage present but not billable under ValidUsage (only total_tokens):
	// billing falls back to local estimation.
	frameTotalOnlyUsage = `{"id":"chatcmpl-t","choices":[],"usage":{"total_tokens":15}}`
	// Content+usage frame carrying an upstream extension field; it must pass
	// through verbatim without waiting for the next frame.
	frameMixedUsageExt = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{"content":"mixed"}}],"usage":{"prompt_tokens":10,"completion_tokens":1,"total_tokens":11},"matched_stop":"<|close|>tools<|sep|>"}`
)

func setupOaiStreamTest(t *testing.T, w http.ResponseWriter, body io.Reader, includeUsage bool) (*gin.Context, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{Body: io.NopCloser(body)}
	info := &relaycommon.RelayInfo{
		ChannelMeta:        &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"},
		RelayFormat:        types.RelayFormatOpenAI,
		RelayMode:          relayconstant.RelayModeChatCompletions,
		ShouldIncludeUsage: includeUsage,
	}
	return c, resp, info
}

func buildSSE(frames ...string) string {
	var b strings.Builder
	for _, f := range frames {
		b.WriteString("data: " + f + "\n\n")
	}
	b.WriteString("data: [DONE]\n\n")
	return b.String()
}

// extractDataLines returns the payload of every `data:` event the relay wrote.
func extractDataLines(body string) []string {
	var out []string
	for line := range strings.SplitSeq(body, "\n") {
		if payload, ok := strings.CutPrefix(strings.TrimSpace(line), "data: "); ok {
			out = append(out, payload)
		}
	}
	return out
}

// Delivery contract of the direct-forward path: every upstream frame reaches
// the client exactly once, in order, verbatim — including a terminal usage
// frame the client did not ask for — and a synthetic usage frame is appended
// only when the client asked for usage the upstream never sent. Billing reads
// usage off the upstream frames exactly as before.
func TestOaiStreamHandlerDirectForwardFrameDelivery(t *testing.T) {
	tests := []struct {
		name          string
		includeUsage  bool
		frames        []string
		wantSynthetic bool // a locally built usage frame precedes [DONE]
		wantPrompt    int  // 0 means: local estimation expected (upstream sent no usage)
	}{
		{
			name:   "plain stream forwards every frame verbatim",
			frames: []string{frameRole, frameContent1, frameFinish},
		},
		{
			name:       "usage-only terminal frame delivered even when client did not ask",
			frames:     []string{frameRole, frameContent1, frameFinish, frameUsageOnly},
			wantPrompt: 10,
		},
		{
			name:         "usage-only terminal frame delivered when client asked, no synthetic duplicate",
			includeUsage: true,
			frames:       []string{frameRole, frameContent1, frameFinish, frameUsageOnly},
			wantPrompt:   10,
		},
		{
			name:          "synthetic usage frame appended when client asked and upstream sent none",
			includeUsage:  true,
			frames:        []string{frameRole, frameContent1, frameFinish},
			wantSynthetic: true,
		},
		{
			name:   "no synthetic usage frame when client did not ask and upstream sent none",
			frames: []string{frameRole, frameContent1, frameFinish},
		},
		{
			name:       "usage frame followed by an empty terminal frame is delivered in order and still billed",
			frames:     []string{frameRole, frameContent1, frameFinish, frameUsageOnly, frameEmptyLast},
			wantPrompt: 10,
		},
		{
			name:       "terminal tool_calls+usage frame delivered even when client did not ask, usage still billed",
			frames:     []string{frameRole, frameContent1, frameToolUsage},
			wantPrompt: 10,
		},
		{
			name:       "terminal finish_reason+usage frame delivered even when client did not ask, usage still billed",
			frames:     []string{frameRole, frameContent1, frameFinishUsage},
			wantPrompt: 10,
		},
		{
			name:   "usage-only frame without billable tokens delivered, billing falls back to estimation",
			frames: []string{frameRole, frameContent1, frameFinish, frameTotalOnlyUsage},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, resp, info := setupOaiStreamTest(t, recorder, strings.NewReader(buildSSE(tt.frames...)), tt.includeUsage)

			usage, apiErr := OaiStreamHandler(c, info, resp)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)

			got := extractDataLines(recorder.Body.String())
			require.NotEmpty(t, got)
			assert.Equal(t, "[DONE]", got[len(got)-1], "stream must terminate with [DONE]")
			payload := got[:len(got)-1]

			if tt.wantSynthetic {
				require.Len(t, payload, len(tt.frames)+1)
				assert.Contains(t, payload[len(payload)-1], `"prompt_tokens"`,
					"client asked for usage the upstream never sent: relay appends its own usage frame")
				payload = payload[:len(payload)-1]
			}
			assert.Equal(t, tt.frames, payload, "every upstream frame must be delivered exactly once, in order, verbatim")

			if tt.wantPrompt > 0 {
				assert.Equal(t, tt.wantPrompt, usage.PromptTokens, "usage must come from the upstream usage frame")
			} else {
				assert.Positive(t, usage.CompletionTokens, "no upstream usage: relay falls back to local estimation")
			}
		})
	}
}

// syncFrameRecorder is a race-free ResponseWriter for the causality test: the
// handler writes from its own goroutine while the test polls snapshot().
type syncFrameRecorder struct {
	mu     sync.Mutex
	header http.Header
	buf    strings.Builder
}

func newSyncFrameRecorder() *syncFrameRecorder {
	return &syncFrameRecorder{header: make(http.Header)}
}

func (r *syncFrameRecorder) Header() http.Header { return r.header }
func (r *syncFrameRecorder) WriteHeader(int)     {}
func (r *syncFrameRecorder) Flush()              {}
func (r *syncFrameRecorder) Write(p []byte) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.buf.Write(p)
}
func (r *syncFrameRecorder) snapshot() string {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.buf.String()
}

// The core contract this change exists for: a frame is delivered downstream
// without waiting for the NEXT upstream frame. The upstream is a pipe fed one
// frame at a time; each write must become visible downstream while the pipe
// stays open and silent — under lag-by-one nothing is forwarded until the
// following frame lands.
func TestOaiStreamHandlerDirectForwardDoesNotWaitForNextFrame(t *testing.T) {
	pr, pw := io.Pipe()
	recorder := newSyncFrameRecorder()
	c, resp, info := setupOaiStreamTest(t, recorder, pr, false)

	done := make(chan struct{})
	go func() {
		defer close(done)
		_, _ = OaiStreamHandler(c, info, resp)
	}()

	writeFrame := func(frame string) {
		_, err := pw.Write([]byte("data: " + frame + "\n\n"))
		require.NoError(t, err)
	}

	waitForwarded := func(marker string) {
		require.Eventually(t, func() bool {
			return strings.Contains(recorder.snapshot(), marker)
		}, 3*time.Second, 5*time.Millisecond,
			"frame %q must be forwarded before any later frame arrives", marker)
	}

	writeFrame(frameRole)
	waitForwarded(`"role":"assistant"`)

	// Content+usage frame with an upstream extension field: must go out
	// immediately and verbatim.
	writeFrame(frameMixedUsageExt)
	waitForwarded(`"matched_stop":"<|close|>tools<|sep|>"`)

	writeFrame(frameContent1)
	waitForwarded("hello streaming world")

	writeFrame(frameFinish)
	waitForwarded(`"finish_reason":"stop"`)

	writeFrame("[DONE]")
	require.NoError(t, pw.Close())
	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("handler did not finish after [DONE]")
	}

	got := extractDataLines(recorder.snapshot())
	assert.Equal(t, []string{frameRole, frameMixedUsageExt, frameContent1, frameFinish, "[DONE]"}, got,
		"final transcript must match the upstream frames exactly once, in order, verbatim")
}
