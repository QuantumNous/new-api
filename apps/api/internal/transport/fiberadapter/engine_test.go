package fiberadapter

import (
	"bufio"
	"bytes"
	"context"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"net/http/httputil"
	"os"
	"sort"
	"strings"
	"sync"
	"syscall"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/transport/contract"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The engine has to satisfy the contract at compile time: the process holds it
// as a contract.Engine and nothing else checks the method set.
var _ contract.Engine = engine{}

// newTestEngine builds an engine whose panic handler records rather than writes,
// so a test that provokes a panic can assert on it.
func newTestEngine(t *testing.T) (contract.Engine, *fiber.App) {
	t.Helper()
	server := NewEngine(func(c contract.Context, recovered any) {
		c.AbortWithStatus(http.StatusInternalServerError)
	})
	adapted, ok := server.(engine)
	require.True(t, ok, "NewEngine must return this package's engine")
	return server, adapted.app
}

// request drives one request through app.
//
// A remoteAddr is honoured by serving the request over a connection that reports
// it. fiber's own app.Test uses a connection hardcoded to 0.0.0.0, which would
// make every trusted-proxy case look identical and let a broken policy pass.
func request(t *testing.T, app *fiber.App, req *http.Request, remoteAddr string) *http.Response {
	t.Helper()

	peer, err := net.ResolveTCPAddr("tcp", remoteAddr)
	require.NoError(t, err)

	client, server := net.Pipe()
	listener := &singleConnListener{
		conn:   &peerConn{Conn: server, peer: peer},
		closed: make(chan struct{}),
	}
	t.Cleanup(func() { _ = listener.Close() })

	served := make(chan error, 1)
	go func() { served <- app.Listener(listener) }()

	dump, err := httputil.DumpRequest(req, true)
	require.NoError(t, err)
	require.NoError(t, client.SetDeadline(time.Now().Add(10*time.Second)))
	_, err = client.Write(dump)
	require.NoError(t, err)

	response, err := http.ReadResponse(bufio.NewReader(client), req)
	require.NoError(t, err)
	return response
}

// peerConn reports a chosen peer address, which is what the trusted-proxy walk
// reads through fasthttp's RemoteIP.
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

// ---- trusted proxies ----

// clientIPEngine registers the same probe the preserved middleware test uses,
// so both implementations are compared on identical ground.
func clientIPEngine(t *testing.T) (contract.Engine, *fiber.App) {
	t.Helper()
	server, app := newTestEngine(t)
	server.GET("/client-ip", func(c contract.Context) {
		_ = c.String(http.StatusOK, c.ClientIP())
	})
	return server, app
}

// defaultTrustedProxies is middleware.defaultTrustedProxyCIDRs. It is duplicated
// rather than imported because importing it from a test in this package would
// make the middleware package and this adapter's tests mutually dependent.
var defaultTrustedProxies = []string{
	"127.0.0.0/8",
	"::1",
	"10.0.0.0/8",
	"172.16.0.0/12",
	"192.168.0.0/16",
	"fc00::/7",
}

func clientIPFor(t *testing.T, cidrs []string, remoteAddr, forwardedFor string) string {
	t.Helper()
	server, app := clientIPEngine(t)
	require.NoError(t, server.TrustProxies(cidrs))

	req := httptest.NewRequest(http.MethodGet, "/client-ip", nil)
	if forwardedFor != "" {
		req.Header.Set("X-Forwarded-For", forwardedFor)
	}
	response := request(t, app, req, remoteAddr)
	return readBody(t, response)
}

func TestTrustProxiesBelievesForwardedHeaderFromTrustedPeers(t *testing.T) {
	for _, testCase := range []struct {
		name       string
		remoteAddr string
	}{
		{name: "IPv4 loopback", remoteAddr: "127.0.0.1:12345"},
		{name: "IPv6 loopback", remoteAddr: "[::1]:12345"},
		{name: "10 private network", remoteAddr: "10.20.30.40:12345"},
		{name: "172 private network", remoteAddr: "172.20.0.2:12345"},
		{name: "192 private network", remoteAddr: "192.168.10.2:12345"},
		{name: "IPv6 unique local network", remoteAddr: "[fd12:3456::2]:12345"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			resolved := clientIPFor(t, defaultTrustedProxies, testCase.remoteAddr, "203.0.113.10")
			assert.Equal(t, "203.0.113.10", resolved)
		})
	}
}

func TestTrustProxiesRejectsForwardedHeaderFromPublicPeer(t *testing.T) {
	resolved := clientIPFor(t, defaultTrustedProxies, "198.51.100.10:12345", "203.0.113.10")
	assert.Equal(t, "198.51.100.10", resolved,
		"a public peer must not make a spoofed X-Forwarded-For authoritative")
}

// TestTrustProxiesStopsAtPublicClientInForwardedChain is the assertion neither
// fiber mode can satisfy: EnableIPValidation off returns the raw header, on
// returns the forgeable leftmost entry, and only a right-to-left walk returns
// the first hop the trusted proxy actually attested to.
func TestTrustProxiesStopsAtPublicClientInForwardedChain(t *testing.T) {
	resolved := clientIPFor(t, defaultTrustedProxies, "172.20.0.2:12345", "192.0.2.99, 203.0.113.10")
	assert.Equal(t, "203.0.113.10", resolved,
		"the first public hop from the trusted proxy must win over a client-supplied prefix")
}

