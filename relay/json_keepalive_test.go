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
	mu            sync.Mutex
	header        http.Header
	informational []int
	finalStatus   int
	body          []byte
	flushes       int
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
		return
	}
	r.finalStatus = code
}

func (r *jsonKeepaliveRecorder) Flush() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.flushes++
}

func (r *jsonKeepaliveRecorder) snapshot() ([]int, int, int, string) {
	r.mu.Lock()
	defer r.mu.Unlock()
	informational := append([]int(nil), r.informational...)
	return informational, r.finalStatus, r.flushes, string(r.body)
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
		informational, _, flushes, _ := rec.snapshot()
		return keepalive.wasWritten() && len(informational) > 0 && flushes > 0
	}, time.Second, time.Millisecond)
	keepalive.stop()

	informational, finalStatus, flushes, _ := rec.snapshot()
	require.Equal(t, http.StatusProcessing, informational[0])
	require.Greater(t, flushes, 0)
	require.Zero(t, finalStatus)
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

	informational, finalStatus, _, body := rec.snapshot()
	require.NotEmpty(t, informational)
	require.Equal(t, http.StatusProcessing, informational[0])
	require.Equal(t, http.StatusOK, finalStatus)
	require.Equal(t, `{"data":[]}`, body)
}
