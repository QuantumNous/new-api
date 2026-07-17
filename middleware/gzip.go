package middleware

import (
	"compress/gzip"
	"io"
	"net/http"
	"sync/atomic"

	"github.com/QuantumNous/new-api/constant"
	"github.com/andybalholm/brotli"
	"github.com/gin-gonic/gin"
	"github.com/klauspost/compress/zstd"
)

// middlewareOriginalContentEncodingKey holds the request's Content-Encoding as
// the client sent it, before the decompression branches below strip the header.
const middlewareOriginalContentEncodingKey = "original_content_encoding"

// middlewareWireBytesKey holds the *countingBody wrapping the raw request body.
const middlewareWireBytesKey = "request_wire_bytes"

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

		// Count bytes as they come off the wire, before any decompressor. This is
		// the only place the compressed stream is still visible, and it is the
		// number that decides who to blame for a truncated upload: compare it to
		// Content-Length and either the client stopped sending, or it sent
		// everything and we stalled. Counting after the decompressor (as the
		// first version of this diagnostic did) measures decompressed output
		// against a compressed Content-Length — two different units, and it can
		// even exceed it.
		wireBody := &countingBody{ReadCloser: c.Request.Body}
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
