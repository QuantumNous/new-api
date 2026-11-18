package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type staticSSRFResolver map[string][]net.IPAddr

func (r staticSSRFResolver) LookupIPAddr(ctx context.Context, host string) ([]net.IPAddr, error) {
	if ips, ok := r[host]; ok {
		return ips, nil
	}
	return nil, fmt.Errorf("unexpected lookup for %s", host)
}

func staticProtection(protection *common.SSRFProtection) func() (*common.SSRFProtection, bool, error) {
	return func() (*common.SSRFProtection, bool, error) {
		return protection, true, nil
	}
}

func testConn(t *testing.T) net.Conn {
	t.Helper()
	clientConn, serverConn := net.Pipe()
	t.Cleanup(func() {
		clientConn.Close()
		serverConn.Close()
	})
	return clientConn
}

func configureSSRFTestFetchSetting(t *testing.T) {
	t.Helper()
	fetchSetting := system_setting.GetFetchSetting()
	original := *fetchSetting
	t.Cleanup(func() {
		*fetchSetting = original
	})

	fetchSetting.EnableSSRFProtection = true
	fetchSetting.AllowPrivateIp = false
	fetchSetting.DomainFilterMode = false
	fetchSetting.IpFilterMode = false
	fetchSetting.DomainList = nil
	fetchSetting.IpList = nil
	fetchSetting.AllowedPorts = []string{"80", "443"}
	fetchSetting.ApplyIPFilterForDomain = true
}

func mustParseURL(t *testing.T, rawURL string) *url.URL {
	t.Helper()
	parsedURL, err := url.Parse(rawURL)
	require.NoError(t, err)
	return parsedURL
}

func TestProtectedFetchDialerRejectsPrivateReboundAddress(t *testing.T) {
	dialer := &protectedFetchDialer{
		resolver: staticSSRFResolver{
			"safe.example": {{IP: net.ParseIP("127.0.0.1")}},
		},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			t.Fatalf("dialContext should not be called for blocked address %s", address)
			return nil, nil
		},
		getProtection: staticProtection(&common.SSRFProtection{
			AllowPrivateIp:         false,
			DomainFilterMode:       false,
			IpFilterMode:           false,
			ApplyIPFilterForDomain: true,
		}),
	}

	conn, err := dialer.DialContext(context.Background(), "tcp", "safe.example:80")

	require.Error(t, err)
	require.Nil(t, conn)
	require.Contains(t, err.Error(), "private IP address not allowed")
}

func TestProtectedFetchDialerRejectsMixedResolvedIPs(t *testing.T) {
	var dialed []string
	dialer := &protectedFetchDialer{
		resolver: staticSSRFResolver{
			"safe.example": {
				{IP: net.ParseIP("10.0.0.1")},
				{IP: net.ParseIP("8.8.8.8")},
			},
		},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
		getProtection: staticProtection(&common.SSRFProtection{
			AllowPrivateIp:         false,
			DomainFilterMode:       false,
			IpFilterMode:           false,
			ApplyIPFilterForDomain: true,
		}),
	}

	conn, err := dialer.DialContext(context.Background(), "tcp", "safe.example:443")
	require.Error(t, err)
	require.Nil(t, conn)

	require.Empty(t, dialed)
	require.Contains(t, err.Error(), "private IP address not allowed")
}

func TestProtectedFetchDialerDialsWhenAllResolvedIPsAllowed(t *testing.T) {
	var dialed []string
	dialer := &protectedFetchDialer{
		resolver: staticSSRFResolver{
			"safe.example": {
				{IP: net.ParseIP("8.8.8.8")},
				{IP: net.ParseIP("1.1.1.1")},
			},
		},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
		getProtection: staticProtection(&common.SSRFProtection{
			AllowPrivateIp:         false,
			DomainFilterMode:       false,
			IpFilterMode:           false,
			ApplyIPFilterForDomain: true,
		}),
	}

	conn, err := dialer.DialContext(context.Background(), "tcp", "safe.example:443")
	require.NoError(t, err)
	require.NotNil(t, conn)

	require.Equal(t, []string{"8.8.8.8:443"}, dialed)
}

