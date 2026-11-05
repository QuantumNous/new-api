// Package fiberadapter implements the transport contract on fiber/fasthttp.
//
// Two structural differences are load-bearing and deliberate.
//
// First, contract middleware never enters fiber's own handler stack. Dispatch
// commits the response and returns while the contract chain may still be
// running on another goroutine (that is what lets fasthttp drain a body stream
// under real backpressure), and fiber recycles its Ctx into a pool as
// soon as the handler returns. A contract middleware mounted through app.Use
// would therefore resume after Next against a Ctx that already belongs to a
// different request. So the chain is flattened the way the previous transport
// flattened group handlers: routes accumulates the pending handlers, and
// every concrete route becomes exactly one fiber handler holding the whole
// chain. Registration order is preserved by construction, which is what
// contract.Routes requires anyway.
//
// Second, and following from the first: CORS, access logging and panic recovery
// are contract handlers in that flattened chain rather than engine-level
// middleware. Recovery has no alternative -- a recover() in a fiber handler
// cannot catch a panic raised on Dispatch's goroutine, so mounting it there
// would turn a handler panic into a process crash. Only genuinely fiber-native
// layers (compression, the asset probe, the fallback route) use app.Use.
package fiberadapter

import (
	"errors"
	"fmt"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"os"
	"path"
	"path/filepath"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/internal/transport/contract"

	"github.com/gofiber/fiber/v3"
	"github.com/valyala/fasthttp"
)

// trustedProxies is the engine's proxy policy, consulted by ResolvedClientIP.
//
// It is a pointer to an immutable value swapped wholesale by TrustProxies so a
// concurrent request either sees the previous policy or the next one, never a
// half-rebuilt slice. TrustProxies is called once during startup, before the
// listener exists, but the engine is copied by value into every closure that
// holds it and there is no reason to make the read racy.
type proxyPolicy struct {
	// exact holds the bare addresses in their parsed form. The previous transport promoted a bare address to a /32 or /128 CIDR rather than comparing strings, which is why
	// a non-canonical IPv6 spelling still matches; fiber's own implementation keys a map on the literal string and misses. Keeping net.IP values here reproduces that.
	exact  []net.IP
	ranges []*net.IPNet
}

// trusted reports whether ip may set a forwarded header.
//
// A nil policy trusts nothing, which is the contract's requirement for a nil or
// empty CIDR list and the opposite of fiber's IsProxyTrusted, whose unconfigured
// state trusts every peer.
func (p *proxyPolicy) trusted(ip net.IP) bool {
	if p == nil || ip == nil {
		return false
	}
	for _, candidate := range p.exact {
		if candidate.Equal(ip) {
			return true
		}
	}
	for _, network := range p.ranges {
		if network.Contains(ip) {
			return true
		}
	}
	return false
}

// forwardedIPHeaders is the RemoteIPHeaders default, in order. Fiber's
// ProxyHeader config holds a single header name and has no fallback, so the
// list is walked here instead.
var forwardedIPHeaders = [...]string{fiber.HeaderXForwardedFor, "X-Real-IP"}

// clientIPKey addresses the resolved client IP in the request's Locals.
//
// The type is unexported and empty so nothing outside this package can collide
// with it or read it back out.
type clientIPKey struct{}

// ResolvedClientIP returns the client address the engine resolved for c, and
// whether the engine resolved one at all.
//
// The context implementation calls this rather than fiber's Ctx.IP, which
// returns whatever ProxyHeader names without consulting the trust policy and
// therefore hands an attacker control of the value.
func ResolvedClientIP(c fiber.Ctx) (string, bool) {
	resolved, ok := c.Locals(clientIPKey{}).(string)
	return resolved, ok
}

