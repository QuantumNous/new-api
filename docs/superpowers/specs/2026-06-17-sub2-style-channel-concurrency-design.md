# Sub2-Style Channel Concurrency Design

Date: 2026-06-17

## Context

The current branch already introduces channel-level `max_concurrency` and a lease-based limiter around channel selection and relay execution. The next iteration should make that limiter behave more like the `sub2api` scheduler: use Redis as the shared concurrency source of truth, prefer low-load channels, wait briefly when capacity is saturated, and cool down channels that are actively overloaded by upstream.

This is a core request path. The implementation must be test-first and must preserve existing retry, billing, and task-release behavior.

## Goals

- Make channel concurrency leases stable across multiple new-api instances.
- Select among candidate channels using current load, not only static priority/randomness.
- Add a bounded wait queue so a temporary full channel set can recover without immediately returning 429.
- Add short channel cooldowns after upstream rate-limit or overload signals.
- Keep all behavior configurable and easy to disable if production evidence requires rollback.
- Cover the core path with focused unit tests before changing behavior.

## Non-Goals

- Do not rewrite the whole distributor or relay architecture.
- Do not copy sub2 account concepts that do not exist in new-api, such as account quota state or TTFT scoring, unless new-api already has equivalent data.
- Do not require Redis for single-instance development. Memory fallback remains useful for local and degraded operation, but only Redis mode provides cross-instance correctness.
- Do not change external OpenAI-compatible API response shapes except for clearer 429 cases that already fit `rate_limit_error`.

## Design Summary

Use the current channel concurrency work as the base and replace the simple full-channel behavior with a sub2-style scheduler layer:

1. Load candidate channels for the request model/group.
2. Remove channels that are disabled, incompatible, cooled down, or already known unschedulable.
3. Read current concurrency and waiting counts for candidates in batch.
4. Order candidates by effective load rate, while preserving existing priority/random behavior as tie-breakers.
5. Try to acquire a Redis-backed channel slot.
6. If every candidate is full and waiting is enabled, enter a bounded wait queue and retry acquisition until a timeout.
7. Return 429 when the wait queue is full, the wait timeout is reached, or no candidate can accept the request.
8. Release the slot exactly once on success, failure, retry switch, and async task paths.
9. Put a channel into a short cooldown after clear upstream 429/overload signals.

## Components

### Channel Concurrency Service

Existing `service/channel_concurrency.go` should become the single owner of slot acquire, release, load reads, wait counters, and cooldown state. Callers should not manipulate Redis keys directly.

Main responsibilities:

- `TryAcquireChannelConcurrency(channelID, maxConcurrency, requestID)` for immediate attempts.
- `AcquireChannelConcurrencyWithWait(ctx, candidates, options)` for scheduler-driven acquisition with wait behavior.
- `ReleaseChannelConcurrency(lease)` for idempotent release.
- `GetChannelLoads(channelIDs)` for batch load-aware selection.
- `MarkChannelCoolingDown(channelID, duration, reason)` for temporary unschedulable state.
- Memory fallback for development and Redis outage paths.

### Channel Selection

`service/channel_select.go` should keep owning model/group filtering and existing priority semantics, but should delegate runtime capacity decisions to the concurrency service.

Selection should calculate:

- `current_slots`
- `waiting_count`
- `max_concurrency`
- `load_rate = (current_slots + waiting_count) / max_concurrency`

Channels with `max_concurrency <= 0` remain unlimited and should not be treated as full. Among limited channels, lower `load_rate` wins. Existing priority/random selection remains as tie-break behavior so the change does not erase established routing policy.

### Distributor and Relay Lifecycle

`middleware/distributor.go` should acquire the lease before relay execution and store it in request context. `controller/relay.go` and related retry/task paths must release the lease exactly once.

The release contract must cover:

- normal non-stream response completion
- stream response completion
- upstream error before response body is returned
- retry to a different channel
- task creation paths that defer execution
- validation or billing failure after acquisition

The lease object should be idempotent so duplicate cleanup calls are safe.

### Wait Queue

When all suitable limited channels are full:

- Increment `concurrency:wait:channel:{id}` for the selected wait target.
- If the per-channel waiting count exceeds `max_waiting`, return 429.
- Retry acquisition at a small interval until timeout or request context cancellation.
- Decrement the waiting count in a deferred cleanup.
- Streaming requests may wait before upstream starts; no SSE ping is required before relay begins because new-api has not started the client stream yet.

Recommended defaults:

- Waiting enabled: true for channels with `max_concurrency > 0`.
- Wait timeout: 5 seconds.
- Retry interval: 100 milliseconds with small jitter.
- Max waiting per channel: same as `max_concurrency`, capped by a global default.

These defaults should be configurable.

### Cooldown

When an upstream response clearly indicates rate limiting or overload, mark the active channel temporarily unschedulable.

Cooldown candidates:

- HTTP 429 from upstream
- provider-specific overload or capacity errors already normalized in relay errors
- repeated channel concurrency failures if they indicate stale state

