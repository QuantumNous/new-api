// Package fiberadapter implements the framework-neutral transport contract on
// top of Fiber and fasthttp. It is the only place fiber and fasthttp types
// may appear; business code sees contract.Context only.
//
// Two structural decisions separate this adapter's design, and both come
// from fasthttp rather than from taste:
//
//  1. The whole middleware chain runs inside the response body stream callback
//     (see Dispatch). fasthttp consumes a streamed body only after the request
//     handler returns, over a pipe that blocks once full, so a handler that
//     registered a stream writer and then streamed from the handler itself
//     would deadlock a few frames in.
//
//  2. Nothing here reads the fiber.Ctx or the *fasthttp.RequestCtx after the
//     request accessors are built. Both are pooled and recycled the moment the
//     fiber handler returns, which for a streaming response happens while the
//     chain is still running. Every request fact is copied into one memoised
//     *http.Request up front, and that request is the single mutable view the
//     contract accessors and the escape hatch share.
package fiberadapter

import (
	"bytes"
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter/connwatch"

	"github.com/gofiber/fiber/v3"
)

// trustedClientIP resolves the client address from the engine's trusted-proxy
// middleware, which owns the forwarded-header walk because trusted proxies are
// engine configuration rather than per-request state. router.go installs it; a
// nil hook means no engine-level resolution ran (a synthetic context, or a bare
// fiber.App in a test) and ClientIP reports the peer address.
//
// The fallback is deliberately the peer address rather than fiber's c.IP(),
// which consults ProxyHeader when the app configures one. Letting a forwarded
// header reach ClientIP by a second path would make per-IP rate limiting
// bypassable with a header the engine never sanctioned.
var trustedClientIP func(fiber.Ctx) (string, bool)

// requestContext adapts a fiber request to contract.Context.
//
// req is the authoritative request view: every Request accessor reads it and
// every rewrite mutates it, so Headers() aliases exactly what HTTPRequest()
// hands to third-party libraries. Twelve production sites rewrite headers in
// place, and a copied view would relay with stale credentials rather than fail.
type requestContext struct {
	// fiber is retained only for Unwrap and for the trusted-proxy hook, both
	// of which are documented as valid only while the fiber handler is on the
	// stack. No accessor on this type dereferences it.
	fiber fiber.Ctx

	req      *http.Request
	fullPath string
	params   map[string]string
	clientIP string

	// values backs contract.Values. It is an adapter-owned map rather than
	// fasthttp's user values because the RequestCtx carrying those is recycled
	// while a streaming chain still runs, and because the typed getters need
	// real Go values instead of the []argsKV fasthttp stores.
	values map[string]any

	ctx    context.Context
	cancel context.CancelFunc

	resp *responseState

	// chain is owned here rather than mapped onto fiber's Next, whose
	// continuation is inverted: a fiber handler that returns without calling
	// Next ends the chain, which would turn every "authorise, then return"
	// middleware into an abort.
	chain   []contract.Handler
	index   int
	aborted bool
}

// dispatchMode selects how the response reaches the client.
type dispatchMode int

const (
	// modeChain is a chain run by Dispatch: writes are staged and committed
	// once, either as a plain body with a correct Content-Length or as a body
	// stream.
	modeChain dispatchMode = iota
	// modeDirect writes straight through to the fiber response, for a
	// fiber-native handler wrapped with Wrap. There is no commit step.
	modeDirect
	// modeSynthetic has no client at all: writes land in an in-process
	// recorder. Streaming is unavailable, which is what the channel-probe
	// caller needs, since it reads the whole body back after the chain.
	modeSynthetic
)

// Wrap adapts a fiber context to the transport contract for a fiber-native
// handler outside a contract chain: the realtime upgrade, where the handler
// takes over the connection, and fiber middleware that wants to read the
// request through the contract.
//
// Writes go straight to the fiber response, so there is no commit step and no
// chain. Streaming is unavailable on it (EventStream and ResponseStream return
// nil, the contract's declared answer for a response the transport cannot
// stream) because streaming needs the callback Dispatch installs.
func Wrap(c fiber.Ctx) contract.Context {
	return newRequestContext(c, modeDirect, nil)
}

