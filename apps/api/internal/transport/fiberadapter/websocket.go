package fiberadapter

import (
	"errors"

	"github.com/QuantumNous/new-api/internal/transport/contract"

	"github.com/fasthttp/websocket"
	"github.com/valyala/fasthttp"
)

// upgradeRequest is the chain's request for a protocol upgrade, and the channel
// the dispatcher answers it on.
//
// The handshake cannot happen on the chain's goroutine. fasthttp reads
// RequestCtx.hijackHandler only after the request handler returned (server.go
// reads it once the handler is off the stack), so the hijack has to be
// registered while the fiber handler is still running -- which is the
// dispatcher, parked in run's select. The chain therefore asks, and the
// dispatcher performs.
type upgradeRequest struct {
	subprotocols []string
	// result carries the outcome back to the parked chain. It is buffered so
	// neither the dispatcher nor the hijack goroutine can block on a chain that
	// stopped waiting.
	result chan upgradeResult
}

// upgradeResult is the answer. conn is left nil on failure, and the caller
// returns the field rather than a concrete pointer, so the interface a failed
// upgrade produces is a true nil rather than one holding a nil pointer.
type upgradeResult struct {
	conn contract.WSConn
	err  error
}

// UpgradeWebSocket hands the chain a websocket connection over this request.
//
// The inversion fiber's websocket support normally imposes -- the framework owns
// the connection and calls you back -- is absorbed here rather than exported to
// business code. The chain parks, the dispatcher registers the hijack while it
// is still on fiber's stack, and the hijack goroutine hands the connection back
// to the parked chain and then waits for it. So the caller keeps writing
// straight-line code with its own defers, exactly as before.
//
// The response belongs to the upgrader from here on: on success fasthttp writes
// the 101 and the upgrade headers it staged, and on failure the upgrader has
// already written its own HTTP error. Neither may be overwritten by this
// adapter's commit, so both outcomes mark the response as no longer ours.
func (r *requestContext) UpgradeWebSocket(subprotocols ...string) (contract.WSConn, error) {
	return r.resp.upgrade(subprotocols)
}

// upgrade parks the chain until the dispatcher settles the handshake.
func (s *responseState) upgrade(subprotocols []string) (contract.WSConn, error) {
	request := &upgradeRequest{
		subprotocols: subprotocols,
		result:       make(chan upgradeResult, 1),
	}

	s.mu.Lock()
	switch {
	case s.mode != modeChain:
		// A direct or in-process response has no dispatcher parked on fiber's
		// stack to register the hijack, and an in-process context has no
		// connection at all. Reporting it is what the contract requires; the
		// alternative would be to hand back a connection that cannot exist.
		s.mu.Unlock()
		return nil, errors.New("fiberadapter: this context cannot be upgraded: no client connection")
	case s.streaming:
		s.mu.Unlock()
		return nil, errors.New("fiberadapter: cannot upgrade a response that already streamed")
	case s.upgrading:
		s.mu.Unlock()
		return nil, errors.New("fiberadapter: the response was already upgraded")
	}
	s.upgrading = true
	s.upgradeReq = request
	s.mu.Unlock()

	// Wake the dispatcher, then wait for it to settle the handshake.
	close(s.upgradeCh)
	result := <-request.result
	return result.conn, result.err
}

// commitUpgrade performs the handshake from the dispatcher, which is the one
// place still on fiber's stack.
//
// The asymmetry between the two outcomes is forced by when fasthttp runs a
// hijack handler: Upgrade only *registers* it, and fasthttp invokes it after the
// request handler returned and the 101 reached the client. So on success this
// must return immediately -- waiting for the chain here would wait for a chain
// that is still parked for a connection only the hijack handler can deliver.
// On failure there is no hijack handler, so this waits for the chain itself,
// because fiber recycles the fiber.Ctx as soon as it returns.
func (s *responseState) commitUpgrade() error {
	request := s.upgradeReq

	s.mu.Lock()
	// The staged response is abandoned: writeHeaders would set 200 over the
	// upgrader's 101 or over its error status, and stage a Content-Type onto a
	// response that must not have a body.
	s.committed = true
	s.mu.Unlock()

	upgrader := websocket.FastHTTPUpgrader{
		Subprotocols: request.subprotocols,
		// Every origin is accepted, matching what this route has always served:
		// the handshake carries no credentials of its own and the route
		// authenticates by bearer token like every other relay route.
		CheckOrigin: func(*fasthttp.RequestCtx) bool { return true },
	}

	if err := upgrader.Upgrade(s.fiber.RequestCtx(), func(conn *websocket.Conn) {
		// This runs on fasthttp's hijack goroutine, after the 101 reached the
		// client. Hand the connection to the parked chain, then stay here until
		// the chain is done: returning would let fasthttp close the connection
		// out from under it.
		request.result <- upgradeResult{conn: conn}
		<-s.finished
	}); err != nil {
		// conn is left nil, so the chain observes a true nil interface. Widening
		// a failed upgrade's concrete pointer here is the bug this shape exists
		// to prevent: the relay's error path checks `ws == nil` before writing an
		// error frame, and an interface holding a nil pointer passes that check
		// and then dereferences nil.
		request.result <- upgradeResult{err: err}
		<-s.finished
	}

	return nil
}
