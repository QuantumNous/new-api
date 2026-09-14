package helper

import (
	"context"
	"errors"
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

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type observedReadCloser struct {
	io.Reader
	closed     chan struct{}
	once       sync.Once
	closeCount atomic.Int32
}

func (r *observedReadCloser) Close() error {
	r.closeCount.Add(1)
	r.once.Do(func() { close(r.closed) })
	if closer, ok := r.Reader.(io.Closer); ok {
		return closer.Close()
	}
	return nil
}

func newTextStreamTestContext(ctx context.Context) (*gin.Context, *httptest.ResponseRecorder) {
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil).WithContext(ctx)
	return c, recorder
}

func TestTextStreamScannerContinuesToTerminalAfterClientCancellation(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 5
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	requestContext, cancelRequest := context.WithCancel(context.Background())
	t.Cleanup(cancelRequest)
	c, recorder := newTextStreamTestContext(requestContext)
	reader, writer := io.Pipe()
	body := &observedReadCloser{Reader: reader, closed: make(chan struct{})}
	resp := &http.Response{Body: body, Header: make(http.Header)}
	info := &relaycommon.RelayInfo{}
	firstHandled := make(chan struct{})
	var firstOnce sync.Once
	done := make(chan struct{})

	go func() {
		TextStreamScannerHandler(c, resp, info, func(data string, result *StreamResult) {
			result.Accept()
			_ = StringData(c, data)
			if data == `{"type":"delta"}` {
				firstOnce.Do(func() { close(firstHandled) })
			}
			if data == `{"type":"complete"}` {
				result.TerminalSuccess(true)
			}
		})
		close(done)
	}()

	require.NoError(t, writePipeString(writer, "data: {\"type\":\"delta\"}\n\n"))
	select {
	case <-firstHandled:
	case <-time.After(2 * time.Second):
		t.Fatal("first upstream event was not handled")
	}
	lengthBeforeCancel := recorder.Body.Len()
	cancelRequest()

	select {
	case <-done:
		t.Fatal("text stream returned before the upstream terminal")
	case <-time.After(100 * time.Millisecond):
	}
	select {
	case <-body.closed:
		t.Fatal("upstream body closed immediately on client cancellation")
	default:
	}

	require.NoError(t, writePipeString(writer, "data: {\"type\":\"complete\"}\n\n"))
	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("text stream did not finish after the upstream terminal")
	}

	require.NotNil(t, info.StreamStatus)
	assert.Equal(t, relaycommon.StreamEndReasonClientGone, info.StreamStatus.EndReason)
	upstreamResult, upstreamErr := info.StreamStatus.GetUpstreamResult()
	assert.Equal(t, relaycommon.StreamUpstreamResultTerminalSuccess, upstreamResult)
	assert.NoError(t, upstreamErr)
	assert.True(t, info.StreamStatus.IsUsageComplete())
	assert.Nil(t, ValidateTextStreamCompletion(info))
	assert.Equal(t, lengthBeforeCancel, recorder.Body.Len())
	select {
	case <-body.closed:
	default:
		t.Fatal("upstream body was not closed after the terminal")
	}
}

func TestTextStreamScannerAbsoluteDrainTimeoutCannotBeResetByBusinessEvents(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 1
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	requestContext, cancelRequest := context.WithCancel(context.Background())
	c, _ := newTextStreamTestContext(requestContext)
	reader, writer := io.Pipe()
	resp := &http.Response{Body: &observedReadCloser{Reader: reader, closed: make(chan struct{})}, Header: make(http.Header)}
	info := &relaycommon.RelayInfo{}
	done := make(chan struct{})
	go func() {
		TextStreamScannerHandler(c, resp, info, func(_ string, result *StreamResult) { result.Accept() })
		close(done)
	}()
	cancelRequest()

	producerDone := make(chan struct{})
	go func() {
		defer close(producerDone)
		ticker := time.NewTicker(50 * time.Millisecond)
		defer ticker.Stop()
		for range ticker.C {
			if writePipeString(writer, "data: {}\n\n") != nil {
				return
			}
		}
	}()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("absolute drain timeout did not stop the stream")
	}
	select {
	case <-producerDone:
	case <-time.After(2 * time.Second):
		t.Fatal("upstream producer remained blocked after timeout cleanup")
	}
	result, _ := info.StreamStatus.GetUpstreamResult()
	assert.Equal(t, relaycommon.StreamUpstreamResultDrainTimeout, result)
	assert.Equal(t, relaycommon.StreamEndReasonClientGone, info.StreamStatus.EndReason)
}

