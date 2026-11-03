package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/internal/constant"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	relayconstant "github.com/QuantumNous/new-api/internal/relay/constant"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/stretchr/testify/require"
)

// newStreamTestContext builds the minimal context/RelayInfo pair
// OaiStreamHandler needs: a chat-completions stream relay against a recorder.
func newStreamTestContext(t *testing.T, upstream string) (contract.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	// StreamScannerHandler builds a ticker from this global; zero panics.
	if constant.StreamingTimeout == 0 {
		constant.StreamingTimeout = 30
	}

	// The recorder must be the one backing the context, otherwise every body
	// assertion below reads an unwritten buffer.
	c, recorder := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(upstream)),
		Header:     http.Header{"Content-Type": []string{"text/event-stream"}},
	}
	// Build RelayInfo through the production constructor so unexported state
	// (isFirstResponse) and the StartTime/FirstResponseTime contract match a real
	// request; HasSendResponse() then flips exactly when the first chunk is sent.
	info := relaycommon.GenRelayInfoOpenAI(c, &dto.GeneralOpenAIRequest{Model: "gpt-test"})
	info.ChannelMeta = &relaycommon.ChannelMeta{UpstreamModelName: "gpt-test"}
	info.IsStream = true
	info.RelayMode = relayconstant.RelayModeChatCompletions
	return c, recorder, resp, info
}

// TestOaiStreamHandlerIncompleteUpstreamStream is the #394 regression: the
// upstream connection dies mid-stream, so no chunk ever carries finish_reason
// and no [DONE] arrives. Delivered chunks stay billable as an upstream cut
// (settled at the truncated-response multiplier), but new-api must still tell
// the client the answer is truncated instead of fabricating a terminal [DONE].
func TestOaiStreamHandlerIncompleteUpstreamStream(t *testing.T) {

	// Two content chunks, then the upstream body just ends: no finish_reason,
	// no data: [DONE].
	upstream := `data: {"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"He"}}]}

data: {"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"content":"llo"}}]}

`

	c, recorder, resp, info := newStreamTestContext(t, upstream)

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr, "delivered partial output must be settled, not refunded")
	require.NotNil(t, usage, "partial output must report usage for settlement")
	require.Greater(t, usage.CompletionTokens, 0)
	require.Equal(t, "upstream", info.StreamCutOverride,
		"EOF without [DONE] must be classified as an upstream cut")

	body := recorder.Body.String()
	require.NotContains(t, body, "data: [DONE]",
		"new-api must not fabricate a terminal [DONE] for a truncated upstream stream")
	// The failure is reported in-band as a valid SSE event, so a client parsing the
	// stream can tell truncation from a clean finish instead of hitting bare JSON.
	require.Contains(t, body, `data: {"error":`)
	require.Contains(t, body, "upstream stream closed before a finish_reason was received")
	for _, line := range strings.Split(strings.TrimSpace(body), "\n") {
		if line == "" {
			continue
		}
		require.True(t, strings.HasPrefix(line, "data: "),
			"every emitted line must stay valid SSE, got %q", line)
	}
}

// TestOaiStreamHandlerTruncatedBeforeFirstChunkIsRetryable covers the other half
// of the retry decision: the upstream died before any chunk was forwarded, so
// nothing is on the wire yet and the request can safely move to another channel.
func TestOaiStreamHandlerTruncatedBeforeFirstChunkIsRetryable(t *testing.T) {

	c, _, resp, info := newStreamTestContext(t, "")

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.NotNil(t, apiErr)
	require.Nil(t, usage)
	require.False(t, types.IsSkipRetryError(apiErr),
		"no bytes reached the client, so the request is still safe to retry")
}

// TestOaiStreamHandlerDoneWithoutFinishReasonIsComplete pins the second accepted
// terminator: some providers close with `data: [DONE]` and never set
// finish_reason. That is an explicit upstream termination, not a truncation.
func TestOaiStreamHandlerDoneWithoutFinishReasonIsComplete(t *testing.T) {

	upstream := `data: {"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"}}]}

data: [DONE]

`

	c, recorder, resp, info := newStreamTestContext(t, upstream)

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	require.Contains(t, recorder.Body.String(), "data: [DONE]")
}

// TestOaiStreamHandlerCompleteUpstreamStream pins the happy path so the #394
// guard cannot reject well-formed streams: a finish_reason chunk followed by
// [DONE] stays a success and still terminates the client stream with [DONE].
func TestOaiStreamHandlerCompleteUpstreamStream(t *testing.T) {

	upstream := `data: {"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{"role":"assistant","content":"Hello"}}]}

data: {"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}

data: [DONE]

`

	c, recorder, resp, info := newStreamTestContext(t, upstream)

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	body := recorder.Body.String()
	require.Contains(t, body, `"finish_reason":"stop"`)
	require.Contains(t, body, "data: [DONE]")
}