// resolveTrustedClientIP reproduces the previous transport's client-IP
// resolution against a fiber request.
//
// The peer address is authoritative unless it is a trusted proxy, in which case
// the forwarded chain is walked right to left and the first entry that is
// either the leftmost one or not itself a trusted proxy wins. Walking from the
// right is what makes the result unforgeable: a client can prepend entries, but
// everything it prepends sits to the left of the addresses the trusted hops
// appended, so the walk stops before reaching them.
//
// Neither of fiber's two modes reproduces this. EnableIPValidation=false hands
// back the raw header including its commas; EnableIPValidation=true returns the
// leftmost entry, which is precisely the forgeable one.
func resolveTrustedClientIP(c fiber.Ctx, policy *proxyPolicy) string {
	peer := c.RequestCtx().RemoteIP()
	if peer == nil {
		return ""
	}
	if !policy.trusted(peer) {
		return peer.String()
	}
	for _, header := range forwardedIPHeaders {
		if forwarded, ok := walkForwardedChain(c.Get(header), policy); ok {
			return forwarded
		}
	}
	return peer.String()
}

// walkForwardedChain returns the client address a forwarded header attests to.
//
// It matches the previous header validation, including the detail that an
// unparseable entry abandons the whole header rather than being skipped: a
// malformed hop means the chain cannot be reasoned about past that point.
func walkForwardedChain(header string, policy *proxyPolicy) (string, bool) {
	if header == "" {
		return "", false
	}
	items := strings.Split(header, ",")
	for i := len(items) - 1; i >= 0; i-- {
		item := strings.TrimSpace(items[i])
		ip := net.ParseIP(item)
		if ip == nil {
			break
		}
		if i == 0 || !policy.trusted(ip) {
			return item, true
		}
	}
	return "", false
}

// parseProxyPolicy validates a trusted-proxy list and compiles it.
//
// Validation happens here because fiber's own handleTrustedProxy reports a bad
// CIDR with a log warning and carries on, which would turn a typo in
// TRUSTED_PROXIES into a silently narrower policy. The contract says
// TrustProxies returns an error, and ConfigureTrustedProxies makes startup fail
// on it.
func parseProxyPolicy(cidrs []string) (*proxyPolicy, error) {
	if len(cidrs) == 0 {
		return nil, nil
	}
	policy := &proxyPolicy{}
	for _, entry := range cidrs {
		if !strings.Contains(entry, "/") {
			ip := net.ParseIP(entry)
			if ip == nil {
				return nil, &net.ParseError{Type: "IP address", Text: entry}
			}
			policy.exact = append(policy.exact, ip)
			continue
		}
		_, network, err := net.ParseCIDR(entry)
		if err != nil {
			return nil, err
		}
		policy.ranges = append(policy.ranges, network)
	}
	return policy, nil
}

// joinRoutePath is the route-path joiner, replacing the previous transport's joinPaths.
//
// fiber's own getGroupPath trims the parent's trailing slash and concatenates,
// which neither collapses a doubled separator nor preserves a trailing slash
// the caller asked for. Both matter: several registered routes end in a slash
// ("/api/log/", "/jimeng/") and the route set is pinned by snapshot.
func joinRoutePath(base, relative string) string {
	if relative == "" {
		return base
	}
	joined := path.Join(base, relative)
	if strings.HasSuffix(relative, "/") && !strings.HasSuffix(joined, "/") {
		return joined + "/"
	}
	return joined
}

// routes implements contract.Routes as an accumulating scope rather than a
// reference to a framework group.
//
// pending is the middleware mounted on this scope so far. It is copied on Group
// and replaced on Use, which reproduces the two ordering rules exactly:
// middleware applies to the routes registered after it, and a child group
// inherits whatever its parent held when the child was created. pending is never
// appended to in place, because that would let a later Use on a parent write
// into a child's backing array and retroactively add middleware to routes that
// were already registered.
type routes struct {
	app     *fiber.App
	prefix  string
	pending []contract.Handler
}

// Group returns a child scope holding a snapshot of this scope's middleware.
func (r routes) Group(prefix string) contract.Routes {
	inherited := make([]contract.Handler, len(r.pending))
	copy(inherited, r.pending)
	return &routes{
		app:     r.app,
		prefix:  joinRoutePath(r.prefix, prefix),
		pending: inherited,
	}
}

func (r *routes) Use(handlers ...contract.Chainable) {
	extended := make([]contract.Handler, 0, len(r.pending)+len(handlers))
	extended = append(extended, r.pending...)
	for _, handler := range handlers {
		extended = append(extended, handler)
	}
	r.pending = extended
}