// Unwrap returns the underlying fiber context, for the migration window and for
// the engine-level middleware that needs the fiber context back.
//
// It is valid only while the fiber handler is on the stack. fiber returns the
// Ctx to a pool when its handler returns, and for a streamed response that
// happens while the chain is still running, so a caller reading it after Next
// would observe another request's state. Contract-level state that outlives the
// fiber handler is reachable through Values instead.
func Unwrap(c contract.Context) (fiber.Ctx, bool) {
	adapted, ok := c.(*requestContext)
	if !ok || adapted.fiber == nil {
		return nil, false
	}
	return adapted.fiber, true
}

// Values returns a snapshot of the per-request state set through the contract.
//
// It takes the contract context rather than the fiber one on purpose: the
// access logger reads it after Next returns, which for a streamed response is
// after fiber already recycled the Ctx.
func Values(c contract.Context) map[string]any {
	adapted, ok := c.(*requestContext)
	if !ok {
		return nil
	}
	snapshot := make(map[string]any, len(adapted.values))
	for key, value := range adapted.values {
		snapshot[key] = value
	}
	return snapshot
}

// Streamed reports whether the response for c was committed as a body stream
// rather than as a buffered body.
//
// Response compression must not be applied to a streamed response: the
// compressor materialises the body, which for a stream means draining the pipe
// the chain is still writing into. The mode is decided before Dispatch returns,
// so this is safe to read from a fiber layer wrapping the route handler, and it
// answers for the raw ResponseStream endpoints (video content, the dashboard
// proxy) that request-header heuristics cannot detect.
func Streamed(c fiber.Ctx) bool {
	state, ok := c.Locals(responseStateKey{}).(*responseState)
	return ok && state != nil && state.isStreaming()
}

// responseStateKey keys the response state on fiber's Locals. It is a private
// struct type so it cannot collide with a business key, and so it stays out of
// anything iterating string-keyed user values.
type responseStateKey struct{}

// Handler adapts a contract handler to a fiber handler, running it as a
// one-element chain so a handler registered on its own still gets abort
// semantics, streaming, and a committed response.
func Handler(handler contract.Handler) fiber.Handler {
	return func(c fiber.Ctx) error {
		return Dispatch(c, []contract.Handler{handler})
	}
}

// Middleware adapts a contract middleware to a fiber handler. It exists as the
// mirror of the previous adapter's Middleware so route registration does not require
// business code to import fiber.
func Middleware(m contract.Middleware) fiber.Handler {
	return Handler(contract.Handler(m))
}

// Dispatch runs chain as one contract middleware chain for c and commits the
// response. It is the single entry point from fiber into contract handlers.
//
// The chain must be flattened by the caller: group middleware and the route's
// own handlers in one slice. Splitting it across fiber's own stack would break
// both halves of this adapter's design, because Dispatch returns while a
// streaming chain is still running and fiber recycles the Ctx as soon as its
// handler returns.
//
// Dispatch never calls c.Next(). Continuation is contract.Next on the chain
// this owns.
func Dispatch(c fiber.Ctx, chain []contract.Handler) error {
	adapted := newRequestContext(c, modeChain, chain)
	c.Locals(responseStateKey{}, adapted.resp)
	// The request lifetime is NOT cancelled here. Dispatch returns while a
	// streaming or upgraded chain is still running, so cancelling on return
	// would cancel the context that chain is still using -- and the production
	// stream writers gate every frame on Context().Err(), so every streamed
	// relay would stop after its first frame. run's chain goroutine owns the
	// cancel and fires it once the chain actually finished.
	return adapted.resp.run(adapted)
}

