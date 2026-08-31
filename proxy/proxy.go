package main

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"sync/atomic"
	"time"
)

// upstreamRequestIdHeader is the header new-api writes its own request id into
// (common.RequestIdKey). Reading it back off the response is what lets an audit
// row join new-api's logs.request_id without changing anything upstream.
const upstreamRequestIdHeader = "X-Oneapi-Request-Id"

// healthPath is namespaced so it can never shadow an upstream relay route.
const healthPath = "/proxy/healthz"

type Proxy struct {
	cfg      *Config
	reverse  *httputil.ReverseProxy
	store    *Store
	identity *IdentityResolver
	redactor *Redactor
}

// auditState travels with a request so its audit record can be produced as soon
// as the upstream response headers arrive.
//
// Waiting until the whole response has been relayed does not work: a relay
// response can stay open for a very long time — an agent client holds the SSE
// stream open for an entire turn — so the handler is still inside ReverseProxy
// and a record written afterwards would simply never happen. Recording at header
// time is what makes long-lived streams auditable at all.
type auditState struct {
	inbound *http.Request
	capture *bodyCapture
	start   time.Time
	// recorded makes the header-time path and the error fallback mutually
	// exclusive, so a request is audited exactly once.
	recorded atomic.Bool
}

type auditStateKey struct{}

func NewProxy(cfg *Config, store *Store, identity *IdentityResolver, redactor *Redactor) (*Proxy, error) {
	target, err := url.Parse(cfg.Upstream)
	if err != nil {
		return nil, err
	}
	proxy := &Proxy{
		cfg:      cfg,
		store:    store,
		identity: identity,
		redactor: redactor,
	}
	proxy.reverse = &httputil.ReverseProxy{
		Rewrite: func(request *httputil.ProxyRequest) {
			// ReverseProxy strips every inbound X-Forwarded-* header from the
			// outbound request before Rewrite runs, and SetXForwarded then rewrites
			// them from the facts of THIS hop alone. For a sidecar that is wrong in
			// both directions, and both failures surface as 429:
			//
			//   - X-Forwarded-For would arrive at new-api holding only this proxy's
			//     peer — the Nginx in front of it — so every user in the deployment
			//     collapses onto one c.ClientIP() and shares a single per-IP budget
			//     (/api/user/login is 20 requests per 20 minutes by default).
			//   - X-Forwarded-Proto would be downgraded to this hop's plain http,
			//     and new-api derives the expected WebAuthn origin from it
			//     (service/passkey), so passkey logins fail and their retries eat
			//     that same login budget.
			//
			// So the inbound chain is captured here and restored below, which makes
			// new-api see exactly what it saw before this hop existed. The values
			// stay as trustworthy as the entry point: new-api decides what to
			// believe through its own TRUSTED_PROXIES, and port 3001 is expected to
			// be reachable only from the front door (see README).
			forwardedFor := strings.Join(request.In.Header.Values("X-Forwarded-For"), ", ")
			forwardedProto := request.In.Header.Get("X-Forwarded-Proto")
			forwardedHost := request.In.Header.Get("X-Forwarded-Host")

			request.SetURL(target)
			// Keep the client's Host header: new-api derives absolute URLs from it.
			request.Out.Host = request.In.Host
			request.SetXForwarded()
			if forwardedFor != "" {
				request.Out.Header.Set("X-Forwarded-For", forwardedFor+", "+request.Out.Header.Get("X-Forwarded-For"))
			}
			if forwardedProto != "" {
				request.Out.Header.Set("X-Forwarded-Proto", forwardedProto)
			}
			if forwardedHost != "" {
				request.Out.Header.Set("X-Forwarded-Host", forwardedHost)
			}
		},
		// -1 forwards every write immediately, which is what SSE relay responses
		// require; any positive interval would batch stream chunks.
		FlushInterval: -1,
		// The audit record is written here, as soon as the upstream response
		// headers are known — not after the body finishes relaying.
		ModifyResponse: func(resp *http.Response) error {
			if state, ok := resp.Request.Context().Value(auditStateKey{}).(*auditState); ok {
				proxy.recordOnce(state, resp.StatusCode, resp.Header, time.Since(state.start))
			}
			return nil
		},
		ErrorHandler: func(w http.ResponseWriter, r *http.Request, err error) {
			log.Printf("proxy: upstream error for %s %s: %v", r.Method, r.URL.Path, err)
			http.Error(w, "upstream unavailable", http.StatusBadGateway)
		},
	}
	return proxy, nil
}

func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == healthPath {
		p.serveHealth(w)
		return
	}
	captured := r.Method == http.MethodPost && p.cfg.Capture.shouldCapture(r.URL.Path)
	if p.cfg.Debug {
		log.Printf("proxy[debug]: %s %s proto=%s captured=%t content_length=%d content_encoding=%q",
			r.Method, r.URL.Path, r.Proto, captured, r.ContentLength, r.Header.Get("Content-Encoding"))
	}
	if !captured {
		p.reverse.ServeHTTP(w, r)
		return
	}
	// Compliance mode: refuse traffic that could not be audited rather than
	// forwarding it unaudited.
	if !p.cfg.failOpen() && !p.store.HasCapacity() {
		http.Error(w, "prompt audit buffer saturated; rejected by audit policy", http.StatusServiceUnavailable)
		return
	}

	state := &auditState{inbound: r, start: time.Now()}
	state.capture = startBodyCapture(r, p.cfg.Capture)
	r = r.WithContext(context.WithValue(r.Context(), auditStateKey{}, state))

	recorder := &responseRecorder{ResponseWriter: w, status: http.StatusOK}
	p.reverse.ServeHTTP(recorder, r)

	// Fallback for requests that never produced an upstream response — an
	// unreachable upstream goes through ErrorHandler, so ModifyResponse never
	// runs. recordOnce ignores this call when the record already exists.
	p.recordOnce(state, recorder.status, recorder.Header(), time.Since(state.start))
}

