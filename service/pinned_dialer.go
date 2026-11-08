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
	"github.com/QuantumNous/new-api/logger"
)

// proxyDialKey marks a request whose connection is established through an HTTP
// proxy. The proxy resolves the target host itself, so the dial time check
// applies to the proxy address instead of the target host.
type proxyDialKey struct{}

// privateNetworkDialWarnings keeps the internal network warnings out of the
// log for every single request while still reporting every target that was
// reached.
var privateNetworkDialWarnings sync.Map

// pinnedDialer resolves the target host when the connection is established and
// connects to the resolved address.
//
// Validating the address that is actually connected to closes the
// time-of-check/time-of-use gap of a name based check: a DNS answer that
// changes between the configuration check and the connection (DNS rebinding)
// cannot move the request to an internal address. The connection is pinned to
// the validated address, so the name is never resolved a second time.
type pinnedDialer struct {
	dialer   *net.Dialer
	resolver ssrfResolver
	// dialContext is the connection function, replaced in tests.
	dialContext func(ctx context.Context, network, address string) (net.Conn, error)
	// allowPrivateNetwork accepts internal addresses. It is only set for
	// channels the root account pointed at an internal upstream.
	allowPrivateNetwork bool
}

func newPinnedDialer(allowPrivateNetwork bool) *pinnedDialer {
	dialer := &net.Dialer{
		Timeout:   30 * time.Second,
		KeepAlive: 30 * time.Second,
	}
	return &pinnedDialer{
		dialer:              dialer,
		dialContext:         dialer.DialContext,
		resolver:            net.DefaultResolver,
		allowPrivateNetwork: allowPrivateNetwork,
	}
}

func (d *pinnedDialer) dial(ctx context.Context, network, address string) (net.Conn, error) {
	if d.dialContext != nil {
		return d.dialContext(ctx, network, address)
	}
	return d.dial(ctx, network, address)
}

func (d *pinnedDialer) DialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, fmt.Errorf("invalid dial address %s: %w", address, err)
	}
	if viaProxy, _ := ctx.Value(proxyDialKey{}).(bool); viaProxy {
		// The proxy performs the name resolution for the target host, so only
		// the proxy address is known here.
		return d.dial(ctx, network, address)
	}
	if ip := net.ParseIP(host); ip != nil {
		// A literal address involves no name resolution and therefore has no
		// rebinding window. Internal literal addresses are governed by the
		// configuration policy, which reserves them for the root account.
		if common.IsPrivateNetworkIP(ip) {
			warnPrivateNetworkTarget(ctx, address)
		}
		return d.dial(ctx, network, address)
	}

	resolved, err := d.resolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("DNS resolution failed for %s: %w", host, err)
	}

	candidateIPs := make([]net.IP, 0, len(resolved))
	for _, ipAddr := range resolved {
		ip := ipAddr.IP
		if ip == nil || !networkAllowsIP(network, ip) {
			continue
		}
		if common.IsPrivateNetworkIP(ip) {
			if !d.allowPrivateNetwork {
				return nil, fmt.Errorf("blocked internal network address %s resolved for %s", ip.String(), host)
			}
			warnPrivateNetworkTarget(ctx, host)
		}
		candidateIPs = append(candidateIPs, ip)
	}

	var lastDialErr error
	for _, ip := range candidateIPs {
		conn, err := d.dial(ctx, network, net.JoinHostPort(ip.String(), port))
		if err == nil {
			return conn, nil
		}
		lastDialErr = err
	}
	if lastDialErr != nil {
		return nil, lastDialErr
	}
	return nil, fmt.Errorf("DNS resolution for %s returned no usable IP addresses", host)
}

// warnPrivateNetworkTarget reports an internal target that the gateway
// connects to. The warning is emitted once per target so a busy channel does
// not flood the log.
func warnPrivateNetworkTarget(ctx context.Context, target string) {
	if _, loaded := privateNetworkDialWarnings.LoadOrStore(target, struct{}{}); loaded {
		return
	}
	logger.LogWarn(ctx, common.LogText("SECURITY WARNING: the gateway is connecting to the internal network target %s", target))
}

// markProxyDialRequest records that the connection of the request is
// established through a proxy. The transport reads the request context when
// it dials, so the marker reaches the dialer.
func markProxyDialRequest(req *http.Request) {
	if req == nil {
		return
	}
	*req = *req.WithContext(context.WithValue(req.Context(), proxyDialKey{}, true))
}

// proxyFromEnvironment resolves the proxy of the environment and marks the
// request when a proxy is used, so the dialer knows that the connection does
// not target the host of the request.
func proxyFromEnvironment(req *http.Request) (*url.URL, error) {
	proxyURL, err := http.ProxyFromEnvironment(req)
	if err != nil {
		return nil, err
	}
	if proxyURL != nil {
		markProxyDialRequest(req)
	}
	return proxyURL, nil
}
