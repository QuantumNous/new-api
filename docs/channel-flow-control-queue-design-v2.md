# Channel Flow Control and Queue Design Report v2

Date: 2026-06-13

Status: v2 draft after design audit

Related documents:

- `docs/channel-flow-control-queue-design.md`
- `docs/flow-control-design-audit.md` (internal audit document)

## 1. v2 Executive Summary

This v2 report answers the design audit questions and refines the implementation plan for channel-level flow control and queueing in new-api.

The main corrections from v1 are:

1. Flow control must run after channel setup and upstream model mapping, not as generic middleware.
2. Each retry attempt must acquire and release its own flow-control guard.
3. Billing should not pre-consume quota while a request is waiting in queue. Add a read-only billing precheck before queueing, then pre-consume only after a slot is acquired.
4. Raw `pool_id` should not be user-provided. The web UI exposes "Flow Pool"; the backend generates `pool_key`.
5. Queue length must be bounded.
6. Redis production backend is needed for multi-instance deployments.
7. Redis Lua is not strictly required for v2. The recommended v2 Redis implementation is `WATCH/MULTI` optimistic transactions plus short polling. Lua can be introduced later as a performance optimization.
8. Queue wakeup must not rely only on Redis Pub/Sub. Use poll-first logic; Pub/Sub is optional acceleration.
9. Add graceful shutdown, runtime config versioning, request body memory caps, metrics retention, and clear backend status warnings.

Recommended initial settings for a 96-GPU upstream that supports 60 concurrent requests:

```text
max_inflight: 60
max_queue_size: 240
queue_timeout_ms: 120000
queue_policy: fifo
on_limit: queue
backend: redis in production, memory only for single instance/dev
```

## 2. Final Position on Lua

### 2.1 Is Lua Required?

No. Lua is not strictly required.

The system needs atomic "check capacity then add running/waiting entry" semantics. Redis Lua is one way to do this, but not the only way.

Available options:

| Option | Atomic | Complexity | Performance | Maintainability | Recommendation |
|---|---:|---:|---:|---:|---|
| Go memory lock | Yes, single process only | Low | High | High | Use for dev/single instance |
| Redis `WATCH/MULTI` | Yes, with retries | Medium | Medium | Medium-high | Recommended v2 Redis backend |
| Redis Lua | Yes | High | High | Medium-low | Optional later optimization |
| Redis Streams only | Not enough by itself | High | Medium | Medium | Not v2 |
| DB row locks | Yes | High | Low/medium | Medium | Not recommended for hot path |

### 2.2 Why Not Make Lua Mandatory in v2?

new-api already has one Redis Lua token-bucket helper under `common/limiter`, but most Redis usage in the project is simple wrapper calls. Making a complex queue/semaphore system depend on Lua in the first implementation raises several risks:

- Harder debugging and testing.
- Redis Cluster key-slot requirements.
- More operational knowledge required.
- Risk of long-running Lua scripts blocking Redis if cleanup scans too much.
- Harder to iterate while the product behavior is still being validated.

### 2.3 Recommended v2 Redis Strategy

Use Redis optimistic transactions:

```text
WATCH running, waiting, config
read current state
MULTI
  mutate running/waiting/request metadata
EXEC
if conflict -> retry with jitter
```

This gives atomicity without Lua. Under contention, `EXEC` may fail and retry. That is acceptable for v2 because:

- The target scenario is queueing around an upstream bottleneck, not millions of requests per second.
- A little retry overhead is easier to operate than a complex Lua scheduler.
- We can cap transaction retries and fall back to short poll.

### 2.4 When Should Lua Be Introduced?

Lua should be considered in a later phase if metrics show:

- Too many Redis transaction conflicts.
- Acquire latency from `WATCH/MULTI` becomes significant.
- Redis round trips become the bottleneck.
- Queue promotion needs to batch many waiters efficiently.

If Lua is introduced later, it must follow these rules:

- Use Redis hash tags so all keys for a pool share one slot:

```text
flow:{pool_key}:running
flow:{pool_key}:waiting
flow:{pool_key}:config
```

