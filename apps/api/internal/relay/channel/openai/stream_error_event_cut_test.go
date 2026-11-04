package openai

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// A reseller can answer 200 and then stream an error object mid-stream. Before
// this cut classification existed such a stream looked like a clean completion
// whenever the upstream followed the error with [DONE]: the client kept a
// partial answer and billing charged the full price. The error event is the
// upstream's own statement that the stream broke, so it is billed as an
// upstream cut unless the answer was already complete.

const resellerErrorChunk = `data: {"error":{"message":"upstream stream interrupted after 3 frames","type":"internal_error"}}` + "\n\n"

const stopFinishReasonChunk = `data: {"id":"c1","object":"chat.completion.chunk","created":1710000000,"model":"gpt-test","choices":[{"index":0,"delta":{},"finish_reason":"stop"}]}` + "\n\n"

const terminalDoneChunk = "data: [DONE]\n\n"

// assertCutOnBothPaths runs the same upstream through the passthrough fast path
// and the converting slow path: the cut classification must not depend on which
// forwarder handled the stream (the in-loop finish signal lives in different
// variables on each path).
func assertCutOnBothPaths(t *testing.T, upstream, wantCut string) {
	t.Helper()
	for _, tc := range []struct {
		name string
		slow bool
	}{
		{name: "fast path", slow: false},
		{name: "slow path", slow: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			c, recorder, resp, info := newStreamTestContext(t, upstream)
			info.ChannelSetting.ForceFormat = tc.slow
			require.Equal(t, !tc.slow, canCopyAndObserve(info), "test must exercise the intended forwarder")

			usage, apiErr := OaiStreamHandler(c, info, resp)

			require.Nil(t, apiErr, "delivered output must settle, not fail")
			require.NotNil(t, usage)
			assert.Equal(t, wantCut, info.StreamCutOverride)
			assert.True(t, info.StreamStatus.HasErrors(), "the soft error is still recorded either way")
			assert.NotEmpty(t, recorder.Body.String())
		})
	}
}

// TestOaiStreamHandlerUpstreamErrorEventBeforeFinishIsUpstreamCut covers the
// reseller pattern that motivated the cut marker: partial content, an in-band
// error event, then a clean [DONE]. The client received a truncated answer and
// the upstream said so, so the charge must follow the upstream-cut policy.
func TestOaiStreamHandlerUpstreamErrorEventBeforeFinishIsUpstreamCut(t *testing.T) {
	assertCutOnBothPaths(t,
		contentChunk("partial")+resellerErrorChunk+terminalDoneChunk,
		"upstream")
}

// TestOaiStreamHandlerUpstreamErrorEventAfterFinishKeepsFullCharge pins the
// other side of the rule: once the upstream declared finish_reason, the answer
// is complete and a later error event (trailing metadata, usage fetch failure)
// must not discount it.
func TestOaiStreamHandlerUpstreamErrorEventAfterFinishKeepsFullCharge(t *testing.T) {
	assertCutOnBothPaths(t,
		contentChunk("complete")+stopFinishReasonChunk+resellerErrorChunk+terminalDoneChunk,
		"")
}

// TestOaiStreamHandlerUpstreamErrorEventBeforeOutputFails keeps the ordering
// invariant: with no visible output yet the request stops and fails before the
// cut marker is ever considered, so it still refunds instead of charging.
func TestOaiStreamHandlerUpstreamErrorEventBeforeOutputFails(t *testing.T) {
	c, _, resp, info := newStreamTestContext(t, resellerErrorChunk+terminalDoneChunk)

	usage, apiErr := OaiStreamHandler(c, info, resp)

	require.NotNil(t, apiErr, "no visible output: the call must fail instead of settling")
	require.Nil(t, usage)
	assert.Empty(t, info.StreamCutOverride, "a refunded call is never cut-classified")
}
