package service

import (
	"context"
	"errors"
	"net"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsPlaceholderIP(t *testing.T) {
	cases := []struct {
		ip      string
		invalid bool
	}{
		{"127.0.0.1", true},        // loopback
		{"127.0.0.2", true},        // loopback
		{"10.0.0.1", true},         // RFC1918
		{"172.16.5.5", true},       // RFC1918
		{"192.168.1.1", true},      // RFC1918
		{"100.64.0.1", true},       // CGNAT
		{"100.127.255.254", true},  // CGNAT upper edge
		{"169.254.169.254", true},  // link-local / cloud metadata
		{"0.0.0.0", true},          // unspecified
		{"::1", true},              // IPv6 loopback
		{"fe80::1", true},          // IPv6 link-local
		{"8.8.8.8", false},         // public
		{"1.1.1.1", false},         // public
		{"2606:4700:4700::1111", false}, // public IPv6
	}
	for _, c := range cases {
		ip := net.ParseIP(c.ip)
		require.NotNil(t, ip, c.ip)
		require.Equal(t, c.invalid, isPlaceholderIP(ip), c.ip)
	}
	require.False(t, isPlaceholderIP(nil))
}

func TestIsDNSNotFound(t *testing.T) {
	require.True(t, isDNSNotFound(&net.DNSError{Err: "no such host", Name: "example.com", IsNotFound: true}))
	require.False(t, isDNSNotFound(errors.New("dial tcp: i/o timeout")))
	require.False(t, isDNSNotFound(&net.DNSError{Err: "server misbehaving", Name: "example.com", IsNotFound: false}))
	require.False(t, isDNSNotFound(nil))
}

func TestSafeEmailDomainDialContextRefusesPrivateTargets(t *testing.T) {
	// Private targets must be rejected before any dial attempt; an error (not a
	// successful connection) is the only acceptable outcome.
	_, err := safeEmailDomainDialContext(context.Background(), "tcp", "127.0.0.1:80")
	require.Error(t, err)

	_, err = safeEmailDomainDialContext(context.Background(), "tcp", "100.64.5.5:443")
	require.Error(t, err)

	_, err = safeEmailDomainDialContext(context.Background(), "tcp", "169.254.169.254:80")
	require.Error(t, err)
}
