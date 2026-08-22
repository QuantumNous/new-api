package oauth

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// ValidateOAuthEndpoint accepts only public HTTPS endpoints. OAuth provider
// configuration is administrator supplied but becomes a server-side request
// target, so it must not inherit the more permissive fetch configuration.
func ValidateOAuthEndpoint(rawURL string) error {
	parsed, err := url.ParseRequestURI(strings.TrimSpace(rawURL))
	if err != nil || parsed == nil || parsed.Host == "" {
		return fmt.Errorf("invalid OAuth endpoint")
	}
	if parsed.Scheme != "https" || parsed.User != nil || parsed.Fragment != "" {
		return fmt.Errorf("OAuth endpoint must be a public HTTPS URL")
	}

	protection := oauthEndpointProtection()
	if err := protection.ValidateURL(parsed.String()); err != nil {
		return fmt.Errorf("OAuth endpoint is not publicly reachable")
	}
	return nil
}

func oauthEndpointProtection() *common.SSRFProtection {
	return &common.SSRFProtection{
		AllowPrivateIp:         false,
		DomainFilterMode:       false,
		IpFilterMode:           false,
		AllowedPorts:           []int{443},
		ApplyIPFilterForDomain: true,
	}
}

// NewOAuthEndpointHTTPClient returns an HTTPS-only client with validation both
// before the request and immediately before dialing. It deliberately ignores
// ambient proxy and TLS-insecure settings because OAuth tokens are credentials.
func NewOAuthEndpointHTTPClient(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout: timeout,
		Transport: &http.Transport{
			DialContext:         dialOAuthEndpoint,
			ForceAttemptHTTP2:   true,
			TLSHandshakeTimeout: 5 * time.Second,
		},
		CheckRedirect: checkOAuthRedirect,
	}
}

func checkOAuthRedirect(req *http.Request, via []*http.Request) error {
	if len(via) >= 5 {
		return fmt.Errorf("too many OAuth redirects")
	}
	if req == nil || req.URL == nil {
		return fmt.Errorf("invalid OAuth redirect")
	}
	return ValidateOAuthEndpoint(req.URL.String())
}

func dialOAuthEndpoint(ctx context.Context, network, address string) (net.Conn, error) {
	host, portText, err := net.SplitHostPort(address)
	if err != nil {
		return nil, fmt.Errorf("invalid OAuth dial address")
	}
	port, err := strconv.Atoi(portText)
	if err != nil {
		return nil, fmt.Errorf("invalid OAuth dial port")
	}
	protection := oauthEndpointProtection()
	if err := protection.ValidateNetworkTarget(host, port); err != nil {
		return nil, fmt.Errorf("OAuth endpoint blocked")
	}

	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
	if ip := net.ParseIP(host); ip != nil {
		return dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), portText))
	}

	resolved, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, fmt.Errorf("OAuth endpoint DNS lookup failed")
	}
	for _, ipAddr := range resolved {
		if err := protection.ValidateResolvedIP(host, ipAddr.IP); err != nil {
			return nil, fmt.Errorf("OAuth endpoint blocked")
		}
	}
	for _, ipAddr := range resolved {
		if ipAddr.IP == nil {
			continue
		}
		conn, dialErr := dialer.DialContext(ctx, network, net.JoinHostPort(ipAddr.IP.String(), portText))
		if dialErr == nil {
			return conn, nil
		}
		err = dialErr
	}
	if err != nil {
		return nil, fmt.Errorf("OAuth endpoint connection failed")
	}
	return nil, fmt.Errorf("OAuth endpoint DNS lookup returned no addresses")
}