// TestTrustProxiesWalksPastChainedTrustedHops pins the rest of the walk: with
// several trusted hops appending to the chain, the result is the entry to the
// left of all of them, and a client prefix behind that is ignored.
func TestTrustProxiesWalksPastChainedTrustedHops(t *testing.T) {
	resolved := clientIPFor(t, defaultTrustedProxies, "10.0.0.1:12345",
		"192.0.2.99, 203.0.113.10, 10.0.0.9, 172.16.5.4")
	assert.Equal(t, "203.0.113.10", resolved)
}

// TestTrustProxiesAbandonsMalformedChain follows the previous transport's rule:
// an unparseable entry ends the walk rather than being skipped, because past a
// malformed hop the chain cannot be reasoned about, and the peer address stays
// authoritative.
func TestTrustProxiesAbandonsMalformedChain(t *testing.T) {
	resolved := clientIPFor(t, defaultTrustedProxies, "127.0.0.1:12345", "203.0.113.10, not-an-ip")
	assert.Equal(t, "127.0.0.1", resolved)
}

func TestTrustProxiesEmptyListTrustsNoProxy(t *testing.T) {
	for _, testCase := range []struct {
		name  string
		cidrs []string
	}{
		{name: "nil", cidrs: nil},
		{name: "empty", cidrs: []string{}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			resolved := clientIPFor(t, testCase.cidrs, "127.0.0.1:12345", "203.0.113.10")
			assert.Equal(t, "127.0.0.1", resolved,
				"an empty trusted-proxy list must trust no proxy, which is the opposite of fiber's unconfigured default")
		})
	}
}

func TestTrustProxiesExplicitListReplacesDefaults(t *testing.T) {
	explicit := []string{"192.0.2.0/24", "198.51.100.30"}

	assert.Equal(t, "203.0.113.20", clientIPFor(t, explicit, "192.0.2.10:12345", "203.0.113.20"))
	assert.Equal(t, "203.0.113.21", clientIPFor(t, explicit, "198.51.100.30:12345", "203.0.113.21"))
	assert.Equal(t, "198.51.100.20", clientIPFor(t, explicit, "198.51.100.20:12345", "203.0.113.22"))
	assert.Equal(t, "127.0.0.1", clientIPFor(t, explicit, "127.0.0.1:12345", "203.0.113.23"),
		"an explicit list must replace, not extend, the compatibility defaults")
}

// TestTrustProxiesMatchesNonCanonicalIPv6 pins the bare-address handling. The
// previous transport promoted a bare address to a /128 network and compared
// numerically; fiber keys a map on the literal string, so a non-canonical
// spelling of the same address would miss and the proxy would silently stop being
// trusted.
func TestTrustProxiesMatchesNonCanonicalIPv6(t *testing.T) {
	resolved := clientIPFor(t, []string{"2001:0db8:0000:0000:0000:0000:0000:0001"},
		"[2001:db8::1]:12345", "203.0.113.30")
	assert.Equal(t, "203.0.113.30", resolved)
}

// TestTrustProxiesRejectsInvalidConfiguration is the security assertion fiber
// cannot make on its own: its handleTrustedProxy logs a warning and continues, so
// a typo would look configured while trusting nothing.
func TestTrustProxiesRejectsInvalidConfiguration(t *testing.T) {
	for _, testCase := range []struct {
		name  string
		cidrs []string
	}{
		{name: "invalid entry", cidrs: []string{"not-an-ip"}},
		{name: "mixed valid and invalid entries", cidrs: []string{"127.0.0.1", "not-an-ip"}},
		{name: "invalid mask", cidrs: []string{"127.0.0.0/64"}},
		{name: "invalid network", cidrs: []string{"not-an-ip/24"}},
		{name: "empty entry", cidrs: []string{""}},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			server, _ := clientIPEngine(t)
			assert.Error(t, server.TrustProxies(testCase.cidrs))
		})
	}
}

// TestTrustProxiesFallsBackToRealIPHeader covers X-Real-IP as the fallback
// header after X-Forwarded-For. fiber's ProxyHeader names one header and has no
// fallback.
func TestTrustProxiesFallsBackToRealIPHeader(t *testing.T) {
	server, app := clientIPEngine(t)
	require.NoError(t, server.TrustProxies(defaultTrustedProxies))

	req := httptest.NewRequest(http.MethodGet, "/client-ip", nil)
	req.Header.Set("X-Real-IP", "203.0.113.40")
	response := request(t, app, req, "127.0.0.1:12345")
	assert.Equal(t, "203.0.113.40", readBody(t, response))
}

