package service

import (
	"bufio"
	"context"
	"crypto/sha256"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"

	utls "github.com/refraction-networking/utls"
	"golang.org/x/net/proxy"
)

type httpClientOptions struct {
	ProxyURL       string
	TLSFingerprint string
	TLSCustom      string
}

var (
	httpClient         *http.Client
	proxyClientLock    sync.Mutex
	proxyClients       = make(map[string]*http.Client)
	defaultNetDialer   = &net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second}
	defaultALPNProtos  = []string{"h2", "http/1.1"}
	defaultClientLabel = "__default__"
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
	client, err := buildClassicClient(httpClientOptions{})
	if err != nil {
		common.SysError("failed to init default http client: " + err.Error())
		httpClient = &http.Client{CheckRedirect: checkRedirect}
		applyRelayTimeout(httpClient)
		return
	}
	httpClient = client
}

func GetHttpClient() *http.Client {
	options, err := normalizeHTTPClientOptions(httpClientOptions{})
	if err == nil && options.TLSFingerprint != "" {
		client, err := getHTTPClientByOptions(options)
		if err == nil && client != nil {
			return client
		}
		if err != nil {
			common.SysError("failed to build default tls fingerprint client: " + err.Error())
		}
	}
	return httpClient
}

func GetHttpClientWithChannelSetting(channelSetting dto.ChannelSettings) (*http.Client, error) {
	options, err := normalizeHTTPClientOptions(httpClientOptions{
		ProxyURL:       strings.TrimSpace(channelSetting.Proxy),
		TLSFingerprint: channelSetting.TLSFingerprint,
		TLSCustom:      channelSetting.TLSCustom,
	})
	if err != nil {
		return nil, err
	}
	return getHTTPClientByOptions(options)
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

func getHTTPClientByOptions(options httpClientOptions) (*http.Client, error) {
	if options.ProxyURL == "" && options.TLSFingerprint == "" {
		if client := GetHttpClient(); client != nil {
			return client, nil
		}
		return http.DefaultClient, nil
	}

	cacheKey := buildHTTPClientCacheKey(options)

	proxyClientLock.Lock()
	if client, ok := proxyClients[cacheKey]; ok {
		proxyClientLock.Unlock()
		return client, nil
	}
	proxyClientLock.Unlock()

	client, err := buildHTTPClientByOptions(options)
	if err != nil {
		return nil, err
	}

	proxyClientLock.Lock()
	proxyClients[cacheKey] = client
	proxyClientLock.Unlock()
	return client, nil
}

func buildHTTPClientByOptions(options httpClientOptions) (*http.Client, error) {
	if options.TLSFingerprint == "" {
		return buildClassicClient(options)
	}
	return buildUTLSClient(options)
}

func buildClassicClient(options httpClientOptions) (*http.Client, error) {
	proxyURL := strings.TrimSpace(options.ProxyURL)
	if proxyURL == "" {
		transport := &http.Transport{
			MaxIdleConns:        common.RelayMaxIdleConns,
			MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
			ForceAttemptHTTP2:   true,
			Proxy:               http.ProxyFromEnvironment,
		}
		if common.TLSInsecureSkipVerify {
			transport.TLSClientConfig = common.InsecureTLSConfig
		}
		client := &http.Client{
			Transport:     transport,
			CheckRedirect: checkRedirect,
		}
		applyRelayTimeout(client)
		return client, nil
	}

	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}

	switch strings.ToLower(parsedURL.Scheme) {
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
		applyRelayTimeout(client)
		return client, nil

	case "socks5", "socks5h":
		dialContext, err := buildSOCKS5DialContext(parsedURL)
		if err != nil {
			return nil, err
		}
		transport := &http.Transport{
			MaxIdleConns:        common.RelayMaxIdleConns,
			MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
			ForceAttemptHTTP2:   true,
			DialContext:         dialContext,
		}
		if common.TLSInsecureSkipVerify {
			transport.TLSClientConfig = common.InsecureTLSConfig
		}
		client := &http.Client{
			Transport:     transport,
			CheckRedirect: checkRedirect,
		}
		applyRelayTimeout(client)
		return client, nil
	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}
}

