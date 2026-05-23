# ADR 0003 — smart-router as per-instance sidecar

- **Status**: Accepted
- **Date**: 2026-05-12
- **Affects**: both `deeprouter/` and `smart-router/`

## Context

ADR 0001 + ADR 0002 say smart-router is a separate process. That still leaves the deployment topology question — there are several plausible shapes for "separate process":

1. **Centralised service** — one `smart-router` instance (or HA pair behind a load balancer) called by many `deeprouter` instances over the VPC network.
2. **Pool of routers** — N `smart-router` instances, deeprouter picks one per call.
3. **Per-instance sidecar** — every `deeprouter` instance ships with its own `smart-router` co-located on the same machine / pod / ECS task. Communication strictly over `localhost`.

Smart-router has a strict performance budget:
- **< 5ms p99 routing decision**
- **< 10ms p99 end-to-end overhead** (i.e., the cost smart-router adds to a request from deeprouter's perspective)

Both numbers are HARD ceilings — exceeding them is a Sev-2 bug, not a tuning opportunity.

Smart-router's state is small and per-tenant:
- Rules YAML (~10 KB)
- Catalog (~ few KB per tenant, fetched from deeprouter every 30s)
- No durable state, no shared cache between instances

## Decision

Per-instance sidecar topology. Every `deeprouter` instance has its own `smart-router` process on `127.0.0.1:8001`. They run in the same container task (ECS) / pod (Kubernetes) / docker compose stack.

The local `docker-compose.smart-router.yml` shows the canonical shape: two containers in one network, smart-router bound to the internal network, deeprouter calling it by service name.

## Consequences

**Good**:
- Localhost HTTP roundtrip is ~0.1–0.5ms reliably. Network jitter is eliminated. Performance budget (<10ms overhead) is achievable without engineering heroics.
- Failure blast radius is bounded to one gateway instance. A smart-router that crashes only affects one deeprouter; surviving instances continue serving (their own sidecars are unaffected).
- Catalog freshness is independent per instance — no thundering-herd refresh against deeprouter from many sidecars (each polls every 30s, but they're naturally jittered).
- Deployment is simpler: one ECS task definition with two containers; one Helm chart with two containers; one docker compose file.
- No load balancer needed. No service discovery between deeprouter and smart-router. Just `localhost:8001`.

**Bad**:
- Cannot share routing decisions or counters across instances. (We don't need to today — routing is stateless aside from the per-tenant catalog, and the catalog is read-only from smart-router's perspective.)
- Resource overhead per instance: smart-router binary is small (~10MB) and idle CPU/memory cost is negligible, but it's still N copies for N gateway instances. Acceptable; gateway machines are sized for the gateway, not for the sidecar.
- If smart-router gains heavy state in V2 (learned routing model, large embedding cache), running one per gateway instance gets expensive. At that point reconsider topology.

**Neutral**:
- Catalog endpoint on deeprouter is called from `localhost` — same instance is calling itself. Auth still needed (`DEEPROUTER_INTERNAL_TOKEN`) since deeprouter doesn't know who's calling on localhost; protects against compromised smart-router from being able to call random deeprouter endpoints.

## Alternatives considered

1. **Centralised smart-router service in same VPC** — rejected: VPC roundtrip is 0.5–3ms vs localhost <0.5ms. Within performance budget but eats more of it than necessary. Also: a single service becomes a coordination point and a SPOF unless you HA it; HA adds complexity (consensus on rules.yaml reload, etc.).
2. **Pool of smart-routers + client-side load balancing in deeprouter** — equivalent latency to (1) without the SPOF. Same coordination problem. Plus: each smart-router instance needs to maintain its own catalog cache, which means N copies anyway.
3. **smart-router as a Lambda function** — cold-start latency is incompatible with the 10ms budget. Even warm Lambda invocation is 5–15ms over the wire. Rejected.
4. **smart-router as a goroutine inside deeprouter** — rejected by ADR 0001 (process boundary required for license reasons).
5. **smart-router as a Unix domain socket sibling** — equivalent to localhost HTTP, slightly faster. Rejected for V0 because HTTP gets us observability/tracing/CLI debugging for free; revisit if even 0.1ms matters.

## Trigger to revisit

Reopen if:
- Smart-router gains state that's expensive per-instance (large learned model, big embedding cache, GPU-backed inference). At that point: centralised service with aggressive client-side caching of "common decisions" makes more sense.
- Number of gateway instances grows past O(100) — running 100+ sidecars is acceptable; the catalog-poll load on deeprouter becomes a thing to monitor.
- We move to Kubernetes-with-mesh deployment where intra-pod service mesh adds equivalent latency to localhost — no longer a sidecar topology advantage.
- Cross-instance learning becomes high-value (e.g., reinforcement-learned routing where decisions feed a shared training pipeline) — at that point smart-router probably has a "learning service" that's separate from the inference path.
