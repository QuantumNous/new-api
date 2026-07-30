package service

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/pem"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func initProxyClientTestCache(t *testing.T) {
	t.Helper()
	if GetHttpClient() == nil {
		InitHttpClient()
	}
	ResetProxyClientCache()
	t.Cleanup(ResetProxyClientCache)
}

func TestProxyClientCacheCanonicalIdentityAndTargetedInvalidation(t *testing.T) {
	initProxyClientTestCache(t)

	proxyA := " HTTP://proxy-a.example:8080/ "
	proxyAAlias := "http://proxy-a.example:8080"
	proxyB := "http://proxy-b.example:8080"

	clientA, err := GetHttpClientWithProxy(proxyA)
	require.NoError(t, err)
	clientAAlias, err := GetHttpClientWithProxy(proxyAAlias)
	require.NoError(t, err)
	clientB, err := GetHttpClientWithProxy(proxyB)
	require.NoError(t, err)
	assert.Same(t, clientA, clientAAlias)
	assert.NotSame(t, clientA, clientB)

	InvalidateProxyClient(proxyAAlias)

	clientAAfter, err := GetHttpClientWithProxy(proxyA)
	require.NoError(t, err)
	clientBAfter, err := GetHttpClientWithProxy(proxyB)
	require.NoError(t, err)
	assert.NotSame(t, clientA, clientAAfter)
	assert.Same(t, clientB, clientBAfter)
}

func TestProxyClientCacheConcurrentGetCreatesSingleton(t *testing.T) {
	initProxyClientTestCache(t)

	const workers = 32
	results := make([]*http.Client, workers)
	errs := make([]error, workers)
	var waitGroup sync.WaitGroup
	waitGroup.Add(workers)
	for i := 0; i < workers; i++ {
		i := i
		go func() {
			defer waitGroup.Done()
			results[i], errs[i] = GetHttpClientWithProxy("socks5h://proxy.example")
		}()
	}
	waitGroup.Wait()

	for i := range results {
		require.NoError(t, errs[i])
		assert.Same(t, results[0], results[i])
	}
}

func TestProxyClientRuntimeCompatibilityDoesNotChangePersistedValue(t *testing.T) {
	initProxyClientTestCache(t)

	rawProxyURL := "socks5://user:password@proxy.example/legacy/path?token=secret#fragment"
	canonical, err := NormalizeProxyURL(rawProxyURL)
	require.NoError(t, err)
	assert.Equal(t, "socks5://user:password@proxy.example:1080", canonical)

	client, err := GetHttpClientWithProxy(rawProxyURL)
	require.NoError(t, err)
	transport, ok := client.Transport.(*http.Transport)
	require.True(t, ok)
	assert.NotNil(t, transport.DialContext, "SOCKS clients must use a context-aware dialer")
	assert.Equal(t, "socks5://user:password@proxy.example/legacy/path?token=secret#fragment", rawProxyURL)
}

func TestNormalizeHTTPTransportPolicyClampsLegacyValues(t *testing.T) {
	assert.Equal(t, defaultHTTPTransportPolicy(), NormalizeHTTPTransportPolicy(dto.ChannelSettings{}))
	assert.Equal(t, HTTPTransportPolicy{Protocol: dto.HTTPProtocolAuto, Shards: 4}, NormalizeHTTPTransportPolicy(dto.ChannelSettings{HTTPProtocol: "AUTO", HTTP2ConnectionShards: 4}))
	assert.Equal(t, HTTPTransportPolicy{Protocol: dto.HTTPProtocolHTTP1, Shards: 1}, NormalizeHTTPTransportPolicy(dto.ChannelSettings{HTTPProtocol: "HTTP1", HTTP2ConnectionShards: 8}))
	assert.Equal(t, HTTPTransportPolicy{Protocol: dto.HTTPProtocolAuto, Shards: 1}, NormalizeHTTPTransportPolicy(dto.ChannelSettings{HTTPProtocol: "http3"}))
	assert.Equal(t, HTTPTransportPolicy{Protocol: dto.HTTPProtocolAuto, Shards: 1}, NormalizeHTTPTransportPolicy(dto.ChannelSettings{HTTP2ConnectionShards: -3}))
	assert.Equal(t, HTTPTransportPolicy{Protocol: dto.HTTPProtocolAuto, Shards: 8}, NormalizeHTTPTransportPolicy(dto.ChannelSettings{HTTP2ConnectionShards: 99}))
}