func buildUTLSClient(options httpClientOptions) (*http.Client, error) {
	dialContext, err := buildDialContext(options.ProxyURL)
	if err != nil {
		return nil, err
	}
	dialTLSContext, err := buildUTLSDialTLSContext(dialContext, options)
	if err != nil {
		return nil, err
	}

	transport := &http.Transport{
		MaxIdleConns:        common.RelayMaxIdleConns,
		MaxIdleConnsPerHost: common.RelayMaxIdleConnsPerHost,
		ForceAttemptHTTP2:   true,
		DialContext:         dialContext,
		DialTLSContext:      dialTLSContext,
	}
	client := &http.Client{
		Transport:     transport,
		CheckRedirect: checkRedirect,
	}
	applyRelayTimeout(client)
	return client, nil
}

func buildDialContext(proxyURL string) (func(context.Context, string, string) (net.Conn, error), error) {
	proxyURL = strings.TrimSpace(proxyURL)
	if proxyURL == "" {
		return defaultNetDialer.DialContext, nil
	}

	parsedURL, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}

	switch strings.ToLower(parsedURL.Scheme) {
	case "socks5", "socks5h":
		return buildSOCKS5DialContext(parsedURL)
	case "http", "https":
		return buildHTTPConnectDialContext(parsedURL)
	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s, must be http, https, socks5 or socks5h", parsedURL.Scheme)
	}
}

func buildSOCKS5DialContext(parsedURL *url.URL) (func(context.Context, string, string) (net.Conn, error), error) {
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
	if contextDialer, ok := dialer.(proxy.ContextDialer); ok {
		return contextDialer.DialContext, nil
	}
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		return dialer.Dial(network, addr)
	}, nil
}

func buildHTTPConnectDialContext(proxyURL *url.URL) (func(context.Context, string, string) (net.Conn, error), error) {
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		conn, err := defaultNetDialer.DialContext(ctx, "tcp", proxyURL.Host)
		if err != nil {
			return nil, err
		}

		if strings.EqualFold(proxyURL.Scheme, "https") {
			tlsConn := tls.Client(conn, &tls.Config{
				ServerName:         hostWithoutPort(proxyURL.Host),
				InsecureSkipVerify: common.TLSInsecureSkipVerify,
			})
			if err := tlsConn.HandshakeContext(ctx); err != nil {
				_ = conn.Close()
				return nil, err
			}
			conn = tlsConn
		}

		connectReq := &http.Request{
			Method: http.MethodConnect,
			URL:    &url.URL{Opaque: addr},
			Host:   addr,
			Header: make(http.Header),
		}
		if proxyURL.User != nil {
			username := proxyURL.User.Username()
			password, _ := proxyURL.User.Password()
			connectReq.Header.Set("Proxy-Authorization", "Basic "+basicAuth(username, password))
		}
		if err := connectReq.Write(conn); err != nil {
			_ = conn.Close()
			return nil, err
		}

		reader := bufio.NewReader(conn)
		resp, err := http.ReadResponse(reader, connectReq)
		if err != nil {
			_ = conn.Close()
			return nil, err
		}
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			_ = conn.Close()
			return nil, fmt.Errorf("proxy connect failed: %s", resp.Status)
		}
		if reader.Buffered() > 0 {
			return &bufferedConn{Conn: conn, reader: reader}, nil
		}
		return conn, nil
	}, nil
}

func buildUTLSDialTLSContext(
	dialContext func(context.Context, string, string) (net.Conn, error),
	options httpClientOptions,
) (func(context.Context, string, string) (net.Conn, error), error) {
	helloID, err := resolveClientHelloID(options.TLSFingerprint)
	if err != nil {
		return nil, err
	}

	var customSpec *utls.ClientHelloSpec
	if options.TLSFingerprint == dto.TLSFingerprintCustom {
		customSpec, err = parseCustomClientHelloSpec(options.TLSCustom)
		if err != nil {
			return nil, err
		}
	}

	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		conn, err := dialContext(ctx, network, addr)
		if err != nil {
			return nil, err
		}

		uconn := utls.UClient(conn, &utls.Config{
			ServerName:         hostWithoutPort(addr),
			InsecureSkipVerify: common.TLSInsecureSkipVerify,
			NextProtos:         defaultALPNProtos,
		}, helloID)
		if customSpec != nil {
			if err := uconn.ApplyPreset(customSpec); err != nil {
				_ = conn.Close()
				return nil, err
			}
		}
		if err := uconn.HandshakeContext(ctx); err != nil {
			_ = conn.Close()
			return nil, err
		}
		return uconn, nil
	}, nil
}