func TestProtectedFetchDialerAllowsPrivateIPWhenWhitelisted(t *testing.T) {
	var dialed []string
	dialer := &protectedFetchDialer{
		resolver: staticSSRFResolver{
			"internal.example": {{IP: net.ParseIP("10.1.2.3")}},
		},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
		getProtection: staticProtection(&common.SSRFProtection{
			AllowPrivateIp:         true,
			DomainFilterMode:       false,
			IpFilterMode:           true,
			IpList:                 []string{"10.0.0.0/8"},
			ApplyIPFilterForDomain: true,
		}),
	}

	conn, err := dialer.DialContext(context.Background(), "tcp", "internal.example:80")
	require.NoError(t, err)
	require.NotNil(t, conn)

	require.Equal(t, []string{"10.1.2.3:80"}, dialed)
}

func TestProtectedFetchDialerSkipsResolvedIPCheckWhenDisabled(t *testing.T) {
	var dialed []string
	dialer := &protectedFetchDialer{
		resolver: staticSSRFResolver{},
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return testConn(t), nil
		},
		getProtection: staticProtection(&common.SSRFProtection{
			AllowPrivateIp:         false,
			DomainFilterMode:       false,
			IpFilterMode:           false,
			ApplyIPFilterForDomain: false,
		}),
	}

	conn, err := dialer.DialContext(context.Background(), "tcp", "safe.example:80")
	require.NoError(t, err)
	require.NotNil(t, conn)

	require.Equal(t, []string{"safe.example:80"}, dialed)
}

func TestGetSSRFProtectedHTTPClientFallsBackToDefaultClientWhenProtectionDisabled(t *testing.T) {
	fetchSetting := system_setting.GetFetchSetting()
	originalFetchSetting := *fetchSetting
	originalHTTPClient := httpClient
	originalProtectedClient := ssrfProtectedHTTPClient
	t.Cleanup(func() {
		*fetchSetting = originalFetchSetting
		httpClient = originalHTTPClient
		ssrfProtectedHTTPClient = originalProtectedClient
	})

	fetchSetting.EnableSSRFProtection = false
	expected := &http.Client{}
	httpClient = expected
	ssrfProtectedHTTPClient = &http.Client{}

	require.Same(t, expected, GetSSRFProtectedHTTPClient())
}

func TestProtectedFetchRoundTripperUsesConfiguredProxy(t *testing.T) {
	configureSSRFTestFetchSetting(t)
	proxyURL := mustParseURL(t, "http://127.0.0.1:3128")
	var dialed []string
	client := newProtectedFetchHTTPClientWithProxy(
		staticSSRFResolver{},
		func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return nil, errors.New("stop after proxy dial")
		},
		staticProtection(&common.SSRFProtection{
			AllowPrivateIp:         false,
			DomainFilterMode:       false,
			IpFilterMode:           false,
			ApplyIPFilterForDomain: true,
		}),
		func(req *http.Request) (*url.URL, error) {
			return proxyURL, nil
		},
	)
	req, err := http.NewRequest(http.MethodGet, "http://93.184.216.34/resource", nil)
	require.NoError(t, err)

	resp, err := client.Do(req)
	require.Error(t, err)
	require.Nil(t, resp)
	require.Equal(t, []string{"127.0.0.1:3128"}, dialed)
}

