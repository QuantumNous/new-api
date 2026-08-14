package order

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"path"
	"strings"
)

type Resolver func(context.Context, string) ([]net.IP, error)

type ReturnURLPolicy struct {
	allowed  []allowedReturnURL
	resolver Resolver
}

type allowedReturnURL struct {
	scheme string
	host   string
	port   string
	prefix string
}

func NewReturnURLPolicy(allowlist string, resolver Resolver) (*ReturnURLPolicy, error) {
	if resolver == nil {
		resolver = defaultResolver
	}
	entries := strings.Split(allowlist, ",")
	policy := &ReturnURLPolicy{resolver: resolver}
	for _, entry := range entries {
		normalized, err := NormalizeHTTPSURL(strings.TrimSpace(entry))
		if err != nil {
			return nil, fmt.Errorf("invalid return URL allowlist entry: %w", err)
		}
		policy.allowed = append(policy.allowed, allowedReturnURL{
			scheme: normalized.Scheme,
			host:   strings.ToLower(normalized.Hostname()),
			port:   normalized.Port(),
			prefix: normalized.Path,
		})
	}
	if len(policy.allowed) == 0 {
		return nil, errors.New("return URL allowlist is empty")
	}
	return policy, nil
}

func (p *ReturnURLPolicy) Validate(ctx context.Context, raw string) (*url.URL, error) {
	normalized, err := NormalizeHTTPSURL(raw)
	if err != nil {
		return nil, err
	}
	if err := validateResolvedHost(ctx, normalized.Hostname(), p.resolver); err != nil {
		return nil, err
	}
	return p.validateAllowlist(normalized)
}

// ValidateStored checks an already accepted return URL before a browser redirect.
// It intentionally avoids a second DNS lookup so a transient resolver failure does
// not change a completed payment result.
func (p *ReturnURLPolicy) ValidateStored(raw string) (*url.URL, error) {
	normalized, err := NormalizeHTTPSURL(raw)
	if err != nil {
		return nil, err
	}
	return p.validateAllowlist(normalized)
}

func (p *ReturnURLPolicy) validateAllowlist(normalized *url.URL) (*url.URL, error) {
	for _, allowed := range p.allowed {
		if normalized.Scheme != allowed.scheme || !strings.EqualFold(normalized.Hostname(), allowed.host) || normalized.Port() != allowed.port {
			continue
		}
		if matchesPathPrefix(normalized.Path, allowed.prefix) {
			return normalized, nil
		}
	}
	return nil, errors.New("return URL is not allowlisted")
}

func NormalizeHTTPSURL(raw string) (*url.URL, error) {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme != "https" || parsed.Hostname() == "" || parsed.User != nil {
		return nil, errors.New("must be an absolute HTTPS URL without userinfo")
	}
	if parsed.Port() != "" && parsed.Port() != "443" {
		return nil, errors.New("must use the default HTTPS port")
	}
	parsed.Host = strings.ToLower(parsed.Hostname())
	parsed.Path = path.Clean(parsed.Path)
	if parsed.Path == "." {
		parsed.Path = "/"
	}
	parsed.RawPath = ""
	parsed.Fragment = ""
	return parsed, nil
}

func NotifyURLMatches(candidate, expected string) bool {
	candidateURL, candidateErr := NormalizeHTTPSURL(candidate)
	expectedURL, expectedErr := NormalizeHTTPSURL(expected)
	return candidateErr == nil && expectedErr == nil && candidateURL.String() == expectedURL.String()
}

func ValidatePublicDestination(ctx context.Context, raw string, resolver Resolver) (*url.URL, error) {
	if resolver == nil {
		resolver = defaultResolver
	}
	normalized, err := NormalizeHTTPSURL(raw)
	if err != nil {
		return nil, err
	}
	if err := validateResolvedHost(ctx, normalized.Hostname(), resolver); err != nil {
		return nil, err
	}
	return normalized, nil
}

func matchesPathPrefix(candidate, prefix string) bool {
	if prefix == "/" {
		return true
	}
	base := strings.TrimSuffix(prefix, "/")
	return candidate == base || strings.HasPrefix(candidate, prefix)
}

func validateResolvedHost(ctx context.Context, host string, resolver Resolver) error {
	if ip := net.ParseIP(host); ip != nil {
		if !isPublicIP(ip) {
			return errors.New("destination resolves to a non-public address")
		}
		return nil
	}
	addresses, err := resolver(ctx, host)
	if err != nil || len(addresses) == 0 {
		return errors.New("destination DNS lookup failed")
	}
	for _, address := range addresses {
		if !isPublicIP(address) {
			return errors.New("destination resolves to a non-public address")
		}
	}
	return nil
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

func defaultResolver(ctx context.Context, host string) ([]net.IP, error) {
	return net.DefaultResolver.LookupIP(ctx, "ip", host)
}