Here `{pool_key}` is the Redis hash tag. The literal braces matter for Redis Cluster compatibility.

- Limit cleanup work per script execution.
- Put script loading/execution behind a common helper, not scattered through business code.
- Add focused tests for each script.

## 3. v2 Architecture Overview

```text
Request
  -> auth and request validation
  -> token estimate and price estimate
  -> billing precheck, read-only
  -> channel selection
  -> SetupContextForSelectedChannel
  -> upstream model resolved
  -> resolve Flow Pool binding
  -> acquire Flow Guard
  -> billing pre-consume, actual deduction
  -> call upstream
  -> release Flow Guard when attempt/stream/task completes
  -> settle/refund billing as today
```

Important separation:

```text
User rate limit: who may send how many requests
Billing: whether user/token/subscription can pay
Flow control: whether upstream resource pool has capacity
```

These should be separate services.

## 4. Flow Pool Product Model

### 4.1 User-visible Concept

Users should not type `pool_id`.

The admin UI exposes:

```text
Flow Pool
  name: "96-card DeepSeek-R1 production pool"
  description
  max_inflight
  max_queue_size
  queue_timeout_ms
  queue_policy
  bindings
```

The backend generates:

```text
pool_key: flow_pool_8f3a2c...
```

Runtime Redis keys, logs, and metrics use `pool_key`.

### 4.2 Binding to Channels and Upstream Models

Binding must be explicit.

Runtime resolution priority:

```text
1. channel_id + upstream_model exact binding
2. channel_id binding
3. no binding -> no flow control
```

URL/base URL is only used to suggest possible bindings. It must not silently merge pools.

Reason:

- Same base URL can serve different physical GPU pools.
- Same base URL plus different key can map to different tenants.
- Same physical pool can have multiple URLs.
- Model mapping can change the actual upstream model.

### 4.3 Web UI Placement

Default frontend integration points:

```text
web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx
web/default/src/features/channels/lib/channel-form.ts
web/default/src/features/channels/types.ts
```

Add a section in the channel create/update drawer:

```text
Advanced Settings
  -> Flow Control & Queue
```

Controls:

```text
[Switch] Enable flow control and queue

Resource pool
  ( ) Create an independent pool for this channel
  ( ) Bind to existing Flow Pool
  ( ) Create new Flow Pool

Binding scope
  ( ) All upstream models on this channel
  ( ) Selected upstream models

Capacity
  Max in-flight requests
  Max queue size
  Queue timeout
  Queue policy

Upstream identity preview
  Channel type
  Base URL
  Published models
  Model mapping
  Suggested similar channels
```

Add a management tab:

```text
Channels | Flow Pools
```

List columns:

```text
Name
Bound channels
Running / max_inflight
Queued / max_queue_size
Wait P95
Rejected / timeout
Backend
Health
```

## 5. Data Model

Use DB tables, not only per-channel JSON. Shared pool configuration cannot be safely represented in multiple channel JSON blobs.

### 5.1 `channel_flow_pools`

```text
id                  int primary key
pool_key            varchar unique, generated
name                varchar
description         text
enabled             bool/int
max_inflight        int
max_queue_size      int
queue_timeout_ms    int
queue_policy        varchar, default "fifo"
on_limit            varchar, default "queue"
max_context_tokens  int, optional
max_context_chars   int, optional
max_processing_ms   int, optional
task_release_policy varchar, default "on_submit"
config_version      bigint
created_time        bigint
updated_time        bigint
```

### 5.2 `channel_flow_pool_bindings`

```text
id              int primary key
pool_id         int
channel_id      int
upstream_model  varchar, optional
match_mode      varchar, "channel" | "channel_model"
enabled         bool/int
created_time    bigint
updated_time    bigint
```

### 5.3 `channel_flow_metrics_minute`

```text
id                  int primary key
bucket_ts           bigint
pool_key            varchar
channel_id          int
model               varchar
running_avg         double or integer approximation
running_max         int
queued_avg          double or integer approximation
queued_max          int
acquired_count      int
queued_count        int
released_count      int
rejected_count      int
timeout_count       int
cancelled_count     int
lease_renew_fail    int
wait_ms_avg         int
wait_ms_max         int
wait_ms_p95         int, optional v2.1
process_ms_avg      int
process_ms_max      int
process_ms_p95      int, optional v2.1
created_time        bigint
updated_time        bigint
```

