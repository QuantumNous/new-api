# DR-82 Public Routing API Abuse Controls PRD

Status: eval

Date: 2026-06-22

Refs: NEW-4 R2/D-09, T-25; Phase 2 M11; depends on DR-149 and DR-64.

## Problem

Downloaded Skill packages call the public routing API with each runner's own DeepRouter key. If a runner credential is leaked, shared, or abused, the public routing API must contain damage before any upstream provider call is made.

## Scope

- Add a public-routing-only per-credential request limiter.
- Ensure revoked or otherwise invalid API tokens fail closed on the public routing API even when Redis token cache is stale.
- Detect and flag shared-credential or anomalous usage patterns, especially one token appearing from many IP/User-Agent combinations.
- Keep the controls backend-only; no dashboard UI is required for DR-82.

## Non-Goals

- Do not replace DR-13 tenant quotas.
- Do not add a new admin incident-management UI.
- Do not apply this stricter default throttle to ordinary `/v1/chat/completions` traffic.

## Acceptance

- An abusive public routing credential is throttled with HTTP 429 before provider execution.
- A revoked key fails closed on `/v1/routing/chat/completions`.
- Shared-credential or anomalous usage is flagged for observability without trusting client-provided identity.

## Design

- Add `internal/abuse` as the Airbotix-owned implementation package.
- Wire a public routing middleware before `Distribute()` for `/v1/routing/chat/completions`.
- Re-read the token from the source database for public routing requests and reject disabled, expired, exhausted, or missing credentials.
- Use Redis when available and in-memory fallback only when Redis is disabled. If Redis is enabled but command execution fails, fail closed with HTTP 500 so a broken shared limiter cannot silently permit abusive public routing traffic across nodes.
- Expose anomaly flags through context, response headers, and server logs for follow-up investigation.

## Operational Notes

- Shared-credential fanout is detection-only in DR-82. The middleware flags `shared_ip_fanout` and/or `shared_client_fanout` but does not block solely on fanout, because legitimate runner deployments may fan out across networks.
- Operators can consume `X-DeepRouter-Abuse-Flags` on responses and `PublicRoutingAbuseControl anomaly ... flags=...` system logs for alerting, manual revocation, or a future policy-driven blocklist.
- Automatic fanout blocking is intentionally deferred until operations has a reviewed threshold and exception policy.

## Verification

- Focused unit tests for the abuse package rate limiter and anomaly detector.
- Env-gated Redis integration test for the Redis Lua/set path (`DR82_REDIS_URL`).
- Redis failure tests confirming fail-closed behavior.
- Middleware tests for throttling, anomaly flags, and revoked-key fail-closed.
- Token update regression test for persisting status and DR-13 limit fields.
