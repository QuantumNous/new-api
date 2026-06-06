package service

import (
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/stretchr/testify/require"
)

func TestInitHttpClientSeparatesStreamingTimeouts(t *testing.T) {
	oldRelayTimeout := common.RelayTimeout
	oldStreamingTimeout := constant.StreamingTimeout
	common.RelayTimeout = 120
	constant.StreamingTimeout = 60
	t.Cleanup(func() {
		common.RelayTimeout = oldRelayTimeout
		constant.StreamingTimeout = oldStreamingTimeout
		InitHttpClient()
	})

	InitHttpClient()

	client := GetHttpClient()
	require.NotNil(t, client)
	require.Equal(t, 120*time.Second, client.Timeout)

	streamClient := GetStreamHttpClient()
	require.NotNil(t, streamClient)
	require.Zero(t, streamClient.Timeout)

	streamTransport, ok := streamClient.Transport.(*http.Transport)
	require.True(t, ok)
	require.Equal(t, 60*time.Second, streamTransport.ResponseHeaderTimeout)
	require.Equal(t, 60*time.Second, streamTransport.TLSHandshakeTimeout)
	require.NotNil(t, streamTransport.DialContext)

	transport, ok := client.Transport.(*http.Transport)
	require.True(t, ok)
	require.Zero(t, transport.ResponseHeaderTimeout)
}

func TestStreamProxyHttpClientUsesStreamingTimeout(t *testing.T) {
	oldRelayTimeout := common.RelayTimeout
	oldStreamingTimeout := constant.StreamingTimeout
	common.RelayTimeout = 120
	constant.StreamingTimeout = 60
	ResetProxyClientCache()
	t.Cleanup(func() {
		common.RelayTimeout = oldRelayTimeout
		constant.StreamingTimeout = oldStreamingTimeout
		ResetProxyClientCache()
	})

	client, err := NewProxyHttpClient("http://127.0.0.1:18080")
	require.NoError(t, err)
	require.Equal(t, 120*time.Second, client.Timeout)
	transport, ok := client.Transport.(*http.Transport)
	require.True(t, ok)
	require.Zero(t, transport.ResponseHeaderTimeout)

	streamClient, err := NewStreamProxyHttpClient("http://127.0.0.1:18080")
	require.NoError(t, err)
	require.Zero(t, streamClient.Timeout)
	streamTransport, ok := streamClient.Transport.(*http.Transport)
	require.True(t, ok)
	require.Equal(t, 60*time.Second, streamTransport.ResponseHeaderTimeout)
	require.Equal(t, 60*time.Second, streamTransport.TLSHandshakeTimeout)
	require.NotNil(t, streamTransport.DialContext)
}
