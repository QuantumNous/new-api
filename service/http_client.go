package service

import (
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"golang.org/x/net/http2"
	"golang.org/x/net/proxy"
)

const (
	upstreamIdleConnTimeout   = 90 * time.Second
	upstreamH2ReadIdleTimeout = 15 * time.Second
	upstreamH2PingTimeout     = 5 * time.Second
)

var (
	httpClient      *http.Client
	httpClientH1    *http.Client
	proxyClientLock sync.Mutex
	proxyClients    = make(map[string]*http.Client)
	proxyClientsH1  = make(map[string]*http.Client)
)

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

func InitHttpClient() {
	transport, _, _ := buildUpstreamTransport(http.ProxyFromEnvironment, nil)
	httpClient = buildUpstreamHTTPClient(transport)

	h1Transport := buildUpstreamTransportHTTP1Only(http.ProxyFromEnvironment, nil)
	httpClientH1 = buildUpstreamHTTPClient(h1Transport)
}

func buildUpstreamTLSConfig() *tls.Config {
	tlsConf := &tls.Config{
		ClientSessionCache: tls.NewLRUClientSessionCache(0),
	}
	if common.TLSInsecureSkipVerify {
		tlsConf.InsecureSkipVerify = true
	}
	return tlsConf
}

func buildUpstreamTransport(proxyFunc func(*http.Request) (*url.URL, error), dialContext func(context.Context, string, string) (net.Conn, error)) (*http.Transport, *http2.Transport, error) {
	idleConnTimeout := upstreamIdleConnTimeout
	if common.RelayIdleConnTimeout > 0 {
		idleConnTimeout = time.Duration(common.RelayIdleConnTimeout) * time.Second
	}
	transport := &http.Transport{
		MaxIdleConns:        common.RelayMaxIdleConns,
		MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
		ForceAttemptHTTP2:   true,
		Proxy:               proxyFunc,
		DialContext:         dialContext,
		IdleConnTimeout:     idleConnTimeout,
		TLSClientConfig:     buildUpstreamTLSConfig(),
	}
	h2t, err := enableUpstreamH2Keepalive(transport)
	return transport, h2t, err
}

func buildUpstreamTransportHTTP1Only(proxyFunc func(*http.Request) (*url.URL, error), dialContext func(context.Context, string, string) (net.Conn, error)) *http.Transport {
	idleConnTimeout := upstreamIdleConnTimeout
	if common.RelayIdleConnTimeout > 0 {
		idleConnTimeout = time.Duration(common.RelayIdleConnTimeout) * time.Second
	}
	tlsConf := buildUpstreamTLSConfig()
	tlsConf.NextProtos = []string{"http/1.1"}
	return &http.Transport{
		MaxIdleConns:        common.RelayMaxIdleConns,
		MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
		ForceAttemptHTTP2:   false,
		Proxy:               proxyFunc,
		DialContext:         dialContext,
		IdleConnTimeout:     idleConnTimeout,
		TLSClientConfig:     tlsConf,
	}
}

func enableUpstreamH2Keepalive(transport *http.Transport) (*http2.Transport, error) {
	h2t, err := http2.ConfigureTransports(transport)
	if err != nil {
		common.SysError("upstream keepalive: ConfigureTransports failed: " + err.Error())
		return nil, err
	}
	h2t.ReadIdleTimeout = upstreamH2ReadIdleTimeout
	h2t.PingTimeout = upstreamH2PingTimeout
	return h2t, nil
}

func buildUpstreamHTTPClient(transport *http.Transport) *http.Client {
	client := &http.Client{
		Transport:     transport,
		CheckRedirect: checkRedirect,
	}
	if common.RelayTimeout != 0 {
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
	}
	return client
}

func GetHttpClient() *http.Client {
	return httpClient
}

func GetHttpClientHTTP1Only() *http.Client {
	return httpClientH1
}

// GetHttpClientWithProxy returns the default client or a proxy-enabled one when proxyURL is provided.
func GetHttpClientWithProxy(proxyURL string) (*http.Client, error) {
	if proxyURL == "" {
		return GetHttpClient(), nil
	}
	return NewProxyHttpClient(proxyURL)
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
	for _, client := range proxyClientsH1 {
		if transport, ok := client.Transport.(*http.Transport); ok && transport != nil {
			transport.CloseIdleConnections()
		}
	}
	proxyClientsH1 = make(map[string]*http.Client)
}

// NewProxyHttpClient 创建支持代理的 HTTP 客户端
func NewProxyHttpClient(proxyURL string) (*http.Client, error) {
	if proxyURL == "" {
		if client := GetHttpClient(); client != nil {
			return client, nil
		}
		return http.DefaultClient, nil
	}

	proxyClientLock.Lock()
	defer proxyClientLock.Unlock()
	if client, ok := proxyClients[proxyURL]; ok {
		return client, nil
	}

	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}

	switch parsedURL.Scheme {
	case "http", "https":
		transport, _, err := buildUpstreamTransport(http.ProxyURL(parsedURL), nil)
		if err != nil {
			return nil, err
		}
		client := buildUpstreamHTTPClient(transport)
		proxyClients[proxyURL] = client
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

		transport, _, err := buildUpstreamTransport(nil, func(ctx context.Context, network, addr string) (net.Conn, error) {
			return dialer.Dial(network, addr)
		})
		if err != nil {
			return nil, err
		}
		client := buildUpstreamHTTPClient(transport)
		proxyClients[proxyURL] = client
		return client, nil

	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}
}

// NewProxyHttpClientHTTP1Only 创建强制 HTTP/1.1 + 支持代理的 HTTP 客户端
func NewProxyHttpClientHTTP1Only(proxyURL string) (*http.Client, error) {
	if proxyURL == "" {
		return GetHttpClientHTTP1Only(), nil
	}

	proxyClientLock.Lock()
	defer proxyClientLock.Unlock()
	if client, ok := proxyClientsH1[proxyURL]; ok {
		return client, nil
	}

	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}

	var transport *http.Transport
	switch parsedURL.Scheme {
	case "http", "https":
		transport = buildUpstreamTransportHTTP1Only(http.ProxyURL(parsedURL), nil)

	case "socks5", "socks5h":
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
		dialer, err := proxy.SOCKS5("tcp", parsedURL.Host, auth, proxy.Direct)
		if err != nil {
			return nil, err
		}
		transport = buildUpstreamTransportHTTP1Only(nil, func(ctx context.Context, network, addr string) (net.Conn, error) {
			return dialer.Dial(network, addr)
		})

	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}

	client := buildUpstreamHTTPClient(transport)
	proxyClientsH1[proxyURL] = client
	return client, nil
}