func TestTextStreamScannerUnrecognizedDataCannotResetIdleTimeout(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 1
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	requestContext, cancelRequest := context.WithCancel(context.Background())
	c, _ := newTextStreamTestContext(requestContext)
	reader, writer := io.Pipe()
	resp := &http.Response{Body: &observedReadCloser{Reader: reader, closed: make(chan struct{})}, Header: make(http.Header)}
	info := &relaycommon.RelayInfo{}
	done := make(chan struct{})
	go func() {
		TextStreamScannerHandler(c, resp, info, func(_ string, result *StreamResult) { result.Ignore() })
		close(done)
	}()
	cancelRequest()

	producerDone := make(chan struct{})
	go func() {
		defer close(producerDone)
		ticker := time.NewTicker(50 * time.Millisecond)
		defer ticker.Stop()
		for range ticker.C {
			if writePipeString(writer, "data: {}\n\n") != nil {
				return
			}
		}
	}()

	select {
	case <-done:
	case <-time.After(3 * time.Second):
		t.Fatal("unrecognized data renewed the idle timeout")
	}
	select {
	case <-producerDone:
	case <-time.After(2 * time.Second):
		t.Fatal("upstream producer remained blocked after idle timeout")
	}
	result, _ := info.StreamStatus.GetUpstreamResult()
	assert.Equal(t, relaycommon.StreamUpstreamResultIdleTimeout, result)
}

func TestValidateTextStreamCompletionRejectsMissingUsage(t *testing.T) {
	status := relaycommon.NewStreamStatus()
	status.SetEndReason(relaycommon.StreamEndReasonClientGone, context.Canceled)
	status.SetUpstreamResult(relaycommon.StreamUpstreamResultTerminalSuccess, nil)
	info := &relaycommon.RelayInfo{StreamStatus: status}

	err := ValidateTextStreamCompletion(info)
	require.Error(t, err)
	result, resultErr := status.GetUpstreamResult()
	assert.Equal(t, relaycommon.StreamUpstreamResultUsageMissing, result)
	assert.Error(t, resultErr)
}

func TestTextStreamScannerRecordsPostDisconnectFailuresImmediately(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 5
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	tests := []struct {
		name       string
		body       io.ReadCloser
		handle     func(*StreamResult)
		wantResult relaycommon.StreamUpstreamResult
	}{
		{
			name: "protocol failure",
			body: io.NopCloser(strings.NewReader("data: {}\n")),
			handle: func(result *StreamResult) {
				result.ProtocolFailure(errors.New("upstream rejected request"))
			},
			wantResult: relaycommon.StreamUpstreamResultProtocolFailure,
		},
		{
			name: "handler error",
			body: io.NopCloser(strings.NewReader("data: {}\n")),
			handle: func(result *StreamResult) {
				result.Stop(errors.New("invalid payload"))
			},
			wantResult: relaycommon.StreamUpstreamResultHandlerError,
		},
		{
			name: "soft handler error",
			body: io.NopCloser(strings.NewReader("data: {}\n")),
			handle: func(result *StreamResult) {
				result.Error(errors.New("invalid payload"))
			},
			wantResult: relaycommon.StreamUpstreamResultHandlerError,
		},
		{
			name: "handler panic",
			body: io.NopCloser(strings.NewReader("data: {}\n")),
			handle: func(*StreamResult) {
				panic("broken parser")
			},
			wantResult: relaycommon.StreamUpstreamResultHandlerError,
		},
		{
			name:       "incomplete eof",
			body:       io.NopCloser(strings.NewReader("data: {}\n")),
			handle:     func(*StreamResult) {},
			wantResult: relaycommon.StreamUpstreamResultIncompleteEOF,
		},
		{
			name:       "scanner error",
			body:       failingTextStreamBody{err: errors.New("read failed")},
			handle:     func(*StreamResult) {},
			wantResult: relaycommon.StreamUpstreamResultScannerError,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			requestContext, cancelRequest := context.WithCancel(context.Background())
			cancelRequest()
			c, _ := newTextStreamTestContext(requestContext)
			info := &relaycommon.RelayInfo{DisablePing: true}
			startedAt := time.Now()

			TextStreamScannerHandler(c, &http.Response{Body: test.body, Header: make(http.Header)}, info, func(_ string, result *StreamResult) {
				test.handle(result)
			})

			assert.Less(t, time.Since(startedAt), time.Second)
			require.NotNil(t, info.StreamStatus)
			assert.Equal(t, relaycommon.StreamEndReasonClientGone, info.StreamStatus.EndReason)
			upstreamResult, _ := info.StreamStatus.GetUpstreamResult()
			assert.Equal(t, test.wantResult, upstreamResult)
			assert.Error(t, ValidateTextStreamCompletion(info))
		})
	}
}

func TestTextStreamScannerPreservesOnlineSoftErrorBehavior(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 5
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	c, _ := newTextStreamTestContext(context.Background())
	info := &relaycommon.RelayInfo{DisablePing: true}
	resp := &http.Response{
		Body:   io.NopCloser(strings.NewReader("data: malformed\n\ndata: terminal\n")),
		Header: make(http.Header),
	}
	handled := 0

	TextStreamScannerHandler(c, resp, info, func(_ string, result *StreamResult) {
		handled++
		if handled == 1 {
			result.Error(errors.New("invalid payload"))
			return
		}
		result.TerminalSuccess(true)
	})

	assert.Equal(t, 2, handled)
	assert.Equal(t, relaycommon.StreamEndReasonDone, info.StreamStatus.EndReason)
	upstreamResult, _ := info.StreamStatus.GetUpstreamResult()
	assert.Equal(t, relaycommon.StreamUpstreamResultTerminalSuccess, upstreamResult)
}

