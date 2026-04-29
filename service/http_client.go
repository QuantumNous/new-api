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
	"github.com/QuantumNous/new-api/setting/system_setting"

	"golang.org/x/net/proxy"
)

var (
	httpClient        *http.Client
	trustedHTTPClient *http.Client
	proxyClientLock   sync.Mutex
	proxyClients      = make(map[string]*http.Client)
)

type httpClientOptions struct {
	trustedRedirects bool
}

// HTTPClientOption customizes shared HTTP client selection.
type HTTPClientOption func(*httpClientOptions)

// WithTrustedRedirects returns a client that follows redirects without fetch protection.
func WithTrustedRedirects() HTTPClientOption {
	return func(options *httpClientOptions) {
		options.trustedRedirects = true
	}
}

func getHTTPClientOptions(options []HTTPClientOption) httpClientOptions {
	opts := httpClientOptions{}
	for _, option := range options {
		if option != nil {
			option(&opts)
		}
	}
	return opts
}

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

func newBaseHTTPTransport() *http.Transport {
	transport := &http.Transport{
		MaxIdleConns:        common.RelayMaxIdleConns,
		MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
		ForceAttemptHTTP2:   true,
		Proxy:               http.ProxyFromEnvironment, // Support HTTP_PROXY, HTTPS_PROXY, NO_PROXY env vars
	}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig
	}
	return transport
}

func newHTTPClient(transport http.RoundTripper, checkRedirect func(*http.Request, []*http.Request) error) *http.Client {
	client := &http.Client{
		Transport:     transport,
		CheckRedirect: checkRedirect,
	}
	if common.RelayTimeout != 0 {
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
	}
	return client
}

func InitHttpClient() {
	httpClient = newHTTPClient(newBaseHTTPTransport(), checkRedirect)
	trustedHTTPClient = newHTTPClient(newBaseHTTPTransport(), nil)
}

func GetHttpClient(options ...HTTPClientOption) *http.Client {
	opts := getHTTPClientOptions(options)
	if opts.trustedRedirects {
		return trustedHTTPClient
	}
	return httpClient
}

// GetHttpClientWithProxy returns the default client or a proxy-enabled one when proxyURL is provided.
func GetHttpClientWithProxy(proxyURL string, options ...HTTPClientOption) (*http.Client, error) {
	if proxyURL == "" {
		return GetHttpClient(options...), nil
	}
	return NewProxyHttpClient(proxyURL, options...)
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

// NewProxyHttpClient 创建支持代理的 HTTP 客户端
func NewProxyHttpClient(proxyURL string, options ...HTTPClientOption) (*http.Client, error) {
	if proxyURL == "" {
		if client := GetHttpClient(options...); client != nil {
			return client, nil
		}
		return http.DefaultClient, nil
	}

	opts := getHTTPClientOptions(options)
	cacheKey := proxyURL
	if opts.trustedRedirects {
		cacheKey = "trusted-redirects:" + proxyURL
	}

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

	switch parsedURL.Scheme {
	case "http", "https":
		transport := &http.Transport{
			MaxIdleConns:        common.RelayMaxIdleConns,
			MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
			ForceAttemptHTTP2:   true,
			Proxy:               http.ProxyURL(parsedURL),
		}
		if common.TLSInsecureSkipVerify {
			transport.TLSClientConfig = common.InsecureTLSConfig
		}
		client := &http.Client{
			Transport:     transport,
			CheckRedirect: checkRedirect,
		}
		if opts.trustedRedirects {
			client.CheckRedirect = nil
		}
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
		proxyClientLock.Lock()
		proxyClients[cacheKey] = client
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
		dialer, err := proxy.SOCKS5("tcp", parsedURL.Host, auth, proxy.Direct)
		if err != nil {
			return nil, err
		}

		transport := &http.Transport{
			MaxIdleConns:        common.RelayMaxIdleConns,
			MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
			ForceAttemptHTTP2:   true,
			DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
				return dialer.Dial(network, addr)
			},
		}
		if common.TLSInsecureSkipVerify {
			transport.TLSClientConfig = common.InsecureTLSConfig
		}

		client := &http.Client{Transport: transport, CheckRedirect: checkRedirect}
		if opts.trustedRedirects {
			client.CheckRedirect = nil
		}
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
		proxyClientLock.Lock()
		proxyClients[cacheKey] = client
		proxyClientLock.Unlock()
		return client, nil

	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}
}
