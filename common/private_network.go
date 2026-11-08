package common

import (
	"context"
	"fmt"
	"net"
	"net/url"
	"strings"
)

// IsPrivateNetworkIP reports whether the address belongs to an internal or
// reserved range: RFC 1918 private space, carrier grade NAT, loopback, link
// local, multicast and the other special purpose ranges of the IANA
// registries.
func IsPrivateNetworkIP(ip net.IP) bool {
	return isPrivateIP(ip)
}

// HostTargetsPrivateNetwork reports whether the host points at an internal
// network. An IP literal is checked directly. A hostname is resolved and every
// returned address is checked, so a public name that maps to an internal
// address is detected as well.
func HostTargetsPrivateNetwork(ctx context.Context, host string) (bool, error) {
	host = strings.TrimSpace(host)
	if host == "" {
		return false, fmt.Errorf("invalid host")
	}
	if ip := net.ParseIP(host); ip != nil {
		return isPrivateIP(ip), nil
	}
	addresses, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return false, err
	}
	for _, address := range addresses {
		if isPrivateIP(address.IP) {
			return true, nil
		}
	}
	return false, nil
}

// URLTargetsPrivateNetwork reports whether the URL points at an internal
// network. The host of the URL is checked, the path and the query are not
// relevant for the network location of the target.
func URLTargetsPrivateNetwork(ctx context.Context, rawURL string) (bool, error) {
	parsedURL, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil {
		return false, err
	}
	host := parsedURL.Hostname()
	if host == "" {
		return false, fmt.Errorf("invalid url")
	}
	return HostTargetsPrivateNetwork(ctx, host)
}
