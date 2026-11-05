package helper

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/billing"
	"github.com/QuantumNous/new-api/internal/constant"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func init() {
	if constant.StreamingTimeout == 0 {
		constant.StreamingTimeout = 30
	}
}

func setupStreamTest(t *testing.T, body io.Reader) (contract.Context, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	c, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))
	resp := &http.Response{Body: io.NopCloser(body)}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}
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

// ---------- Basic correctness ----------

func TestStreamScannerHandler_NilInputs(t *testing.T) {
	t.Parallel()

	c, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/", nil))

	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

	StreamScannerHandler(c, nil, info, func(data string, sr *StreamResult) {})
	StreamScannerHandler(c, &http.Response{Body: io.NopCloser(strings.NewReader(""))}, info, nil)
}

func TestNewStreamScanner_AllowsLargeStreamLine(t *testing.T) {
	oldBufferMB := constant.StreamScannerMaxBufferMB
	constant.StreamScannerMaxBufferMB = 1
	t.Cleanup(func() {
		constant.StreamScannerMaxBufferMB = oldBufferMB
	})

	payload := strings.Repeat("x", 128<<10)
	scanner := NewStreamScanner(strings.NewReader("data: " + payload + "\n"))
	scanner.Split(bufio.ScanLines)

	require.True(t, scanner.Scan())
	assert.Equal(t, "data: "+payload, scanner.Text())
	require.NoError(t, scanner.Err())
}

func TestStreamScannerHandler_EmptyBody(t *testing.T) {
	t.Parallel()

	c, resp, info := setupStreamTest(t, strings.NewReader(""))

	var called atomic.Bool
	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		called.Store(true)
	})

	assert.False(t, called.Load(), "handler should not be called for empty body")
}

func TestStreamScannerHandler_1000Chunks(t *testing.T) {
	t.Parallel()

	const numChunks = 1000
	body := buildSSEBody(numChunks)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	var count atomic.Int64
	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		count.Add(1)
	})

	assert.Equal(t, int64(numChunks), count.Load())
	assert.Equal(t, numChunks, info.ReceivedResponseCount)
}

func TestStreamScannerHandler_OrderPreserved(t *testing.T) {
	t.Parallel()

	const numChunks = 500
	body := buildSSEBody(numChunks)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	var mu sync.Mutex
	received := make([]string, 0, numChunks)

	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		mu.Lock()
		received = append(received, data)
		mu.Unlock()
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
	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		count.Add(1)
	})

	assert.Equal(t, int64(50), count.Load(), "data after [DONE] must not be processed")
}

func TestStreamScannerHandler_StopStopsStream(t *testing.T) {
	t.Parallel()

	const numChunks = 200
	body := buildSSEBody(numChunks)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	const stopAt int64 = 50
	var count atomic.Int64
	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		n := count.Add(1)
		if n >= stopAt {
			sr.Stop(fmt.Errorf("fatal at %d", n))
		}
	})

	assert.Equal(t, stopAt, count.Load())
	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonHandlerStop, info.StreamStatus.EndReason)
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
	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		count.Add(1)
	})

	assert.Equal(t, int64(100), count.Load())
}

func TestStreamScannerHandler_DataWithExtraSpaces(t *testing.T) {
	t.Parallel()

	body := "data:   {\"trimmed\":true}  \ndata: [DONE]\n"
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	var got string
	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		got = data
	})

	assert.Equal(t, "{\"trimmed\":true}", got)
}

