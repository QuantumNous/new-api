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

		// Use bufio.Reader to peek without consuming
		br := bufio.NewReader(origBody)
		peek, _ := br.Peek(4)

		if encoding == "" || encoding == "identity" {
			if len(peek) >= 2 && peek[0] == 0x1f && peek[1] == 0x8b {
				encoding = "gzip"
			} else if len(peek) >= 4 && peek[0] == 0x28 && peek[1] == 0xb5 && peek[2] == 0x2f && peek[3] == 0xfd {
				encoding = "zstd"
			}
		}

		switch encoding {
		case "gzip":
			gzipReader, err := gzip.NewReader(br)
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
			reader := brotli.NewReader(br)
			c.Request.Body = wrapMaxBytes(&readCloser{
				Reader: reader,
				closeFn: func() error {
					return origBody.Close()
				},
			})
			clearContentLength()
			c.Request.Header.Del("Content-Encoding")
		case "zstd":
			decoder, err := zstd.NewReader(br)
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
				Reader: decoder,
				closeFn: func() error {
					decoder.Close()
					return origBody.Close()
				},
			})
			clearContentLength()
			c.Request.Header.Del("Content-Encoding")
		case "", "identity":
			c.Request.Body = wrapMaxBytes(&readCloser{
				Reader: br,
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
