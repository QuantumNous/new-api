package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/internal/relay/common"
	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gofiber/fiber/v3"
	gorilla "github.com/gorilla/websocket"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRealtimeCompleteSessionOverFiber is the successful end-to-end smoke for GET
// /v1/realtime. It uses the relay's real duplex handler with a deterministic
// websocket upstream rather than a database-selected channel: routing and billing
// are orthogonal to the transport boundary this exercises.
//
// Every client-visible property of a complete session is pinned here directly:
// the 101 handshake, the negotiated "realtime" subprotocol, the client frame
// arriving upstream byte for byte, the upstream frame arriving back byte for byte
// as a text frame, and the close code the relay acknowledges.
//
// Both RFC 6455 normal codes are driven because the relay's own classification is
// what separates an ordinary hang-up from a failure: relaycommon.IsNormalWSClose
// accepts 1000 and 1001 and nothing else, and a clean close misread as an error
// would be logged and reported as a relay failure on every session that ends.
func TestRealtimeCompleteSessionOverFiber(t *testing.T) {
	const clientEvent = `{"event_id":"client-1","type":"session.update","session":{"instructions":"be concise"}}`
	const upstreamEvent = `{"event_id":"upstream-1","type":"session.updated","session":{"input_audio_format":"pcm16","output_audio_format":"pcm16"}}`

	upstream, received := realtimeUpstream(t, upstreamEvent)
	baseURL := listenRealtime(t, realtimeRelay(upstream))

	for _, closeCode := range []int{gorilla.CloseNormalClosure, gorilla.CloseGoingAway} {
		t.Run(fmt.Sprintf("client closes with %d", closeCode), func(t *testing.T) {
			result := runRealtimeSession(t, baseURL, clientEvent, upstreamEvent, closeCode)

			assert.Equal(t, realtimeSessionResult{
				Subprotocol: "realtime",
				MessageType: gorilla.TextMessage,
				Payload:     upstreamEvent,
				CloseCode:   closeCode,
			}, result)
			assert.Equal(t, clientEvent, <-received,
				"the client frame must reach the upstream byte for byte")
		})
	}
}

type realtimeSessionResult struct {
	Subprotocol string
	MessageType int
	Payload     string
	CloseCode   int
}

func realtimeUpstream(t *testing.T, reply string) (*httptest.Server, <-chan string) {
	t.Helper()
	received := make(chan string, 2)
	upgrader := gorilla.Upgrader{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		require.NoError(t, err)
		defer conn.Close()

		messageType, payload, err := conn.ReadMessage()
		require.NoError(t, err)
		require.Equal(t, gorilla.TextMessage, messageType)
		received <- string(payload)
		require.NoError(t, conn.WriteMessage(gorilla.TextMessage, []byte(reply)))
		_, _, _ = conn.ReadMessage() // consume the relay's normal close reply.
	}))
	t.Cleanup(server.Close)
	return server, received
}

func realtimeRelay(upstream *httptest.Server) contract.Handler {
	return func(c contract.Context) {
		client, err := c.UpgradeWebSocket("realtime")
		if err != nil {
			return
		}
		defer client.Close()

		target, _, err := gorilla.DefaultDialer.Dial(strings.Replace(upstream.URL, "http://", "ws://", 1), nil)
		if err != nil {
			return
		}
		defer target.Close()

		apiErr, _ := openai.OpenaiRealtimeHandler(c, &relaycommon.RelayInfo{
			ClientWs:          client,
			TargetWs:          target,
			ChannelMeta:       &relaycommon.ChannelMeta{UpstreamModelName: "gpt-4o-realtime-preview"},
			InputAudioFormat:  "pcm16",
			OutputAudioFormat: "pcm16",
			IsFirstRequest:    true,
		})
		if apiErr != nil {
			return
		}
	}
}

func runRealtimeSession(t *testing.T, baseURL, clientEvent, expectedReply string, closeCode int) realtimeSessionResult {
	t.Helper()
	dialer := gorilla.Dialer{Subprotocols: []string{"realtime"}, HandshakeTimeout: 10 * time.Second}
	conn, response, err := dialer.Dial(strings.Replace(baseURL, "http://", "ws://", 1)+"/v1/realtime", nil)
	require.NoError(t, err)
	defer conn.Close()
	require.Equal(t, http.StatusSwitchingProtocols, response.StatusCode)
	require.Equal(t, "realtime", response.Header.Get("Sec-WebSocket-Protocol"),
		"Sec-WebSocket-Protocol: realtime must be echoed")

	require.NoError(t, conn.WriteMessage(gorilla.TextMessage, []byte(clientEvent)))
	require.NoError(t, conn.SetReadDeadline(time.Now().Add(15*time.Second)))
	messageType, payload, err := conn.ReadMessage()
	require.NoError(t, err)
	require.NoError(t, conn.WriteControl(gorilla.CloseMessage, gorilla.FormatCloseMessage(closeCode, "done"), time.Now().Add(5*time.Second)))
	_, _, err = conn.ReadMessage()
	var closeErr *gorilla.CloseError
	require.True(t, errors.As(err, &closeErr), "expected the server to acknowledge a close frame: %v", err)
	assert.Equal(t, expectedReply, string(payload))
	assert.Equal(t, closeCode, closeErr.Code)
	assert.True(t, relaycommon.IsNormalWSClose(closeErr),
		"a %d close must be classified as an ordinary end of conversation", closeCode)

	return realtimeSessionResult{conn.Subprotocol(), messageType, string(payload), closeErr.Code}
}