// TestResolvedClientIPIsAbsentWithoutEngine documents the hook's contract: a bare
// fiber app never resolves an address, so the context falls back to the peer
// rather than to a forwarded header.
func TestResolvedClientIPIsAbsentWithoutEngine(t *testing.T) {
	app := fiber.New(fiber.Config{})
	app.Get("/probe", func(c fiber.Ctx) error {
		_, ok := ResolvedClientIP(c)
		assert.False(t, ok)
		return c.SendStatus(http.StatusOK)
	})

	response, err := app.Test(httptest.NewRequest(http.MethodGet, "/probe", nil), fiber.TestConfig{Timeout: 5 * time.Second})
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, response.StatusCode)
}

// ---- route registration ----

// TestRoutesRegisterOneRoutePerVerb pins the registered route set. fiber's Get
// also registers HEAD, so going through it rather than Add would add a phantom
// HEAD entry for every GET and change the route snapshot the compose tests pin.
func TestRoutesRegisterOneRoutePerVerb(t *testing.T) {
	server, app := newTestEngine(t)
	noop := func(contract.Context) {}

	server.GET("/get", noop)
	server.POST("/post", noop)
	server.PUT("/put", noop)
	server.PATCH("/patch", noop)
	server.DELETE("/delete", noop)
	server.Handle(http.MethodPost, "/handled", noop)

	assert.Equal(t, []string{
		"DELETE /delete",
		"GET /get",
		"PATCH /patch",
		"POST /handled",
		"POST /post",
		"PUT /put",
	}, registeredRoutes(app))
}

// TestRoutesAnyRegistersEveryRoutedMethod registers every routed verb, which is
// the same nine verbs fiber routes.
func TestRoutesAnyRegistersEveryRoutedMethod(t *testing.T) {
	server, app := newTestEngine(t)
	server.Any("/anything", func(contract.Context) {})

	registered := registeredRoutes(app)
	assert.Len(t, registered, len(app.Config().RequestMethods))
	assert.Contains(t, registered, "GET /anything")
	assert.Contains(t, registered, "POST /anything")
	assert.Contains(t, registered, "HEAD /anything")
}

// TestRoutesGroupPathsMatchJoinArithmetic pins the path arithmetic.
// getGroupPath drops a trailing slash the caller asked for, and several
// registered routes end in one.
func TestRoutesGroupPathsMatchJoinArithmetic(t *testing.T) {
	server, app := newTestEngine(t)
	noop := func(contract.Context) {}

	api := server.Group("/api")
	api.GET("/status", noop)

	logs := api.Group("/log")
	logs.GET("/", noop)

	// A prefix without a leading slash, as the video router registers.
	jimeng := server.Group("jimeng")
	jimeng.POST("/", noop)

	// A group with an empty prefix, as the relay router uses to scope
	// middleware without adding a path segment.
	v1 := server.Group("/v1")
	inner := v1.Group("")
	inner.POST("/chat/completions", noop)

	// The wildcard is registered bare: fiber parses "/*path" as a wildcard
	// followed by the literal text "path", which matches nothing this route is
	// for. See TestRoutesWildcardIsRegisteredBare.
	v1.POST("/models/*path", noop)

	assert.Equal(t, []string{
		"GET /api/log/",
		"GET /api/status",
		"POST /jimeng/",
		"POST /v1/chat/completions",
		"POST /v1/models/*",
	}, registeredRoutes(app))
}

// TestRoutesWildcardIsRegisteredBare is the one registration difference from the
// previous transport that is observable, and it is a deliberate trade.
//
// The previous transport spells a catch-all "/*path" and resolves it as
// Param("path"). fiber spells it "/*" and does not ignore trailing text: it
// parses "/*path" as a wildcard followed by the literal "path", so POST /v1beta/models/gemini-pro:generateContent
// does not match "/v1beta/models/*path" at all -- verified, it answers 404.
// Registering the previous spelling verbatim would therefore break every Gemini relay
// request, which is strictly worse than changing the registered path string. So
//
// Consequence for the route snapshot: the three wildcard routes appear as "/*"
// rather than "/*path". testdata/routes_*.txt is not updated here; W3 owns that
// decision when it switches the snapshot test onto this adapter.
func TestRoutesWildcardIsRegisteredBare(t *testing.T) {
	server, app := newTestEngine(t)
	server.POST("/v1beta/models/*path", func(contract.Context) {})

	routes := app.GetRoutes(true)
	require.Len(t, routes, 1)
	assert.Equal(t, "/v1beta/models/*", routes[0].Path)
	assert.Equal(t, []string{"*1"}, routes[0].Params)
}

// TestRoutesWildcardMatchesAColonSuffixedPath is why the translation exists: the
// Gemini relay path is the shape fiber's parser mishandles.
func TestRoutesWildcardMatchesAColonSuffixedPath(t *testing.T) {
	server, app := newTestEngine(t)
	matched := make(chan string, 1)
	server.POST("/v1beta/models/*path", func(c contract.Context) {
		name, _ := WildcardParam(mustUnwrapForTest(t, c))
		matched <- name
		_ = c.String(http.StatusOK, "relayed")
	})
	server.NoRoute(func(c contract.Context) { _ = c.String(http.StatusNotFound, "fallback") })

	response := requestPath(t, app, http.MethodPost, "/v1beta/models/gemini-pro:generateContent")
	assert.Equal(t, http.StatusOK, response.StatusCode,
		"registering the previous transport's spelling verbatim makes this 404")
	assert.Equal(t, "relayed", readBody(t, response))
	assert.Equal(t, "path", <-matched,
		"the original wildcard name must reach the context layer")
}

