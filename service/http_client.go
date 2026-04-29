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
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"golang.org/x/net/proxy"
)

type RelayHTTPClientPolicy struct {
	RequestTimeout        time.Duration
	ResponseHeaderTimeout time.Duration
}

type relayHTTPClientCacheKey struct {
	ProxyURL                   string
	RequestTimeoutNanos        int64
	ResponseHeaderTimeoutNanos int64
}

var (
	httpClient      *http.Client
	proxyClientLock sync.Mutex
	proxyClients    = make(map[relayHTTPClientCacheKey]*http.Client)
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
	client, err := newRelayHTTPClient("", getDefaultRelayHTTPClientPolicy())
	if err != nil {
		common.FatalLog("failed to initialize http client: " + err.Error())
	}
	httpClient = client
}

func GetHttpClient() *http.Client {
	return httpClient
}

// GetHttpClientWithProxy returns the default client or a proxy-enabled one when proxyURL is provided.
func GetHttpClientWithProxy(proxyURL string) (*http.Client, error) {
	return GetRelayHttpClientWithPolicy(proxyURL, getDefaultRelayHTTPClientPolicy())
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
	proxyClients = make(map[relayHTTPClientCacheKey]*http.Client)
}

// NewProxyHttpClient 创建支持代理的 HTTP 客户端
func NewProxyHttpClient(proxyURL string) (*http.Client, error) {
	return GetRelayHttpClientWithPolicy(proxyURL, getDefaultRelayHTTPClientPolicy())
}

func ResolveRelayHTTPClientPolicy(channelSettings dto.ChannelSettings, isStream bool) RelayHTTPClientPolicy {
	policy := RelayHTTPClientPolicy{}
	if isStream {
		policy.RequestTimeout = 0
	} else if requestTimeout, ok := channelSettings.ResolveRequestTimeoutOverride(false); ok {
		policy.RequestTimeout = requestTimeout
	}
	if responseHeaderTimeout, ok := channelSettings.ResolveResponseHeaderTimeoutOverride(isStream); ok {
		policy.ResponseHeaderTimeout = responseHeaderTimeout
	}
	return policy
}

func GetRelayHttpClientWithPolicy(proxyURL string, policy RelayHTTPClientPolicy) (*http.Client, error) {
	if proxyURL == "" && isDefaultRelayHTTPClientPolicy(policy) {
		if client := GetHttpClient(); client != nil {
			return client, nil
		}
		return http.DefaultClient, nil
	}

	cacheKey := relayHTTPClientCacheKey{
		ProxyURL:                   proxyURL,
		RequestTimeoutNanos:        int64(policy.RequestTimeout),
		ResponseHeaderTimeoutNanos: int64(policy.ResponseHeaderTimeout),
	}

	proxyClientLock.Lock()
	if client, ok := proxyClients[cacheKey]; ok {
		proxyClientLock.Unlock()
		return client, nil
	}
	proxyClientLock.Unlock()

	client, err := newRelayHTTPClient(proxyURL, policy)
	if err != nil {
		return nil, err
	}

	proxyClientLock.Lock()
	proxyClients[cacheKey] = client
	proxyClientLock.Unlock()
	return client, nil
}

func getDefaultRelayHTTPClientPolicy() RelayHTTPClientPolicy {
	policy := RelayHTTPClientPolicy{}
	if common.RelayTimeout > 0 {
		policy.RequestTimeout = time.Duration(common.RelayTimeout) * time.Second
	}
	return policy
}

func isDefaultRelayHTTPClientPolicy(policy RelayHTTPClientPolicy) bool {
	defaultPolicy := getDefaultRelayHTTPClientPolicy()
	return policy.RequestTimeout == defaultPolicy.RequestTimeout &&
		policy.ResponseHeaderTimeout == defaultPolicy.ResponseHeaderTimeout
}

func newRelayHTTPClient(proxyURL string, policy RelayHTTPClientPolicy) (*http.Client, error) {
	transport, err := newRelayHTTPTransport(proxyURL, policy.ResponseHeaderTimeout)
	if err != nil {
		return nil, err
	}
	client := &http.Client{
		Transport:     transport,
		CheckRedirect: checkRedirect,
	}
	client.Timeout = policy.RequestTimeout
	return client, nil
}

func newRelayHTTPTransport(proxyURL string, responseHeaderTimeout time.Duration) (*http.Transport, error) {
	transport := &http.Transport{
		MaxIdleConns:          common.RelayMaxIdleConns,
		MaxIdleConnsPerHost:   common.RelayMaxIdleConnsPerHost,
		ForceAttemptHTTP2:     true,
		ResponseHeaderTimeout: responseHeaderTimeout,
	}
	if common.TLSInsecureSkipVerify {
		transport.TLSClientConfig = common.InsecureTLSConfig
	}

	if proxyURL == "" {
		transport.Proxy = http.ProxyFromEnvironment
		return transport, nil
	}

	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}

	switch parsedURL.Scheme {
	case "http", "https":
		transport.Proxy = http.ProxyURL(parsedURL)
		return transport, nil
	case "socks5", "socks5h":
		var auth *proxy.Auth
		if parsedURL.User != nil {
			auth = &proxy.Auth{
				User: parsedURL.User.Username(),
			}
			if password, ok := parsedURL.User.Password(); ok {
				auth.Password = password
			}
		}

		dialer, err := proxy.SOCKS5("tcp", parsedURL.Host, auth, proxy.Direct)
		if err != nil {
			return nil, err
		}
		transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
			return dialer.Dial(network, addr)
		}
		return transport, nil
	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}
}