v2 should start with avg/max and counts. Percentiles can be added with an approximate histogram in v2.1.

### 5.4 `channel_flow_events`

Store only important events by default:

```text
id
request_id
pool_key
channel_id
model
event_type       queue_full | timeout | context_exceeded | lease_renew_failed | forced_release
reason
running
queued
wait_ms
process_ms
created_time
```

Retention:

```text
FlowEventRetentionDays, default 7
Per-pool daily cap, default 10000 events
created_time index for cleanup
```

## 6. Backend Interface

Define an explicit backend interface.

```go
type FlowBackend interface {
    Acquire(ctx context.Context, req AcquireRequest) (FlowGuard, *AcquireDecision, error)
    Status(ctx context.Context, poolKey string) (PoolStatus, error)
    Close(ctx context.Context) error
}

type FlowGuard interface {
    Release(ctx context.Context) error
    RenewLease(ctx context.Context) error
    PoolKey() string
    RequestID() string
}
```

Service layer:

```go
type FlowController struct {
    backend FlowBackend
    poolStore PoolStore
    metrics MetricsRecorder
}
```

Controller code should depend on `FlowController`, not directly on Redis or memory backend.

## 7. Retry Loop Interaction

### 7.1 Per-attempt Acquire/Release

Each retry attempt may select a different channel and therefore a different Flow Pool.

Rule:

```text
Each attempt acquires exactly one guard.
That guard is released before the next retry attempt.
Successful streaming attempts hold guard until stream ends.
```

Pseudo-code:

```go
var billingStarted bool

for retry := 0; retry <= common.RetryTimes; retry++ {
    channel, err := getChannel(...)
    if err != nil { break }

    // SetupContextForSelectedChannel has already selected key and model mapping.
    pool, ok := flow.ResolvePool(ctx, channel, upstreamModel)
    guard, decision, err := flow.Acquire(ctx, pool, requestMeta)
    if err != nil {
        if decision.Temporary && pool.OnLimitAllowsFallback() {
            markChannelTempUnavailableForThisRequest(channel.Id)
            continue
        }
        return flowError(err)
    }

    if !billingStarted {
        err := billing.PreConsume(...)
        if err != nil {
            guard.Release(ctx)
            return err
        }
        billingStarted = true
    }

    err = callUpstream(...)
    if isStreamSuccess {
        wrapStreamWithGuard(guard)
        return
    }

    guard.Release(ctx)

    if err == nil { return }
    if !shouldRetry(err) { break }
}
```

### 7.2 Temporary Unavailable vs Channel Failure

Pool full is not a channel failure.

Do not:

```text
auto-ban channel
record as permanent failed channel
disable channel
```

Do:

```text
mark channel/pool as temporarily unavailable only for this request attempt
```

### 7.3 `fallback_then_queue`

`fallback_then_queue` is not recommended in MVP because current channel selection is iterative, not candidate-set based.

MVP policies:

```text
queue
reject
fallback
```

Add `fallback_then_queue` later after channel selector supports capacity-aware candidate enumeration.

## 8. Upstream Model Resolution

Flow Pool resolution must happen after:

```text
middleware.Distribute()
SetupContextForSelectedChannel()
model mapping
upstream model name is available
```

Therefore flow control should not be implemented as generic Gin middleware.

Recommended:

```text
service/channel_flow.ResolvePool(c, channelID, upstreamModel)
```

Cache the resolved pool in request context for logs/metrics.

## 9. Billing Lifecycle

### 9.1 Problem

Current relay flow pre-consumes quota before the retry loop. If flow control is added after channel selection, requests may wait in queue after quota has already been deducted.

That is undesirable:

- Queue timeout would require refund.
- Long waiting time holds user quota.
- Billing sessions remain open before upstream capacity is available.

### 9.2 v2 Solution: Two-stage Billing

Add a read-only billing precheck before queueing:

