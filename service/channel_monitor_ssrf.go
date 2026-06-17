package service

import (
	"context"
	"net"
	"strings"
)

var monitorBlockedHostnames = map[string]struct{}{
	"localhost":                  {},
	"localhost.localdomain":      {},
	"metadata":                   {},
	"metadata.google.internal":   {},
	"metadata.goog":              {},
	"instance-data":              {},
	"instance-data.ec2.internal": {},
}

var monitorBlockedCIDRs = mustParseMonitorCIDRs([]string{
	"127.0.0.0/8",
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
	"169.254.0.0/16",
	"100.64.0.0/10",
	"0.0.0.0/8",
	"::1/128",
	"fc00::/7",
	"fe80::/10",
	"::/128",
})

var monitorDialer = &net.Dialer{
	Timeout:   monitorDialTimeout,
	KeepAlive: monitorDialKeepAlive,
}

func mustParseMonitorCIDRs(cidrs []string) []*net.IPNet {
	out := make([]*net.IPNet, 0, len(cidrs))
	for _, cidr := range cidrs {
		_, n, err := net.ParseCIDR(cidr)
		if err != nil {
			panic("channel monitor invalid CIDR " + cidr + ": " + err.Error())
		}
		out = append(out, n)
	}
	return out
}

func isMonitorBlockedHostname(hostname string) bool {
	if hostname == "" {
		return true
	}
	_, ok := monitorBlockedHostnames[strings.ToLower(hostname)]
	return ok
}

func isMonitorPrivateIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsUnspecified() || ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsInterfaceLocalMulticast() {
		return true
	}
	for _, n := range monitorBlockedCIDRs {
		if n.Contains(ip) {
			return true
		}
	}
	return false
}

func isMonitorPrivateOrLoopbackHost(ctx context.Context, hostname string) (bool, error) {
	if isMonitorBlockedHostname(hostname) {
		return true, nil
	}
	if ip := net.ParseIP(hostname); ip != nil {
		return isMonitorPrivateIP(ip), nil
	}
	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, hostname)
	if err != nil {
		return false, err
	}
	if len(addrs) == 0 {
		return true, nil
	}
	for _, addr := range addrs {
		if isMonitorPrivateIP(addr.IP) {
			return true, nil
		}
	}
	return false, nil
}

func safeMonitorDialContext(ctx context.Context, network, address string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(address)
	if err != nil {
		return nil, err
	}
	if ip := net.ParseIP(host); ip != nil {
		if isMonitorPrivateIP(ip) {
			return nil, &net.AddrError{Err: "blocked by SSRF policy", Addr: address}
		}
		return monitorDialer.DialContext(ctx, network, address)
	}
	if isMonitorBlockedHostname(host) {
		return nil, &net.AddrError{Err: "blocked by SSRF policy", Addr: address}
	}
	addrs, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	var lastErr error
	for _, addr := range addrs {
		if isMonitorPrivateIP(addr.IP) {
			lastErr = &net.AddrError{Err: "blocked by SSRF policy", Addr: addr.IP.String()}
			continue
		}
		conn, err := monitorDialer.DialContext(ctx, network, net.JoinHostPort(addr.IP.String(), port))
		if err == nil {
			return conn, nil
		}
		lastErr = err
	}
	if lastErr == nil {
		lastErr = &net.AddrError{Err: "no usable addresses", Addr: host}
	}
	return nil, lastErr
}
