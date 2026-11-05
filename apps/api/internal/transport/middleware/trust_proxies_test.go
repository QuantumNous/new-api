package middleware

import (
	"bufio"
	"bytes"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ---- peer-address fixture ----
//
// The tests in this file and in limit_rate_test.go resolve differently for every
// peer address they name, so the fixture has to be able to choose one. Neither
// obvious option can:
//
//   - app.Test serves over a connection hardcoded to 0.0.0.0:0, so every case in
//     the trust matrix would arrive from the same untrusted peer. The default
//     policy would then reject the forwarded header in all of them and produce
//     the expected answer in none, and a policy that trusted nothing at all
//     would still pass several cases by accident.
//   - A real client on a real loopback listener can only ever be 127.0.0.1 or
//     ::1. The matrix deliberately covers 10.20.30.40, 172.20.0.2,
//     192.168.10.2, fd12:3456::2 and two public addresses, none of which a test
//     process can dial from.
//
// So the peer address is injected: the request is served over a net.Pipe whose
// RemoteAddr reports the address the case names, which is what fasthttp's
// RemoteIP -- and therefore the whole trusted-proxy walk -- reads. This is the
// same technique fiberadapter's own engine tests use, for the same reason.
//
// Do NOT "simplify" any of this back to app.Test. Every case would keep passing
// while asserting nothing about the trust policy.

// peerConn reports a chosen peer address instead of the pipe's own.
type peerConn struct {
	net.Conn
	peer net.Addr
}

func (c *peerConn) RemoteAddr() net.Addr { return c.peer }

// singleConnListener hands one connection to the server and then blocks until
// the test finishes, so fasthttp keeps serving that connection instead of
// shutting its worker pool down.
type singleConnListener struct {
	conn     net.Conn
	closed   chan struct{}
	accepted bool
	once     sync.Once
}

func (l *singleConnListener) Accept() (net.Conn, error) {
	if !l.accepted {
		l.accepted = true
		return l.conn, nil
	}
	<-l.closed
	return nil, io.EOF
}

func (l *singleConnListener) Close() error {
	l.once.Do(func() { close(l.closed) })
	return nil
}

func (l *singleConnListener) Addr() net.Addr {
	return &net.TCPAddr{IP: net.IPv4(127, 0, 0, 1), Port: 0}
}

// captureEngineApp recovers the fiber app behind a contract engine by serving one
// bootstrap request through it.
//
// The detour exists because the two things this fixture needs are only available
// on opposite sides of the contract boundary. ConfigureTrustedProxies takes a
// contract.Engine, and only fiberadapter.NewEngine installs the layer that
// resolves the client address against the trusted-proxy policy -- a bare
// fiber.App never runs it, so a hand-built app would leave ClientIP reporting the
// peer and every forwarded-header assertion would be vacuous. But injecting a
// peer address needs App.Listener, and contract.Engine exposes only Serve(addr).
//
// The engine hands out its own fiber app to any handler that asks, so one
// throwaway request over a real loopback port recovers it, and every subsequent
// request runs over an injected connection with a chosen peer. Nothing is added
// to the adapter's API for this: MustUnwrap is the documented escape hatch and
// App is fiber's own accessor.
//
// The bootstrap listener stays bound for the rest of the test binary. Shutting it
// down would stop the fasthttp server that the injected connections are also
// served by.
func captureEngineApp(t *testing.T, server contract.Engine) *fiber.App {
	t.Helper()

	captured := make(chan *fiber.App, 1)
	server.GET("/__fixture_app", func(c contract.Context) {
		captured <- fiberadapter.MustUnwrap(c).App()
		c.Status(http.StatusNoContent)
	})

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	address := listener.Addr().String()
	require.NoError(t, listener.Close())

	go func() { _ = server.Serve(address) }()

	deadline := time.Now().Add(10 * time.Second)
	for {
		response, err := http.Get("http://" + address + "/__fixture_app")
		if err == nil {
			_ = response.Body.Close()
			break
		}
		require.True(t, time.Now().Before(deadline), "the bootstrap listener never accepted: %v", err)
		time.Sleep(10 * time.Millisecond)
	}

	select {
	case app := <-captured:
		return app
	case <-time.After(10 * time.Second):
		t.Fatal("the bootstrap route never ran")
		return nil
	}
}

// servePeerRequest serves req through app over a connection that reports
// remoteAddr as its peer, and returns the response with its body buffered.
func servePeerRequest(t *testing.T, app *fiber.App, req *http.Request, remoteAddr string) *http.Response {
	t.Helper()

	peer, err := net.ResolveTCPAddr("tcp", remoteAddr)
	require.NoError(t, err)

	client, served := net.Pipe()
	listener := &singleConnListener{
		conn:   &peerConn{Conn: served, peer: peer},
		closed: make(chan struct{}),
	}
	t.Cleanup(func() { _ = listener.Close() })

	go func() { _ = app.Listener(listener) }()

	dump, err := httputil.DumpRequest(req, true)
	require.NoError(t, err)
	require.NoError(t, client.SetDeadline(time.Now().Add(10*time.Second)))
	_, err = client.Write(dump)
	require.NoError(t, err)

	response, err := http.ReadResponse(bufio.NewReader(client), req)
	require.NoError(t, err)
	return bufferResponseBody(t, response)
}

// bufferResponseBody drains the response so assertions can read it after the
// connection is gone, leaving Body readable.
func bufferResponseBody(t *testing.T, response *http.Response) *http.Response {
	t.Helper()

	body, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	require.NoError(t, response.Body.Close())
	response.Body = io.NopCloser(bytes.NewReader(body))
	return response
}

// responseBody returns the body of a response servePeerRequest already buffered.
func responseBody(t *testing.T, response *http.Response) string {
	t.Helper()

	body, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	return string(body)
}

// ---- trusted proxies ----

func requestClientIP(t *testing.T, app *fiber.App, remoteAddr string, forwardedFor string) string {
	t.Helper()

	request := httptest.NewRequest(http.MethodGet, "/client-ip", nil)
	if forwardedFor != "" {
		request.Header.Set("X-Forwarded-For", forwardedFor)
	}
	return responseBody(t, servePeerRequest(t, app, request, remoteAddr))
}

// newClientIPEngine returns an engine carrying the probe route, for the cases
// that only assert on how ConfigureTrustedProxies validates its configuration and
// never issue a request.
func newClientIPEngine() contract.Engine {
	server := fiberadapter.NewEngine(func(c contract.Context, recovered any) {
		c.AbortWithStatus(http.StatusInternalServerError)
	})
	server.GET("/client-ip", func(c contract.Context) {
		_ = c.String(http.StatusOK, c.ClientIP())
	})
	return server
}

// newClientIPRouter returns both views of one engine: the contract.Engine
// ConfigureTrustedProxies consumes, and the fiber app the test drives requests
// through. contract.Engine does not embed http.Handler, because a fasthttp-backed
// engine has no ServeHTTP, and it exposes no listener seam either, so the app is
// recovered through a bootstrap request. See captureEngineApp.
func newClientIPRouter(t *testing.T) (contract.Engine, *fiber.App) {
	t.Helper()

	server := newClientIPEngine()
	return server, captureEngineApp(t, server)
}

func TestConfigureTrustedProxiesDefaultsToLoopbackAndPrivateNetworks(t *testing.T) {
	t.Setenv("TRUSTED_PROXIES", "")
	server, app := newClientIPRouter(t)
	require.NoError(t, ConfigureTrustedProxies(server))

	testCases := []struct {
		name       string
		remoteAddr string
	}{
		{name: "IPv4 loopback", remoteAddr: "127.0.0.1:12345"},
		{name: "IPv6 loopback", remoteAddr: "[::1]:12345"},
		{name: "10 private network", remoteAddr: "10.20.30.40:12345"},
		{name: "172 private network", remoteAddr: "172.20.0.2:12345"},
		{name: "192 private network", remoteAddr: "192.168.10.2:12345"},
		{name: "IPv6 unique local network", remoteAddr: "[fd12:3456::2]:12345"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			clientIP := requestClientIP(t, app, testCase.remoteAddr, "203.0.113.10")
			assert.Equal(t, "203.0.113.10", clientIP)
		})
	}
}

