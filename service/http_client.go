package service

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"golang.org/x/net/proxy"
)

var (
	httpClient         *http.Client
	streamHttpClient   *http.Client
	proxyClientLock    sync.Mutex
	proxyClients       = make(map[string]*http.Client)
	streamProxyClients = make(map[string]*http.Client)
)

const defaultStreamingResponseHeaderTimeout = 60 * time.Second

func checkRedirect(req *http.Request, via []*http.Request) error {
	fetchSetting := system_setting.GetFetchSetting()
	urlStr := req.URL.String()
	if err := common.ValidateURLWithFetchSetting(urlStr, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
		return fmt.Errorf("redirect to %s blocked: %v", urlStr, err)
	}
	if len(via) >= 10 {
		return fmt.Errorf("stopped after 10 redirects")
	}
	return nil
}

func streamingResponseHeaderTimeout() time.Duration {
	if constant.StreamingTimeout > 0 {
		return time.Duration(constant.StreamingTimeout) * time.Second
	}
	return defaultStreamingResponseHeaderTimeout
}

func newHTTPClient(transport *http.Transport, timeout time.Duration) *http.Client {
	client := &http.Client{
		Transport:     transport,
		CheckRedirect: checkRedirect,
	}
	if timeout > 0 {
		client.Timeout = timeout
	}
	return client
}

func newStreamingHTTPClient(transport *http.Transport) *http.Client {
	streamTransport := transport.Clone()
	timeout := streamingResponseHeaderTimeout()
	if streamTransport.DialContext == nil {
		dialer := &net.Dialer{
			Timeout:   timeout,
			KeepAlive: 30 * time.Second,
		}
		streamTransport.DialContext = dialer.DialContext
	}
	streamTransport.TLSHandshakeTimeout = timeout
	streamTransport.ResponseHeaderTimeout = timeout
	return newHTTPClient(streamTransport, 0)
}

func InitHttpClient() {
	transport := &http.Transport{
		MaxIdleConns:        common.RelayMaxIdleConns,
		MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
		IdleConnTimeout:     time.Duration(common.RelayIdleConnTimeout) * time.Second,
		ForceAttemptHTTP2:   true,
		Proxy:               http.ProxyFromEnvironment, // Support HTTP_PROXY, HTTPS_PROXY, NO_PROXY env vars
	}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig
	}

	httpClient = newHTTPClient(transport, time.Duration(common.RelayTimeout)*time.Second)
	streamHttpClient = newStreamingHTTPClient(transport)
}

func GetHttpClient() *http.Client {
	return httpClient
}

func GetStreamHttpClient() *http.Client {
	return streamHttpClient
}

// GetHttpClientWithProxy returns the default client or a proxy-enabled one when proxyURL is provided.
func GetHttpClientWithProxy(proxyURL string) (*http.Client, error) {
	if proxyURL == "" {
		return GetHttpClient(), nil
	}
	return NewProxyHttpClient(proxyURL)
}

// GetStreamHttpClientWithProxy returns a streaming client without a total request timeout.
func GetStreamHttpClientWithProxy(proxyURL string) (*http.Client, error) {
	if proxyURL == "" {
		return GetStreamHttpClient(), nil
	}
	return NewStreamProxyHttpClient(proxyURL)
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
	for _, client := range streamProxyClients {
		if transport, ok := client.Transport.(*http.Transport); ok && transport != nil {
			transport.CloseIdleConnections()
		}
	}
	streamProxyClients = make(map[string]*http.Client)
}

// NewProxyHttpClient 创建支持代理的 HTTP 客户端
func NewProxyHttpClient(proxyURL string) (*http.Client, error) {
	return newProxyHttpClient(proxyURL, false)
}

// NewStreamProxyHttpClient 创建支持代理的流式 HTTP 客户端。
func NewStreamProxyHttpClient(proxyURL string) (*http.Client, error) {
	return newProxyHttpClient(proxyURL, true)
}

func newProxyHttpClient(proxyURL string, stream bool) (*http.Client, error) {
	if proxyURL == "" {
		client := GetHttpClient()
		if stream {
			client = GetStreamHttpClient()
		}
		if client != nil {
			return client, nil
		}
		return http.DefaultClient, nil
	}

	proxyClientLock.Lock()
	cache := proxyClients
	if stream {
		cache = streamProxyClients
	}
	if client, ok := cache[proxyURL]; ok {
		proxyClientLock.Unlock()
		return client, nil
	}
	proxyClientLock.Unlock()

	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}

	switch parsedURL.Scheme {
	case "http", "https":
		transport := &http.Transport{
			MaxIdleConns:        common.RelayMaxIdleConns,
			MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
			IdleConnTimeout:     time.Duration(common.RelayIdleConnTimeout) * time.Second,
			ForceAttemptHTTP2:   true,
			Proxy:               http.ProxyURL(parsedURL),
		}
		if common.TLSInsecureSkipVerify {
			transport.TLSClientConfig = common.InsecureTLSConfig
		}
		var client *http.Client
		if stream {
			client = newStreamingHTTPClient(transport)
		} else {
			client = newHTTPClient(transport, time.Duration(common.RelayTimeout)*time.Second)
		}
		proxyClientLock.Lock()
		if stream {
			streamProxyClients[proxyURL] = client
		} else {
			proxyClients[proxyURL] = client
		}
		proxyClientLock.Unlock()
		return client, nil

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
		var forward proxy.Dialer = proxy.Direct
		if stream {
			forward = &net.Dialer{
				Timeout:   streamingResponseHeaderTimeout(),
				KeepAlive: 30 * time.Second,
			}
		}
		dialer, err := proxy.SOCKS5("tcp", parsedURL.Host, auth, forward)
		if err != nil {
			return nil, err
		}

		transport := &http.Transport{
			MaxIdleConns:        common.RelayMaxIdleConns,
			MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
			IdleConnTimeout:     time.Duration(common.RelayIdleConnTimeout) * time.Second,
			ForceAttemptHTTP2:   true,
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return dialer.Dial(network, addr)
			},
		}
		if common.TLSInsecureSkipVerify {
			transport.TLSClientConfig = common.InsecureTLSConfig
		}

		var client *http.Client
		if stream {
			client = newStreamingHTTPClient(transport)
		} else {
			client = newHTTPClient(transport, time.Duration(common.RelayTimeout)*time.Second)
		}
		proxyClientLock.Lock()
		if stream {
			streamProxyClients[proxyURL] = client
		} else {
			proxyClients[proxyURL] = client
		}
		proxyClientLock.Unlock()
		return client, nil

	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}
}
