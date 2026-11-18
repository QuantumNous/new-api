package service

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"golang.org/x/net/proxy"
)

// channelProtectedClients holds the clients ChannelHTTPClient builds for
// supplier channels, apart from proxyClients but under the same keys: the
// proxy URL and the transport policy, never a request target.
var channelProtectedClients = proxyHTTPClientCache{
	clients: make(map[string]*http.Client),
	aliases: make(map[string]string),
}

// errChannelFetchBlocked is the error of a supplier channel's request when
// fetch_setting refuses an address the request would reach.
var errChannelFetchBlocked = errors.New("outbound request blocked by the server's fetch policy")

// channelFetchBlocked logs reason, why fetch_setting refuses an address a
// supplier channel's request would reach, and returns errChannelFetchBlocked.
// The reason can name an address the server resolved, so the error keeps it
// from a channel supplier, who could otherwise map internal names through the
// server's resolver.
func channelFetchBlocked(ctx context.Context, reason error) error {
	logger.LogWarn(ctx, common.LogText("supplier channel request blocked: %s", reason.Error()))
	return errChannelFetchBlocked
}

// ChannelHTTPClient returns the client for the requests sent for a channel.
// A channel no channel supplier created, and every channel while
// fetch_setting turns SSRF protection off, gets the client of
// GetHttpClientWithProxySettings. A supplier channel gets a client with the
// same proxy and transport policy that checks against fetch_setting the
// target of every request and redirect, the channel proxy, and each address
// it dials. A refusal fails with errChannelFetchBlocked, the client and its
// requests alike.
func ChannelHTTPClient(rawProxyURL string, settings dto.ChannelSettings, supplierChannel bool) (*http.Client, error) {
	if !supplierChannel || !system_setting.GetFetchSetting().EnableSSRFProtection {
		return GetHttpClientWithProxySettings(rawProxyURL, settings)
	}
	// Checked on every call: fetch_setting may have changed since the cached
	// client was built.
	if err := ValidateChannelProxyAddress(rawProxyURL); err != nil {
		return nil, channelFetchBlocked(context.Background(), err)
	}
	policy := NormalizeHTTPTransportPolicy(settings)
	trimmedProxyURL := strings.TrimSpace(rawProxyURL)
	if client, ok := channelProtectedClients.get(trimmedProxyURL, policy); ok {
		return client, nil
	}
	proxyURL, legacySuffixStripped, err := common.ParseProxyURLRuntime(trimmedProxyURL)
	if err != nil {
		return nil, err
	}
	var config *proxyURLConfig
	if proxyURL != nil {
		config = newProxyURLConfig(proxyURL)
		if legacySuffixStripped {
			warnLegacyProxyURLOnce(config)
		}
	}
	return channelProtectedClients.getOrCreate(trimmedProxyURL, config, policy, func() (*http.Client, error) {
		return newChannelProtectedHTTPClient(policy, proxyURL)
	})
}

// ValidateChannelProxyAddress checks the host and port of a channel proxy
// (http, https, socks5 or socks5h) against fetch_setting. An empty proxy
// passes.
func ValidateChannelProxyAddress(rawProxyURL string) error {
	proxyURL, _, err := common.ParseProxyURLRuntime(rawProxyURL)
	if err != nil || proxyURL == nil {
		return err
	}
	// net/http dials an http or https proxy without a port at the port of its
	// scheme; the parser gives a SOCKS proxy without one port 1080.
	port := proxyURL.Port()
	if port == "" && proxyURL.Scheme == "https" {
		port = "443"
	} else if port == "" {
		port = "80"
	}
	// fetch_setting looks only at the host and port, which an http URL of the
	// proxy's address carries.
	return ValidateSSRFProtectedFetchURL("http://" + net.JoinHostPort(proxyURL.Hostname(), port))
}

