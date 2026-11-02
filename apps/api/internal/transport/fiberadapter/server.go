package fiberadapter

import (
	"context"
	"fmt"
	"net"

	"github.com/QuantumNous/new-api/internal/transport/contract"
	"github.com/QuantumNous/new-api/internal/transport/fiberadapter/connwatch"

	"github.com/gofiber/fiber/v2"
)

// NewEngine builds the HTTP engine with panic recovery installed. onPanic
// receives the request context and the recovered value; returning normally
// completes the response.
//
// The fiber app is built here rather than in Serve because contract.Engine is
// held by value: a listener created inside Serve would be unreachable from the
// copy Shutdown is called on.
func NewEngine(onPanic func(c contract.Context, recovered any)) contract.Engine {
	app := fiber.New(fiber.Config{
		// The trusted-proxy check is inverted in fiber: with it disabled,
		// IsProxyTrusted returns true for every peer, so every forwarded header
		// would be believed and per-IP rate limiting could be bypassed with a
		// spoofed X-Forwarded-For. It is hardcoded rather than configurable
		// because the contract's requirement -- an empty list trusts nothing --
		// has no expression in fiber's disabled state.
		EnableTrustedProxyCheck: true,
		// fiber defaults to tcp4, while net/http listening on ":port" is
		// dual-stack. The default trusted-proxy list contains ::1 and fc00::/7,
		// which tcp4 would turn into dead configuration.
		Network:               fiber.NetworkTCP,
		DisableStartupMessage: true,
		// No timeouts, matching the http.Server this replaces, whose literal
		// carried only a Handler: a WriteTimeout would cut off long SSE streams.
	})

	policy := &proxyPolicyRef{}
	fallback := &fallbackRef{}
	root := &routes{app: app}
	server := engine{routes: root, policy: policy, fallback: fallback}

	// Resolving the client address is a fiber layer, not a contract handler: the
	// contract context reads the result while it is being built, so it has to
	// already be in Locals by then. It is registered before anything else for
	// the same reason.
	app.Use(func(c *fiber.Ctx) error {
		c.Locals(clientIPKey{}, resolveTrustedClientIP(c, policy.policy))
		return c.Next()
	})

	// Recovery is the first contract handler in every chain, as gin's
	// CustomRecovery is. It cannot be a fiber layer: Dispatch may run the chain
	// on another goroutine, where a fiber-level recover would not catch the
	// panic and the process would die.
	root.pending = []contract.Handler{recoverPanics(onPanic)}

	// The terminal fallback route is NOT registered here. fiber scans its stack
	// in registration order and stops at the first match, so a prefix layer
	// registered before the business routes would shadow every one of them. It
	// is registered by the first NoRoute or ServeAssets call instead, which the
	// process makes after all its routes.

	return server
}

// Serve listens on addr and blocks.
//
// The listener is wrapped by connwatch so each accepted connection is
// watched for a client disconnect at the kernel level; the request context
// bridges that signal (see newRequestContext). Fiber v2's Listen owns the
// net.Listen call, which is precisely the hook the wrap needs, so the same
// steps happen here and the wrapped listener goes through app.Listener --
// the documented entry point for custom listeners, and the same fasthttp
// Serve path app.Listen takes, so Shutdown still closes it.
//
// A graceful shutdown is not an error under the contract. fasthttp already
// reports one as a nil error from Serve -- its accept loop translates the closed
// listener into io.EOF and returns nil -- so unlike the net/http implementation
// there is no sentinel to swallow here.
func (e engine) Serve(addr string) error {
	ln, err := net.Listen(e.app.Config().Network, addr)
	if err != nil {
		return fmt.Errorf("failed to listen: %w", err)
	}
	return e.app.Listener(connwatch.Listener(ln))
}

// Shutdown stops accepting connections and waits for in-flight requests until
// ctx expires.
//
// Shutting down an engine that never listened is not an error worth
// propagating: fiber reports it as one, but the caller asked for a stopped
// server and has one.
func (e engine) Shutdown(ctx context.Context) error {
	err := e.app.ShutdownWithContext(ctx)
	if err != nil && err.Error() == shutdownNotRunning {
		return nil
	}
	return err
}

// shutdownNotRunning is the condition fiber reports when Shutdown is called
// before Listen. fiber builds it with fmt.Errorf and exports no sentinel, so the
// message is the only available discriminator.
const shutdownNotRunning = "shutdown: server is not running"

// The context implementation resolves the client address through this hook, so
// the forwarded-header walk stays with the engine that owns the trust policy.
func init() {
	trustedClientIP = ResolvedClientIP
}