// TestRealtimeEndToEndOverFiber is the failing counterpart: it drives the real
// Relay entry point over a real socket and asserts the client-visible failure.
//
// It deliberately stops short of a provider. Reaching a live upstream needs a
// configured channel and a database, so what is verified here is everything up to
// that point, which is the part the transport can break: the handshake completes,
// the "realtime" subprotocol is negotiated, and the relay's failure is delivered
// as an error *frame over the websocket* rather than as an HTTP response — because
// by the time the relay fails, the response has already been hijacked and an HTTP
// error would reach nobody.
//
// The unreachable-upstream frame is exactly what a client sees in production when
// no channel can serve the model, so the assertion is on real behaviour rather
// than on a stand-in. The frame's shape is pinned field by field: the event id
// embeds a per-request value, so it is asserted by prefix rather than by value.
func TestRealtimeEndToEndOverFiber(t *testing.T) {
	frame := realtimeErrorFrame(t, listenRealtime(t, func(c contract.Context) {
		Relay(c, types.RelayFormatOpenAIRealtime)
	}))

	event := map[string]any{}
	require.NoError(t, json.Unmarshal([]byte(frame), &event),
		"a realtime frame must be a JSON event: %s", frame)
	assert.Equal(t, "error", event["type"], "a relay failure must be reported as an error event")

	eventID, _ := event["event_id"].(string)
	assert.True(t, strings.HasPrefix(eventID, "evt_"),
		"a realtime event must carry a locally generated event id, got %q", eventID)

	errorObject, ok := event["error"].(map[string]any)
	require.True(t, ok, "the frame must carry an error object")
	assert.Equal(t, string(types.ErrorTypeNewAPIError), errorObject["type"],
		"the error type a client observes must stay pinned to the relay's own classification")
	assert.NotEmpty(t, errorObject["message"], "a client must be told why the session failed")
}

// realtimeErrorFrame dials the realtime endpoint, asserts the handshake, and
// returns the first frame the server sends.
func realtimeErrorFrame(t *testing.T, baseURL string) string {
	t.Helper()

	dialer := gorilla.Dialer{
		Subprotocols:     []string{"realtime"},
		HandshakeTimeout: 10 * time.Second,
	}
	conn, response, err := dialer.Dial(strings.Replace(baseURL, "http://", "ws://", 1)+"/v1/realtime", nil)
	require.NoError(t, err, "the realtime handshake must complete")
	t.Cleanup(func() { _ = conn.Close() })

	assert.Equal(t, http.StatusSwitchingProtocols, response.StatusCode)
	assert.Equal(t, "realtime", response.Header.Get("Sec-WebSocket-Protocol"),
		"Sec-WebSocket-Protocol: realtime must be echoed")
	assert.Equal(t, "realtime", conn.Subprotocol())

	require.NoError(t, conn.SetReadDeadline(time.Now().Add(15*time.Second)))
	messageType, payload, err := conn.ReadMessage()
	require.NoError(t, err, "the relay failure must arrive as a frame on the socket")
	assert.Equal(t, gorilla.TextMessage, messageType,
		"realtime events are text frames")

	return string(payload)
}

// listenRealtime serves handler at GET /v1/realtime on a real loopback socket and
// returns its base URL. The listener is real rather than app.Test because a
// websocket upgrade needs a hijackable connection, which an in-process request
// cannot offer.
func listenRealtime(t *testing.T, handler contract.Handler) string {
	t.Helper()

	app := fiber.New(fiber.Config{})
	app.Add([]string{fiber.MethodGet}, "/v1/realtime", func(c fiber.Ctx) error {
		return fiberadapter.Dispatch(c, []contract.Handler{handler})
	})

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)

	go func() { _ = app.Listener(listener) }()
	t.Cleanup(func() { _ = app.ShutdownWithTimeout(2 * time.Second) })

	return "http://" + listener.Addr().String()
}
