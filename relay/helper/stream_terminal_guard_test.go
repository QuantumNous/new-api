package helper

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

// buildStreamCtx builds a gin test context with an SSE-capable response
// recorder plus a RelayInfo carrying a fresh StreamStatus.
func buildStreamCtx(t *testing.T) (*gin.Context, *common.RelayInfo, *httptest.ResponseRecorder) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	info := relayInfoForTest()
	return c, info, w
}

// upstreamResetBody returns a ReadCloser that delivers some SSE content then
// simulates a mid-stream connection reset (read error, not clean EOF).
type resetReader struct {
	data []byte
	pos  int
}

func (r *resetReader) Read(p []byte) (int, error) {
	if r.pos < len(r.data) {
		n := copy(p, r.data[r.pos:])
		r.pos += n
		return n, nil
	}
	return 0, errors.New("read tcp: connection reset by peer")
}

func (r *resetReader) Close() error { return nil }

func TestStreamScannerHandlerUpstreamResetMarksScannerError(t *testing.T) {
	c, info, _ := buildStreamCtx(t)
	body := "data: {\"choices\":[{\"delta\":{\"content\":\"Hello\"}}]}\n\n" +
		"data: {\"choices\":[{\"delta\":{\"content\":\" world\"}}]}\n\n"
	resp := &http.Response{Body: io.NopCloser(&resetReader{data: []byte(body)})}

	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {})

	if info.StreamStatus.EndReason != common.StreamEndReasonScannerErr {
		t.Fatalf("expected end_reason=scanner_error, got %q", info.StreamStatus.EndReason)
	}
	if !strings.Contains(info.StreamStatus.Summary(), "reason=scanner_error") {
		t.Fatalf("unexpected summary: %s", info.StreamStatus.Summary())
	}
	t.Logf("StreamStatus after upstream reset: %s", info.StreamStatus.Summary())
}

func TestEmitRelayFailureTerminalNormalEndIsNoop(t *testing.T) {
	c, info, _ := buildStreamCtx(t)
	info.StreamStatus.SetEndReason(common.StreamEndReasonDone, nil)

	if EmitRelayFailureTerminal(c, info) {
		t.Fatal("guard must not fire for a normal end")
	}
}

func TestEmitRelayFailureTerminalEmitsErrorChunk(t *testing.T) {
	c, info, w := buildStreamCtx(t)
	info.StreamStatus.SetEndReason(common.StreamEndReasonScannerErr, errors.New("read tcp: connection reset by peer"))

	if !EmitRelayFailureTerminal(c, info) {
		t.Fatal("guard must fire for scanner_error")
	}
	out := w.Body.String()
	if !strings.Contains(out, "relay_stream_error") {
		t.Fatalf("error chunk missing relay_stream_error type, got: %s", out)
	}
	if !strings.Contains(out, "scanner_error") {
		t.Fatalf("error chunk missing end reason, got: %s", out)
	}
}

func TestFullFaultPathResetThenGuard(t *testing.T) {
	c, info, w := buildStreamCtx(t)
	body := "data: {\"choices\":[{\"delta\":{\"content\":\"partial answer\"}}]}\n\n"
	resp := &http.Response{Body: io.NopCloser(&resetReader{data: []byte(body)})}

	StreamScannerHandler(c, resp, info, func(data string, sr *StreamResult) {
		// mimic OaiStreamHandler's dataHandler: forward each data chunk
		_ = StringData(c, "data: "+data+"\n\n")
		_ = FlushWriter(c)
	})
	if fired := EmitRelayFailureTerminal(c, info); !fired {
		t.Fatal("guard did not fire after upstream reset")
	}
	out := w.Body.String()
	for _, want := range []string{
		"partial answer",     // content was forwarded
		"relay_stream_error", // failure is marked
		"scanner_error",      // reason is actionable
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("stream output missing %q, got: %s", want, out)
		}
	}
	if strings.Contains(out, "\"finish_reason\":\"stop\"") {
		t.Fatal("failure stream must not carry a success finish_reason")
	}
	t.Logf("combined stream output: %s", out)
}

// relayInfoForTest builds the minimal RelayInfo shape StreamScannerHandler needs.
func relayInfoForTest() *common.RelayInfo {
	info := &common.RelayInfo{}
	info.StreamStatus = common.NewStreamStatus()
	return info
}
