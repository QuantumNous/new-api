// Package smart_router_client is the DeepRouter-side adapter that calls the
// sibling smart-router service (https://github.com/deeprouter-ai/smart-router)
// to decide which concrete model to serve a `deeprouter-auto` virtual-model
// request with.
//
// Architectural notes:
//   - The smart-router service runs in a SEPARATE process under a non-AGPL
//     license. This file imports nothing from it and exchanges only JSON over
//     HTTP — that's the boundary that keeps the routing-logic moat outside
//     DeepRouter's AGPL viral inheritance.
//   - Failure modes (smart-router down, timeout, malformed reply) MUST NOT
//     break the gateway. `Route` returns (nil, nil) in those cases so the
//     distributor middleware can fall back to its default model.
//   - A tiny circuit breaker prevents a stalled smart-router from adding
//     latency to every request: after `breakerThreshold` consecutive failures
//     we fast-fail for `breakerCooldown`.
//
// Env config:
//   - SMART_ROUTER_URL          smart-router base URL (e.g. http://localhost:8001)
//     When empty, Route is a no-op (returns nil, nil).
//   - SMART_ROUTER_TIMEOUT_MS   per-call timeout, default 100ms.
package smart_router_client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"sync"
	"sync/atomic"
	"time"
)

const (
	defaultTimeoutMs = 100
	breakerThreshold = 5
	breakerCooldown  = 30 * time.Second
)

type Message struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

type RouteRequest struct {
	TenantID  string    `json:"tenant_id"`
	Messages  []Message `json:"messages"`
	RequestID string    `json:"request_id,omitempty"`
	Stream    bool      `json:"stream,omitempty"`
}

type Decision struct {
	Primary         string   `json:"primary"`
	FallbackChain   []string `json:"fallback_chain"`
	Reason          string   `json:"reason"`
	StrategyVersion string   `json:"strategy_version"`
}

type errorResponse struct {
	Error             string `json:"error"`
	FallbackToDefault string `json:"fallback_to_default,omitempty"`
}

type Client struct {
	baseURL string
	http    *http.Client

	mu              sync.Mutex
	consecutiveFail int
	breakerUntil    time.Time
}

// NewClient builds a Client with the given base URL and per-call timeout.
// Pass an empty baseURL to get a permanently-disabled client (Route is a
// no-op). Exposed so call sites that wire smart-router into the request
// path can inject a stub in tests.
func NewClient(baseURL string, timeout time.Duration) *Client {
	if timeout <= 0 {
		timeout = defaultTimeoutMs * time.Millisecond
	}
	return &Client{
		baseURL: baseURL,
		http:    &http.Client{Timeout: timeout},
	}
}

var (
	once     sync.Once
	instance atomic.Pointer[Client]
)

// Default returns the process-wide client. The first call resolves env vars;
// later calls return the same pointer. When SMART_ROUTER_URL is unset the
// returned pointer is non-nil but `Route` always reports disabled.
//
// Callers that need a different baseURL (e.g. tests) should use NewClient
// instead — Default() is a singleton on purpose so we don't rebuild the
// http.Client on every request.
func Default() *Client {
	once.Do(func() {
		baseURL := os.Getenv("SMART_ROUTER_URL")
		timeoutMs := defaultTimeoutMs
		if v := os.Getenv("SMART_ROUTER_TIMEOUT_MS"); v != "" {
			if n, err := strconv.Atoi(v); err == nil && n > 0 {
				timeoutMs = n
			}
		}
		instance.Store(NewClient(baseURL, time.Duration(timeoutMs)*time.Millisecond))
	})
	return instance.Load()
}

func (c *Client) Enabled() bool {
	return c != nil && c.baseURL != ""
}

// Route asks smart-router to pick a model for this request. Returns (nil, nil)
// when the client is disabled, the circuit breaker is open, or the upstream
// returned an unusable response — caller must treat that as "use default
// fallback" rather than as a hard error.
func (c *Client) Route(ctx context.Context, req RouteRequest) (*Decision, error) {
	if !c.Enabled() {
		return nil, nil
	}
	if c.breakerOpen() {
		return nil, nil
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/route", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(httpReq)
	if err != nil {
		c.recordFailure()
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.recordFailure()
		return nil, fmt.Errorf("smart-router status=%d", resp.StatusCode)
	}

	// Two possible response shapes: success Decision OR errorResponse with
	// fallback_to_default. We try Decision first; missing Primary signals
	// the error branch.
	dec := &Decision{}
	if err := json.NewDecoder(resp.Body).Decode(dec); err != nil {
		c.recordFailure()
		return nil, err
	}
	if dec.Primary == "" {
		c.recordSuccess() // smart-router reachable and answered — not a breaker event
		return nil, nil
	}
	c.recordSuccess()
	return dec, nil
}

func (c *Client) breakerOpen() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	return time.Now().Before(c.breakerUntil)
}

func (c *Client) recordFailure() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.consecutiveFail++
	if c.consecutiveFail >= breakerThreshold {
		c.breakerUntil = time.Now().Add(breakerCooldown)
	}
}

func (c *Client) recordSuccess() {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.consecutiveFail = 0
	c.breakerUntil = time.Time{}
}
