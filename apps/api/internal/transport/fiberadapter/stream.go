package fiberadapter

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/internal/transport/contract"

	"github.com/gofiber/fiber/v2"
	"github.com/valyala/fasthttp"
	"github.com/valyala/fasthttp/fasthttputil"
)

// EventStreamHeadersKey is re-exported from the contract so adapter callers keep
// compiling; the constant lives there because non-adapter code sets the flag too.
const EventStreamHeadersKey = contract.EventStreamHeadersKey

// responseState is the response under construction.
//
// fasthttp builds a Response rather than writing through a ResponseWriter, so
// this type is both: it stages headers, status and body, and it is the
// http.ResponseWriter the escape hatch hands to libraries that take over the
// response. Staging is what makes header ordering structural rather than
// hopeful: fasthttp writes resp.Header before it consumes the body, and there is
// no hook to commit headers from inside a body-stream callback, so the headers
// are written once at the commit point and never touched afterwards.
type responseState struct {
	mode dispatchMode

	// header is the staged response header. In synthetic mode it aliases the
	// recorder's own map, so a library writing through ResponseWriter().Header()
	// is observed without a commit step.
	header http.Header
	// status is the staged status code, 0 until something wrote one. The commit
	// translates 0 to 200; ResponseStatus reports gin's default instead, which
	// is what middleware branching on it has always seen.
	status int

	// body mirrors everything written, for CaptureResponse. It is the response
	// body itself in buffered mode.
	body bytes.Buffer

	fiber    *fiber.Ctx
	recorder *httptest.ResponseRecorder

	// committed guards the one-shot header write.
	committed bool
	// flushed records that at least one flush reached the client, which is what
	// the conformance recorder reports.
	flushed bool

	// ---- streaming ----

	// pipe is the in-process connection between this chain and the server's
	// body-stream reader. Owning it (rather than letting fasthttp's
	// NewStreamReader create one internally) is what makes SetWriteDeadline
	// real: NewStreamReader hands the callback only a *bufio.Writer and keeps
	// the connection private, so a deadline would be unreachable and could only
	// be reported as unsupported. scan_sse.go sets a deadline before every
	// write so cleanup's unconditional wait can always finish, so reporting
	// false there would silently drop hang protection.
	//
	// Do not "simplify" this back to Response.SetBodyStreamWriter.
	pipe   *fasthttputil.PipeConns
	writer *bufio.Writer

	streaming bool
	// streamCh is closed by the chain when it wants the wire, waking the
	// dispatcher so it can commit and return.
	streamCh chan struct{}
	// committedCh is closed once the dispatcher committed headers and installed
	// the body stream. The chain blocks on it before its first byte, which is
	// what guarantees no body byte can precede the header write.
	committedCh chan struct{}
	// finished is closed when the chain returned, so the streaming goroutine can
	// flush and close the pipe.
	finished chan struct{}

	// ---- upgrade ----
	//
	// upgradeCh is closed by the chain when it asks for a protocol upgrade,
	// waking the dispatcher the same way streamCh does. The handshake has to run
	// on the dispatcher's goroutine because fasthttp reads the registered hijack
	// handler only after the request handler returns, so registering it from the
	// chain's goroutine would be too late.
	upgradeCh  chan struct{}
	upgrading  bool
	upgradeReq *upgradeRequest

	// disconnected records that a write reported the client gone.
	disconnected bool
	// cancel cancels the request lifetime, which is how a disconnect observed on
	// a write reaches code polling Context().
	cancel func()

	mu sync.Mutex
}

func newResponseState(c *fiber.Ctx, mode dispatchMode) *responseState {
	state := &responseState{
		mode:        mode,
		fiber:       c,
		streamCh:    make(chan struct{}),
		upgradeCh:   make(chan struct{}),
		committedCh: make(chan struct{}),
		finished:    make(chan struct{}),
	}
	if mode == modeSynthetic {
		state.recorder = httptest.NewRecorder()
		// Alias the recorder's header map so the recorder and the staged view
		// cannot disagree.
		state.header = state.recorder.Header()
	} else {
		state.header = make(http.Header)
	}
	return state
}

func (s *responseState) isStreaming() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.streaming
}

