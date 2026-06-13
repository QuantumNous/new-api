# internal/billing

Per-request billing webhook dispatcher. Signs payloads with HMAC-SHA256, retries
transient failures with exponential backoff, and never blocks the relay path.

**Status**: ✅ Implemented, unit-tested, and wired into the relay completion path
(DR-25 / PLAN.md Phase 2). Webhooks fire for every successful, metered relay request
made by a tenant with `BillingWebhookURL` + `WebhookSecret` configured.

## What it does

The receiver (e.g. Airbotix `platform-backend`) is responsible for deducting credits
and recording the ledger. This package only:

1. Defines the `Event` payload schema (PRD §7.3).
2. HMAC-signs the payload with the tenant's webhook secret.
3. POSTs to the tenant-configured URL with `X-DeepRouter-Signature` and
   `X-DeepRouter-Event` headers.
4. Retries 3× with exponential backoff (200 ms → 400 ms → 800 ms) on 5xx / network
   failures.
5. Gives up permanently on 4xx (except 408/429, which are treated as transient).

Orchestration (reading gin.Context, constructing Event fields from relay metadata) is
the responsibility of `service/airbotix_billing.go` (ADR-0006, 4th sanctioned file).
This package stays free of upstream types.

## Public API

```go
// Event is the payload posted to tenant.BillingWebhookURL after each successful,
// metered relay request. All timestamps are RFC3339 UTC.
// JSON serialisation MUST use common.Marshal (AGENTS.md Rule 1).
type Event struct {
    RequestID        string   // per-request idempotency key; receiver deduplicates on this
    TenantID         string   // = model.User.Username
    FamilyID         string   // optional, omitempty
    KidProfileID     string   // end-user child profile from X-Tenant-User header, omitempty
    ProductLine      string   // optional, omitempty
    Provider         string   // e.g. "openai", "anthropic" — lowercase wire-format ID (PRD §7.3)
    Model            string   // concrete upstream model (smart-router resolved)
    RoutedFrom       string   // virtual model client sent (e.g. "deeprouter-auto"), omitempty
    PromptTokens     int      // actual tokens from upstream usage response
    CompletionTokens int      // actual tokens from upstream usage response
    ImageCount       int      // always 0 in V0; field always present per PRD §7.3 wire contract
    CostUSD          float64  // float64(quota) / common.QuotaPerUnit
    Stars            int      // reserved for V1 Stars mapping, always 0, omitempty
    PolicyViolations []string // policy rules triggered; empty slice (never nil) when none
    StartedAt        string   // RFC3339 UTC: relay request start (RelayInfo.StartTime)
    FinishedAt       string   // RFC3339 UTC: token tally time (time.Now() at dispatch)
}

func SignPayload(payload, secret []byte) string
// Returns lowercase hex HMAC-SHA256(secret, payload).
// Placed in X-DeepRouter-Signature header by Send().

func NewDispatcher() *Dispatcher
// Returns Dispatcher with 3 retries and 5 s HTTP timeout.

func (*Dispatcher) Send(url string, secret []byte, ev *Event) (int, error)
// Serialises ev, signs, POSTs. Returns final HTTP status + error.
// nil error = 2xx received.
```

## Dependencies

- `common/json.go` — this repo's JSON wrapper (AGENTS.md Rule 1)
- stdlib: `net/http`, `bytes`, `time`, `crypto/hmac`, `crypto/sha256`, `encoding/hex`

Zero imports from other `internal/` packages. Zero gin / GORM / relay imports.

## Wiring (how orchestration calls this package)

```go
// service/airbotix_billing.go — called by PostTextConsumeQuota after SettleBilling
event := &billing.Event{
    RequestID:        relayInfo.RequestId,
    TenantID:         user.Username,
    KidProfileID:     c.GetHeader("X-Tenant-User"),
    Provider:         channelTypeProviderID(relayInfo.ChannelType), // lowercase wire-format ID; see channelTypeToProviderID map
    Model:            relayInfo.OriginModelName,
    RoutedFrom:       "deeprouter-auto", // only when smart-router resolved
    PromptTokens:     usage.PromptTokens,
    CompletionTokens: usage.CompletionTokens,
    CostUSD:          float64(quota) / common.QuotaPerUnit,
    PolicyViolations: []string{}, // empty slice (never nil); Phase 4 content moderation populates
    StartedAt:        relayInfo.StartTime.UTC().Format(time.RFC3339),
    FinishedAt:       time.Now().UTC().Format(time.RFC3339),
}
gopool.Go(func() {
    billing.NewDispatcher().Send(user.BillingWebhookURL, []byte(user.WebhookSecret), event)
})
```

`User.WebhookSecret` is a `varchar(128)` plaintext column on the users table
(`model/user.go`). See `docs/adr/0004-channel-key-plaintext.md` for the trade-off.

## Billing rules

- **Bill on success only** (PLAN.md Phase 2): dispatch only after a successful relay.
  Failed requests go through `Refund`, never reach `PostTextConsumeQuota`.
- **Metered completion guard**: dispatch only when `PromptTokens + CompletionTokens > 0`
  (upstream returned real usage). Zero-price models (quota==0 but tokens>0) still fire —
  the receiver needs token counts for usage accounting.
- **Idempotency**: receiver deduplicates by `RequestID`. Relay retries reuse the same
  `request_id` so double-charges are prevented on the receiver side.

## Tests

`webhook_test.go` covers:
- HMAC signature correctness + stability (same input → same digest)
- Full dispatch with payload + signature verification
- No-op guards (nil usage, missing URL/secret, zero tokens)
- 5xx retry up to MaxRetries
- 4xx permanent failure (no retry)
- 408/429 treated as transient
- `X-DeepRouter-Event` header presence
- RoutedFrom field populated for deeprouter-auto; absent for direct requests

Run: `go test ./internal/billing/... -race`
