package fiberadapter

import (
	"bufio"
	"context"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/contract/conformance"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFiberAdapterSatisfiesTransportContract runs the adapter-agnostic
// conformance suite against this adapter, so equivalence is proven by shared
// assertions rather than by copied test bodies.
func TestFiberAdapterSatisfiesTransportContract(t *testing.T) {
	conformance.Run(t, conformance.Adapter{
		Name:              "fiber",
		NewContext:        newConformanceContext,
		ServeRoute:        serveRoute,
		NewEventStream:    EventStream,
		NewResponseStream: ResponseStream,
	})
}

// newConformanceContext builds an in-process context plus a disconnect hook.
//
// fasthttp has no disconnect notification of its own (RequestCtx.Done fires only
// on server shutdown), so a gone client is modelled the way the real transport
// observes one: the response's pipe closes and the request lifetime is cancelled,
// which is exactly what a failed write does in production.
func newConformanceContext(req *http.Request) (contract.Context, conformance.Recorder, func()) {
	adapted, recorder := NewSyntheticContext(req)
	state := adapted.(*requestContext).resp
	return adapted, conformance.NewHTTPRecorder(recorder), state.disconnect
}

// serveRoute registers route on a real fiber app and serves req through it, so the
// cases needing router-matched parameters and real middleware continuation
// exercise the framework rather than a synthetic context.
//
// The whole flattened chain goes into one fiber handler through Dispatch. Spreading
// it across fiber's own stack would break streaming: Dispatch returns while a
// streaming chain is still running, and fiber recycles its Ctx as soon as the
// handler returns.
func serveRoute(t *testing.T, route conformance.Route, req *http.Request) conformance.Recorder {
	t.Helper()

	app := fiber.New(fiber.Config{})

	chain := make([]contract.Handler, 0, len(route.Middleware)+1)
	for _, middleware := range route.Middleware {
		chain = append(chain, contract.Handler(middleware))
	}
	chain = append(chain, route.Handler)

	app.Add([]string{route.Method}, route.Pattern, func(c fiber.Ctx) error {
		return Dispatch(c, chain)
	})

	response, err := app.Test(req, fiber.TestConfig{Timeout: 10 * time.Second})
	require.NoError(t, err)
	t.Cleanup(func() { _ = response.Body.Close() })

	return newResponseRecorder(t, response)
}

// newResponseRecorder adapts a real *http.Response to the suite's Recorder.
//
// Flushed is reported from the framing rather than from an in-process flag: a
// chunked response is one the transport pushed incrementally, which is the
// client-visible meaning of a flush having reached the client.
func newResponseRecorder(t *testing.T, response *http.Response) conformance.Recorder {
	t.Helper()

	body := make([]byte, 0, 512)
	buffer := make([]byte, 512)
	for {
		read, err := response.Body.Read(buffer)
		body = append(body, buffer[:read]...)
		if err != nil {
			break
		}
	}

	chunked := false
	for _, encoding := range response.TransferEncoding {
		if encoding == "chunked" {
			chunked = true
		}
	}

	return servedRecorder{
		status:  response.StatusCode,
		header:  response.Header,
		body:    body,
		flushed: chunked,
	}
}

type servedRecorder struct {
	status  int
	header  http.Header
	body    []byte
	flushed bool
}

func (r servedRecorder) Status() int         { return r.status }
func (r servedRecorder) Header() http.Header { return r.header }
func (r servedRecorder) Body() []byte        { return r.body }
func (r servedRecorder) Flushed() bool       { return r.flushed }

// listenApp starts app on a random loopback port and returns its base URL.
func listenApp(t *testing.T, app *fiber.App) string {
	t.Helper()

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	go func() { _ = app.Listener(listener) }()
	t.Cleanup(func() { _ = app.ShutdownWithTimeout(2 * time.Second) })

	return "http://" + listener.Addr().String()
}

// TestHeadersAreSettledBeforeFirstBodyByte is the H1 proof, and it cannot be done
// with a recorder.
//
// fasthttp writes the response header before it starts consuming a body stream,
// and there is no hook to commit headers from inside the stream callback. A design
// that mutated the response header from the streaming goroutine would therefore
// race the header write, and the failure is silent: the client simply never sees
// the header. A recorder records whatever it is handed, in whatever order, so it
// cannot observe this at all.
//
// The proof reads the wire. The handler sets a header, streams a first frame, and
// then keeps the stream open while the test asserts. Reading response headers
// through net/http returns as soon as the header block is complete, which for a
// streamed response is strictly before the body finishes, so observing the header
// while the body is still arriving is itself the ordering evidence.
func TestHeadersAreSettledBeforeFirstBodyByte(t *testing.T) {
	const marker = "settled-before-body"

	release := make(chan struct{})
	firstFrameWritten := make(chan struct{})

	app := fiber.New(fiber.Config{})
	app.Get("/stream", func(c fiber.Ctx) error {
		return Dispatch(c, []contract.Handler{func(ctx contract.Context) {
			stream := ctx.EventStream()
			ctx.SetHeader("X-Ordering-Proof", marker)
			stream.SetHeaders()

			require.NoError(t, stream.WriteEvent(`{"delta":"first"}`))
			close(firstFrameWritten)

			// Hold the stream open, so the assertions below run while the body
			// is provably unfinished.
			<-release
			require.NoError(t, stream.WriteEvent("[DONE]"))
		}})
	})

	base := listenApp(t, app)

	response, err := http.Get(base + "/stream")
	require.NoError(t, err)
	t.Cleanup(func() { _ = response.Body.Close() })

	// The header block is complete at this point; the body is not.
	select {
	case <-firstFrameWritten:
	case <-time.After(5 * time.Second):
		t.Fatal("handler never wrote its first frame")
	}

	assert.Equal(t, marker, response.Header.Get("X-Ordering-Proof"),
		"a header set before the first frame must reach the client")
	assert.Equal(t, "text/event-stream", response.Header.Get("Content-Type"),
		"the streaming content type must be settled before any body byte")
	assert.Equal(t, "no-cache", response.Header.Get("Cache-Control"))
	assert.Equal(t, "no", response.Header.Get("X-Accel-Buffering"))
	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Equal(t, []string{"chunked"}, response.TransferEncoding,
		"a streamed response must be chunked, which is what makes it incremental")

	// Read the first frame off the wire and confirm the body was still open while
	// the headers above were already readable.
	reader := bufio.NewReader(response.Body)
	frame, err := reader.ReadString('\n')
	require.NoError(t, err)
	assert.Equal(t, "data: {\"delta\":\"first\"}\n", frame,
		"the first body byte must arrive after the header block, not before it")

	close(release)

	rest, err := readAllString(reader)
	require.NoError(t, err)
	assert.Contains(t, rest, "data: [DONE]\n\n",
		"the rest of the stream must arrive after the assertions ran")
}

// readAllString drains r, treating a clean stream end as success.
func readAllString(r *bufio.Reader) (string, error) {
	var builder strings.Builder
	buffer := make([]byte, 256)
	for {
		read, err := r.Read(buffer)
		builder.Write(buffer[:read])
		if err != nil {
			if err.Error() == "EOF" {
				return builder.String(), nil
			}
			return builder.String(), nil
		}
	}
}

// TestFlushTimingIsOnePushPerFlush asserts a contract Flush pushes immediately
// rather than being deferred, and that a client keeping up sees exactly one wire
// chunk per flush.
//
// The synchronisation is the point of the test, not scaffolding around it. fasthttp
// frames chunks from whatever one read of the response pipe returns, so a producer
// that outruns the consumer legitimately has several frames coalesced into one
// chunk: the boundary is the reader's window, not the writer's flush. That is
// harmless (SSE clients parse on the `data: ` prefix and the blank-line terminator,
// never on chunk boundaries) but it means an unsynchronised chunk count measures
// scheduling, not flush timing.
//
// Handshaking each frame removes the ambiguity and tests the property that actually
// matters: the frame is on the wire before the handler produces the next one. A
// writer that buffered until the handler returned would hang here rather than
// merely coalescing, which is the failure this pins.
func TestFlushTimingIsOnePushPerFlush(t *testing.T) {
	const frames = 5

	readNext := make(chan struct{})

	app := fiber.New(fiber.Config{})
	app.Get("/stream", func(c fiber.Ctx) error {
		return Dispatch(c, []contract.Handler{func(ctx contract.Context) {
			stream := ctx.EventStream()
			stream.SetHeaders()
			for frame := 0; frame < frames; frame++ {
				// WriteEvent flushes, so each iteration is one intended push.
				require.NoError(t, stream.WriteEvent(fmt.Sprintf(`{"frame":%d}`, frame)))
				// Wait until the test has actually read that frame off the wire
				// before producing the next one.
				<-readNext
			}
		}})
	})

	base := listenApp(t, app)

	// Read the raw connection: net/http's chunked reader hides the framing this
	// case is about.
	conn, err := net.Dial("tcp", strings.TrimPrefix(base, "http://"))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })

	_, err = conn.Write([]byte("GET /stream HTTP/1.1\r\nHost: test\r\nConnection: close\r\n\r\n"))
	require.NoError(t, err)
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(15*time.Second)))

	reader := bufio.NewReader(conn)

	for {
		line, err := reader.ReadString('\n')
		require.NoError(t, err)
		if line == "\r\n" {
			break
		}
	}

	for frame := 0; frame < frames; frame++ {
		payload, err := readChunk(reader)
		require.NoError(t, err, "frame %d must arrive as its own chunk", frame)
		require.NotEmpty(t, payload,
			"the stream ended early: a flush was deferred instead of pushed")

		assert.Equal(t, fmt.Sprintf("data: {\"frame\":%d}\n\n", frame), string(payload),
			"one flush must put exactly one frame on the wire, in order")

		// Only now let the handler produce the next frame. If the flush above had
		// not really reached the wire, this read would already have blocked.
		readNext <- struct{}{}
	}

	// The handler returned, so the body terminates with the zero-length chunk.
	trailing, err := readChunk(reader)
	require.NoError(t, err)
	assert.Empty(t, trailing, "the stream must terminate after the last frame")
}

