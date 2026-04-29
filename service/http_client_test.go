package service

import (
	"net/http"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func boolPtr(v bool) *bool {
	return &v
}

func intPtr(v int) *int {
	return &v
}

func TestResolveRelayHTTPClientPolicy_NonStream(t *testing.T) {
	policy := ResolveRelayHTTPClientPolicy(dto.ChannelSettings{}, false)
	assert.Equal(t, time.Duration(dto.DefaultRequestTimeoutSeconds)*time.Second, policy.RequestTimeout)
	assert.Equal(t, time.Duration(dto.DefaultResponseHeaderTimeoutSeconds)*time.Second, policy.ResponseHeaderTimeout)

	policy = ResolveRelayHTTPClientPolicy(dto.ChannelSettings{
		RequestTimeoutEnabled:        boolPtr(true),
		RequestTimeoutSeconds:        intPtr(9),
		ResponseHeaderTimeoutEnabled: boolPtr(true),
		ResponseHeaderTimeoutSeconds: intPtr(4),
	}, false)
	assert.Equal(t, 9*time.Second, policy.RequestTimeout)
	assert.Equal(t, 4*time.Second, policy.ResponseHeaderTimeout)

	policy = ResolveRelayHTTPClientPolicy(dto.ChannelSettings{
		RequestTimeoutEnabled: boolPtr(false),
	}, false)
	assert.Zero(t, policy.RequestTimeout)
}

func TestResolveRelayHTTPClientPolicy_Stream(t *testing.T) {
	policy := ResolveRelayHTTPClientPolicy(dto.ChannelSettings{}, true)
	assert.Zero(t, policy.RequestTimeout)
	assert.Equal(t, time.Duration(dto.DefaultStreamResponseHeaderTimeoutSeconds)*time.Second, policy.ResponseHeaderTimeout)

	policy = ResolveRelayHTTPClientPolicy(dto.ChannelSettings{
		StreamResponseHeaderTimeoutEnabled: boolPtr(true),
		StreamResponseHeaderTimeoutSeconds: intPtr(6),
		RequestTimeoutEnabled:              boolPtr(true),
		RequestTimeoutSeconds:              intPtr(5),
	}, true)
	assert.Zero(t, policy.RequestTimeout)
	assert.Equal(t, 6*time.Second, policy.ResponseHeaderTimeout)
}

func TestGetRelayHttpClientWithPolicy_CachesByPolicy(t *testing.T) {
	ResetProxyClientCache()
	t.Cleanup(ResetProxyClientCache)
	InitHttpClient()

	policyA := RelayHTTPClientPolicy{
		RequestTimeout:        5 * time.Second,
		ResponseHeaderTimeout: 2 * time.Second,
	}
	clientA1, err := GetRelayHttpClientWithPolicy("", policyA)
	require.NoError(t, err)
	clientA2, err := GetRelayHttpClientWithPolicy("", policyA)
	require.NoError(t, err)
	assert.Same(t, clientA1, clientA2)

	policyB := RelayHTTPClientPolicy{
		RequestTimeout:        7 * time.Second,
		ResponseHeaderTimeout: 2 * time.Second,
	}
	clientB, err := GetRelayHttpClientWithPolicy("", policyB)
	require.NoError(t, err)
	assert.NotSame(t, clientA1, clientB)

	transportA, ok := clientA1.Transport.(*http.Transport)
	require.True(t, ok)
	assert.Equal(t, 2*time.Second, transportA.ResponseHeaderTimeout)
	assert.Equal(t, 5*time.Second, clientA1.Timeout)
}