// TestStreamScannerHandler_ClientCancelAbortsUpstreamAndReturns pins the
// disconnect contract: when the request lifetime is cancelled, the handler must
// return promptly (all goroutines joined), the upstream body must be closed to
// stop token generation, and no data received after the cancellation may be
// processed or written.
func TestStreamScannerHandler_ClientCancelAbortsUpstreamAndReturns(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	pr, pw := io.Pipe()
	t.Cleanup(func() {
		_ = pr.Close()
		_ = pw.Close()
	})

	c, recorder := fiberadapter.NewSyntheticContext(
		httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(ctx))

	resp := &http.Response{Body: pr}
	info := &relaycommon.RelayInfo{
		DisablePing: true,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}

	var count atomic.Int64
	firstHandled := make(chan struct{})
	done := make(chan struct{})
	go func() {
		StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
			count.Add(1)
			_ = StringData(c, data)
			if data == "first" {
				close(firstHandled)
			}
		})
		close(done)
	}()

	_, err := fmt.Fprint(pw, "data: first\n")
	require.NoError(t, err)

	select {
	case <-firstHandled:
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for first chunk")
	}

	cancel()

	// The handler must return without any further upstream input: cleanup
	// closes resp.Body, which unblocks the scanner goroutine.
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("handler did not return after client disconnect")
	}

	// Upstream read side must be closed so the provider stops generating
	// (and billing) for a request nobody is listening to.
	_, err = fmt.Fprint(pw, "data: second\n")
	require.ErrorIs(t, err, io.ErrClosedPipe, "upstream body should be closed after client disconnect")

	assert.Equal(t, int64(1), count.Load(), "no chunk after disconnect should be processed")
	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonClientGone, info.StreamStatus.EndReason)

	body := recorder.Body.String()
	assert.Contains(t, body, "first")
	assert.NotContains(t, body, "second")
}

// TestStreamScannerHandler_ClientHangupOverTheWireAbortsUpstream is the same
// contract observed through the real transport rather than through a cancelled
// request: frames reach the client as they are produced, and a client that hangs
// up mid-stream stops the scanner, closes the upstream body and joins its
// goroutines.
//
// It needs a real connection twice over. The flush assertion reads a frame off
// the wire while the stream is still open, which a buffered fixture cannot show,
// and the hangup itself has no in-process equivalent: fasthttp offers no
// read-side disconnect notification, so the signal is a response-pipe write
// failing after the server closed its end. Detection therefore costs writes,
// which is why this case bounds the outcome instead of pinning a chunk count;
// the exact count for a cancelled lifetime is pinned by the test above.
func TestStreamScannerHandler_ClientHangupOverTheWireAbortsUpstream(t *testing.T) {
	pr, pw := io.Pipe()
	t.Cleanup(func() {
		_ = pr.Close()
		_ = pw.Close()
	})

	info := &relaycommon.RelayInfo{
		DisablePing: true,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}

	writeFailed := make(chan error, 1)
	done := make(chan struct{})
	conn := startScannerStream(t, func(c contract.Context) {
		StreamScannerHandler(c, &http.Response{Body: pr}, info, func(data string, sr *StreamResult) {
			if err := StringData(c, data); err != nil {
				select {
				case writeFailed <- err:
				default:
				}
			}
		})
		close(done)
	})

	// Trickle upstream chunks until the handler returns, so a write is always
	// available to carry the disconnect signal.
	go func() {
		for i := 0; ; i++ {
			if _, err := fmt.Fprintf(pw, "data: chunk_%d\n", i); err != nil {
				return
			}
			select {
			case <-done:
				return
			case <-time.After(20 * time.Millisecond):
			}
		}
	}()

	response, err := http.ReadResponse(bufio.NewReader(conn), nil)
	require.NoError(t, err)
	assert.Equal(t, "text/event-stream", response.Header.Get("Content-Type"))

	// The frame arrives while the handler is still streaming, so one helper
	// write reached the client as one flushed chunk.
	const firstFrame = "data: chunk_0\n\n"
	frame := make([]byte, len(firstFrame))
	_, err = io.ReadFull(response.Body, frame)
	require.NoError(t, err)
	assert.Equal(t, firstFrame, string(frame))

	require.NoError(t, conn.Close())

	select {
	case err := <-writeFailed:
		require.Error(t, err, "a frame write must fail once the client hung up")
	case <-time.After(15 * time.Second):
		t.Fatal("writes kept succeeding after the client disconnected")
	}

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("handler did not return after client hangup")
	}

	_, err = fmt.Fprint(pw, "data: late\n")
	require.ErrorIs(t, err, io.ErrClosedPipe, "upstream body should be closed after client hangup")

	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonClientGone, info.StreamStatus.EndReason)
}