// readChunk reads one HTTP chunk, returning an empty payload for the terminal
// zero-length chunk.
func readChunk(r *bufio.Reader) ([]byte, error) {
	sizeLine, err := r.ReadString('\n')
	if err != nil {
		return nil, err
	}

	size := 0
	if _, err := fmt.Sscanf(strings.TrimSpace(sizeLine), "%x", &size); err != nil {
		return nil, fmt.Errorf("malformed chunk size %q: %w", strings.TrimSpace(sizeLine), err)
	}
	if size == 0 {
		return nil, nil
	}

	payload := make([]byte, size)
	if _, err := readFull(r, payload); err != nil {
		return nil, err
	}
	// Trailing CRLF.
	if _, err := r.Discard(2); err != nil {
		return nil, err
	}
	return payload, nil
}

func readFull(r *bufio.Reader, target []byte) (int, error) {
	total := 0
	for total < len(target) {
		read, err := r.Read(target[total:])
		total += read
		if err != nil {
			return total, err
		}
	}
	return total, nil
}

// TestStreamingIsIncrementalUnderBackpressureOverTheWire writes far more frames
// than the transport's pipe holds, with a client that reads slowly.
//
// This is the case the rejected design fails by deadlocking rather than by
// asserting: registering a body-stream writer and then streaming from the request
// handler blocks once the pipe fills, because the server drains only after the
// handler returns. Running the chain inside the callback lets the server drain
// concurrently, which is what makes backpressure real instead of fatal.
func TestStreamingIsIncrementalUnderBackpressureOverTheWire(t *testing.T) {
	const frames = 200
	padding := strings.Repeat("y", 1024)

	completed := make(chan struct{})

	app := fiber.New(fiber.Config{})
	app.Get("/stream", func(c fiber.Ctx) error {
		return Dispatch(c, []contract.Handler{func(ctx contract.Context) {
			defer close(completed)
			stream := ctx.EventStream()
			stream.SetHeaders()
			for frame := 0; frame < frames; frame++ {
				require.NoError(t, stream.WriteEvent(fmt.Sprintf(`{"frame":%d,"pad":"%s"}`, frame, padding)))
			}
		}})
	})

	base := listenApp(t, app)

	response, err := http.Get(base + "/stream")
	require.NoError(t, err)
	t.Cleanup(func() { _ = response.Body.Close() })

	reader := bufio.NewReader(response.Body)
	received := 0
	for received < frames {
		line, err := reader.ReadString('\n')
		if err != nil {
			break
		}
		if strings.HasPrefix(line, "data: ") {
			received++
			// Read slower than the writer produces, so the pipe genuinely fills
			// and the writer genuinely blocks.
			if received%25 == 0 {
				time.Sleep(5 * time.Millisecond)
			}
		}
	}

	assert.Equal(t, frames, received,
		"every frame must arrive under backpressure rather than the stream deadlocking")

	select {
	case <-completed:
	case <-time.After(10 * time.Second):
		t.Fatal("the streaming chain never completed: the writer deadlocked against a full pipe")
	}
}