// newRequestContext builds the contract context and, with it, the memoised
// request every accessor reads.
func newRequestContext(c fiber.Ctx, mode dispatchMode, chain []contract.Handler) *requestContext {
	adapted := &requestContext{
		fiber:  c,
		values: make(map[string]any),
		chain:  chain,
	}

	adapted.req = synthesizeRequest(c)
	adapted.fullPath, adapted.params = routeMatch(c)
	adapted.clientIP = contextClientIP(c)

	// The request lifetime is built here rather than taken from fasthttp:
	// RequestCtx.Done() is closed only when the server shuts down (its own doc
	// says so), never when a client disconnects, so five production mechanisms
	// that poll it would never fire. Two signals cancel this context: the
	// kernel-level watch on the accepted connection (installed by Serve; fires
	// on FIN/RST within milliseconds), and the stream writer when a write
	// reports the connection gone -- the fallback wherever the watch is
	// unavailable.
	adapted.ctx, adapted.cancel = context.WithCancel(context.Background())
	adapted.req = adapted.req.WithContext(adapted.ctx)

	// Bridge the connection's disconnect signal into the request lifetime.
	// The bridge goroutine lives exactly as long as the request: the chain's
	// own goroutine cancels adapted.ctx when it finishes (see run), which
	// releases this select either way, and cancel is idempotent, so a
	// disconnect that races the chain's end is harmless. On a platform or
	// listener without the watch, Done reports nil and nothing is attached:
	// write-failure detection remains the only signal, as before.
	if done := connwatch.Done(c.RequestCtx().Conn()); done != nil {
		go func() {
			select {
			case <-done:
				adapted.cancel()
			case <-adapted.ctx.Done():
			}
		}()
	}

	adapted.resp = newResponseState(c, mode)
	return adapted
}

// synthesizeRequest builds the standard-library request this context is backed
// by, copying every byte it needs out of fasthttp's buffers.
//
// fasthttpadaptor.ConvertRequest is deliberately not used. It documents that its
// result must not be used after the handler returns, which is precisely when a
// streaming chain reads it; it rebuilds the body on every call, so the
// replayable-body cache would be reset under the relay pipeline; and it flattens
// repeated headers onto Header.Set, dropping every value but the last of a
// multi-value header.
func synthesizeRequest(c fiber.Ctx) *http.Request {
	fctx := c.RequestCtx()

	// string(...) on each field copies: fasthttp reuses these buffers for the
	// next request on the connection, and this request outlives the handler.
	method := string(fctx.Method())
	requestURI := string(fctx.RequestURI())
	host := string(fctx.Host())

	target, err := url.ParseRequestURI(requestURI)
	if err != nil {
		// A target fasthttp routed but url cannot parse still has to yield a
		// usable request; the path is the part every accessor needs.
		target = &url.URL{Path: string(fctx.Path())}
	}

	header := make(http.Header)
	fctx.Request.Header.VisitAll(func(key, value []byte) {
		header.Add(string(key), string(value))
	})

	body := fctx.PostBody()
	buffered := make([]byte, len(body))
	copy(buffered, body)

	req := &http.Request{
		Method:        method,
		URL:           target,
		Proto:         "HTTP/1.1",
		ProtoMajor:    1,
		ProtoMinor:    1,
		Header:        header,
		Body:          io.NopCloser(bytes.NewReader(buffered)),
		ContentLength: int64(len(buffered)),
		Host:          host,
		RequestURI:    requestURI,
		RemoteAddr:    fctx.RemoteAddr().String(),
	}

	// TLS carries the transport fact IsTLS reports. It must come from the
	// connection: the contract makes IsTLS a security decision and the
	// session-origin guard rejects a request whose forwarded protocol disagrees
	// with the transport, so X-Forwarded-Proto must not reach it.
	req.TLS = fctx.TLSConnectionState()

	return req
}

// routeMatch copies the matched route pattern and parameters out of fiber.
//
// Both live on the Ctx, which is recycled when the fiber handler returns, so
// they are copied rather than read lazily. fiber renames a wildcard segment to
// an ordinal ("*" becomes "*1"), so a route registered as "/v1/models/*path"
// exposes its remainder under "*1"; the pattern's own names are recovered from
// Route().Params, which is what AllParams iterates.
func routeMatch(c fiber.Ctx) (string, map[string]string) {
	route := c.Route()
	if route == nil {
		return "", map[string]string{}
	}

	params := make(map[string]string, len(route.Params))
	for _, name := range route.Params {
		params[name] = c.Params(name)
	}
	return route.Path, params
}

// contextClientIP asks the engine's trusted-proxy middleware first and falls
// back to the peer address.
func contextClientIP(c fiber.Ctx) string {
	if trustedClientIP != nil {
		if ip, ok := trustedClientIP(c); ok && ip != "" {
			return ip
		}
	}
	if ip := c.RequestCtx().RemoteIP(); ip != nil {
		return ip.String()
	}
	return ""
}