// run executes the chain and commits the response.
//
// The chain runs on its own goroutine so the dispatcher can return to fasthttp
// the moment the response mode is settled. That is the whole of F0.2: fasthttp
// drains a body stream only after the request handler returns, over a pipe that
// blocks when full, so a chain that streamed while the handler was still on the
// stack would deadlock as soon as the pipe filled. Returning early lets the
// server drain concurrently, which makes backpressure real and keeps one
// contract Flush equal to one wire chunk.
//
// Whichever outcome comes first decides the mode, and all three are settled
// before run returns:
//
//	chain finished first  -> buffered body, correct Content-Length
//	chain wants the wire  -> body stream installed, chain still running
//	chain wants the socket -> hijack registered, chain still running
//
// The request lifetime is cancelled by the chain's own goroutine rather than by
// the dispatcher, and that is load-bearing rather than tidiness. The dispatcher
// returns while a streaming or upgraded chain is still running, so cancelling
// there would cancel the context mid-response -- and the production SSE writers
// gate every frame on Context().Err() (gateway.RequestContextDone), so every
// streamed relay would stop after its first frame while the adapter's own
// writers, which check the disconnect flag instead, kept reporting success.
// Cancelling when the chain returns is the same lifetime gin had: the context
// lives exactly as long as the code using it.
func (s *responseState) run(adapted *requestContext) error {
	s.cancel = adapted.cancel

	if s.mode != modeChain {
		defer adapted.cancel()
		adapted.Next()
		return nil
	}

	done := make(chan struct{})
	go func() {
		// Registered first so it runs last: the lifetime must outlive both the
		// chain and the finished signal the streaming and upgrade paths wait on.
		defer adapted.cancel()
		defer close(done)
		defer close(s.finished)
		defer func() {
			// A panic inside the chain must not take the process down with the
			// dispatcher already returned. Recovery middleware normally handles
			// it; this is the backstop for the goroutine boundary itself.
			if recovered := recover(); recovered != nil {
				s.abortWithPanic(recovered)
			}
		}()
		adapted.Next()
	}()

	select {
	case <-done:
		// Buffered: nothing asked to stream, so the response is complete and
		// can be framed with a real Content-Length. A streamed body would have
		// forced Content-Length to -1, which the upstream byte-copy path
		// depends on being correct.
		return s.commitBuffered()
	case <-s.streamCh:
		return s.commitStream()
	case <-s.upgradeCh:
		return s.commitUpgrade()
	}
}

// commitBuffered writes the staged headers, status and body onto the fiber
// response as a plain body.
func (s *responseState) commitBuffered() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.mode != modeChain {
		// Direct and in-process responses were written as they happened; there
		// is nothing staged to commit.
		return nil
	}
	s.writeHeaders()
	if s.body.Len() > 0 {
		s.fiber.Response().AppendBody(s.body.Bytes())
	}
	return nil
}

// writeHeaders copies the staged header set and status onto the fasthttp
// response. It runs exactly once per response, before any body byte exists,
// which is what makes the header/body ordering structural.
//
// Transfer-Encoding is skipped: fasthttp manages it and discards a manually set
// value, so forwarding one would be a silent no-op that reads like a bug.
func (s *responseState) writeHeaders() {
	if s.committed {
		return
	}
	s.committed = true

	response := s.fiber.Response()
	status := s.status
	if status == 0 {
		status = http.StatusOK
	}
	response.SetStatusCode(status)

	for key, values := range s.header {
		if key == "Transfer-Encoding" {
			continue
		}
		if key == "Content-Type" {
			// Content-Type is a special header in fasthttp; Set on the header
			// map would be ignored in favour of the default.
			if len(values) > 0 {
				response.Header.SetContentType(values[0])
			}
			continue
		}
		for index, value := range values {
			if index == 0 {
				response.Header.Set(key, value)
				continue
			}
			response.Header.Add(key, value)
		}
	}
}