func TestConfigureTrustedProxiesDefaultRejectsPublicPeerHeaders(t *testing.T) {
	t.Setenv("TRUSTED_PROXIES", " \t ")
	server, app := newClientIPRouter(t)
	require.NoError(t, ConfigureTrustedProxies(server))

	clientIP := requestClientIP(t, app, "198.51.100.10:12345", "203.0.113.10")
	assert.Equal(t, "198.51.100.10", clientIP, "a public peer must not make a spoofed X-Forwarded-For authoritative")
}

func TestConfigureTrustedProxiesDefaultStopsAtPublicClientInForwardedChain(t *testing.T) {
	t.Setenv("TRUSTED_PROXIES", "")
	server, app := newClientIPRouter(t)
	require.NoError(t, ConfigureTrustedProxies(server))

	clientIP := requestClientIP(t, app, "172.20.0.2:12345", "192.0.2.99, 203.0.113.10")
	assert.Equal(t, "203.0.113.10", clientIP, "the first public hop from the trusted proxy must win over a client-supplied prefix")
}

func TestConfigureTrustedProxiesNoneDisablesForwardedHeaders(t *testing.T) {
	t.Setenv("TRUSTED_PROXIES", " NoNe ")
	server, app := newClientIPRouter(t)
	require.NoError(t, ConfigureTrustedProxies(server))

	clientIP := requestClientIP(t, app, "127.0.0.1:12345", "203.0.113.10")
	assert.Equal(t, "127.0.0.1", clientIP)
}

