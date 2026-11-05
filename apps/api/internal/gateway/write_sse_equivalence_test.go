package gateway

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRenderSSEMatchesCustomEventFraming is the equivalence proof for moving
// RenderSSE off c.ResponseWriter() and onto contract.ResponseStream.
//
// It renders every payload shape the relay emits through both paths: the
// framing primitive on its own (CustomEvent.RenderTo onto a plain buffer) and
// the migrated one through the contract, then compares the bytes and the
// headers. The shapes matter individually because CustomEvent is not a uniform
// framer: it escapes CR, and appends the blank-line terminator only when the
// payload starts with "data", so `event:` prefixes and partial frames pass
// through unterminated. Routing these through EventStream.WriteEvent instead
// would terminate and re-prefix all of them, which is why RenderSSE stayed on
// this path.
//
// The header half is asserted against the literal SSE values the deleted
// CustomEvent.WriteContentType wrote ("text/event-stream", and "no-cache" when
// nothing set Cache-Control); its conditional branch is pinned separately by
// TestRenderSSEPreservesAnExistingCacheControl below.
func TestRenderSSEMatchesCustomEventFraming(t *testing.T) {

	for _, tc := range []struct {
		name    string
		payload string
	}{
		{name: "data frame", payload: `data: {"choices":[{"delta":{"content":"hi"}}]}`},
		{name: "terminal sentinel", payload: "data: [DONE]"},
		{name: "named event prefix", payload: "event: message_start\n"},
		{name: "claude data line", payload: "data: {\"type\":\"content_block_delta\"}\n"},
		{name: "payload carrying CR", payload: "data: {\"text\":\"a\rb\"}"},
		{name: "payload carrying LF", payload: "data: {\"text\":\"a\nb\"}"},
		{name: "empty data", payload: "data: "},
		{name: "unprefixed payload stays unterminated", payload: "ping"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			// Framing reference: the writer-neutral primitive RenderSSE builds on.
			var framed bytes.Buffer
			require.NoError(t, common.CustomEvent{Data: tc.payload}.RenderTo(&framed))

			// Migrated path, through contract.ResponseStream. A synthetic context
			// is the right fixture: only the completed body and headers matter,
			// and in synthetic mode writes land in the recorder as they happen
			// while the staged header map aliases the recorder's own.
			ctx, migrated := fiberadapter.NewSyntheticContext(
				httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))
			RenderSSE(ctx, tc.payload)

			assert.Equal(t, framed.String(), migrated.Body.String(),
				"SSE bytes must be identical to the CustomEvent framing primitive")
			assert.Equal(t, "text/event-stream", migrated.Header().Get("Content-Type"))
			assert.Equal(t, "no-cache", migrated.Header().Get("Cache-Control"))
		})
	}
}

// TestRenderSSEPreservesAnExistingCacheControl pins the conditional half of the
// header write. CustomEvent installs Cache-Control only when nothing set it, so
// a route that already applied a stricter no-store policy keeps it. Replacing
// that read with an unconditional Set would silently downgrade those responses.
func TestRenderSSEPreservesAnExistingCacheControl(t *testing.T) {
	const stricter = "no-store, no-cache, must-revalidate, private, max-age=0"

	adapted, recorder := fiberadapter.NewSyntheticContext(
		httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))
	adapted.SetHeader("Cache-Control", stricter)

	RenderSSE(adapted, "data: {}")

	assert.Equal(t, stricter, recorder.Header().Get("Cache-Control"),
		"an already-set Cache-Control must survive the SSE header write")
	assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
}

