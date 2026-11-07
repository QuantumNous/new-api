package service

import (
	"bufio"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/binary"
	"io"
	"math/big"
	"net"
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDialContextThroughProxyAcceptsHTTPAndSOCKS5H(t *testing.T) {
	previousTLS := proxyTLSConfig
	proxyTLSConfig = func(serverName string) *tls.Config {
		return &tls.Config{ServerName: serverName, InsecureSkipVerify: true, MinVersion: tls.VersionTLS12}
	}
	t.Cleanup(func() { proxyTLSConfig = previousTLS })

	backend := serveEcho(t)
	httpProxy := serveConnectProxy(t, nil)
	httpsProxy := serveConnectProxy(t, localhostTLS(t))
	socksProxy := serveSOCKS5(t, backend)

	cases := []struct {
		name  string
		proxy string
		addr  string
	}{
		{name: "http", proxy: "http://" + httpProxy, addr: backend},
		{name: "https", proxy: "https://user:pass@" + httpsProxy, addr: backend},
		{name: "socks5h", proxy: "socks5h://" + socksProxy, addr: "example.test:80"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			parsed, err := url.Parse(tc.proxy)
			require.NoError(t, err)
			conn, err := DialContextThroughProxy(t.Context(), parsed, "tcp", tc.addr)
			require.NoError(t, err)
			defer conn.Close()
			_, err = conn.Write([]byte("ping"))
			require.NoError(t, err)
			buf := make([]byte, 4)
			_, err = io.ReadFull(conn, buf)
			require.NoError(t, err)
			assert.Equal(t, "ping", string(buf))
		})
	}
}

func serveEcho(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = ln.Close() })
	go acceptEcho(ln)
	return ln.Addr().String()
}

func acceptEcho(ln net.Listener) {
	for {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		go func(c net.Conn) {
			defer c.Close()
			_, _ = io.Copy(c, c)
		}(conn)
	}
}

func serveConnectProxy(t *testing.T, tlsConfig *tls.Config) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	if tlsConfig != nil {
		ln = tls.NewListener(ln, tlsConfig)
	}
	t.Cleanup(func() { _ = ln.Close() })
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go handleConnect(conn)
		}
	}()
	return ln.Addr().String()
}

func handleConnect(conn net.Conn) {
	defer conn.Close()
	reader := bufio.NewReader(conn)
	req, err := http.ReadRequest(reader)
	if err != nil || req.Method != http.MethodConnect {
		return
	}
	target, err := net.Dial("tcp", req.Host)
	if err != nil {
		_, _ = conn.Write([]byte("HTTP/1.1 502 Bad Gateway\r\n\r\n"))
		return
	}
	defer target.Close()
	_, _ = conn.Write([]byte("HTTP/1.1 200 Connection Established\r\n\r\n"))
	go func() { _, _ = io.Copy(target, reader) }()
	_, _ = io.Copy(conn, target)
}

func serveSOCKS5(t *testing.T, backend string) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	t.Cleanup(func() { _ = ln.Close() })
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go handleSOCKS5(conn, backend)
		}
	}()
	return ln.Addr().String()
}

func handleSOCKS5(conn net.Conn, backend string) {
	defer conn.Close()
	buf := make([]byte, 2)
	if _, err := io.ReadFull(conn, buf); err != nil || buf[0] != 5 {
		return
	}
	methods := make([]byte, int(buf[1]))
	if _, err := io.ReadFull(conn, methods); err != nil {
		return
	}
	if _, err := conn.Write([]byte{5, 0}); err != nil {
		return
	}
	head := make([]byte, 4)
	if _, err := io.ReadFull(conn, head); err != nil || head[0] != 5 || head[1] != 1 || head[3] != 3 {
		return
	}
	length := make([]byte, 1)
	if _, err := io.ReadFull(conn, length); err != nil {
		return
	}
	host := make([]byte, int(length[0]))
	if _, err := io.ReadFull(conn, host); err != nil {
		return
	}
	port := make([]byte, 2)
	if _, err := io.ReadFull(conn, port); err != nil {
		return
	}
	if string(host) != "example.test" || binary.BigEndian.Uint16(port) != 80 {
		return
	}
	target, err := net.Dial("tcp", backend)
	if err != nil {
		return
	}
	defer target.Close()
	reply := []byte{5, 0, 0, 1, 0, 0, 0, 0, 0, 0}
	if _, err = conn.Write(reply); err != nil {
		return
	}
	go func() { _, _ = io.Copy(target, conn) }()
	_, _ = io.Copy(conn, target)
}

func localhostTLS(t *testing.T) *tls.Config {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	require.NoError(t, err)
	template := &x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject:      pkix.Name{CommonName: "127.0.0.1"},
		NotBefore:    time.Now().Add(-time.Hour),
		NotAfter:     time.Now().Add(time.Hour),
		IPAddresses:  []net.IP{net.ParseIP("127.0.0.1")},
		DNSNames:     []string{"127.0.0.1"},
	}
	der, err := x509.CreateCertificate(rand.Reader, template, template, &key.PublicKey, key)
	require.NoError(t, err)
	cert := tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}
	return &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12}
}
