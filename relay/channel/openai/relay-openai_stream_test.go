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

func init() {
	gin.SetMode(gin.TestMode)
	if constant.StreamingTimeout == 0 {
		constant.StreamingTimeout = 30
	}
}

// Upstream SSE frames used across scenarios. Content frames must round-trip
// verbatim through the relay (ForceFormat / ThinkingToContent are off).
const (
	frameRole      = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{"role":"assistant","content":""}}]}`
	frameContent1  = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{"content":"hello streaming world"}}]}`
	frameContent2  = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{"content":"second chunk"}}]}`
	frameFinish    = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}`
	frameUsageOnly = `{"id":"chatcmpl-t","choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`
	frameMidUsage  = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{"content":"with usage"}}],"usage":{"prompt_tokens":10,"completion_tokens":3,"total_tokens":13}}`
	// Terminal frames that combine choices with a piggybacked usage: the
	// lag-by-one path swallowed these when the client did not ask for usage;
	// direct forward delivers them (choices non-empty → never held), which
	// only ever adds the upstream's own legal data.
	frameToolUsage   = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call_1","type":"function","function":{"name":"write","arguments":"{}"}}]}}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`
	frameFinishUsage = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}],"usage":{"prompt_tokens":10,"completion_tokens":5,"total_tokens":15}}`
	// usage present but not billable under ValidUsage (only total_tokens):
	// held as a usage-only candidate, then delivered because the verdict
	// cannot bill it; billing falls back to local estimation — same
	// transcript and billing as the lag-by-one path.
	frameTotalOnlyUsage = `{"id":"chatcmpl-t","choices":[],"usage":{"total_tokens":15}}`
	// Mixed content+usage frame carrying an upstream extension field; direct
	// forward must pass it through verbatim without waiting for the next
	// frame.
	frameMixedUsageExt = `{"id":"chatcmpl-t","choices":[{"index":0,"delta":{"content":"mixed"}}],"usage":{"prompt_tokens":10,"completion_tokens":1,"total_tokens":11},"matched_stop":"<|close|>tools<|sep|>"}`
)

func setupOaiStreamTest(w http.ResponseWriter, body io.Reader, includeUsage bool) (*gin.Context, *http.Response, *relaycommon.RelayInfo) {
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
	for _, line := range strings.Split(body, "\n") {
		if payload, ok := strings.CutPrefix(strings.TrimSpace(line), "data: "); ok {
			out = append(out, payload)
		}
	}
	return out
}

// The delivery contract of the direct-forward path against the legacy verdict
// semantics: every frame is delivered exactly once in order, the usage-only
// terminal frame is swallowed or kept per stream_options.include_usage, and a
// synthetic usage frame is appended only when the client asked for usage the
// upstream never sent.
func TestOaiStreamHandlerDirectForwardFrameDelivery(t *testing.T) {
	tests := []struct {
		name          string
		includeUsage  bool
		frames        []string
		wantForwarded []string
		wantSynthetic bool // a locally built usage frame precedes [DONE]
		wantPrompt    int  // 0 means: local estimation expected (upstream sent no usage)
	}{
		{
			name:          "plain stream forwards every frame verbatim",
			frames:        []string{frameRole, frameContent1, frameFinish},
			wantForwarded: []string{frameRole, frameContent1, frameFinish},
		},
		{
			name:          "usage-only terminal frame swallowed when client did not ask",
			frames:        []string{frameRole, frameContent1, frameFinish, frameUsageOnly},
			wantForwarded: []string{frameRole, frameContent1, frameFinish},
			wantPrompt:    10,
		},
		{
			name:          "usage-only terminal frame kept when client asked",
			includeUsage:  true,
			frames:        []string{frameRole, frameContent1, frameFinish, frameUsageOnly},
			wantForwarded: []string{frameRole, frameContent1, frameFinish, frameUsageOnly},
			wantPrompt:    10,
		},
		{
			name:          "synthetic usage frame appended when upstream sent none",
			includeUsage:  true,
			frames:        []string{frameRole, frameContent1, frameFinish},
			wantForwarded: []string{frameRole, frameContent1, frameFinish},
			wantSynthetic: true,
		},
		{
			name:          "mid-stream usage frame released in order",
			frames:        []string{frameRole, frameMidUsage, frameContent2, frameFinish},
			wantForwarded: []string{frameRole, frameMidUsage, frameContent2, frameFinish},
		},
		{
			name:          "terminal tool_calls+usage frame delivered, usage still billed",
			frames:        []string{frameRole, frameContent1, frameToolUsage},
			wantForwarded: []string{frameRole, frameContent1, frameToolUsage},
			wantPrompt:    10,
		},
		{
			name:          "terminal finish_reason+usage frame delivered, usage still billed",
			frames:        []string{frameRole, frameContent1, frameFinishUsage},
			wantForwarded: []string{frameRole, frameContent1, frameFinishUsage},
			wantPrompt:    10,
		},
		{
			name:          "usage-only frame without billable tokens delivered, billing falls back to estimation",
			frames:        []string{frameRole, frameContent1, frameFinish, frameTotalOnlyUsage},
			wantForwarded: []string{frameRole, frameContent1, frameFinish, frameTotalOnlyUsage},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			c, resp, info := setupOaiStreamTest(recorder, strings.NewReader(buildSSE(tt.frames...)), tt.includeUsage)

			usage, apiErr := OaiStreamHandler(c, info, resp)
			require.Nil(t, apiErr)
			require.NotNil(t, usage)

			got := extractDataLines(recorder.Body.String())
			require.NotEmpty(t, got)
			assert.Equal(t, "[DONE]", got[len(got)-1], "stream must terminate with [DONE]")
			payload := got[:len(got)-1]

			if tt.wantSynthetic {
				require.Len(t, payload, len(tt.wantForwarded)+1)
				assert.Contains(t, payload[len(payload)-1], `"prompt_tokens"`,
					"client asked for usage the upstream never sent: relay appends its own usage frame")
				payload = payload[:len(payload)-1]
			}
			assert.Equal(t, tt.wantForwarded, payload, "frames must be delivered exactly once, in order")

			if tt.wantPrompt > 0 {
				assert.Equal(t, tt.wantPrompt, usage.PromptTokens, "usage must come from the upstream terminal frame")
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

// The core contract this change exists for: with direct forward on, a frame is
// delivered downstream without waiting for the NEXT upstream frame. The
// upstream is a pipe fed one frame at a time; each write must become visible
// downstream while the pipe stays open and silent — under lag-by-one this test
// fails because nothing is forwarded until the following frame lands.
func TestOaiStreamHandlerDirectForwardDoesNotWaitForNextFrame(t *testing.T) {
	pr, pw := io.Pipe()
	recorder := newSyncFrameRecorder()
	c, resp, info := setupOaiStreamTest(recorder, pr, false)

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

	// Mixed content+usage frame with an upstream extension field: must go out
	// immediately (choices non-empty → never held) and verbatim.
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

// processTokenData's hold report decides which frames the direct-forward path
// holds for the terminal verdict. A usage-only candidate is a frame whose
// usage object is present with empty choices; any frame with choices streams
// immediately, even with a piggybacked usage — a wrong report either leaks a
// swallowable usage-only frame or re-introduces the one-frame lag on business
// frames.
func TestProcessTokenDataUsageReport(t *testing.T) {
	tests := []struct {
		name      string
		relayMode int
		data      string
		want      bool
		wantErr   bool
	}{
		{name: "chat usage-only frame held", relayMode: relayconstant.RelayModeChatCompletions, data: frameUsageOnly, want: true},
		{name: "chat usage-only frame with unbillable usage still held", relayMode: relayconstant.RelayModeChatCompletions, data: frameTotalOnlyUsage, want: true},
		{name: "chat usage-only frame with zeroed usage still held", relayMode: relayconstant.RelayModeChatCompletions, data: `{"id":"x","choices":[],"usage":{"prompt_tokens":0,"completion_tokens":0}}`, want: true},
		{name: "chat frame with usage null not held", relayMode: relayconstant.RelayModeChatCompletions, data: `{"id":"x","choices":[],"usage":null}`, want: false},
		{name: "chat content frame not held", relayMode: relayconstant.RelayModeChatCompletions, data: frameContent1, want: false},
		{name: "chat content+usage mixed frame not held", relayMode: relayconstant.RelayModeChatCompletions, data: frameMidUsage, want: false},
		{name: "chat tool_calls+usage mixed frame not held", relayMode: relayconstant.RelayModeChatCompletions, data: frameToolUsage, want: false},
		{name: "chat finish_reason+usage frame not held", relayMode: relayconstant.RelayModeChatCompletions, data: frameFinishUsage, want: false},
		{name: "chat frame malformed", relayMode: relayconstant.RelayModeChatCompletions, data: `{not json`, wantErr: true},
		{name: "completions frame without usage not held", relayMode: relayconstant.RelayModeCompletions, data: `{"choices":[{"text":"a"}]}`, want: false},
		{name: "completions text+usage mixed frame not held", relayMode: relayconstant.RelayModeCompletions, data: `{"choices":[{"text":"a"}],"usage":{"prompt_tokens":7,"completion_tokens":2}}`, want: false},
		{name: "completions usage-only frame held", relayMode: relayconstant.RelayModeCompletions, data: `{"choices":[],"usage":{"prompt_tokens":7,"completion_tokens":2}}`, want: true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var sb strings.Builder
			var toolCount int
			got, err := processTokenData(tt.relayMode, tt.data, &sb, &toolCount)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}
