package middleware

import (
	"bufio"
	"compress/gzip"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/constant"
	"github.com/andybalholm/brotli"
	"github.com/gin-gonic/gin"
	"github.com/klauspost/compress/zstd"
)

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
		clearContentLength := func() {
			c.Request.ContentLength = -1
			c.Request.Header.Del("Content-Length")
		}

		encoding := strings.ToLower(c.GetHeader("Content-Encoding"))
		encoding = strings.TrimSpace(encoding)

		// Auto-detect compression via magic-byte peek when Content-Encoding is
		// absent or "identity".  Also clear the stale Content-Length after
		// decompression and return 415 for unsupported encodings.
		// These improvements originate from PR #4936 by @nerimoe.
		var br *bufio.Reader
		if encoding == "" || encoding == "identity" {
			br = bufio.NewReader(origBody)
			peek, _ := br.Peek(4)
			if len(peek) >= 2 && peek[0] == 0x1f && peek[1] == 0x8b {
				encoding = "gzip"
			} else if len(peek) >= 4 && peek[0] == 0x28 && peek[1] == 0xb5 && peek[2] == 0x2f && peek[3] == 0xfd {
				encoding = "zstd"
			}
		}

		switch encoding {
		case "gzip":
			src := io.Reader(origBody)
			if br != nil {
				src = br
			}
			gzipReader, err := gzip.NewReader(src)
			if err != nil {
				_ = origBody.Close()
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
					"error": gin.H{
						"message": "invalid gzip body",
						"type":    "invalid_request_error",
					},
				})
				return
			}
			c.Request.Body = wrapMaxBytes(&readCloser{
				Reader: gzipReader,
				closeFn: func() error {
					_ = gzipReader.Close()
					return origBody.Close()
				},
			})
			clearContentLength()
			c.Request.Header.Del("Content-Encoding")
		case "br":
			src := io.Reader(origBody)
			if br != nil {
				src = br
			}
			reader := brotli.NewReader(src)
			c.Request.Body = wrapMaxBytes(&readCloser{
				Reader: reader,
				closeFn: func() error {
					return origBody.Close()
				},
			})
			clearContentLength()
			c.Request.Header.Del("Content-Encoding")
		case "zstd":
			src := io.Reader(origBody)
			if br != nil {
				src = br
			}
			// OpenAI Codex CLI/Desktop default to zstd request-body compression
			// (client feature `enable_request_compression`). Without this branch
			// the raw zstd frame (magic 0x28 0xb5 0x2f 0xfd) is handed to the
			// JSON parser and fails with `invalid character '('`.
			//
			// Note: zstd.NewReader is lazy — it does not validate the frame header
			// at construction time, so the error branch below is effectively
			// unreachable for malformed zstd data. Invalid frames surface as Read
			// errors downstream (which prevents raw bytes from reaching the JSON
			// parser). The error check is kept for defensive completeness.
			zstdReader, err := zstd.NewReader(src)
			if err != nil {
				_ = origBody.Close()
				c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
					"error": gin.H{
						"message": "invalid zstd body",
						"type":    "invalid_request_error",
					},
				})
				return
			}
			c.Request.Body = wrapMaxBytes(&readCloser{
				Reader: zstdReader,
				closeFn: func() error {
					zstdReader.Close()
					return origBody.Close()
				},
			})
			clearContentLength()
			c.Request.Header.Del("Content-Encoding")
		case "", "identity":
			// Uncompressed body — still wrap with MaxBytesReader for size
			// enforcement.  When peek detection was used, br already wraps
			// origBody; otherwise wrap origBody directly.
			src := io.Reader(origBody)
			if br != nil {
				src = br
			}
			c.Request.Body = wrapMaxBytes(&readCloser{
				Reader: src,
				closeFn: func() error {
					return origBody.Close()
				},
			})
		default:
			_ = origBody.Close()
			c.AbortWithStatusJSON(http.StatusUnsupportedMediaType, gin.H{
				"error": gin.H{
					"message": "unsupported content encoding: " + encoding,
					"type":    "invalid_request_error",
				},
			})
			return
		}

		// Continue processing the request
		c.Next()
	}
}
