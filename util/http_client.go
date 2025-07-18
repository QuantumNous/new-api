package util

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"one-api/common"

	"golang.org/x/net/proxy"
)

const (
	KeyOfMaxIdleConnsPerHost = "MAX_IDLE_CONNS_PER_HOST"
	KeyOfMaxIdleConns        = "MAX_IDLE_CONNS"
	KeyOfIdleConnTimeout     = "IDLE_CONN_TIMEOUT"
)

var (
	innerHttpClients sync.Map

	defaultMaxIdleConnsPerHost = 10
	defaultMaxIdleConns        = 100
	defaultIdleConnTimeout     = 60
)

func GetHttpClient(proxyURL string) (*http.Client, error) {
	var err error
	var parsedURL *url.URL
	if proxyURL != "" {
		parsedURL, err = url.Parse(proxyURL)
		if err != nil {
			return nil, err
		}
	}

	if client, ok := innerHttpClients.Load(proxyURL); ok {
		return client.(*http.Client), nil
	}

	var maxIdleConns = common.GetEnvOrDefault(KeyOfMaxIdleConns, defaultMaxIdleConns)
	var maxIdleConnsPerHost = common.GetEnvOrDefault(KeyOfMaxIdleConnsPerHost, defaultMaxIdleConnsPerHost)
	var idleConnTimeout = time.Duration(common.GetEnvOrDefault(KeyOfIdleConnTimeout, defaultIdleConnTimeout)) * time.Second

	var transport *http.Transport
	if proxyURL != "" {
		switch parsedURL.Scheme {
		case "http", "https":
			transport = &http.Transport{
				Proxy:               http.ProxyURL(parsedURL),
				MaxIdleConns:        maxIdleConns,
				MaxIdleConnsPerHost: maxIdleConnsPerHost,
				IdleConnTimeout:     idleConnTimeout,
			}

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

			transport = &http.Transport{
				DialContext: func(ctx context.Context, network, addr string) (net.Conn, error) {
					return dialer.Dial(network, addr)
				},
				MaxIdleConns:        maxIdleConns,
				MaxIdleConnsPerHost: maxIdleConnsPerHost,
				IdleConnTimeout:     idleConnTimeout,
			}
		default:
			return nil, fmt.Errorf("unsupported proxy scheme: %s", parsedURL.Scheme)
		}
	} else {
		transport = &http.Transport{
			MaxIdleConns:        maxIdleConns,
			MaxIdleConnsPerHost: maxIdleConnsPerHost,
			IdleConnTimeout:     idleConnTimeout,
		}
	}

	var tmpClient *http.Client
	if common.RelayTimeout > 0 {
		tmpClient = &http.Client{
			Transport: transport,
			Timeout:   time.Duration(common.RelayTimeout) * time.Second,
		}
	} else {
		tmpClient = &http.Client{
			Transport: transport,
		}
	}

	innerHttpClients.Store(proxyURL, tmpClient)
	return tmpClient, nil
}
