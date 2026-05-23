# ARCHITECTURE.md — deeprouter module tour

A reading map for the upstream-derived modules. Pairs with:
- `CLAUDE.md` — codebase map (where things live, fork-specific knowledge, key facts).
- `AGENTS.md` — coding rules.
- `relay/README.md` and `relay/channel/README.md` — the relay subsystem deep-dive.
- `internal/{billing,kids,policy,smart_router_client}/README.md` — Airbotix-private packages.

This file describes the **upstream architecture** (`router/` → `controller/` → `service/` → `model/`). For what Airbotix changes, read `AIRBOTIX.md` first.

## The mental model

```
Client HTTP request
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│  Gin engine (main.go)                                                  │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│  router/                                                               │
│    Registers all routes. Two main groups:                              │
│      • /api/*  → admin / dashboard (api-router.go)                     │
│      • /v1/*   → OpenAI-compatible LLM relay (relay-router.go)         │
│    Plus /dashboard/* (web UI) and other auxiliary groups.              │
│    Attaches middleware (auth, rate-limit, distributor) per group.      │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼ (admin path)                              ▼ (relay path)
┌────────────────────────────┐         ┌────────────────────────────────┐
│  middleware/               │         │  middleware/                   │
│    TokenAuth                │         │    TokenAuth → smart_router    │
│    AdminAuth / RootAuth     │         │    (Airbotix) → distributor    │
│    CriticalRateLimit        │         │    (channel-picker)            │
└────────────────────────────┘         └────────────────────────────────┘
        │                                          │
        ▼                                          ▼
┌────────────────────────────┐         ┌────────────────────────────────┐
│  controller/               │         │  relay/                        │
│    Channel CRUD, user mgmt │         │    handlers per request shape  │
│    Tokens, logs, billing   │         │    +relay/airbotix_policy.go   │
│    Dashboard data          │         │    +relay/channel/<provider>/  │
└────────────────────────────┘         └────────────────────────────────┘
        │                                          │
        ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│  service/                                                              │
│    Cross-cutting business logic: quota, log aggregation, file cache,   │
│    push notifications, balance refresh, model pricing                  │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────────────────┐
│  model/                                                                │
│    GORM models + DB access. User, Channel, Token, Ability, Log,        │
│    Redemption, TopUp, Midjourney, Task. Plus channel_cache.go which    │
│    is Layer-2 channel routing (priority-tier + weight).                │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
   PostgreSQL / MySQL / SQLite  +  Redis  +  in-memory cache
```

## Module-by-module

### `router/`
- `api-router.go` — admin/dashboard API (`/api/*`). Channels, users, tokens, logs, settings, OAuth callbacks.
- `relay-router.go` — `/v1/*` OpenAI-compatible relay + provider-native paths (`/v1/messages`, image, embeddings, audio, rerank, MJ proxy).
- `dashboard-router.go`, `web-router.go` — web UI static + dashboard endpoints.
- `relay-router-task.go` — async task endpoints (Midjourney, video generation).

Permissions are attached via middleware on a per-group basis. Reading `router/` is the fastest way to know what endpoints exist.

### `controller/`
Gin handlers. Conventions:
- One file per resource (`channel.go`, `user.go`, `token.go`, `log.go`).
- Channel handlers split: `channel.go` (CRUD), `channel-billing.go` (per-provider balance check), `channel-test.go` (e2e test endpoint), `channel_upstream_update.go` (model list sync).
- Relay-side handlers in `controller/relay.go` + `controller/relay-claude.go` etc. delegate the actual upstream call to `relay/`.

### `service/`
Business logic that doesn't fit in a single controller/model:
- `quota.go` — atomic quota check/deduct via Redis Lua or DB
- `log.go`, `log_summary.go` — log aggregation for dashboard
- `file_service.go` — file/URL cache with HMAC keys (uses `common.CryptoSecret`)
- `push_*.go` — webhook / push notification dispatch
- `model_balance.go`, `model_pricing.go` — pricing tables

### `model/`
GORM models. Important files:
- `user.go` — User table (extended with 5 Airbotix columns: `kids_mode`, `policy_profile`, `billing_webhook_url`, `custom_pricing_id`, `webhook_secret`).
- `channel.go` — Channel table. **`channels.key` is stored plaintext** (no AES anywhere in the codebase).
- `channel_cache.go` — Layer-2 channel routing. `GetRandomSatisfiedChannel` does priority-tier stratification then weight-based random selection within the tier. On retry N, jumps to the Nth priority tier. Health/retry orchestration sits at the controller layer, not here.
- `token.go` — API tokens (user-facing). Cache layer uses HMAC keys to avoid plaintext tokens in Redis.
- `ability.go` — denormalised (group, model) → channels lookup table; populated from Channels.
- `log.go` — request log table.
- `main.go` — migration entrypoint + cross-DB column helpers (`commonGroupCol`, `commonKeyCol`, `commonTrueVal`, etc.) used by raw-SQL fallbacks where GORM can't abstract over the three databases.

### `middleware/`
- `auth.go` — TokenAuth (extracts user from `Authorization: Bearer ...`), AdminAuth, RootAuth, SecureVerificationRequired (TOTP/Passkey gate for sensitive ops).
- `rate-limit.go` + `critical-rate-limit.go` — request rate limiting.
- `distributor.go` — picks a channel for the incoming request (model + group), sets context.
- `smart_router.go` — Airbotix: detects `deeprouter-auto` and calls `internal/smart_router_client/`.
- Plus CORS, logging, recovery, CSRF, request-id middlewares.

