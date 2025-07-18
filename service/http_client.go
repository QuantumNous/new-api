package service

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"

	"one-api/common"
	"one-api/util"

	"golang.org/x/net/proxy"
)

var httpClient *http.Client

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
	client, err := getHttpClient("")
	// 2025-07-17 兼容模式，当获取不到 httpClient 时，使用默认业务逻辑返回的 httpClient
	if err == nil {
		return client
	}

	return httpClient
}

func getHttpClient(proxyURL string) (client *http.Client, err error) {
	return util.GetHttpClient(proxyURL)
}

// NewProxyHttpClient 创建支持代理的 HTTP 客户端
func NewProxyHttpClient(proxyURL string) (*http.Client, error) {
	client, err := getHttpClient(proxyURL)
	// 2025-07-17 兼容模式，当获取不到 httpClient 时，使用默认业务逻辑返回的 httpClient
	if err == nil {
		return client, err
	}

	if proxyURL == "" {
		return http.DefaultClient, nil
	}

	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}

	switch parsedURL.Scheme {
	case "http", "https":
		return &http.Client{
			Transport: &http.Transport{
				Proxy: http.ProxyURL(parsedURL),
			},
		}, nil

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

		return &http.Client{
			Transport: &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return dialer.Dial(network, addr)
				},
			},
		}, nil

	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s", parsedURL.Scheme)
	}
}
