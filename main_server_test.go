package main

import (
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestNewHTTPServerUsesSafeConnectionDefaults(t *testing.T) {
	t.Setenv("HTTP_READ_HEADER_TIMEOUT_SECONDS", "")
	t.Setenv("HTTP_IDLE_TIMEOUT_SECONDS", "")
	t.Setenv("HTTP_MAX_HEADER_BYTES", "")

	server := newHTTPServer(":3000", http.NewServeMux())
	require.Equal(t, 10*time.Second, server.ReadHeaderTimeout)
	require.Equal(t, 120*time.Second, server.IdleTimeout)
	require.Equal(t, 1<<20, server.MaxHeaderBytes)
}

func TestNewHTTPServerAcceptsTimeoutOverrides(t *testing.T) {
	t.Setenv("HTTP_READ_HEADER_TIMEOUT_SECONDS", "7")
	t.Setenv("HTTP_IDLE_TIMEOUT_SECONDS", "90")
	t.Setenv("HTTP_MAX_HEADER_BYTES", "524288")

	server := newHTTPServer(":3000", http.NewServeMux())
	require.Equal(t, 7*time.Second, server.ReadHeaderTimeout)
	require.Equal(t, 90*time.Second, server.IdleTimeout)
	require.Equal(t, 524288, server.MaxHeaderBytes)
}
