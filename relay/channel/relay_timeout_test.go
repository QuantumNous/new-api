package channel

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func newRelayTestContext(t *testing.T) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	return c
}

func newRelayTestInfo(isStream bool) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		IsStream:    isStream,
		DisablePing: true,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}
}

// An upstream that sends response headers and then freezes must not hold a
// streaming relay goroutine open: the idle watchdog cancels the exchange.
func TestStreamingRelayCancelsStalledUpstreamBody(t *testing.T) {
	common.RelayStreamIdleTimeout = 1
	t.Cleanup(func() { common.RelayStreamIdleTimeout = 0 })

	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("data: {\"id\":\"chunk\"}\n\n"))
		w.(http.Flusher).Flush()
		select {
		case <-r.Context().Done():
		case <-release:
		}
	}))
	defer upstream.Close()

	c := newRelayTestContext(t)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, upstream.URL, nil)
	require.NoError(t, err)

	resp, err := DoRequest(c, req, newRelayTestInfo(true))
	require.NoError(t, err)
	defer resp.Body.Close()

	start := time.Now()
	_, err = io.ReadAll(resp.Body)
	require.Error(t, err, "a stalled stream must fail instead of blocking forever")
	require.Less(t, time.Since(start), 10*time.Second)
}

// A non-streaming upstream that stalls after the headers are consumed must hit
// the total request deadline instead of hanging.
func TestNonStreamingRelayDeadlineCutsStalledBody(t *testing.T) {
	common.RelayNonStreamTimeout = 1
	t.Cleanup(func() { common.RelayNonStreamTimeout = 0 })

	release := make(chan struct{})
	t.Cleanup(func() { close(release) })
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"id":"partial"`))
		w.(http.Flusher).Flush()
		select {
		case <-r.Context().Done():
		case <-release:
		}
	}))
	defer upstream.Close()

	c := newRelayTestContext(t)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, upstream.URL, nil)
	require.NoError(t, err)

	resp, err := DoRequest(c, req, newRelayTestInfo(false))
	require.NoError(t, err)
	defer resp.Body.Close()

	start := time.Now()
	_, err = io.ReadAll(resp.Body)
	require.Error(t, err, "a stalled non-streaming body must hit the request deadline")
	require.Less(t, time.Since(start), 10*time.Second)
}

// A response body larger than the configured cap is rejected while it is being
// read, so an unbounded upstream cannot exhaust memory.
func TestRelayResponseBodyCapRejectsOversizedUpstream(t *testing.T) {
	common.RelayMaxResponseBytes = 1024
	t.Cleanup(func() { common.RelayMaxResponseBytes = 64 << 20 })

	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(make([]byte, 4096))
	}))
	defer upstream.Close()

	c := newRelayTestContext(t)
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, upstream.URL, nil)
	require.NoError(t, err)

	resp, err := DoRequest(c, req, newRelayTestInfo(false))
	require.NoError(t, err)
	defer resp.Body.Close()

	_, err = io.ReadAll(resp.Body)
	require.ErrorIs(t, err, service.ErrUpstreamResponseTooLarge)
}

// Cancelling the client request must cancel the upstream connection instead of
// leaving an orphaned goroutine waiting on the provider.
func TestClientDisconnectCancelsUpstreamRequest(t *testing.T) {
	common.RelayStreamIdleTimeout = 0

	upstreamCancelled := make(chan struct{})
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		w.WriteHeader(http.StatusOK)
		w.(http.Flusher).Flush()
		select {
		case <-r.Context().Done():
			close(upstreamCancelled)
		case <-time.After(10 * time.Second):
		}
	}))
	defer upstream.Close()

	c := newRelayTestContext(t)
	clientCtx, cancelClient := context.WithCancel(c.Request.Context())
	c.Request = c.Request.WithContext(clientCtx)
	req, err := http.NewRequestWithContext(clientCtx, http.MethodPost, upstream.URL, nil)
	require.NoError(t, err)

	resp, err := DoRequest(c, req, newRelayTestInfo(true))
	require.NoError(t, err)
	readDone := make(chan error, 1)
	go func() {
		_, readErr := io.ReadAll(resp.Body)
		readDone <- readErr
	}()

	cancelClient()

	select {
	case readErr := <-readDone:
		require.Error(t, readErr)
		require.False(t, errors.Is(readErr, context.DeadlineExceeded))
	case <-time.After(5 * time.Second):
		t.Fatal("client disconnect did not cancel the upstream body read")
	}

	select {
	case <-upstreamCancelled:
	case <-time.After(5 * time.Second):
		t.Fatal("upstream request context was not cancelled after the client disconnected")
	}
}
