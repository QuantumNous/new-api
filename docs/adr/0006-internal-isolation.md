# ADR 0006 — Fork-specific code lives in `internal/`

- **Status**: Accepted
- **Date**: 2026-05-12
- **Affects**: `deeprouter/`

## Context

This repo is a long-lived fork of `QuantumNous/new-api`. Upstream ships features at high velocity (32K-star repo, frequent commits, multiple maintainers). We want to rebase / cherry-pick from upstream **monthly** for a few reasons:

- New upstream provider adapters (Replicate, Cohere, etc.) — would be expensive to re-implement.
- Upstream bug fixes (auth, rate-limit, channel-test corner cases).
- Upstream UI improvements.
- Security patches.

Every Airbotix-specific change we make in upstream-owned files (`controller/`, `model/`, `web/`, `relay/channel/*`) increases the surface area where rebase merge conflicts will occur. If we sprinkle "if user.kids_mode { ... }" branches across 30 files, every upstream change near any of those branches creates a conflict.

We need a discipline that minimises this conflict surface without preventing us from shipping fork value.

## Decision

All Airbotix-specific business logic lives in `internal/`:

```
internal/
├── billing/                   — HMAC-signed webhook dispatcher
├── kids/                      — kids_mode enforcement helpers
├── policy/                    — per-tenant policy decision engine
└── smart_router_client/       — HTTP client to ../smart-router/
```

Each is a leaf package: it imports only stdlib (and the JSON wrapper from `common/`). Upstream code never imports from `internal/`.

Wiring `internal/` into the request path is done through a **small** set of named, upstream-adjacent files. Four are sanctioned today:

| File | Purpose |
|---|---|
| `relay/airbotix_policy.go` (+ test) | Applies policy + kids enforcement to OpenAI / Claude / Gemini / Responses request shapes before provider conversion |
| `middleware/smart_router.go` | Detects `deeprouter-auto` virtual model, calls `internal/smart_router_client/`, rewrites the model name |
| `model/user.go` | Extended with 5 Airbotix columns (`kids_mode`, `policy_profile`, `billing_webhook_url`, `custom_pricing_id`, `webhook_secret`) |
| `service/airbotix_billing.go` | Orchestrates per-request billing webhook dispatch: reads gin.Context (AirbotixUser, X-Tenant-User header, ContextKeyAliasResolvedFrom), builds `billing.Event`, calls `internal/billing.NewDispatcher` in a gopool goroutine. Cannot live in `internal/billing/` because it requires gin.Context and relay/common.RelayInfo — upstream types that would break the leaf package's zero-upstream-dependency contract. Added DR-25 (Phase 2 billing wiring). |

One upstream file also carries a single minimal hook:

| File | Change | Rationale |
|---|---|---|
| `service/text_quota.go` | `dispatchAirbotixBilling` call added inside `SettleBilling` else-branch (~3 lines) | The dispatch must happen after quota settlement; no Airbotix business logic lives here — the file is otherwise unchanged |

This is the only upstream `service/` file modified. Any future cross-cutting hooks in `PostTextConsumeQuota` or similar upstream functions should follow the same pattern: the smallest possible change to the upstream file, with all logic delegated to the sanctioned file.

Adding a fifth sanctioned upstream-adjacent file requires updating this ADR.

The discipline:
- ❌ Adding `if user.kids_mode { ... }` inside `controller/relay.go`
- ❌ Adding a new helper inside `service/log.go` for tenant billing (use `service/airbotix_billing.go` instead — the 4th sanctioned file)
- ❌ Reaching across into `internal/` from a random `controller/` file
- ✅ Adding helpers to `internal/kids/` or `internal/billing/`
- ✅ Calling those helpers from `relay/airbotix_policy.go` or `middleware/smart_router.go`
- ✅ Adding a new column on `model/user.go` (carefully — see Phase 0 in PLAN.md)

This is **AGENTS.md Rule 8**.

## Consequences

**Good**:
- Rebase conflicts during monthly upstream sync land almost entirely on the 3 sanctioned files + `model/user.go`'s column block. Conflicts are localized and easy to resolve.
- `internal/` packages are independently testable — they're leaves with stdlib-only deps.
- Easier code review: "is this PR adding to internal/ or modifying upstream?" maps cleanly onto risk.
- AGPL viral-scope is unaffected; this is purely a maintenance / rebase concern.

**Bad**:
- Some cross-cutting features take an extra hop. Example: kids_mode enforcement happens in `relay/airbotix_policy.go`, which is two files away from where the request body is actually serialized. If you forget to call `airbotix_policy.Apply<Shape>`, the enforcement silently skips.
- A new request shape (say, the next OpenAI endpoint) requires adding both a handler in `relay/` AND an `Apply<Shape>` function in `airbotix_policy.go`. Two-file change is easy to forget.
- The set of "sanctioned upstream-adjacent files" is governance, not technical — it relies on reviewer discipline.

**Neutral**:
- Engineers must read the rule. Documented in `AGENTS.md` Rule 8, `CLAUDE.md` §1, `AIRBOTIX.md`.

## Alternatives considered

1. **Patch-based fork management** (apply our patches on top of upstream HEAD each rebase) — rejected: hard to merge-conflict resolve, patches drift fast, no IDE support, no `git blame` continuity.
2. **Vendoring upstream and modifying freely** — rejected: we lose the cherry-pick path, every upstream commit becomes a manual rebase, no benefits.
3. **Branching strategy** (long-lived `airbotix-main` branch with frequent merges from `upstream-main`) — what we do now, but the `internal/` discipline is what makes the merges manageable.
4. **No discipline; let conflicts sort themselves out** — rejected; an early experiment created a conflict in `controller/relay.go` that took 4 hours to resolve.
5. **Push our changes upstream** — selectively yes (a few unrelated bug fixes have gone upstream). But Airbotix-specific business logic (kids_mode, per-tenant policy) is too vertical to be accepted by upstream maintainers.

## Trigger to revisit

Reopen if:
- We accumulate so much logic in `relay/airbotix_policy.go` (or wherever) that it becomes a monolith that's hard to reason about. Likely solution: split it by request shape (`relay/airbotix_policy/openai.go`, etc.) — still in the same upstream-adjacent surface.
- Upstream divergence exceeds the 30% threshold mentioned in `AIRBOTIX.md` — at that point, declare it a hard fork (decision D-DR9) and the `internal/` discipline becomes optional.
- We need an `internal/` feature that fundamentally requires touching `service/` or `controller/` in deep ways. At that point, propose adding a new sanctioned upstream-adjacent file in this ADR before committing.