// flatten materialises the complete chain for one route: the middleware mounted
// on this scope followed by the route's own handlers.
func (r routes) flatten(handlers []contract.Chainable) []contract.Handler {
	chain := make([]contract.Handler, 0, len(r.pending)+len(handlers))
	chain = append(chain, r.pending...)
	for _, handler := range handlers {
		chain = append(chain, handler)
	}
	return chain
}

// wildcardParamKey is the Locals key under which a route's wildcard parameter
// name is published, so the context layer can answer Param under the name the
// route was registered with.
type wildcardParamKey struct{}

// WildcardParam returns the name the matched route's trailing wildcard was
// registered under, when it had one.
//
// It exists because fiber and the previous transport disagree about wildcard
// syntax in a way that cannot be resolved at the path level alone. See fiberRoutePath.
func WildcardParam(c fiber.Ctx) (string, bool) {
	name, ok := c.Locals(wildcardParamKey{}).(string)
	return name, ok
}

// fiberRoutePath translates a route pattern from the previous transport's
// syntax into fiber's syntax and reports the name of a trailing named wildcard,
// when there is one.
//
// The previous transport spells a catch-all "/*name". fiber spells it "/*"
// and names the captured value positionally ("*1"), and it does not ignore
// what follows the star: it parses "/models/*path" as a wildcard followed by
// the literal text "path", so POST /v1beta/models/gemini-pro:generateContent
// does not match that route at all. Registering it verbatim would 404 every
// Gemini request rather than merely break Param("path").
//
// So the star is registered bare and the original name is carried separately.
// Only a trailing wildcard is translated, which is the only shape this
// application registers; a star anywhere else would change what the route
// matches and is left alone so it fails visibly rather than silently.
func fiberRoutePath(routePath string) (string, string, bool) {
	index := strings.LastIndex(routePath, "/*")
	if index < 0 || index+2 >= len(routePath) {
		return routePath, "", false
	}
	name := routePath[index+2:]
	if strings.ContainsAny(name, "/*:+") {
		return routePath, "", false
	}
	return routePath[:index] + "/*", name, true
}

// register mounts one route as a single fiber handler holding the whole chain.
//
// Every verb goes through App.Add because App.Get also registers HEAD, which
// would add a phantom HEAD route for every GET and change the registered route
// set.
func (r routes) register(method, routePath string, handlers []contract.Chainable) {
	full, handler := r.mount(routePath, handlers)
	r.app.Add([]string{method}, full, handler)
}

// mount builds the fiber route path and the single handler that runs the whole
// flattened chain for it.
func (r routes) mount(routePath string, handlers []contract.Chainable) (string, fiber.Handler) {
	chain := r.flatten(handlers)
	full, wildcard, named := fiberRoutePath(joinRoutePath(r.prefix, routePath))
	if !named {
		return full, func(c fiber.Ctx) error {
			return Dispatch(c, chain)
		}
	}
	return full, func(c fiber.Ctx) error {
		c.Locals(wildcardParamKey{}, wildcard)
		return Dispatch(c, chain)
	}
}

func (r routes) Handle(method, routePath string, handlers ...contract.Chainable) {
	r.register(method, routePath, handlers)
}

func (r routes) GET(routePath string, handlers ...contract.Chainable) {
	r.register(fiber.MethodGet, routePath, handlers)
}

func (r routes) POST(routePath string, handlers ...contract.Chainable) {
	r.register(fiber.MethodPost, routePath, handlers)
}

func (r routes) PUT(routePath string, handlers ...contract.Chainable) {
	r.register(fiber.MethodPut, routePath, handlers)
}

func (r routes) PATCH(routePath string, handlers ...contract.Chainable) {
	r.register(fiber.MethodPatch, routePath, handlers)
}

func (r routes) DELETE(routePath string, handlers ...contract.Chainable) {
	r.register(fiber.MethodDelete, routePath, handlers)
}

