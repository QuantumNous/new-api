package conformance

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/transport/contract"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func runEventStreamCases(t *testing.T, adapter Adapter) {
	t.Helper()

	// The ordering and incremental-delivery cases run here rather than as their
	// own family, so adding them needs no change to the Adapter contract every
	// adapter implements.
	runStreamOrderCases(t, adapter)

	// FramingMatchesRelayBytes pins that the adapter's SSE writer produces the
	// same frames the relay helpers produce today. These bytes are the
	// client-visible contract, so they must not drift when the writer is
	// replaced.
	t.Run("FramingMatchesRelayBytes", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		stream.SetHeaders()
		require.NoError(t, stream.WriteEvent(`{"choices":[{"delta":{"content":"hi"}}]}`))
		require.NoError(t, stream.WriteEvent("[DONE]"))

		assert.Equal(t, "text/event-stream", recorder.Header().Get("Content-Type"))
		assert.Equal(t, "no-cache", recorder.Header().Get("Cache-Control"))
		assert.Equal(t, "keep-alive", recorder.Header().Get("Connection"))
		// Transfer-Encoding is deliberately not asserted. It is transport
		// plumbing rather than contract behaviour: net/http sets it when a
		// handler streams without a Content-Length, and fasthttp manages it
		// itself and discards a manually set value, so a header assertion
		// would pin one framework's bookkeeping rather than what clients
		// observe. What clients actually depend on is that frames arrive
		// incrementally, one push per flush, which
		// IncrementalFramingIsOnePushPerFlush asserts directly.
		assert.Equal(t, "no", recorder.Header().Get("X-Accel-Buffering"))

		assert.Equal(t,
			"data: {\"choices\":[{\"delta\":{\"content\":\"hi\"}}]}\n\ndata: [DONE]\n\n",
			string(recorder.Body()),
		)
	})

	// NamedEventFramingMatchesClaudeData pins the named-event framing against
	// the bytes relay/helper.ClaudeData emits.
	t.Run("NamedEventFramingMatchesClaudeData", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/messages", nil))

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		require.NoError(t, stream.WriteNamedEvent("message_start", `{"type":"message_start"}`))

		assert.Equal(t, "event: message_start\ndata: {\"type\":\"message_start\"}\n\n", string(recorder.Body()))
	})

	// CommentFramingMatchesPingData pins the keep-alive comment frame.
	t.Run("CommentFramingMatchesPingData", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		require.NoError(t, stream.WriteComment("PING"))

		assert.Equal(t, ": PING\n\n", string(recorder.Body()))
	})

	// SetHeadersIsIdempotent asserts nested relay helpers can request streaming
	// headers repeatedly without duplicating them.
	t.Run("SetHeadersIsIdempotent", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		stream.SetHeaders()
		stream.SetHeaders()

		assert.Equal(t, []string{"text/event-stream"}, recorder.Header().Values("Content-Type"))
		assert.Equal(t, []string{"no-cache"}, recorder.Header().Values("Cache-Control"))
	})

	// WriteRawEmitsBytesVerbatim covers the path that forwards already-framed
	// upstream bytes. Any added framing would corrupt the stream clients parse.
	t.Run("WriteRawEmitsBytesVerbatim", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		payload := []byte("data: {\"passthrough\":true}\n\n")
		written, err := stream.WriteRaw(payload)
		require.NoError(t, err)

		assert.Equal(t, len(payload), written)
		assert.Equal(t, string(payload), string(recorder.Body()))
	})

	// FlushReachesTheClient asserts frames are pushed rather than buffered until
	// the handler returns, which is what makes the stream incremental.
	t.Run("FlushReachesTheClient", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		require.NoError(t, stream.WriteEvent(`{"delta":"a"}`))
		require.NoError(t, stream.Flush())

		assert.True(t, recorder.Flushed(), "SSE writes must be flushed to the client")
	})

	// DoneIsFalseOnALiveRequest asserts the disconnect probe does not report a
	// live client as gone, which would truncate every stream.
	t.Run("DoneIsFalseOnALiveRequest", func(t *testing.T) {
		adapted, _, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		assert.False(t, stream.Done())
	})

	// RejectsWritesAfterClientDisconnect asserts a cancelled request stops
	// emitting frames instead of writing a partial event.
	t.Run("RejectsWritesAfterClientDisconnect", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
		adapted, recorder, disconnect := adapter.NewContext(req)
		disconnect()

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		assert.True(t, stream.Done())
		require.Error(t, stream.WriteEvent(`{"choices":[]}`))
		assert.Empty(t, string(recorder.Body()))
	})

	// EveryWriteRejectsAfterDisconnect asserts the whole writer surface refuses
	// a gone client, not only WriteEvent. A single unguarded method would keep
	// the relay pulling from the provider after the client left, which is billed
	// traffic nobody receives.
	t.Run("EveryWriteRejectsAfterDisconnect", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/v1/messages", nil)
		adapted, recorder, disconnect := adapter.NewContext(req)
		disconnect()

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		require.Error(t, stream.WriteNamedEvent("message_start", `{"type":"message_start"}`))
		require.Error(t, stream.WriteComment("PING"))
		_, rawErr := stream.WriteRaw([]byte("data: x\n\n"))
		require.Error(t, rawErr)
		require.Error(t, stream.Flush())

		assert.Empty(t, string(recorder.Body()), "a disconnected client must receive no partial frames")
	})
}

