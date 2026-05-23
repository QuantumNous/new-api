# Airbotix / Kids in AI — DeepRouter Fork Notes

> This file is **NOT from upstream** (`QuantumNous/new-api`). It captures DeepRouter-specific intent and customisation status, separately from upstream-derived docs (which we keep clean for rebase).

## What this fork is

This is the production code repository for **DeepRouter** — an OpenAI-compatible multi-tenant LLM gateway. Forked from `QuantumNous/new-api` (32K stars, AGPL v3, very actively maintained).

DeepRouter is an independent product (not part of Airbotix). See [`docs/PRD.md`](./docs/PRD.md) for the full engineering PRD and [`docs/DESIGN.md`](./docs/DESIGN.md) for the UI design system. The business plan (`DeepRouter-BP.md`) lives outside this repo at `~/Documents/sites/jr-academy-ai/deeprouter-brand/`.

## License inheritance

**AGPL v3** (forced by upstream). Our public fork is intentional — we follow the Supabase / Plausible / Cal.com model: open source core + hosted SaaS + enterprise support contracts.

The model-selection sidecar lives in a **separate repo** (`../smart-router/`, Apache 2.0) precisely to keep routing intelligence outside AGPL's viral scope. See `../CLAUDE.md` for the process-boundary rules.

## What we customise (status as of 2026-05-23)

We minimise core changes to keep upstream cherry-picking sustainable. All Airbotix-specific code lives in dedicated locations:

| Path | Purpose | Status |
|---|---|---|
| `internal/policy/` | Decision engine — `DecisionFor(kidsMode, profile) → Decision` (6 boolean flags) | ✅ Implemented (78 LOC + tests) — wired via `relay/airbotix_policy.go` |
| `internal/kids/` | Hard constraints: model whitelist, metadata strip, OpenAI ZDR, child-safe system prompt | ✅ Implemented (112 LOC + tests) — wired via `relay/airbotix_policy.go` |
| `internal/smart_router_client/` | HTTP client for the smart-router sidecar, with circuit breaker and graceful degradation | ✅ Implemented (190 LOC + tests) — wired via `middleware/smart_router.go` |
| `internal/billing/` | HMAC-signed per-request billing webhook dispatcher with retry policy | ✅ Implemented (119 LOC + tests) — **NOT yet wired into relay path (Phase 2 in PLAN.md)** |
| `relay/airbotix_policy.go` + test | Stitches policy + kids enforcement into OpenAI / Claude / Gemini / Responses request shapes | ✅ Wired |
| `middleware/smart_router.go` | Detects `deeprouter-auto` virtual model, calls smart_router_client, rewrites model name | ✅ Wired |
| `model/user.go` | Extended with 5 columns: `kids_mode`, `policy_profile`, `billing_webhook_url`, `custom_pricing_id`, `webhook_secret` | ✅ Migration applies on boot |
| `web/default/` | Admin UI — needs fields added for the 4 new User columns (Phase 1 work) | 🟡 Backend ready, UI pending |

**Database changes**: extend NewAPI's existing `users` table with 5 columns. No new tables, no schema rewrite.

## Local development

→ See [`DEV.md`](./DEV.md) for the 5-minute local quickstart.

For the full sidecar topology (DeepRouter + smart-router + Postgres + Redis in one compose):

```bash
export DEEPROUTER_INTERNAL_TOKEN=$(openssl rand -hex 32)
docker compose -f docker-compose.smart-router.yml up -d --build
```

## Development plan

→ See [`PLAN.md`](./PLAN.md) — phase-by-phase plan with acceptance criteria, open decisions, and risk register. **Living plan; update it weekly.**

## V0 milestone

P0 deliverable: **OpenAI-compatible `/v1` endpoint working with `kids_mode` enforcement end-to-end**, unblocking the `kidsinai/kids-opencode` team (product repo, depends on opencode upstream via `@opencode-ai/sdk` + `@opencode-ai/plugin`; the kernel mirror lives at `kidsinai/opencode-kernel`).

Phase status snapshot (see `PLAN.md` for full breakdown):

- ✅ Phase 0 — Foundation: fork + 4 leaf packages + CI green
- 🟡 Phase 1 — Tenant management (Week 3-4): admin UI fields for the 4 User columns
- 🟡 Phase 2 — Relay wiring: hook `internal/billing/` into completion path
- ⏳ Phase 3–6 — Multi-provider hardening, content moderation, JR Academy migration, prod launch

## Tenants (V0)

| tenant_id | Source | Settings |
|---|---|---|
| `airbotix-kids` | Kids in AI platform | `kids_mode: true`, strict policy, Stars billing webhook |
| `jr-academy` | JR Academy (Lightman's other co.) | adult ed policy, JR's own billing metering |
| `external-x` | future SaaS customers | V2+ |

## Critical V0 features (must hit)

1. OpenAI-compatible `/v1/chat/completions`, `/v1/messages`, image/embeddings — all with cross-protocol conversion
2. `kids_mode` hard constraints (see DeepRouter PRD §6.4-pre) — code in `internal/kids/` + `internal/policy/`, wired via `relay/airbotix_policy.go`
3. Multi-key Provider Pool with token bucket (Anthropic Tier RPM workaround — DeepRouter PRD §5.5, §6.5)
4. Billing webhook with HMAC signature + retry + dead letter queue — code in `internal/billing/`, wiring pending
5. Atomic per-tenant quota check

## Upstream sync

```bash
git remote -v          # origin = our fork, upstream = QuantumNous/new-api
git fetch upstream
git cherry-pick <commit>      # for individual bugfix
# OR merge: git merge upstream/main  (when divergence is small)
```

If divergence > 30% triggers D-DR9 (independent fork decision) — see PRD.

**Rebase-safe zone**: anything under `internal/`, `relay/airbotix_policy.go`, `middleware/smart_router.go`, and the 5 new columns on `model/user.go`. Upstream rarely touches these; conflicts here usually mean upstream renamed something we depend on.

## Sister docs

- [`CLAUDE.md`](./CLAUDE.md) — codebase map for Claude (where things live, key facts that bite)
- [`AGENTS.md`](./AGENTS.md) — coding rules (JSON wrapper, cross-DB, branding lock, etc.)
- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — upstream module tour (router → controller → service → model → relay)
- [`docs/PRD.md`](./docs/PRD.md) — engineering PRD **[in-repo]**
- [`docs/DESIGN.md`](./docs/DESIGN.md) — UI / visual design system **[in-repo]**
- `~/Documents/sites/jr-academy-ai/deeprouter-brand/DeepRouter-BP.md` — business plan **[external, fundraising]**
- `~/Documents/sites/kidsinai/planning/PROJECT.md` — master plan across all Lightman ventures **[external]**