func resolveClientHelloID(profile string) (utls.ClientHelloID, error) {
	switch profile {
	case dto.TLSFingerprintChrome:
		return utls.HelloChrome_Auto, nil
	case dto.TLSFingerprintFirefox:
		return utls.HelloFirefox_Auto, nil
	case dto.TLSFingerprintSafari:
		return utls.HelloSafari_Auto, nil
	case dto.TLSFingerprintEdge:
		return utls.HelloEdge_Auto, nil
	case dto.TLSFingerprintCustom:
		return utls.HelloCustom, nil
	default:
		return utls.ClientHelloID{}, fmt.Errorf("unsupported tls fingerprint: %s", profile)
	}
}

func parseCustomClientHelloSpec(custom string) (*utls.ClientHelloSpec, error) {
	raw := strings.TrimSpace(custom)
	if raw == "" {
		return nil, fmt.Errorf("tls_custom is required when tls_fingerprint is custom")
	}
	spec := &utls.ClientHelloSpec{}
	if err := spec.UnmarshalJSON([]byte(raw)); err != nil {
		return nil, fmt.Errorf("invalid tls_custom: %w", err)
	}
	if len(spec.CipherSuites) == 0 {
		return nil, fmt.Errorf("invalid tls_custom: cipher_suites cannot be empty")
	}
	if len(spec.Extensions) == 0 {
		return nil, fmt.Errorf("invalid tls_custom: extensions cannot be empty")
	}
	if len(spec.CompressionMethods) == 0 {
		spec.CompressionMethods = []uint8{0}
	}
	return spec, nil
}

func normalizeHTTPClientOptions(options httpClientOptions) (httpClientOptions, error) {
	options.ProxyURL = strings.TrimSpace(options.ProxyURL)
	options.TLSFingerprint = dto.NormalizeTLSFingerprint(options.TLSFingerprint)
	options.TLSCustom = strings.TrimSpace(options.TLSCustom)

	if !dto.IsValidTLSFingerprint(options.TLSFingerprint) {
		return options, fmt.Errorf("invalid tls_fingerprint: %s", options.TLSFingerprint)
	}

	if options.TLSFingerprint == dto.TLSFingerprintDefault {
		proxySetting := system_setting.GetProxySetting()
		defaultFingerprint := dto.NormalizeTLSFingerprint(proxySetting.DefaultTLSFingerprint)
		if !dto.IsValidTLSFingerprint(defaultFingerprint) {
			return options, fmt.Errorf("invalid default tls fingerprint: %s", proxySetting.DefaultTLSFingerprint)
		}
		options.TLSFingerprint = defaultFingerprint
		if options.TLSFingerprint == dto.TLSFingerprintCustom {
			options.TLSCustom = strings.TrimSpace(proxySetting.DefaultTLSCustom)
		}
	}

	if options.TLSFingerprint != dto.TLSFingerprintCustom {
		options.TLSCustom = ""
	}
	return options, nil
}

func buildHTTPClientCacheKey(options httpClientOptions) string {
	if options.ProxyURL == "" && options.TLSFingerprint == "" {
		return defaultClientLabel
	}
	customHash := "-"
	if options.TLSCustom != "" {
		sum := sha256.Sum256([]byte(options.TLSCustom))
		customHash = hex.EncodeToString(sum[:8])
	}
	return fmt.Sprintf("%s|%s|%s", options.ProxyURL, options.TLSFingerprint, customHash)
}

func applyRelayTimeout(client *http.Client) {
	if common.RelayTimeout > 0 {
		client.Timeout = time.Duration(common.RelayTimeout) * time.Second
	}
}

func hostWithoutPort(addr string) string {
	host, _, err := net.SplitHostPort(addr)
	if err == nil {
		return host
	}
	return addr
}

func basicAuth(username, password string) string {
	auth := username + ":" + password
	return base64.StdEncoding.EncodeToString([]byte(auth))
}

type bufferedConn struct {
	net.Conn
	reader *bufio.Reader
}

func (c *bufferedConn) Read(p []byte) (int, error) {
	return c.reader.Read(p)
}