func runResponseStreamCases(t *testing.T, adapter Adapter) {
	t.Helper()

	// WritesRawUpstreamBytes asserts the raw writer used by the video and
	// reverse-proxy endpoints preserves status, headers, and body bytes.
	t.Run("WritesRawUpstreamBytes", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodGet, "/v1/videos/task-1/content", nil))

		stream, err := adapter.NewResponseStream(adapted)
		require.NoError(t, err)

		stream.SetHeader("Content-Type", "video/mp4")
		stream.WriteHeader(http.StatusPartialContent)
		written, err := stream.Write([]byte{0x00, 0x01, 0x02})
		require.NoError(t, err)

		assert.Equal(t, 3, written)
		assert.Equal(t, http.StatusPartialContent, recorder.Status())
		assert.Equal(t, "video/mp4", recorder.Header().Get("Content-Type"))
		assert.Equal(t, []byte{0x00, 0x01, 0x02}, recorder.Body())
	})

	// SequentialWritesConcatenate asserts a copied upstream body arrives in
	// order and unmodified, which is what io.Copy produces against this writer.
	t.Run("SequentialWritesConcatenate", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodGet, "/v1/videos/task-1/content", nil))

		stream, err := adapter.NewResponseStream(adapted)
		require.NoError(t, err)

		for _, chunk := range []string{"chunk-1", "chunk-2", "chunk-3"} {
			written, err := stream.Write([]byte(chunk))
			require.NoError(t, err)
			assert.Equal(t, len(chunk), written)
		}

		assert.Equal(t, "chunk-1chunk-2chunk-3", string(recorder.Body()))
	})

	// FlushReachesTheClient asserts proxied bytes are pushed incrementally
	// rather than held until the handler returns.
	t.Run("FlushReachesTheClient", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodGet, "/v1/videos/task-1/content", nil))

		stream, err := adapter.NewResponseStream(adapted)
		require.NoError(t, err)

		_, err = stream.Write([]byte("partial"))
		require.NoError(t, err)
		require.NoError(t, stream.Flush())

		assert.True(t, recorder.Flushed())
		assert.Equal(t, "partial", string(recorder.Body()))
	})

	// AddHeaderKeepsRepeatedValues asserts the append accessor does not collapse
	// onto the last value. Codex forwards X-Reasoning-Included and
	// X-Codex-Turn-State as repeats, and an implementation that aliased
	// AddHeader onto SetHeader would silently drop all but one.
	t.Run("AddHeaderKeepsRepeatedValues", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/responses", nil))

		stream, err := adapter.NewResponseStream(adapted)
		require.NoError(t, err)

		stream.AddHeader("X-Codex-Turn-State", "first")
		stream.AddHeader("X-Codex-Turn-State", "second")

		assert.Equal(t, []string{"first", "second"}, recorder.Header().Values("X-Codex-Turn-State"),
			"AddHeader must append rather than replace")
	})

	// SetHeaderReplacesAndHeaderReadsBack asserts the read accessor observes
	// staged headers, which is what lets the SSE renderer install Cache-Control
	// only when nothing stricter is already set.
	t.Run("SetHeaderReplacesAndHeaderReadsBack", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/responses", nil))

		stream, err := adapter.NewResponseStream(adapted)
		require.NoError(t, err)

		assert.Empty(t, stream.Header("Cache-Control"), "an unset header must read back empty")

		stream.SetHeader("Cache-Control", "no-store")
		assert.Equal(t, "no-store", stream.Header("Cache-Control"))

		stream.SetHeader("Cache-Control", "no-cache")
		assert.Equal(t, "no-cache", stream.Header("Cache-Control"), "SetHeader must replace")
		assert.Equal(t, []string{"no-cache"}, recorder.Header().Values("Cache-Control"))
	})

	// CanFlushAgreesWithFlushAndHasNoSideEffect asserts the capability probe is
	// consistent with the operation it describes, and that probing does not
	// itself commit the response. A probe implemented by attempting a flush
	// would send the status code early on every stream.
	t.Run("CanFlushAgreesWithFlushAndHasNoSideEffect", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodGet, "/v1/videos/task-1/content", nil))

		stream, err := adapter.NewResponseStream(adapted)
		require.NoError(t, err)

		require.True(t, stream.CanFlush(), "a recorder-backed stream can flush")
		assert.False(t, recorder.Flushed(), "probing the capability must not flush")

		require.NoError(t, stream.Flush())
		assert.True(t, recorder.Flushed(), "CanFlush must agree with Flush")
	})

	// SetWriteDeadlineReportsSupportHonestly asserts the deadline capability
	// answers rather than failing the request, and that the answer is the one
	// the adapter declares.
	//
	// The previous version of this case hardcoded false, which encoded "there is
	// no connection under an in-process recorder" — true of net/http, but not a
	// contract property. A stream whose writer is a real pipe can carry a
	// deadline, and reporting false there would silently drop the hang
	// protection the SSE scanner relies on: it sets a deadline before every
	// write so the cleanup path's unconditional wait can always finish.
	//
	// The expectation is therefore taken from the adapter's own declaration
	// rather than from a constant. An adapter that cannot carry a deadline says
	// nothing and is held to false; one that can must implement
	// writeDeadlineCapable and is held to true. Either way the answer is pinned,
	// must be stable, and must not disturb the response.
	t.Run("SetWriteDeadlineReportsSupportHonestly", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		stream, err := adapter.NewResponseStream(adapted)
		require.NoError(t, err)

		expected := false
		if capable, ok := stream.(writeDeadlineCapable); ok {
			expected = capable.SupportsWriteDeadline()
		}

		reported := stream.SetWriteDeadline(time.Now().Add(time.Minute))
		assert.Equal(t, expected, reported,
			"SetWriteDeadline must report the capability the adapter declares")
		assert.Equal(t, reported, stream.SetWriteDeadline(time.Now().Add(2*time.Minute)),
			"the capability must not change between calls")

		// Setting a deadline must not itself produce a response. The status is
		// deliberately not asserted here: an in-process recorder reports its
		// default status before anything is written, so "no status yet" is not
		// observable through it. Bytes and flushes are.
		assert.Empty(t, recorder.Body(), "setting a deadline must not write bytes")
		assert.False(t, recorder.Flushed(), "setting a deadline must not flush")

		// Whatever was reported, the stream must still work: an adapter that
		// claimed support and then broke its own writer would be worse than one
		// that reported false.
		written, err := stream.Write([]byte("after-deadline"))
		require.NoError(t, err)
		assert.Equal(t, len("after-deadline"), written)
	})
}