func TestProtectedFetchRoundTripperRejectsPrivateTargetBeforeProxy(t *testing.T) {
	configureSSRFTestFetchSetting(t)
	proxyURL := mustParseURL(t, "http://127.0.0.1:3128")
	var dialed []string
	client := newProtectedFetchHTTPClientWithProxy(
		staticSSRFResolver{},
		func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return nil, errors.New("proxy should not be dialed")
		},
		staticProtection(&common.SSRFProtection{
			AllowPrivateIp:         false,
			DomainFilterMode:       false,
			IpFilterMode:           false,
			ApplyIPFilterForDomain: true,
		}),
		func(req *http.Request) (*url.URL, error) {
			return proxyURL, nil
		},
	)
	req, err := http.NewRequest(http.MethodGet, "http://localhost/resource", nil)
	require.NoError(t, err)

	resp, err := client.Do(req)
	require.Error(t, err)
	require.Nil(t, resp)
	require.Contains(t, err.Error(), "private IP address not allowed")
	require.Empty(t, dialed)
}

func TestProtectedFetchRoundTripperNoProxyUsesProtectedDialer(t *testing.T) {
	configureSSRFTestFetchSetting(t)
	var dialed []string
	client := newProtectedFetchHTTPClientWithProxy(
		staticSSRFResolver{},
		func(ctx context.Context, network, address string) (net.Conn, error) {
			dialed = append(dialed, address)
			return nil, errors.New("unexpected direct dial")
		},
		staticProtection(&common.SSRFProtection{
			AllowPrivateIp:         false,
			DomainFilterMode:       false,
			IpFilterMode:           false,
			ApplyIPFilterForDomain: true,
		}),
		func(req *http.Request) (*url.URL, error) {
			return nil, nil
		},
	)
	req, err := http.NewRequest(http.MethodGet, "http://127.0.0.1/resource", nil)
	require.NoError(t, err)

	resp, err := client.Do(req)
	require.Error(t, err)
	require.Nil(t, resp)
	require.Contains(t, err.Error(), "private IP address not allowed")
	require.Empty(t, dialed)
}

func TestProtectedFetchRoundTripperReusesTransportPerProxy(t *testing.T) {
	client := newProtectedFetchHTTPClientWithDialer(nil, nil, nil)
	roundTripper, ok := client.Transport.(*ssrfProtectedRoundTripper)
	require.True(t, ok)

	direct := roundTripper.transportFor(nil)
	directAgain := roundTripper.transportFor(nil)
	proxied := roundTripper.transportFor(mustParseURL(t, "http://127.0.0.1:3128"))

	require.Same(t, direct, directAgain)
	require.NotSame(t, direct, proxied)
	require.True(t, direct.ForceAttemptHTTP2)
	require.False(t, direct.DisableKeepAlives)
}

// channelGet sends a GET request to target with the client ChannelHTTPClient
// returns for a channel with the proxy rawProxyURL.
func channelGet(rawProxyURL string, supplierChannel bool, target string) (*http.Response, error) {
	client, err := ChannelHTTPClient(rawProxyURL, dto.ChannelSettings{}, supplierChannel)
	if err != nil {
		return nil, err
	}
	return client.Get(target)
}