```text
BillingPrecheck:
  estimate quota
  verify user/token/subscription likely has enough quota
  no deduction
```

Then after Flow Guard is acquired:

```text
PreConsumeBilling:
  actual deduction/reservation
  existing refund/settlement lifecycle
```

If pre-consume fails after acquire:

```text
release guard immediately
return insufficient quota
```

### 9.3 Placement

```text
Estimate tokens and price
BillingPrecheck
FlowControl Acquire
PreConsumeBilling
Call upstream
Settle/refund
Release guard
```

For stream, release guard on stream completion.

## 10. Memory Backend v2

Use memory backend only for dev and single-instance deployments.

Data structure:

```text
map[poolKey]*slot

slot:
  mutex
  config
  normal queue
  next sequence

request:
  request_id
  state: waiting | dispatched
  context_cost
  enqueue_time
  dispatch_time
  notify channel
  cancelled flag
```

Rules:

- Queue itself is the source of truth.
- `state=dispatched` means running.
- `state=waiting` means queued.
- No independent running counter unless derived.
- Queue supports lazy cleanup of cancelled requests.
- Add `max_processing_ms` scanner to force-release leaked dispatched requests.

Memory backend warning:

```text
If Redis is disabled, show admin warning:
"Current Flow Control backend is local memory. Multi-instance deployments cannot guarantee global upstream concurrency limits."
```

## 11. Redis Backend v2 Without Lua

### 11.1 Key Design

Use hash tags for future Redis Cluster compatibility:

```text
flow:{pool_key}:config
flow:{pool_key}:running
flow:{pool_key}:waiting
flow:{pool_key}:seq
flow:{pool_key}:req:{request_id}
flow:{pool_key}:events
```

All keys for one pool share the `{pool_key}` hash tag.

### 11.2 Runtime Config in Redis

On pool create/update, write config to Redis:

```text
HSET flow:{pool_key}:config
  enabled
  max_inflight
  max_queue_size
  queue_timeout_ms
  max_context_tokens
  max_context_chars
  max_processing_ms
  config_version
```

Acquire reads config from Redis inside the `WATCH` transaction. This reduces inconsistent config across instances.

### 11.3 Acquire Immediate or Enqueue

Algorithm with optimistic transaction:

```text
1. Generate request_id.
2. seq = INCR flow:{pool_key}:seq.
3. Cleanup a limited number of expired running leases.
4. WATCH running, waiting, config.
5. Read config, running count, waiting count.
6. If context exceeds limit -> UNWATCH, reject.
7. If running < max_inflight:
     MULTI
       ZADD running lease_expire_ms request_id
       HSET req metadata state=running
       EXPIRE req
     EXEC
     return guard
8. Else if waiting >= max_queue_size:
     UNWATCH
     reject queue_full
9. Else:
     MULTI
       ZADD waiting seq request_id
       HSET req metadata state=waiting
       EXPIRE req
     EXEC
     wait loop
10. If EXEC conflict, retry with jitter.
```

Bound transaction retries:

```text
max_tx_retries = 8
retry jitter = 5-30ms
```

If repeated conflicts occur:

```text
return temporary busy, allow retry/fallback or short wait
```

### 11.4 Waiting Loop

Do not rely only on Pub/Sub.

Recommended v2 loop:

```text
until deadline:
  1. Check whether request_id is already in running.
     If yes -> return guard.
  2. TryPromoteSelf with WATCH/MULTI:
       cleanup limited expired running leases
       if capacity available and this request is at queue head:
           move self from waiting to running
           return guard
  3. Sleep poll interval with jitter.
```

Default poll:

```text
initial: 100ms
normal: 250-500ms
max: 1000ms
jitter: +/- 20%
```

Optional optimization:

```text
Release publishes a wakeup signal.
Waiter wakes early but still checks Redis state first.
Poll remains the correctness mechanism.
```

### 11.5 Release and Promotion

Release:

```text
1. WATCH running, waiting, config.
2. Read config and running count.
3. Read queue head candidates.
4. MULTI:
     ZREM running request_id
     for available capacity:
       ZREM waiting candidate
       ZADD running lease_expire candidate
       HSET candidate state=running dispatch_time=now
     PUBLISH wakeup, optional
   EXEC
5. On conflict, retry with small cap.
```

