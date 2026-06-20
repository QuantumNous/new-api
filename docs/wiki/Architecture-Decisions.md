# Architecture Decisions

Key decisions made for DeepRouter. Each entry has: what was decided, why, and what it rules out.

---

## ADR-001 — Fork QuantumNous/new-api rather than build from scratch

**Date:** 2026-05  
**Status:** Active

**Decision:** Base DeepRouter on `QuantumNous/new-api` (AGPL v3, 32K stars).

**Why:** Upstream already handles 37 upstream providers, retry logic, billing, admin UI, and multi-tenant token management. Building equivalent from scratch would take months.

**Trade-off:** Bound to AGPL v3 viral license. Mitigated by keeping Airbotix-specific logic in `internal/` subpackages (clean rebase zone) and the model-selection intelligence in a separate Apache 2.0 repo (`../smart-router/`).

**Rules out:** Clean-room proprietary gateway.

---

## ADR-002 — Airbotix-specific code lives exclusively in `internal/`

**Date:** 2026-05  
**Status:** Active

**Decision:** All fork-specific packages go under `internal/` (policy, kids, billing, smart_router_client). The one exception is `relay/airbotix_policy.go` which is deliberately named to make rebase conflicts obvious.

**Why:** Upstream `controller/`, `model/`, `service/` are actively maintained. Minimising edits there keeps `git cherry-pick` from upstream feasible.

**Rules out:** Spreading business logic across upstream files.

---

## ADR-003 — smart-router in a separate repo (Apache 2.0)

**Date:** 2026-05  
**Status:** Active

**Decision:** Intelligent model selection (`deeprouter-auto`) lives in `deeprouter-ai/smart-router`, not in this repo.

**Why:** Model-selection intelligence is proprietary competitive advantage. AGPL's viral clause would force open-sourcing if it lived here. Apache 2.0 on the sidecar keeps it closed while the gateway stays open-source.

**Rules out:** Bundling routing logic into the gateway binary.

---

## ADR-004 — Policy check must run BEFORE channel model_mapping

**Date:** 2026-06-07  
**Status:** Active — partial implementation (only `compatible_handler.go` fixed so far)

**Decision:** In every relay handler, `applyAirbotixPolicy*` must be called before `helper.ModelMappedHelper`.

**Why:** `ModelMappedHelper` rewrites `request.Model` to the upstream model name (e.g. `gpt-4o-mini` → `llama-3.1-8b-instant` on a Groq channel). If the whitelist check runs after this rewrite, it evaluates the upstream name — which may not be on the whitelist — and blocks a legitimately-allowed request.

**Correct order:**
```
1. applyAirbotixPolicy(decision, channelType, request)   ← uses client name
2. helper.ModelMappedHelper(c, info, request)             ← rewrites to upstream name
```

**Affected handlers:** `compatible_handler.go` ✅, `claude_handler.go` ⚠️ pending, `responses_handler.go` ⚠️ pending, `gemini_handler.go` ⚠️ pending.

---

## ADR-005 — `internal/billing/` not wired yet (Phase 2)

**Date:** 2026-05  
**Status:** Deferred

**Decision:** The HMAC billing webhook dispatcher is implemented and tested but intentionally not called from the relay path in V0.

**Why:** V0 goal is relay + kids_mode correctness. Billing introduces a network call on every request; we want relay to be stable first. The wiring point is `service/text_quota.go` where quota is settled post-completion.

**Rules out:** Live billing in V0 / Sprint 1.
