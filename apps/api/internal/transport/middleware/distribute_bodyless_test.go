package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/internal/i18n"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"

	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// The relay group mounts Distribute() in front of every /v1 route, including the
// bodyless ones: GET /v1/files, GET /v1/fine-tunes, DELETE /v1/files/:id and --
// most importantly -- the GET /v1/realtime WebSocket upgrade. Distribute calls
// getModelRequest, which for any path that is not audio or multipart falls
// through to getModelFromRequest and decodes the request body looking for a
// model name.
//
// A bodyless request carries zero bytes. UnmarshalBodyReusable coerces an absent
// Content-Type to application/json and gjson rejects zero bytes outright, so an
// empty body used to fail with "unexpected end of JSON input" and Distribute
// turned that into a 400 before the request reached its handler.
//
// Reading a model out of an absent body is not an error; it simply yields no
// model. What each route does next is its own business, and the two outcomes
// differ, so the assertions split:
//
//   - /v1/realtime carries its model in the query string, so it must reach its
//     handler. This is the severe half: that route is the WebSocket upgrade, and
//     a 400 there breaks realtime end to end.
//   - The RelayNotImplemented routes carry no model anywhere, so they are still
//     rejected for a missing model name -- exactly as they were before the
//     content-type coercion landed. They must fail on THAT, never on a body
//     parse.
//
// These cases drive real requests through a real engine with the real Distribute
// middleware, because that is the only place the bug was visible: every unit test
// of the body helper hands it a body, and the route snapshot asserts only that a
// route is registered, not that it can be reached.

// The realtime upgrade carries its model in the query string, so getModelRequest
// must resolve it and report no error. It is asserted through a probe handler
// rather than end to end because the next step in Distribute is
// catalog.SelectChannel, which needs a channel cache and a database that a
// middleware test has no business standing up. What regressed here was the body
// read, and this is where the body read is observable: before the fix this route
// never got past getModelRequest.
func TestDistributeResolvesBodylessRealtimeModelFromQuery(t *testing.T) {
	require.NoError(t, i18n.Init())

	server := fiberadapter.NewEngine(func(c contract.Context, recovered any) {
		c.AbortWithStatus(http.StatusInternalServerError)
	})
	var (
		resolved           *ModelRequest
		selectChannel      bool
		getModelRequestErr error
	)
	server.GET("/v1/realtime", func(c contract.Context) {
		resolved, selectChannel, getModelRequestErr = getModelRequest(c)
		c.Status(http.StatusNoContent)
	})
	app := captureEngineApp(t, server)

	request := httptest.NewRequest(http.MethodGet, "/v1/realtime?model=phase6-realtime", nil)
	response, err := app.Test(request)
	require.NoError(t, err)
	require.Equal(t, http.StatusNoContent, response.StatusCode)

	require.NoError(t, getModelRequestErr,
		"an absent body must not fail model resolution for the realtime upgrade")
	require.NotNil(t, resolved)
	assert.Equal(t, "phase6-realtime", resolved.Model,
		"the realtime model comes from the query string, not the body")
	assert.True(t, selectChannel)
}

func TestDistributeRejectsBodylessRoutesOnMissingModelNotBodyParse(t *testing.T) {
	for _, testCase := range []struct {
		name   string
		method string
		path   string
	}{
		{name: "list files", method: http.MethodGet, path: "/v1/files"},
		{name: "retrieve file", method: http.MethodGet, path: "/v1/files/file-abc"},
		{name: "file content", method: http.MethodGet, path: "/v1/files/file-abc/content"},
		{name: "delete file", method: http.MethodDelete, path: "/v1/files/file-abc"},
		{name: "list fine tunes", method: http.MethodGet, path: "/v1/fine-tunes"},
		{name: "fine tune events", method: http.MethodGet, path: "/v1/fine-tunes/ft-abc/events"},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			reached := false
			app := newBodylessDistributeEngine(t, &reached)

			request := httptest.NewRequest(testCase.method, testCase.path, nil)
			response, err := app.Test(request)
			require.NoError(t, err)

			require.Equal(t, http.StatusBadRequest, response.StatusCode)
			assert.Contains(t, responseBody(t, bufferResponseBody(t, response)),
				"model",
				"a bodyless %s %s must be rejected for its missing model, not for failing to parse an absent body",
				testCase.method, testCase.path)
			assert.False(t, reached)
		})
	}
}

// A body that is present but not valid JSON must still be rejected: the guard
// added for the empty case must not turn into a blanket "ignore malformed
// bodies", which would route a garbage request to an arbitrary channel.
func TestDistributeStillRejectsMalformedBody(t *testing.T) {
	reached := false
	app := newBodylessDistributeEngine(t, &reached)

	request := httptest.NewRequest(http.MethodPost, "/v1/chat/completions",
		strings.NewReader("{not json"))
	request.Header.Set("Content-Type", "application/json")
	response, err := app.Test(request)
	require.NoError(t, err)

	assert.False(t, reached, "a malformed JSON body must not reach the handler")
	assert.Equal(t, http.StatusBadRequest, response.StatusCode)
}

// newBodylessDistributeEngine registers the relay paths under test behind the
// real Distribute middleware. Channel selection is not exercised: every path
// here either resolves no model at all (the bodyless ones) or is expected to be
// rejected before selection, so the handler only has to record that it ran.
func newBodylessDistributeEngine(t *testing.T, reached *bool) *fiber.App {
	t.Helper()

	// Distribute reports its rejections through i18n, which panics on a nil
	// bundle, so the abort paths these cases drive need the catalog loaded.
	require.NoError(t, i18n.Init())
	server := fiberadapter.NewEngine(func(c contract.Context, recovered any) {
		c.AbortWithStatus(http.StatusInternalServerError)
	})

	relay := server.Group("/v1")
	relay.Use(Distribute())
	handler := func(c contract.Context) {
		*reached = true
		c.Status(http.StatusNoContent)
	}
	for _, path := range []string{
		"/realtime", "/files", "/files/:id", "/files/:id/content",
		"/fine-tunes", "/fine-tunes/:id/events", "/chat/completions",
	} {
		relay.GET(path, handler)
		relay.POST(path, handler)
		relay.DELETE(path, handler)
	}
	return captureEngineApp(t, server)
}