// commitStream installs the body stream and returns, leaving the chain running.
//
// This is an inlined fasthttp.Response.SetBodyStreamWriter. That helper routes
// through NewStreamReader, which creates the PipeConns itself and exposes only a
// *bufio.Writer, so the write end is unreachable; owning the pipe is the only way
// to satisfy contract SetWriteDeadline (a real deadline on a real connection) and
// to observe a client disconnect at all, since a failed pipe write is the only
// disconnect signal fasthttp offers.
//
// The wire behaviour is unchanged: the server reads the pipe with
// writeBodyChunked, whose writeChunk ends in a flush, so one flush of this writer
// is one wire chunk exactly as it was under gin.
//
// Do not "simplify" this back to SetBodyStreamWriter.
func (s *responseState) commitStream() error {
	s.mu.Lock()

	// Headers first, while no body byte can exist yet: fasthttp writes
	// resp.Header before it starts consuming the body stream, and there is no
	// hook to commit headers from inside the stream. Doing it here, before
	// SetBodyStream, is what makes the ordering structural rather than a race
	// the chain has to win.
	s.writeHeaders()

	// Anything the chain wrote before it asked to stream (SSE headers plus a
	// first frame, typically) is replayed into the pipe ahead of the rest.
	pending := make([]byte, s.body.Len())
	copy(pending, s.body.Bytes())

	s.fiber.Response().SetBodyStream(s.pipe.Conn2(), -1)
	s.mu.Unlock()

	// Release the chain now that the response is committed and the reader is
	// installed. Until this point the chain is parked in beginStream, so the
	// first body byte cannot precede the header write.
	close(s.committedCh)

	go func() {
		if len(pending) > 0 {
			_, _ = s.writer.Write(pending)
			_ = s.writer.Flush()
		}
		<-s.finished
		// Flush whatever the chain left buffered, then close the write end so
		// the server sees EOF and terminates the chunked body.
		_ = s.writer.Flush()
		_ = s.pipe.Conn1().Close()
	}()

	return nil
}

// beginStream switches the response into streaming mode on the first
// byte-producing call, blocking until the dispatcher has committed.
//
// The trigger is a byte-producing call rather than merely obtaining a writer:
// a handler that takes an EventStream to read back a header and then answers with
// JSON must stay buffered, so its Content-Length is correct.
func (s *responseState) beginStream() error {
	s.mu.Lock()

	if s.mode != modeChain {
		// Direct and synthetic responses have no stream to install: direct
		// writes reach fiber's response as they happen, and a synthetic context
		// has no client at all. Both stay buffered, which is what the
		// channel-probe caller requires.
		s.mu.Unlock()
		return nil
	}

	if s.streaming {
		s.mu.Unlock()
		return nil
	}

	if s.disconnected {
		s.mu.Unlock()
		return errClientGone
	}

	s.streaming = true
	s.pipe = fasthttputil.NewPipeConns()
	s.writer = bufio.NewWriter(s.pipe.Conn1())
	s.mu.Unlock()

	// Wake the dispatcher, then wait for it to commit. Both are one-shot, so a
	// second byte-producing call takes the fast path above.
	close(s.streamCh)
	<-s.committedCh
	return nil
}

// errClientGone is what every write reports once a disconnect was observed, so
// the relay stops pulling from the provider instead of billing traffic nobody
// receives.
var errClientGone = errors.New("fiberadapter: client disconnected")

// write is the complete-response byte path, used by JSON, Data, String and the
// escape-hatch writer.
//
// It deliberately does NOT begin streaming. A complete response must keep a real
// Content-Length: fasthttp rewrites Content-Length to -1 for any streamed body,
// and the upstream byte-copy path frames on it. Streaming is entered only by the
// stream writers, which is what "the handler asked to stream" actually means.
//
// A write that arrives after the response already switched to streaming still
// goes to the pipe, since by then there is nothing else to write to.
func (s *responseState) write(payload []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.disconnected {
		return 0, errClientGone
	}

	return s.writeLocked(payload)
}

// writeLocked is the one place bytes leave this adapter. It runs with the lock
// held and routes by mode: a committed stream goes to the pipe, an in-process
// response to the recorder, a direct response to fiber, and a chain response
// still deciding its mode accumulates until the commit.
func (s *responseState) writeLocked(payload []byte) (int, error) {
	if s.streaming {
		written, err := s.writer.Write(payload)
		if err != nil {
			s.markDisconnected()
			return written, err
		}
		return written, nil
	}

	switch s.mode {
	case modeSynthetic:
		s.recorder.Body.Write(payload)
	case modeDirect:
		s.fiber.Response().AppendBody(payload)
	}
	s.body.Write(payload)
	return len(payload), nil
}