// newChannelProtectedHTTPClient builds the client of a supplier channel with
// the proxy proxyURL, nil for a channel without one.
func newChannelProtectedHTTPClient(policy HTTPTransportPolicy, proxyURL *url.URL) (*http.Client, error) {
	netDialer := &net.Dialer{Timeout: 30 * time.Second, KeepAlive: 30 * time.Second}
	dialer := &channelFetchDialer{checked: protectedFetchDialer{
		resolver: net.DefaultResolver,
		// A failed connection is marked, so DialContext tells it apart from
		// a refusal.
		dialContext: func(ctx context.Context, network, address string) (net.Conn, error) {
			conn, err := netDialer.DialContext(ctx, network, address)
			if err != nil {
				return nil, dialFailure{err}
			}
			return conn, nil
		},
		getProtection: currentFetchProtection,
	}}
	// newTransport sets a relay transport up with the channel's TLS setting,
	// the proxy of proxyFunc, and dialContext when it is not nil.
	newTransport := func(proxyFunc func(*http.Request) (*url.URL, error), dialContext func(context.Context, string, string) (net.Conn, error)) func() *http.Transport {
		return func() *http.Transport {
			transport := newRelayHTTPTransport()
			transport.Proxy = proxyFunc
			if dialContext != nil {
				transport.DialContext = dialContext
			}
			if policy.TLSInsecureSkipVerify {
				transport.TLSClientConfig = common.InsecureTLSConfig.Clone()
			}
			return transport
		}
	}

	roundTripper := &channelProtectedRoundTripper{}
	switch {
	case proxyURL == nil:
		roundTripper.checked = newPolicyRoundTripper(policy, newTransport(nil, dialer.DialContext))
		roundTripper.viaEnvironmentProxy = newPolicyRoundTripper(policy, newTransport(http.ProxyFromEnvironment, nil))
	case proxyURL.Scheme == "http" || proxyURL.Scheme == "https":
		// The transport dials the proxy, not the target, with the dialer.
		roundTripper.checked = newPolicyRoundTripper(policy, newTransport(http.ProxyURL(proxyURL), dialer.DialContext))
	case proxyURL.Scheme == "socks5" || proxyURL.Scheme == "socks5h":
		// The SOCKS dialer reaches the proxy through the dialer; the proxy
		// resolves and connects to the target.
		socksDialer, err := proxy.FromURL(proxyURL, dialer)
		if err != nil {
			return nil, err
		}
		contextDialer, ok := socksDialer.(proxy.ContextDialer)
		if !ok {
			return nil, fmt.Errorf("SOCKS proxy dialer does not support context cancellation")
		}
		roundTripper.checked = newPolicyRoundTripper(policy, newTransport(nil, contextDialer.DialContext))
	default:
		return nil, fmt.Errorf("unsupported proxy scheme")
	}
	client := newRelayHTTPClient(roundTripper)
	client.CheckRedirect = checkChannelRedirect
	return client, nil
}

// checkChannelRedirect checks a redirect of a supplier channel's request as
// checkProtectedFetchRedirect does, a refused target failing with
// errChannelFetchBlocked.
func checkChannelRedirect(req *http.Request, via []*http.Request) error {
	if err := ValidateSSRFProtectedFetchURL(req.URL.String()); err != nil {
		return channelFetchBlocked(req.Context(), err)
	}
	if len(via) >= 10 {
		return fmt.Errorf("stopped after 10 redirects")
	}
	return nil
}

// channelProtectedRoundTripper sends the requests of a supplier channel after
// checking each target against fetch_setting. checked sends through the
// channel proxy, or straight to the target, and connects only to addresses
// fetch_setting allows. For a channel without a proxy, viaEnvironmentProxy
// sends the requests the operator's environment proxy carries, trusting that
// proxy as GetSSRFProtectedHTTPClient does.
type channelProtectedRoundTripper struct {
	checked             http.RoundTripper
	viaEnvironmentProxy http.RoundTripper
}

func (t *channelProtectedRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	if req == nil || req.URL == nil {
		return nil, fmt.Errorf("invalid request")
	}
	targets := []string{req.URL.String()}
	// Through an HTTP proxy, a plain http request names its target by the
	// Host header, which a channel's header override can set.
	if req.Host != "" && req.Host != req.URL.Host {
		targets = append(targets, req.URL.Scheme+"://"+req.Host+"/")
	}
	for _, target := range targets {
		if err := ValidateSSRFProtectedFetchURL(target); err != nil {
			if req.Body != nil {
				_ = req.Body.Close()
			}
			return nil, channelFetchBlocked(req.Context(), err)
		}
	}
	if t.viaEnvironmentProxy != nil {
		// That transport also reports a malformed environment proxy.
		if environmentProxy, err := http.ProxyFromEnvironment(req); err != nil || environmentProxy != nil {
			return t.viaEnvironmentProxy.RoundTrip(req)
		}
	}
	return t.checked.RoundTrip(req)
}

func (t *channelProtectedRoundTripper) CloseIdleConnections() {
	closeIdleConnections(t.checked)
	if t.viaEnvironmentProxy != nil {
		closeIdleConnections(t.viaEnvironmentProxy)
	}
}

// channelFetchDialer dials for a supplier channel through the checks of
// protectedFetchDialer. An address fetch_setting refuses fails with
// errChannelFetchBlocked; a connection that fails keeps its own error.
type channelFetchDialer struct {
	checked protectedFetchDialer
}

// dialFailure is the error of a connection attempt of channelFetchDialer.
type dialFailure struct{ error }

func (d *channelFetchDialer) DialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	conn, err := d.checked.DialContext(ctx, network, addr)
	var failure dialFailure
	switch {
	case err == nil:
		return conn, nil
	case errors.As(err, &failure):
		return nil, failure.error
	default:
		return nil, channelFetchBlocked(ctx, err)
	}
}

// Dial makes channelFetchDialer a proxy.Dialer, through which the SOCKS
// dialer of a channel proxy reaches the proxy; that dialer calls DialContext
// instead when it can.
func (d *channelFetchDialer) Dial(network, addr string) (net.Conn, error) {
	return d.DialContext(context.Background(), network, addr)
}
