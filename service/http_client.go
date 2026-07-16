package service

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"golang.org/x/net/http2"
	"golang.org/x/net/proxy"
)

var (
	httpClient              *http.Client // non-streaming relay + general use
	httpClientStream        *http.Client // streaming relay: shorter response-header timeout
	ssrfProtectedHTTPClient *http.Client // arbitrary user-controlled URL fetches
	proxyClientLock         sync.Mutex
	proxyClients            = make(map[string]*http.Client)
)

func checkRedirect(req *http.Request, via []*http.Request) error {
	urlStr := req.URL.String()
	if err := validateURLWithCurrentFetchSetting(urlStr, true); err != nil {
		return fmt.Errorf("redirect to %s blocked: %v", urlStr, err)
	}
	if len(via) >= 10 {
		return fmt.Errorf("stopped after 10 redirects")
	}
	return nil
}

func checkProtectedFetchRedirect(req *http.Request, via []*http.Request) error {
	urlStr := req.URL.String()
	if err := ValidateSSRFProtectedFetchURL(urlStr); err != nil {
		return fmt.Errorf("redirect to %s blocked: %v", urlStr, err)
	}
	if len(via) >= 10 {
		return fmt.Errorf("stopped after 10 redirects")
	}
	return nil
}

func validateURLWithCurrentFetchSetting(urlStr string, applyDomainIPFilter bool) error {
	fetchSetting := system_setting.GetFetchSetting()
	return common.ValidateURLWithFetchSetting(urlStr, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, applyDomainIPFilter && fetchSetting.ApplyIPFilterForDomain)
}

func ValidateSSRFProtectedFetchURL(urlStr string) error {
	return validateURLWithCurrentFetchSetting(urlStr, true)
}

// relayResponseHeaderTimeout returns the response-header timeout for the given
// stream mode. Streaming upstreams send response headers before the SSE body,
// so streaming can use a shorter timeout to fail over from a dead/hung channel
// quickly without risking slow non-streaming (buffered/reasoning) responses.
func relayResponseHeaderTimeout(streaming bool) time.Duration {
	if streaming && common.RelayStreamResponseHeaderTimeout > 0 {
		return time.Duration(common.RelayStreamResponseHeaderTimeout) * time.Second
	}
	return time.Duration(common.RelayResponseHeaderTimeout) * time.Second
}

// defaultRelayDialContext returns a timeout-bounded dialer so a black-holed
// upstream fails at connect instead of hanging (the transport previously set no
// dial timeout at all).
func defaultRelayDialContext() func(context.Context, string, string) (net.Conn, error) {
	return (&net.Dialer{
		Timeout:   time.Duration(common.RelayDialTimeout) * time.Second,
		KeepAlive: 30 * time.Second,
	}).DialContext
}

// newRelayTransport builds a relay transport with connect, TLS-handshake, idle
// and response-header timeouts. proxyFunc / dialContext may be nil.
func newRelayTransport(
	streaming bool,
	proxyFunc func(*http.Request) (*url.URL, error),
	dialContext func(context.Context, string, string) (net.Conn, error),
) *http.Transport {
	if dialContext == nil {
		dialContext = defaultRelayDialContext()
	}
	transport := &http.Transport{
		MaxIdleConns:          common.RelayMaxIdleConns,
		MaxIdleConnsPerHost:   common.RelayMaxIdleConnsPerHost,
		ForceAttemptHTTP2:     true,
		IdleConnTimeout:       time.Duration(common.RelayIdleConnTimeout) * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
		TLSHandshakeTimeout:   time.Duration(common.RelayTLSHandshakeTimeout) * time.Second,
		ResponseHeaderTimeout: relayResponseHeaderTimeout(streaming),
		Proxy:                 proxyFunc,
		DialContext:           dialContext,
	}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig
	}
	_ = configureRelayHTTP2Keepalive(transport)
	return transport
}

// configureRelayHTTP2Keepalive enables proactive HTTP/2 keepalive pings on the
// relay transport so a silently-dropped upstream connection sitting idle in the
// pool is detected and reaped, instead of stalling the next request until the
// response-header timeout (which delays failover from a dead channel).
// ReadIdleTimeout sends a PING once a connection has been idle that long; if no
// ack arrives within PingTimeout the connection is closed. Because PING frames
// are answered by the peer's HTTP/2 stack independently of application data, a
// legitimately slow-but-alive reasoning stream (upstream silent while
// "thinking") keeps its connection — only a truly dead connection fails to ack.
// Applies to HTTP/2 (TLS/ALPN) upstreams only; h1 connections are unaffected.
func configureRelayHTTP2Keepalive(transport *http.Transport) *http2.Transport {
	if common.RelayH2ReadIdleTimeout <= 0 {
		return nil
	}
	h2Transport, err := http2.ConfigureTransports(transport)
	if err != nil || h2Transport == nil {
		// Non-fatal: the transport still negotiates HTTP/2 via ForceAttemptHTTP2,
		// just without proactive keepalive pings.
		common.SysError(fmt.Sprintf("relay HTTP/2 keepalive not configured: %v", err))
		return nil
	}
	h2Transport.ReadIdleTimeout = time.Duration(common.RelayH2ReadIdleTimeout) * time.Second
	if common.RelayH2PingTimeout > 0 {
		h2Transport.PingTimeout = time.Duration(common.RelayH2PingTimeout) * time.Second
	}
	return h2Transport
}

func newRelayClient(transport *http.Transport) *http.Client {
	client := &http.Client{
		Transport:     transport,
		CheckRedirect: checkRedirect,
	}
	if common.RelayTimeout > 0 {
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
	}
	return client
}