// writeStreaming is the write path for the stream writers. It is the same byte
// path as write; the separate name marks the callers whose bytes are frames
// rather than a complete response body.
func (s *responseState) writeStreaming(payload []byte) (int, error) {
	if err := s.beginStream(); err != nil {
		return 0, err
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	if s.disconnected {
		return 0, errClientGone
	}
	return s.writeLocked(payload)
}

// flush pushes buffered bytes to the client. One flush is one wire chunk, since
// the server's chunk writer flushes at the end of every chunk it reads.
func (s *responseState) flush() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.disconnected {
		return errClientGone
	}

	s.flushed = true
	if s.recorder != nil {
		s.recorder.Flushed = true
	}
	if !s.streaming || s.writer == nil {
		return nil
	}
	if err := s.writer.Flush(); err != nil {
		s.markDisconnected()
		return err
	}
	return nil
}

// markDisconnected records the disconnect and cancels the request lifetime. It
// runs with the lock held.
//
// This is the only disconnect signal fasthttp offers: a pipe write fails once the
// server closed the read end, which it does when the connection went away. The
// cost is that detection moves from "the read side saw FIN" to "the next write
// failed"; the relay's keep-alive ping (on by default) bounds the delay for
// streamed responses.
func (s *responseState) markDisconnected() {
	if s.disconnected {
		return
	}
	s.disconnected = true
	if s.cancel != nil {
		s.cancel()
	}
}

// disconnect simulates the client going away, for the conformance suite's
// disconnect hook. It closes the pipe when one exists and cancels the lifetime
// either way, so a context taken before any stream still observes it.
func (s *responseState) disconnect() {
	s.mu.Lock()
	pipe := s.pipe
	s.markDisconnected()
	s.mu.Unlock()

	if pipe != nil {
		_ = pipe.Close()
	}
}

func (s *responseState) isDone() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.disconnected
}

func (s *responseState) bufferedBody() []byte {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.body.Bytes()
}

// setHeader stages a header. In synthetic mode the staged map IS the recorder's
// header map, so the write is already visible; in direct mode it is mirrored onto
// fiber's response, which was already committed by the time the handler runs.
func (s *responseState) setHeader(key, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.committed && s.mode == modeChain {
		// A header set after a chain response committed cannot reach the
		// client; dropping it silently is what net/http does too.
		return
	}
	s.header.Set(key, value)
	if s.mode == modeDirect {
		s.fiber.Response().Header.Set(key, value)
	}
}

// addHeader stages an appended header value, mirroring it for a direct response.
func (s *responseState) addHeader(key, value string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.committed && s.mode == modeChain {
		return
	}
	s.header.Add(key, value)
	if s.mode == modeDirect {
		s.fiber.Response().Header.Add(key, value)
	}
}

// abortWithPanic turns a panic that escaped the chain into a 500 rather than a
// dead goroutine, for the case where no recovery middleware was mounted.
func (s *responseState) abortWithPanic(recovered any) {
	s.mu.Lock()
	if !s.committed && s.status == 0 {
		s.status = http.StatusInternalServerError
	}
	s.mu.Unlock()
	_ = recovered
}

// ---- http.ResponseWriter ----
//
// responseState is the writer the escape hatch hands out, so a library taking
// over the response writes onto the same staged response the contract accessors
// read.

func (s *responseState) Header() http.Header { return s.header }

func (s *responseState) Write(payload []byte) (int, error) { return s.write(payload) }

// WriteHeader stages the status. Only the first call wins, matching net/http.
func (s *responseState) WriteHeader(status int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.status != 0 {
		return
	}
	s.status = status
	switch s.mode {
	case modeSynthetic:
		s.recorder.WriteHeader(status)
	case modeDirect:
		s.fiber.Response().SetStatusCode(status)
	}
}

// Flush satisfies http.Flusher, which streaming libraries assert on before they
// will push bytes incrementally.
func (s *responseState) Flush() { _ = s.flush() }

// ---- contract.EventStream ----

// eventStream writes Server-Sent Events. The framing is byte-identical to the
// gin adapter's, because clients parse on the exact `data: ` prefix and blank
// line terminator.
type eventStream struct {
	state  *responseState
	values contract.Values
}

// EventStream returns the SSE writer for c.
func EventStream(c contract.Context) (contract.EventStream, error) {
	adapted, ok := c.(*requestContext)
	if !ok {
		return nil, errors.New("fiberadapter: context is not a fiber request context")
	}
	return &eventStream{state: adapted.resp, values: adapted}, nil
}

