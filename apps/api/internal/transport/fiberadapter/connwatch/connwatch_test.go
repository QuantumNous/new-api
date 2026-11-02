package connwatch

import (
	"net"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// watchedPair dials a wrapped listener and hands back both ends plus the
// server-side disconnect channel. It skips where the platform has no poller
// (Done reports nil), because there the package's contract is only that it
// degrades to write-failure detection.
func watchedPair(t *testing.T) (client net.Conn, server net.Conn, done <-chan struct{}) {
	t.Helper()

	inner, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	ln := Listener(inner)
	t.Cleanup(func() { _ = ln.Close() })

	type accepted struct {
		conn net.Conn
		err  error
	}
	acceptedCh := make(chan accepted, 1)
	go func() {
		c, err := ln.Accept()
		acceptedCh <- accepted{conn: c, err: err}
	}()

	client, err = net.Dial("tcp", inner.Addr().String())
	require.NoError(t, err)
	t.Cleanup(func() { _ = client.Close() })

	got := <-acceptedCh
	require.NoError(t, got.err)
	server = got.conn
	t.Cleanup(func() { _ = server.Close() })

	done = Done(server)
	if done == nil {
		t.Skip("platform provides no kernel disconnect watch; Done degrades to nil")
	}
	return client, server, done
}

func isClosed(done <-chan struct{}) bool {
	select {
	case <-done:
		return true
	default:
		return false
	}
}

// TestDoneFiresOnPeerFin is the regression check for the disconnect signal:
// the relay must observe the client's FIN without waiting for a write to
// fail, which is what billed clients who had already left.
func TestDoneFiresOnPeerFin(t *testing.T) {
	client, _, done := watchedPair(t)

	require.NoError(t, client.Close())

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("disconnect channel did not fire on client FIN")
	}
}

// TestDoneFiresOnPeerRst covers the abort path (browser cancel mid-upload,
// SO_LINGER=0 close): no FIN ever arrives, only RST.
func TestDoneFiresOnPeerRst(t *testing.T) {
	client, _, done := watchedPair(t)

	tcp, ok := client.(*net.TCPConn)
	require.True(t, ok)
	require.NoError(t, tcp.SetLinger(0))
	require.NoError(t, tcp.Close())

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("disconnect channel did not fire on client RST")
	}
}

// TestDoneSilentWhilePeerReadable pins the kqueue filter: EVFILT_READ also
// fires on readable data, and only EV_EOF may count as a disconnect. A
// keep-alive client that sends a request and keeps reading must not look
// gone, or every streamed relay would cancel itself after the first frame.
func TestDoneSilentWhilePeerReadable(t *testing.T) {
	client, server, done := watchedPair(t)

	_, err := client.Write([]byte("GET /v1/chat/completions HTTP/1.1\r\nHost: example\r\n\r\n"))
	require.NoError(t, err)

	buf := make([]byte, 64)
	n, err := server.Read(buf)
	require.NoError(t, err)
	assert.Contains(t, string(buf[:n]), "GET /v1/chat/completions")

	assert.False(t, isClosed(done), "readable data must not register as a disconnect")
	time.Sleep(100 * time.Millisecond)
	assert.False(t, isClosed(done), "an open connection must stay silent")
}

// TestDoneFiresOnLocalClose covers the server-side close path: keep-alive
// expiry and shutdown must release the watch (channel fires, fd map entry
// is dropped) instead of leaking it.
func TestDoneFiresOnLocalClose(t *testing.T) {
	_, server, done := watchedPair(t)

	require.NoError(t, server.Close())

	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("disconnect channel did not fire on local close")
	}
}

// TestDoneNilForUnwatchedConn is the degradation contract callers branch on:
// a conn that never came through Listener reports nil, so the adapter keeps
// its write-failure fallback without a platform check.
func TestDoneNilForUnwatchedConn(t *testing.T) {
	pipeClient, pipeServer := net.Pipe()
	t.Cleanup(func() {
		_ = pipeClient.Close()
		_ = pipeServer.Close()
	})
	assert.Nil(t, Done(pipeClient))
}

// TestNoConnLeak pins the watcher's internal registry against growth: after
// every accepted connection is closed, the token map must drain to empty so
// a stream of keep-alive connections cannot accumulate tombstones.
func TestNoConnLeak(t *testing.T) {
	inner, err := net.Listen("tcp", "127.0.0.1:0")
	require.NoError(t, err)
	ln := Listener(inner)
	t.Cleanup(func() { _ = ln.Close() })
	lw, ok := ln.(*listenerWrap)
	require.True(t, ok, "expected a wrapped listener on this platform")

	type accepted struct {
		conn net.Conn
		err  error
	}
	acceptedCh := make(chan accepted, 8)
	go func() {
		for {
			c, err := ln.Accept()
			acceptedCh <- accepted{conn: c, err: err}
		}
	}()

	for i := 0; i < 8; i++ {
		c, err := net.Dial("tcp", inner.Addr().String())
		require.NoError(t, err)
		got := <-acceptedCh
		require.NoError(t, got.err)
		_ = c.Close()
		_ = got.conn.Close()
	}

	// Closing both ends lets the watcher observe the peer disconnect and drop
	// the registration; give it a moment, then require an empty map.
	require.Eventually(t, func() bool {
		lw.watcher.mu.Lock()
		defer lw.watcher.mu.Unlock()
		return len(lw.watcher.conns) == 0
	}, time.Second, 10*time.Millisecond)
}
