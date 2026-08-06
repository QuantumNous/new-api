package main

import (
	"io"
	"net/http"
	"sync"
	"sync/atomic"
)

// captureQueueDepth buffers body chunks between the forwarding path and the
// inspector, so ordinary parse jitter never shows up in upload throughput.
//
// A full queue makes the forwarding path wait rather than dropping the chunk.
// Dropping was tried first and is wrong: what gets lost is the end of the body,
// which is precisely where the input the user just submitted lives. The wait is
// bounded by JSON parsing of bytes already in memory — microseconds against a
// relay round trip.
const captureQueueDepth = 8

// bodyCapture inspects a request body while it is forwarded upstream.
//
// The body is never buffered in full, and no prefix of it is buffered either.
// Prefix buffering — which is what this replaced — silently destroyed the audit
// record of every large request: an agent client resends its whole conversation
// on each turn, so a 1.6 MB body is ordinary, and a prefix of a JSON document is
// not JSON. Extraction parsed nothing and the row landed with an empty
// prompt_text, marked truncated. Reading the body as a stream keeps the record
// correct for a body of any size, and peak memory is one message rather than the
// whole request.
type bodyCapture struct {
	chunks   chan []byte
	stopped  chan struct{}
	stopOnce sync.Once
	done     chan struct{}

	// pending is the chunk currently being handed to the inspector; it is touched
	// only by the inspection goroutine.
	pending []byte

	// facts is written by the inspection goroutine and read only after done is
	// closed.
	facts requestFacts

	limit     int64
	bytesRead atomic.Int64
	// complete records that the body reached EOF, so every byte the client sent
	// was inspected.
	complete atomic.Bool
	// overLimit records that the body outgrew capture.max_body_bytes and
	// inspection stopped early.
	overLimit atomic.Bool
}

// startBodyCapture rewires r.Body so every byte still reaches the upstream while
// a copy streams through prompt extraction on its own goroutine.
func startBodyCapture(r *http.Request, capture CaptureConfig) *bodyCapture {
	audit := &bodyCapture{
		chunks:  make(chan []byte, captureQueueDepth),
		stopped: make(chan struct{}),
		done:    make(chan struct{}),
		limit:   capture.MaxBodyBytes,
	}
	if r.Body == nil {
		audit.complete.Store(true)
		close(audit.done)
		return audit
	}

	options := extractOptions{
		scope:          capture.PromptScope,
		maxPromptBytes: capture.MaxPromptBytes,
	}
	if capture.StoreRawBody {
		options.maxRawBodyBytes = capture.MaxRawBodyBytes
	}

	encoding := r.Header.Get("Content-Encoding")
	r.Body = &teeBody{source: r.Body, capture: audit}
	go func() {
		// Inspection only ends before the body does on a read error — a corrupt
		// compressed body. Stopping then is what releases the forwarding path, which
		// would otherwise wait on a queue nobody drains.
		defer close(audit.done)
		defer audit.stop()
		audit.facts = extractRequestFacts(audit, encoding, options)
	}()
	return audit
}

// result stops the inspector and reports what it extracted, plus whether the
// audited content is incomplete.
//
// It is safe to call while the response is still streaming: the inspector only
// ever sees bytes that were already forwarded upstream.
func (c *bodyCapture) result() (requestFacts, bool) {
	c.stop()
	<-c.done
	incomplete := c.overLimit.Load() || !c.complete.Load() || c.facts.Partial || c.facts.PromptEvicted
	return c.facts, incomplete
}

func (c *bodyCapture) stop() {
	c.stopOnce.Do(func() { close(c.stopped) })
}

// feed hands a copy of the bytes just forwarded upstream to the inspector. The
// caller's buffer is reused after Read returns, so the copy is mandatory.
func (c *bodyCapture) feed(data []byte) {
	select {
	case <-c.stopped:
		return
	default:
	}
	if c.limit > 0 && c.bytesRead.Load() > c.limit {
		c.overLimit.Store(true)
		c.stop()
		return
	}
	chunk := make([]byte, len(data))
	copy(chunk, data)
	select {
	case c.chunks <- chunk:
	case <-c.stopped:
	}
}

// Read serves the copied body to the inspector, and is called only from the
// inspection goroutine.
func (c *bodyCapture) Read(p []byte) (int, error) {
	for len(c.pending) == 0 {
		chunk, ok := c.nextChunk()
		if !ok {
			return 0, io.EOF
		}
		c.pending = chunk
	}
	n := copy(p, c.pending)
	c.pending = c.pending[n:]
	return n, nil
}

// nextChunk blocks until another chunk arrives or feeding has stopped, then
// hands over whatever is still queued before reporting the end of the body.
func (c *bodyCapture) nextChunk() ([]byte, bool) {
	select {
	case chunk := <-c.chunks:
		return chunk, true
	case <-c.stopped:
	}
	select {
	case chunk := <-c.chunks:
		return chunk, true
	default:
		return nil, false
	}
}

// teeBody forwards the client's bytes upstream unchanged while copying them to
// the inspector, so the upstream request stays byte-identical to what the client
// sent.
type teeBody struct {
	source  io.ReadCloser
	capture *bodyCapture
}

func (b *teeBody) Read(p []byte) (int, error) {
	n, err := b.source.Read(p)
	if n > 0 {
		b.capture.bytesRead.Add(int64(n))
		b.capture.feed(p[:n])
	}
	if err == io.EOF {
		b.capture.complete.Store(true)
		b.capture.stop()
	}
	return n, err
}

func (b *teeBody) Close() error {
	// No further bytes can arrive, so the inspector may finish with what it has.
	b.capture.stop()
	return b.source.Close()
}
