package channel

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	appcommon "github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

// pingSignalWriter exposes the first synthetic ping as a synchronization event
// without relying on wall-clock assertions.
type pingSignalWriter struct {
	gin.ResponseWriter
	once        sync.Once
	pingWritten chan struct{}
}

// Write records the first ping and delegates all response bytes unchanged.
func (w *pingSignalWriter) Write(data []byte) (int, error) {
	if bytes.Contains(data, []byte(": PING")) {
		w.once.Do(func() { close(w.pingWritten) })
	}
	return w.ResponseWriter.Write(data)
}

// firstByteTestContext builds the downstream and upstream requests used by
// first-byte timeout contract tests.
func firstByteTestContext(t *testing.T, target string) (*gin.Context, *http.Request) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	req, err := http.NewRequest(http.MethodPost, target, nil)
	require.NoError(t, err)
	return c, req
}

// TestDoRequestStreamingFirstByteTimeout verifies an upstream that never sends
// headers is canceled with the dedicated retryable 504 error.
func TestDoRequestStreamingFirstByteTimeout(t *testing.T) {
	gin.SetMode(gin.TestMode)
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		<-r.Context().Done()
	}))
	defer server.Close()

	oldTimeout := appcommon.StreamingFirstByteTimeout
	oldRelayTimeout := appcommon.RelayTimeout
	appcommon.StreamingFirstByteTimeout = 1
	appcommon.RelayTimeout = 0
	service.InitHttpClient()
	t.Cleanup(func() {
		appcommon.StreamingFirstByteTimeout = oldTimeout
		appcommon.RelayTimeout = oldRelayTimeout
		service.InitHttpClient()
	})

	c, req := firstByteTestContext(t, server.URL)
	resp, err := DoRequest(c, req, &relaycommon.RelayInfo{IsStream: true, ChannelMeta: &relaycommon.ChannelMeta{}})
	require.Nil(t, resp)
	require.Error(t, err)
	var apiErr *types.NewAPIError
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, http.StatusGatewayTimeout, apiErr.StatusCode)
	require.Equal(t, types.ErrorCodeUpstreamFirstByteTimeout, apiErr.GetErrorCode())
}

// TestDoRequestFirstByteTimeoutDoesNotLimitStreamBody verifies the first-byte
// deadline ends at headers and does not cancel a channel-delayed body.
func TestDoRequestFirstByteTimeoutDoesNotLimitStreamBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	releaseBody := make(chan struct{})
	var releaseOnce sync.Once
	release := func() { releaseOnce.Do(func() { close(releaseBody) }) }
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		<-releaseBody
		_, _ = io.WriteString(w, "data: ok\n\n")
	}))
	defer server.Close()
	defer release()

	oldTimeout := appcommon.StreamingFirstByteTimeout
	oldRelayTimeout := appcommon.RelayTimeout
	appcommon.StreamingFirstByteTimeout = 1
	appcommon.RelayTimeout = 0
	service.InitHttpClient()
	t.Cleanup(func() {
		appcommon.StreamingFirstByteTimeout = oldTimeout
		appcommon.RelayTimeout = oldRelayTimeout
		service.InitHttpClient()
	})

	c, req := firstByteTestContext(t, server.URL)
	resp, err := DoRequest(c, req, &relaycommon.RelayInfo{IsStream: true, ChannelMeta: &relaycommon.ChannelMeta{}})
	require.NoError(t, err)
	defer resp.Body.Close()
	release()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, "data: ok\n\n", string(body))
}

// TestDoRequestFirstByteTimeoutKeepsRequestPingEnabled verifies request-time
// keepalive remains active while the first-byte deadline is configured.
func TestDoRequestFirstByteTimeoutKeepsRequestPingEnabled(t *testing.T) {
	gin.SetMode(gin.TestMode)
	pingWritten := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-pingWritten:
			w.Header().Set("Content-Type", "text/event-stream")
			w.WriteHeader(http.StatusOK)
			w.(http.Flusher).Flush()
		case <-r.Context().Done():
		}
	}))
	defer server.Close()

	oldTimeout := appcommon.StreamingFirstByteTimeout
	oldRelayTimeout := appcommon.RelayTimeout
	setting := operation_setting.GetGeneralSetting()
	oldPingEnabled := setting.PingIntervalEnabled
	oldPingSeconds := setting.PingIntervalSeconds
	appcommon.StreamingFirstByteTimeout = 3
	appcommon.RelayTimeout = 0
	setting.PingIntervalEnabled = true
	setting.PingIntervalSeconds = 1
	service.InitHttpClient()
	t.Cleanup(func() {
		appcommon.StreamingFirstByteTimeout = oldTimeout
		appcommon.RelayTimeout = oldRelayTimeout
		setting.PingIntervalEnabled = oldPingEnabled
		setting.PingIntervalSeconds = oldPingSeconds
		service.InitHttpClient()
	})

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Writer = &pingSignalWriter{ResponseWriter: c.Writer, pingWritten: pingWritten}
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	req, err := http.NewRequest(http.MethodPost, server.URL, nil)
	require.NoError(t, err)

	resp, err := DoRequest(c, req, &relaycommon.RelayInfo{IsStream: true, ChannelMeta: &relaycommon.ChannelMeta{}})
	require.NoError(t, err)
	require.NotNil(t, resp)
	defer resp.Body.Close()
	require.Contains(t, recorder.Body.String(), ": PING")
}