func TestTextStreamScannerPreservesOnlineEOFBehavior(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 5
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })

	c, _ := newTextStreamTestContext(context.Background())
	info := &relaycommon.RelayInfo{DisablePing: true}
	resp := &http.Response{
		Body:   io.NopCloser(strings.NewReader(": keepalive\n\ndata: {}\n")),
		Header: make(http.Header),
	}
	handled := 0

	TextStreamScannerHandler(c, resp, info, func(string, *StreamResult) {
		handled++
	})

	assert.Equal(t, 1, handled)
	assert.Equal(t, relaycommon.StreamEndReasonEOF, info.StreamStatus.EndReason)
	upstreamResult, _ := info.StreamStatus.GetUpstreamResult()
	assert.Equal(t, relaycommon.StreamUpstreamResultIncompleteEOF, upstreamResult)
	assert.Nil(t, ValidateTextStreamCompletion(info))
}

func TestTextStreamEntryPointSemantics(t *testing.T) {
	tests := []struct {
		name              string
		run               func(*gin.Context, *http.Response, *relaycommon.RelayInfo, func(string, *StreamResult))
		terminalInHandler bool
		wantHeader        bool
		wantResult        relaycommon.StreamUpstreamResult
	}{
		{name: "chat done is success", run: TextStreamScannerHandler, wantHeader: true, wantResult: relaycommon.StreamUpstreamResultTerminalSuccess},
		{name: "responses done is neutral", run: ResponsesTextStreamScannerHandler, wantHeader: true},
		{name: "buffered responses has no stream header", run: ResponsesBufferedTextStreamScannerHandler},
		{name: "responses explicit terminal", run: ResponsesTextStreamScannerHandler, terminalInHandler: true, wantHeader: true, wantResult: relaycommon.StreamUpstreamResultTerminalSuccess},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			c, recorder := newTextStreamTestContext(context.Background())
			body := &observedReadCloser{Reader: strings.NewReader("data: {\"type\":\"response.completed\"}\n\ndata: [DONE]\n\n"), closed: make(chan struct{})}
			info := &relaycommon.RelayInfo{DisablePing: true}
			handled := 0

			test.run(c, &http.Response{Body: body, Header: make(http.Header)}, info, func(_ string, result *StreamResult) {
				handled++
				if test.terminalInHandler {
					result.TerminalSuccess(false)
				}
			})

			assert.Equal(t, 1, handled)
			assert.Equal(t, int32(1), body.closeCount.Load())
			assert.Equal(t, test.wantHeader, strings.Contains(recorder.Header().Get("Content-Type"), "text/event-stream"))
			result, _ := info.StreamStatus.GetUpstreamResult()
			assert.Equal(t, test.wantResult, result)
		})
	}
}

func TestStreamResultNeutralStopPreservesProtocolOutcome(t *testing.T) {
	status := relaycommon.NewStreamStatus()
	result := newStreamResult(status)

	result.NeutralStop()

	assert.True(t, result.IsStopped())
	assert.Equal(t, relaycommon.StreamEndReasonNone, status.EndReason)
	upstreamResult, upstreamErr := status.GetUpstreamResult()
	assert.Equal(t, relaycommon.StreamUpstreamResultNone, upstreamResult)
	assert.NoError(t, upstreamErr)
}

func TestParseTextSSELineRejectsTransportNoise(t *testing.T) {
	for _, line := range []string{"", ": PING", "event: message", "invalid", "data:", "data:   "} {
		event := parseTextSSELine(line)
		assert.False(t, event.business, line)
		assert.False(t, event.done, line)
	}
	assert.True(t, parseTextSSELine("data: {}").business)
	assert.True(t, parseTextSSELine("data: [DONE]").done)
}

func TestTextStreamDrainTimeoutUsesSafeDefault(t *testing.T) {
	oldTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 0
	t.Cleanup(func() { constant.StreamingTimeout = oldTimeout })
	c, _ := newTextStreamTestContext(context.Background())

	assert.Equal(t, defaultTextStreamDrainTimeout, TextStreamDrainTimeout(c))
}

func TestReadTextStreamBodyClosesBodyOnReadError(t *testing.T) {
	c, _ := newTextStreamTestContext(context.Background())
	closed := make(chan struct{})
	body := &observedReadCloser{Reader: failingTextStreamBody{err: errors.New("read failed")}, closed: closed}
	info := &relaycommon.RelayInfo{}

	_, err := ReadTextStreamBody(c, &http.Response{Body: body}, info)

	require.Error(t, err)
	select {
	case <-closed:
	default:
		t.Fatal("buffered text response body was not closed after read error")
	}
	assert.Equal(t, int32(1), body.closeCount.Load())
}

func writePipeString(writer *io.PipeWriter, value string) error {
	_, err := io.WriteString(writer, value)
	return err
}

type failingTextStreamBody struct {
	err error
}

func (b failingTextStreamBody) Read([]byte) (int, error) {
	return 0, b.err
}

func (failingTextStreamBody) Close() error {
	return nil
}