func TestChannelHTTPClientGuardsSupplierChannels(t *testing.T) {
	configureSSRFTestFetchSetting(t)
	fetchSetting := system_setting.GetFetchSetting()
	t.Cleanup(ResetProxyClientCache)
	var hits atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
	}))
	t.Cleanup(server.Close)

	_, err := channelGet("", true, server.URL)
	assert.ErrorIs(t, err, errChannelFetchBlocked)
	// The target is an IP literal, so its check needs no DNS. Were the proxy
	// not checked, the request would reach the server acting as the proxy.
	_, err = channelGet(server.URL, true, "http://1.1.1.1/")
	assert.ErrorIs(t, err, errChannelFetchBlocked)
	assert.Zero(t, hits.Load())

	response, err := channelGet("", false, server.URL)
	require.NoError(t, err)
	require.NoError(t, response.Body.Close())
	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.EqualValues(t, 1, hits.Load())

	fetchSetting.EnableSSRFProtection = false
	response, err = channelGet("", true, server.URL)
	require.NoError(t, err)
	require.NoError(t, response.Body.Close())
	assert.Equal(t, http.StatusOK, response.StatusCode)
	fetchSetting.EnableSSRFProtection = true

	assert.Error(t, ValidateChannelProxyAddress("socks5://127.0.0.1:1080"))
	assert.NoError(t, ValidateChannelProxyAddress(""))

	// A client built while the setting allowed its proxy checks the proxy
	// again on connecting to it, through an http or a SOCKS proxy alike.
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = listener.Close() })
	var accepted atomic.Int32
	go func() {
		for {
			conn, err := listener.Accept()
			if err != nil {
				return
			}
			accepted.Add(1)
			_ = conn.Close()
		}
	}()
	for _, scheme := range []string{"http", "socks5"} {
		fetchSetting.AllowPrivateIp, fetchSetting.AllowedPorts = true, nil
		client, err := ChannelHTTPClient(scheme+"://"+listener.Addr().String(), dto.ChannelSettings{}, true)
		require.NoError(t, err, scheme)
		fetchSetting.AllowPrivateIp = false
		_, err = client.Get("http://1.1.1.1/")
		assert.ErrorIs(t, err, errChannelFetchBlocked, scheme)
	}
	assert.Zero(t, accepted.Load())

	// The client keeps the channel's transport policy, such as skipping the
	// certificate check.
	fetchSetting.AllowPrivateIp = true
	tlsServer := httptest.NewTLSServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	t.Cleanup(tlsServer.Close)
	client, err := ChannelHTTPClient("", dto.ChannelSettings{}, true)
	require.NoError(t, err)
	_, err = client.Get(tlsServer.URL)
	assert.ErrorContains(t, err, "certificate")
	client, err = ChannelHTTPClient("", dto.ChannelSettings{TLSInsecureSkipVerify: true}, true)
	require.NoError(t, err)
	response, err = client.Get(tlsServer.URL)
	require.NoError(t, err)
	require.NoError(t, response.Body.Close())
	assert.Equal(t, http.StatusOK, response.StatusCode)
}

func TestChannelHTTPClientChecksTheTargetAProxyIsAskedFor(t *testing.T) {
	configureSSRFTestFetchSetting(t)
	fetchSetting := system_setting.GetFetchSetting()
	t.Cleanup(ResetProxyClientCache)
	// Only the proxy and 1.1.1.1 may be reached.
	fetchSetting.AllowPrivateIp, fetchSetting.AllowedPorts = true, nil
	fetchSetting.IpFilterMode, fetchSetting.IpList = true, []string{"127.0.0.1", "1.1.1.1"}
	proxyListener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = proxyListener.Close() })
	var accepted atomic.Int32
	go func() {
		for {
			conn, err := proxyListener.Accept()
			if err != nil {
				return
			}
			accepted.Add(1)
			_ = conn.Close()
		}
	}()
	client, err := ChannelHTTPClient("http://"+proxyListener.Addr().String(), dto.ChannelSettings{}, true)
	require.NoError(t, err)
	get := func(target, host string) error {
		request, err := http.NewRequest(http.MethodGet, target, nil)
		require.NoError(t, err)
		request.Host = host
		response, err := client.Do(request)
		if err == nil {
			_ = response.Body.Close()
		}
		return err
	}

	// An http request through an HTTP proxy names its target by the Host
	// header, which a header override sets; the URL alone names it otherwise.
	assert.ErrorIs(t, get("http://1.1.1.1/", "10.0.0.1"), errChannelFetchBlocked)
	assert.ErrorIs(t, get("http://10.0.0.1/", ""), errChannelFetchBlocked)
	assert.Zero(t, accepted.Load())
	_ = get("http://1.1.1.1/", "127.0.0.1")
	assert.Positive(t, accepted.Load())
}

// closeRecordingBody is a request body that records whether it was closed.
type closeRecordingBody struct {
	io.Reader
	closed bool
}

func (body *closeRecordingBody) Close() error {
	body.closed = true
	return nil
}

