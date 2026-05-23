# ADR 0001 — AGPL/Apache process boundary (two-repo split)

- **Status**: Accepted
- **Date**: 2026-05-12
- **Affects**: both `deeprouter/` and `smart-router/`

## Context

DeepRouter is a fork of `QuantumNous/new-api`, which is **AGPL v3**. AGPL is viral across **linkage** — anything compiled into the binary or imported as a Go module inherits AGPL. This is fine for the gateway itself (we publish source, follow Supabase / Plausible / Cal.com positioning).

The model-selection logic (which prompt → which model) is the **commercial moat** for this product. We don't want it AGPL — that would let competitors fork it. We want it **Apache 2.0** so we can choose later whether to keep it open, dual-license, or close-source it as a hosted service.

So we have a tension:
- AGPL gateway is required (inherited; can't change without forking from upstream entirely)
- Apache routing brain is required (moat)
- They have to talk to each other

AGPL's "aggregate work" interpretation (FSF + community precedent) says: AGPL does NOT cross **process** boundaries. Two processes communicating over a standard network protocol are aggregate works, not derivative works. Each can have its own license.

## Decision

Two independent git repos, deployed as separate OS processes:

- `deeprouter/` — AGPL v3 (inherited from upstream)
- `smart-router/` — Apache 2.0 (new repo, no AGPL code inside)

They communicate **only** over HTTP:
- `deeprouter` calls `POST /route` on `smart-router` (via `deeprouter/internal/smart_router_client/`)
- `smart-router` calls `GET /internal/router-catalog?tenant_id=...` on `deeprouter` (via `smart-router/internal/catalog/`)

Strict rules to keep the boundary clean:
1. `smart-router` MUST NOT import any package from `deeprouter` (no `github.com/QuantumNous/new-api/...` in its `go.mod`).
2. `deeprouter` MUST NOT import `smart-router`.
3. Code that lives in one repo cannot be copy-pasted into the other (the copy inherits the source's license).
4. There must be no shared Go module — separate `go.mod` files.

The contract is JSON over HTTP, versioned in `smart-router/docs/PRD.md` §6.

## Consequences

**Good**:
- Routing logic remains Apache 2.0 — commercial flexibility preserved.
- Gateway can be open-sourced and even rebased from upstream regularly without dragging routing into the open-source side.
- Each repo iterates at its own cadence (gateway monthly, routing weekly).
- Failure isolation: smart-router crash doesn't kill the gateway (the client treats `(nil, nil)` as "use default").

**Bad / acceptable cost**:
- Localhost HTTP roundtrip adds ~0.5–2ms to every request that goes through smart-router. Budgeted (PRD §5: <10ms overhead).
- Cannot share types between the two repos. Request/response shapes must be hand-mirrored or independently parsed. JSON keeps this manageable.
- Two repos to release, two CI pipelines, two Dockerfiles, two `go.mod`s.

**Neutral**:
- Engineers working on routing don't need access to gateway internals (and vice versa). Could be a wash or a positive depending on team size.

## Alternatives considered

1. **Single AGPL repo** — routing becomes AGPL. Rejected: destroys moat.
2. **Single repo, Apache-only sub-module published separately** — Go's import semantics still pull the AGPL graph at compile time. Rejected: doesn't actually preserve the boundary.
3. **Dynamic linking via Go plugin** — Go plugins are AGPL-viral too (compiled into the same address space). Rejected.
4. **Routing as a gRPC service in a separate repo** — equivalent to current design, just gRPC instead of HTTP. Rejected for V0 (HTTP is simpler, observability tools work out of the box, no `.proto` to maintain). May revisit if we hit performance ceilings.
5. **Routing as a hosted SaaS that customers call** — would work but doesn't fit on-prem deployments and adds external network dependency. Deferred until we have evidence it's wanted.

## Trigger to revisit

Reopen this decision if:
- AGPL viral-scope interpretation changes (e.g., FSF reverses its aggregate-work position) — would mean the current design over-protects.
- Performance budget breaks despite tuning (routing decision routinely > 10ms) — gRPC or merging back into one process for non-public deployments may help.
- Enterprise customers demand a single-binary deployment artifact — could be addressed by separately licensing the routing brain on a per-customer basis (and keeping the open-source path as fallback).