func TestConfigureTrustedProxiesAcceptsTrimmedIPsAndCIDRs(t *testing.T) {
	t.Setenv("TRUSTED_PROXIES", " 192.0.2.0/24, 198.51.100.30 ")
	server, app := newClientIPRouter(t)
	require.NoError(t, ConfigureTrustedProxies(server))

	trustedClientIP := requestClientIP(t, app, "192.0.2.10:12345", "203.0.113.20")
	assert.Equal(t, "203.0.113.20", trustedClientIP)

	trustedExactIP := requestClientIP(t, app, "198.51.100.30:12345", "203.0.113.21")
	assert.Equal(t, "203.0.113.21", trustedExactIP)

	untrustedClientIP := requestClientIP(t, app, "198.51.100.20:12345", "203.0.113.22")
	assert.Equal(t, "198.51.100.20", untrustedClientIP)

	defaultProxyIP := requestClientIP(t, app, "127.0.0.1:12345", "203.0.113.23")
	assert.Equal(t, "127.0.0.1", defaultProxyIP, "an explicit list must replace, not extend, the compatibility defaults")
}

func TestConfigureTrustedProxiesRejectsInvalidConfiguration(t *testing.T) {
	testCases := []struct {
		name  string
		value string
	}{
		{name: "no entries", value: ", ,"},
		{name: "invalid entry", value: "not-an-ip"},
		{name: "mixed valid and invalid entries", value: "127.0.0.1, not-an-ip"},
		{name: "none mixed with valid entry", value: "none,127.0.0.1"},
		{name: "valid entry mixed with none", value: "127.0.0.1,NONE"},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			t.Setenv("TRUSTED_PROXIES", testCase.value)
			router := newClientIPEngine()
			assert.Error(t, ConfigureTrustedProxies(router))
		})
	}
}
