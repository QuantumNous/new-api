package middleware

import (
	"compress/gzip"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/constant"
	"github.com/andybalholm/brotli"
	"github.com/gin-gonic/gin"
	"github.com/klauspost/compress/zstd"
)

// middlewareOriginalContentEncodingKey holds the request's Content-Encoding as
// the client sent it, before the decompression branches below strip the header.
const middlewareOriginalContentEncodingKey = "original_content_encoding"

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
