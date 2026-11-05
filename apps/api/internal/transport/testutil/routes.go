package testutil

import (
	"bytes"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter"

	"github.com/gofiber/fiber/v3"
)

// ServeBufferedRoute runs an ordinary buffered request through a real Fiber
// route and fiberadapter.Dispatch. It flattens contract middleware and the
// handler into one chain, matching production route registration.
//
// It rejects custom peer addresses, SSE, and WebSocket requests. Those require
// real connection semantics and must use a transport-specific fixture instead.
func ServeBufferedRoute(t testing.TB, method, pattern string, middleware []contract.Middleware, handler contract.Handler, req *http.Request) *http.Response {
	t.Helper()
	if req == nil {
		t.Fatal("ServeBufferedRoute requires a request")
	}
	if req.RemoteAddr != "" && req.RemoteAddr != "192.0.2.1:1234" {
		t.Fatalf("ServeBufferedRoute does not support custom RemoteAddr %q", req.RemoteAddr)
	}
	if strings.Contains(strings.ToLower(req.Header.Get("Accept")), "text/event-stream") ||
		strings.EqualFold(req.Header.Get("Upgrade"), "websocket") ||
		strings.Contains(strings.ToLower(req.Header.Get("Connection")), "upgrade") {
		t.Fatal("ServeBufferedRoute does not support SSE or WebSocket requests")
	}

	app := fiber.New(fiber.Config{})
	chain := make([]contract.Handler, 0, len(middleware)+1)
	for _, middleware := range middleware {
		chain = append(chain, contract.Handler(middleware))
	}
	chain = append(chain, handler)
	app.Add([]string{method}, pattern, func(c fiber.Ctx) error { return fiberadapter.Dispatch(c, chain) })

	response, err := app.Test(req, fiber.TestConfig{Timeout: 10 * time.Second})
	if err != nil {
		t.Fatalf("serve buffered Fiber route: %v", err)
	}
	body, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatalf("drain buffered Fiber response: %v", err)
	}
	if err := response.Body.Close(); err != nil {
		t.Fatalf("close buffered Fiber response: %v", err)
	}
	if response.StatusCode == http.StatusSwitchingProtocols || strings.Contains(strings.ToLower(response.Header.Get("Content-Type")), "text/event-stream") {
		t.Fatal("ServeBufferedRoute does not support SSE or WebSocket responses")
	}
	response.Body = io.NopCloser(bytes.NewReader(body))
	return response
}