func InitHttpClient() {
	httpClient = newRelayClient(newRelayTransport(false, http.ProxyFromEnvironment, nil))
	httpClientStream = newRelayClient(newRelayTransport(true, http.ProxyFromEnvironment, nil))
	ssrfProtectedHTTPClient = newProtectedFetchHTTPClient()
}

// GetHttpClient returns the shared non-streaming relay client, also used as the
// general outbound client by relay/provider integrations. Do not attach the
// SSRF-protected dialer here: provider base URLs are root/operator-managed
// deployment targets, not arbitrary user-controlled input, and may legitimately
// point at private networks, private-link endpoints, self-hosted services, or
// local proxies. Code paths that fetch arbitrary user-controlled URLs must use
// GetSSRFProtectedHTTPClient or ValidateSSRFProtectedFetchURL instead.
func GetHttpClient() *http.Client {
	return httpClient
}

// GetSSRFProtectedHTTPClient 返回带拨号时 SSRF 校验的客户端。
// ssrfProtectedHTTPClient 由 InitHttpClient 在启动时初始化，运行期只读。
func GetSSRFProtectedHTTPClient() *http.Client {
	if fetchSetting := system_setting.GetFetchSetting(); fetchSetting != nil && !fetchSetting.EnableSSRFProtection {
		return GetHttpClient()
	}
	return ssrfProtectedHTTPClient
}

// GetRelayHttpClient returns the shared relay client tuned for the request's
// stream mode. Streaming uses a shorter response-header timeout so a dead
// channel is abandoned in seconds rather than a full minute.
func GetRelayHttpClient(streaming bool) *http.Client {
	if streaming && httpClientStream != nil {
		return httpClientStream
	}
	if httpClient != nil {
		return httpClient
	}
	// Defensive: init on demand if InitHttpClient has not run yet.
	InitHttpClient()
	if streaming {
		return httpClientStream
	}
	return httpClient
}

// GetHttpClientWithProxy returns the default client or a proxy-enabled one when
// proxyURL is provided (non-streaming timeouts).
func GetHttpClientWithProxy(proxyURL string) (*http.Client, error) {
	return GetRelayHttpClientWithProxy(proxyURL, false)
}

// GetRelayHttpClientWithProxy is the stream-aware variant of
// GetHttpClientWithProxy.
func GetRelayHttpClientWithProxy(proxyURL string, streaming bool) (*http.Client, error) {
	if proxyURL == "" {
		return GetRelayHttpClient(streaming), nil
	}
	return newProxyHttpClient(proxyURL, streaming)
}

// ResetProxyClientCache 清空代理客户端缓存，确保下次使用时重新初始化
func ResetProxyClientCache() {
	proxyClientLock.Lock()
	defer proxyClientLock.Unlock()
	for _, client := range proxyClients {
		if transport, ok := client.Transport.(*http.Transport); ok && transport != nil {
			transport.CloseIdleConnections()
		}
	}
	proxyClients = make(map[string]*http.Client)
}

// NewProxyHttpClient 创建支持代理的 HTTP 客户端（非流式超时）
func NewProxyHttpClient(proxyURL string) (*http.Client, error) {
	return newProxyHttpClient(proxyURL, false)
}

func newProxyHttpClient(proxyURL string, streaming bool) (*http.Client, error) {
	if proxyURL == "" {
		return GetRelayHttpClient(streaming), nil
	}

	// Cache per (proxy, stream mode): streaming clients use a shorter
	// response-header timeout, so they must not share a transport with
	// non-streaming clients.
	cacheKey := proxyURL + "|stream=" + strconv.FormatBool(streaming)

	proxyClientLock.Lock()
	if client, ok := proxyClients[cacheKey]; ok {
		proxyClientLock.Unlock()
		return client, nil
	}
	proxyClientLock.Unlock()

	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}

	var client *http.Client
	switch parsedURL.Scheme {
	case "http", "https":
		transport := newRelayTransport(streaming, http.ProxyURL(parsedURL), nil)
		client = newRelayClient(transport)

	case "socks5", "socks5h":
		// 获取认证信息
		var auth *proxy.Auth
		if parsedURL.User != nil {
			auth = &proxy.Auth{
				User:     parsedURL.User.Username(),
				Password: "",
			}
			if password, ok := parsedURL.User.Password(); ok {
				auth.Password = password
			}
		}

		// 创建 SOCKS5 代理拨号器
		// proxy.SOCKS5 使用 tcp 参数，所有 TCP 连接包括 DNS 查询都将通过代理进行。行为与 socks5h 相同
		dialer, err := proxy.SOCKS5("tcp", parsedURL.Host, auth, proxy.Direct)
		if err != nil {
			return nil, err
		}

		// Bound the SOCKS5 dial with the relay dial timeout so a hung proxy
		// does not stall the request indefinitely.
		dialContext := func(ctx context.Context, network, addr string) (net.Conn, error) {
			if common.RelayDialTimeout > 0 {
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, time.Duration(common.RelayDialTimeout)*time.Second)
				defer cancel()
			}
			if ctxDialer, ok := dialer.(proxy.ContextDialer); ok {
				return ctxDialer.DialContext(ctx, network, addr)
			}
			return dialer.Dial(network, addr)
		}
		transport := newRelayTransport(streaming, nil, dialContext)
		client = newRelayClient(transport)

	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}

	proxyClientLock.Lock()
	proxyClients[cacheKey] = client
	proxyClientLock.Unlock()
	return client, nil
}