// ---- Values ----

func (r *requestContext) Set(key string, value any) { r.values[key] = value }

func (r *requestContext) Get(key string) (any, bool) {
	value, exists := r.values[key]
	return value, exists
}

// The typed getters return the zero value for a missing or mistyped key rather
// than panicking: the request pipeline reads optional state unconditionally, so
// a panic here would be a 500 on every request that skipped the producer.
func (r *requestContext) GetString(key string) string {
	value, _ := r.values[key].(string)
	return value
}

func (r *requestContext) GetInt(key string) int {
	value, _ := r.values[key].(int)
	return value
}

func (r *requestContext) GetInt64(key string) int64 {
	value, _ := r.values[key].(int64)
	return value
}

func (r *requestContext) GetBool(key string) bool {
	value, _ := r.values[key].(bool)
	return value
}

func (r *requestContext) GetStringMap(key string) map[string]any {
	value, _ := r.values[key].(map[string]any)
	return value
}

func (r *requestContext) GetStringSlice(key string) []string {
	value, _ := r.values[key].([]string)
	return value
}

func (r *requestContext) GetTime(key string) time.Time {
	value, _ := r.values[key].(time.Time)
	return value
}

// ---- Request ----

func (r *requestContext) Method() string { return r.req.Method }

func (r *requestContext) Path() string { return r.req.URL.Path }

func (r *requestContext) FullPath() string { return r.fullPath }

func (r *requestContext) ClientIP() string { return r.clientIP }

// Host reports the authority the client addressed. It comes from the request
// line or the Host header, never from X-Forwarded-Host: origin checks and
// OAuth redirect-URI construction compare against it, so a forwarded value
// would either break same-origin checks or send users to an attacker's callback.
func (r *requestContext) Host() string { return r.req.Host }

// IsTLS reports whether the connection itself was TLS, read off the connection
// state captured at synthesis. fiber's own scheme detection consults
// X-Forwarded-Proto, which is client-supplied and must not influence this.
func (r *requestContext) IsTLS() bool { return r.req.TLS != nil }

func (r *requestContext) UserAgent() string { return r.req.UserAgent() }

// ContentType reports the media type without parameters, so a JSON body with a
// charset still compares equal to "application/json".
func (r *requestContext) ContentType() string {
	contentType := r.req.Header.Get("Content-Type")
	if index := strings.IndexByte(contentType, ';'); index != -1 {
		contentType = contentType[:index]
	}
	return strings.TrimSpace(contentType)
}

func (r *requestContext) ContentLength() int64 { return r.req.ContentLength }

func (r *requestContext) RequestURI() string { return r.req.RequestURI }

func (r *requestContext) RawQuery() string { return r.req.URL.RawQuery }

func (r *requestContext) ParseForm() error { return r.req.ParseForm() }

func (r *requestContext) PostFormValues() map[string][]string { return r.req.PostForm }

func (r *requestContext) Query(key string) string { return r.req.URL.Query().Get(key) }

func (r *requestContext) DefaultQuery(key, fallback string) string {
	query := r.req.URL.Query()
	if values, exists := query[key]; exists && len(values) > 0 {
		return values[0]
	}
	return fallback
}

func (r *requestContext) QueryValues() map[string][]string { return r.req.URL.Query() }

func (r *requestContext) Param(key string) string { return r.params[key] }

// Params returns a copy, so a caller mutating the result cannot corrupt the
// match this context reports.
func (r *requestContext) Params() map[string]string {
	params := make(map[string]string, len(r.params))
	for key, value := range r.params {
		params[key] = value
	}
	return params
}

func (r *requestContext) Header(key string) string { return r.req.Header.Get(key) }

// Headers returns the live header map. It must alias the request the escape
// hatch exposes: twelve production sites rewrite the inbound Authorization or
// vendor key in place and downstream relay code reads it back, and a copy would
// forward the original credentials while looking like it had been rewritten.
func (r *requestContext) Headers() http.Header { return r.req.Header }

// Cookie reports http.ErrNoCookie for an absent cookie, so callers can tell
// absent from present-but-empty.
func (r *requestContext) Cookie(name string) (string, error) {
	cookie, err := r.req.Cookie(name)
	if err != nil {
		return "", err
	}
	value, err := url.QueryUnescape(cookie.Value)
	if err != nil {
		return "", err
	}
	return value, nil
}