// SetHeaders installs the streaming headers once per request.
//
// Transfer-Encoding is not set: fasthttp manages it and discards a manually set
// value, so the chunked framing comes from the body stream rather than from a
// header. The framing itself is asserted by the conformance suite.
func (s *eventStream) SetHeaders() {
	if _, exists := s.values.Get(EventStreamHeadersKey); exists {
		return
	}
	s.values.Set(EventStreamHeadersKey, true)

	s.state.setHeader("Content-Type", "text/event-stream")
	s.state.setHeader("Cache-Control", "no-cache")
	s.state.setHeader("Connection", "keep-alive")
	s.state.setHeader("X-Accel-Buffering", "no")
}

func (s *eventStream) WriteEvent(payload string) error {
	return s.writeFrame("data: " + payload + "\n\n")
}

func (s *eventStream) WriteNamedEvent(name, payload string) error {
	return s.writeFrame("event: " + name + "\ndata: " + payload + "\n\n")
}

func (s *eventStream) WriteComment(text string) error {
	return s.writeFrame(": " + text + "\n\n")
}

// writeFrame writes one frame and flushes it, so a frame reaches the client as
// one wire chunk. A disconnected client is refused before any byte is written, so
// no partial frame can be emitted.
func (s *eventStream) writeFrame(frame string) error {
	if s.Done() {
		return s.doneErr()
	}
	if _, err := s.state.writeStreaming([]byte(frame)); err != nil {
		return fmt.Errorf("write sse frame: %w", err)
	}
	return s.Flush()
}

func (s *eventStream) WriteRaw(payload []byte) (int, error) {
	if s.Done() {
		return 0, s.doneErr()
	}
	return s.state.writeStreaming(payload)
}

func (s *eventStream) Flush() error {
	if s.Done() {
		return s.doneErr()
	}
	return s.state.flush()
}

func (s *eventStream) Done() bool { return s.state.isDone() }

func (s *eventStream) doneErr() error {
	return fmt.Errorf("request context done: %w", errClientGone)
}

// ---- contract.ResponseStream ----

// responseStream copies raw upstream bytes: video content and the reverse proxy.
type responseStream struct {
	state *responseState
}

// ResponseStream returns the raw response writer for c.
func ResponseStream(c contract.Context) (contract.ResponseStream, error) {
	adapted, ok := c.(*requestContext)
	if !ok {
		return nil, errors.New("fiberadapter: context is not a fiber request context")
	}
	return &responseStream{state: adapted.resp}, nil
}

func (s *responseStream) Write(payload []byte) (int, error) {
	return s.state.writeStreaming(payload)
}

func (s *responseStream) WriteHeader(status int) { s.state.WriteHeader(status) }

func (s *responseStream) SetHeader(key, value string) { s.state.setHeader(key, value) }

func (s *responseStream) AddHeader(key, value string) {
	s.state.mu.Lock()
	defer s.state.mu.Unlock()
	if s.state.committed && s.state.mode == modeChain {
		return
	}
	// Add rather than Set: Codex forwards X-Reasoning-Included and
	// X-Codex-Turn-State as repeats, and collapsing them would drop all but one.
	s.state.header.Add(key, value)
	if s.state.mode == modeDirect {
		s.state.fiber.Response().Header.Add(key, value)
	}
}

func (s *responseStream) Header(key string) string {
	s.state.mu.Lock()
	defer s.state.mu.Unlock()
	return s.state.header.Get(key)
}

func (s *responseStream) Flush() error { return s.state.flush() }

// SetWriteDeadline bounds one blocked write, so a reader waiting on the streaming
// goroutine can always finish.
//
// It reports true for a streaming response because this adapter owns the write end
// of the pipe and pipeConn carries a real deadline. That is why the pipe is created
// here instead of by fasthttp's NewStreamReader, which keeps it private: reporting
// false would silently drop the hang protection scan_sse.go relies on before every
// write. A response with no stream installed has no connection to bound and
// reports false, which callers treat as best-effort.
func (s *responseStream) SetWriteDeadline(deadline time.Time) bool {
	s.state.mu.Lock()
	defer s.state.mu.Unlock()
	if !s.state.streaming || s.state.pipe == nil {
		return false
	}
	return s.state.pipe.Conn1().SetWriteDeadline(deadline) == nil
}

