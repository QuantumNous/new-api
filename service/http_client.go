package service

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"one-api/common"
	"sync"
	"time"

	"golang.org/x/net/proxy"
)

var (
	httpClient      *http.Client
	proxyClientLock sync.Mutex
	proxyClients    = make(map[string]*http.Client)
)

func InitHttpClient() {
	if common.RelayTimeout == 0 {
		httpClient = &http.Client{}
	} else {
		httpClient = &http.Client{
			Timeout: time.Duration(common.RelayTimeout) * time.Second,
		}
	}
}

func GetHttpClient() *http.Client {
	return httpClient
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
func NewProxyHttpClient(proxyURL string) (*http.Client, error) {
	if proxyURL == "" {
		return http.DefaultClient, nil
	}

	proxyClientLock.Lock()
	if client, ok := proxyClients[proxyURL]; ok {
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
		client := &http.Client{
			Transport: &http.Transport{
				Proxy: http.ProxyURL(parsedURL),
			},
		}
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
		proxyClientLock.Lock()
		proxyClients[proxyURL] = client
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

		client := &http.Client{
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return dialer.Dial(network, addr)
				},
			},
		}
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
		proxyClientLock.Lock()
		proxyClients[proxyURL] = client
		proxyClientLock.Unlock()
		return client, nil

	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}
}
