package delivery

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/url"
	"time"
)

type DestinationValidator func(context.Context, string) error

type secureTransport struct {
	base      *http.Transport
	validator DestinationValidator
}

func NewHTTPClient(validator DestinationValidator) *http.Client {
	transport := &http.Transport{
		Proxy:                 nil,
		DialContext:           secureDialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          32,
		MaxIdleConnsPerHost:   4,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   5 * time.Second,
		ResponseHeaderTimeout: 10 * time.Second,
		ExpectContinueTimeout: time.Second,
	}
	return &http.Client{
		Transport: &secureTransport{base: transport, validator: validator},
		Timeout:   10 * time.Second,
		CheckRedirect: func(request *http.Request, _ []*http.Request) error {
			if validator == nil {
				return errors.New("destination validator is required")
			}
			return validator(request.Context(), request.URL.String())
		},
	}
}

func (t *secureTransport) RoundTrip(request *http.Request) (*http.Response, error) {
	if t.validator == nil {
		return nil, errors.New("destination validator is required")
	}
	if err := t.validator(request.Context(), request.URL.String()); err != nil {
		return nil, err
	}
	return t.base.RoundTrip(request)
}

func secureDialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}
	addresses, err := net.DefaultResolver.LookupIP(ctx, "ip", host)
	if err != nil || len(addresses) == 0 {
		return nil, errors.New("destination DNS lookup failed")
	}
	var dialer net.Dialer
	for _, ip := range addresses {
		if !isPublicIP(ip) {
			return nil, errors.New("destination resolves to a non-public address")
		}
		connection, dialErr := dialer.DialContext(ctx, network, net.JoinHostPort(ip.String(), port))
		if dialErr == nil {
			return connection, nil
		}
	}
	return nil, errors.New("unable to connect to validated destination")
}

func isPublicIP(ip net.IP) bool {
	if !ip.IsGlobalUnicast() || ip.IsPrivate() || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() || ip.IsMulticast() {
		return false
	}
	if ipv4 := ip.To4(); ipv4 != nil {
		return !(ipv4[0] == 100 && ipv4[1] >= 64 && ipv4[1] <= 127)
	}
	return true
}

func ValidateExactDestination(expected string) DestinationValidator {
	return func(_ context.Context, raw string) error {
		candidate, err := url.Parse(raw)
		if err != nil {
			return err
		}
		if candidate.String() != expected {
			return errors.New("destination does not match configured notify URL")
		}
		return nil
	}
}