// ---- Body ----
//
// The replayable-body path is shared through common: the storage object is
// cached in Values, so decoding for routing and forwarding upstream read one
// buffer. common.GetRequestBody bootstraps that cache by reading
// HTTPRequest().Body once, which is why synthesizeRequest installs a real
// reader over the buffered payload rather than leaving Body nil.

func (r *requestContext) BindJSON(target any) error {
	return common.UnmarshalBodyReusable(r, target)
}

func (r *requestContext) RawBody() ([]byte, error) {
	storage, err := common.GetBodyStorage(r)
	if err != nil {
		return nil, err
	}
	return storage.Bytes()
}

func (r *requestContext) BodyReader() (io.ReadCloser, error) {
	storage, err := common.GetBodyStorage(r)
	if err != nil {
		return nil, err
	}
	return storage.NewReader()
}

func (r *requestContext) BodyStream() io.ReadCloser { return r.req.Body }

func (r *requestContext) MultipartForm() (*multipart.Form, error) {
	return common.ParseMultipartFormReusable(r)
}

// SetParsedForm publishes an already-parsed form onto the request, matching what
// ParseMultipartForm would have left behind, so PostForm and PostFormValues
// observe it without re-reading a consumed body.
func (r *requestContext) SetParsedForm(form *multipart.Form) {
	r.req.MultipartForm = form
	if form == nil {
		return
	}
	r.req.PostForm = url.Values(form.Value)
}

// PostForm parses the body on demand, so a caller that never called ParseForm
// still reads a urlencoded field.
func (r *requestContext) PostForm(key string) string {
	if r.req.PostForm == nil {
		_ = r.req.ParseMultipartForm(defaultMultipartMemory)
	}
	return r.req.PostFormValue(key)
}

// defaultMultipartMemory is 32 MiB, the same in-memory cap the previous
// transport applied, so a form that stayed in memory before does not start
// spilling to disk under fiber.
const defaultMultipartMemory = 32 << 20

func (r *requestContext) HTTPRequest() *http.Request { return r.req }

// ReplaceBody rewrites the inbound body and drops the cached storage so later
// reads observe the new payload. ContentLength tracks it, since the outbound
// relay request is framed from it.
func (r *requestContext) ReplaceBody(payload []byte) {
	r.req.Body = io.NopCloser(bytes.NewReader(payload))
	r.req.ContentLength = int64(len(payload))
	common.CleanupBodyStorage(r)
}

func (r *requestContext) SetPath(path string) { r.req.URL.Path = path }

func (r *requestContext) SetMethod(method string) { r.req.Method = method }

func (r *requestContext) ResetBody(body io.ReadCloser) { r.req.Body = body }

// SetContextValue attaches a value to the request lifetime. The derived context
// is stored back on the request so Context() and HTTPRequest() keep reporting
// one lifetime.
func (r *requestContext) SetContextValue(key, value any) {
	r.ctx = context.WithValue(r.ctx, key, value)
	r.req = r.req.WithContext(r.ctx)
}

// Context is the request lifetime, cancelled when the client disconnects.
//
// It is a hand-built cancellable context rather than fasthttp's: RequestCtx.Done
// is closed only on server shutdown, so streaming code polling it would never
// observe a gone client. The primary disconnect signal is the kernel-level
// connection watch bridged in newRequestContext, which fires on FIN/RST even
// while nothing is being written. Where that watch is unavailable (no poller,
// an unwrapped listener), the fallback is the stream writer's pipe write
// failing once the server closed the read end; the relay's keep-alive ping
// (gateway.PingData, on by default) bounds that fallback's delay on an idle
// stream.
func (r *requestContext) Context() context.Context { return r.ctx }

// ResponseWriter exposes the staged response as a standard-library writer, for
// libraries that take over the response (the reverse proxy, the WebSocket
// upgrade). It shares state with the contract accessors rather than detaching:
// middleware sets headers through the contract while the library writes the
// body through this, and both must land on one response.
func (r *requestContext) ResponseWriter() http.ResponseWriter { return r.resp }

// ---- Response ----

