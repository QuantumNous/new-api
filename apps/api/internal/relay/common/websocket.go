package common

import (
	"errors"

	fastws "github.com/fasthttp/websocket"
	"github.com/gorilla/websocket"
)

// IsNormalWSClose reports whether err is the peer closing a websocket cleanly:
// a close frame carrying 1000 (normal closure) or 1001 (going away). The relay
// treats those as an ordinary end of conversation and everything else as a
// failure worth reporting.
//
// It has to recognise both libraries' close errors, and that is not redundant.
// The realtime relay holds two connections whose concrete types come from
// different modules: the client side is the server-side upgrade (gorilla under
// the previous adapter, gofiber/contrib -- i.e. fasthttp/websocket -- under the fiber
// one), while the target side is always a gorilla client dial.
// fasthttp's websocket package is a gorilla fork, so the two *CloseError types are
// structurally identical but distinct Go types, and each library's own
// IsCloseError type-asserts only its own: gorilla.IsCloseError returns false for
// a fasthttp CloseError and vice versa.
//
// That failure is silent and it is the reason this exists. Using one library's
// check for both connections would classify every clean disconnect on the other
// as an error, so an ordinary browser closing a realtime session would be logged
// and reported as a relay failure on every request.
func IsNormalWSClose(err error) bool {
	var gorillaClose *websocket.CloseError
	if errors.As(err, &gorillaClose) {
		return isNormalCloseCode(gorillaClose.Code)
	}
	var fastClose *fastws.CloseError
	if errors.As(err, &fastClose) {
		return isNormalCloseCode(fastClose.Code)
	}
	return false
}

// isNormalCloseCode is the shared code test. Both libraries define these
// constants with the RFC 6455 values, so the numbers agree; naming them through
// gorilla's constants keeps the intent readable.
func isNormalCloseCode(code int) bool {
	return code == websocket.CloseNormalClosure || code == websocket.CloseGoingAway
}
