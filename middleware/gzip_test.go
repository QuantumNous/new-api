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
// does NOT leak raw garbage to the JSON parser. zstd.NewReader is lazy on
// v1.18, so the error surfaces at the first Read — we assert the handler
// sees a read error (or empty body) rather than receiving raw bytes it would
// then misinterpret as JSON.
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

	// Either the read surfaced an error and we returned 400, or the decoder
	// produced empty output. The one thing that must NOT happen is the raw
	// `invalid` bytes reaching the handler as if they were JSON — that is
	// exactly the regression from #6313.
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

func mustReadAll(t *testing.T, r io.Reader) []byte {
	t.Helper()
	b, err := io.ReadAll(r)
	require.NoError(t, err)
	return b
}
