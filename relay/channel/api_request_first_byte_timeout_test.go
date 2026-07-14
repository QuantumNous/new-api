package channel

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	appcommon "github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func firstByteTestContext(t *testing.T, target string) (*gin.Context, *http.Request) {
	t.Helper()
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	req, err := http.NewRequest(http.MethodPost, target, nil)
	require.NoError(t, err)
	return c, req
}

func TestDoRequestStreamingFirstByteTimeout(t *testing.T) {
	gin.SetMode(gin.TestMode)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(1500 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
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
	started := time.Now()
	resp, err := DoRequest(c, req, &relaycommon.RelayInfo{IsStream: true, ChannelMeta: &relaycommon.ChannelMeta{}})
	require.Nil(t, resp)
	require.Error(t, err)
	var apiErr *types.NewAPIError
	require.ErrorAs(t, err, &apiErr)
	require.Equal(t, http.StatusGatewayTimeout, apiErr.StatusCode)
	require.Equal(t, types.ErrorCodeUpstreamFirstByteTimeout, apiErr.GetErrorCode())
	require.Less(t, time.Since(started), 1400*time.Millisecond)
}

func TestDoRequestFirstByteTimeoutDoesNotLimitStreamBody(t *testing.T) {
	gin.SetMode(gin.TestMode)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		time.Sleep(1200 * time.Millisecond)
		_, _ = io.WriteString(w, "data: ok\n\n")
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
	require.NoError(t, err)
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	require.NoError(t, err)
	require.Equal(t, "data: ok\n\n", string(body))
}