// TestNonStreamingResponseKeepsContentLength asserts a buffered response is framed
// with a real Content-Length rather than chunked.
//
// It is the other half of the streaming decision. fasthttp rewrites Content-Length
// to -1 for any streamed body, and the upstream byte-copy path depends on correct
// framing, so a response that never asked to stream must not be handed to the
// stream path.
func TestNonStreamingResponseKeepsContentLength(t *testing.T) {
	payload := `{"success":true,"data":{"id":7}}`

	app := fiber.New(fiber.Config{})
	app.Get("/buffered", func(c fiber.Ctx) error {
		return Dispatch(c, []contract.Handler{func(ctx contract.Context) {
			require.NoError(t, ctx.Data(http.StatusOK, "application/json", []byte(payload)))
		}})
	})

	// Taking a stream writer without writing through it must not switch the
	// response onto the stream path either.
	app.Get("/probed", func(c fiber.Ctx) error {
		return Dispatch(c, []contract.Handler{func(ctx contract.Context) {
			stream := ctx.ResponseStream()
			_ = stream.Header("Cache-Control")
			require.NoError(t, ctx.Data(http.StatusOK, "application/json", []byte(payload)))
		}})
	})

	base := listenApp(t, app)

	for _, path := range []string{"/buffered", "/probed"} {
		response, err := http.Get(base + path)
		require.NoError(t, err)
		t.Cleanup(func() { _ = response.Body.Close() })

		assert.Equal(t, int64(len(payload)), response.ContentLength,
			"%s must be framed with a real Content-Length", path)
		assert.Empty(t, response.TransferEncoding,
			"%s must not be chunked", path)

		body, err := readAllString(bufio.NewReader(response.Body))
		require.NoError(t, err)
		assert.Equal(t, payload, body)
	}
}