Promotion must tolerate cancelled/stale waiters:

- If candidate metadata missing, remove it.
- If candidate exceeded timeout, remove it.
- If candidate belongs to another instance, moving it to running is okay; that instance will discover it on poll.

### 11.6 Why Poll-first Is Acceptable

For a queue size of 240 and poll interval around 500ms:

```text
approx additional Redis reads: 480/s in worst steady queue
```

This is acceptable for v2 and much easier to reason about than message-only wakeups.

Pub/Sub can reduce latency but must not be required for correctness.

## 12. Lease and Heartbeat

### 12.1 Defaults

```text
lease_ms: 60000
renew_interval_ms: 20000
renew_max_failures: 3
```

### 12.2 Renew Failure Policy

If lease renewal fails:

```text
record warning metric
retry up to 3 times
do not terminate the user request
```

Reason:

Killing an in-progress upstream request may be worse than temporarily allowing a slight overrun if Redis is unstable.

Track:

```text
flow_lease_renew_fail_total
flow_lease_expired_running_total
```

### 12.3 Memory Backend Leak Protection

Memory backend has no Redis lease recovery. Add:

```text
max_processing_ms
background scanner
forced release with warning event
```

If `max_processing_ms` is not configured:

```text
default = max(queue_timeout_ms * 4, 30 minutes)
```

For stream/WebSocket, allow a larger configured value.

## 13. Graceful Shutdown

On gateway shutdown:

```text
1. Mark local FlowController as draining.
2. New acquire calls return 503 service_draining.
3. Waiting local handlers are cancelled with 503.
4. Running requests are allowed to finish until shutdown timeout.
5. Redis backend releases or lets leases expire for local running requests.
6. Metrics record cancelled/drained counts.
```

Memory backend:

- Waiting queue is local. Return 503 to waiting requests during shutdown.

Redis backend:

- Waiting handlers cancel and remove their request IDs from waiting.
- Running requests release if possible.
- If process exits abruptly, leases recover.

## 14. Redis Unavailable Strategy

Redis failure policy should be configurable.

Options:

| Policy | Behavior | Pros | Cons |
|---|---|---|---|
| fail_open | Disable flow control temporarily | Best availability | May overload upstream |
| fail_closed | Reject affected pool requests | Protects upstream | User-visible outage |
| local_memory | Use local fallback | Partial protection | Multi-instance overrun |

Recommended default:

```text
flow_control_redis_failure_policy = fail_open
```

But for private upstream pools that must never exceed capacity, admin can choose:

```text
fail_closed
```

During failure:

- Show warning in admin UI.
- Send admin notification.
- Record events and metrics.

## 15. Request Body and Memory Management

Queueing a request means the HTTP handler, parsed request, body storage, and context may remain in memory or temporary storage while waiting.

Add safeguards:

```text
max_queued_body_bytes_per_request
max_queued_body_bytes_per_pool
max_queued_context_tokens_per_pool
```

MVP practical default:

```text
Do not add separate body-byte accounting in first code patch.
Do expose warning:
  large request bodies + large queue size can increase memory pressure.
Use existing request body size limits.
Track queued context chars/tokens.
```

v2.1:

- Add per-pool queued body byte estimate.
- Reject queue admission if pool queued memory is above threshold.

## 16. Metrics and Trend Charts v2

### 16.1 Phase 1 Metrics

Phase 1 must include realtime metrics. Without them, admins cannot validate whether flow control is working.

Realtime:

```text
running
max_inflight
queued
max_queue_size
oldest_wait_ms
backend
health
```

Minute aggregate v2:

```text
running_avg
running_max
queued_avg
queued_max
acquired_count
queued_count
released_count
rejected_count
timeout_count
cancelled_count
wait_ms_avg
wait_ms_max
process_ms_avg
process_ms_max
```

Percentiles:

```text
v2.1 use approximate histogram, not exact in-memory sorting
```

Candidate Go library:

```text
github.com/HdrHistogram/hdrhistogram-go
```

### 16.2 Flow Pool Health State

```text
Healthy:
  running/max_inflight < 70%, queued == 0

Busy:
  running/max_inflight >= 70%, queued == 0

Congested:
  queued > 0

Critical:
  queued/max_queue_size >= 80%

Overloaded:
  queue_full or timeout occurring

Degraded:
  Redis backend unavailable or lease renewal failures high
```

### 16.3 Error Response Metadata

For queue full:

```json
{
  "error": {
    "message": "The upstream resource pool is busy. The waiting queue is full. Please retry later.",
    "type": "rate_limit_error",
    "code": "channel_flow_queue_full",
    "metadata": {
      "pool_running": 60,
      "pool_max_inflight": 60,
      "pool_queued": 240,
      "pool_max_queue_size": 240,
      "retry_after_seconds": 30
    }
  }
}
```

Set HTTP header:

```text
Retry-After: 30
```

Do not expose sensitive pool names to normal users unless admin config allows it.

## 17. Config Hot Update

On pool config update:

```text
1. DB transaction updates channel_flow_pools and increments config_version.
2. Update Redis config hash for that pool.
3. Invalidate in-memory cache on local instance.
4. Broadcast cache refresh if existing project mechanism supports it.
```

Runtime rules:

- Reducing `max_inflight` does not cancel running requests.
- New dispatch stops until running drops below new max.
- Reducing `max_queue_size` does not kill already queued requests by default.
- New enqueue rejects if queue already exceeds new max.
- Disabling pool causes new acquire to reject or pass through based on policy; running requests drain.

## 18. Task Relay

Add:

```text
task_release_policy:
  on_submit
  on_task_finish
```

`on_submit`:

- Guard is released when upstream submit returns.
- Good for upstreams that have their own async queue.

`on_task_finish`:

- Guard remains associated with the local task record.
- Released when task reaches terminal state: success, failed, cancelled.
- Requires timeout/lease renewal for long tasks.

v2 MVP:

```text
Support on_submit.
Design data model for on_task_finish.
Implement on_task_finish in a later task-specific iteration.
```

Reason:

The existing task system has multiple providers and polling paths. Holding capacity until task finish changes semantics and needs more focused testing.

## 19. API Surface v2

### 19.1 Pool CRUD

```text
GET    /api/channel_flow/pools
POST   /api/channel_flow/pools
GET    /api/channel_flow/pools/:id
PUT    /api/channel_flow/pools/:id
DELETE /api/channel_flow/pools/:id
```

### 19.2 Bindings

```text
GET    /api/channel_flow/pools/:id/bindings
POST   /api/channel_flow/pools/:id/bindings
DELETE /api/channel_flow/bindings/:id
```

### 19.3 Status and Metrics

```text
GET /api/channel_flow/pools/:id/status
GET /api/channel_flow/pools/:id/metrics?from=&to=&bucket=minute
GET /api/channel_flow/pools/:id/events
```

### 19.4 Suggestions

```text
GET /api/channel_flow/suggestions?channel_id=123
```

Suggestions are not automatic binding.

## 20. i18n and Errors

Backend error codes:

```text
channel_flow_queue_full
channel_flow_queue_timeout
channel_flow_context_exceeded
channel_flow_draining
channel_flow_backend_unavailable
channel_flow_config_invalid
```

Messages must use existing backend i18n style where applicable.

Frontend strings should be added for all supported default frontend locales:

```text
en, zh, fr, ja, ru, vi
```

## 21. v2 Roadmap

### Phase 1: Correct Single-instance MVP

Required:

- Flow Pool DB tables.
- Binding DB table.
- Memory backend.
- Explicit backend interface.
- Channel edit drawer Flow Control section.
- Flow Pools list.
- Realtime status.
- Bounded queue.
- Configurable queue timeout.
- Per-attempt acquire/release in normal relay.
- Stream release wrapper.
- Billing precheck before queue and preconsume after acquire.
- Admin warning for memory backend.

Not included:

- Redis backend.
- Percentile charts.
- `fallback_then_queue`.
- `on_task_finish`.