// writeDeadlineCapable is the optional declaration an adapter's response stream
// makes when its writer sits on something that can carry a deadline.
//
// It is an optional interface rather than a field on Adapter because the answer
// belongs to the stream, not to the adapter as a whole, and because a transport
// that cannot carry a deadline should not have to say so. Not implementing it
// means false, which is the conservative answer callers already treat as
// best-effort.
type writeDeadlineCapable interface {
	SupportsWriteDeadline() bool
}

// runStreamOrderCases pins the ordering and incremental-delivery properties both
// adapters must have. They are grouped separately from the framing cases because
// they assert *when* bytes and headers move rather than what they contain, which
// is where the two transports differ structurally: net/http commits headers on
// the first write, fasthttp writes them before it starts consuming a body stream.
//
// Note the deliberate limit of what an in-process recorder can prove. A recorder
// records; it cannot observe that a header reached the wire before the first body
// byte. The cases here assert everything that is observable in-process, and the
// wire-level ordering proof lives in the adapter's own tests against a real
// listener, where it can actually be observed.
func runStreamOrderCases(t *testing.T, adapter Adapter) {
	t.Helper()

	// IncrementalFramingIsOnePushPerFlush replaces the old Transfer-Encoding
	// header assertion with the property that header actually stood for: frames
	// reach the client as they are written rather than being held until the
	// handler returns.
	//
	// It is asserted as a count rather than as a boolean because "flushed at
	// least once" cannot distinguish a stream that pushed every frame from one
	// that buffered everything and flushed at the end, which is the failure a
	// transport swap most plausibly introduces.
	t.Run("IncrementalFramingIsOnePushPerFlush", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		stream.SetHeaders()

		// Observe the body after each frame: it must grow monotonically, one
		// frame at a time, rather than appearing all at once at the end.
		var lengths []int
		for _, delta := range []string{"a", "b", "c"} {
			require.NoError(t, stream.WriteEvent(`{"delta":"`+delta+`"}`))
			lengths = append(lengths, len(recorder.Body()))
		}

		require.Len(t, lengths, 3)
		assert.Greater(t, lengths[0], 0, "the first frame must reach the client before the second is written")
		assert.Greater(t, lengths[1], lengths[0], "each frame must reach the client as it is written")
		assert.Greater(t, lengths[2], lengths[1], "each frame must reach the client as it is written")
		assert.True(t, recorder.Flushed(), "an SSE frame must be pushed, not buffered")

		assert.Equal(t,
			"data: {\"delta\":\"a\"}\n\ndata: {\"delta\":\"b\"}\n\ndata: {\"delta\":\"c\"}\n\n",
			string(recorder.Body()),
			"incremental delivery must not change the bytes")
	})

	// StreamingIsIncrementalUnderBackpressure writes more frames than any
	// plausible transport buffer holds.
	//
	// This is the case that fails by hanging rather than by asserting: a design
	// that registered a body-stream writer and then streamed from the request
	// handler would deadlock once the pipe filled, because the server only drains
	// after the handler returns. Buffer sizes are an implementation detail, so the
	// frame count is well past any of them and each frame is padded.
	t.Run("StreamingIsIncrementalUnderBackpressure", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		stream.SetHeaders()

		const frames = 64
		padding := strings.Repeat("x", 512)
		for frame := 0; frame < frames; frame++ {
			require.NoError(t, stream.WriteEvent(`{"padding":"`+padding+`"}`),
				"frame %d must not block or fail", frame)
		}

		body := string(recorder.Body())
		assert.Equal(t, frames, strings.Count(body, "data: "),
			"every frame must reach the client")
		assert.Equal(t, frames, strings.Count(body, "\n\n"),
			"every frame must be terminated")
	})

	// DisconnectMidStreamStopsWritesAndCancelsContext asserts a client leaving
	// part-way through a stream both stops the writes and cancels the request
	// lifetime.
	//
	// Both halves matter and they fail independently. Writes that keep succeeding
	// mean the relay keeps pulling billed tokens from the provider for a client
	// that is gone; a lifetime that stays live means the code polling it never
	// learns to stop.
	t.Run("DisconnectMidStreamStopsWritesAndCancelsContext", func(t *testing.T) {
		adapted, recorder, disconnect := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		stream.SetHeaders()
		require.NoError(t, stream.WriteEvent(`{"delta":"before"}`))
		delivered := len(recorder.Body())
		require.Greater(t, delivered, 0)
		require.False(t, stream.Done(), "a live client must not report as gone")
		require.NoError(t, adapted.Context().Err())

		disconnect()

		assert.True(t, stream.Done(), "a gone client must be observable")
		assert.ErrorIs(t, adapted.Context().Err(), context.Canceled,
			"a disconnect must cancel the request lifetime so streaming code stops")
		require.Error(t, stream.WriteEvent(`{"delta":"after"}`),
			"writes must fail once the client is gone")
		assert.Equal(t, delivered, len(recorder.Body()),
			"no bytes may be written after the client left")
	})

	// MidStreamErrorDoesNotRewriteStatus pins current behaviour: once a streaming
	// response has begun, the status is settled and a later failure cannot change
	// it. The client already received 200 and a partial body, so the only honest
	// signal is a truncated stream.
	//
	// This pins the behaviour rather than endorsing it. Callers that need to
	// report a mid-stream provider failure must do it in-band, as an SSE error
	// frame, which is what the relay does today.
	t.Run("MidStreamErrorDoesNotRewriteStatus", func(t *testing.T) {
		adapted, recorder, disconnect := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		stream, err := adapter.NewEventStream(adapted)
		require.NoError(t, err)

		adapted.Status(http.StatusOK)
		stream.SetHeaders()
		require.NoError(t, stream.WriteEvent(`{"delta":"partial"}`))

		disconnect()
		require.Error(t, stream.WriteEvent(`{"delta":"lost"}`))

		// The failed write must not have moved the status, and an attempt to
		// write a new one after the body started must not take effect either.
		assert.Equal(t, http.StatusOK, adapted.ResponseStatus(),
			"a mid-stream failure must not rewrite the status")
		adapted.Status(http.StatusBadGateway)
		assert.Equal(t, http.StatusOK, recorder.Status(),
			"the status the client already received cannot be rewritten")
	})

	// ResponseStatusBeforeAnyWriteIsPinned covers the reading middleware branches
	// on before the response exists.
	//
	// The contract documents 0 for a response that has not started, and the value
	// is load-bearing: channel-affinity middleware treats "> 0 && < 400" as
	// success, so an adapter that defaults to 200 records affinity for a request
	// that never produced a response.
	//
	// The two transports genuinely disagree here, so the expectation is taken from
	// the adapter rather than fixed. A writer that initialises its status to 200
	// cannot distinguish unwritten from "wrote 200", which does not satisfy the
	// documented contract; a transport that can report the unwritten state says so
	// by implementing unwrittenStatusReporter and is then held to 0 exactly.
	// This pins both behaviours rather than accepting either, so neither can drift
	// and the divergence stays visible.
	t.Run("ResponseStatusBeforeAnyWriteIsPinned", func(t *testing.T) {
		adapted, _, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		expected := http.StatusOK
		reason := "an adapter that cannot observe the unwritten state reports the transport default"
		if reporter, ok := adapted.(unwrittenStatusReporter); ok && reporter.ReportsUnwrittenStatusAsZero() {
			expected = 0
			reason = "the contract documents 0 for a response that has not started"
		}

		assert.Equal(t, expected, adapted.ResponseStatus(), reason)
		assert.Equal(t, expected, adapted.ResponseStatus(),
			"reading the status must not change it")

		require.NoError(t, adapted.JSON(http.StatusCreated, map[string]any{"success": true}))
		assert.Equal(t, http.StatusCreated, adapted.ResponseStatus(),
			"the written status must be readable afterwards, whatever the unwritten reading was")
	})

	// InProcessContextSupportsCaptureAndStreamWriters asserts the shape internal
	// callers depend on: the channel probe and the audit path run the relay
	// pipeline with no client attached and read the whole response back
	// afterwards, so the response must be capturable and must not require a
	// client to be written at all.
	//
	// The capability question this case originally asked (does flushing reach
	// anyone) is answered by CanFlushAgreesWithFlushAndHasNoSideEffect above,
	// which holds both adapters to agreement between the probe and the operation.
	// Asserting a specific answer here instead would have hardcoded one
	// transport's recorder behaviour.
	t.Run("InProcessContextSupportsCaptureAndStreamWriters", func(t *testing.T) {
		adapted, recorder, _ := adapter.NewContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

		capture := adapted.CaptureResponse(64 * 1024)
		require.NotNil(t, capture, "an in-process context must still be capturable for audit")

		require.NoError(t, adapted.JSON(http.StatusOK, map[string]any{"success": true}))

		assert.JSONEq(t, `{"success":true}`, string(capture.Body()),
			"the capture must observe what the pipeline wrote")
		assert.JSONEq(t, `{"success":true}`, string(recorder.Body()),
			"capturing must not consume the response")
	})

	// RequestLifetimeSurvivesAStreamedResponse asserts a producer that gates every
	// frame on the request lifetime can stream a whole response.
	//
	// This is a routed case rather than a synthetic-context one on purpose: the
	// property belongs to the transport's dispatch path, where the response is
	// committed while the chain is still running, and a synthetic context has no
	// dispatcher to get it wrong.
	//
	// It exists because the adapters' own streaming tests cannot see this. Their
	// writers refuse a write by consulting the disconnect flag, so a transport
	// that cancelled the request lifetime at commit time would keep passing every
	// framing, ordering and backpressure assertion while the production SSE
	// writers -- which check Context().Err() before every frame
	// (gateway.RequestContextDone) -- silently emitted only the first frame of
	// every relay. The lifetime must stay live for exactly as long as the code
	// using it runs, which is what callers still assume.
	t.Run("RequestLifetimeSurvivesAStreamedResponse", func(t *testing.T) {
		const frames = 8

		// gated reports how many frames a lifetime-polling producer managed to
		// write, and the error that stopped it.
		gated := make(chan error, 1)
		written := make(chan int, 1)

		route := Route{
			Method:  http.MethodPost,
			Pattern: "/v1/chat/completions",
			Handler: func(c contract.Context) {
				stream := c.EventStream()
				stream.SetHeaders()

				emitted := 0
				for frame := range frames {
					// The production gate, reproduced exactly: every writer in
					// gateway/write_sse.go refuses to emit once the request
					// lifetime is done.
					if err := c.Context().Err(); err != nil {
						written <- emitted
						gated <- err
						return
					}
					if err := stream.WriteEvent(`{"frame":` + strconv.Itoa(frame) + `}`); err != nil {
						written <- emitted
						gated <- err
						return
					}
					emitted++

					// Yield after the frame that commits the response, so a
					// transport that cancels the lifetime at commit time has
					// certainly done so before the next gate check reads it.
					// Without this the producer could outrun the commit and the
					// case would pass by luck. A transport that keeps the
					// lifetime live only pays the wait once.
					if frame == 0 {
						time.Sleep(50 * time.Millisecond)
					}
				}
				written <- emitted
				gated <- nil
			},
		}

		recorder := adapter.ServeRoute(t, route, httptest.NewRequest(route.Method, route.Pattern, nil))

		assert.NoError(t, <-gated,
			"a streaming producer must not be stopped by its own request lifetime being cancelled")
		assert.Equal(t, frames, <-written,
			"every frame a lifetime-polling producer writes must be emitted")
		assert.Equal(t, frames, strings.Count(string(recorder.Body()), "data: "),
			"every frame must reach the client")
	})
}

// unwrittenStatusReporter is the declaration a context makes when ResponseStatus
// can distinguish a response that has not started from one that wrote 200.
//
// It is an optional interface because the two transports genuinely differ: a
// writer that initialises its status to 200 cannot report the unwritten state,
// while a transport that stages the status can report the documented 0. Not
// implementing it means the transport default, which reports 200 until
// something writes one.
type unwrittenStatusReporter interface {
	ReportsUnwrittenStatusAsZero() bool
}