// CanFlush reports whether Flush reaches the client.
//
// It is a constant rather than a probe: the contract requires the capability
// question to have no observable effect, and attempting a flush would commit the
// response. Every mode this adapter builds can push: a chain-backed response owns
// a *bufio.Writer over the pipe it created, a direct response writes through
// fiber, and an in-process response records the flush on its recorder. That last
// case is why this is not false for a synthetic context: the gin adapter reports
// true there too, because a recorder observes flushes, and the conformance suite
// pins that agreement between CanFlush and Flush for both adapters.
func (s *responseStream) CanFlush() bool { return true }

// SupportsWriteDeadline declares that this stream's writer can carry a deadline,
// which the conformance suite reads instead of hardcoding an expectation.
//
// It answers for the streaming case, which is the one the SSE scanner exercises:
// the writer is a pipe this adapter owns, so the deadline is real. A response with
// no stream installed yet has nothing to bound and SetWriteDeadline reports false
// for it, so the declaration is scoped to the same condition.
func (s *responseStream) SupportsWriteDeadline() bool {
	s.state.mu.Lock()
	defer s.state.mu.Unlock()
	return s.state.streaming && s.state.pipe != nil
}

// ---- contract.Streaming on requestContext ----

// EventStream and ResponseStream are the seam business code streams through, so it
// never has to import this package to get a writer.
func (r *requestContext) EventStream() contract.EventStream {
	return &eventStream{state: r.resp, values: r}
}

func (r *requestContext) ResponseStream() contract.ResponseStream {
	return &responseStream{state: r.resp}
}

// assert the adapter satisfies the contract at compile time.
var (
	_ contract.EventStream    = (*eventStream)(nil)
	_ contract.ResponseStream = (*responseStream)(nil)
	_ contract.Context        = (*requestContext)(nil)
	_ http.ResponseWriter     = (*responseState)(nil)
	_ http.Flusher            = (*responseState)(nil)
	_ fasthttp.RequestHandler = nil
)

// NewSyntheticContext builds a contract context backed by an in-process recorder
// rather than a client connection, for internal callers that exercise the relay
// pipeline without an inbound request (channel testing, scheduled probes).
//
// It is buffered by construction: the channel probe reads the whole response back
// after the pipeline returns, which a streamed body could not offer. CanFlush
// reports false on it for the same reason.
func NewSyntheticContext(req *http.Request) (contract.Context, *httptest.ResponseRecorder) {
	if req == nil {
		req = httptest.NewRequest(http.MethodGet, "/", nil)
	}

	adapted := &requestContext{
		values:   make(map[string]any),
		req:      req,
		params:   map[string]string{},
		clientIP: clientIPFromRemoteAddr(req.RemoteAddr),
	}
	adapted.ctx, adapted.cancel = context.WithCancel(req.Context())
	adapted.req = req.WithContext(adapted.ctx)
	adapted.resp = newResponseState(nil, modeSynthetic)
	adapted.resp.cancel = adapted.cancel

	// A synthetic response has no dispatcher to commit it, so writes land in the
	// recorder as they happen.
	adapted.resp.committed = true
	return adapted, adapted.resp.recorder
}

// clientIPFromRemoteAddr strips the port from a peer address, matching what the
// engine's resolution reports for a request that arrived without a trusted proxy.
func clientIPFromRemoteAddr(remoteAddr string) string {
	if remoteAddr == "" {
		return ""
	}
	if host, _, err := net.SplitHostPort(remoteAddr); err == nil {
		return host
	}
	return remoteAddr
}

// ReplaceRequest swaps the inbound request on a synthetic context, so a caller
// can build the context once and retarget it. It reports false for a context that
// did not originate here.
func ReplaceRequest(c contract.Context, req *http.Request) bool {
	adapted, ok := c.(*requestContext)
	if !ok || req == nil {
		return false
	}
	adapted.req = req.WithContext(adapted.ctx)
	adapted.clientIP = clientIPFromRemoteAddr(req.RemoteAddr)
	return true
}

// MustUnwrap recovers the fiber context behind c, panicking when c did not
// originate from this adapter. Like Unwrap it is only valid while the fiber
// handler is on the stack.
func MustUnwrap(c contract.Context) *fiber.Ctx {
	fiberCtx, ok := Unwrap(c)
	if !ok {
		panic("fiberadapter: context did not originate from this adapter")
	}
	return fiberCtx
}
