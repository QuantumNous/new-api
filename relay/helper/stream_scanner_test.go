package helper

import (
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func setupStreamTest(t *testing.T, body io.Reader) (*gin.Context, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	resp := &http.Response{
		Body: io.NopCloser(body),
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{},
	}

	return c, resp, info
}

func buildSSEBody(n int) string {
	var b strings.Builder
	for i := 0; i < n; i++ {
		fmt.Fprintf(&b, "data: {\"id\":%d,\"choices\":[{\"delta\":{\"content\":\"token_%d\"}}]}\n", i, i)
	}
	b.WriteString("data: [DONE]\n")
	return b.String()
}

// slowReader wraps a reader and injects a delay before each Read call,
// simulating a slow upstream that trickles data.
type slowReader struct {
	r     io.Reader
	delay time.Duration
}

func (s *slowReader) Read(p []byte) (int, error) {
	time.Sleep(s.delay)
	return s.r.Read(p)
}

// ---------- Basic correctness ----------

func TestStreamScannerHandler_NilInputs(t *testing.T) {
	t.Parallel()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/", nil)

	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

	StreamScannerHandler(c, nil, info, func(data string) bool { return true })
	StreamScannerHandler(c, &http.Response{Body: io.NopCloser(strings.NewReader(""))}, info, nil)
}

func TestStreamScannerHandler_EmptyBody(t *testing.T) {
	t.Parallel()

	c, resp, info := setupStreamTest(t, strings.NewReader(""))

	var called atomic.Bool
	StreamScannerHandler(c, resp, info, func(data string) bool {
		called.Store(true)
		return true
	})

	assert.False(t, called.Load(), "handler should not be called for empty body")
}

func TestStreamScannerHandler_1000Chunks(t *testing.T) {
	t.Parallel()

	const numChunks = 1000
	body := buildSSEBody(numChunks)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	var count atomic.Int64
	StreamScannerHandler(c, resp, info, func(data string) bool {
		count.Add(1)
		return true
	})

	assert.Equal(t, int64(numChunks), count.Load())
	assert.Equal(t, numChunks, info.ReceivedResponseCount)
}

func TestStreamScannerHandler_10000Chunks(t *testing.T) {
	t.Parallel()

	const numChunks = 10000
	body := buildSSEBody(numChunks)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	var count atomic.Int64
	start := time.Now()

	StreamScannerHandler(c, resp, info, func(data string) bool {
		count.Add(1)
		return true
	})

	elapsed := time.Since(start)
	assert.Equal(t, int64(numChunks), count.Load())
	assert.Equal(t, numChunks, info.ReceivedResponseCount)
	t.Logf("10000 chunks processed in %v", elapsed)
}

func TestStreamScannerHandler_OrderPreserved(t *testing.T) {
	t.Parallel()

	const numChunks = 500
	body := buildSSEBody(numChunks)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	var mu sync.Mutex
	received := make([]string, 0, numChunks)

	StreamScannerHandler(c, resp, info, func(data string) bool {
		mu.Lock()
		received = append(received, data)
		mu.Unlock()
		return true
	})

	require.Equal(t, numChunks, len(received))
	for i := 0; i < numChunks; i++ {
		expected := fmt.Sprintf("{\"id\":%d,\"choices\":[{\"delta\":{\"content\":\"token_%d\"}}]}", i, i)
		assert.Equal(t, expected, received[i], "chunk %d out of order", i)
	}
}

func TestStreamScannerHandler_DoneStopsScanner(t *testing.T) {
	t.Parallel()

	body := buildSSEBody(50) + "data: should_not_appear\n"
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	var count atomic.Int64
	StreamScannerHandler(c, resp, info, func(data string) bool {
		count.Add(1)
		return true
	})

	assert.Equal(t, int64(50), count.Load(), "data after [DONE] must not be processed")
}

func TestStreamScannerHandler_HandlerFailureStops(t *testing.T) {
	t.Parallel()

	const numChunks = 200
	body := buildSSEBody(numChunks)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	const failAt = 50
	var count atomic.Int64
	StreamScannerHandler(c, resp, info, func(data string) bool {
		n := count.Add(1)
		return n < failAt
	})

	// The worker stops at failAt; the scanner may have read ahead,
	// but the handler should not be called beyond failAt.
	assert.Equal(t, int64(failAt), count.Load())
}

func TestStreamScannerHandler_SkipsNonDataLines(t *testing.T) {
	t.Parallel()

	var b strings.Builder
	b.WriteString(": comment line\n")
	b.WriteString("event: message\n")
	b.WriteString("id: 12345\n")
	b.WriteString("retry: 5000\n")
	for i := 0; i < 100; i++ {
		fmt.Fprintf(&b, "data: payload_%d\n", i)
		b.WriteString(": interleaved comment\n")
	}
	b.WriteString("data: [DONE]\n")

	c, resp, info := setupStreamTest(t, strings.NewReader(b.String()))

	var count atomic.Int64
	StreamScannerHandler(c, resp, info, func(data string) bool {
		count.Add(1)
		return true
	})

	assert.Equal(t, int64(100), count.Load())
}

func TestStreamScannerHandler_DataWithExtraSpaces(t *testing.T) {
	t.Parallel()

	body := "data:   {\"trimmed\":true}  \ndata: [DONE]\n"
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	var got string
	StreamScannerHandler(c, resp, info, func(data string) bool {
		got = data
		return true
	})

	assert.Equal(t, "{\"trimmed\":true}", got)
}

// ---------- Decoupling: scanner not blocked by slow handler ----------

func TestStreamScannerHandler_ScannerDecoupledFromSlowHandler(t *testing.T) {
	t.Parallel()

	// Strategy: use a slow upstream (io.Pipe, 10ms per chunk) AND a slow handler (20ms per chunk).
	// If the scanner were synchronously coupled to the handler, total time would be
	// ~numChunks * (10ms + 20ms) = 30ms * 50 = 1500ms.
	// With decoupling, total time should be closer to
	// ~numChunks * max(10ms, 20ms) = 20ms * 50 = 1000ms
	// because the scanner reads ahead into the buffer while the handler processes.
	const numChunks = 50
	const upstreamDelay = 10 * time.Millisecond
	const handlerDelay = 20 * time.Millisecond

	pr, pw := io.Pipe()
	go func() {
		defer pw.Close()
		for i := 0; i < numChunks; i++ {
			fmt.Fprintf(pw, "data: {\"id\":%d}\n", i)
			time.Sleep(upstreamDelay)
		}
		fmt.Fprint(pw, "data: [DONE]\n")
	}()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	resp := &http.Response{Body: pr}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

	var count atomic.Int64
	start := time.Now()
	done := make(chan struct{})
	go func() {
		StreamScannerHandler(c, resp, info, func(data string) bool {
			time.Sleep(handlerDelay)
			count.Add(1)
			return true
		})
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(15 * time.Second):
		t.Fatal("StreamScannerHandler did not complete in time")
	}

	elapsed := time.Since(start)
	assert.Equal(t, int64(numChunks), count.Load())

	coupledTime := time.Duration(numChunks) * (upstreamDelay + handlerDelay)
	t.Logf("elapsed=%v, coupled_estimate=%v", elapsed, coupledTime)

	// If decoupled, elapsed should be well under the coupled estimate.
	assert.Less(t, elapsed, coupledTime*85/100,
		"decoupled elapsed time (%v) should be significantly less than coupled estimate (%v)", elapsed, coupledTime)
}

func TestStreamScannerHandler_SlowUpstreamFastHandler(t *testing.T) {
	t.Parallel()

	const numChunks = 50
	body := buildSSEBody(numChunks)
	reader := &slowReader{r: strings.NewReader(body), delay: 2 * time.Millisecond}
	c, resp, info := setupStreamTest(t, reader)

	var count atomic.Int64
	start := time.Now()

	done := make(chan struct{})
	go func() {
		StreamScannerHandler(c, resp, info, func(data string) bool {
			count.Add(1)
			return true
		})
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(15 * time.Second):
		t.Fatal("timed out with slow upstream")
	}

	elapsed := time.Since(start)
	assert.Equal(t, int64(numChunks), count.Load())
	t.Logf("slow upstream (%d chunks, 2ms/read): %v", numChunks, elapsed)
}

// ---------- Ping tests ----------

func TestStreamScannerHandler_PingSentDuringSlowUpstream(t *testing.T) {
	t.Parallel()

	setting := operation_setting.GetGeneralSetting()
	oldEnabled := setting.PingIntervalEnabled
	oldSeconds := setting.PingIntervalSeconds
	setting.PingIntervalEnabled = true
	setting.PingIntervalSeconds = 1
	t.Cleanup(func() {
		setting.PingIntervalEnabled = oldEnabled
		setting.PingIntervalSeconds = oldSeconds
	})

	// Create a reader that delivers data slowly: one chunk every 500ms over 3.5 seconds.
	// The ping interval is 1s, so we should see at least 2 pings.
	pr, pw := io.Pipe()
	go func() {
		defer pw.Close()
		for i := 0; i < 7; i++ {
			fmt.Fprintf(pw, "data: chunk_%d\n", i)
			time.Sleep(500 * time.Millisecond)
		}
		fmt.Fprint(pw, "data: [DONE]\n")
	}()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	resp := &http.Response{Body: pr}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

	var count atomic.Int64
	done := make(chan struct{})
	go func() {
		StreamScannerHandler(c, resp, info, func(data string) bool {
			count.Add(1)
			return true
		})
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(15 * time.Second):
		t.Fatal("timed out waiting for stream to finish")
	}

	assert.Equal(t, int64(7), count.Load())

	body := recorder.Body.String()
	pingCount := strings.Count(body, ": PING")
	t.Logf("received %d pings in response body", pingCount)
	assert.GreaterOrEqual(t, pingCount, 2,
		"expected at least 2 pings during 3.5s stream with 1s interval; got %d", pingCount)
}

func TestStreamScannerHandler_PingDisabledByRelayInfo(t *testing.T) {
	t.Parallel()

	setting := operation_setting.GetGeneralSetting()
	oldEnabled := setting.PingIntervalEnabled
	oldSeconds := setting.PingIntervalSeconds
	setting.PingIntervalEnabled = true
	setting.PingIntervalSeconds = 1
	t.Cleanup(func() {
		setting.PingIntervalEnabled = oldEnabled
		setting.PingIntervalSeconds = oldSeconds
	})

	pr, pw := io.Pipe()
	go func() {
		defer pw.Close()
		for i := 0; i < 5; i++ {
			fmt.Fprintf(pw, "data: chunk_%d\n", i)
			time.Sleep(500 * time.Millisecond)
		}
		fmt.Fprint(pw, "data: [DONE]\n")
	}()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	resp := &http.Response{Body: pr}
	info := &relaycommon.RelayInfo{
		DisablePing: true,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}

	var count atomic.Int64
	done := make(chan struct{})
	go func() {
		StreamScannerHandler(c, resp, info, func(data string) bool {
			count.Add(1)
			return true
		})
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(15 * time.Second):
		t.Fatal("timed out")
	}

	assert.Equal(t, int64(5), count.Load())

	body := recorder.Body.String()
	pingCount := strings.Count(body, ": PING")
	assert.Equal(t, 0, pingCount, "pings should be disabled when DisablePing=true")
}

func TestStreamScannerHandler_PingInterleavesWithSlowUpstream(t *testing.T) {
	t.Parallel()

	setting := operation_setting.GetGeneralSetting()
	oldEnabled := setting.PingIntervalEnabled
	oldSeconds := setting.PingIntervalSeconds
	setting.PingIntervalEnabled = true
	setting.PingIntervalSeconds = 1
	t.Cleanup(func() {
		setting.PingIntervalEnabled = oldEnabled
		setting.PingIntervalSeconds = oldSeconds
	})

	// Slow upstream + slow handler. Total stream takes ~5 seconds.
	// The ping goroutine stays alive as long as the scanner is reading,
	// so pings should fire between data writes.
	pr, pw := io.Pipe()
	go func() {
		defer pw.Close()
		for i := 0; i < 10; i++ {
			fmt.Fprintf(pw, "data: chunk_%d\n", i)
			time.Sleep(500 * time.Millisecond)
		}
		fmt.Fprint(pw, "data: [DONE]\n")
	}()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 30
	t.Cleanup(func() {
		constant.StreamingTimeout = oldTimeout
	})

	resp := &http.Response{Body: pr}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

	var count atomic.Int64
	done := make(chan struct{})
	go func() {
		StreamScannerHandler(c, resp, info, func(data string) bool {
			count.Add(1)
			return true
		})
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(15 * time.Second):
		t.Fatal("timed out")
	}

	assert.Equal(t, int64(10), count.Load())

	body := recorder.Body.String()
	pingCount := strings.Count(body, ": PING")
	t.Logf("received %d pings interleaved with 10 chunks over 5s", pingCount)
	assert.GreaterOrEqual(t, pingCount, 3,
		"expected at least 3 pings during 5s stream with 1s ping interval; got %d", pingCount)
}