func mustUnwrapForTest(t *testing.T, c contract.Context) fiber.Ctx {
	t.Helper()
	fiberCtx, ok := Unwrap(c)
	require.True(t, ok)
	return fiberCtx
}

func registeredRoutes(app *fiber.App) []string {
	registered := make([]string, 0)
	for _, route := range app.GetRoutes(true) {
		registered = append(registered, route.Method+" "+route.Path)
	}
	sort.Strings(registered)
	return registered
}

func readBody(t *testing.T, response *http.Response) string {
	t.Helper()
	defer func() { _ = response.Body.Close() }()
	body, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	return string(body)
}

// ---- lifecycle ----

// TestServeAndShutdown drives a real listener: Serve has to bind, a request has
// to be answered on it, and Shutdown has to return the server to a stopped state
// without Serve reporting the graceful stop as an error.
func TestServeAndShutdown(t *testing.T) {
	server, _ := newTestEngine(t)
	server.GET("/live", func(c contract.Context) {
		_ = c.String(http.StatusOK, "live")
	})

	addr := freeAddr(t)
	served := make(chan error, 1)
	go func() { served <- server.Serve(addr) }()

	waitForListener(t, addr)

	response, err := http.Get("http://" + addr + "/live")
	require.NoError(t, err)
	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Equal(t, "live", readBody(t, response))

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	require.NoError(t, server.Shutdown(ctx))

	select {
	case err := <-served:
		assert.NoError(t, err, "a graceful shutdown must not be reported as an error")
	case <-time.After(5 * time.Second):
		t.Fatal("Serve did not return after Shutdown")
	}
}

// TestShutdownWithoutServeSucceeds keeps startup failure paths simple: the
// process shuts the engine down on a failed boot, before Serve ran, and fiber
// reports that as an error.
func TestShutdownWithoutServeSucceeds(t *testing.T) {
	server, _ := newTestEngine(t)
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	assert.NoError(t, server.Shutdown(ctx))
}

// TestServeReportsBindFailure keeps a real failure a failure: the contract
// swallows only the graceful stop.
func TestServeReportsBindFailure(t *testing.T) {
	server, _ := newTestEngine(t)
	assert.Error(t, server.Serve("256.256.256.256:1"))
}

func freeAddr(t *testing.T) string {
	t.Helper()
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	addr := listener.Addr().String()
	require.NoError(t, listener.Close())
	return addr
}

