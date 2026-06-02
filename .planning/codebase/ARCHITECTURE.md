# Atius AI Router — Architecture Document

**Project:** Atius AI Router (fork of QuantumNous/new-api)
**Stack:** Go 1.22+ / Gin (backend) | React 19 / Rsbuild / Tailwind CSS (frontend)
**Databases:** SQLite / MySQL / PostgreSQL (via GORM v2)
**Cache:** Redis (go-redis) + in-memory channel cache
**Last updated:** 2026-06-02

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Layered Architecture](#2-layered-architecture)
3. [Request Flow & Middleware Chain](#3-request-flow--middleware-chain)
4. [Authentication & Session Management](#4-authentication--session-management)
5. [API Relay Architecture](#5-api-relay-architecture)
6. [Data Flow Diagrams](#6-data-flow-diagrams)
7. [Directory Structure Reference](#7-directory-structure-reference)
8. [Database Schema Overview](#8-database-schema-overview)
9. [Key Components Detail](#9-key-components-detail)

---

## 1. System Overview

Atius AI Router is a unified AI API gateway that proxies requests to 40+ upstream AI providers (OpenAI, Claude, Gemini, Azure, AWS Bedrock, Midjourney, Suno, etc.) behind a single OpenAI-compatible API surface. It provides:

- **Multi-provider aggregation** — one API key per user, routed to the best available upstream channel
- **User management** — registration, login, groups, roles, quota/billing
- **Token/key management** — per-user API tokens with quota, IP allowlist, and model-level restrictions
- **Billing** — pre-consume quota hold + post-consume settlement, subscription plans, top-up
- **Rate limiting** — global API, per-model, per-token, per-IP
- **Multi-theme frontend** — default (React 19 + Base UI) and classic (React 18 + Semi Design), embedded as `embed.FS`
- **SSO/OAuth** — GitHub, Discord, OIDC, LinuxDO, WeChat, Telegram, Passkey/WebAuthn, TOTP 2FA

---

## 2. Layered Architecture

The project follows a strict **Router -> Controller -> Service -> Model** layered architecture:

```
router/         HTTP routing (entry point)
  |
  v
middleware/    Auth, rate limit, CORS, logging, compression (pre-processing)
  |
  v
controller/    Request handlers — parse input, call service, return response
  |
  v
service/       Business logic — billing, channel selection, quota, token counting
  |
  v
model/         Data access — GORM ORM, Redis, in-memory cache, disk cache
  |
  v
database/      SQLite / MySQL / PostgreSQL
```

### 2.1 Router Layer (`router/`)

Router files bind URL patterns to controller handlers and apply route-level middleware groups.

| File | Purpose |
|------|---------|
| `router/main.go` | `SetRouter()` — wires all sub-routers; conditionally serves web UI or proxies to `FRONTEND_BASE_URL` |
| `router/api-router.go` | `/api/*` — public setup, auth, user, channel, token, subscription, admin routes |
| `router/relay-router.go` | `/v1/*`, `/v1beta/*`, `/pg/*`, `/mj/*`, `/suno/*` — AI API relay routes |
| `router/dashboard.go` | `/`, `/v1/dashboard/*` — billing/usage dashboard (legacy compat) |
| `router/web-router.go` | `/*` — SPA frontend serving via `embed.FS`, theme-aware |
| `router/video-router.go` | `/kling/v1/*`, `/jimeng/*`, video proxy — task-based video generation routes |

### 2.2 Controller Layer (`controller/`)

Controllers are thin request handlers. They:
- Parse JSON/form/query parameters into DTOs
- Validate input
- Call one or more service-layer functions
- Map service errors to appropriate HTTP status codes and i18n messages
- Return JSON responses

Key controllers:

| Controller | Responsibility |
|-----------|---------------|
| `controller/relay.go` | Main relay entry — parses relay format, calls `relayHandler()`, handles errors per provider |
| `controller/user.go` | Login, register, logout, self-update, password reset, 2FA setup/enable/disable |
| `controller/channel.go` | CRUD channels, test, balance update, model fetch, tag management |
| `controller/token.go` | CRUD API tokens, key retrieval (masked), batch keys |
| `controller/billing.go` (inline) | Subscription, top-up, payment callbacks |
| `controller/passkey.go` | WebAuthn/Passkey registration and login (begin/finish) |
| `controller/task.go` | Task polling, status fetch for async operations |
| `controller/misc.go` | Setup status, about, notice, home page content |

### 2.3 Service Layer (`service/`)

Service packages contain pure(ish) business logic:

| Service | Responsibility |
|---------|---------------|
| `service/billing.go` + `billing_session.go` | Pre-consume quota hold, post-consume settlement, refund |
| `service/channel.go` + `channel_affinity.go` | Channel selection, affinity scoring, fallback routing |
| `service/text_quota.go` | Text/token quota management per user |
| `service/pre_consume_quota.go` | Quota reservation before upstream call |
| `service/token_counter.go` | Token/price estimation before relay |
| `service/token_estimator.go` | Fast token estimation for pricing |
| `service/task_billing.go` | Async task (Midjourney, Suno, video) billing |
| `service/http.go` | Shared HTTP client factory (with timeout, TLS, proxy) |
| `service/passkey/` | WebAuthn registration/login session management |
| `service/subscription_reset_task.go` | Daily quota reset for subscription plans |

### 2.4 Model Layer (`model/`)

Model packages handle all data access via GORM:

| Model | Table |
|-------|-------|
| `model/user.go` | `users` — id, username, password hash, role, status, group, email, 2FA secret |
| `model/token.go` | `tokens` — user_id, key (hashed), name, quota, model_limits, ip_allowlist, group |
| `model/channel.go` | `channels` — type, key, base_url, balance, models, weight, group, tag, priority |
| `model/subscription.go` | `subscriptions` — user, plan, status, period_start/end, quota |
| `model/topup.go` | `topups` — user, amount, status, payment_method |
| `model/redemption.go` | `redemption_codes` — code, quota, used_count |
| `model/passkey.go` | `passkeys` — user_id, credential_id, public_key, sign_count |
| `model/option.go` | `options` — key/value system settings (SYNC in-memory on startup) |
| `model/pricing.go` | `pricings` — model, input_price, output_price (SYNC in-memory) |
| `model/ability.go` | `channel_ability` — cached model capabilities per channel |
| `model/channel_cache.go` | In-memory `map[int, *Channel]` with periodic Redis sync |

---

## 3. Request Flow & Middleware Chain

### 3.1 Gin Engine Initialization (`main.go`)

```
main()
  |
  +-- InitResources()         # Load .env, init DB, Redis, logger, i18n, OAuth
  |
  +-- gin.New()
  |     |
  |     +-- gin.CustomRecovery()         # Panic → 500 + structured JSON error
  |     +-- middleware.RequestId()        # X-Request-Id header injection
  |     +-- middleware.PoweredBy()        # X-Powered-By header
  |     +-- middleware.I18n()             # i18n context (user language)
  |     +-- middleware.SetUpLogger()       # request/s response logging
  |     +-- cookie.NewStore()             # session store (30-day, HttpOnly, SameSite=Strict)
  |     +-- sessions.Sessions("session")   # cookie-based sessions
  |     +-- InjectUmamiAnalytics()         # Replace <!--umami--> placeholder
  |     +-- InjectGoogleAnalytics()        # Replace <!--Google Analytics--> placeholder
  |     +-- router.SetRouter(server, assets)  # Wire all route groups
  |
  +-- server.Run(":" + PORT)
```

### 3.2 Global Middleware Stack

Middleware applied at engine level (all routes):

| Middleware | Purpose |
|-----------|---------|
| `RequestId()` | Generate UUID request ID, inject into `c.GetString(common.RequestIdKey)`, set response header |
| `PoweredBy()` | Set `X-Powered-By: Atius` header |
| `I18n()` | Detect user language from cookie/header/Accept-Language, set i18n context |
| `SetUpLogger()` | Log all requests (method, path, status, latency, client IP) |
| `sessions.Sessions("session")` | Cookie-based session deserialization (max age 30 days) |

### 3.3 Route-Group Middleware

**API Router** (`/api/*`):
```
RouteTag("api")
  +-- gzip.Gzip(DefaultCompression)
  +-- BodyStorageCleanup()          # Clean up temp request body files
  +-- GlobalAPIRateLimit()          # Global rate limit (token bucket)
```

**Relay Router** (`/v1/*`, `/v1beta/*`):
```
RouteTag("relay")
  +-- CORS()
  +-- DecompressRequestMiddleware()   # Auto-decompress gzip/br request bodies
  +-- BodyStorageCleanup()
  +-- StatsMiddleware()              # Track request counts and latencies
  +-- SystemPerformanceCheck()       # Reject if system overloaded
  +-- TokenAuth()                    # Bearer token validation
  +-- ModelRequestRateLimit()        # Per-model rate limit
  +-- Distribute()                   # Master-node task distribution
```

**Web Router** (`/*`):
```
gzip.Gzip(DefaultCompression)
  +-- GlobalWebRateLimit()
  +-- Cache()                        # Static asset caching
  +-- static.Serve("/", themeFS)     # Embedded SPA
```

### 3.4 Middleware Chain for a Typical Request

Example: `POST /v1/chat/completions` with Bearer token:

```
1. Engine-level: PanicRecovery → RequestId → PoweredBy → I18n → Logger → Sessions
2. Route-group: CORS → Decompress → BodyStorageCleanup → StatsMiddleware → SystemPerfCheck
3. Route-level: TokenAuth()
                  |
                  +-- Extract "Bearer sk-xxxx" from Authorization header
                  +-- Strip "sk-" prefix, split by "-" → [key, channelId?] 
                  +-- model.ValidateUserToken(key) → Token record
                  +-- IP allowlist check (if token has restrictions)
                  +-- model.GetUserCache(token.UserId) → user status check
                  +-- SetupContextForToken(c, token, parts...)
                       → c.Set("id", userId)
                       → c.Set("token_id", token.Id)
                       → c.Set("token_key", token.Key)
                       → c.Set("token_quota", token.RemainQuota)
                       → c.Set("token_model_limit", token.GetModelLimitsMap())
4. Controller: Relay(c, RelayFormatOpenAI)
5. Service: billing, channel selection, token counting
6. Model: DB queries, Redis, in-memory cache
7. Response: streamed SSE or JSON back up the chain
```

---

## 4. Authentication & Session Management

### 4.1 Authentication Methods

| Method | Handler | Auth Context |
|--------|---------|-------------|
| Password login | `controller/user.go:Login()` | Session (`session.Set("id", user.Id)`) |
| OAuth (GitHub, Discord, OIDC, LinuxDO) | `controller/HandleOAuth()` → `model.OAuthUserRegisterOrLogin()` | Session |
| WeChat | `controller/WeChatAuth()` | Session |
| Telegram | `controller/TelegramLogin()` | Session |
| Custom OAuth | `controller/HandleOAuth()` with dynamic provider | Session |
| Passkey/WebAuthn | `controller/PasskeyLoginBegin/Finish()` | Session |
| 2FA (TOTP) | `controller/Verify2FALogin()` | Session (pending state) |
| API Token (Bearer) | `middleware/auth.go:TokenAuth()` | `c.Set("id", userId)`, `c.Set("token_id", ...)` |
| Read-only Token | `middleware/auth.go:TokenAuthReadOnly()` | Same but no quota/status check |

### 4.2 Session Management

Sessions are stored in a **signed, encrypted cookie** (`gin-contrib/sessions/cookie`):

```go
store := cookie.NewStore([]byte(common.SessionSecret))
store.Options(sessions.Options{
    Path:     "/",
    MaxAge:   2592000,         // 30 days
    HttpOnly: true,            // Not accessible from JavaScript
    Secure:   true,            // HTTPS only (Set-Cookie: Secure)
    SameSite: http.SameSiteStrictMode,
})
server.Use(sessions.Sessions("session", store))
```

Session data stored in the cookie (signed with `SessionSecret`):
- `username` — string
- `role` — int (1=common, 10=admin, 100=root)
- `id` — int (user ID)
- `status` — int (1=enabled, 2=disabled)
- `group` — string

### 4.3 authHelper — Core Session Auth Logic

Located in `middleware/auth.go`, `authHelper(c, minRole)` handles session auth for dashboard routes:

```
1. sessions.Default(c) → read session cookie
2. If session["username"] is nil:
     a. Check Authorization: Bearer <access-token>
     b. model.ValidateAccessToken(accessToken) → user record
     c. If valid: extract username, role, id, status
3. Validate "New-Api-User" header matches session user ID (CSRF protection)
4. Check user status != disabled
5. Check role >= minRole
6. Set c.Set("username", "role", "id", "group", "use_access_token")
7. c.Next()
```

### 4.4 TokenAuth — API Key Auth Logic

For relay routes (`/v1/*`), authentication uses Bearer API tokens:

```
1. Extract "Bearer sk-xxxx" from Authorization header
2. Strip "sk-" prefix → "xxxx"
3. Split by "-" → parts[0]=key, parts[1]=optional_channel_id (admin only)
4. model.ValidateUserToken(key) → Token record (validates key, status, expiry)
5. IP allowlist check: net.ParseIP(clientIP) vs token.GetIpLimits()
6. model.GetUserCache(token.UserId) → check user not banned
7. SetupContextForToken(c, token, parts...)
   → c.Set("id", token.UserId)
   → c.Set("token_id", token.Id)
   → c.Set("token_key", token.Key)
   → c.Set("token_quota", token.RemainQuota)    [if !UnlimitedQuota]
   → c.Set("token_model_limit_enabled", ...)
   → c.Set("token_model_limit", ...)            [if enabled]
8. c.Next()
```

### 4.5 Role System

Roles are integer constants (higher = more privileged):

| Role | Constant | Value | Access |
|------|----------|-------|--------|
| Disabled | `UserStatusDisabled` | 2 | Blocked |
| Common User | `RoleCommonUser` | 1 | Own quota, tokens, usage |
| Admin | `RoleAdminUser` | 10 | Channels, tokens, users, logs |
| Root | `RoleRootUser` | 100 | All settings, root-only options |

---

## 5. API Relay Architecture

### 5.1 Relay Format System

Every relay request carries a `types.RelayFormat` value that determines:
1. Which handler to use
2. How to parse and convert the request
3. Which upstream channel adaptor to use

```go
type RelayFormat int
const (
    RelayFormatOpenAI             RelayFormat = 1   // /v1/chat/completions
    RelayFormatClaude             RelayFormat = 2   // /v1/messages (Anthropic)
    RelayFormatOpenAIResponses    RelayFormat = 3   // /v1/responses
    RelayFormatOpenAIImage        RelayFormat = 4   // /v1/images/generations
    RelayFormatEmbedding          RelayFormat = 5   // /v1/embeddings
    RelayFormatOpenAIAudio        RelayFormat = 6   // /v1/audio/*
    RelayFormatRerank             RelayFormat = 7   // /v1/rerank
    RelayFormatGemini             RelayFormat = 8   // /v1beta/models/*
    RelayFormatOpenAIRealtime     RelayFormat = 9   // WebSocket /v1/realtime
    RelayFormatMidjourney         RelayFormat = 10  // /mj/*
    RelayFormatSuno               RelayFormat = 11  // /suno/*
    RelayFormatOpenAIResponsesCompaction RelayFormat = 12
)
```

### 5.2 Relay Route Registration (`router/relay-router.go`)

```
POST /v1/chat/completions
  → middleware: RouteTag("relay"), SystemPerformanceCheck, TokenAuth, ModelRequestRateLimit, Distribute
  → controller: Relay(c, RelayFormatOpenAI)

POST /v1/messages
  → middleware: same
  → controller: Relay(c, RelayFormatClaude)

POST /v1/responses
  → middleware: same
  → controller: Relay(c, RelayFormatOpenAIResponses)

POST /v1/images/generations
  → controller: Relay(c, RelayFormatOpenAIImage)

POST /v1/embeddings
  → controller: Relay(c, RelayFormatEmbedding)

POST /v1/audio/transcriptions
  → controller: Relay(c, RelayFormatOpenAIAudio)

POST /v1/rerank
  → controller: Relay(c, RelayFormatRerank)

GET /v1/realtime
  → middleware: + Distribute (WebSocket upgrade)
  → controller: Relay(c, RelayFormatOpenAIRealtime)

/mj/* (Midjourney proxy)
  → middleware: TokenAuth, Distribute
  → controller: RelayMidjourney / relay.RelayMidjourneyImage

/suno/* (Suno)
  → middleware: TokenAuth, Distribute
  → controller: RelayTask / RelayTaskFetch

/v1beta/models/* (Gemini)
  → middleware: TokenAuth, ModelRequestRateLimit, Distribute
  → controller: Relay(c, RelayFormatGemini)
```

### 5.3 Relay Handler Flow (`controller/relay.go`)

```
Relay(c, relayFormat)
  │
  +-- Get request ID from context (middleware.RequestId)
  │
  +-- WebSocket upgrade (if RelayFormatOpenAIRealtime)
  │
  +-- defer: error handler — maps *types.NewAPIError → provider-specific error format
  │
  +-- helper.GetAndValidateRequest(c, relayFormat)
  │     → Parse JSON/body into typed request struct based on relayFormat
  │     → Validate required fields, model name
  │
  +-- relaycommon.GenRelayInfo(c, relayFormat, request, ws)
  │     → Build RelayInfo struct: model, channel, user, token, group, format
  │
  +-- Sensitive check (if enabled)
  │     → service.CheckSensitiveText(combineAllMessages)
  │     → Reject if contains prohibited keywords
  │
  +-- service.EstimateRequestToken(c, meta, relayInfo)
  │     → Count tokens in request messages
  │
  +-- helper.ModelPriceHelper(c, relayInfo, tokens, meta)
  │     → Lookup pricing for model → pre-consume quota reservation
  │
  +-- service.PreConsumeBilling(c, preConsumedQuota, relayInfo)
  │     → NewBillingSession → quota hold on user account
  │
  +-- relayHandler(c, relayInfo)
  │     │
  │     +-- relay.ImageHelper()        [image generation]
  │     +-- relay.AudioHelper()         [audio]
  │     +-- relay.RerankHelper()         [rerank]
  │     +-- relay.EmbeddingHelper()     [embeddings]
  │     +-- relay.ResponsesHelper()     [OpenAI responses API]
  │     +-- relay.TextHelper()          [default: chat completions]
  │           │
  │           +-- relaycommon.GetTextRelayInfo()
  │           │     → Identify best channel (group priority, weight, balance)
  │           │
  │           +-- relay.GetAdaptor(channel.Type)
  │           │     → Returns channel-specific Adaptor (openai, claude, gemini, etc.)
  │           │
  │           +-- adaptor.ConvertRequest(req)
  │           │     → Transform OpenAI-format request → provider-specific format
  │           │
  │           +-- DoRelay(c, adaptor, relayInfo)
  │           │     → HTTP POST to upstream base_url + endpoint
  │           │     → Stream or blocking response
  │           │     → Convert response back to OpenAI format
  │           │
  │           +-- Update channel balance (if provider returns it)
  │
  +-- relaycommon.DoBillingSettlement()
  │     → Compare pre-consumed vs actual → top-up or refund
  │
  +-- Log usage record
```

### 5.4 Channel Adaptor System (`relay/channel/*/`)

Each provider has a dedicated adaptor implementing `channel.Adaptor`:

```go
type Adaptor interface {
    ConvertRequest(c *gin.Context, req interface{}) (interface{}, error)
    DoRelay(c *gin.Context, req interface{}, relayInfo *relaycommon.RelayInfo) (interface{}, *types.NewAPIError)
    GetApiType() int
}
```

Providers supported (via `relay/relay_adaptor.go:GetAdaptor()`):

| Constant | Provider | Package |
|----------|----------|---------|
| `APITypeOpenAI` | OpenAI / compatible | `relay/channel/openai` |
| `APITypeAnthropic` | Anthropic Claude | `relay/channel/claude` |
| `APITypeGemini` | Google Gemini | `relay/channel/gemini` |
| `APITypeAzure` | Microsoft Azure OpenAI | `relay/channel/azure` |
| `APITypeAWS` | AWS Bedrock | `relay/channel/aws` |
| `APITypeBaidu` | Baidu Qianfan | `relay/channel/baidu` |
| `APITypeAli` | Alibaba Tongyi | `relay/channel/ali` |
| `APITypeZhipu` | Zhipu ChatGLM | `relay/channel/zhipu` |
| `APITypeMoonshot` | Moonshot Kimi | `relay/channel/moonshot` |
| `APITypeDeepseek` | DeepSeek | `relay/channel/deepseek` |
| `APITypeMistral` | Mistral AI | `relay/channel/mistral` |
| `APITypeMinimax` | MiniMax | `relay/channel/minimax` |
| `APITypeVolcengine` | Volcano Engine | `relay/channel/volcengine` |
| `APITypeTencent` | Tencent Hunyuan | `relay/channel/tencent` |
| `APITypeOllama` | Ollama (local) | `relay/channel/ollama` |
| `APITypeCoze` | Coze | `relay/channel/coze` |
| `APITypeDify` | Dify | `relay/channel/dify` |
| `APITypeReplicate` | Replicate | `relay/channel/replicate` |
| `APITypePerplexity` | Perplexity | `relay/channel/perplexity` |
| `APITypeXAI` | xAI Grok | `relay/channel/xai` |
| `APITypeSiliconFlow` | SiliconFlow | `relay/channel/siliconflow` |
| `APITypeCloudflare` | Cloudflare Workers AI | `relay/channel/cloudflare` |
| `APITypeVertex` | Google Vertex AI | `relay/channel/vertex` |
| `APITypeCodex` | OpenAI Codex | `relay/channel/codex` |
| `APITypeCohere` | Cohere | `relay/channel/cohere` |
| `APITypeJina` | Jina AI | `relay/channel/jina` |
| `APITypePalm` | Google PaLM | `relay/channel/palm` |
| `APITypeMokaAI` | MokaAI | `relay/channel/mokaai` |
| `APITypeXunfei` | iFlytek Spark | `relay/channel/xunfei` |
| `APITypeSubmodel` | Submodel aggregator | `relay/channel/submodel` |
| `APITypeZhipu4V` | Zhipu 4V | `relay/channel/zhipu_4v` |
| `APITypeJimeng` | Jimeng (Jingyan) | `relay/channel/jimeng` |

Task platforms (`relay/channel/task/*/`): Suno, Kling, Sora, Hailuo, Doubao, VidU, Gemini Video, Jimeng, Ali VI, Vertex Video

### 5.5 Channel Selection Logic

Channel selection (in `service/channel.go` + `model/channel_satisfy.go`):

1. **Group filtering** — filter channels by `token.group` or user group
2. **Model filtering** — channel must list the requested model in its `models` JSON array
3. **Status check** — channel `status == 1` (enabled), not auto-banned
4. **Balance check** — channel `balance > 0` (or unlimited)
5. **Priority sorting** — higher `priority` wins; `weight` used for load distribution
6. **Response time weighting** — faster channels get higher effective weight
7. **Affinity** — if `channel_affinity` cache has a good channel for this user+model, prefer it
8. **Fallback chain** — try channels in priority order until one succeeds; on failure, retry with next

---

## 6. Data Flow Diagrams

### 6.1 User Login Flow

```
Browser                    Gin Server                   Model/Service
  |                              |                            |
  |-- POST /api/user/login ----->|                            |
  |   {username, password}       |                            |
  |                              |-- model.UserLogin() ------->|
  |                              |    WHERE username=?        |
  |                              |<--- User record (hash) ----|
  |                              |-- common.Password2Hash()  |
  |                              |    compare with stored     |
  |                              |                            |
  |                              |-- session.Set("id", u.Id)  |
  |                              |-- session.Set("role", u.Role)
  |                              |-- session.Set("username")  |
  |                              |-- session.Set("status")    |
  |                              |-- session.Save()           |
  |<-- 200 {success, user} ------|                            |
```

### 6.2 API Relay Flow (Chat Completions)

```
Client                     Gin (+ Middleware)           Controller         Service              Relay
  |                              |                          |                  |                   |
  |-- Bearer sk-xxxx ----------->|                          |                  |                   |
  |   POST /v1/chat/completions  | TokenAuth()               |                  |                   |
  |                              |-- ValidateToken() ------->|                  |                   |
  |                              |<-- Token + UserCache -----|                  |                   |
  |                              |-- SetupContextForToken()  |                  |                   |
  |                              |                          |-- Relay(c, OpenAI)                   |
  |                              |                          |-- helper.GetAndValidateRequest()    |
  |                              |                          |-- GenRelayInfo()      |              |
  |                              |                          |-- CheckSensitive()    |              |
  |                              |                          |-- EstimateToken()     |              |
  |                              |                          |-- ModelPriceHelper()  |              |
  |                              |                          |-- PreConsumeBilling() |              |
  |                              |                          |-- relayHandler() -------------------->|
  |                              |                          |                  |-- GetAdaptor() |
  |                              |                          |                  |-- ConvertRequest|
  |                              |                          |                  |-- DoRelay()     |
  |                              |                          |                  |-- StreamResp ---|
  |                              |<-- SSE stream ---------------------------------------|----------|
  |<-- data: {...} --------------|                          |                  |                   |
  |<-- data: {...} --------------|                          |                  |                   |
  |<-- [DONE] --------------------|                          |                  |                   |
  |                              |                          |-- SettleBilling() --|              |
  |                              |                          |-- LogUsage() ------>|              |
```

### 6.3 Global Request Flow

```
Inbound Request
      │
      ▼
┌─────────────────────────────────────────────┐
│  gin.CustomRecovery()                       │  Panic → 500 JSON
│  middleware.RequestId()                      │  X-Request-Id
│  middleware.PoweredBy()                      │  X-Powered-By
│  middleware.I18n()                           │  Language context
│  middleware.SetUpLogger()                    │  Request logging
│  sessions.Sessions("session")                │  Cookie → session
└──────────────────┬──────────────────────────┘
                   │
          ┌────────▼────────┐
          │  Route Matching │
          └────────┬────────┘
                   │
    ┌───────────────┼───────────────┬────────────────┐
    │               │               │                │
    ▼               ▼               ▼                ▼
 /api/*        /v1/*          /mj/*, /suno/*    /* (web)
    │               │               │                │
    ▼               ▼               ▼                ▼
 gzip          gzip             gzip             gzip
 GlobalAPI    CORS             TokenAuth        GlobalWeb
   RL         Decompress       SystemPerf      RateLimit
              Stats            ModelRL          Cache
              TokenAuth        Distribute       Static
              GlobalAPI RL                     Serve
                   │               │
                   ▼               ▼
           controller.       controller.
             Relay()          RelayMidjourney()
                   │               │
                   ▼               ▼
           service.*          relay.*
           relay.*            mjproxy_*
                   │               │
                   ▼               ▼
           upstream provider   upstream provider
           (OpenAI, Claude,    (Midjourney Discord,
            Gemini, etc.)       Suno API, etc.)
```

---

## 7. Directory Structure Reference

```
/home/ubuntu/docker/Atius/router-ai-atius/
├── main.go                          # Entry point, Gin setup, middleware wiring
├── router/
│   ├── main.go                      # SetRouter() — wires all sub-routers
│   ├── api-router.go                 # /api/* — public + authenticated REST API
│   ├── relay-router.go               # /v1/*, /v1beta/*, /mj/*, /suno/* — AI relay
│   ├── dashboard.go                  # /dashboard/*, /v1/dashboard/* — billing compat
│   ├── web-router.go                 # /* — SPA frontend (embed.FS)
│   └── video-router.go               # /kling/v1/*, /jimeng/* — video task routes
├── controller/                       # ~50 files — request handlers
│   ├── relay.go                      # Main relay entry point
│   ├── user.go                       # Login, register, self-update, 2FA
│   ├── channel.go                    # Channel CRUD, test, balance
│   ├── token.go                      # Token CRUD, key retrieval
│   ├── passkey.go                    # WebAuthn begin/finish
│   ├── subscription.go               # Subscription plans + management
│   ├── task.go                       # Async task polling
│   ├── task_video.go                 # Video task handling
│   ├── midjourney.go                 # Midjourney-specific endpoints
│   └── ... (40+ more)
├── service/                          # Business logic
│   ├── billing.go                    # Pre-consume + settlement
│   ├── billing_session.go            # BillingSession state machine
│   ├── channel.go                    # Channel selection + affinity
│   ├── channel_affinity.go           # Per-user/model channel preference cache
│   ├── text_quota.go                 # Per-user text quota management
│   ├── pre_consume_quota.go          # Quota hold before upstream call
│   ├── token_counter.go              # Token counting for pricing
│   ├── token_estimator.go            # Fast estimation without full tokenize
│   ├── task_billing.go               # Async task billing
│   ├── http.go                       # Shared HTTP client (TLS, timeout, proxy)
│   ├── passkey/
│   │   ├── service.go                # Passkey registration/login service
│   │   ├── session.go                # Passkey session management
│   │   └── user.go                   # Passkey user helpers
│   └── openai_chat_responses_mode.go # OpenAI responses API mode
├── model/                            # Data access (GORM)
│   ├── main.go                       # DB init (SQLite/MySQL/PostgreSQL), createRootAccountIfNeed
│   ├── user.go                       # User model + login/logout/hashing
│   ├── token.go                      # Token model + CRUD + validation
│   ├── channel.go                    # Channel model + cache
│   ├── channel_cache.go              # In-memory channel cache + Redis sync
│   ├── subscription.go               # Subscription model
│   ├── topup.go                      # Top-up / payment records
│   ├── redemption.go                 # Redemption codes
│   ├── option.go                     # System options (key/value, in-memory map)
│   ├── pricing.go                    # Model pricing (in-memory map)
│   ├── passkey.go                    # Passkey credentials storage
│   ├── ability.go                    # Channel model ability cache
│   ├── log.go                        # Usage log (separate LOG_DB)
│   └── ...
├── middleware/
│   ├── auth.go                       # UserAuth, AdminAuth, RootAuth, TokenAuth, TokenOrUserAuth
│   ├── ratelimit.go                  # GlobalAPI/ModelRequest/WebRateLimit
│   ├── distribution.go               # Distribute() — master-node task routing
│   ├── i18n.go                       # Language detection + context
│   ├── body_storage.go               # Request body temp file storage + cleanup
│   ├── cors.go                       # CORS headers
│   ├── requestid.go                  # X-Request-Id injection
│   ├── performance.go                # SystemPerformanceCheck
│   └── logger.go                     # Request/response logging
├── relay/                            # AI API relay engine
│   ├── relay_adaptor.go              # GetAdaptor(apiType) factory
│   ├── relay.go                      # DoRelay(), stream handling
│   ├── common/
│   │   ├── relay_info.go             # RelayInfo struct — all relay metadata
│   │   ├── request_conversion.go     # OpenAI request → internal format
│   │   ├── billing.go                # Relay billing helpers
│   │   └── stream_status.go          # SSE stream delta tracking
│   ├── helper/
│   │   ├── valid_request.go          # GetAndValidateRequest()
│   │   ├── price.go                  # ModelPriceHelper()
│   │   └── stream_result.go          # Stream result parsing
│   ├── channel/                      # Provider-specific adaptors
│   │   ├── openai/adaptor.go         # OpenAI-compatible relay
│   │   ├── claude/adaptor.go         # Anthropic Claude relay
│   │   ├── gemini/adaptor.go         # Google Gemini relay
│   │   ├── aws/adaptor.go            # AWS Bedrock relay
│   │   ├── azure/adaptor.go          # Azure OpenAI relay
│   │   ├── deepseek/adaptor.go       # DeepSeek relay
│   │   ├── minimax/adaptor.go        # MiniMax relay
│   │   └── ... (30+ more providers)
│   └── channel/task/                 # Async task platforms
│       ├── suno/adaptor.go           # Suno music generation
│       ├── kling/adaptor.go          # Kling video
│       ├── sora/adaptor.go           # OpenAI Sora video
│       └── ...
├── oauth/                            # OAuth provider implementations
│   ├── github.go                     # GitHub OAuth
│   ├── discord.go                    # Discord OAuth
│   ├── oidc.go                       # Generic OIDC
│   ├── linuxdo.go                    # LinuxDO OAuth
│   └── custom.go                     # Operator-defined custom OAuth
├── common/                           # Shared utilities
│   ├── redis.go                      # Redis client init
│   ├── env.go                        # Environment variable loading
│   ├── password.go                   # Password hashing (bcrypt)
│   ├── json.go                       # JSON marshal/unmarshal wrappers
│   ├── crypto.go                     # AES/RSA utilities
│   └── ratelimit.go                  # Token bucket rate limiter
├── constant/                         # Constants
│   ├── context.go                    # Context keys (ContextKeyUsingGroup, etc.)
│   ├── channel.go                    # Channel type constants (APITypeOpenAI, etc.)
│   └── relay.go                     # Relay mode constants
├── types/                            # Type definitions
│   ├── error.go                      # NewAPIError struct
│   └── ...
├── dto/                              # Request/response DTOs
│   └── ...
├── setting/                           # Configuration subsystems
│   ├── model_setting/                 # Model name mapping
│   ├── ratio_setting/                 # Group pricing ratios
│   └── operation_setting/             # Operation flags
├── i18n/                              # Backend i18n (go-i18n, en/zh)
├── pkg/
│   ├── billingexpr/                   # Expression-based billing
│   └── perf_metrics/                 # Performance metrics
├── web/                               # Frontend themes
│   ├── default/                      # React 19, Rsbuild, Base UI, Tailwind CSS
│   │   └── dist/                     # Built assets (embedded via go:embed)
│   └── classic/                      # React 18, Vite, Semi Design
│       └── dist/
└── login-sso-implement/               # Auth implementation docs
    ├── 00-AUTHENTICATION-MANUAL.md
    └── 03-MIDDLEWARE-AUTH-REFERENCE.md
```

---

## 8. Database Schema Overview

The system uses **GORM v2** supporting three database backends simultaneously:

| Database | Driver | Notes |
|----------|--------|-------|
| SQLite | `glebarez/sqlite` | Default for development |
| MySQL | `gorm.io/driver/mysql` | Production use |
| PostgreSQL | `gorm.io/driver/postgres` | Production use |

Key tables:

```sql
users          -- id, username, password (bcrypt), email, role, status, group, created_at
tokens         -- id, user_id, key (hashed), name, remain_quota, model_limits (JSON), ip_allowlist (JSON), group
channels       -- id, type, key, base_url, balance, models (JSON), group, weight, priority, status, tag
subscriptions   -- id, user_id, plan_id, status, period_start, period_end, quota
topups         -- id, user_id, amount, status, payment_method, trade_no
redemption_codes -- id, code, quota, used_count, max_use
passkeys       -- id, user_id, credential_id, public_key, sign_count, created_at
oauth_bindings -- id, user_id, provider, provider_user_id, access_token
options        -- id, key, value (all system settings as key/value)
pricings       -- id, model, input_price, output_price (in-memory, not all DBs)
channel_ability -- id, channel_id, model, ability_json (cached capabilities)
logs           -- id, user_id, token_id, channel_id, model, input_tokens, output_tokens, quota (separate LOG_DB)
```

Database-agnostic patterns enforced:
- Use GORM methods only (no raw SQL unless unavoidable)
- Use `commonGroupCol` / `commonKeyCol` for reserved column names (`group`, `key`)
- Use `commonTrueVal` / `commonFalseVal` for booleans (PostgreSQL `true/false` vs MySQL/SQLite `1/0`)

---

## 9. Key Components Detail

### 9.1 In-Memory Channel Cache

```go
// model/channel_cache.go
model.InitChannelCache()        // Load all channels from DB into map[int]*Channel
go model.SyncChannelCache(60)   // Periodic sync: DB → in-memory map
go model.UpdateQuotaData()       // Periodic: recalculate used_quota totals

// model/channel.go
type Channel struct {
    Id       int
    Type     int              // constant.APITypeOpenAI, etc.
    Key      string           // encrypted upstream API key
    BaseURL  *string          // upstream base URL (optional override)
    Balance  float64          // USD balance
    Models   string           // JSON array of model names
    Group    string           // routing group
    Weight   *uint            // load balancing weight
    Priority *int64           // priority (higher = preferred)
    Status   int              // 1=enabled, 0=disabled
    Tag      *string          // optional tag for batch operations
}
```

### 9.2 Billing Session State Machine

```
Pre-consume (before upstream call):
  NewBillingSession(c, relayInfo, preConsumedQuota)
    → Check user has enough quota
    → Deduct from remain_quota (hold)
    → Store BillingSession in relayInfo.Billing

Post-consume (after upstream response):
  SettleBilling(c, relayInfo, actualQuota)
    → delta = actualQuota - preConsumed
    → delta > 0: TopUpConsumedQuota(user, delta)   [charge more]
    → delta < 0: RefundQuota(user, -delta)          [refund excess]
    → Log to usage record

On error (upstream failure):
  RefundBilling(c, relayInfo)
    → RefundQuota(user, preConsumed)
```

### 9.3 Request Body Storage

Large request bodies are buffered to temp files to avoid memory pressure:

```
middleware/body_storage.go:
  BodyStorageMiddleware()
    → If Content-Length > 32KB or chunked:
         → Read body into temp file (os.CreateTemp)
         → Replace c.Request.Body with this file
  BodyStorageCleanup()
    → After handler completes:
         → Delete temp file
         → Close file handle
```

### 9.4 System Performance Check

```go
// middleware/performance.go
SystemPerformanceCheck()
  → Check CPU, memory, goroutine count
  → If overload: abort with 503 Service Unavailable
  → Protects the relay from cascading failures
```

### 9.5 Distribute Middleware (Master/Worker)

When running in **master node** mode (`common.IsMasterNode = true`), task requests are distributed to worker nodes:

```go
Distribute()
  → If IsMasterNode:
       → Select a healthy worker node
       → Forward request via HTTP to worker
       → Stream back worker's response
  → Else (worker node):
       → c.Next() — handle locally
```

### 9.6 Startup Initialization Sequence (`main.go:InitResources()`)

```
1. godotenv.Load(".env")                    # Load .env file
2. common.InitEnv()                          # Parse env vars into common.* globals
3. logger.SetupLogger()                      # Configure logger (log/slog)
4. ratio_setting.InitRatioSettings()         # Load pricing ratios
5. service.InitHttpClient()                  # Set up shared HTTP client (timeouts, TLS)
6. service.InitTokenEncoders()               # Token encoding helpers
7. model.InitDB()                            # Connect main DB, run migrations
8. model.CheckSetup()                        # Check if first-run setup needed
9. model.InitOptionMap()                     # Load options into memory map
10. common.CleanupOldCacheFiles()            # Remove stale temp files
11. model.GetPricing()                       # Load pricing into memory
12. model.InitLogDB()                       # Connect separate log DB
13. common.InitRedisClient()                 # Connect Redis (if enabled)
14. perfmetrics.Init()                       # Performance metrics init
15. common.StartSystemMonitor()              # Goroutine: monitor CPU/mem
16. i18n.Init()                              # Load i18n translations
17. oauth.LoadCustomProviders()              # Load custom OAuth from DB
```

---

## Appendix: Environment Variables Reference

| Variable | Purpose | Default |
|----------|---------|---------|
| `PORT` | HTTP server port | `*common.Port` (from setting) |
| `GIN_MODE` | `debug` or `release` | `release` |
| `SESSION_SECRET` | Cookie signing key | (required) |
| `SESSION_MAX_AGE` | Session TTL in seconds | `2592000` (30 days) |
| `REDIS_ENABLED` | Enable Redis caching | `false` |
| `MEMORY_CACHE_ENABLED` | Enable in-memory channel cache | `false` |
| `CHANNEL_UPDATE_FREQUENCY` | Channel balance sync interval (seconds) | (none) |
| `BATCH_UPDATE_ENABLED` | Enable batch update goroutine | `false` |
| `BATCH_UPDATE_INTERVAL` | Batch update interval (seconds) | (default in common) |
| `ENABLE_PPROF` | Enable pprof profiling server | `false` |
| `FRONTEND_BASE_URL` | Proxy web UI to external URL | (serve locally) |
| `UMAMI_WEBSITE_ID` | Umami analytics site ID | (disabled) |
| `GOOGLE_ANALYTICS_ID` | GA4 measurement ID | (disabled) |
| `LOG_SQL_DSN` | Separate log database DSN | (same as main DB) |
| `MASTER_NODE_KEY` | Master/worker cluster auth | (single-node mode) |

---

*Document maintained in: `/home/ubuntu/GitHub/atius/.planning/codebase/ARCHITECTURE.md`*