// startScannerStream serves body as a streaming Fiber route on a loopback
// listener and returns a raw connection to it, so a test can read frames as they
// are flushed and hang up mid-stream. app.Test serves neither: it buffers the
// whole response and has no peer connection to close.
func startScannerStream(t *testing.T, body contract.Handler) net.Conn {
	t.Helper()

	app := fiber.New(fiber.Config{})
	app.Post("/v1/chat/completions", func(c fiber.Ctx) error {
		return fiberadapter.Dispatch(c, []contract.Handler{body})
	})

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	go func() { _ = app.Listener(listener) }()
	t.Cleanup(func() { _ = app.ShutdownWithTimeout(2 * time.Second) })

	conn, err := net.Dial("tcp", listener.Addr().String())
	require.NoError(t, err)
	t.Cleanup(func() { _ = conn.Close() })

	_, err = conn.Write([]byte("POST /v1/chat/completions HTTP/1.1\r\nHost: relay.test\r\nContent-Length: 0\r\n\r\n"))
	require.NoError(t, err)
	return conn
}

// ---------- Ping tests ----------

func TestStreamScannerHandler_PingSentDuringSlowUpstream(t *testing.T) {
	setting := billing.GetGeneralSetting()
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
		for i := 0; i < 4; i++ {
			fmt.Fprintf(pw, "data: chunk_%d\n", i)
			time.Sleep(400 * time.Millisecond)
		}
		fmt.Fprint(pw, "data: [DONE]\n")
	}()

	c, recorder := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

	resp := &http.Response{Body: pr}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

	var count atomic.Int64
	done := make(chan struct{})
	go func() {
		StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
			count.Add(1)
		})
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for stream to finish")
	}

	assert.Equal(t, int64(4), count.Load())

	body := recorder.Body.String()
	pingCount := strings.Count(body, ": PING")
	assert.GreaterOrEqual(t, pingCount, 1,
		"expected at least 1 ping during slow stream with 1s interval; got %d", pingCount)
}

func TestStreamScannerHandler_PingDisabledByRelayInfo(t *testing.T) {
	setting := billing.GetGeneralSetting()
	oldEnabled := setting.PingIntervalEnabled
	oldSeconds := setting.PingIntervalSeconds
	setting.PingIntervalEnabled = true
	setting.PingIntervalSeconds = 1
	t.Cleanup(func() {
		setting.PingIntervalEnabled = oldEnabled
		setting.PingIntervalSeconds = oldSeconds
	})

	c, recorder := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

	resp := &http.Response{Body: io.NopCloser(strings.NewReader(buildSSEBody(5)))}
	info := &relaycommon.RelayInfo{
		DisablePing: true,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}

	var count atomic.Int64
	done := make(chan struct{})
	go func() {
		StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
			count.Add(1)
		})
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out")
	}

	assert.Equal(t, int64(5), count.Load())

	body := recorder.Body.String()
	pingCount := strings.Count(body, ": PING")
	assert.Equal(t, 0, pingCount, "pings should be disabled when DisablePing=true")
}

// ---------- StreamStatus integration ----------

func TestStreamScannerHandler_StreamStatus_DoneReason(t *testing.T) {
	t.Parallel()

	body := buildSSEBody(10)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {})

	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	assert.Nil(t, info.StreamStatus.EndError)
	assert.True(t, info.StreamStatus.IsNormalEnd())
	assert.False(t, info.StreamStatus.HasErrors())
}

func TestStreamScannerHandler_StreamStatus_EOFWithoutDone(t *testing.T) {
	t.Parallel()

	var b strings.Builder
	for i := 0; i < 5; i++ {
		fmt.Fprintf(&b, "data: {\"id\":%d}\n", i)
	}
	c, resp, info := setupStreamTest(t, strings.NewReader(b.String()))

	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {})

	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonEOF, info.StreamStatus.EndReason)
	assert.True(t, info.StreamStatus.IsNormalEnd())
}

