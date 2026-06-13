# DeepRouter — Development Plan (V0 → Launch)

> **Status**: v0.1 living plan · 12-week sprint to V0 launch (Workshop-ready) · Updated 2026-05-12
> **Owner**: Lightman (architecture / business / blockers) + 1 Go engineer (full-time, TBH)
> **Goal**: A production-ready, AGPL-licensed, multi-tenant LLM gateway with `kids_mode` hard-constraint enforcement, serving Airbotix Kids + JR Academy as launch tenants.
> **Cross-PRD links**:
> - Full engineering PRD: [`docs/PRD.md`](./docs/PRD.md)
> - UI design system: [`docs/DESIGN.md`](./docs/DESIGN.md)
> - Fork-intent context: [`AIRBOTIX.md`](./AIRBOTIX.md)
> - Local dev quickstart: [`DEV.md`](./DEV.md)
> - Master cross-product plan: `~/Documents/sites/kidsinai/planning/PROJECT.md`

---

## How to read this plan

Each phase has:
- **Goal**: outcome in one sentence
- **Tasks**: concrete code work with file paths
- **Acceptance**: verifiable checks (a real human/CI test)
- **Risks / decisions**: things to surface during the phase

Weekly: this engineer updates the checkboxes; un-checked items become carry-over.

---

## Phase 0 — Foundation ✅ DONE (2026-05-12, extended 2026-05-18)

**Goal**: Fork running locally, schema extended, leaf packages compile + test + CI green.

- [x] Fork `QuantumNous/new-api` → `deeprouter-ai/deeprouter` (public, AGPL v3 inherited)
- [x] Add upstream remote, document cherry-pick workflow ([DEV.md §7](./DEV.md))
- [x] Extend `model/user.go` with 4 Airbotix fields (`kids_mode`, `policy_profile`, `billing_webhook_url`, `custom_pricing_id`)
- [x] `internal/kids/` — pure helpers (whitelist / metadata strip / ZDR / system prompt)
- [x] `internal/policy/` — DecisionFor combines KidsMode + Profile into single decision
- [x] `internal/billing/` — HMAC sign + retry-aware Dispatcher
- [x] `internal/smart_router_client/` — HTTP client + 5-failure/30s circuit breaker + graceful degradation (added 2026-05-18 for smart-router Phase 2 integration)
- [x] `relay/airbotix_policy.go` (+ test) — wires `internal/policy` + `internal/kids` into OpenAI / Claude / Gemini / Responses request shapes
- [x] `middleware/smart_router.go` — wires `internal/smart_router_client` into the relay path; handles `deeprouter-auto` virtual model
- [x] `.github/workflows/airbotix-internal.yml` — path-filtered CI (vet + build + test -race)
- [x] All unit tests green on CI; smart-router end-to-end probe via `docker-compose.smart-router.yml` passes

**Output**: 4 leaf packages implemented + tested. Three of four (`kids`, `policy`, `smart_router_client`) are already wired into the request pipeline. `internal/billing/` is implemented but not yet wired — that's Phase 2.

---

## Phase 1 — Tenant management (Week 3-4)

**Goal**: Operator can create a tenant via admin UI, see all 4 Airbotix fields, persist them, and verify migration applied.

### Tasks
- [ ] Verify migration on first boot
  - Spin up `docker compose -f docker-compose.dev.yml up -d`
  - `psql` into the Postgres container; `\d users` confirms 4 new columns
- [ ] Admin UI fields
  - Find user edit form in `web/default/src/pages/User/` (or wherever it is post-1.0-rc.4)
  - Add: boolean toggle for `kids_mode`; select for `policy_profile` (passthrough/adult/kid-safe); text inputs for `billing_webhook_url` + `custom_pricing_id`
  - Wire `controller/user.go` PUT/PATCH handlers to accept these fields
- [ ] Backend types
  - Update `dto/user.go` request/response DTOs (if separate from `model.User`)
- [ ] Tenant onboarding doc
  - Write `docs/tenant-onboarding.md`: 5-step Super Admin flow to create a tenant
- [ ] Seed script
  - `bin/seed-airbotix-kids.sh`: idempotently creates `airbotix-kids` tenant with `kids_mode=true`, prints API key

### Acceptance
- [ ] Admin UI shows all 4 new fields, persists on save
- [ ] `psql -c "select kids_mode, policy_profile from users"` returns expected
- [ ] `bin/seed-airbotix-kids.sh` outputs a working API key
- [ ] CI still green

### Risks / decisions to surface
- **D-DR3** (domain): `deeprouter.ai` vs `.io` — block on Lightman picking
- **Front-end JS framework version mismatch** in `web/default/` could complicate UI edits (check Rsbuild output)

---