// Any registers the route for every method the transport routes. The previous
// transport's method list and fiber's DefaultMethods name the same nine verbs,
// so the registered set matches.
func (r routes) Any(routePath string, handlers ...contract.Chainable) {
	full, handler := r.mount(routePath, handlers)
	r.app.Add(r.app.Config().RequestMethods, full, handler)
}

// corsMaxAge is the Max-Age the previous CORS middleware emitted by default.
// Fiber's own middleware omits MaxAge by default, which would make browsers
// re-preflight every request.
const corsMaxAge = 12 * time.Hour

// corsAllowMethods are the five verbs the dashboard and the relay API issue.
var corsAllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}

// UseCORS mounts the cross-origin policy: every origin, with credentials, and
// any request header, because relay clients send vendor-specific headers
// (anthropic-version, x-goog-api-key) that cannot be enumerated here.
//
// It is hand-written rather than delegated to fiber's cors middleware because
// fiber panics at construction on a wildcard origin together with
// AllowCredentials, refusing the policy this service has always served. Three
// further behaviours diverge silently and are reproduced here: the previous
// CORS middleware sent the literal "Access-Control-Allow-Headers: *" where
// fiber echoes the requested headers back; it emitted no CORS header at all
// when the request had no Origin or an Origin equal to its own host, where
// fiber has no such branch; and it emitted Access-Control-Max-Age where fiber
// omits it.
//
// Mounting it in the contract chain rather than as an app.Use layer preserves
// the previous transport's per-group scoping. Two API groups enable CORS while the rest of /api
// does not, which a prefix-matched fiber layer could only approximate.
func (r *routes) UseCORS() {
	r.Use(func(c contract.Context) {
		origin := c.Header(fiber.HeaderOrigin)
		if origin == "" {
			// Not a CORS request.
			c.Next()
			return
		}
		host := c.Host()
		if origin == "http://"+host || origin == "https://"+host {
			// Same origin. A fetch call still sends Origin, but no CORS
			// response header is needed and the previous transport emitted none.
			c.Next()
			return
		}

		c.SetHeader("Access-Control-Allow-Origin", "*")
		c.SetHeader("Access-Control-Allow-Credentials", "true")

		if c.Method() == fiber.MethodOptions {
			c.SetHeader("Access-Control-Allow-Methods", strings.Join(corsAllowMethods, ","))
			c.SetHeader("Access-Control-Allow-Headers", "*")
			c.SetHeader("Access-Control-Max-Age", strconv.FormatInt(int64(corsMaxAge/time.Second), 10))
			// The previous transport answered the preflight itself and aborted with 204.
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	})
}

// compressionExcludedExtensions is the gzip middleware's default exclusion set.
var compressionExcludedExtensions = map[string]struct{}{
	".png":  {},
	".gif":  {},
	".jpeg": {},
	".jpg":  {},
}

// skipCompression reproduces the gzip middleware's shouldCompress.
//
// All four rules come from that middleware, evaluated before the handler runs:
// no gzip in Accept-Encoding, a Connection: Upgrade request, an SSE request,
// and an excluded file extension.
func skipCompression(c fiber.Ctx) bool {
	if !strings.Contains(c.Get(fiber.HeaderAcceptEncoding), "gzip") ||
		strings.Contains(c.Get(fiber.HeaderConnection), "Upgrade") ||
		strings.Contains(c.Get(fiber.HeaderAccept), "text/event-stream") {
		return true
	}
	_, excluded := compressionExcludedExtensions[filepath.Ext(c.Path())]
	return excluded
}

// UseCompression mounts response compression at the library's default level.
//
// This is the one capability that stays a fiber-native app.Use layer, because it
// has to transform the response after the handler produced it.
//
// fiber's compress middleware cannot be used directly. Its Next predicate is
// evaluated before the handler runs, but the decision that matters most here --
// whether the response was committed as a body stream -- is only knowable after
// it. The previous transport never needed the check: it wrapped the response writer, so a streaming
// handler compressed incrementally, whereas fiber materialises the body, which
// for a stream means draining the pipe the chain is still writing into and
// truncating it. So the gate is applied on both sides of the handler: the four
// Streamed is the transport's own answer, and it covers the raw ResponseStream endpoints (video content, the dashboard proxy) that no request header identifies.
//
// It therefore does not scope the way the other capabilities do. The previous
// transport mounted gzip per group; here it is registered for the prefix of the
// scope that asked for it.
// For the three callers (/api, and / twice) the effective coverage is the same,
// because the two root-scope callers already cover every path.
func (r *routes) UseCompression() {
	prefix := r.prefix
	if prefix == "" {
		prefix = "/"
	}
	// The same compressor fiber's own middleware builds for its default level:
	// brotli or gzip per the client's Accept-Encoding, at fasthttp's default
	// levels. It transforms an already-built response, so the inner handler is
	// empty.
	compressor := fasthttp.CompressHandlerBrotliLevel(
		func(*fasthttp.RequestCtx) {},
		fasthttp.CompressBrotliDefaultCompression,
		fasthttp.CompressDefaultCompression,
	)
	r.app.Use(prefix, func(c fiber.Ctx) error {
		if skipCompression(c) {
			return c.Next()
		}
		if err := c.Next(); err != nil {
			return err
		}
		if Streamed(c) {
			return nil
		}
		compressor(c.RequestCtx())
		return nil
	})
}

// recoverPanics is the first handler in every flattened chain.
//
// It must be a contract handler rather than a fiber layer: Dispatch may run the
// chain on another goroutine, and a recover() in the fiber handler cannot catch a
// panic raised there, so mounting recovery at the fiber level would turn a
// handler panic into a process crash. fiber's own recover middleware is
// unusable for a second reason -- it never hands the recovered value to a
// renderer, so the JSON error body this service returns could not be produced.
//
// The broken-pipe branch and the redacted header dump reproduce the previous
// recovery middleware's behaviour because fiber has neither: a
// dead connection cannot be written to, so calling the renderer would only
// produce a second failure, and the log line has to survive without leaking the
// caller's credentials.
func recoverPanics(onPanic func(c contract.Context, recovered any)) contract.Handler {
	logger := log.New(os.Stderr, "\n\n\x1b[31m", log.LstdFlags)
	return func(c contract.Context) {
		defer func() {
			recovered := recover()
			if recovered == nil {
				return
			}

			broken := isBrokenPipe(recovered)
			logger.Printf("[Recovery] %s panic recovered:\n%s\n%s\n%s\x1b[0m",
				time.Now().Format("2006/01/02 - 15:04:05"),
				redactedRequestDump(c),
				recovered,
				debug.Stack(),
			)
			if broken {
				// The connection is gone; there is no response to write.
				c.Abort()
				return
			}
			onPanic(c, recovered)
		}()
		c.Next()
	}
}

// isBrokenPipe reports whether a recovered value is a dead client connection
// rather than a defect, matching the previous check.
func isBrokenPipe(recovered any) bool {
	opErr, ok := recovered.(*net.OpError)
	if !ok {
		return false
	}
	var syscallErr *os.SyscallError
	if !errors.As(opErr, &syscallErr) {
		return false
	}
	message := strings.ToLower(syscallErr.Error())
	return strings.Contains(message, "broken pipe") ||
		strings.Contains(message, "connection reset by peer")
}

// redactedRequestDump renders the request headers for a panic log with the
// Authorization value replaced, as the previous transport did.
func redactedRequestDump(c contract.Context) string {
	dumped, err := httputil.DumpRequest(c.HTTPRequest(), false)
	if err != nil {
		return c.Method() + " " + c.RequestURI()
	}
	lines := strings.Split(string(dumped), "\r\n")
	for i, line := range lines {
		name, _, found := strings.Cut(line, ":")
		if found && name == "Authorization" {
			lines[i] = name + ": *"
		}
	}
	return strings.Join(lines, "\r\n")
}

// engine implements contract.Engine.
//
// Every field the lifecycle and the engine capabilities mutate is reached
// through a pointer, because contract.Engine is held by value: the process
// copies the value into closures and hands it to configuration functions, and
// all of those copies have to agree on which app they are talking about, which
// proxy policy is current, and which fallback chain the terminal route will run.
type engine struct {
	*routes
	policy   *proxyPolicyRef
	fallback *fallbackRef
}

// proxyPolicyRef holds the current proxy policy behind one indirection so
// TrustProxies can replace it wholesale.
type proxyPolicyRef struct {
	policy *proxyPolicy
}

// fallbackRef holds what the terminal route serves, so NoRoute and ServeAssets
// can be called in either order and NoRoute can be called more than once with
// the last call winning, as the previous transport's does.
//
// registered guards the fiber route itself. fiber scans its stack in
// registration order and stops at the first match, so a prefix route registered
// before the business routes would shadow all of them. The terminal route is
// therefore registered the first time a fallback is configured, which is after
// every business route because the process registers the web router last.
type fallbackRef struct {
	assets     contract.AssetFS
	prefix     string
	chain      []contract.Handler
	registered bool
}

// NoRoute installs the fallback for a request no route matched.
//
// The previous transport had an explicit no-route chain. fiber has no equivalent: an unmatched
// request becomes an error value from app.next that reaches the ErrorHandler,
// where a genuine 404 written by a business handler is indistinguishable from a
// routing miss. So the fallback is a terminal route, reached the same way the
// previous transport's was: by nothing else matching first.
//
// This makes the registration order in compose.SetRouter load-bearing.
// SetWebRouter is called last there, and it has to stay last: the terminal route
// matches every path, so any route registered after it would be unreachable.
//
// The terminal route also restores the previous method behaviour. The previous
// transport ran with HandleMethodNotAllowed false, so a request to an existing
// path with the wrong method falls into the no-route chain and is answered with
// the SPA index rather than a 405.
// always finds a match and never reaches the branch that raises
// ErrMethodNotAllowed, so the 405 divergence does not ship.
//
// The engine's own middleware is not captured here. The previous transport
// rebuilt allNoRoute from the engine's middleware whenever either that middleware
// or the no-route chain changed, so the fallback ran whatever the engine
// accumulated by the time the request arrived; the terminal handler reads it per
// request for the same reason.
func (e engine) NoRoute(handlers ...contract.Chainable) {
	chain := make([]contract.Handler, 0, len(handlers))
	for _, handler := range handlers {
		chain = append(chain, handler)
	}
	e.fallback.chain = chain
	e.registerFallback()
}

// registerFallback mounts the terminal route once.
//
// It is an app.Use layer rather than a wildcard route because a use layer
// matches every method: fiber's Add would need one registration per verb, and
// each would appear in GetRoutes and change the registered route set the
// snapshot pins.
func (e engine) registerFallback() {
	if e.fallback.registered {
		return
	}
	e.fallback.registered = true
	e.app.Use(e.serveFallback)
}

// TrustProxies compiles and installs the trusted-proxy policy.
//
// It validates the list itself: fiber accepts a malformed entry with a log
// warning, which would leave a typo in TRUSTED_PROXIES looking like a working
// configuration while quietly trusting fewer proxies than intended.
func (e engine) TrustProxies(cidrs []string) error {
	policy, err := parseProxyPolicy(cidrs)
	if err != nil {
		return err
	}
	e.policy.policy = policy
	return nil
}

// ServeAssets serves fs under prefix, falling through to the NoRoute fallback
// for a path fs does not hold.
//
// Neither fiber facility does this. app.Static takes a filesystem root as a
// string and cannot consume an AssetFS at all. v3's static middleware takes an
// fs.FS, but a miss there sets 404 before continuing, which would leave the
// fallback answering with a status already written. So the probe is
// hand-written: serveFallback gates on Exists, and sendAsset opens the file,
// substitutes index.html for a directory, and serves with http.ServeContent.
//
// The asset probe runs inside the terminal route rather than as its own layer
// so an asset request still passes through the engine middleware, which is
// what the previous transport did: static.Serve was mounted on the engine, so
// the engine's middleware preceded it.
func (e engine) ServeAssets(prefix string, fs contract.AssetFS) {
	e.fallback.assets = fs
	e.fallback.prefix = prefix
	e.registerFallback()
}

// UseRequestLog mounts access logging as the outermost contract handler.
//
// fiber's own logger middleware cannot express this: its Format is a template
// compiled into an internal handler chain, so a func(RequestLog) string has
// nowhere to go, and it owns the writer and calls the ErrorHandler itself.
//
// It is a contract handler rather than an app.Use layer for the reason the whole
// chain is flattened: a fiber layer resumes when Dispatch returns, which for a
// streamed response is before the stream finished, so the latency it measured
// would be the time to commit the response instead of the time to serve it. The
// previous transport measured the whole stream and this does too.
func (e engine) UseRequestLog(format func(contract.RequestLog) string) {
	e.Use(func(c contract.Context) {
		start := time.Now()
		path := c.Path()
		if raw := c.RawQuery(); raw != "" {
			path += "?" + redactQueryKeys(raw)
		}

		c.Next()

		finished := time.Now()
		fmt.Print(format(contract.RequestLog{
			Timestamp:  finished,
			StatusCode: c.ResponseStatus(),
			Latency:    finished.Sub(start),
			ClientIP:   c.ClientIP(),
			Method:     c.Method(),
			Path:       path,
			Values:     Values(c),
		}))
	})
}

// redactQueryKeys masks credential-bearing query parameters before they reach
// the access log. Values are replaced wholesale; names, order, and every other
// pair pass through byte-for-byte.
func redactQueryKeys(raw string) string {
	pairs := strings.Split(raw, "&")
	for i, pair := range pairs {
		name, _, hasValue := strings.Cut(pair, "=")
		if hasValue && (name == "key" || name == "mj-api-secret") {
			pairs[i] = name + "=REDACTED"
		}
	}
	return strings.Join(pairs, "&")
}

// serveFallback is the terminal route: the asset probe followed by the no-route
// chain, wrapped in whatever middleware the engine has accumulated.
//
// It reads the engine's pending middleware per request rather than closing over
// it, because the fiber route is registered before the process mounts its
// middleware and the previous transport's allNoRoute is likewise rebuilt as the
// engine's middleware grows.
func (e engine) serveFallback(c fiber.Ctx) error {
	fallback := e.fallback
	if fallback.assets != nil && fallback.assets.Exists(fallback.prefix, c.Path()) {
		// An asset hit still runs the engine middleware, matching the previous transport, where
		// static.Serve is mounted on the engine after it.
		chain := append(e.flatten(nil), func(cc contract.Context) {
			if err := sendAsset(cc, fallback); err != nil {
				cc.Status(http.StatusInternalServerError)
			}
		})
		return Dispatch(c, chain)
	}
	return Dispatch(c, append(e.flatten(nil), fallback.chain...))
}

// sendAsset serves one asset from fallback.assets.
//
// AssetFS is an http.FileSystem, but v3's static middleware takes an fs.FS
// and answers 404 on a miss before continuing, which would poison the
// fall-through to the NoRoute fallback, and v2's helper for this no longer
// exists in v3. This is hand-rolled instead: open the asset, substitute
// index.html for a directory, and serve with http.ServeContent, which derives
// the content type from the extension, sets Last-Modified, answers HEAD
// without a body, and converts If-Modified-Since into a 304 -- a deliberate
// improvement over v2, which had none of that.
func sendAsset(c contract.Context, fallback *fallbackRef) error {
	assetPath := strings.TrimPrefix(c.Path(), strings.TrimSuffix(fallback.prefix, "/"))
	if assetPath == "" {
		assetPath = "/"
	}
	file, err := fallback.assets.Open(assetPath)
	if errors.Is(err, fs.ErrNotExist) {
		return fiber.ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to open: %w", err)
	}
	defer file.Close()

	info, err := file.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat: %w", err)
	}

	if info.IsDir() {
		indexPath := strings.TrimRight(assetPath, "/") + "/index.html"
		indexFile, err := fallback.assets.Open(indexPath)
		if err == nil {
			defer indexFile.Close()
			indexInfo, statErr := indexFile.Stat()
			if statErr == nil && !indexInfo.IsDir() {
				file = indexFile
				info = indexInfo
			}
		}
		if info.IsDir() {
			return fiber.ErrForbidden
		}
	}

	http.ServeContent(c.ResponseWriter(), c.HTTPRequest(), info.Name(), info.ModTime(), file)
	return nil
}
