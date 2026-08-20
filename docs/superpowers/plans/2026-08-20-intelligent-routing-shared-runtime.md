# Intelligent Routing Shared Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace process-local intelligent-routing health, quality, and stickiness with Redis-backed shared state, add manual channel isolation, and fail closed to the legacy selector when shared state is unavailable.

**Architecture:** Define narrow runtime-store interfaces used by planning and relay completion. Redis implementations use namespaced, expiring keys and atomic commands; in-memory implementations remain deterministic test/single-instance fixtures. A shared-state readiness gate prevents live intelligent routing whenever a durable rollout exists but Redis is unhealthy.

**Tech Stack:** Go, go-redis/v8, miniredis, Gin, testify.

**Spec:** `docs/superpowers/specs/2026-08-20-multi-instance-admin-intelligent-routing-design.md`

## Global Constraints

- Multi-instance live routing requires a healthy Redis client.
- Redis keys use deployment and schema namespaces and never contain prompts, raw sessions, tokens, or credentials.
- State updates are atomic and all keys expire.
- Redis failure immediately returns the request to the existing selector; it never falls back to divergent per-instance state.
- Root-only manual health operations require a reason and operation audit.
- All existing root tests and the independent `relaykit` build must pass.

---

### Task 1: Runtime Store Interfaces and Readiness Gate

**Files:**
- Create: `service/intelligent_routing/runtime_store.go`
- Create: `service/intelligent_routing/runtime_store_test.go`
- Modify: `controller/relay.go`

- [ ] Write failing tests for shared-ready, Redis-disabled, nil-client, and failed-ping states.
- [ ] Run `go test ./service/intelligent_routing -run TestSharedRuntime -count=1` and observe failure.
- [ ] Define `HealthStore`, `QualityStore`, and `StickyStore` interfaces plus `SharedRuntime` with an atomic readiness state.
- [ ] Gate durable live rollout selection on `DefaultSharedRuntime.Ready()`; shadow planning may continue without changing execution.
- [ ] Run focused controller and service tests and commit `feat: gate shared intelligent routing runtime`.

### Task 2: Redis Channel Health and Manual Isolation

**Files:**
- Create: `service/intelligent_routing/redis_health.go`
- Create: `service/intelligent_routing/redis_health_test.go`
- Modify: `service/intelligent_routing/catalog.go`
- Modify: `controller/relay.go`

- [ ] Write miniredis tests proving two clients share observations, the 60-second window is pruned, transitions match existing thresholds, and manual isolation overrides automatic state.
- [ ] Run the focused tests and observe missing Redis behavior.
- [ ] Store bounded outcome members in a sorted set, isolation metadata in a hash, and expirations in an atomic pipeline.
- [ ] Replace request-path health reads/writes with the `HealthStore` interface.
- [ ] Run health, catalog, and controller tests and commit `feat: share intelligent routing health state`.

### Task 3: Redis Quality and Stickiness

**Files:**
- Create: `service/intelligent_routing/redis_quality.go`
- Create: `service/intelligent_routing/redis_quality_test.go`
- Create: `service/intelligent_routing/redis_stickiness.go`
- Create: `service/intelligent_routing/redis_stickiness_test.go`
- Modify: `controller/relay.go`

- [ ] Write miniredis tests proving cross-client quality counters, cold-start priors, shared sticky reads, policy mismatch invalidation, expiry, and atomic removal after two validation failures.
- [ ] Run tests and observe failure.
- [ ] Implement expiring hashes and a Lua compare/update script for validation failures.
- [ ] Pass policy version through sticky records and replace request-path local stores with interfaces.
- [ ] Run focused tests and commit `feat: share intelligent routing quality and stickiness`.

### Task 4: Root Health and Quality Operations API

**Files:**
- Modify: `dto/intelligent_routing.go`
- Modify: `controller/intelligent_routing.go`
- Modify: `controller/audit.go`
- Modify: `router/api-router.go`
- Create: `controller/intelligent_routing_runtime_test.go`

- [ ] Write failing tests for health listing, isolate/recover/reset, quality listing/reset, root authorization, required reasons, and audit actions.
- [ ] Implement stable DTO responses and map Redis unavailability to HTTP 503.
- [ ] Register the health and quality routes from the design specification.
- [ ] Run controller/router tests and commit `feat: operate intelligent routing runtime state`.

### Task 5: Startup Wiring and Failure Recovery

**Files:**
- Modify: `main.go`
- Create: `service/intelligent_routing/runtime_monitor.go`
- Create: `service/intelligent_routing/runtime_monitor_test.go`
- Modify: `docs/intelligent-routing-shadow-rollout.md`

- [ ] Write tests using driven ticks: failed ping marks runtime unavailable, successful ping plus policy refresh restores readiness, cancellation stops monitoring, and no live request uses local fallback state.
- [ ] Wire Redis stores only after `InitRedisClient`; keep explicit in-memory mode limited to tests/single-instance configuration.
- [ ] Document dependency degradation, recovery, key namespaces, TTLs, and manual operations.
- [ ] Run focused tests and commit `feat: monitor intelligent routing shared runtime`.

### Task 6: Verification, Rollback, and PR Update

**Files:**
- Create: `verification-intelligent-routing-shared-runtime/MODIFIED_FILE`
- Create: `verification-intelligent-routing-shared-runtime/DIFF_FILE`
- Create: `verification-intelligent-routing-shared-runtime/VERIFICATION.txt`
- Create: `verification-intelligent-routing-shared-runtime/ROLLBACK.sh`

- [ ] Run `go test ./... -count=1`.
- [ ] Run `go vet ./service/intelligent_routing ./controller ./model ./router`.
- [ ] Run `cd relaykit && GOWORK=off go build ./...` and `git diff --check`.
- [ ] Create and execute the four rollback artifacts against a separate copy, reopen them, and record exact hashes, commands, outputs, and exit statuses.
- [ ] Commit `test: verify intelligent routing shared runtime`, push the branch, and update PR #6943 with the new scope and proof.
