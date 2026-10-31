package service

import (
	"bufio"
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strings"

	"golang.org/x/net/proxy"
)

// proxyTLSConfig builds the TLS config used to reach an https proxy.
// Tests replace it to trust a local certificate.
var proxyTLSConfig = func(serverName string) *tls.Config {
	return &tls.Config{ServerName: serverName, MinVersion: tls.VersionTLS12}
}

// DialContextThroughProxy connects to addr through proxyURL.
// It accepts the same schemes as channel proxies: http, https, socks5, and socks5h.
// A nil proxy URL dials addr directly.
func DialContextThroughProxy(ctx context.Context, proxyURL *url.URL, network, addr string) (net.Conn, error) {
	if proxyURL == nil || proxyURL.Scheme == "" {
		var dialer net.Dialer
		return dialer.DialContext(ctx, network, addr)
	}
	switch strings.ToLower(proxyURL.Scheme) {
	case "socks5", "socks5h":
		return dialSOCKS(ctx, proxyURL, network, addr)
	case "http", "https":
		return dialHTTPConnect(ctx, proxyURL, addr)
	default:
		return nil, fmt.Errorf("unsupported proxy scheme %q", proxyURL.Scheme)
	}
}

func dialSOCKS(ctx context.Context, proxyURL *url.URL, network, addr string) (net.Conn, error) {
	forward := &net.Dialer{}
	dialer, err := proxy.FromURL(proxyURL, forward)
	if err != nil {
		return nil, err
	}
	contextDialer, ok := dialer.(proxy.ContextDialer)
	if !ok {
		return nil, fmt.Errorf("SOCKS proxy dialer does not support context cancellation")
	}
	return contextDialer.DialContext(ctx, network, addr)
}

func dialHTTPConnect(ctx context.Context, proxyURL *url.URL, addr string) (net.Conn, error) {
	proxyAddr := proxyURL.Host
	if proxyURL.Port() == "" {
		if strings.EqualFold(proxyURL.Scheme, "https") {
			proxyAddr = net.JoinHostPort(proxyURL.Hostname(), "443")
		} else {
			proxyAddr = net.JoinHostPort(proxyURL.Hostname(), "80")
		}
	}
	var dialer net.Dialer
	conn, err := dialer.DialContext(ctx, "tcp", proxyAddr)
	if err != nil {
		return nil, err
	}
	if strings.EqualFold(proxyURL.Scheme, "https") {
		tlsConn := tls.Client(conn, proxyTLSConfig(proxyURL.Hostname()))
		if err = tlsConn.HandshakeContext(ctx); err != nil {
			conn.Close()
			return nil, err
		}
		conn = tlsConn
	}
	connectReq := &http.Request{
		Method: http.MethodConnect,
		URL:    &url.URL{Opaque: addr},
		Host:   addr,
		Header: make(http.Header),
	}
	if user := proxyURL.User; user != nil {
		username := user.Username()
		password, _ := user.Password()
		token := base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
		connectReq.Header.Set("Proxy-Authorization", "Basic "+token)
	}
	if err = connectReq.Write(conn); err != nil {
		conn.Close()
		return nil, err
	}
	reader := bufio.NewReader(conn)
	resp, err := http.ReadResponse(reader, connectReq)
	if err != nil {
		conn.Close()
		return nil, err
	}
	if resp.Body != nil {
		_ = resp.Body.Close()
	}
	if resp.StatusCode != http.StatusOK {
		conn.Close()
		return nil, fmt.Errorf("proxy CONNECT failed: %s", resp.Status)
	}
	if buffered := reader.Buffered(); buffered > 0 {
		prefix := make([]byte, buffered)
		if _, err = reader.Read(prefix); err != nil {
			conn.Close()
			return nil, err
		}
		return &prefixConn{Conn: conn, prefix: prefix}, nil
	}
	return conn, nil
}

type prefixConn struct {
	net.Conn
	prefix []byte
}

func (c *prefixConn) Read(p []byte) (int, error) {
	if len(c.prefix) == 0 {
		return c.Conn.Read(p)
	}
	n := copy(p, c.prefix)
	c.prefix = c.prefix[n:]
	return n, nil
}