Cooldown should be short and bounded. Suggested default is 30 seconds, with a maximum of 5 minutes if reset metadata is available. Cooldown state is runtime-only in Redis or memory and must not disable the channel in the database.

### Redis Key Contract

Use Redis time inside Lua scripts instead of local process time.

- `concurrency:channel:{channelID}`: ZSET of active request IDs scored by Redis milliseconds.
- `concurrency:wait:channel:{channelID}`: waiting counter with TTL.
- `concurrency:cooldown:channel:{channelID}`: cooldown marker with TTL.

Acquire script behavior:

1. Read Redis `TIME`.
2. Remove expired ZSET entries.
3. If the same request ID already exists, refresh its score and return acquired.
4. If active count is below `max_concurrency`, add the request ID and return acquired.
5. Otherwise return full with active count.

Release behavior:

- `ZREM` the request ID.
- It is valid to release a missing request ID.

Request IDs should include a process prefix plus request-local suffix to make stale entries diagnosable.

Recommended slot TTL:

- Default: 30 minutes.
- Configurable.
- Much shorter than the current hardcoded 6 hours.

### Redis Failure Policy

Acquire failures should fail open through memory fallback and log the degraded mode. A Redis outage should not take down all API traffic.

Load and wait-counter failures should be conservative:

- If load read fails, keep existing channel order and still try acquisition.
- If wait counter increment fails, allow a limited local wait rather than immediate global failure.
- If release fails, log the failure; stale Redis slots expire by TTL.

## Configuration

Add operation-level settings rather than per-request behavior flags:

- `channel_concurrency_slot_ttl_minutes`, default 30.
- `channel_concurrency_wait_enabled`, default true.
- `channel_concurrency_wait_timeout_ms`, default 5000.
- `channel_concurrency_wait_interval_ms`, default 100.
- `channel_concurrency_max_waiting_per_channel`, default 0 meaning derive from `max_concurrency`.
- `channel_concurrency_cooldown_enabled`, default true.
- `channel_concurrency_cooldown_seconds`, default 30.

If the project already has a settings namespace for performance or operation behavior, use that existing pattern.

## Error Handling

User-facing concurrency errors should map to HTTP 429 with OpenAI-compatible `rate_limit_error`.

Separate internal reasons should remain distinguishable in logs and tests:

- all candidates full
- wait queue full
- wait timeout
- context canceled
- channel cooled down
- Redis degraded fallback

The user-facing body should not leak Redis keys, internal request IDs, or upstream supplier details.

## Testing Plan

Tests must be added or updated before implementation changes for each behavior group.

### Redis Slot Tests

- Acquire succeeds below capacity.
- Acquire fails when active count reaches capacity.
- Re-acquiring the same request ID refreshes the lease and remains idempotent.
- Release removes the request ID.
- Release of missing request ID is safe.
- Expired slots are removed before capacity is checked.
- Redis `TIME` is used by the script instead of process-local time.

### Memory Fallback Tests

- Local fallback enforces capacity in one process.
- Local fallback release is idempotent.
- Redis acquire error falls back without panicking.

### Load Selection Tests

- Batch load reads include active and waiting counts.
- Limited channels are sorted by lower load rate.
- Unlimited channels remain eligible.
- Existing priority/random tie behavior still applies for equal load.
- Cooled-down channels are skipped.

### Wait Queue Tests

- When all channels are full, a request waits and then acquires after release.
- Wait queue full returns 429.
- Wait timeout returns 429.
- Context cancellation exits the wait and decrements waiting count.
- Waiting count is decremented exactly once on success, timeout, and cancellation.

### Relay Lifecycle Tests

- Successful relay releases the lease.
- Upstream error releases the lease.
- Retry to another channel releases the old lease and acquires a new one.
- Async task paths do not leak the lease.
- Duplicate cleanup calls are safe.

### Cooldown Tests

- Upstream 429 marks the channel cooled down.
- Cooled-down channel is skipped during selection.
- Cooldown expires and the channel becomes eligible again.
- Cooldown does not change persistent channel status.

### Frontend and Validation Tests

- `max_concurrency` accepts zero or positive values.
- Negative values are rejected.
- Channel create/edit preserves the field.
- Any new settings UI, if added, validates numeric ranges.

## Rollout and Safety

Keep the existing immediate 429 behavior recoverable through configuration:

- Disable waiting to return to skip-and-429 behavior.
- Disable cooldown if upstream error classification proves too broad.
- Reduce TTL or wait timeout without migration.

The implementation should avoid database migrations unless the current branch still lacks the `max_concurrency` column migration. Runtime state belongs in Redis or memory, not persistent channel rows.

## Acceptance Criteria

- Channel capacity is enforced across instances when Redis is available.
- Lower-load channels are preferred without breaking model/group filtering.
- Saturated channels can queue within a bounded timeout.
- Full queue and timeout return 429.
- Upstream rate-limit signals temporarily cool down the channel.
- All lease paths release exactly once or safely tolerate duplicate release.
- Targeted Go tests cover service, selection, distributor, relay release, wait, and cooldown behavior.
- Existing frontend channel form tests still pass.