### `relay/`
Upstream LLM relay subsystem. See [`relay/README.md`](./relay/README.md) for the deep-dive.

Top-level entry handlers (one per request shape):
- `chat_completions_via_responses.go` — OpenAI `/v1/chat/completions` via Responses format
- `claude_handler.go` — Anthropic `/v1/messages` native shape
- `gemini_handler.go`, `responses_handler.go`, `embedding_handler.go`, `audio_handler.go`, `image_handler.go`, `rerank_handler.go`, `mjproxy_handler.go`, `websocket.go`
- `airbotix_policy.go` — fork-specific; applies policy + kids enforcement before provider conversion.

Provider adapters under `relay/channel/<provider>/` — 37 of them, see [`relay/channel/README.md`](./relay/channel/README.md).

### `setting/`
Runtime-mutable configuration (loaded from DB / env / in-memory cache):
- `ratio/` — model pricing ratios (prompt vs completion vs image)
- `model_setting/` — per-model defaults
- `operation_setting/` — operational toggles (e.g. data retention)
- `system_setting/` — site-wide settings (display name, registration mode)
- `performance_setting/` — concurrency / batch knobs

### `common/`
Shared utilities. Selected entries:
- `json.go` — JSON wrapper. **All marshal/unmarshal MUST go through this** (AGENTS.md Rule 1).
- `crypto.go` — HMAC + bcrypt. `CryptoSecret` is HMAC key, not an encryption key (see `CLAUDE.md` §2).
- `redis.go` — go-redis client + helpers.
- `rate-limit/` — token bucket implementations.
- `env.go` — env var parsing.

### `dto/`
Request/response DTOs. Important rule: **optional scalar fields must be pointers** (`*int`, `*float64`, `*bool`) so that `0` / `false` round-trip correctly through `omitempty` JSON marshal (AGENTS.md Rule 6).

### `constant/`
Enum-style constants:
- `channel.go` — `ChannelType*` integers + `ChannelName2ChannelId` map (adding a new provider requires touching this).
- `api_type.go` — `APIType*` enum used by `relay_adaptor.go` to dispatch.
- `context_keys.go` — Gin context keys (user id, channel, model, etc.).

### `types/`
Type definitions for relay formats, file sources, and the `NewAPIError` error type with structured codes.

### `pkg/`
Internal libraries:
- `billingexpr/` — billing expression evaluator. **Read `pkg/billingexpr/expr.md` before editing** (AGENTS.md Rule 7).
- `cachex/`, `ionet/` — small internal libraries.

### `web/`
- `web/default/` — production frontend (React 19 + Rsbuild + Base UI + Tailwind). Bun is the package manager.
- `web/classic/` — legacy frontend (React 18 + Vite + Semi Design). Kept for compatibility.

## Two-layer routing in one diagram

This is the single most important architectural fact across the whole system:

```
Client model: "deeprouter-auto"          Client model: "claude-haiku-4-5"
        │                                         │
        ▼                                         │
  middleware/smart_router.go              (skip Layer 1)
        │ → POST localhost:8001/route             │
        │ ← {primary: "claude-haiku-4-5", ...}    │
        ▼                                         │
   Layer 1: model resolved ━━━━━━━━━━━━━━━━━━━━━━┛
        ▼
  middleware/distributor.go
        │ → model/channel_cache.go:GetRandomSatisfiedChannel
        │   (priority tier → weight-based random)
        ▼
   Layer 2: channel resolved (which API key for this model)
        ▼
  relay/<handler>.go → relay/channel/<provider>/adaptor.go
        ▼
  upstream LLM API call
```

Layer 1 (model routing) is what the smart-router sidecar adds on top of upstream new-api. Layer 2 (channel routing) is the existing new-api behaviour.

## Cross-cutting concerns

### Cross-DB compatibility (AGENTS.md Rule 2)
- The codebase MUST work on SQLite, MySQL ≥ 5.7.8, and PostgreSQL ≥ 9.6.
- Raw SQL is rare; when used, branch on `common.UsingPostgreSQL` / `UsingMySQL` / `UsingSQLite` and use the `commonGroupCol` / `commonKeyCol` / `commonTrueVal` helpers.

### Multi-tenancy
- Single `User` table. Tenancy is per-User via the 5 Airbotix columns (see `docs/data-model.md`).
- Quota / rate-limit / billing are all per-user.
- Group membership (`ability` table) gates which models a user can see.

### Cache layers
1. **In-memory cache** — `model/channel_cache.go`, `setting/*` (atomic pointers for hot-reload).
2. **Redis** — token validation cache (HMAC keys), file/URL cache, rate-limit buckets, quota counters.
3. **Postgres/MySQL/SQLite** — source of truth.

When changing any cached entity, look for the cache invalidation hook in the matching model file.

### Error model
- `types/error.go` defines `NewAPIError` with a `Code` enum (`ErrorCodeChannelNoAvailableKey`, etc.).
- Relay paths return rich errors that include channel ID + key index for log forensics.
- Controller paths return Gin JSON errors.

## Where to start as a new engineer

1. Read this file end-to-end.
2. Read `CLAUDE.md` for the fork-specific knowledge.
3. Run `DEV.md` §1–4 (docker compose up + first admin + first curl).
4. Open `router/api-router.go` and `router/relay-router.go` and trace one request you care about all the way to `relay/channel/<provider>/adaptor.go`.
5. Read `relay/README.md` if you'll be touching provider adapters.
6. Read `internal/*/README.md` for the four Airbotix packages.
