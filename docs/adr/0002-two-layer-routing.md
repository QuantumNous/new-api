# ADR 0002 — Two-layer routing: model vs channel

- **Status**: Accepted
- **Date**: 2026-05-12
- **Affects**: both `deeprouter/` and `smart-router/`

## Context

Every request to the gateway needs two routing decisions, and they have nothing to do with each other:

1. **Which model should answer this prompt?** — business / quality / cost decision. Inputs: prompt content, tenant policy, budget caps, capability requirements. Output: a model name like `claude-haiku-4-5` or `gpt-4o-mini`.
2. **Which upstream API key should we use to call that model?** — operational decision. Inputs: model name, channel pool (priority, weight, health), retry state. Output: a specific provider account + API key.

Upstream new-api already does (2) — `model/channel_cache.go:GetRandomSatisfiedChannel` is a mature implementation with priority tiers, weight-based random selection, per-key health, and retry semantics.

We're adding (1) on top. It's the thing that makes DeepRouter more than a passthrough proxy. Conflating it with (2) — for example by exposing a "channel" of "deeprouter-auto" that does both — would make the system hard to reason about: routing failures could come from model-side problems (no rule matched, constraints unsatisfiable) or channel-side problems (all Anthropic keys rate-limited), and debugging would require holding both in your head.

## Decision

Cleanly split into two layers, owned by two different components:

| Layer | Component | Inputs | Output |
|---|---|---|---|
| 1. Model routing | `smart-router` | prompt, tenant_id, optional constraints | `{primary, fallback_chain, reason}` |
| 2. Channel routing | `deeprouter` (existing) | model name | one specific channel (provider + API key) |

The flow for a `deeprouter-auto` request:
```
client → deeprouter middleware sees "deeprouter-auto"
       → calls smart-router POST /route   ← Layer 1
       → gets back: primary="claude-haiku-4-5", fallback=["gpt-4o-mini"]
       → rewrites request.model to "claude-haiku-4-5"
       → deeprouter distributor picks a channel for that model   ← Layer 2
       → upstream LLM call
       → response header X-DeepRouter-Routed-Model echoes the chosen model
```

For requests with an explicit model (not `deeprouter-auto`), Layer 1 is skipped entirely. Layer 2 still applies.

If Layer 2 exhausts all channels for the primary model, deeprouter falls back to the next entry in `fallback_chain` (a cross-model fallback) and tries Layer 2 again on it.

## Consequences

**Good**:
- Debug separation: a request failure is one of "no model matched" (Layer 1) or "no channel available for chosen model" (Layer 2). The X-DeepRouter-Routed-Model header tells you which.
- Independent evolution: smart-router can experiment with new rules without touching deeprouter; deeprouter can change channel selection without touching smart-router.
- License separation aligns naturally with the layer boundary (see ADR 0001).
- Existing deeprouter channel routing keeps working unchanged when smart-router isn't deployed; you can run "channel routing only" by never sending `deeprouter-auto` requests.

**Bad**:
- An extra in-process hop for `deeprouter-auto` requests (~1–2ms, see ADR 0001).
- The split means cross-layer optimizations are harder. For example: "I know this channel is rate-limited, so don't even suggest this model" requires Layer 1 to know Layer 2's state. We don't do this today — Layer 1 only sees the **catalog** (which models exist + are reachable), not the **per-key health**.
- Two places to update when adding a new model. New model: pricing + catalog (deeprouter side) AND rules.yaml may want to reference it (smart-router side).

**Neutral**:
- Engineers need to learn the distinction. Documented in `ARCHITECTURE.md` §"Two-layer routing" and in `CLAUDE.md`. ADR exists so we don't forget why.

## Alternatives considered

1. **Single-layer routing in deeprouter** (extend `channel_cache.go` to also know about prompts) — rejected: pulls business logic into AGPL surface; entangles two different problems.
2. **Single-layer routing in smart-router** (make smart-router pick the channel too) — rejected: smart-router would need to know all API keys; key management would have to cross the license boundary; smart-router would need access to per-key health which is updated by deeprouter constantly.
3. **smart-router picks model AND channel** — rejected for the same reason as (2), plus it duplicates a working Layer-2 implementation.
4. **Have smart-router return a list of (model, channel) tuples** — rejected: smart-router doesn't have the data to score channels; it would be a thin wrapper around deeprouter's channel cache, no value added.

## Trigger to revisit

Reopen if:
- Cross-layer optimization becomes high-value (e.g., we want to route around a degraded channel proactively, not just on retry). Could be addressed by: smart-router subscribing to deeprouter's channel-health events; or having deeprouter mark certain models temporarily unavailable in the catalog.
- The number of layers grows beyond 2 (e.g., a "tenant" layer that picks a per-tenant variant) — at that point reconsider the entire abstraction.
- Smart-router's decision latency stays consistently under 1ms (currently budgeted < 5ms p99) — could afford richer per-request context, possibly including channel health.