// recordOnce builds and enqueues the audit record for a request, at most once.
//
// elapsed is time-to-first-byte on the normal path, because the record is
// written when the upstream response headers arrive rather than when the body
// finishes. For a streaming relay that is the only latency available at a point
// where auditing is still guaranteed to happen.
func (p *Proxy) recordOnce(state *auditState, status int, header http.Header, elapsed time.Duration) {
	if state == nil || !state.recorded.CompareAndSwap(false, true) {
		return
	}
	r := state.inbound

	// The body was inspected as it streamed upstream; this collects the result.
	facts, incomplete := state.capture.result()

	bodyBytes := state.capture.bytesRead.Load()
	if r.ContentLength > 0 {
		bodyBytes = r.ContentLength
	}
	model := facts.Model
	if model == "" {
		model = modelFromPath(r.URL.Path)
	}
	isStream := facts.IsStream
	if !isStream && strings.Contains(strings.ToLower(r.URL.Path), "stream") {
		// Gemini encodes streaming in the action (:streamGenerateContent) rather
		// than in a body field.
		isStream = true
	}

	record := &PromptAuditLog{
		CreatedAt:  time.Now().Unix(),
		RequestId:  header.Get(upstreamRequestIdHeader),
		Method:     r.Method,
		Path:       r.URL.Path,
		Model:      model,
		IsStream:   isStream,
		ClientIp:   clientIP(r),
		Truncated:  incomplete,
		BodyBytes:  bodyBytes,
		StatusCode: status,
		LatencyMs:  elapsed.Milliseconds(),
		Node:       p.cfg.NodeName,
	}
	if p.cfg.Capture.StorePromptText {
		record.PromptText = p.redactor.Apply(facts.PromptText)
	}
	if p.cfg.Capture.StoreRawBody {
		record.RawBody = p.redactor.Apply(facts.RawBody)
	}
	if p.cfg.Identity.Enabled {
		identity := p.identity.Resolve(extractAPIKey(r))
		record.UserId = identity.UserId
		record.Username = identity.Username
		record.TokenId = identity.TokenId
		record.TokenName = identity.TokenName
		record.TokenGroup = identity.TokenGroup
	}
	accepted := p.store.Enqueue(record)
	if p.cfg.Debug {
		// inspected is logged next to body because the two diverging is the whole
		// diagnosis for an empty record: body is what the client declared, inspected
		// is what actually reached extraction. Far fewer bytes inspected than declared
		// means the body was never fully sent — an upstream that rejected the request
		// before reading it, or a client that disconnected mid-upload — as opposed to
		// a body that arrived whole and simply was not JSON.
		log.Printf("proxy[debug]: recorded %s status=%d stream=%t body=%dB inspected=%dB prompt=%dB raw=%dB parsed=%t partial=%t evicted=%t truncated=%t latency=%dms enqueued=%t",
			record.Path, record.StatusCode, record.IsStream, record.BodyBytes,
			state.capture.bytesRead.Load(), len(record.PromptText), len(record.RawBody),
			facts.Parsed, facts.Partial, facts.PromptEvicted, record.Truncated,
			record.LatencyMs, accepted)
	}
}

func (p *Proxy) serveHealth(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	if err := json.NewEncoder(w).Encode(map[string]any{
		"status": "ok",
		"node":   p.cfg.NodeName,
		"store":  p.store.Stats(),
	}); err != nil {
		log.Printf("proxy: write health response: %v", err)
	}
}

// responseRecorder captures the status code while leaving streaming behaviour
// untouched: Flush and Hijack are forwarded so SSE and WebSocket upgrades work
// exactly as they do without the proxy in the path.
type responseRecorder struct {
	http.ResponseWriter
	status      int
	wroteHeader bool
}

func (w *responseRecorder) WriteHeader(status int) {
	if !w.wroteHeader {
		w.status = status
		w.wroteHeader = true
	}
	w.ResponseWriter.WriteHeader(status)
}

func (w *responseRecorder) Write(b []byte) (int, error) {
	if !w.wroteHeader {
		w.status = http.StatusOK
		w.wroteHeader = true
	}
	return w.ResponseWriter.Write(b)
}

func (w *responseRecorder) Flush() {
	if flusher, ok := w.ResponseWriter.(http.Flusher); ok {
		flusher.Flush()
	}
}

func (w *responseRecorder) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	hijacker, ok := w.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, errors.New("proxy: response writer does not support hijacking")
	}
	return hijacker.Hijack()
}

// Unwrap lets http.ResponseController reach the underlying writer.
func (w *responseRecorder) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// modelFromPath recovers the model name for Gemini-style routes, where it lives
// in the URL (/v1beta/models/gemini-2.0-flash:generateContent) instead of the body.
func modelFromPath(path string) string {
	index := strings.Index(path, "/models/")
	if index < 0 {
		return ""
	}
	remainder := path[index+len("/models/"):]
	if colon := strings.Index(remainder, ":"); colon >= 0 {
		remainder = remainder[:colon]
	}
	if slash := strings.Index(remainder, "/"); slash >= 0 {
		remainder = remainder[:slash]
	}
	return remainder
}

func clientIP(r *http.Request) string {
	if forwarded := r.Header.Get("X-Forwarded-For"); forwarded != "" {
		if comma := strings.Index(forwarded, ","); comma >= 0 {
			return strings.TrimSpace(forwarded[:comma])
		}
		return strings.TrimSpace(forwarded)
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}
