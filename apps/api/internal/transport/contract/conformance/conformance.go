// Package conformance holds the behavioural assertions every transport adapter
// must satisfy. The assertions live here rather than in an adapter package so a
// second adapter (Fiber) proves equivalence by supplying a factory instead of
// by copying test bodies, which is how the two implementations would silently
// diverge.
//
// The suite depends only on the contract, the standard library, and testify. It
// must never import an adapter: the dependency arrow is adapter -> conformance,
// so importing an adapter here would cycle and would also let one adapter's
// types leak into assertions meant to be framework-neutral.
package conformance

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/internal/transport/contract"

	"github.com/stretchr/testify/require"
)

// Route describes a route the suite registers on a real engine. Router-matched
// parameters and middleware continuation cannot be observed on a synthetic
// context, so the cases that assert them go through this instead.
//
// Pattern uses `:name` parameter syntax, which both transports accept.
type Route struct {
	Method  string
	Pattern string
	// Middleware runs before Handler, in slice order.
	Middleware []contract.Middleware
	Handler    contract.Handler
}

// Recorder is what an adapter's factory hands back: whatever the context wrote.
type Recorder interface {
	// Status is the written status code, 0 if nothing was written.
	Status() int
	// Header is the response header set.
	Header() http.Header
	// Body is the bytes written to the client.
	Body() []byte
	// Flushed reports whether at least one flush reached the client.
	Flushed() bool
}

// NewHTTPRecorder adapts an httptest.ResponseRecorder to Recorder, for any
// adapter whose engine is a net/http handler.
func NewHTTPRecorder(rec *httptest.ResponseRecorder) Recorder { return httpRecorder{rec: rec} }

// httpRecorder names its field rather than embedding, so the four accessors
// cannot be confused with the recorder's own exported fields of the same names.
type httpRecorder struct{ rec *httptest.ResponseRecorder }

func (r httpRecorder) Status() int         { return r.rec.Code }
func (r httpRecorder) Header() http.Header { return r.rec.Header() }
func (r httpRecorder) Body() []byte        { return r.rec.Body.Bytes() }
func (r httpRecorder) Flushed() bool       { return r.rec.Flushed }

// Adapter is the injection point an adapter package fills in. Every field is
// required: the suite fails fast rather than silently skipping a family, since
// a skipped family is indistinguishable from a passing one in CI output.
type Adapter struct {
	// Name labels the subtests, so a failure names the adapter under test.
	Name string

	// NewContext builds a context backed by an in-process recorder, plus a
	// func that simulates the client going away. The fiber adapter closes the
	// pipe; net/http cancels the request context instead.
	NewContext func(req *http.Request) (contract.Context, Recorder, func())

	// ServeRoute registers route on a real engine and serves req through it,
	// returning what the engine wrote.
	ServeRoute func(t *testing.T, route Route, req *http.Request) Recorder

	// NewEventStream returns the adapter's SSE writer for c.
	NewEventStream func(c contract.Context) (contract.EventStream, error)

	// NewResponseStream returns the adapter's raw response writer for c.
	NewResponseStream func(c contract.Context) (contract.ResponseStream, error)
}

// Run executes the whole suite against adapter.
func Run(t *testing.T, adapter Adapter) {
	t.Helper()

	require.NotEmpty(t, adapter.Name, "conformance: adapter Name is required")
	require.NotNil(t, adapter.NewContext, "conformance: adapter NewContext is required")
	require.NotNil(t, adapter.ServeRoute, "conformance: adapter ServeRoute is required")
	require.NotNil(t, adapter.NewEventStream, "conformance: adapter NewEventStream is required")
	require.NotNil(t, adapter.NewResponseStream, "conformance: adapter NewResponseStream is required")

	t.Run(adapter.Name, func(t *testing.T) {
		t.Run("Request", func(t *testing.T) { runRequestCases(t, adapter) })
		t.Run("Values", func(t *testing.T) { runValuesCases(t, adapter) })
		t.Run("Response", func(t *testing.T) { runResponseCases(t, adapter) })
		t.Run("Chain", func(t *testing.T) { runChainCases(t, adapter) })
		t.Run("Body", func(t *testing.T) { runBodyCases(t, adapter) })
		t.Run("EscapeHatch", func(t *testing.T) { runEscapeHatchCases(t, adapter) })
		t.Run("EventStream", func(t *testing.T) { runEventStreamCases(t, adapter) })
		t.Run("ResponseStream", func(t *testing.T) { runResponseStreamCases(t, adapter) })
	})
}