## Phase 2 — Relay wiring (Week 5-6) 🔴 P0 — UNBLOCKS Team B (Kids OpenCode)

**Goal**: A request to `/v1/chat/completions` from a `kids_mode=true` tenant goes through the full transformation pipeline (validate model → strip metadata → inject ZDR → inject system prompt → call provider → dispatch billing webhook).

### Tasks
- [ ] `middleware/policy.go` (new)
  - Reads `c.Get("id")` (set by `TokenAuth` middleware)
  - Loads `User` via `model.GetUserCache(userId)`
  - Calls `policy.DecisionFor(user.KidsMode, user.PolicyProfile)`
  - Stores result via `c.Set("policy_decision", decision)`
  - Stores user (for billing) via `c.Set("airbotix_user", &user)`
- [ ] Register the middleware
  - Insert after `middleware.TokenAuth()` for the `/v1/*` route group in `router/relay-router.go`
- [ ] Outbound transformation in relay layer
  - Find the function that constructs the upstream request body (look in `relay/` and `controller/relay.go`)
  - Right before HTTP call: 
    1. If `decision.EnforceModelWhitelist && !kids.IsModelEligible(model)` → `c.JSON(400, gin.H{"error": "model_not_eligible_for_kids_mode"})` and abort
    2. If `decision.StripIdentifying` → mutate request body via `kids.StripIdentifyingMetadata(reqBody)`
    3. If `decision.EnforceZDR` → mutate via `kids.EnforceZeroDataRetention(reqBody, channel.Type)`
    4. If `decision.InjectSystemPrompt` → prepend the profile-level system prompt to messages array (only if no other system message already present, OR replace if Anthropic-style top-level system field)
- [ ] Billing dispatch on success
  - In the relay completion path (where token counts are tallied and logged): if `user.BillingWebhookURL != ""`, build `billing.Event` and call `billing.NewDispatcher().Send(...)` in goroutine
  - Per-tenant webhook secret: `User.WebhookSecret` column exists (`varchar(128)`, plaintext) — use that. NOTE: it's stored plaintext like `channel.key`; if SOC 2 / compliance demands later, see ADR-0004 for the column-encryption follow-up.
- [ ] Integration test
  - `controller/relay/relay_kids_mode_test.go`: spin up `httptest` mock provider, call relay with kids_mode tenant, assert (a) `store:false` in captured request, (b) no `user` field, (c) child-safe prompt prepended, (d) webhook called with correct payload + HMAC

### Acceptance
- [ ] Integration test passes locally + in CI
- [ ] Manual: `curl /v1/chat/completions` with kids_mode tenant + non-whitelisted model → 400
- [ ] Manual: `curl /v1/chat/completions` with kids_mode tenant + whitelisted model → 200, request captured by mock provider shows transformations
- [ ] Logs show `policy_decision` and webhook dispatch outcome
- [ ] **Team B can `git clone` Kids OpenCode → swap `OPENCODE_BASE_URL` to local DeepRouter → agent loop runs end-to-end**

### Risks / decisions
- **Where exactly the upstream body is mutable** — NewAPI's relay architecture may serialise early; might need to mutate at an earlier hook than expected. Spike day 1 of W5.
- **System prompt collision** — if user already provides a system prompt, prepend? replace? merge? Default: prepend; document.
- **Streaming SSE** — kid-safe constraints don't change per-chunk; the constraints apply at request setup. Streaming responses pass through unchanged.

---

## Phase 3 — Provider integrations + multi-key pool (Week 7-8)

**Goal**: 4 active providers + multi-key Anthropic pool handles workshop-scale burst.

### Tasks
- [ ] Provider validation (each provider gets an e2e test through kids_mode + adult tenants)
  - [ ] OpenAI (already works) — confirm
  - [ ] Anthropic — Messages format conversion path + tool use round-trip
  - [ ] DeepSeek (OpenAI-compatible) — direct
  - [ ] Doubao (火山方舟 OpenAI-compatible endpoint) — direct
  - [ ] (stretch) Qwen (阿里 DashScope OpenAI-compat)
  - [ ] (stretch) Gemini
- [ ] Multi-key Anthropic channel pool
  - Configure 4 Anthropic channels in admin UI (different keys, different priorities/weights)
  - Implement client-side token bucket per channel (NewAPI may have this already; extend if not)
  - Routing: respect priority then weight; on 429 mark channel exhausted for current minute; on 401/403 auto-disable + alert
  - Document `tier_label` + `rpm_budget` as Channel metadata in admin UI
- [ ] Burst test
  - `bin/burst-test.sh`: k6 script hitting `/v1/chat/completions` at 200 RPM for 10 min from a workshop simulator
  - Expected outcome: zero 503s (channel pool absorbs); p95 latency < provider native + 100ms
