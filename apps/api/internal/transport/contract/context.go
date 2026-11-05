// Package contract defines the framework-neutral HTTP boundary used by business
// code. Nothing in this package may import an HTTP framework: the
// implementation lives in internal/transport/fiberadapter, and the transport
// is swapped by replacing only that adapter.
package contract

import (
	"context"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

// Values carries per-request state that middleware produces and handlers read
// (authenticated user id, selected channel, request id, and similar).
//
// Keys are plain strings so the adapter can map them onto whichever per-request
// storage the underlying framework provides.
type Values interface {
	Set(key string, value any)
	Get(key string) (any, bool)
	GetString(key string) string
	GetInt(key string) int
	GetInt64(key string) int64
	GetBool(key string) bool
	GetStringMap(key string) map[string]any
	GetStringSlice(key string) []string
	GetTime(key string) time.Time
}

// Request exposes the inbound request. Body access goes through BodyStorage so
// the replayable-body semantics the relay pipeline depends on are preserved
// rather than reimplemented per framework.
type Request interface {
	Method() string
	Path() string
	FullPath() string
	ClientIP() string
	// Host is the request authority (host and optional port) as the client
	// addressed it. Origin checks and redirect-URI construction compare against
	// it, so an adapter must report the authority the request arrived with
	// rather than a configured or forwarded one.
	Host() string
	// IsTLS reports whether the request arrived over a TLS connection. It
	// reflects the actual transport only: forwarded headers such as
	// X-Forwarded-Proto are client-supplied and must never influence it, since
	// the session-origin guard treats the result as a security decision.
	IsTLS() bool
	UserAgent() string
	ContentType() string
	ContentLength() int64
	// RequestURI is the unmodified request target, including the query string.
	RequestURI() string
	// RawQuery is the encoded query string without the leading '?'.
	RawQuery() string
	// ParseForm populates the form values from the URL and request body.
	ParseForm() error
	// PostFormValues returns the parsed POST form values.
	PostFormValues() map[string][]string

	Query(key string) string
	DefaultQuery(key, fallback string) string
	QueryValues() map[string][]string
	Param(key string) string
	// Params returns all matched route parameters.
	Params() map[string]string

	Header(key string) string
	Headers() http.Header
	Cookie(name string) (string, error)

	// BindJSON decodes the request body into target. The body remains readable
	// afterwards so downstream relay code can forward it upstream.
	BindJSON(target any) error
	// RawBody returns the buffered request body.
	RawBody() ([]byte, error)
	// BodyReader returns an independent reader positioned at the body start.
	BodyReader() (io.ReadCloser, error)
	// BodyStream returns the unbuffered inbound body. Unlike BodyReader, it
	// does not populate the replayable-body cache, so middleware can wrap it
	// before any reader consumes it.
	BodyStream() io.ReadCloser
	MultipartForm() (*multipart.Form, error)
	// SetParsedForm publishes an already-parsed multipart form as the request's
	// form state, so downstream code reading form values observes it without
	// re-parsing a body that has already been consumed. Image-edit validation
	// parses the form to read prompt/model/n and must hand the result forward.
	SetParsedForm(form *multipart.Form)
	PostForm(key string) string

	// HTTPRequest exposes the standard-library request for third-party
	// libraries whose APIs accept *http.Request (WebAuthn, OAuth exchanges).
	// A framework swap must keep this synthesizable; business code should
	// prefer the accessors above.
	HTTPRequest() *http.Request

	// ReplaceBody swaps the request body. Protocol adapters that rewrite an
	// inbound payload before it reaches the relay pipeline use it; the new
	// body is what downstream BindJSON and RawBody observe.
	ReplaceBody(payload []byte)
	// SetPath rewrites the request path so downstream routing and relay code
	// observe the adapted endpoint rather than the original one.
	SetPath(path string)
	// SetMethod rewrites the request method. Protocol adapters that map one
	// inbound call onto a different upstream verb use it.
	SetMethod(method string)
	// SetContextValue attaches a value to the request lifetime context so
	// downstream code reading Context() observes it.
	SetContextValue(key, value any)

	// ResponseWriter exposes the standard-library writer for libraries that
	// hijack or take over the response (WebSocket upgrade, reverse proxy).
	// A framework swap must keep this synthesizable; ordinary handlers use the
	// Response methods or the stream helpers instead.
	ResponseWriter() http.ResponseWriter

	// ResetBody replaces the request body with a re-readable implementation.
	// Relay code that retries with a fresh upstream connection needs the body
	// rewound before re-marshalling.
	ResetBody(body io.ReadCloser)

	// Context is the request lifetime. It is cancelled when the client
	// disconnects, which streaming code must observe.
	Context() context.Context
}

// Response writes a complete (non-streaming) response.
type Response interface {
	JSON(status int, payload any) error
	Data(status int, contentType string, payload []byte) error
	String(status int, value string) error
	Redirect(status int, location string)
	Status(status int)
	SetHeader(key, value string)
	SetCookie(cookie *http.Cookie)
	// ResponseStatus reports the status code already written, or 0 when the
	// response has not been started. Middleware uses it to branch after Next.
	ResponseStatus() int
	// CaptureResponse starts buffering the response body, up to maxBytes, and
	// returns the buffer. Audit middleware inspects the payload after the
	// handler runs to decide whether the operation succeeded. Returns nil when
	// the transport cannot intercept the response.
	CaptureResponse(maxBytes int) ResponseCapture
}

// ResponseCapture exposes a buffered copy of what the handler wrote.
type ResponseCapture interface {
	// Body returns the captured bytes, truncated at the configured limit.
	Body() []byte
}

// Chain controls middleware continuation.
type Chain interface {
	Next()
	Abort()
	IsAborted() bool
	// AbortWithStatus stops the chain and writes only a status code.
	AbortWithStatus(status int)
	// AbortWithStatusJSON stops the chain and writes a JSON body.
	AbortWithStatusJSON(status int, payload any)
}

// Streaming exposes the incremental response writers. They are accessors on the
// context rather than adapter-package constructors so business code can stream
// without importing the adapter, which is what the escape hatches below it
// currently force.
type Streaming interface {
	// EventStream returns the SSE writer for this request, or nil when the
	// transport cannot stream it.
	EventStream() EventStream
	// ResponseStream returns the raw response writer for this request, or nil
	// when the transport has no response writer to hand out.
	ResponseStream() ResponseStream
}

// Context is the single value handlers, middleware, and relay code accept in
// place of a framework context.
type Context interface {
	Values
	Request
	Response
	Chain
	Streaming
	WebSocket
}

// Handler is a framework-neutral request handler.
type Handler func(Context)

// Middleware wraps request handling. Implementations call Context.Next to
// continue, or Context.Abort plus a Response write to reject.
type Middleware func(Context)