// unflushableStream is a contract.ResponseStream that reports the flush
// capability as absent while its Flush silently succeeds, standing in for the
// dangerous transport: one that accepts every flush and buffers the response to
// completion anyway (a wrapping middleware that materialises the body, or a
// writer with no flusher underneath).
//
// Faking at the contract is a correction, not a workaround for fiber. The previous
// fixture built an http.ResponseWriter with no Flush method, which asserted
// through a layer the code under test never consults: FlushWriter and
// IOCopyBytesGracefully branch on contract CanFlush, never on an
// http.ResponseWriter type assertion. That fixture only worked because
// the previous adapter answered CanFlush by walking the writer's Unwrap chain.
// Under fasthttp there is no such writer to build at all — the adapter reports
// CanFlush as a constant true because every mode it constructs can push (a chain
// owns the pipe, a direct response writes through fiber, a synthetic one records
// the flush on its recorder) — so the contract is both the honest and the only
// available interception point. That a real adapter keeps Flush and CanFlush in
// agreement is pinned separately, by the conformance suite's
// CanFlushAgreesWithFlushAndHasNoSideEffect.
type unflushableStream struct {
	contract.ResponseStream
}

func (unflushableStream) CanFlush() bool { return false }

// Flush succeeds silently, and MUST keep doing so. It is what makes this fixture
// able to fail: FlushWriter's error can then only come from the CanFlush branch,
// so deleting that branch fails the test (verified by mutation). Returning an
// error here instead looks stricter but satisfies the assertion by itself, and
// the test would then pass with the guard removed — a test that cannot fail.
// A transport that buffers while accepting flushes is also the realistic hazard;
// one that reports its own failure is already observable.
func (unflushableStream) Flush() error { return nil }

// transportContext aliases the contract so unflushableContext can embed it
// without the embedded field name shadowing Context(), the request-lifetime
// accessor the gateway's own guards read.
type transportContext = contract.Context

// unflushableContext hands out the unflushable stream while leaving every other
// accessor on the real adapter, so RenderSSE still writes through the transport
// it would use in production.
type unflushableContext struct {
	transportContext
}

func (c unflushableContext) ResponseStream() contract.ResponseStream {
	return unflushableStream{c.transportContext.ResponseStream()}
}

// TestFlushFallbackStaysObservableWithoutFlushSupport is the flush-fallback
// proof. CanFlush exists so a stream that cannot flush is a reported condition
// rather than one that quietly buffers to completion and looks to an operator
// like a stalled provider.
//
// It asserts three things: the capability probe says no, the relay flush helper
// reports that rather than degrading silently, and the payload bytes still reach
// the response so the answer is correct even though it is not incremental.
func TestFlushFallbackStaysObservableWithoutFlushSupport(t *testing.T) {
	base, recorder := fiberadapter.NewSyntheticContext(
		httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))
	adapted := unflushableContext{base}

	stream := adapted.ResponseStream()
	require.NotNil(t, stream)

	assert.False(t, stream.CanFlush(),
		"a stream with no flush support must report that it cannot flush")

	assert.Error(t, FlushWriter(adapted),
		"the relay flush helper must report the missing flusher rather than degrade silently")

	RenderSSE(adapted, "data: {}")
	assert.Equal(t, "data: {}\n\n", recorder.Body.String(),
		"the frame must still be written even when the stream cannot flush")
	assert.False(t, recorder.Flushed,
		"no flush may have reached the client through a stream that reports it cannot")

	assert.False(t, stream.SetWriteDeadline(time.Now().Add(time.Second)),
		"a stream with no connection underneath must report the deadline as unsupported")
}

// TestFlushSupportedWriterReportsAndFlushes is the positive half: on the real
// stream the same probe says yes and the flush is observed, so the fallback above
// is a genuine capability difference and not a probe that always reports false.
func TestFlushSupportedWriterReportsAndFlushes(t *testing.T) {
	adapted, recorder := fiberadapter.NewSyntheticContext(
		httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

	stream := adapted.ResponseStream()
	require.NotNil(t, stream)

	assert.True(t, stream.CanFlush())
	require.NoError(t, stream.Flush())
	require.NoError(t, FlushWriter(adapted))
	assert.True(t, recorder.Flushed, "a flushable stream must actually be flushed")
}
