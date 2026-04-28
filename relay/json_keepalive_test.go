package relay

import (
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type jsonKeepaliveRecorder struct {
	mu                   sync.Mutex
	header               http.Header
	informational        []int
	informationalHeaders []http.Header
	finalStatus          int
	body                 []byte
	flushes              int
}

func newJSONKeepaliveRecorder() *jsonKeepaliveRecorder {
	return &jsonKeepaliveRecorder{header: make(http.Header)}
}

func (r *jsonKeepaliveRecorder) Header() http.Header {
	return r.header
}

func (r *jsonKeepaliveRecorder) Write(data []byte) (int, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.finalStatus == 0 {
		r.finalStatus = http.StatusOK
	}
	r.body = append(r.body, data...)
	return len(data), nil
}

func (r *jsonKeepaliveRecorder) WriteHeader(code int) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if code >= 100 && code < 200 {
		r.informational = append(r.informational, code)
		r.informationalHeaders = append(r.informationalHeaders, cloneTestHeader(r.header))
		return
	}
	r.finalStatus = code
}

func (r *jsonKeepaliveRecorder) Flush() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.flushes++
}

type jsonKeepaliveRecorderSnapshot struct {
	informational        []int
	informationalHeaders []http.Header
	finalStatus          int
	flushes              int
	body                 string
	header               http.Header
}

func (r *jsonKeepaliveRecorder) snapshot() jsonKeepaliveRecorderSnapshot {
	r.mu.Lock()
	defer r.mu.Unlock()
	return jsonKeepaliveRecorderSnapshot{
		informational:        append([]int(nil), r.informational...),
		informationalHeaders: append([]http.Header(nil), r.informationalHeaders...),
		finalStatus:          r.finalStatus,
		flushes:              r.flushes,
		body:                 string(r.body),
		header:               cloneTestHeader(r.header),
	}
}

func cloneTestHeader(src http.Header) http.Header {
	dst := make(http.Header, len(src))
	for key, values := range src {
		dst[key] = append([]string(nil), values...)
	}
	return dst
}

func newJSONKeepaliveTestContext(rec *jsonKeepaliveRecorder) *gin.Context {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(rec)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/images/generations", nil)
	return c
}

func TestJSONKeepaliveSendsInformationalProcessing(t *testing.T) {
	rec := newJSONKeepaliveRecorder()
	c := newJSONKeepaliveTestContext(rec)

	keepalive := startJSONKeepalive(c, time.Millisecond, time.Millisecond)
	require.NotNil(t, keepalive)
	require.Eventually(t, func() bool {
		snap := rec.snapshot()
		return keepalive.wasWritten() && len(snap.informational) > 0 && snap.flushes > 0
	}, time.Second, time.Millisecond)
	keepalive.stop()

	snap := rec.snapshot()
	require.Equal(t, http.StatusProcessing, snap.informational[0])
	require.Equal(t, "application/json; charset=utf-8", snap.informationalHeaders[0].Get("Content-Type"))
	require.Equal(t, "no-cache", snap.informationalHeaders[0].Get("Cache-Control"))
	require.Equal(t, "no", snap.informationalHeaders[0].Get("X-Accel-Buffering"))
	require.Empty(t, snap.header.Get("Content-Type"))
	require.Empty(t, snap.header.Get("Cache-Control"))
	require.Empty(t, snap.header.Get("X-Accel-Buffering"))
	require.Greater(t, snap.flushes, 0)
	require.Zero(t, snap.finalStatus)
}

func TestJSONKeepalivePreservesFinalJSONStatus(t *testing.T) {
	rec := newJSONKeepaliveRecorder()
	c := newJSONKeepaliveTestContext(rec)

	keepalive := startJSONKeepalive(c, time.Millisecond, time.Millisecond)
	require.Eventually(t, func() bool {
		return keepalive.wasWritten()
	}, time.Second, time.Millisecond)
	keepalive.stop()

	rec.WriteHeader(http.StatusOK)
	_, err := rec.Write([]byte(`{"data":[]}`))
	require.NoError(t, err)

	snap := rec.snapshot()
	require.NotEmpty(t, snap.informational)
	require.Equal(t, http.StatusProcessing, snap.informational[0])
	require.Equal(t, http.StatusOK, snap.finalStatus)
	require.Equal(t, `{"data":[]}`, snap.body)
}

func TestJSONKeepaliveDoesNotSetHeadersBeforeFirstTick(t *testing.T) {
	rec := newJSONKeepaliveRecorder()
	c := newJSONKeepaliveTestContext(rec)

	keepalive := startJSONKeepalive(c, time.Hour, time.Hour)
	require.NotNil(t, keepalive)
	keepalive.stop()

	snap := rec.snapshot()
	require.Empty(t, snap.informational)
	require.Empty(t, snap.header.Get("Content-Type"))
	require.Empty(t, snap.header.Get("Cache-Control"))
	require.Empty(t, snap.header.Get("X-Accel-Buffering"))
}

func TestJSONKeepaliveRepeatsUntilStoppedThenStaysQuiet(t *testing.T) {
	rec := newJSONKeepaliveRecorder()
	c := newJSONKeepaliveTestContext(rec)

	keepalive := startJSONKeepalive(c, time.Millisecond, time.Millisecond)
	require.NotNil(t, keepalive)
	require.Eventually(t, func() bool {
		return len(rec.snapshot().informational) >= 3
	}, time.Second, time.Millisecond)

	keepalive.stop()
	countAfterStop := len(rec.snapshot().informational)
	time.Sleep(10 * time.Millisecond)

	require.Equal(t, countAfterStop, len(rec.snapshot().informational))
}