func waitForListener(t *testing.T, addr string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		conn, err := net.DialTimeout("tcp", addr, 100*time.Millisecond)
		if err == nil {
			require.NoError(t, conn.Close())
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatalf("listener on %s never came up", addr)
}

// ---- SPA fall-through and the 405 branch ----

// stubAssets is contract.AssetFS over an in-memory file set.
type stubAssets struct {
	files map[string]string
}

func (s stubAssets) Exists(prefix string, path string) bool {
	_, held := s.files[path]
	return held
}

func (s stubAssets) Open(name string) (http.File, error) {
	content, held := s.files[name]
	if !held {
		return nil, os.ErrNotExist
	}
	return &stubFile{Reader: bytes.NewReader([]byte(content)), name: name, size: int64(len(content))}, nil
}

type stubFile struct {
	*bytes.Reader
	name string
	size int64
}

func (f *stubFile) Close() error                       { return nil }
func (f *stubFile) Readdir(int) ([]os.FileInfo, error) { return nil, os.ErrNotExist }
func (f *stubFile) Stat() (os.FileInfo, error)         { return f, nil }
func (f *stubFile) Name() string                       { return f.name }
func (f *stubFile) Size() int64                        { return f.size }
func (f *stubFile) Mode() os.FileMode                  { return 0o444 }
func (f *stubFile) ModTime() time.Time                 { return time.Time{} }
func (f *stubFile) IsDir() bool                        { return false }
func (f *stubFile) Sys() any                           { return nil }

// webEngine mirrors what the process assembles: business routes first, then the
// asset filesystem and the SPA fallback last.
func webEngine(t *testing.T) (contract.Engine, *fiber.App) {
	t.Helper()
	server, app := newTestEngine(t)

	server.GET("/api/status", func(c contract.Context) {
		_ = c.String(http.StatusOK, "status")
	})
	server.GET("/channels", func(c contract.Context) {
		_ = c.String(http.StatusOK, "channels")
	})

	server.ServeAssets("/", stubAssets{files: map[string]string{
		"/assets/app.js": "console.log('app')",
	}})
	server.NoRoute(func(c contract.Context) {
		c.Set("route_tag", "web")
		uri := c.RequestURI()
		if strings.HasPrefix(uri, "/v1") || strings.HasPrefix(uri, "/api") || strings.HasPrefix(uri, "/assets") {
			_ = c.JSON(http.StatusNotFound, map[string]string{"type": "not_found"})
			return
		}
		c.SetHeader("Cache-Control", "no-cache")
		_ = c.Data(http.StatusOK, "text/html; charset=utf-8", []byte("<html>index</html>"))
	})
	return server, app
}

func TestServeAssetsAnswersAHeldPath(t *testing.T) {
	_, app := webEngine(t)

	response := requestPath(t, app, http.MethodGet, "/assets/app.js")
	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Equal(t, "console.log('app')", readBody(t, response))
}

// TestServeAssetsFallsThroughOnAMiss is the difference from fiber's filesystem
// middleware, which writes 404 before continuing and would leave the fallback
// rendering the index under a 404.
func TestServeAssetsFallsThroughOnAMiss(t *testing.T) {
	_, app := webEngine(t)

	response := requestPath(t, app, http.MethodGet, "/dashboard/tokens")
	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Equal(t, "<html>index</html>", readBody(t, response))
	assert.Equal(t, "no-cache", response.Header.Get("Cache-Control"))
}

// TestNoRouteRunsAfterEveryRegisteredRoute keeps the terminal route terminal:
// registering it before the business routes would shadow all of them, because
// fiber stops its stack scan at the first match.
func TestNoRouteRunsAfterEveryRegisteredRoute(t *testing.T) {
	_, app := webEngine(t)

	response := requestPath(t, app, http.MethodGet, "/api/status")
	assert.Equal(t, http.StatusOK, response.StatusCode)
	assert.Equal(t, "status", readBody(t, response))
}

// TestNoRouteSplitsApiPathsFromTheSpaIndex pins the fallback's own branch: an
// API-shaped miss is a JSON 404, anything else is the SPA index.
func TestNoRouteSplitsApiPathsFromTheSpaIndex(t *testing.T) {
	_, app := webEngine(t)

	response := requestPath(t, app, http.MethodGet, "/api/missing")
	assert.Equal(t, http.StatusNotFound, response.StatusCode)
	assert.Contains(t, readBody(t, response), "not_found")
}

// TestMethodNotAllowedFallsIntoNoRoute is the 405 question, pinned.
//
// The previous transport ran with HandleMethodNotAllowed false, so POST to a
// path that only has a GET route falls into the no-route chain and is answered
// with the SPA index.
// fiber's app.next raises ErrMethodNotAllowed for exactly that case, which would
// have made this a 405. The terminal route matches every method, so app.next
// finds it and never reaches that branch: the divergence does not ship.
func TestMethodNotAllowedFallsIntoNoRoute(t *testing.T) {
	_, app := webEngine(t)

	response := requestPath(t, app, http.MethodPost, "/channels")
	assert.Equal(t, http.StatusOK, response.StatusCode,
		"a wrong-method request must reach the SPA fallback")
	assert.Equal(t, "<html>index</html>", readBody(t, response))
	assert.Empty(t, response.Header.Get("Allow"),
		"fiber's 405 path sets Allow; seeing it would mean the fallback was bypassed")
}

// TestNoRouteReplacesAnEarlierFallback matches the NoRoute semantics: a second
// call replaces the chain rather than appending to it.
func TestNoRouteReplacesAnEarlierFallback(t *testing.T) {
	server, app := newTestEngine(t)
	server.NoRoute(func(c contract.Context) { _ = c.String(http.StatusOK, "first") })
	server.NoRoute(func(c contract.Context) { _ = c.String(http.StatusOK, "second") })

	response := requestPath(t, app, http.MethodGet, "/anything")
	assert.Equal(t, "second", readBody(t, response))
}

// TestFallbackRunsEngineMiddleware keeps the engine's middleware in front of the
// fallback, as the previous transport did: allNoRoute is the engine's middleware
// plus the no-route chain, so a request that matched nothing still gets the
// request id and the access log.
func TestFallbackRunsEngineMiddleware(t *testing.T) {
	server, app := newTestEngine(t)
	server.Use(func(c contract.Context) {
		c.SetHeader("X-Engine-Middleware", "ran")
		c.Next()
	})
	server.NoRoute(func(c contract.Context) { _ = c.String(http.StatusOK, "fallback") })

	response := requestPath(t, app, http.MethodGet, "/anything")
	assert.Equal(t, "ran", response.Header.Get("X-Engine-Middleware"))
}

// TestFallbackRunsMiddlewareMountedAfterTheFallback covers the ordering the
// previous transport got from rebuilding allNoRoute whenever the engine's
// middleware changes.
func TestFallbackRunsMiddlewareMountedAfterTheFallback(t *testing.T) {
	server, app := newTestEngine(t)
	server.NoRoute(func(c contract.Context) { _ = c.String(http.StatusOK, "fallback") })
	server.Use(func(c contract.Context) {
		c.SetHeader("X-Late-Middleware", "ran")
		c.Next()
	})

	response := requestPath(t, app, http.MethodGet, "/anything")
	assert.Equal(t, "ran", response.Header.Get("X-Late-Middleware"))
}

func requestPath(t *testing.T, app *fiber.App, method, path string) *http.Response {
	t.Helper()
	return request(t, app, httptest.NewRequest(method, path, nil), "127.0.0.1:12345")
}

// ---- CORS ----

func corsEngine(t *testing.T) (contract.Engine, *fiber.App) {
	t.Helper()
	server, app := newTestEngine(t)
	scope := server.Group("/usage")
	scope.UseCORS()
	scope.GET("/token", func(c contract.Context) { _ = c.String(http.StatusOK, "usage") })
	server.GET("/plain", func(c contract.Context) { _ = c.String(http.StatusOK, "plain") })
	return server, app
}

// TestUseCORSAllowsEveryOriginWithCredentials is the combination fiber's own cors
// middleware refuses with a construction-time panic, which is why the policy is
// hand-written.
func TestUseCORSAllowsEveryOriginWithCredentials(t *testing.T) {
	_, app := corsEngine(t)

	req := httptest.NewRequest(http.MethodGet, "/usage/token", nil)
	req.Header.Set("Origin", "https://dashboard.example")
	response := request(t, app, req, "127.0.0.1:12345")

	assert.Equal(t, "*", response.Header.Get("Access-Control-Allow-Origin"))
	assert.Equal(t, "true", response.Header.Get("Access-Control-Allow-Credentials"))
}

// TestUseCORSPreflightSendsLiteralWildcardHeaders pins two divergences from
// fiber's middleware: the literal "*" for Allow-Headers where fiber echoes the
// requested headers, and the Max-Age fiber omits.
//
// The policy is mounted at engine scope and the fallback is registered, because
// that is the only arrangement in which a preflight reaches CORS at all. No
// OPTIONS route is registered anywhere in this application, so a preflight
// matches no route and lands in the fallback, which carries the engine's
// middleware and not a group's. The relay router mounts CORS at engine scope for
// exactly this reason; the two group-scoped calls never see a preflight under
// either framework.
func TestUseCORSPreflightSendsLiteralWildcardHeaders(t *testing.T) {
	server, app := newTestEngine(t)
	server.UseCORS()
	server.GET("/v1/models", func(c contract.Context) { _ = c.String(http.StatusOK, "models") })
	server.NoRoute(func(c contract.Context) { _ = c.String(http.StatusOK, "index") })

	req := httptest.NewRequest(http.MethodOptions, "/v1/models", nil)
	req.Header.Set("Origin", "https://dashboard.example")
	req.Header.Set("Access-Control-Request-Headers", "anthropic-version")
	response := request(t, app, req, "127.0.0.1:12345")

	assert.Equal(t, http.StatusNoContent, response.StatusCode)
	assert.Equal(t, "*", response.Header.Get("Access-Control-Allow-Headers"))
	assert.Equal(t, "GET,POST,PUT,DELETE,OPTIONS", response.Header.Get("Access-Control-Allow-Methods"))
	assert.Equal(t, "43200", response.Header.Get("Access-Control-Max-Age"))
}

// TestUseCORSSendsNothingForANonCrossOriginRequest is the CORS short-circuit,
// which fiber's middleware has no branch for.
func TestUseCORSSendsNothingForANonCrossOriginRequest(t *testing.T) {
	_, app := corsEngine(t)

	t.Run("no origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/usage/token", nil)
		response := request(t, app, req, "127.0.0.1:12345")
		assert.Empty(t, response.Header.Get("Access-Control-Allow-Origin"))
		assert.Empty(t, response.Header.Get("Access-Control-Allow-Credentials"))
	})

	t.Run("same origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/usage/token", nil)
		req.Host = "dashboard.example"
		req.Header.Set("Origin", "https://dashboard.example")
		response := request(t, app, req, "127.0.0.1:12345")
		assert.Empty(t, response.Header.Get("Access-Control-Allow-Origin"))
	})
}

