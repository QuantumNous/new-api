package middleware

import (
	"bytes"
	"compress/gzip"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/andybalholm/brotli"
	"github.com/gin-gonic/gin"
	"github.com/klauspost/compress/zstd"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// runDecompressMiddleware runs DecompressRequestMiddleware against a request
// built from the given encoding + raw body, then returns the fully-drained
// request body (after decompression) and the HTTP status the middleware may
// have aborted with (0 means no abort).
func runDecompressMiddleware(t *testing.T, encoding string, compressedBody []byte) (string, int) {
	t.Helper()
	gin.SetMode(gin.TestMode)

	r := gin.New()
	var captured string
	var status int
	r.Use(DecompressRequestMiddleware())
	r.POST("/v1/echo", func(c *gin.Context) {
		buf, err := io.ReadAll(c.Request.Body)
		if err != nil {
			status = -1
			c.String(http.StatusBadRequest, "read err: %v", err)
			return
		}
		captured = string(buf)
		// Confirm the middleware stripped Content-Encoding, the same way it
		// does for gzip/br — without this, downstream proxies would re-encode
		// or reject the body again.
		ce := c.GetHeader("Content-Encoding")
		assert.Empty(t, ce, "Content-Encoding header not stripped for %q", encoding)
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/echo", bytes.NewReader(compressedBody))
	req.Header.Set("Content-Type", "application/json")
	if encoding != "" {
		req.Header.Set("Content-Encoding", encoding)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if status == 0 {
		status = w.Code
	}
	if status == http.StatusOK {
		return captured, status
	}
	return "", status
}

func compressGzip(t *testing.T, raw []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	gw := gzip.NewWriter(&buf)
	_, err := gw.Write(raw)
	require.NoError(t, err)
	require.NoError(t, gw.Close())
	return buf.Bytes()
}

func compressBrotli(t *testing.T, raw []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	bw := brotli.NewWriter(&buf)
	_, err := bw.Write(raw)
	require.NoError(t, err)
	require.NoError(t, bw.Close())
	return buf.Bytes()
}

func compressZstd(t *testing.T, raw []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	encoder, err := zstd.NewWriter(&buf)
	require.NoError(t, err)
	_, err = encoder.Write(raw)
	require.NoError(t, err)
	require.NoError(t, encoder.Close())
	return buf.Bytes()
}

// TestDecompressRequestMiddleware_Zstd verifies the regression from issue
// #6313: a Content-Encoding: zstd body used to be passed through verbatim,
// causing JSON parsing to fail on the zstd magic bytes (0x28 = '(').
func TestDecompressRequestMiddleware_Zstd(t *testing.T) {
	raw := []byte(`{"model":"gpt-4","input":[{"role":"user","content":"hi"}]}`)
	body := compressZstd(t, raw)

	// Sanity: confirm we actually produced a zstd frame whose magic would be
	// misread as '(' — otherwise the regression test isn't exercising the bug.
	require.GreaterOrEqual(t, len(body), 4)
	require.Equal(t, byte(0x28), body[0], "expected zstd magic 0x28.., got % x", body[:min(4, len(body))])

	got, status := runDecompressMiddleware(t, "zstd", body)
	require.Equal(t, http.StatusOK, status, "expected 200 OK (the bug from #6313 yields 400 with `invalid character '('`)")
	assert.Equal(t, string(raw), got, "decompressed body mismatch")
}

// TestDecompressRequestMiddleware_AllEncodingsBehaviorParity documents that
// zstd, gzip and br all behave identically: decode to the original payload
// and strip the Content-Encoding header.
func TestDecompressRequestMiddleware_AllEncodingsBehaviorParity(t *testing.T) {
	raw := []byte(`{"hello":"world","n":42}`)

	cases := []struct {
		name     string
		encoding string
		encode   func(t *testing.T, raw []byte) []byte
	}{
		{"gzip", "gzip", compressGzip},
		{"br", "br", compressBrotli},
		{"zstd", "zstd", compressZstd},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, status := runDecompressMiddleware(t, tc.encoding, tc.encode(t, raw))
			require.Equal(t, http.StatusOK, status, "%s: expected 200", tc.name)
			assert.Equal(t, string(raw), got, "%s: body mismatch", tc.name)
		})
	}
}

// TestDecompressRequestMiddleware_UncompressedPassThrough ensures the default
// branch keeps working (no Content-Encoding → body untouched).
func TestDecompressRequestMiddleware_UncompressedPassThrough(t *testing.T) {
	raw := []byte(`{"hello":"world"}`)
	got, status := runDecompressMiddleware(t, "", raw)
	require.Equal(t, http.StatusOK, status)
	assert.Equal(t, string(raw), got, "uncompressed body should pass through untouched")
}

// TestDecompressRequestMiddleware_InvalidZstdDoesNotLeak verifies that a
// Content-Encoding: zstd header on a body that is *not* a valid zstd frame
// does NOT leak raw garbage to the JSON parser. zstd.NewReader is lazy —
// it succeeds at construction time and errors on the first Read. This means
// the middleware does not return 400 (unlike gzip where NewReader validates
// immediately), but the handler's ReadAll will fail, preventing raw bytes
// from reaching the JSON parser.
func TestDecompressRequestMiddleware_InvalidZstdDoesNotLeak(t *testing.T) {
	gin.SetMode(gin.TestMode)
	invalid := []byte("definitely not a zstd frame")

	r := gin.New()
	var readErr error
	var captured []byte
	r.Use(DecompressRequestMiddleware())
	r.POST("/v1/echo", func(c *gin.Context) {
		captured, readErr = io.ReadAll(c.Request.Body)
		if readErr != nil {
			c.String(http.StatusBadRequest, "read err: %v", readErr)
			return
		}
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/echo", bytes.NewReader(invalid))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "zstd")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	// Either the read surfaced an error (preferred — the decoder rejected the
	// input), or the decoder produced empty output. The one thing that must NOT
	// happen is the raw `invalid` bytes reaching the handler as if they were
	// JSON — that is exactly the regression from #6313.
	if readErr == nil {
		assert.False(t, bytes.Equal(captured, invalid), "invalid zstd body leaked to handler as raw bytes: %q", captured)
	}
}

// TestDecompressRequestMiddleware_GetSkipped verifies GET requests are not
// touched (existing behaviour, kept stable by this change).
func TestDecompressRequestMiddleware_GetSkipped(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(DecompressRequestMiddleware())
	r.GET("/v1/ping", func(c *gin.Context) { c.String(http.StatusOK, "pong") })

	req := httptest.NewRequest(http.MethodGet, "/v1/ping", strings.NewReader(""))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "pong", w.Body.String())
}

// TestDecompressRequestMiddleware_ZstdProducesValidJSON verifies the
// end-to-end intent of #6313: after decompression, the body must be
// unmarshallable as JSON by the project's own common.Unmarshal wrapper
// (which is what downstream relay handlers actually call). This guards the
// regression at the level the bug actually surfaces.
func TestDecompressRequestMiddleware_ZstdProducesValidJSON(t *testing.T) {
	gin.SetMode(gin.TestMode)

	type payload struct {
		Model string `json:"model"`
	}
	raw, err := common.Marshal(payload{Model: "gpt-4"})
	require.NoError(t, err)
	body := compressZstd(t, raw)

	r := gin.New()
	var decoded payload
	r.Use(DecompressRequestMiddleware())
	r.POST("/v1/echo", func(c *gin.Context) {
		require.NoError(t, common.UnmarshalJsonStr(string(mustReadAll(t, c.Request.Body)), &decoded))
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/echo", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "zstd")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "gpt-4", decoded.Model)
}

// --- Tests for behaviour added alongside the zstd branch (from PR #4936) ---

// TestDecompressRequestMiddleware_PeekDetectsGzipWithoutHeader verifies that
// when Content-Encoding is absent but the body starts with gzip magic bytes
// (0x1f 0x8b), the middleware still decompresses it automatically.
func TestDecompressRequestMiddleware_PeekDetectsGzipWithoutHeader(t *testing.T) {
	raw := []byte(`{"peek":"gzip"}`)
	body := compressGzip(t, raw)

	got, status := runDecompressMiddleware(t, "", body)
	require.Equal(t, http.StatusOK, status, "peek should auto-detect gzip even without Content-Encoding")
	assert.Equal(t, string(raw), got, "decompressed body mismatch after peek detection")
}

// TestDecompressRequestMiddleware_PeekDetectsZstdWithoutHeader verifies that
// when Content-Encoding is absent but the body starts with zstd magic bytes
// (0x28 0xb5 0x2f 0xfd), the middleware still decompresses it automatically.
func TestDecompressRequestMiddleware_PeekDetectsZstdWithoutHeader(t *testing.T) {
	raw := []byte(`{"peek":"zstd"}`)
	body := compressZstd(t, raw)

	got, status := runDecompressMiddleware(t, "", body)
	require.Equal(t, http.StatusOK, status, "peek should auto-detect zstd even without Content-Encoding")
	assert.Equal(t, string(raw), got, "decompressed body mismatch after peek detection")
}

// TestDecompressRequestMiddleware_IdentityEncodingPassesThrough verifies that
// Content-Encoding: identity is treated as "no encoding" and the body is
// passed through unchanged. The identity branch does NOT strip the header
// (it is not a compression encoding that needs removal).
func TestDecompressRequestMiddleware_IdentityEncodingPassesThrough(t *testing.T) {
	gin.SetMode(gin.TestMode)
	raw := []byte(`{"encoding":"identity"}`)

	r := gin.New()
	var captured string
	r.Use(DecompressRequestMiddleware())
	r.POST("/v1/echo", func(c *gin.Context) {
		buf, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		captured = string(buf)
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/echo", bytes.NewReader(raw))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "identity")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, string(raw), captured, "identity body should pass through untouched")
}

// TestDecompressRequestMiddleware_UnsupportedEncodingReturns415 verifies that
// an unsupported Content-Encoding (e.g. "deflate") results in HTTP 415 with
// an OpenAI-style error JSON, not a passthrough that would corrupt the body.
func TestDecompressRequestMiddleware_UnsupportedEncodingReturns415(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(DecompressRequestMiddleware())
	r.POST("/v1/echo", func(c *gin.Context) {
		// Handler must never be reached for unsupported encodings.
		c.String(http.StatusOK, "should not reach here")
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/echo", strings.NewReader("compressed data"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "deflate")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusUnsupportedMediaType, w.Code, "unsupported encoding should return 415")

	var resp map[string]any
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &resp), "response should be valid JSON")
	errObj, ok := resp["error"].(map[string]any)
	require.True(t, ok, "response should have an 'error' object")
	assert.Contains(t, errObj["message"], "unsupported content encoding", "error message should mention the encoding")
	assert.Equal(t, "invalid_request_error", errObj["type"], "error type should be invalid_request_error")
}

// TestDecompressRequestMiddleware_InvalidGzipReturns400 verifies that a
// Content-Encoding: gzip header on a body that is NOT valid gzip returns
// HTTP 400 with an OpenAI-style error JSON.
func TestDecompressRequestMiddleware_InvalidGzipReturns400(t *testing.T) {
	gin.SetMode(gin.TestMode)

	r := gin.New()
	r.Use(DecompressRequestMiddleware())
	r.POST("/v1/echo", func(c *gin.Context) {
		c.String(http.StatusOK, "should not reach here")
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/echo", strings.NewReader("not gzip data"))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusBadRequest, w.Code, "invalid gzip body should return 400")

	var resp map[string]any
	require.NoError(t, common.Unmarshal(w.Body.Bytes(), &resp), "response should be valid JSON")
	errObj, ok := resp["error"].(map[string]any)
	require.True(t, ok, "response should have an 'error' object")
	assert.Contains(t, errObj["message"], "invalid gzip body", "error message should mention invalid gzip")
}

// TestDecompressRequestMiddleware_ContentLengthClearedAfterDecompression
// verifies that after decompression, Content-Length and Content-Encoding
// headers are removed, and ContentLength is set to -1. The Content-Length
// of the compressed body is stale after decompression and would mislead
// downstream consumers.
func TestDecompressRequestMiddleware_ContentLengthClearedAfterDecompression(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, enc := range []string{"gzip", "br", "zstd"} {
		t.Run(enc, func(t *testing.T) {
			raw := []byte(`{"test":"content-length"}`)
			var body []byte
			switch enc {
			case "gzip":
				body = compressGzip(t, raw)
			case "br":
				body = compressBrotli(t, raw)
			case "zstd":
				body = compressZstd(t, raw)
			}

			var gotContentLength int64
			var gotContentLengthHeader string
			var gotContentEncoding string

			r := gin.New()
			r.Use(DecompressRequestMiddleware())
			r.POST("/v1/echo", func(c *gin.Context) {
				io.ReadAll(c.Request.Body) // drain body
				gotContentLength = c.Request.ContentLength
				gotContentLengthHeader = c.Request.Header.Get("Content-Length")
				gotContentEncoding = c.Request.Header.Get("Content-Encoding")
				c.String(http.StatusOK, "ok")
			})

			req := httptest.NewRequest(http.MethodPost, "/v1/echo", bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Content-Encoding", enc)
			req.ContentLength = int64(len(body)) // simulate real Content-Length

			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			require.Equal(t, http.StatusOK, w.Code)
			assert.Equal(t, int64(-1), gotContentLength, "%s: ContentLength should be -1 after decompression", enc)
			assert.Empty(t, gotContentLengthHeader, "%s: Content-Length header should be removed", enc)
			assert.Empty(t, gotContentEncoding, "%s: Content-Encoding header should be removed", enc)
		})
	}
}

// TestDecompressRequestMiddleware_PeekDetectsGzipWithIdentityHeader verifies
// that even when Content-Encoding is explicitly "identity", if the body starts
// with gzip magic bytes the middleware still auto-detects and decompresses.
func TestDecompressRequestMiddleware_PeekDetectsGzipWithIdentityHeader(t *testing.T) {
	raw := []byte(`{"identity":"but-actually-gzip"}`)
	body := compressGzip(t, raw)

	gin.SetMode(gin.TestMode)
	r := gin.New()
	var captured string
	r.Use(DecompressRequestMiddleware())
	r.POST("/v1/echo", func(c *gin.Context) {
		buf, err := io.ReadAll(c.Request.Body)
		require.NoError(t, err)
		captured = string(buf)
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/echo", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "identity")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, "peek should auto-detect gzip under Content-Encoding: identity")
	assert.Equal(t, string(raw), captured, "decompressed body mismatch")
}

// TestDecompressRequestMiddleware_EmptyBodyNoEncoding verifies that an empty
// POST body with no Content-Encoding is handled without errors (Peek returns
// fewer bytes but the length checks prevent false detection).
func TestDecompressRequestMiddleware_EmptyBodyNoEncoding(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(DecompressRequestMiddleware())
	r.POST("/v1/echo", func(c *gin.Context) {
		io.ReadAll(c.Request.Body)
		c.String(http.StatusOK, "ok")
	})

	req := httptest.NewRequest(http.MethodPost, "/v1/echo", bytes.NewReader(nil))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code, "empty body with no encoding should pass through")
}

func mustReadAll(t *testing.T, r io.Reader) []byte {
	t.Helper()
	b, err := io.ReadAll(r)
	require.NoError(t, err)
	return b
}