### Phase 2: Trends and Operational Visibility

- Minute aggregates.
- In-flight trend chart.
- Queue trend chart.
- Reject/timeout chart.
- Flow Pool health state.
- Event retention config.
- Error response metadata and Retry-After.

### Phase 3: Redis Backend Without Lua

- Redis `WATCH/MULTI` backend.
- Runtime config hash.
- Lease and renewal.
- Poll-first waiting loop.
- Optional Pub/Sub acceleration.
- Redis failure policy.
- Multi-instance tests.

### Phase 4: Capacity-aware Routing

- `fallback` support without permanent channel failure.
- Candidate-set selection.
- `fallback_then_queue`.
- Pool load-aware routing.

### Phase 5: Advanced Controls

- Approximate histogram percentiles.
- `on_task_finish`.
- VIP priority.
- Context/token in-flight limits.
- Optional Lua optimization if WATCH conflicts are high.

## 22. Audit Issue Resolution Matrix

| Audit issue | v2 resolution |
|---|---|
| Retry loop guard lifecycle unclear | Per-attempt acquire/release; pool full is temporary, not channel failure |
| Upstream model only known after setup | Flow resolution after `SetupContextForSelectedChannel`, not middleware |
| Memory backend unsafe in multi-instance | Admin warning; Redis required for production global capacity |
| Missing graceful shutdown | Add draining mode and queue cancellation |
| Lua complexity | Lua not mandatory; v2 Redis uses WATCH/MULTI |
| Pub/Sub message loss | Poll-first loop; Pub/Sub optional acceleration only |
| Lease renewal undefined | 60s lease, 20s renewal, warning after failures |
| Guard leak | `max_processing_ms` and scanner for memory backend |
| Cancellation removal performance | Lazy cleanup or linked queue in memory backend |
| Multi-instance notification starvation | Waiter always checks running state first |
| Config hot update | DB version + Redis config hash + cache invalidation |
| Redis unavailable | Configurable fail_open/fail_closed/local_memory |
| Backend interface unclear | Define `FlowBackend` and `FlowGuard` |
| Metrics percentile memory pressure | v2 avg/max; v2.1 approximate histogram |
| Event table growth | Retention days, created_time index, per-pool daily cap |
| Task relay support partial | v2 `on_submit`, later `on_task_finish` |
| User-facing queue info | Error metadata and Retry-After |
| Prometheus/OpenTelemetry | Not MVP; keep metrics API compatible for later exporter |
| Billing while queued | Billing precheck before queue, preconsume after acquire |
| Queued request body memory | Add warnings and future body-byte caps |
| Idempotency | request_id uniqueness and Redis request metadata |

## 23. Key Implementation Decisions for Review

Reviewers should explicitly approve or reject these choices:

1. v2 Redis backend does not require Lua; use `WATCH/MULTI` first.
2. Flow Pool is a first-class DB entity; raw `pool_id` is not user-entered.
3. Flow resolution happens after channel setup and upstream model mapping.
4. Billing changes to two-stage precheck/preconsume.
5. Queue must have a hard `max_queue_size`.
6. Memory backend is allowed only with clear warning.
7. Redis failure default is `fail_open`, configurable to `fail_closed`.
8. `fallback_then_queue` is deferred until routing can inspect candidate pools.
9. Phase 1 includes realtime status; trend charts start in Phase 2.
10. Percentiles use approximate histograms later, not exact per-request arrays in v2.

## 24. Recommended Next Step

Before coding, produce a small technical spike for the Redis `WATCH/MULTI` backend:

```text
Goal:
  prove no more than max_inflight requests enter running across concurrent goroutines

Scope:
  Redis keys with hash tags
  acquire immediate
  enqueue
  try promote self
  release
  queue timeout

Load test:
  1000 concurrent acquire attempts
  max_inflight = 60
  max_queue_size = 240

Pass condition:
  running count never exceeds 60 except for documented lease-expiry edge cases
  queue full and timeout behavior deterministic
  transaction conflict rate measured
```

If conflict rate or latency is unacceptable, then design a Lua backend as Phase 3.5.
