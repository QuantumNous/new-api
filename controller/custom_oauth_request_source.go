package controller

import (
	"net"
	"strings"
)

func extractRequestPeerIP(remoteAddr string) (net.IP, error) {
	remoteAddr = strings.TrimSpace(remoteAddr)
	if remoteAddr == "" {
		return nil, net.InvalidAddrError("remote address is empty")
	}
	host := remoteAddr
	if parsedHost, _, err := net.SplitHostPort(remoteAddr); err == nil {
		host = parsedHost
	}
	host = strings.Trim(host, "[]")
	ip := net.ParseIP(host)
	if ip == nil {
		return nil, net.InvalidAddrError("remote address does not contain an IP")
	}
	return ip, nil
}
