package main

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestShutdownAccountingReservesPersistenceAfterDrainTimeout(t *testing.T) {
	persisted := false
	err := shutdownAccounting(0, time.Second, func(ctx context.Context) error {
		return ctx.Err()
	}, func(ctx context.Context) error {
		require.NoError(t, ctx.Err())
		persisted = true
		return nil
	})
	assert.ErrorIs(t, err, context.DeadlineExceeded)
	assert.True(t, persisted)
	failure := errors.New("database unavailable")
	assert.ErrorIs(t, shutdownAccounting(time.Second, time.Second, func(context.Context) error {
		return nil
	}, func(context.Context) error { return failure }), failure)
}

func TestHTTPAccountingDrainJoinsHijackedSettlement(t *testing.T) {
	hijacked, disconnected, release, settled := make(chan struct{}), make(chan struct{}), make(chan struct{}), make(chan struct{})
	var releaseOnce sync.Once
	drain := &httpAccountingDrain{connections: make(map[net.Conn]int), handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, _, err := w.(http.Hijacker).Hijack()
		if err != nil {
			return
		}
		defer conn.Close()
		close(hijacked)
		_, _ = conn.Read(make([]byte, 1))
		close(disconnected)
		<-release // Usage settlement can continue after the socket has closed.
		close(settled)
	})}
	srv := httptest.NewUnstartedServer(drain)
	srv.Config.ConnContext = func(ctx context.Context, conn net.Conn) context.Context {
		return context.WithValue(ctx, httpConnectionContextKey{}, conn)
	}
	srv.Start()
	t.Cleanup(func() { releaseOnce.Do(func() { close(release) }); srv.Close() })
	conn, err := net.Dial("tcp", srv.Listener.Addr().String())
	require.NoError(t, err)
	defer conn.Close()
	_, err = conn.Write([]byte("GET / HTTP/1.1\r\nHost: localhost\r\n\r\n"))
	require.NoError(t, err)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	select {
	case <-hijacked:
	case <-ctx.Done():
		t.Fatal("handler did not hijack the connection")
	}
	require.NoError(t, srv.Config.Shutdown(ctx)) // net/http does not join this handler.
	done := make(chan error, 1)
	go func() { done <- drain.Drain(ctx) }()
	select {
	case <-disconnected:
	case <-ctx.Done():
		t.Fatal("drain did not close the hijacked socket")
	}
	select {
	case err := <-done:
		t.Fatalf("drain returned before settlement: %v", err)
	default:
	}
	releaseOnce.Do(func() { close(release) })
	require.NoError(t, <-done)
	select {
	case <-settled:
	default:
		t.Fatal("settlement did not finish")
	}
	late := httptest.NewRecorder()
	drain.ServeHTTP(late, httptest.NewRequest(http.MethodGet, "/", nil))
	assert.Equal(t, http.StatusServiceUnavailable, late.Code)
}