// TestUseCORSIsScopedToItsGroup keeps the per-group policy: two API groups
// enable CORS and the rest of the API does not.
func TestUseCORSIsScopedToItsGroup(t *testing.T) {
	_, app := corsEngine(t)

	req := httptest.NewRequest(http.MethodGet, "/plain", nil)
	req.Header.Set("Origin", "https://dashboard.example")
	response := request(t, app, req, "127.0.0.1:12345")

	assert.Empty(t, response.Header.Get("Access-Control-Allow-Origin"),
		"a scope that did not ask for CORS must not send CORS headers")
}

// ---- compression ----

// TestUseCompressionCompressesABufferedResponse is the baseline: the capability
// has to actually compress, or the skip rules below would pass trivially.
func TestUseCompressionCompressesABufferedResponse(t *testing.T) {
	server, app := newTestEngine(t)
	server.UseCompression()
	server.GET("/text", func(c contract.Context) {
		_ = c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(strings.Repeat("compress me ", 64)))
	})

	req := httptest.NewRequest(http.MethodGet, "/text", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	response := request(t, app, req, "127.0.0.1:12345")

	assert.Equal(t, "gzip", response.Header.Get("Content-Encoding"))
}

// TestSkipCompressionRules covers the gzip shouldCompress decision table
// directly. The Upgrade and SSE rules are the ones that keep a streaming
// response from being materialised and truncated.
func TestSkipCompressionRules(t *testing.T) {
	for _, testCase := range []struct {
		name    string
		path    string
		headers map[string]string
		skipped bool
	}{
		{
			name:    "compressible",
			path:    "/api/status",
			headers: map[string]string{"Accept-Encoding": "gzip"},
			skipped: false,
		},
		{
			name:    "client does not accept gzip",
			path:    "/api/status",
			headers: map[string]string{"Accept-Encoding": "br"},
			skipped: true,
		},
		{
			name:    "connection upgrade",
			path:    "/v1/realtime",
			headers: map[string]string{"Accept-Encoding": "gzip", "Connection": "Upgrade"},
			skipped: true,
		},
		{
			name:    "server sent events",
			path:    "/v1/chat/completions",
			headers: map[string]string{"Accept-Encoding": "gzip", "Accept": "text/event-stream"},
			skipped: true,
		},
		{
			name:    "excluded extension",
			path:    "/assets/logo.png",
			headers: map[string]string{"Accept-Encoding": "gzip"},
			skipped: true,
		},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			probe := fiber.New(fiber.Config{})
			observed := false
			probe.Add([]string{http.MethodGet}, "/+", func(c fiber.Ctx) error {
				observed = skipCompression(c)
				return c.SendStatus(http.StatusOK)
			})

			req := httptest.NewRequest(http.MethodGet, testCase.path, nil)
			for name, value := range testCase.headers {
				req.Header.Set(name, value)
			}
			response, err := probe.Test(req, fiber.TestConfig{Timeout: 5 * time.Second})
			require.NoError(t, err)
			require.Equal(t, http.StatusOK, response.StatusCode)
			assert.Equal(t, testCase.skipped, observed)
		})
	}
}

