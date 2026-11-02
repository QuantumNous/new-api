// Package connwatch watches accepted TCP connections for the client going
// away (FIN / RST / HUP) at the kernel level, via epoll on Linux and kqueue
// on macOS/BSD.
//
// Why: fasthttp's RequestCtx.Done only closes on server shutdown, never on a
// client disconnect (fasthttp #468 / #965, fiber #1718 / #4145), so a long
// relay keeps pulling from the provider and billing a client that is already
// gone. Fiber v3 fixed this in the framework itself; Fiber v2 has no
// equivalent, so the watch lives one layer below the framework: Listener
// wraps the accept path at Serve time, and Done exposes the per-connection
// signal the adapter bridges into the request context.
//
// On a platform without epoll/kqueue, when the poller cannot be created, or
// when a connection's socket fd cannot be recovered, Listener still serves
// and Done reports nil: the adapter then falls back to its write-failure
// detection alone, so no caller needs a platform branch.
//
// Known limit, inherited from the signal itself: a client that half-closes
// its write side while still reading (shutdown(SHUT_WR), which no mainstream
// HTTP client does) looks like a disconnect. The write-failure path in the
// adapter is unaffected by this case, which is why it is kept as the
// fallback rather than replaced.
//
// The watcher design is a port of github.com/gtoxlili/fiber-disconnect
// (MIT, Copyright (c) 2026 gtoxlili), adapted from that library's
// Watch(fiber.Ctx) for Fiber v3 to a net.Conn-level Done so it binds to
// Fiber v2's RequestCtx().Conn() without pulling in a second Fiber major.
package connwatch

import (
	"crypto/tls"
	"net"
	"sync"
	"sync/atomic"
	"syscall"
)

// poller is the platform-specific half: epoll on Linux, kqueue on the BSDs.
type poller interface {
	register(fd int, token int32) error
	deregister(fd int, token int32) error
	wait() ([]int32, error) // blocks until a peer vanished; returns registration tokens
	close() error           // makes wait return so the loop exits
}

// watcher owns the token space: every registration gets a fresh token that
// the poller records in the kernel and echoes back on a disconnect event. The
// loop resolves tokens, never fds, so a stale event for an fd that has since
// been closed and re-accepted cannot be mistaken for the new connection's
// disconnect.
type watcher struct {
	poller poller
	mu     sync.Mutex
	tokens atomic.Uint32
	conns  map[int32]*watchedConn
	closed atomic.Bool
}

// watchedConn is an accepted connection whose peer events are registered
// with the poller.
type watchedConn struct {
	net.Conn
	fd     int
	token  int32
	parent *watcher
	done   chan struct{}
	once   sync.Once
}

// Close fires the done signal and drops the registration, so a connection
// the server itself closes (keep-alive expiry, shutdown) releases the watch
// instead of lingering in the fd map. Unregistering before the real Close is
// load-bearing: it closes the window where a freed fd could be re-accepted
// while the map still held the stale entry.
func (wc *watchedConn) Close() error {
	wc.parent.unregister(wc.token, wc.fd)
	wc.once.Do(func() { close(wc.done) })
	return wc.Conn.Close()
}

func (w *watcher) wrap(c net.Conn) net.Conn {
	fd, ok := connFD(c)
	if !ok {
		return c
	}
	wc := &watchedConn{Conn: c, fd: fd, parent: w, done: make(chan struct{}), token: int32(w.tokens.Add(1))}
	// Register with the poller first so a disconnect cannot slip in before
	// the entry is visible; the loop only learns about a conn it can look up.
	if err := w.poller.register(fd, wc.token); err != nil {
		// Cannot register? Fall back to the raw conn rather than dropping it.
		return c
	}
	w.mu.Lock()
	w.conns[wc.token] = wc
	w.mu.Unlock()
	return wc
}

func (w *watcher) unregister(token int32, fd int) {
	w.mu.Lock()
	delete(w.conns, token)
	w.mu.Unlock()
	_ = w.poller.deregister(fd, token)
}

func (w *watcher) loop() {
	for {
		tokens, err := w.poller.wait()
		if err != nil {
			// Platform waiters absorb EINTR internally, so an error here
			// is either the shutdown wake-up or a dead poller fd. Both
			// end the loop; continuing on a dead poller would pin a core.
			// Conns left unwatched degrade to the adapter's write-failure
			// fallback, same as a platform with no poller.
			return
		}
		for _, token := range tokens {
			w.mu.Lock()
			wc := w.conns[token]
			delete(w.conns, token)
			w.mu.Unlock()

			if wc != nil {
				wc.once.Do(func() { close(wc.done) })
			}
			// No deregister: the poller deregisters on close or re-register
			// of the fd, and the token is gone, so a stale event is a no-op.
		}
	}
}

func (w *watcher) shutdown() {
	if !w.closed.CompareAndSwap(false, true) {
		return
	}
	_ = w.poller.close()
}

type listenerWrap struct {
	net.Listener
	watcher *watcher
}

func (l *listenerWrap) Accept() (net.Conn, error) {
	c, err := l.Listener.Accept()
	if err != nil {
		return nil, err
	}
	return l.watcher.wrap(c), nil
}

func (l *listenerWrap) Close() error {
	l.watcher.shutdown()
	return l.Listener.Close()
}

// Listener wraps inner so each accepted connection is watched for a
// disconnect at the kernel level. On unsupported platforms, or when the
// poller cannot be created, it returns inner unchanged.
func Listener(inner net.Listener) net.Listener {
	p, err := newPoller()
	if err != nil {
		return inner
	}
	w := &watcher{poller: p, conns: make(map[int32]*watchedConn)}
	go w.loop()
	return &listenerWrap{Listener: inner, watcher: w}
}

// Done returns a channel closed when the peer of conn shuts down its write
// side (FIN), resets the connection (RST), hangs up, or when conn itself is
// closed locally.
//
// It returns nil when conn is not watched -- the listener was never wrapped,
// the platform has no poller, or the fd was unrecoverable. A nil channel
// blocks forever, so callers branch on nil to keep their existing fallback;
// there is no error to handle because "no signal" is the supported answer
// on those paths.
func Done(conn net.Conn) <-chan struct{} {
	if wc, ok := conn.(*watchedConn); ok {
		return wc.done
	}
	return nil
}

// connFD digs out the underlying TCP socket fd. For TLS conns it unwraps to
// the inner *net.TCPConn via NetConn().
func connFD(conn net.Conn) (int, bool) {
	if tc, ok := conn.(*tls.Conn); ok {
		conn = tc.NetConn()
		if conn == nil {
			return 0, false
		}
	}
	sc, ok := conn.(syscall.Conn)
	if !ok {
		return 0, false
	}
	raw, err := sc.SyscallConn()
	if err != nil {
		return 0, false
	}
	var fd int
	if err := raw.Control(func(f uintptr) { fd = int(f) }); err != nil {
		return 0, false
	}
	return fd, true
}