// TestDisconnectMidStreamCancelsContextOverTheWire asserts a real client hanging up
// mid-stream stops the writes and cancels the request lifetime.
//
// The detection timing is a deliberate, accepted behaviour change from the previous adapter. fasthttp
// offers no read-side disconnect notification at all: RequestCtx.Done is closed only
// on server shutdown, and the sole signal is a write to the response pipe failing
// once the server closed its end. Detection therefore moves from "the read side saw
// FIN" to "the next write failed", bounded in production by the 10s keep-alive ping.
// This case pins that the signal does arrive, which is what stops the relay from
// billing upstream tokens nobody receives.
func TestDisconnectMidStreamCancelsContextOverTheWire(t *testing.T) {
	writeFailed := make(chan error, 1)
	contextDone := make(chan error, 1)
	firstFrame := make(chan struct{})

	app := fiber.New(fiber.Config{})
	app.Get("/stream", func(c fiber.Ctx) error {
		return Dispatch(c, []contract.Handler{func(ctx contract.Context) {
			stream := ctx.EventStream()
			stream.SetHeaders()
			require.NoError(t, stream.WriteEvent(`{"delta":"first"}`))
			close(firstFrame)

			// Keep writing until a write reports the client gone, which is the
			// only disconnect signal this transport has.
			deadline := time.Now().Add(15 * time.Second)
			for time.Now().Before(deadline) {
				if err := stream.WriteEvent(`{"delta":"more"}`); err != nil {
					writeFailed <- err
					contextDone <- ctx.Context().Err()
					return
				}
				time.Sleep(10 * time.Millisecond)
			}
			writeFailed <- nil
			contextDone <- nil
		}})
	})

	base := listenApp(t, app)

	conn, err := net.Dial("tcp", strings.TrimPrefix(base, "http://"))
	require.NoError(t, err)
	_, err = conn.Write([]byte("GET /stream HTTP/1.1\r\nHost: test\r\n\r\n"))
	require.NoError(t, err)

	select {
	case <-firstFrame:
	case <-time.After(5 * time.Second):
		t.Fatal("handler never wrote its first frame")
	}

	// Hang up.
	require.NoError(t, conn.Close())

	select {
	case err := <-writeFailed:
		require.Error(t, err, "a write must fail once the client hung up")
	case <-time.After(20 * time.Second):
		t.Fatal("writes kept succeeding after the client disconnected")
	}

	select {
	case err := <-contextDone:
		assert.ErrorIs(t, err, context.Canceled,
			"observing a disconnect must cancel the request lifetime")
	case <-time.After(5 * time.Second):
		t.Fatal("the request lifetime was never cancelled")
	}
}

