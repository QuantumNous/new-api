package common

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestNewOutboundHTTPTransportUsesLifecycleTimeouts(t *testing.T) {
	previousDial := RelayDialTimeout
	previousTLS := RelayTLSHandshakeTimeout
	previousHeader := RelayResponseHeaderTimeout
	previousExpect := RelayExpectContinueTimeout
	previousIdle := RelayIdleConnTimeout
	previousMaxIdle := RelayMaxIdleConns
	previousMaxIdleHost := RelayMaxIdleConnsPerHost
	t.Cleanup(func() {
		RelayDialTimeout = previousDial
		RelayTLSHandshakeTimeout = previousTLS
		RelayResponseHeaderTimeout = previousHeader
		RelayExpectContinueTimeout = previousExpect
		RelayIdleConnTimeout = previousIdle
		RelayMaxIdleConns = previousMaxIdle
		RelayMaxIdleConnsPerHost = previousMaxIdleHost
	})

	RelayDialTimeout = 7
	RelayTLSHandshakeTimeout = 8
	RelayResponseHeaderTimeout = 9
	RelayExpectContinueTimeout = 2
	RelayIdleConnTimeout = 90
	RelayMaxIdleConns = 200
	RelayMaxIdleConnsPerHost = 50

	transport := NewOutboundHTTPTransport(http.ProxyFromEnvironment, nil)
	require.Equal(t, 8*time.Second, transport.TLSHandshakeTimeout)
	require.Equal(t, 9*time.Second, transport.ResponseHeaderTimeout)
	require.Equal(t, 2*time.Second, transport.ExpectContinueTimeout)
	require.Equal(t, 90*time.Second, transport.IdleConnTimeout)
	require.Equal(t, 200, transport.MaxIdleConns)
	require.Equal(t, 50, transport.MaxIdleConnsPerHost)
	require.NotNil(t, transport.DialContext)
}

func TestOutboundTransportTimesOutWaitingForResponseHeaders(t *testing.T) {
	previousHeader := RelayResponseHeaderTimeout
	previousDial := RelayDialTimeout
	RelayResponseHeaderTimeout = 1
	RelayDialTimeout = 2
	t.Cleanup(func() {
		RelayResponseHeaderTimeout = previousHeader
		RelayDialTimeout = previousDial
	})

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(1500 * time.Millisecond)
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := &http.Client{Transport: NewOutboundHTTPTransport(nil, nil)}
	started := time.Now()
	_, err := client.Get(server.URL)
	require.Error(t, err)
	require.Contains(t, err.Error(), "timeout awaiting response headers")
	require.Less(t, time.Since(started), 1400*time.Millisecond)
}

func TestOutboundTransportHonorsRequestCancellation(t *testing.T) {
	previousHeader := RelayResponseHeaderTimeout
	RelayResponseHeaderTimeout = 0
	t.Cleanup(func() { RelayResponseHeaderTimeout = previousHeader })

	started := make(chan struct{})
	server := httptest.NewServer(http.HandlerFunc(func(_ http.ResponseWriter, request *http.Request) {
		close(started)
		<-request.Context().Done()
	}))
	defer server.Close()

	ctx, cancel := context.WithCancel(context.Background())
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, server.URL, nil)
	require.NoError(t, err)
	result := make(chan error, 1)
	client := &http.Client{Transport: NewOutboundHTTPTransport(nil, nil)}
	go func() {
		_, requestErr := client.Do(request)
		result <- requestErr
	}()
	<-started
	cancel()
	require.ErrorIs(t, <-result, context.Canceled)
	require.True(t, errors.Is(ctx.Err(), context.Canceled))
}
