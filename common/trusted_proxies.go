package common

import (
	"errors"
	"fmt"
	"net"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
)

// ResolveTrustedProxies parses TRUSTED_PROXIES without applying it to an
// engine. The returned slice can be reused by the outer and plugin engines.
//
// An unset or blank value trusts no proxies at all: believing forwarded headers
// by default lets any direct client spoof X-Forwarded-For and defeat IP-based
// rate limits and audit logs. Deployments behind a reverse proxy must list that
// proxy explicitly. usedDefaults reports the unset case so the caller can warn.
func ResolveTrustedProxies(raw string) (trustedProxies []string, usedDefaults bool, err error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, true, nil
	}
	if strings.EqualFold(raw, "none") {
		return nil, false, nil
	}

	parts := strings.Split(raw, ",")
	trustedProxies = make([]string, 0, len(parts))
	for _, part := range parts {
		trustedProxy := strings.TrimSpace(part)
		if trustedProxy == "" {
			continue
		}
		if strings.EqualFold(trustedProxy, "none") {
			return nil, false, errors.New("TRUSTED_PROXIES=none must be used alone")
		}
		trustedProxies = append(trustedProxies, trustedProxy)
	}
	if len(trustedProxies) == 0 {
		return nil, false, errors.New("TRUSTED_PROXIES does not contain an IP address or CIDR")
	}
	return trustedProxies, false, nil
}

var (
	trustedProxyNetsMu sync.RWMutex
	trustedProxyNets   []*net.IPNet
)

// ConfigureTrustedProxies applies TRUSTED_PROXIES to the engine and records the
// same networks for IsTrustedProxyIP. Both accept bare IPs and CIDRs; a nil or
// empty list trusts no peer, matching the behavior Gin applies to the same
// input.
func ConfigureTrustedProxies(engine *gin.Engine, trustedProxies []string) error {
	if err := engine.SetTrustedProxies(trustedProxies); err != nil {
		return fmt.Errorf("invalid TRUSTED_PROXIES: %w", err)
	}
	nets := make([]*net.IPNet, 0, len(trustedProxies))
	for _, entry := range trustedProxies {
		entry = strings.TrimSpace(entry)
		if entry == "" {
			continue
		}
		if strings.Contains(entry, "/") {
			_, network, err := net.ParseCIDR(entry)
			if err != nil {
				return fmt.Errorf("invalid TRUSTED_PROXIES: %w", err)
			}
			nets = append(nets, network)
			continue
		}
		ip := net.ParseIP(entry)
		if ip == nil {
			return fmt.Errorf("invalid TRUSTED_PROXIES: invalid IP address %q", entry)
		}
		bits := 32
		if ip.To4() == nil {
			bits = 128
		}
		nets = append(nets, &net.IPNet{IP: ip, Mask: net.CIDRMask(bits, bits)})
	}
	trustedProxyNetsMu.Lock()
	trustedProxyNets = nets
	trustedProxyNetsMu.Unlock()
	return nil
}

// IsTrustedProxyIP reports whether remoteAddr (host or host:port) belongs to a
// configured trusted proxy. Forwarded headers are only authoritative for such
// peers, so a directly connected client cannot spoof X-Forwarded-Proto,
// X-Forwarded-Host, or X-Forwarded-For.
func IsTrustedProxyIP(remoteAddr string) bool {
	host := strings.TrimSpace(remoteAddr)
	if splitHost, _, err := net.SplitHostPort(host); err == nil {
		host = splitHost
	}
	ip := net.ParseIP(strings.TrimSpace(host))
	if ip == nil {
		return false
	}
	trustedProxyNetsMu.RLock()
	nets := trustedProxyNets
	trustedProxyNetsMu.RUnlock()
	for _, network := range nets {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}
