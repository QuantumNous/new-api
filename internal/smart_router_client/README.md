# internal/smart_router_client

HTTP client that talks to the `smart-router` sidecar. Resolves the `deeprouter-auto` virtual model name into a concrete model (e.g. `claude-haiku-4-5`) by POSTing the prompt to smart-router's `/route` endpoint.

**Status**: ✅ Implemented + unit-tested + wired via `middleware/smart_router.go`.

## Why this is a separate package (license boundary)

`../smart-router/` is **Apache 2.0**. This repo is **AGPL v3** (inherited from upstream). AGPL is viral across linkage — if we imported smart-router as a Go module, smart-router would become AGPL too, and the commercial routing moat would be gone.

The fix: smart-router runs as a **separate process**, this package only speaks JSON HTTP to it, and **nothing here imports from `../smart-router/`**. See `../CLAUDE.md` for the full process-boundary rationale.

## What it does

1. Reads env vars `SMART_ROUTER_URL` (e.g. `http://localhost:8001`) and `SMART_ROUTER_TIMEOUT_MS` (default 100) on first call to `Default()`. If `SMART_ROUTER_URL` is empty, the client is disabled and `Route()` returns `(nil, nil)` immediately.
2. Builds a `RouteRequest`, POSTs JSON to `<base>/route` with the configured timeout.
3. On success: returns `*Decision` (primary model + fallback chain + reason + strategy version).
4. On error / non-2xx / timeout: returns `(nil, nil)` so the caller can fall back to a default model — **never blocks the gateway**.
5. Tracks consecutive failures; after **5 in a row**, the breaker opens for **30 seconds** and `Route()` short-circuits with `(nil, nil)` without making any HTTP call.

## Public API

```go
type Message struct { Role, Content string }

type RouteRequest struct {
    TenantID  string
    Messages  []Message
    RequestID string   // optional
    Stream    bool     // optional
}

type Decision struct {
    Primary         string
    FallbackChain   []string
    Reason          string
    StrategyVersion string
}

func NewClient(baseURL string, timeout time.Duration) *Client  // for test injection
func Default() *Client                                          // process-wide singleton; reads env vars
func (*Client) Enabled() bool                                   // false if baseURL is empty
func (*Client) Route(ctx context.Context, req RouteRequest) (*Decision, error)
```

## Failure model — `(nil, nil)` means "use default"

```go
decision, err := smart_router_client.Default().Route(ctx, req)
if err != nil {
    // network/protocol error worth logging — but DO NOT fail the request
    log.Warn("smart-router error", "err", err)
}
if decision == nil {
    model = config.DefaultAutoFallbackModel  // currently "gpt-4o-mini"
} else {
    model = decision.Primary
}
```

This is intentional. Smart-router being slow or down must never bring the gateway down.

## Dependencies

- stdlib only (`net/http`, `encoding/json`, `context`, `sync`, `time`, `os`, `strconv`)
- Crucially: **no imports from `../smart-router/`**. The Go module graph is disjoint by design.

## How it's wired

`middleware/smart_router.go` calls `smart_router_client.Default().Route(...)` for any incoming `/v1/chat/completions` request where `model == "deeprouter-auto"`. If a decision comes back, the model name on the request is rewritten before the relay code picks a channel; the chosen model is echoed back in the response header `X-DeepRouter-Routed-Model`.

## Tests

`client_test.go` (116 LOC) covers:
- Happy path (200 with valid Decision)
- Disabled client (empty `SMART_ROUTER_URL`) → `(nil, nil)`
- Non-2xx → `(nil, nil)` + error logged
- Catalog upstream returning error JSON → `(nil, nil)`
- Circuit breaker opens after 5 consecutive failures, fast-fails for 30s, then resets
- Request context timeout honoured

Run: `go test ./internal/smart_router_client/...`

## Configuration knobs

| Env var | Default | Purpose |
|---|---|---|
| `SMART_ROUTER_URL` | empty (= disabled) | Base URL of the sidecar, e.g. `http://localhost:8001` or `http://smart-router:8001` in docker compose |
| `SMART_ROUTER_TIMEOUT_MS` | `100` | Per-request HTTP timeout; values > 200 will eat into the < 10ms p99 overhead budget |

The 5-failure / 30s breaker thresholds are constants in `client.go`. Tuning them is a code change, not a config knob — keeps the failure mode predictable.
