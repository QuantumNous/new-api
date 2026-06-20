# CLAUDE.md — Codebase map for Claude (deeprouter gateway)

This file orients Claude before edits. Read top-to-bottom before working in this repo.

**Sister files**:
- `AGENTS.md` — coding rules (JSON wrapper, cross-DB, branding lock, billing expression, pointer omitempty, **Rule 10 changelog-every-change, Rule 11 PRD-first-per-task**). Treat those rules as mandatory; this file does not repeat them.
- `CHANGELOG.md` — every meaningful change gets an entry (AGENTS.md Rule 10).
- `ARCHITECTURE.md` — upstream-derived module tour (`router/` → `controller/` → `service/` → `model/`).
- `AIRBOTIX.md` — what the fork customises vs upstream + upstream-sync workflow.
- `DEV.md` — 5-minute local quickstart.
- `PLAN.md` — phase plan to V0 launch.
- `docs/PRD.md` — engineering PRD.
- `docs/BUSINESS-LOGIC.md` — consolidated business/commercial logic + open decisions (read for any customer-facing or pricing/billing work).
- `docs/DeepRouter-BP.md` — 融资商业计划书 (investor-facing; revenue/pricing/margins/financials). Imported from `jr-academy-ai/deeprouter-brand/`.
- `docs/DeepRouter-PRD-brand.md` — brand/product PRD (companion to the BP).
- `docs/DESIGN.md` — **canonical visual design system. MANDATORY for any UI/visual change** (AGENTS.md Rule 9). §0–5 is canonical; §6–9 is "Historical Inspiration" and contradicts it (defer to §0–5). The `design-system` skill condenses it and auto-loads on UI work.
- `docs/system-settings-guide.md` — operator-facing Chinese guide to every admin System Settings section (what each does, DeepRouter-recommended values, which fields need operator-supplied secrets).
- `../CLAUDE.md` — umbrella file covering the AGPL/Apache process boundary between this repo and `../smart-router/`.

**Operator config tooling** (`scripts/seed-models/`): `seed.py` upserts all upstream channels + model lists from `channels.yaml`; `seed_options.py` pushes a curated set of safe system-settings defaults. Both are idempotent, talk to the admin API (`Authorization: Bearer <access-token>` **plus** a `New-Api-User: <user-id>` header — admin endpoints require both), and read config from a gitignored `.env`. See `scripts/seed-models/README.md`.

## 0. Who you are building for — READ BEFORE ANY CUSTOMER-FACING CHANGE

If your change touches `web/default/src/features/keys/`, the console, onboarding,
pricing, the Setup guide, or anything an end user sees: re-read
`docs/BUSINESS-LOGIC.md` (the consolidated source of truth — start here, esp.
its §0 "DECISIONS NEEDED"), then `docs/onboarding-v2-prd.md` (§3 personas,
§7.5 调用密钥页, §7.6 自检), `docs/tasks/casual-ux-prd.md`,
`docs/tasks/api-key-simple-advanced-prd.md`, and
`docs/tasks/casual-journey-readiness-prd.md` (the register→use→success
execution/gap-closure plan — AS-IS audit + prioritized P0/P1 backlog +
decision-gated items) FIRST. Those PRDs are the law; this section is just the anchor that keeps every
change pointed at the same user. Most customer-facing mistakes in this repo come
from drifting back into "developer using a gateway" thinking — which is exactly
the persona DeepRouter is NOT built for.

**The end user is NOT a developer.** Paying users are lawyers, doctors,
designers, teachers, students, content creators (PRD §3). They buy an API key
and leave to paste it into an AI tool they already use (Cherry Studio, opencode,
Cursor, …). They will not write code, read SDK docs, or debug a Base URL. They
are not cold-start — they already know what they want AI for.