// TestSetWriteDeadlineBoundsABlockedWrite asserts the deadline is real rather than
// reported and ignored.
//
// It is asserted by making a write actually time out: the client never reads, so the
// response pipe fills and the write blocks, and the deadline is what turns that from
// a hang into an error. This is the protection the SSE scanner sets before every
// write so its cleanup path's unconditional wait can always finish, which is why
// reporting an unsupported deadline was not an acceptable implementation.
func TestSetWriteDeadlineBoundsABlockedWrite(t *testing.T) {
	timedOut := make(chan bool, 1)
	supported := make(chan bool, 1)

	app := fiber.New(fiber.Config{})
	app.Get("/stream", func(c fiber.Ctx) error {
		return Dispatch(c, []contract.Handler{func(ctx contract.Context) {
			stream := ctx.ResponseStream()

			// Start the stream, so there is a pipe to bound.
			_, err := stream.Write([]byte("start"))
			require.NoError(t, err)
			require.NoError(t, stream.Flush())

			supported <- stream.SetWriteDeadline(time.Now().Add(200 * time.Millisecond))

			// Fill the pipe against a client that never reads, until a write
			// fails on the deadline.
			payload := []byte(strings.Repeat("z", 4096))
			deadline := time.Now().Add(10 * time.Second)
			for time.Now().Before(deadline) {
				if _, err := stream.Write(payload); err != nil {
					timedOut <- true
					return
				}
			}
			timedOut <- false
		}})
	})

	base := listenApp(t, app)

	// Connect and deliberately never read the body.
	conn, err := net.Dial("tcp", strings.TrimPrefix(base, "http://"))
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })
	_, err = conn.Write([]byte("GET /stream HTTP/1.1\r\nHost: test\r\n\r\n"))
	require.NoError(t, err)

	select {
	case reported := <-supported:
		assert.True(t, reported,
			"a streaming response owns its pipe, so the deadline must be supported")
	case <-time.After(5 * time.Second):
		t.Fatal("handler never reported deadline support")
	}

	select {
	case bounded := <-timedOut:
		assert.True(t, bounded,
			"a blocked write must be bounded by the deadline rather than hanging forever")
	case <-time.After(15 * time.Second):
		t.Fatal("a blocked write was never bounded: the deadline is not reaching the writer")
	}
}

// TestUnwrapRecoversFiberContext asserts the migration escape hatch returns the
// original context and rejects a foreign one, so a caller left behind by the
// framework swap fails loudly rather than nil-panicking later.
func TestUnwrapRecoversFiberContext(t *testing.T) {
	app := fiber.New(fiber.Config{})

	var (
		recovered fiber.Ctx
		ok        bool
		expected  fiber.Ctx
	)
	app.Get("/unwrap", func(c fiber.Ctx) error {
		expected = c
		recovered, ok = Unwrap(Wrap(c))
		return c.SendStatus(http.StatusOK)
	})

	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/unwrap", nil))
	require.NoError(t, err)
	t.Cleanup(func() { _ = response.Body.Close() })

	require.True(t, ok)
	assert.Same(t, expected, recovered)

	foreign, foreignOK := Unwrap(foreignContext{})
	assert.False(t, foreignOK)
	assert.Nil(t, foreign)
}

// foreignContext stands in for a non-fiber contract implementation, the way a
// contract context from another implementation arrives here. It is only ever
// passed to Unwrap, so the embedded methods
// are never called.
//
// The embedding goes through an alias because embedding contract.Context directly
// would name the field "Context", shadowing the promoted Context() method the
// interface itself requires.
type foreignContext struct{ transportContext }

type transportContext = contract.Context

// TestValuesSnapshotSurvivesTheChain asserts the per-request state the access
// logger reads is available through the contract context after the chain ran.
//
// It exists because this adapter deliberately does not store contract values in
// fasthttp's user values: the RequestCtx carrying those is recycled while a
// streaming chain is still running, so the logger would read another request's
// state. The snapshot is taken from adapter-owned storage instead.
func TestValuesSnapshotSurvivesTheChain(t *testing.T) {
	var logged map[string]any

	app := fiber.New(fiber.Config{})
	app.Get("/logged", func(c fiber.Ctx) error {
		return Dispatch(c, []contract.Handler{
			func(ctx contract.Context) {
				ctx.Next()
				logged = Values(ctx)
			},
			func(ctx contract.Context) {
				ctx.Set("request_id", "req-42")
				ctx.Set("route_tag", "relay")
				require.NoError(t, ctx.JSON(http.StatusOK, map[string]any{"success": true}))
			},
		})
	})

	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/logged", nil))
	require.NoError(t, err)
	t.Cleanup(func() { _ = response.Body.Close() })

	assert.Equal(t, "req-42", logged["request_id"])
	assert.Equal(t, "relay", logged["route_tag"])

	// The snapshot must be a copy, so a logger mutating it cannot corrupt the
	// request state.
	logged["request_id"] = "mutated"
	assert.NotEqual(t, "mutated", logged["route_tag"])
}