func TestHTTPClientCacheIncludesTransportPolicy(t *testing.T) {
	initProxyClientTestCache(t)

	defaultClient, err := GetHttpClientWithProxySettings("", dto.ChannelSettings{})
	require.NoError(t, err)
	assert.Same(t, GetHttpClient(), defaultClient)

	http1Client, err := GetHttpClientWithProxySettings("", dto.ChannelSettings{HTTPProtocol: dto.HTTPProtocolHTTP1})
	require.NoError(t, err)
	shardedClient, err := GetHttpClientWithProxySettings("", dto.ChannelSettings{HTTP2ConnectionShards: 4})
	require.NoError(t, err)
	assert.NotSame(t, defaultClient, http1Client)
	assert.NotSame(t, defaultClient, shardedClient)
	assert.NotSame(t, http1Client, shardedClient)
	InvalidateProxyClient("")
	directHTTP1After, err := GetHttpClientWithProxySettings("", dto.ChannelSettings{HTTPProtocol: dto.HTTPProtocolHTTP1})
	require.NoError(t, err)
	assert.NotSame(t, http1Client, directHTTP1After)
	defaultClientAfter, err := GetHttpClientWithProxySettings("", dto.ChannelSettings{})
	require.NoError(t, err)
	assert.Same(t, defaultClient, defaultClientAfter)

	proxyURL := "http://policy-proxy.example:8080"
	proxyDefault, err := GetHttpClientWithProxy(proxyURL)
	require.NoError(t, err)
	proxyHTTP1, err := GetHttpClientWithProxySettings(proxyURL, dto.ChannelSettings{HTTPProtocol: dto.HTTPProtocolHTTP1})
	require.NoError(t, err)
	assert.NotSame(t, proxyDefault, proxyHTTP1)

	InvalidateProxyClient(proxyURL)
	proxyDefaultAfter, err := GetHttpClientWithProxy(proxyURL)
	require.NoError(t, err)
	proxyHTTP1After, err := GetHttpClientWithProxySettings(proxyURL, dto.ChannelSettings{HTTPProtocol: dto.HTTPProtocolHTTP1})
	require.NoError(t, err)
	assert.NotSame(t, proxyDefault, proxyDefaultAfter)
	assert.NotSame(t, proxyHTTP1, proxyHTTP1After)
}

func TestShardedRoundTripperRotatesIndependentlyPerOrigin(t *testing.T) {
	sharded := &shardedRoundTripper{n: 4}
	for _, origin := range []string{"https://a.example", "https://b.example"} {
		got := make([]uint32, 8)
		for i := range got {
			got[i] = sharded.pickShard(origin)
		}
		assert.Equal(t, []uint32{0, 1, 2, 3, 0, 1, 2, 3}, got)
	}
}

func testTLSConfig(t *testing.T, server *httptest.Server) *tls.Config {
	t.Helper()
	pool := x509.NewCertPool()
	certificate := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: server.Certificate().Raw})
	require.True(t, pool.AppendCertsFromPEM(certificate))
	return &tls.Config{RootCAs: pool}
}

func testHTTP2Server(t *testing.T, handler http.Handler) *httptest.Server {
	t.Helper()
	server := httptest.NewUnstartedServer(handler)
	server.EnableHTTP2 = true
	server.StartTLS()
	t.Cleanup(server.Close)
	return server
}

func closeResponse(t *testing.T, response *http.Response) {
	t.Helper()
	_, err := io.Copy(io.Discard, response.Body)
	require.NoError(t, err)
	require.NoError(t, response.Body.Close())
}

func TestHTTP1PolicyDisablesHTTP2Negotiation(t *testing.T) {
	server := testHTTP2Server(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		writer.WriteHeader(http.StatusOK)
	}))
	policy := HTTPTransportPolicy{Protocol: dto.HTTPProtocolHTTP1, Shards: 1}
	client := newHTTPClientWithPolicyAndTLS(policy, testTLSConfig(t, server))

	response, err := client.Get(server.URL)
	require.NoError(t, err)
	assert.Equal(t, 1, response.ProtoMajor)
	closeResponse(t, response)

	transport, ok := client.Transport.(*http.Transport)
	require.True(t, ok)
	assert.False(t, transport.ForceAttemptHTTP2)
	assert.NotNil(t, transport.TLSNextProto)
	assert.Empty(t, transport.TLSNextProto)
}

func TestHTTP2ShardsCreateAndReuseBoundedConnections(t *testing.T) {
	var mutex sync.Mutex
	remoteAddresses := make(map[string]struct{})
	var nonHTTP2 atomic.Int32
	server := testHTTP2Server(t, http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		mutex.Lock()
		remoteAddresses[request.RemoteAddr] = struct{}{}
		mutex.Unlock()
		if request.ProtoMajor != 2 {
			nonHTTP2.Add(1)
		}
		writer.WriteHeader(http.StatusOK)
	}))
	policy := HTTPTransportPolicy{Protocol: dto.HTTPProtocolAuto, Shards: 4}
	client := newHTTPClientWithPolicyAndTLS(policy, testTLSConfig(t, server))

	for i := 0; i < 8; i++ {
		response, err := client.Get(server.URL)
		require.NoError(t, err)
		assert.Equal(t, 2, response.ProtoMajor)
		closeResponse(t, response)
	}

	mutex.Lock()
	connectionCount := len(remoteAddresses)
	mutex.Unlock()
	assert.Zero(t, nonHTTP2.Load())
	assert.Equal(t, 4, connectionCount)
}