**DeepRouter is a utility (account + wallet), not a destination (chat /
assistant).** "不做 chat 是红线" (onboarding-v2-prd.md §2 insight #1).

**Golden path = 2 minutes, zero support:** 注册 → 充值 → 拿密钥 → 确认能用.
On the key page the real final step is the **self-check (自检)** that proves
"我的钱变成了 AI 算力" (§7.6) — NOT a code snippet.

Hard rules for customer-facing surfaces (default = casual mode):

1. **Jargon ban (PRD §7.4).** Do NOT surface to a casual user: `API`, `token`,
   `Base URL`, `模型路由`, `网关`, `SDK`, or third-party client brand names.
   These live behind an explicit **Developer mode** toggle only.
2. **"How do I use my key?" = "粘贴到你正在用的 AI 工具的设置里，找带 API Key 的
   输入框，粘进去保存"** → then run the self-check. cURL / Python / Node snippets
   are a Developer-mode extra, never the default answer.
3. **Every value shown to a user MUST actually work — verify it against a live
   gateway call before shipping.** Anti-example caught 2026-06-08: the Setup
   guide shipped model name `deeprouter` (gateway returns **503** — only
   `deeprouter-auto` routes today) and Base URL `:17231/v1` (frontend dev port,
   `/v1` not proxied; the real gateway is `:3300`). Both fixed 2026-06-11
   (`modelNameForPurpose()` → always `deeprouter-auto`; dev proxy now covers
   `/v1`) — but the rule stands: re-verify before every change. A guide that
   shows broken values is worse than no guide.
4. **Plain language, English term in parentheses once** ("调用密钥(API Key)"),
   not English-first.

When unsure on a customer surface, optimize for the non-technical user who
pastes-and-goes; push everything else behind Developer mode.

## 1. What this codebase is

OpenAI-compatible multi-tenant LLM gateway, **fork of `QuantumNous/new-api`** (AGPL v3). Routes incoming requests to one of **37 upstream providers** (`relay/channel/`) via an admin-managed pool of API keys with priority/weight selection, per-key health, and retry. Embedded React admin UI under `web/default/`.

This fork adds 4 Airbotix-specific things on top of upstream:

| Lives in | What it adds |
|---|---|
| `internal/policy/` | Per-tenant policy decision engine (kids_mode / passthrough / adult). Pure function. |
| `internal/kids/` | Hard constraints for kids_mode (model whitelist, metadata stripping, OpenAI ZDR, child-safe system prompt). |
| `internal/smart_router_client/` | HTTP client that calls the `smart-router` sidecar for `deeprouter-auto` virtual-model routing. |
| `internal/billing/` | HMAC-signed per-request billing webhook dispatcher. Implemented, tested, and **wired into the relay completion path** (DR-25 / Phase 2). Fires for every successful, metered relay request by a tenant with `BillingWebhookURL` configured. |
| `relay/airbotix_policy.go` | The one upstream-adjacent file — stitches policy + kids enforcement into the relay request lifecycle for OpenAI / Claude / Gemini / Responses request shapes. |
| `model/user.go` | Extended with 5 columns: `kids_mode`, `policy_profile`, `billing_webhook_url`, `custom_pricing_id`, `webhook_secret`. |
| `middleware/smart_router.go` | Detects `deeprouter-auto`, calls smart_router_client, rewrites the model name before relay. |

Each `internal/` subpackage has its own README — read it before editing.

## 2. Key facts (things that bite if you get them wrong)

- **`channels.key` is stored plaintext in Postgres.** No symmetric encryption in this codebase — grep `AES`, `cipher`, `EncryptKey` returns nothing. API keys to upstream providers (OpenAI/Anthropic/Bedrock/…) round-trip plaintext.
- **`CRYPTO_SECRET` does NOT encrypt channel keys.** It's only used for HMAC of user access tokens to form Redis cache keys (`model/token_cache.go`, `service/file_service.go`). Treat it as an HMAC secret, not a master key.
- **Reading `channel.key` plaintext via API requires `RootAuth()` + `SecureVerificationRequired()`** (`router/api-router.go:230` — `POST /api/channel/:id/key`). Regular admins see masked values only. Adding/updating channels works with `AdminAuth()`.
- **AWS Bedrock channel does NOT support IAM role / instance profile.** `relay/channel/aws/` only implements `ApiKey` (`key|region` bearer) and `AKSK` (`ak|sk|region` static). Don't promise users that EC2 IAM role works for Bedrock — file a feature request instead.
- **Provider count is 37**, not "40+". Subdirectories under `relay/channel/`.
- **`internal/billing/` is wired into the relay completion path (DR-25).** `service/airbotix_billing.go` orchestrates dispatch from `PostTextConsumeQuota`. Webhooks fire for every successful, metered request by tenants with `BillingWebhookURL` set.
- **Channel selection (`model/channel_cache.go:GetRandomSatisfiedChannel`)**: priority-tier stratification → weight-based random within tier. On retry N, jump to Nth priority tier. Health/retry orchestration is at the controller layer, not in this function.

## 3. Where things live

```
deeprouter/
├── main.go                       — Go entry; ParseConfig + StartServer
├── router/                       — Gin route registration (api-router.go = admin API, relay-router.go = /v1/* upstream relay)
├── controller/                   — Gin handlers (auth, channel CRUD, billing pages, relay dispatch)
├── service/                      — Business logic (quota, log aggregation, push notifications)
├── model/                        — GORM models + DB access (user, channel, token, ability, log, …)
│   └── channel_cache.go          — Layer-2 channel routing: GetRandomSatisfiedChannel
├── relay/                        — Upstream LLM relay layer; see relay/README.md
│   ├── airbotix_policy.go        — fork-specific: applies policy + kids enforcement per request shape
│   ├── chat_completions_via_responses.go, claude_handler.go, ... — top-level dispatchers
│   └── channel/                  — 37 provider adapters; see relay/channel/README.md
├── middleware/                   — Auth, rate-limit, distributor, CORS, log, smart_router (Airbotix)
├── internal/                     — Airbotix-private packages (clean-keep zone for upstream rebase)
│   ├── billing/                  — HMAC webhook dispatcher (wired via service/airbotix_billing.go, DR-25)
│   ├── kids/                     — kids_mode constraint helpers
│   ├── policy/                   — DecisionFor(kidsMode, profile) → Decision
│   └── smart_router_client/      — HTTP client for ../smart-router
├── setting/                      — Runtime config (ratio, model, operation, system, performance)
├── common/                       — JSON wrapper, crypto helpers, env, redis, rate-limit, …
├── dto/                          — Request/response structs (upstream + airbotix)
├── constant/                     — Channel types, API types, context keys
├── types/                        — Relay formats, errors, file sources
├── i18n/                         — Backend i18n (go-i18n, en/zh)
├── oauth/                        — OAuth providers (GitHub, Discord, OIDC, WeCom, …)
├── pkg/                          — Internal libs (cachex, ionet, billingexpr)
└── web/                          — Embedded frontends
    ├── default/                  — React 19 + Rsbuild + Base UI + Tailwind (production)
    └── classic/                  — React 18 + Vite + Semi Design (legacy)
```

## 4. Working flows (where to start when…)

**Adding a new upstream provider** → see `relay/channel/README.md`. Procedure: create `relay/channel/<name>/`, implement `channel.Adaptor`, register in `relay/relay_adaptor.go`, declare channel type in `constant/channel.go`. Check whether the provider supports `StreamOptions.include_usage`; if yes, add to `streamSupportedChannels` (AGENTS.md Rule 4).

**Adding a new tenant-level field** (similar to `kids_mode`):
1. Add column on `model/user.go` (GORM tag; let GORM migrate)
2. Add admin UI field under `web/default/src/pages/User/`
3. Update `controller/user.go` PUT/PATCH handlers to accept the field
4. Update `dto/user.go` if request DTO is separate from `model.User`
5. Use the field in `internal/policy/` (Decision) or `middleware/` as appropriate

**Adding kids_mode-style enforcement to a new request shape**:
- Decide which `relay/*_handler.go` (or `relay/channel/<provider>/adaptor.go`'s convert function) receives that shape
- Extend `relay/airbotix_policy.go` with a new `Apply<Shape>` variant
- Add test in `relay/airbotix_policy_test.go`

**`internal/billing/` relay wiring** (DR-25 / Phase 2, complete):
- `service/airbotix_billing.go` is the 4th sanctioned upstream-adjacent file (ADR-0006).
- `PostTextConsumeQuota` (service/text_quota.go:379) calls `dispatchAirbotixBilling` after `SettleBilling`.
- Event schema: `started_at`/`finished_at`/`routed_from`/`policy_violations` per PRD §7.3.
- `User.WebhookSecret` (varchar 128, plaintext) is the HMAC key; `User.BillingWebhookURL` is the target.

**Changing the smart-router contract**:
- This is a cross-repo change. Touch BOTH `internal/smart_router_client/client.go` (deeprouter side) AND `smart-router/internal/api/handler.go` (smart-router side).
- Update `smart-router/docs/PRD.md` §6.1 + this repo's `internal/smart_router_client/README.md`.

## 5. Build / test commands

Run from `deeprouter/` root.

```bash
# Full stack (production-shape image)
docker compose up -d
docker compose logs -f new-api
docker compose down -v                                            # reset (wipes PG + Redis)

# Dev compose (builds Go from local source)
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml up -d --build new-api    # rebuild after Go change

# Full stack + smart-router sidecar (tests the deeprouter-auto path)
export DEEPROUTER_INTERNAL_TOKEN=$(openssl rand -hex 32)
docker compose -f docker-compose.smart-router.yml up -d --build

# Native (after frontend is built once)
make dev                          # dev-api + dev-web
make dev-web                      # frontend hot-reload only (web/default, port :3001)
make build-frontend               # build web/default for prod embed
go run main.go                    # backend only
go test ./...                     # all Go tests
go test ./internal/...            # only Airbotix-internal packages
go test -run TestName ./path/to/pkg

# Frontend
cd web/default && bun install && bun run dev    # :17231
cd web/default && bun run i18n:sync             # sync translation strings
```

Bun is the frontend package manager (AGENTS.md Rule 3) — don't switch to npm/yarn/pnpm.

## 6. Tech stack snapshot

- Backend: Go 1.22+, Gin, GORM v2
- Frontend: React 19, TypeScript, Rsbuild, Base UI, Tailwind (`web/default/`); React 18 + Vite + Semi Design legacy (`web/classic/`)
- Databases: SQLite, MySQL ≥ 5.7.8, PostgreSQL ≥ 9.6 — code must work on **all three** (AGENTS.md Rule 2)
- Cache: Redis (go-redis) + in-memory layer
- Auth: JWT, WebAuthn/Passkeys, OAuth (GitHub, Discord, OIDC, WeCom, Lark, …)

## 7. Internationalisation

- Backend (`i18n/`): `nicksnyder/go-i18n/v2`, en + zh
- Frontend (`web/default/src/i18n/`): `i18next` + `react-i18next`, en (base) / zh (fallback) / fr / ru / ja / vi. Translation files are flat JSON keyed by English source strings. CLI: `bun run i18n:sync`.

## 8. Upstream sync etiquette

Custom logic belongs in `internal/`. Upstream-adjacent fork files are limited to the 4 sanctioned files (ADR-0006): `relay/airbotix_policy.go` (+ test, policy/kids enforcement per request shape) and `service/airbotix_billing.go` (DR-25, billing webhook dispatch from `PostTextConsumeQuota`). Both are named so rebase conflicts are obvious. Avoid editing upstream files (`controller/`, `model/`, `web/`) when an `internal/` subpackage is the right home. See `AIRBOTIX.md` for the cherry-pick / merge workflow.