// TestSkipCompressionSkipsAStreamedResponse is the rule with no counterpart in
// the previous transport. The previous transport wrapped the response writer so
// a stream compressed incrementally; fiber compresses a materialised body, which
// for a stream would mean draining the pipe the chain is still writing into.
func TestSkipCompressionSkipsAStreamedResponse(t *testing.T) {
	server, app := newTestEngine(t)
	server.UseCompression()
	server.GET("/stream", func(c contract.Context) {
		stream := c.EventStream()
		require.NotNil(t, stream)
		stream.SetHeaders()
		_, err := stream.WriteRaw([]byte(strings.Repeat("streamed chunk ", 64)))
		require.NoError(t, err)
		require.NoError(t, stream.Flush())
	})

	req := httptest.NewRequest(http.MethodGet, "/stream", nil)
	req.Header.Set("Accept-Encoding", "gzip")
	response := request(t, app, req, "127.0.0.1:12345")

	assert.Empty(t, response.Header.Get("Content-Encoding"),
		"compressing a streamed response would drain the pipe the chain is still writing into")
	assert.Contains(t, readBody(t, response), "streamed chunk")
}

// ---- helmet and etag ----

// TestHelmetSetsSecurityHeaders pins the security headers the engine sends on
// every response. The client-IP resolver stays first, helmet runs next, and
// nothing afterwards removes the headers. ContentSecurityPolicy is absent
// because its config is deliberately empty: the SPA supplies its own policy.
func TestHelmetSetsSecurityHeaders(t *testing.T) {
	server, app := newTestEngine(t)
	server.GET("/security-headers", func(c contract.Context) {
		_ = c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte("ok"))
	})

	req := httptest.NewRequest(http.MethodGet, "/security-headers", nil)
	response := request(t, app, req, "127.0.0.1:12345")

	require.Equal(t, http.StatusOK, response.StatusCode)
	assert.Equal(t, "nosniff", response.Header.Get("X-Content-Type-Options"))
	assert.Equal(t, "SAMEORIGIN", response.Header.Get("X-Frame-Options"))
	assert.Equal(t, "strict-origin-when-cross-origin", response.Header.Get("Referrer-Policy"))
	assert.Empty(t, response.Header.Get("Content-Security-Policy"))
}

// TestETagSendsWeakValidatorAndHonorsIfNoneMatch: the first response carries a
// weak ETag over the fixed JSON body. Repeating the request with
// If-None-Match set to that ETag returns 304 with an empty body and the same
// ETag. The validator is weak because the body passes through the repo's own
// compression layer afterwards, which changes the bytes.
func TestETagSendsWeakValidatorAndHonorsIfNoneMatch(t *testing.T) {
	server, app := newTestEngine(t)
	server.GET("/etag", func(c contract.Context) {
		_ = c.Data(http.StatusOK, "application/json", []byte(`{"status":"ok"}`))
	})

	req := httptest.NewRequest(http.MethodGet, "/etag", nil)
	response := request(t, app, req, "127.0.0.1:12345")

	require.Equal(t, http.StatusOK, response.StatusCode)
	etag := response.Header.Get("ETag")
	require.NotEmpty(t, etag, "the first response must carry an ETag")
	assert.True(t, strings.HasPrefix(etag, "W/"), "content-coding changes the body, so the validator is weak")

	req = httptest.NewRequest(http.MethodGet, "/etag", nil)
	req.Header.Set("If-None-Match", etag)
	response = request(t, app, req, "127.0.0.1:12345")

	require.Equal(t, http.StatusNotModified, response.StatusCode)
	assert.Empty(t, readBody(t, response), "a 304 response carries no body")
	assert.Equal(t, etag, response.Header.Get("ETag"), "the ETag is sent on both 200 and 304 responses")
}