func (r *requestContext) JSON(status int, payload any) error {
	encoded, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	// The charset matches the JSON content type verbatim; clients and the
	// conformance suite both compare the whole value.
	return r.Data(status, "application/json; charset=utf-8", encoded)
}

func (r *requestContext) Data(status int, contentType string, payload []byte) error {
	r.resp.setHeader("Content-Type", contentType)
	r.resp.WriteHeader(status)
	_, err := r.resp.Write(payload)
	return err
}

func (r *requestContext) String(status int, value string) error {
	r.resp.WriteHeader(status)
	_, err := r.resp.Write([]byte(value))
	return err
}

func (r *requestContext) Redirect(status int, location string) {
	r.resp.setHeader("Location", location)
	r.resp.WriteHeader(status)
}

func (r *requestContext) Status(status int) { r.resp.WriteHeader(status) }

func (r *requestContext) SetHeader(key, value string) { r.resp.setHeader(key, value) }

func (r *requestContext) SetCookie(cookie *http.Cookie) {
	if encoded := cookie.String(); encoded != "" {
		r.resp.addHeader("Set-Cookie", encoded)
	}
}

// ResponseStatus reports the status already written, or 0 when nothing was
// written yet.
//
// The contract specifies 0 for an unstarted response and this adapter can report
// it honestly, because the staged status starts unset rather than defaulting to
// 200 the way fasthttp's StatusCode() does. Middleware
// branches on "> 0 && < 400", so a default 200 would record channel affinity for
// a request that never produced a response.
func (r *requestContext) ResponseStatus() int { return r.resp.status }

// ReportsUnwrittenStatusAsZero declares that ResponseStatus distinguishes an
// unstarted response from one that wrote 200, which the conformance suite reads
// instead of assuming one transport's default.
//
// This adapter can answer honestly because the status is staged rather than
// initialised: fasthttp's own StatusCode() would report 200 for an unset status,
// as fasthttp's own StatusCode() does, and middleware branching on "> 0 && < 400" would then
// record channel affinity for a request that never produced a response.
func (r *requestContext) ReportsUnwrittenStatusAsZero() bool { return true }

// CaptureResponse returns a bounded view of the response body.
//
// fasthttp builds a response rather than writing through a wrapped writer, so
// there is nothing to wrap: the capture reads the staged body when asked, and
// truncates at maxBytes. Both callers read strictly after the chain (audit
// middleware after Next, the channel probe after the pipeline), so the
// interception point exists, it is simply later than it was before.
//
// It deliberately does not interact with the header commit: the capture reads the
// body buffer, which is complete once the writing handler returned, while the
// commit writes headers. A streamed response has no buffered body to capture and
// reports what reached the pipe as empty rather than draining it.
func (r *requestContext) CaptureResponse(maxBytes int) contract.ResponseCapture {
	return &responseCapture{state: r.resp, maxSize: maxBytes}
}

// responseCapture is a bounded view rather than a copy, so capturing costs
// nothing until the audit path actually reads it.
type responseCapture struct {
	state   *responseState
	maxSize int
}

func (c *responseCapture) Body() []byte {
	body := c.state.bufferedBody()
	if c.maxSize >= 0 && len(body) > c.maxSize {
		return body[:c.maxSize]
	}
	return body
}

// ---- Chain ----

// Next runs the rest of the chain and returns after it, so middleware doing work
// after Next (billing, access logging) observes the finished response.
func (r *requestContext) Next() {
	// Advance first: a middleware calling Next twice must not re-run the same
	// downstream handler, and the index is the only continuation state.
	for r.index < len(r.chain) {
		if r.aborted {
			return
		}
		handler := r.chain[r.index]
		r.index++
		handler(r)
	}
}

// Abort stops the chain. It sets a flag this adapter owns rather than mapping
// onto fiber, whose Next has inverted continuation: not calling it ends the
// chain, so mapping contract.Next onto it would read every middleware that
// returns normally as an abort.
func (r *requestContext) Abort() { r.aborted = true }

func (r *requestContext) IsAborted() bool { return r.aborted }

func (r *requestContext) AbortWithStatus(status int) {
	r.Abort()
	r.resp.WriteHeader(status)
}

func (r *requestContext) AbortWithStatusJSON(status int, payload any) {
	r.Abort()
	_ = r.JSON(status, payload)
}
