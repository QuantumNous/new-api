package fiberadapter

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/transport/contract"

	fastws "github.com/fasthttp/websocket"
	"github.com/gofiber/fiber/v3"
	gorilla "github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestUpgradeCompletesTheHandshakeOverTheWire is the proof the hijack
// registration ordering actually holds, and it cannot be done without a real
// listener.
//
// fasthttp reads the registered hijack handler only after the request handler
// returned (server.go's serveConn does, at the point it decides whether to write
// a response), so the upgrade has to be registered while the fiber handler is
// still on the stack. The chain runs on another goroutine, which is why the
// handshake is performed by the parked dispatcher rather than by the chain
// itself. If that ordering were wrong the symptom would not be a compile error
// or a failed assertion in-process: the client would simply never see a 101.
func TestUpgradeCompletesTheHandshakeOverTheWire(t *testing.T) {
	echoed := make(chan string, 1)

	app := fiber.New(fiber.Config{})
	app.Get("/v1/realtime", func(c fiber.Ctx) error {
		return Dispatch(c, []contract.Handler{func(ctx contract.Context) {
			conn, err := ctx.UpgradeWebSocket("realtime")
			require.NoError(t, err)
			require.NotNil(t, conn)
			defer func() { _ = conn.Close() }()

			// Read one frame and echo it, which proves the connection is a
			// working duplex socket rather than merely a successful handshake.
			messageType, payload, err := conn.ReadMessage()
			require.NoError(t, err)
			assert.Equal(t, gorilla.TextMessage, messageType,
				"a text frame must arrive as TextMessage")
			require.NoError(t, conn.WriteMessage(gorilla.TextMessage, payload))
			echoed <- string(payload)
		}})
	})

	base := listenApp(t, app)

	dialer := gorilla.Dialer{
		Subprotocols:     []string{"realtime"},
		HandshakeTimeout: 10 * time.Second,
	}
	conn, response, err := dialer.Dial(strings.Replace(base, "http://", "ws://", 1)+"/v1/realtime", nil)
	require.NoError(t, err, "the handshake must complete")
	t.Cleanup(func() { _ = conn.Close() })

	assert.Equal(t, http.StatusSwitchingProtocols, response.StatusCode)
	assert.Equal(t, "realtime", response.Header.Get("Sec-WebSocket-Protocol"),
		"the negotiated subprotocol must be echoed, which is what realtime clients require")
	assert.Equal(t, "realtime", conn.Subprotocol())

	require.NoError(t, conn.WriteMessage(gorilla.TextMessage, []byte(`{"type":"session.update"}`)))

	_, payload, err := conn.ReadMessage()
	require.NoError(t, err)
	assert.Equal(t, `{"type":"session.update"}`, string(payload))

	select {
	case message := <-echoed:
		assert.Equal(t, `{"type":"session.update"}`, message)
	case <-time.After(5 * time.Second):
		t.Fatal("the upgraded chain never observed its frame")
	}
}

// TestFailedUpgradeReturnsATrueNilInterface is the W1-C regression pin.
//
// A failed upgrade must return a nil WSConn *interface*, not an interface value
// holding a nil concrete pointer. The relay's error path checks `ws == nil`
// before writing an error frame (gateway.WssError), and an interface wrapping a
// nil pointer passes that check and then dereferences nil, so getting this wrong
// turns every failed handshake into a panic rather than an error response.
//
// The request here is a plain GET with no upgrade headers, which is exactly what
// a browser hitting the endpoint by mistake sends.
func TestFailedUpgradeReturnsATrueNilInterface(t *testing.T) {
	type outcome struct {
		conn   contract.WSConn
		isNil  bool
		err    error
		ranFor bool
	}
	observed := make(chan outcome, 1)

	app := fiber.New(fiber.Config{})
	app.Get("/v1/realtime", func(c fiber.Ctx) error {
		return Dispatch(c, []contract.Handler{func(ctx contract.Context) {
			conn, err := ctx.UpgradeWebSocket("realtime")
			result := outcome{conn: conn, isNil: conn == nil, err: err}
			if conn != nil {
				// Never reached on a failure, and asserting it separately from
				// the nil check is the point: a non-nil interface holding a nil
				// pointer would reach here and panic in production.
				result.ranFor = true
			}
			observed <- result
		}})
	})

	base := listenApp(t, app)

	response, err := http.Get(base + "/v1/realtime")
	require.NoError(t, err)
	t.Cleanup(func() { _ = response.Body.Close() })

	select {
	case result := <-observed:
		require.Error(t, result.err, "a request that is not a websocket handshake must fail the upgrade")
		assert.True(t, result.isNil,
			"a failed upgrade must return a true nil interface, not one holding a nil pointer")
		assert.Nil(t, result.conn)
		assert.False(t, result.ranFor,
			"nothing may be done with the connection after a failed upgrade")
	case <-time.After(5 * time.Second):
		t.Fatal("the chain never observed the upgrade result")
	}

	assert.NotEqual(t, http.StatusSwitchingProtocols, response.StatusCode,
		"a failed handshake must not report a protocol switch")
	assert.GreaterOrEqual(t, response.StatusCode, http.StatusBadRequest,
		"the upgrader answers a failed handshake with an HTTP error itself")
}

// TestUpgradeIsRefusedWithoutAClientConnection asserts an in-process context
// reports that it cannot upgrade instead of pretending to.
//
// The channel probe and the scheduled jobs build contexts with no client
// attached. There is no connection to hijack there, and the contract requires an
// error rather than a connection that cannot exist -- and critically, the error
// path must produce the same true nil interface a failed handshake does.
func TestUpgradeIsRefusedWithoutAClientConnection(t *testing.T) {
	adapted, _ := NewSyntheticContext(httptest.NewRequest(http.MethodGet, "/v1/realtime", nil))

	conn, err := adapted.UpgradeWebSocket("realtime")
	require.Error(t, err)
	assert.True(t, conn == nil,
		"a context with no client must report a true nil interface")
}

// TestServerConnSatisfiesWSConn pins that the conn this adapter hands out needs
// no wrapper to be what the relay consumes, which is what lets one RelayInfo
// field hold both this and a gorilla client dial.
func TestServerConnSatisfiesWSConn(t *testing.T) {
	var _ contract.WSConn = (*fastws.Conn)(nil)
	var _ contract.WSConn = (*gorilla.Conn)(nil)
}

// TestMessageTypeConstantsAgreeAcrossLibraries is the static proof that
// WriteMessage(1, ...) means the same thing on both sides of the cutover.
//
// The relay writes text frames as the literal 1 (gateway.WssString), so the two
// libraries disagreeing on the numbering would silently send realtime events as
// binary frames, which clients reject rather than report.
func TestMessageTypeConstantsAgreeAcrossLibraries(t *testing.T) {
	assert.Equal(t, gorilla.TextMessage, fastws.TextMessage)
	assert.Equal(t, 1, fastws.TextMessage, "the relay writes text frames as the literal 1")
	assert.Equal(t, gorilla.BinaryMessage, fastws.BinaryMessage)
	assert.Equal(t, gorilla.CloseMessage, fastws.CloseMessage)
	assert.Equal(t, gorilla.PingMessage, fastws.PingMessage)
	assert.Equal(t, gorilla.PongMessage, fastws.PongMessage)

	assert.Equal(t, gorilla.CloseNormalClosure, fastws.CloseNormalClosure)
	assert.Equal(t, gorilla.CloseGoingAway, fastws.CloseGoingAway)
}