- [ ] Provider failover policy
  - Resolve **FAIL-1**: decide tenant-level config field for `acceptable_fallback_models` (or pick "503 on provider down, client retries")
  - Implement in routing layer

### Acceptance
- [ ] 4 providers pass kids_mode integration test
- [ ] Burst test: 200 RPM × 10 min, zero 503, p95 < 1.5s
- [ ] Disabling one Anthropic key (mark status=disabled) → traffic redistributes without errors
- [ ] CI green

### Risks / decisions
- **FAIL-1**: must be resolved this phase
- **Provider quota actual numbers**: confirm via real keys (not docs); some providers throttle by TPM not just RPM
- **Cross-protocol conversion edge cases**: tool_calls between OpenAI ↔ Anthropic still has known issues in upstream; add test cases for common shapes

---

## Phase 4 — Content moderation + billing hardening (Week 9-10)

**Goal**: Real safety classifier + production billing webhook with idempotency under chaos.

### Tasks
- [ ] Input filter
  - `internal/policy/blocklist/kids_strict_v1.txt` — curated keyword list (start narrow; iterate)
  - Wire blocklist into `middleware/policy.go` (after DecisionFor, before forwarding): block + return 422 with reason
- [ ] LLM-as-classifier
  - For `kids_mode` tenants: send the prompt to a cheap classifier (Claude Haiku or OpenAI moderation) before forwarding to main model
  - Result `unsafe` → 422 + log + (V1) send to family audit
  - Result `safe` → continue
  - Cost: should be ~$0.0002 per request; absorbed in margin
- [ ] Output filter
  - For image responses: hash → NSFW classifier (cloud or local; spike both)
  - For text: another classifier pass on response before returning to client