// A RoundTripper closes the request body even when it refuses the request.
func TestChannelHTTPClientClosesTheBodyOfARefusedRequest(t *testing.T) {
	configureSSRFTestFetchSetting(t)
	t.Cleanup(ResetProxyClientCache)
	client, err := ChannelHTTPClient("", dto.ChannelSettings{}, true)
	require.NoError(t, err)
	for _, test := range []struct{ name, target, host string }{
		{name: "private target", target: "http://10.0.0.1/"},
		{name: "private Host", target: "http://1.1.1.1/", host: "10.0.0.1"},
	} {
		t.Run(test.name, func(t *testing.T) {
			body := &closeRecordingBody{Reader: strings.NewReader(`{"model":"m"}`)}
			request, err := http.NewRequest(http.MethodPost, test.target, body)
			require.NoError(t, err)
			request.Host = test.host
			_, err = client.Do(request)
			assert.ErrorIs(t, err, errChannelFetchBlocked)
			assert.True(t, body.closed)
		})
	}
}

// A supplier channel's request fetch_setting refuses fails without the
// reason, which can name an address the server resolved; the other protected
// fetches keep reporting it.
func TestChannelHTTPClientRefusalsNameNoAddress(t *testing.T) {
	configureSSRFTestFetchSetting(t)
	t.Cleanup(ResetProxyClientCache)
	// localhost resolves to a loopback address.
	_, err := channelGet("", true, "http://localhost/")
	var refusal *url.Error
	require.ErrorAs(t, err, &refusal)
	assert.Equal(t, errChannelFetchBlocked, refusal.Err)
	for _, address := range []string{"127.0.0.1", "::1"} {
		assert.NotContains(t, err.Error(), address)
	}
	InitHttpClient()
	_, err = GetSSRFProtectedHTTPClient().Get("http://localhost/")
	assert.ErrorContains(t, err, "private IP address not allowed: localhost resolves to")

	// So does a redirect to an address fetch_setting refuses.
	fetchSetting := system_setting.GetFetchSetting()
	fetchSetting.AllowPrivateIp, fetchSetting.AllowedPorts = true, nil
	fetchSetting.IpFilterMode, fetchSetting.IpList = true, []string{"127.0.0.1"}
	server := httptest.NewServer(http.RedirectHandler("http://10.0.0.1/", http.StatusFound))
	t.Cleanup(server.Close)
	_, err = channelGet("", true, server.URL)
	require.ErrorAs(t, err, &refusal)
	assert.Equal(t, errChannelFetchBlocked, refusal.Err)

	// A connection that fails to an address fetch_setting allows keeps its
	// own error.
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	closedAddress := listener.Addr().String()
	require.NoError(t, listener.Close())
	_, err = channelGet("", true, "http://"+closedAddress+"/")
	var dialError *net.OpError
	assert.ErrorAs(t, err, &dialError)
	assert.NotErrorIs(t, err, errChannelFetchBlocked)
}

func TestProxyClientCacheResetsCoverSupplierChannelClients(t *testing.T) {
	configureSSRFTestFetchSetting(t)
	t.Cleanup(ResetProxyClientCache)
	get := func(rawProxyURL string) *http.Client {
		client, err := ChannelHTTPClient(rawProxyURL, dto.ChannelSettings{}, true)
		require.NoError(t, err)
		return client
	}
	const proxyA, proxyB = "http://1.1.1.1", "http://8.8.8.8"
	direct, viaA, viaB := get(""), get(proxyA), get(proxyB)
	require.Same(t, viaA, get(proxyA))

	InvalidateProxyClient(proxyA)
	assert.NotSame(t, viaA, get(proxyA))
	assert.Same(t, viaB, get(proxyB))
	assert.Same(t, direct, get(""))

	ResetProxyClientCache()
	assert.NotSame(t, viaB, get(proxyB))
	assert.NotSame(t, direct, get(""))
}
