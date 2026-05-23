# internal/billing

Per-request billing webhook dispatcher. Signs payloads with HMAC-SHA256, retries transient failures with exponential backoff, gives up on permanent ones, and never blocks the relay path.

**Status**: ✅ Implemented + unit-tested. 🟡 **Not yet wired into the relay completion path** — `PLAN.md` Phase 2 will hook it in. Don't claim webhooks fire today.

## What it does

The receiver (e.g. Airbotix `platform-backend` `/internal/deeprouter/billing`) is responsible for deducting credits and recording the ledger. This package only:

1. Builds the event payload from per-request data (tokens, cost, model, tenant).
2. HMAC-signs the payload with the tenant's webhook secret.
3. POSTs to the tenant-configured URL.
4. Retries 3× with exponential backoff (200ms → 400ms → 800ms) on 5xx / network failures.
5. Gives up on 4xx (except 408 / 429, which count as transient).

## Public API

```go
type Event struct {
    RequestID       string
    TenantID        string
    FamilyID        string
    KidProfileID    string
    ProductLine     string
    Provider        string
    Model           string
    PromptTokens    int
    CompletionTokens int
    ImageCount      int
    CostUSD         float64
    Stars           int
    Timestamp       time.Time
}

func SignPayload(payload []byte, secret []byte) string                    // hex-encoded HMAC-SHA256
func NewDispatcher() *Dispatcher                                          // 3 retries, 5s HTTP timeout
func (*Dispatcher) Send(url string, secret []byte, ev *Event) (int, error) // returns final HTTP status + error
```

## Dependencies

- `common/json.go` (this repo's JSON wrapper — per AGENTS.md Rule 1)
- stdlib `net/http`, `bytes`, `time`, `crypto/hmac`, `crypto/sha256`

Zero imports from other `internal/` packages.

## How it will be wired (Phase 2)

```go
// in the relay completion path (where tokens are tallied / log row is written)
if user.BillingWebhookURL != "" && user.WebhookSecret != "" {
    go billing.NewDispatcher().Send(
        user.BillingWebhookURL,
        []byte(user.WebhookSecret),
        &billing.Event{ /* ... */ },
    )
}
```

`User.WebhookSecret` is a `varchar(128)` column already on the user table (`model/user.go:66`). It's stored plaintext, same as `channel.key` — see `docs/adr/0004-channel-key-plaintext.md` for the trade-off.

Open decisions before wiring:
- Bill on success only, or bill-then-refund-on-failure? `PLAN.md` Phase 4 prefers "bill on success only" — simpler reconciliation.
- Where exactly in the relay completion path to fire — coordinate with the quota-deduct write so we don't double-charge on retries.
- Per-request idempotency: receiver must dedupe by `RequestID`. Make sure `request_id` is propagated through the relay pipeline before flipping this on.

## Tests

`dispatcher_test.go` (105 LOC) covers:
- Signature stability (same input → same signature)
- 2xx success path
- 5xx retries up to limit
- 4xx permanent failure (no retry)
- 408 / 429 treated as transient

Run: `go test ./internal/billing/...`