func TestStreamScannerHandler_StreamStatus_HandlerStop(t *testing.T) {
	t.Parallel()

	body := buildSSEBody(100)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	var count atomic.Int64
	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		n := count.Add(1)
		if n >= 10 {
			sr.Stop(fmt.Errorf("stop at 10"))
		}
	})

	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonHandlerStop, info.StreamStatus.EndReason)
	assert.True(t, info.StreamStatus.HasErrors())
}

func TestStreamScannerHandler_StreamStatus_HandlerDone(t *testing.T) {
	t.Parallel()

	body := buildSSEBody(20)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	var count atomic.Int64
	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		n := count.Add(1)
		if n >= 5 {
			sr.Done()
		}
	})

	assert.Equal(t, int64(5), count.Load())
	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	assert.False(t, info.StreamStatus.HasErrors())
}

func TestStreamScannerHandler_StreamStatus_Timeout(t *testing.T) {
	// Not parallel: modifies global constant.StreamingTimeout
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 1
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	pr, pw := io.Pipe()
	go func() {
		fmt.Fprint(pw, "data: {\"id\":1}\n")
		time.Sleep(2 * time.Second)
		pw.Close()
	}()

	c, _ := fiberadapter.NewSyntheticContext(httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil))

	resp := &http.Response{Body: pr}
	info := &relaycommon.RelayInfo{ChannelMeta: &relaycommon.ChannelMeta{}}

	done := make(chan struct{})
	go func() {
		StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {})
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(5 * time.Second):
		t.Fatal("timed out waiting for stream timeout")
	}

	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonTimeout, info.StreamStatus.EndReason)
	assert.False(t, info.StreamStatus.IsNormalEnd())
}

func TestStreamScannerHandler_StreamStatus_SoftErrors(t *testing.T) {
	t.Parallel()

	body := buildSSEBody(10)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		sr.Error(fmt.Errorf("soft error for chunk"))
	})

	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	assert.True(t, info.StreamStatus.HasErrors())
	assert.Equal(t, 10, info.StreamStatus.TotalErrorCount())
}

func TestStreamScannerHandler_StreamStatus_MultipleErrorsPerChunk(t *testing.T) {
	t.Parallel()

	body := buildSSEBody(5)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		sr.Error(fmt.Errorf("error A"))
		sr.Error(fmt.Errorf("error B"))
	})

	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	assert.Equal(t, 10, info.StreamStatus.TotalErrorCount())
}

func TestStreamScannerHandler_StreamStatus_ErrorThenStop(t *testing.T) {
	t.Parallel()

	// Use a large body without [DONE] to avoid race between scanner's [DONE]
	// and handler's Stop on the sync.Once EndReason.
	var b strings.Builder
	for i := 0; i < 100; i++ {
		fmt.Fprintf(&b, "data: {\"id\":%d}\n", i)
	}
	c, resp, info := setupStreamTest(t, strings.NewReader(b.String()))

	var count atomic.Int64
	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		count.Add(1)
		sr.Error(fmt.Errorf("soft error"))
		sr.Stop(fmt.Errorf("fatal"))
	})

	assert.Equal(t, int64(1), count.Load())
	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonHandlerStop, info.StreamStatus.EndReason)
	assert.Equal(t, 2, info.StreamStatus.TotalErrorCount())
}

func TestStreamScannerHandler_StreamStatus_InitializedIfNil(t *testing.T) {
	t.Parallel()

	body := buildSSEBody(1)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	assert.Nil(t, info.StreamStatus)

	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {})

	assert.NotNil(t, info.StreamStatus)
}

func TestStreamScannerHandler_StreamStatus_ReplacesPreInitialized(t *testing.T) {
	t.Parallel()

	body := buildSSEBody(5)
	c, resp, info := setupStreamTest(t, strings.NewReader(body))

	info.StreamStatus = relaycommon.NewStreamStatus()
	info.StreamStatus.RecordError("pre-existing error")

	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {})

	assert.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	assert.Equal(t, 0, info.StreamStatus.TotalErrorCount())
}