- [ ] Real billing webhook to Airbotix
  - Confirm payload schema with `kidsinai/platform-backend` `src/routes/billing.ts` (it's there already)
  - Use `internal/billing.Dispatcher` from relay completion
  - **Idempotency chaos test**: same request_id sent 10× concurrently → exactly one charge in Airbotix DB (verified end-to-end against local platform-backend + Postgres)
- [ ] Refund-on-failure
  - If provider returns error after we billed, dispatch a refund event (or never bill until success)
  - Decide which: bill on success only is simpler

### Acceptance
- [ ] Curated 100-prompt test set: ≥95 blocked, false-positive on educational set ≤2%
- [ ] Idempotency chaos test passes (1 charge from 10 concurrent identical webhooks)
- [ ] Billing webhook p95 dispatch latency < 200ms; dead-letter queue stays at 0 over 1h burn
- [ ] CI green

### Risks / decisions
- **Classifier provider choice** — pick before Phase 4 starts. Trade-off: Haiku (~$0.0003/req, fast, English+Chinese strong) vs OpenAI Moderation (free, English bias, limited categories)
- **COST-1** (Stars cost formula): platform-backend needs it; DeepRouter should expose `cost_usd` accurately so platform calculates Stars

---

## Phase 5 — JR Academy migration POC (Week 11-12)

**Goal**: JR Academy serves ≥1M tokens/day through DeepRouter, zero incidents over 24h.

### Tasks
- [ ] Coordinate with JR engineering lead (kick-off meeting in W10)
- [ ] Create `jr-academy` tenant: `kids_mode=false`, `policy_profile=adult`, `billing_webhook_url` → JR metering endpoint
- [ ] JR side: switch LLM client `base_url` from current to `https://api.deeprouter.ai/v1` (canary 1%)
- [ ] Observability: per-tenant dashboard (latency, error rate, cost, RPM)
- [ ] Daily 30-min sync during canary
- [ ] Gradual ramp: 1% → 10% → 50% → 100% over 7 days
- [ ] Reconciliation: DeepRouter total cost vs JR's invoice math weekly

### Acceptance
- [ ] 24h continuous: ≥1M tokens, zero 5xx attributable to DeepRouter
- [ ] Cost reconciliation diff < 1%
- [ ] JR engineering team comfortable to operate / rollback independently

### Risks / decisions
- **JR's existing LLM client structure** — pre-investigate; may need an adapter layer on JR side
- **JR side outage during canary** — must have one-flag rollback path

---

## Phase 6 — Production launch (Week 12 final sprint)

**Goal**: `api.deeprouter.ai` live in Singapore region with monitoring + backups + runbook.

### Tasks
- [ ] Provision production infra
  - Fly.io Machines in `sin` region (1× primary, 1× standby in `syd`)
  - Postgres: Supabase prod project or Fly Postgres
  - Redis: Upstash or Fly Redis
- [ ] DNS / TLS
  - Cloudflare → `api.deeprouter.ai` → Fly.io
  - Cloudflare proxy ON (DDoS)
- [ ] Secrets management
  - Doppler / 1Password Secrets Automation for provider keys, webhook secrets, DB creds
  - Document rotation runbook
- [ ] Monitoring
  - Prometheus metrics endpoint (already in NewAPI?) → Grafana Cloud
  - Alert: provider key disabled, channel pool exhausted, billing webhook DLQ > 0, p99 > 2s
- [ ] Backups
  - Postgres daily snapshot + 7-day retention
  - Restore tested at least once in pre-prod
- [ ] Runbook
  - `docs/runbook/provider-outage.md`
  - `docs/runbook/key-rotation.md`
  - `docs/runbook/incident-template.md`

### Acceptance
- [ ] `curl https://api.deeprouter.ai/health` returns 200 from outside our network
- [ ] Synthetic monitor catches simulated outage within 1 min
- [ ] Restored backup boots cleanly, integration test passes against restored DB
- [ ] Runbooks reviewed by Lightman + engineer

---

## Critical-path dependency graph

```
W0 (Lightman)  Anthropic Tier accumulation start
       │
       ▼
P0 Foundation  ✅ DONE
       │
       ▼
P1 Tenant mgmt ─────────┐
       │                │
       ▼                │
P2 Wiring (W5-6) ─── 🔓 unblocks Team B (Kids OpenCode)
       │
       ▼
P3 Multi-provider + multi-key
       │
       ▼
P4 Content + billing
       │
       ▼
P5 JR Academy migration ─── parallel: P6 prod infra
       │                                │
       └─────────────┬──────────────────┘
                     ▼
                  V0 Launch
```

---

## Open decisions blocking phases

| ID | Decision needed | Phase | Owner |
|---|---|---|---|
| D-DR3 | `deeprouter.ai` vs alt TLD | P1 (W3) | Lightman |
| FAIL-1 | Cross-provider fallback policy | P3 (W7) | Engineer + Lightman |
| CLASSIFIER-1 | Haiku vs OpenAI Moderation | P4 (W9) | Engineer (cost/quality spike) |
| COST-1 | Stars cost formula + model_pricing table | P4 (W9) | Engineer + Airbotix backend lead |
| SECRETS-1 | Secrets manager: Doppler vs 1Password vs aws-sm | P6 (W11) | Engineer |

---

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| **Anthropic Tier累计 never started** (P0 of dependency graph) | 🔴 极高 | Lightman owns Week 0 funding; status reviewed every Friday sync |
| Upstream NewAPI divergence > 30% | High | Cherry-pick weekly (every Friday); confine our code to `internal/` and `model/user.go`; review divergence in monthly retrospective |
| `web/default/` upstream churn breaks our 4 form fields | Medium | Add UI integration test in W4; flag fragility in retro |
| Anthropic key suspension (single-account risk) | High | 2+ accounts in W0; W7 channel auto-disable handles operationally |
| AGPL commercial concerns from enterprise customers | Medium | Open-source positioning is the public answer (Plausible/Cal.com model). For enterprise: hosted SaaS + paid SLA contract — not source license |
| JR Academy migration scope creep | Medium | Strict P5 acceptance criteria; refuse new asks until V0 launched |
| V0 launches but Airbotix workshop doesn't fire kids_mode correctly end-to-end | High | P2 integration test must include real Kids OpenCode → DeepRouter → mock provider chain |

---

## Weekly cadence

- **Mon morning**: engineer reads this PLAN.md, checks current phase, picks unchecked task
- **Friday 30 min**: Lightman + engineer sync on:
  - Phase progress (which boxes ticked)
  - Blockers / decisions needed
  - Risk register changes
  - Cherry-pick upstream (rebase day)
- **End of phase**: update PLAN.md acceptance checkboxes, write 1-paragraph retrospective at the end of the phase section

---

## Definition of "V0 Launched"

All of the following true simultaneously:

1. ✅ `api.deeprouter.ai/v1/chat/completions` serves real traffic in Singapore region
2. ✅ Two real tenants: `airbotix-kids` (kids_mode) and `jr-academy` (adult), each over 1k req/day
3. ✅ Billing webhook idempotency proven under chaos (1 charge per request_id)
4. ✅ Content moderation: ≥95% recall on test set
5. ✅ Multi-key Anthropic pool: zero 503s on a workshop-scale (200 RPM × 2h) load test
6. ✅ Monitoring + alerts in place; backup restore drill passed
7. ✅ DEV.md / AIRBOTIX.md / PLAN.md / runbooks all current

When all 7 are green: V0 done. Move to V1 planning (advanced policy / V1 desktop integration / SaaS billing for external-x).

---

## Revision History

| Version | Date | Note |
|---|---|---|
| v0.1 | 2026-05-12 | Initial plan. Captures status at end of Phase 0 (foundation), defines Phases 1-6 with acceptance criteria. |
