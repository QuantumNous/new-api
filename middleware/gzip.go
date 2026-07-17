package middleware

import (
	"compress/gzip"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/andybalholm/brotli"
	"github.com/gin-gonic/gin"
	"github.com/klauspost/compress/zstd"
)

// middlewareOriginalContentEncodingKey holds the request's Content-Encoding as
// the client sent it, before the decompression branches below strip the header.
const middlewareOriginalContentEncodingKey = "original_content_encoding"

// uploadIdleTimeout is how long a request body may go without delivering a
// single byte before we give up on it. Generous by default (see
// UPLOAD_IDLE_TIMEOUT_SECONDS): a client holding the payload never pauses this
// long, so it only catches genuine stalls. 0 waits indefinitely.
func uploadIdleTimeout() time.Duration {
	return time.Duration(constant.UploadIdleTimeoutSeconds) * time.Second
}

// middlewareWireBytesKey holds the *countingBody wrapping the raw request body.
const middlewareWireBytesKey = "request_wire_bytes"

// idleTimeoutBody aborts a request-body read that has stopped making progress.
//
// The deadline is pushed forward on every Read, so it only ever fires when the
// client has genuinely gone quiet — a slow but progressing upload is untouched,
// however long it takes. It is set on the connection rather than tracked in
// user space because a blocked Read cannot be interrupted any other way, and it
// is cleared as soon as the body is done so the deadline cannot leak into the
// response stream or the next keep-alive request.
type idleTimeoutBody struct {
	io.ReadCloser
	rc      *http.ResponseController
	timeout time.Duration
	armed   bool
}

func (b *idleTimeoutBody) Read(p []byte) (int, error) {
	if b.timeout > 0 {
		// A server that cannot set deadlines (h2 in some configurations) just
		// gets the old behaviour rather than a failed request.
		if err := b.rc.SetReadDeadline(time.Now().Add(b.timeout)); err == nil {
			b.armed = true
		}
	}
	n, err := b.ReadCloser.Read(p)
	if err != nil {
		b.clearDeadline()
		if os.IsTimeout(err) {
			return n, fmt.Errorf("%w (%s)", common.ErrUploadIdleTimeout, b.timeout)
		}
	}
	return n, err
}

func (b *idleTimeoutBody) Close() error {
	b.clearDeadline()
	return b.ReadCloser.Close()
}

func (b *idleTimeoutBody) clearDeadline() {
	if b.armed {
		_ = b.rc.SetReadDeadline(time.Time{})
		b.armed = false
	}
}

// countingBody tallies bytes read off the wire. The count is atomic because the
// zstd decoder reads ahead from its own goroutine, so the diagnostic can sample
// this while that goroutine is still reading.
type countingBody struct {
	io.ReadCloser
	n atomic.Int64
}

func (b *countingBody) Read(p []byte) (int, error) {
	n, err := b.ReadCloser.Read(p)
	if n > 0 {
		b.n.Add(int64(n))
	}
	return n, err
}

// WireBytesRead reports how many raw body bytes arrived from the client, or -1
// when the request never went through DecompressRequestMiddleware.
func WireBytesRead(c *gin.Context) int64 {
	v, ok := c.Get(middlewareWireBytesKey)
	if !ok {
		return -1
	}
	body, ok := v.(*countingBody)
	if !ok {
		return -1
	}
	return body.n.Load()
}

type readCloser struct {
	io.Reader
	closeFn func() error
}

func (rc *readCloser) Close() error {
	if rc.closeFn != nil {
		return rc.closeFn()
	}
	return nil
}

func DecompressRequestMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Body == nil || c.Request.Method == http.MethodGet {
			c.Next()
			return
		}
		maxMB := constant.MaxRequestBodyMB
		if maxMB <= 0 {
			maxMB = 32
		}
		maxBytes := int64(maxMB) << 20

		// Cut a stalled upload loose before the client's own timeout does. Wraps
		// the raw body so it governs the compressed stream — the bytes that
		// actually have to arrive — and sits under the counter so wire_bytes
		// still reports what did.
		body := c.Request.Body
		if d := uploadIdleTimeout(); d > 0 {
			body = &idleTimeoutBody{
				ReadCloser: body,
				rc:         http.NewResponseController(c.Writer),
				timeout:    d,
			}
		}

		// Count bytes as they come off the wire, before any decompressor. This is
		// the only place the compressed stream is still visible, and it is the
		// number that decides who to blame for a truncated upload: compare it to
		// Content-Length and either the client stopped sending, or it sent
		// everything and we stalled. Counting after the decompressor (as the
		// first version of this diagnostic did) measures decompressed output
		// against a compressed Content-Length — two different units, and it can
		// even exceed it.
		wireBody := &countingBody{ReadCloser: body}
		c.Set(middlewareWireBytesKey, wireBody)
		c.Request.Body = wireBody

		origBody := c.Request.Body
		wrapMaxBytes := func(body io.ReadCloser) io.ReadCloser {
			return http.MaxBytesReader(c.Writer, body, maxBytes)
		}

		// Remember what the client actually sent: the branches below strip
		// Content-Encoding after wrapping the body in a decompressor, which
		// erases the only evidence that a later "unexpected EOF" was a truncated
		// compressed stream rather than a truncated plain one.
		if enc := c.GetHeader("Content-Encoding"); enc != "" {
			c.Set(middlewareOriginalContentEncodingKey, enc)
		}

		switch c.GetHeader("Content-Encoding") {
		case "gzip":
			gzipReader, err := gzip.NewReader(origBody)
			if err != nil {
				_ = origBody.Close()
				c.AbortWithStatus(http.StatusBadRequest)
				return
			}
			// Replace the request body with the decompressed data, and enforce a max size (post-decompression).
			c.Request.Body = wrapMaxBytes(&readCloser{
				Reader: gzipReader,
				closeFn: func() error {
					_ = gzipReader.Close()
					return origBody.Close()
				},
			})
			c.Request.Header.Del("Content-Encoding")
		case "br":
			reader := brotli.NewReader(origBody)
			c.Request.Body = wrapMaxBytes(&readCloser{
				Reader: reader,
				closeFn: func() error {
					return origBody.Close()
				},
			})
			c.Request.Header.Del("Content-Encoding")
		case "zstd":
			// Codex CLI 0.133+ sends Responses API request bodies with
			// Content-Encoding: zstd. Without this branch the raw compressed
			// bytes reach the JSON parser and the request 400s with
			// "invalid JSON request body".
			zstdReader, err := zstd.NewReader(origBody)
			if err != nil {
				_ = origBody.Close()
				c.AbortWithStatus(http.StatusBadRequest)
				return
			}
			c.Request.Body = wrapMaxBytes(&readCloser{
				Reader: zstdReader,
				closeFn: func() error {
					zstdReader.Close()
					return origBody.Close()
				},
			})
			c.Request.Header.Del("Content-Encoding")
		default:
			// Even for uncompressed bodies, enforce a max size to avoid huge request allocations.
			c.Request.Body = wrapMaxBytes(origBody)
		}

		// Continue processing the request
		c.Next()
	}
}