// TestETagSkipsServerSentEvents: an event-stream response passes through the
// etag middleware untouched -- no ETag header, and the frame still reaches
// the client because the middleware skips event streams itself instead of
// buffering them to hash.
func TestETagSkipsServerSentEvents(t *testing.T) {
	server, app := newTestEngine(t)
	server.GET("/events", func(c contract.Context) {
		stream := c.EventStream()
		require.NotNil(t, stream)
		stream.SetHeaders()
		_, err := stream.WriteRaw([]byte("data: hello\n\n"))
		require.NoError(t, err)
		require.NoError(t, stream.Flush())
	})

	req := httptest.NewRequest(http.MethodGet, "/events", nil)
	response := request(t, app, req, "127.0.0.1:12345")

	require.Equal(t, http.StatusOK, response.StatusCode)
	assert.Empty(t, response.Header.Get("ETag"), "the etag middleware skips event streams itself")
	assert.Contains(t, readBody(t, response), "data: hello")
}

// ---- access log ----

// TestUseRequestLogRendersTheCompletedRequest pins the field mapping the process
// log line depends on, including the per-request Values that carry the request id
// and the route tag.
func TestUseRequestLogRendersTheCompletedRequest(t *testing.T) {
	server, app := newTestEngine(t)

	logged := make(chan contract.RequestLog, 1)
	server.UseRequestLog(func(entry contract.RequestLog) string {
		logged <- entry
		return ""
	})
	server.GET("/logged", func(c contract.Context) {
		c.Set("route_tag", "api")
		c.Set("X-Request-Id", "req-1")
		_ = c.String(http.StatusTeapot, "logged")
	})

	req := httptest.NewRequest(http.MethodGet, "/logged?verbose=1", nil)
	response := request(t, app, req, "127.0.0.1:12345")
	assert.Equal(t, http.StatusTeapot, response.StatusCode)

	select {
	case entry := <-logged:
		assert.Equal(t, http.StatusTeapot, entry.StatusCode)
		assert.Equal(t, http.MethodGet, entry.Method)
		assert.Equal(t, "/logged?verbose=1", entry.Path,
			"the access log appends the raw query to the path")
		assert.Equal(t, "127.0.0.1", entry.ClientIP)
		assert.Equal(t, "api", entry.Values["route_tag"])
		assert.Equal(t, "req-1", entry.Values["X-Request-Id"])
		assert.Positive(t, entry.Latency)
		assert.False(t, entry.Timestamp.IsZero())
	case <-time.After(5 * time.Second):
		t.Fatal("no log line was rendered")
	}
}

// ---- panic recovery ----

// TestRecoveryHandsThePanicToTheRenderer is why recovery is a contract handler:
// fiber's own recover middleware never gives the recovered value to a renderer,
// and a fiber-level recover could not catch a panic on Dispatch's goroutine at
// all.
func TestRecoveryHandsThePanicToTheRenderer(t *testing.T) {
	recovered := make(chan any, 1)
	server := NewEngine(func(c contract.Context, value any) {
		recovered <- value
		c.AbortWithStatusJSON(http.StatusInternalServerError, map[string]string{"type": "new_api_panic"})
	})
	adapted, ok := server.(engine)
	require.True(t, ok)

	server.GET("/boom", func(contract.Context) { panic("boom") })

	req := httptest.NewRequest(http.MethodGet, "/boom", nil)
	response := request(t, adapted.app, req, "127.0.0.1:12345")

	assert.Equal(t, http.StatusInternalServerError, response.StatusCode)
	assert.Contains(t, readBody(t, response), "new_api_panic")

	select {
	case value := <-recovered:
		assert.Equal(t, "boom", value)
	case <-time.After(5 * time.Second):
		t.Fatal("the panic never reached the renderer")
	}
}

// TestRecoverySkipsTheRendererOnABrokenPipe reproduces the recovery branch: a dead
// connection cannot be written to, so calling the renderer would only produce a
// second failure.
func TestRecoverySkipsTheRendererOnABrokenPipe(t *testing.T) {
	rendered := make(chan struct{}, 1)
	server := NewEngine(func(c contract.Context, value any) {
		rendered <- struct{}{}
	})
	adapted, ok := server.(engine)
	require.True(t, ok)

	server.GET("/broken", func(contract.Context) {
		panic(&net.OpError{Op: "write", Err: os.NewSyscallError("write", syscall.EPIPE)})
	})

	req := httptest.NewRequest(http.MethodGet, "/broken", nil)
	_ = request(t, adapted.app, req, "127.0.0.1:12345")

	select {
	case <-rendered:
		t.Fatal("a broken pipe must not reach the renderer: the connection is gone")
	case <-time.After(200 * time.Millisecond):
	}
}
