# Channel Flow Control and Queue Design Report

> **Superseded** — This document is historical context only. The implementation follows [channel-flow-control-queue-design-v3.md](./channel-flow-control-queue-design-v3.md).

Date: 2026-06-13

Status: draft for architecture and product review

## 1. Executive Summary

This document describes a proposed channel-level flow control and queueing feature for new-api.

The core requirement is not ordinary user rate limiting. The target scenario is an upstream model resource pool, for example a 96-GPU cluster, that can only safely process 60 concurrent requests. The gateway must prevent the 61st request from entering the upstream. It should hold excess requests in a bounded queue, release them when capacity is available, expose real-time and historical traffic trends, and make the configuration understandable in the web admin UI.

The recommended model is:

```text
Flow Pool
  -> generated stable pool key, hidden from normal admin workflow
  -> human-readable name configured by admin
  -> bindings to channels and optional upstream models
  -> max_inflight, max_queue_size, queue_timeout_ms
  -> real-time and historical metrics
```

The previous term `pool_id` should not be exposed as a raw field for users to type. In the product UI, the user should create or select a "Flow Pool" and bind channels/upstream models to it. The backend generates a stable key for runtime use.

Recommended first production configuration for a 60-concurrency upstream:

```text
max_inflight: 60
max_queue_size: 240
queue_timeout_ms: 120000
queue_policy: fifo
```

Queue length must have an upper bound. An unbounded queue only moves overload from the upstream to the gateway and eventually causes memory pressure, connection exhaustion, poor user experience, and retry storms.

## 2. Requirement Background

### 2.1 Problem Statement

new-api currently supports several forms of rate limiting and protection:

- IP-based web/API/critical endpoint throttling.
- Per-user search throttling.
- Per-user model request throttling.
- User/token/subscription quota pre-consumption and settlement.
- System CPU/memory/disk protection.

These controls do not solve upstream capacity protection.

The target business case:

```text
An upstream model is served by a 96-GPU cluster.
The upstream cluster supports at most 60 concurrent requests.
new-api may receive more than 60 simultaneous requests for that model/channel.
The gateway must cap upstream concurrency at 60.
Excess requests should wait in a queue, not hit upstream.
The admin must be able to see in-flight and queued traffic trends.
```

### 2.2 Why Existing Rate Limits Are Not Enough

Request-per-minute limits and user-level limits answer questions like:

```text
How many requests can this user send in a window?
How many requests can this IP send in a window?
How many successful requests can this group make?
```

They do not answer:

```text
How many requests are currently occupying the same upstream GPU pool?
How many requests are waiting before this request can enter upstream?
Which channel/model is building up queue pressure?
Did traffic spike because of one channel, one model, or one group?
```

This feature should therefore be treated as admission control:

```text
Before entering upstream:
  if running < max_inflight -> dispatch
  else if queue has room -> wait
  else -> reject
```

## 3. Terminology

| Term | Meaning |
|---|---|
| Channel | Existing new-api channel record. It stores type, base URL, key, models, mappings, settings, etc. |
| Upstream URL | The base URL configured on a channel or default channel base URL. It is an input signal, not the source of truth for pooling. |
| Upstream model | The model actually sent to the provider after model mapping. |
| Flow Pool | A logical/physical upstream capacity pool. Example: "96-card DeepSeek-R1 production pool". |
| Pool key | Backend-generated stable key for runtime counters, for example `flow_pool_8f3a2c`. Users should not type it manually. |
| Binding | A relation between a flow pool and one or more channels, optionally narrowed to upstream models. |
| Fingerprint | A derived hint from channel type, normalized base URL, upstream model, and other provider-specific fields. It is used for recommendations only. |
| In-flight/running | Requests that already passed admission control and are currently occupying upstream capacity. |
| Queued | Requests waiting in the gateway before entering upstream. |
| Queue timeout | Maximum time a request may wait before the gateway returns an error. |

## 4. External Research

The market trend is that LLM gateways increasingly support more than request-per-minute throttling. Mature systems often combine request windows, token windows, concurrency protection, budgets, and provider fallback.

### 4.1 LiteLLM Proxy

LiteLLM Proxy supports user/team/key/model budget and rate limit concepts such as RPM, TPM, and max parallel requests. It also has queueing/prioritization capabilities in its scheduler.

References:

- https://docs.litellm.ai/docs/proxy/users
- https://docs.litellm.ai/docs/routing-load-balancing
- https://docs.litellm.ai/docs/scheduler

Takeaway for new-api:

- Keep tenant/user limits separate from upstream capacity limits.
- Queueing should be explicit and observable.
- Redis or another shared backend is needed for multi-instance deployments.

### 4.2 Kong AI Gateway

Kong AI Rate Limiting Advanced focuses on AI-aware rate limiting, including token-aware cost calculation and different counter strategies such as local, cluster, and Redis.

Reference:

- https://docs.konghq.com/hub/kong-inc/ai-rate-limiting-advanced/

Takeaway for new-api:

- Production-grade gateway limits must define the storage consistency model.
- Local counters are not enough when multiple gateway instances serve the same upstream pool.

### 4.3 APISIX AI Gateway

APISIX has AI rate limiting support around LLM token dimensions such as total, prompt, and completion tokens. It can also work with upstream instance/fallback behavior.

Reference:

- https://apisix.apache.org/docs/apisix/plugins/ai-rate-limiting/

Takeaway for new-api:

- Rate limiting and routing/fallback need to interact.
- If one upstream instance is saturated, the gateway can either queue on it, choose another instance, or reject.

### 4.4 Envoy AI Gateway

Envoy AI Gateway uses Envoy/Gateway API concepts and supports provider fallback and usage-based rate limiting in a Kubernetes-oriented architecture.

References:

- https://aigateway.envoyproxy.io/docs/capabilities/
- https://aigateway.envoyproxy.io/docs/capabilities/traffic/provider-fallback
- https://aigateway.envoyproxy.io/docs/capabilities/traffic/usage-based-ratelimiting

Takeaway for new-api:

- Capacity control is naturally tied to backend/provider identity.
- Explicit backend identity is better than inferring everything from URL strings.

### 4.5 Azure API Management GenAI Gateway

Azure API Management provides GenAI gateway policies such as token limits and token metrics for Azure OpenAI and related LLM traffic.

References:

- https://learn.microsoft.com/en-us/azure/api-management/genai-gateway-capabilities
- https://learn.microsoft.com/en-us/azure/api-management/azure-openai-token-limit-policy

Takeaway for new-api:

- Token limits are useful but separate from concurrent GPU occupancy.
- The gateway should expose metrics for admin troubleshooting.

### 4.6 Portkey AI Gateway

Portkey supports virtual keys, provider/integration limits, load balancing, fallback, and retry behaviors.

References:

- https://portkey.ai/docs/product/ai-gateway/virtual-keys/rate-limits
- https://portkey.ai/docs/product/ai-gateway/load-balancing
- https://portkey.ai/docs/product/ai-gateway/fallbacks

Takeaway for new-api:

- Provider-level controls and fallback policies are part of the admin product surface.
- The UI should make limit ownership clear.

### 4.7 Cloudflare AI Gateway

Cloudflare AI Gateway supports gateway-level rate limiting with fixed/sliding window policies.

Reference:

- https://developers.cloudflare.com/ai-gateway/configuration/rate-limiting/

Takeaway for new-api:

- Simple request-window throttling is useful, but insufficient for upstream GPU pool capacity.

## 5. Local Reference: gateway Project

The gateway project at `../boom-gateway/` implements a closely related flow control pattern.

Relevant files:

- `../boom-gateway/config.example.yaml`
- `../boom-gateway/boom-config/src/lib.rs`
- `../boom-gateway/boom-flowcontrol/src/lib.rs`
- `../boom-gateway/boom-main/src/routes.rs`
- `../boom-gateway/boom-main/src/state.rs`
- `../boom-gateway/boom-routing/src/policy/load_helpers.rs`
- `../boom-gateway/boom-dashboard/src/handlers_admin.rs`

### 5.1 What gateway Does Well

The gateway project has a `FlowController` and per-deployment slots. Its flow control configuration uses a deployment identity:

```yaml
model_info:
  id: gpt4o-node-1
flow_control:
  model_queue_limit: 50
  model_context_limit: 5000000
```

Important design points:

- `model_queue_limit` is actually max in-flight concurrency, not max queue length.
- A deployment slot maintains two queues, VIP and normal.
- The queue itself is the source of truth.
- `dispatched = true` means in-flight.
- `dispatched = false` means waiting.
- This avoids maintaining separate counters that can leak.
- `FlowControlGuard` releases capacity on drop.
- `FlowControlledStream` releases capacity when stream ends.
- The dashboard exposes in-flight and queued status.
- Routing can consider total load: in-flight plus queued.

### 5.2 Gaps in gateway Relevant to new-api

The gateway implementation is a strong reference but not a complete target for new-api:

| Area | gateway behavior | Recommended new-api behavior |
|---|---|---|
| Queue length | No explicit max queue size found | Must support `max_queue_size` |
| Queue timeout | Fixed 1200 seconds in route code | Per-pool configurable `queue_timeout_ms` |
| Storage | In-process memory | Memory backend for single instance, Redis backend for production |
| Pool identity | `deployment_id` | Flow Pool with generated `pool_key` and admin-visible name |
| URL binding | Deployment config based | Explicit binding table plus URL/model fingerprint suggestions |
| Multi-instance | Local process only | Redis lease/semaphore for global capacity |

new-api should borrow the "queue as source of truth" idea, but add bounded queue, configurable timeout, explicit resource-pool management, and metrics storage.

## 6. Current new-api Capability Review

### 6.1 Existing Rate Limits and Protections

| Feature | Granularity | Implementation |
|---|---|---|
| Global web limit | IP | `middleware/rate-limit.go` |
| Global API limit | IP | `middleware/rate-limit.go` |
| Critical endpoint limit | IP | `middleware/rate-limit.go` |
| Upload/download limit | IP | `middleware/rate-limit.go` |
| Search limit | authenticated user ID | `middleware/rate-limit.go` |
| Email verification limit | IP | `middleware/email-verification-rate-limit.go` |
| Model request limit | user ID, group override | `middleware/model-rate-limit.go`, `setting/rate_limit.go` |
| User/token/subscription quota | user/token/subscription | `service/billing.go`, `service/billing_session.go`, `service/quota.go` |
| System overload protection | process/system | `middleware/performance.go` |
| Notification send limit | user and notification type | `service/notify-limit.go` |

### 6.2 Existing Routing and Channel Points

Important existing files:

- `router/relay-router.go`
- `middleware/distributor.go`
- `controller/relay.go`
- `model/channel.go`
- `dto/channel_settings.go`

Current relevant behavior:

- `/v1` and `/v1beta` use `ModelRequestRateLimit`.
- `/mj` and `/suno` do not currently use `ModelRequestRateLimit`.
- `Distribute()` selects a channel.
- `SetupContextForSelectedChannel()` stores channel metadata in context and selects multi-key key/index.
- `controller/relay.go` has retry loops for normal relay and task relay.
- `Channel` already has JSON fields `Setting` and `OtherSettings`.
- `ChannelInfo` supports multi-key status and random/polling key selection.

### 6.3 Current Gap

new-api currently does not have:

- Channel-level max in-flight control.
- Shared resource-pool control across multiple channels.
- Per-channel or per-pool waiting queue.
- Configurable queue timeout.
- Configurable queue length.
- Stream/WebSocket-aware flow-control guard.
- Redis-based distributed semaphore/queue for upstream capacity.
- In-flight and queue trend charts.
- Flow-control event tracing.

## 7. Design Goals

### 7.1 Goals

1. Cap upstream concurrency for a logical upstream resource pool.
2. Queue excess requests in a bounded FIFO queue.
3. Avoid sending more requests to upstream than the configured capacity.
4. Support multiple channels sharing the same upstream resource pool.
5. Support optional upstream-model-specific bindings.
6. Support normal HTTP, streaming, realtime/WebSocket, and task relay with correct release timing.
7. Provide real-time status and historical trend charts.
8. Provide admin-friendly configuration in the web UI.
9. Support single-instance memory mode and production Redis mode.
10. Keep existing user rate limits and billing quota behavior separate.

### 7.2 Non-goals for the First Version

The first version should not try to solve every traffic-shaping problem:

- No complex weighted fair queueing.
- No full TPM token bucket implementation.
- No automatic GPU utilization integration.
- No automatic pool discovery from URLs without admin confirmation.
- No cross-region active-active queueing.
- No model-specific dynamic autoscaling.

These can be later phases.

## 8. Product Model: Flow Pool

### 8.1 Why Users Should Not Type `pool_id`

A raw `pool_id` is an implementation detail. Asking users to type it leads to confusion:

```text
Where does this ID come from?
Is it the channel ID?
Is it the upstream URL?
Is it the model name?
Is it provided by the upstream?
```

The product should expose:

```text
Flow Pool name: 96-card DeepSeek-R1 production pool
Flow Pool bindings: channels and upstream models
Flow Pool capacity: 60 concurrent requests
Queue: 240 requests, 120 seconds timeout
```

The backend should generate:

```text
pool_key: flow_pool_8f3a2c...
```

This key is used in Redis/runtime storage, logs, metrics, and internal APIs.

### 8.2 How Flow Pool Relates to Channel and URL

The binding must be explicit. URL matching can only be a recommendation.

Why URL alone is unsafe:

- Same base URL may serve multiple independent model pools.
- Same base URL plus different API keys may map to different upstream tenants.
- Same physical pool may be available under multiple URLs.
- Azure-like providers need deployment names and API versions.
- Model mapping can change the actual upstream model.
- A private OpenAI-compatible gateway may multiplex different GPU pools behind one URL.

Recommended binding truth:

```text
Flow Pool -> channel_id
Flow Pool -> optional upstream_model
```

Runtime resolution priority:

```text
1. Exact binding: channel_id + upstream_model
2. Channel binding: channel_id
3. No binding: no flow control, unless admin explicitly selected "independent channel pool"
```

URL/model fingerprint is only used to recommend a binding:

```text
fingerprint = hash(channel_type + normalized_base_url + upstream_model + provider_specific_identity)
```

Admin UI may show:

```text
Detected 3 channels with similar upstream identity. Bind them to the same Flow Pool?
```

But it should not silently merge them.

## 9. Web Admin UX Design

new-api default frontend already has a channels module under:

```text
web/default/src/features/channels
```

Channel create/update is handled by:

```text
web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx
```

The current drawer has sections such as Basic, API Access, Models, and Advanced Settings. The flow-control UI should fit into this existing pattern.

### 9.1 Channel Edit Drawer

Add a new section under Advanced Settings:

```text
Advanced Settings
  - Routing & Overrides
  - Flow Control & Queue
  - Request Overrides
  - Upstream Model Automation
```

Suggested section content:

```text
[Switch] Enable flow control and queue

Resource pool
  [Radio] This channel uses an independent pool
          Runtime key is generated from channel ID after save.

  [Radio] Bind to an existing Flow Pool
          [Select] 96-card DeepSeek-R1 production pool
          Summary: 60 in-flight / queue 240 / timeout 120s / 4 bound channels

  [Radio] Create a new Flow Pool
          Name: 96-card DeepSeek-R1 production pool
          Max in-flight requests: 60
          Max queue size: 240
          Queue timeout: 120 seconds
          Queue policy: FIFO

Binding scope
  [Radio] All models on this channel
  [Radio] Only selected upstream models
          [Multi-select] deepseek-r1, deepseek-v3

Upstream identity preview
  Channel type: OpenAI Compatible
  Base URL: https://example.com/v1
  Published models: deepseek-r1, deepseek-v3
  Upstream model mapping: deepseek-r1 -> deepseek-r1-prod
  Suggested fingerprint: openai-compatible / example.com / deepseek-r1-prod
```

UX rule:

- The raw `pool_key` should not be the main user-facing field.
- Advanced users may see it in a read-only details drawer for debugging.

### 9.2 Flow Pools Management Page

Add a tab or subpage under Channels:

```text
Channels | Flow Pools
```

List view:

```text
Name                         Bound channels  In-flight   Queue       Wait P95   Rejected/Timeout  Status
96-card R1 production pool   4               48 / 60     132 / 240   18.4s      2 / 7             Congested
Qwen-VL backup pool          1               6 / 20      0 / 80      0.2s       0 / 0             Healthy
```

Detail view:

```text
Basic
  Name
  Description
  Enabled
  Generated pool key, read-only

Capacity
  Max in-flight requests
  Max queue size
  Queue timeout
  Queue policy
  Optional max in-flight context tokens/chars

Bindings
  Channel
  Channel type
  Base URL
  Upstream model
  Binding mode

Realtime Status
  Running
  Queued
  Oldest waiting seconds
  Utilization

Trends
  In-flight requests
  Queued requests
  Wait duration P50/P95/P99
  Processing duration P50/P95/P99
  Rejections and timeouts
```

### 9.3 In-channel Status Entry

In the channel table, add a compact indicator:

```text
Flow: 48/60 running, 132 queued
```

Clicking it opens the Flow Pool detail.

### 9.4 User-facing Error Messages

When queue is full:

```json
{
  "error": {
    "message": "The upstream resource pool is busy. The waiting queue is full. Please retry later.",
    "type": "rate_limit_error",
    "code": "channel_flow_queue_full"
  }
}
```

When queue times out:

```json
{
  "error": {
    "message": "The upstream resource pool is busy. The request waited too long in queue.",
    "type": "rate_limit_error",
    "code": "channel_flow_queue_timeout"
  }
}
```

Recommended HTTP status:

```text
429 for queue full and queue timeout
503 only for system overload or disabled upstream capacity
```

## 10. Backend Data Model

Use GORM-compatible models and migrations. Keep SQLite, MySQL, and PostgreSQL compatibility.

### 10.1 Flow Pool Table

Suggested table: `channel_flow_pools`

```text
id                  int primary key
pool_key            varchar unique, generated by backend
name                varchar
description         text
enabled             bool/int
max_inflight        int
max_queue_size      int
queue_timeout_ms    int
queue_policy        varchar, default "fifo"
max_context_tokens  int, optional
max_context_chars   int, optional
on_limit            varchar, default "queue"
created_time        bigint
updated_time        bigint
```

Notes:

- `pool_key` is not user-provided.
- `max_queue_size` should be required when enabled.
- `max_inflight` must be greater than 0 when enabled.
- `queue_timeout_ms` must be bounded by system max to avoid extremely long connection retention.
- Use plain text/varchar fields and GORM abstractions for cross-database compatibility.

### 10.2 Binding Table

Suggested table: `channel_flow_pool_bindings`

```text
id                  int primary key
pool_id             int
channel_id          int
upstream_model      varchar, optional
match_mode          varchar, "channel" | "channel_model"
enabled             bool/int
created_time        bigint
updated_time        bigint
```

Resolution:

```text
if binding exists for channel_id + upstream_model:
    use that pool
else if binding exists for channel_id:
    use that pool
else:
    pass through without flow control
```

If the admin selects "independent pool for this channel", the backend creates a pool and a binding for that channel.

### 10.3 Metrics Aggregate Table

Suggested table: `channel_flow_metrics_minute`

```text
id                    int primary key
bucket_ts             bigint
pool_key              varchar
channel_id            int
model                 varchar
running_avg           double/integer approximation
running_max           int
queued_avg            double/integer approximation
queued_max            int
acquired_count        int
queued_count          int
released_count        int
rejected_count        int
timeout_count         int
cancelled_count       int
wait_ms_p50           int
wait_ms_p95           int
wait_ms_p99           int
process_ms_p50        int
process_ms_p95        int
process_ms_p99        int
created_time          bigint
updated_time          bigint
```

For cross-database simplicity:

- Avoid JSONB.
- Avoid database-specific percentile functions.
- Compute percentiles in memory before writing aggregate rows.

### 10.4 Optional Event Trace Store

For traffic tracing, minute-level metrics are not enough. Add a bounded event log:

```text
channel_flow_events
  id
  request_id
  pool_key
  channel_id
  model
  event_type     enter_queue | dispatch | release | reject | timeout | cancel
  reason
  queue_pos
  running
  queued
  wait_ms
  process_ms
  created_time
```

This table can become large. Options:

- Keep only error/timeout/reject events in DB.
- Keep full recent events in Redis with TTL.
- Add a system option to enable full event tracing temporarily.

Recommended first version:

```text
Always aggregate metrics.
Always store reject and timeout events.
Store dispatch/release events only when debug tracing is enabled.
```

## 11. Runtime Flow

### 11.1 Insertion Point

The flow controller should run after channel selection and before upstream call.

Current normal relay loop is in:

```text
controller/relay.go
```

Proposed position:

```text
for retry:
    channel = getChannel(...)
    acquire flow control guard
    call upstream
    release guard when done
```

The flow controller should not live inside `ModelRequestRateLimit`. User rate limits and upstream capacity control are different concerns.

### 11.2 Request Metadata Needed

Acquire needs:

```text
request_id
user_id
group
token_id
channel_id
channel_name
channel_type
is_multi_key
multi_key_index
origin_model
upstream_model
is_stream
estimated_prompt_tokens
estimated_context_chars
```

### 11.3 Pool Resolution

Pseudo-code:

```go
func ResolveFlowPool(channelID int, upstreamModel string) (*FlowPool, bool) {
    if binding := findBinding(channelID, upstreamModel); binding != nil {
        return binding.Pool, true
    }
    if binding := findChannelBinding(channelID); binding != nil {
        return binding.Pool, true
    }
    return nil, false
}
```

If no pool is resolved, the request passes through without channel flow control.

### 11.4 Acquire Algorithm

```text
Input:
  pool_key
  request_id
  context cost
  timeout
  max_inflight
  max_queue_size

Algorithm:
  1. If pool disabled -> pass through or reject based on config.
  2. If request context exceeds max_context -> reject immediately.
  3. If running < max_inflight -> mark dispatched and return guard.
  4. If waiting >= max_queue_size -> reject with 429 queue_full.
  5. Enqueue request.
  6. Wait until dispatched, client cancels, or timeout occurs.
  7. On dispatch -> return guard.
  8. On cancellation -> remove from queue.
  9. On timeout -> remove from queue, return 429 queue_timeout.
```

### 11.5 Release Algorithm

```text
On request completion:
  1. Remove dispatched request from running state.
  2. Record processing duration.
  3. Dispatch next fitting request from queue.
  4. Record metrics.
```

### 11.6 Stream and WebSocket Release

For streaming:

```text
Acquire before upstream stream starts.
Hold guard while stream is open.
Release when stream ends or client disconnects.
```

For realtime/WebSocket:

```text
Acquire before upstream realtime connection.
Hold guard while WebSocket is active.
Release on close/error/cancel.
```

This mirrors the good part of the gateway project's `FlowControlledStream`.

### 11.7 Task Relay Release Policy

Async task routes need special handling.

There are two possible upstream semantics:

```text
submit_only:
  Upstream only accepts the task and queues/processes it internally.
  Gateway slot can release after submit response returns.

occupies_until_finished:
  Upstream task occupies GPU capacity until task finishes.
  Gateway slot must remain held until task reaches terminal status.
```

Add per-pool or per-channel option:

```text
task_release_policy: "on_submit" | "on_task_finish"
```

Default should be `on_submit` for compatibility, but for a private 96-GPU pool the admin may need `on_task_finish`.

## 12. Backend Implementation Options

### 12.1 Memory Backend

Memory backend is useful for:

- Development.
- Single-instance deployments.
- Redis-disabled installations.

Design:

```text
map[pool_key]*Slot
Slot:
  mutex
  max_inflight
  max_queue_size
  max_context
  queue []RequestState

RequestState:
  request_id
  dispatched bool
  context cost
  enqueue time
  dispatch time
  notify channel
```

The queue should be the source of truth:

```text
dispatched == true  -> in-flight
dispatched == false -> waiting
```

Do not maintain an independent `running` counter if it can be derived from the queue. This avoids counter leaks.

### 12.2 Redis Backend

Redis backend is required for multi-instance production.

Reason:

```text
If 3 gateway instances each enforce max_inflight=60 locally,
the upstream may receive 180 concurrent requests.
```

Suggested Redis keys:

```text
flow:{pool_key}:running       ZSET request_id -> lease_expire_ms
flow:{pool_key}:waiting       ZSET request_id -> sequence or enqueue time
flow:{pool_key}:request:{id}  HASH request metadata, TTL
flow:{pool_key}:seq           INCR sequence
flow:{pool_key}:notify        Pub/Sub or stream for wakeups
```

Acquire should be Lua-backed:

```text
1. Remove expired running leases.
2. If running count < max_inflight:
      add to running with lease
      return acquired
3. If waiting count >= max_queue_size:
      return queue_full
4. Add to waiting queue.
5. Return queued with sequence.
```

Wait loop:

```text
The waiter polls or waits for Pub/Sub notification.
Only queue head can move to running.
If timeout/cancel:
    remove from waiting.
```

Release script:

```text
1. Remove request from running.
2. Move as many waiting head items as fit into running.
3. Publish wakeup events.
```

Lease handling:

- Non-streaming requests can use a lease slightly longer than request timeout.
- Streaming/WebSocket requests need heartbeat renewal.
- If an instance crashes, leases expire and slots recover.

### 12.3 Redis vs Memory Behavior

| Area | Memory | Redis |
|---|---|---|
| Single instance | Good | Good |
| Multiple instances | Incorrect global capacity | Correct global capacity |
| Crash recovery | Lost state | Lease recovery |
| Implementation complexity | Lower | Higher |
| Recommended production default | No | Yes |

## 13. Queue Length: Why It Must Have an Upper Bound

Queue length should never be infinite.

Risks of unbounded queues:

- Gateway memory grows with request bodies and waiting contexts.
- HTTP connections remain open for a long time.
- Client timeouts cause cancellation churn.
- Retries amplify pressure.
- Waiting time becomes unbounded and user experience degrades.
- Admin cannot reason about worst-case capacity.

Recommended default:

```text
max_queue_size = max_inflight * 4
queue_timeout_ms = 120000
```

For the 60-concurrency scenario:

```text
max_inflight = 60
max_queue_size = 240
queue_timeout_ms = 120000
```

Sizing formula:

```text
upstream throughput ~= max_inflight / average_processing_seconds
reasonable queue size ~= upstream throughput * max_acceptable_wait_seconds
```

Example:

```text
max_inflight = 60
average processing time = 30s
throughput ~= 2 requests/s
acceptable wait = 120s
queue size ~= 240
```

UI should not allow `max_queue_size = unlimited`. If administrators need larger queues, they should explicitly raise the number.

## 14. Retry and Fallback Interaction

Flow control must define how it interacts with retry and channel fallback.

Recommended `on_limit` policies:

| Policy | Behavior | Use case |
|---|---|---|
| queue | Wait in the selected pool queue. | Single upstream pool, capacity must be preserved. |
| reject | Return 429 immediately when full. | Low-latency APIs. |
| fallback | Treat full pool as unavailable and try another channel. | Multiple equivalent upstream pools. |
| fallback_then_queue | Try other pools first, queue only if all candidates are full. | Multiple pools with shared SLA. |

For the 96-GPU/60-concurrency scenario, recommended default:

```text
on_limit = queue
```

If there are several equivalent GPU pools, use:

```text
on_limit = fallback_then_queue
```

## 15. Metrics, Trend Charts, and Traceability

### 15.1 Real-time Metrics

Expose real-time status per pool:

```text
running
max_inflight
queued
max_queue_size
oldest_wait_ms
utilization = running / max_inflight
queue_utilization = queued / max_queue_size
```

API example:

```text
GET /api/channel_flow/pools/:id/status
```

Response:

```json
{
  "pool_key": "flow_pool_8f3a2c",
  "name": "96-card DeepSeek-R1 production pool",
  "running": 48,
  "max_inflight": 60,
  "queued": 132,
  "max_queue_size": 240,
  "oldest_wait_ms": 18400,
  "utilization": 0.8,
  "queue_utilization": 0.55
}
```

### 15.2 Historical Metrics

Minute-level aggregation should support:

- In-flight trend.
- Queue depth trend.
- Wait duration percentiles.
- Processing duration percentiles.
- Rejected and timeout trend.
- Per-channel contribution.
- Per-model contribution.
- Per-group contribution if available.

API examples:

```text
GET /api/channel_flow/pools/:id/metrics?from=...&to=...&bucket=minute
GET /api/channel_flow/pools/:id/events?limit=200&type=timeout,reject
```

### 15.3 Dashboard Charts

Recommended charts:

1. In-flight requests:

```text
line: running
horizontal line: max_inflight
```

2. Queue depth:

```text
line: queued
horizontal line: max_queue_size
```

3. Wait duration:

```text
lines: p50, p95, p99
```

4. Processing duration:

```text
lines: p50, p95, p99
```

5. Rejections and timeouts:

```text
stacked bars:
  queue_full
  queue_timeout
  context_exceeded
  cancelled
```

6. Top contributors:

```text
by channel
by upstream model
by user group
```

### 15.4 Traceability

Every request that enters flow control should have a `request_id`.

For review/debugging, trace events should show:

```text
request_id
pool
channel
model
event timeline:
  enter_queue at T1
  dispatch at T2
  release at T3
wait_ms = T2 - T1
process_ms = T3 - T2
```

Recommended default storage:

- Always store aggregate metrics.
- Store reject and timeout events in DB.
- Store recent detailed events in Redis with TTL.
- Add admin switch for temporary full tracing.

## 16. API Design

### 16.1 Flow Pool CRUD

```text
GET    /api/channel_flow/pools
POST   /api/channel_flow/pools
GET    /api/channel_flow/pools/:id
PUT    /api/channel_flow/pools/:id
DELETE /api/channel_flow/pools/:id
```

Create request:

```json
{
  "name": "96-card DeepSeek-R1 production pool",
  "description": "Private upstream cluster A",
  "enabled": true,
  "max_inflight": 60,
  "max_queue_size": 240,
  "queue_timeout_ms": 120000,
  "queue_policy": "fifo",
  "max_context_tokens": 0,
  "on_limit": "queue"
}
```

Response includes generated `pool_key`:

```json
{
  "id": 1,
  "pool_key": "flow_pool_8f3a2c",
  "name": "96-card DeepSeek-R1 production pool"
}
```

### 16.2 Bindings

```text
GET    /api/channel_flow/pools/:id/bindings
POST   /api/channel_flow/pools/:id/bindings
DELETE /api/channel_flow/bindings/:id
```

Create binding:

```json
{
  "channel_id": 123,
  "match_mode": "channel_model",
  "upstream_model": "deepseek-r1-prod"
}
```

### 16.3 Suggestions

```text
GET /api/channel_flow/suggestions?channel_id=123
```

Response:

```json
{
  "channel_id": 123,
  "base_url": "https://example.com/v1",
  "suggested_fingerprint": "openai-compatible/example.com/deepseek-r1-prod",
  "similar_channels": [
    {
      "channel_id": 124,
      "name": "R1 backup key",
      "base_url": "https://example.com/v1",
      "models": ["deepseek-r1"]
    }
  ]
}
```

This API should not auto-bind. It only helps administrators avoid misconfiguration.

### 16.4 Status and Metrics

```text
GET /api/channel_flow/pools/:id/status
GET /api/channel_flow/pools/:id/metrics
GET /api/channel_flow/pools/:id/events
```

## 17. Integration With new-api Files

Suggested backend additions:

```text
dto/channel_flow.go
model/channel_flow_pool.go
model/channel_flow_binding.go
model/channel_flow_metric.go
service/channel_flow/
  controller.go
  memory_backend.go
  redis_backend.go
  metrics.go
controller/channel_flow.go
router/api-router.go
```

Suggested frontend additions:

```text
web/default/src/features/channels/components/drawers/sections/channel-flow-control-section.tsx
web/default/src/features/channels/components/dialogs/flow-pool-detail-dialog.tsx
web/default/src/features/channels/components/flow-pools-table.tsx
web/default/src/features/channels/hooks/use-channel-flow-pools.ts
web/default/src/features/channels/lib/channel-flow.ts
```

Existing form integration points:

```text
web/default/src/features/channels/lib/channel-form.ts
web/default/src/features/channels/components/drawers/channel-mutate-drawer.tsx
web/default/src/features/channels/types.ts
```

Do not force users to edit raw JSON settings for flow control.

## 18. Validation Rules

Backend validation:

```text
name: required
max_inflight: required and > 0 when enabled
max_queue_size: required and >= 0
queue_timeout_ms: required and between 1000 and configured system max
queue_policy: fifo for v1
on_limit: queue | reject | fallback | fallback_then_queue
```

Recommended hard caps:

```text
max_inflight <= 100000
max_queue_size <= 100000
queue_timeout_ms <= 3600000
```

UI validation:

```text
If max_inflight = 60, suggest max_queue_size = 240.
Warn if queue size > max_inflight * 10.
Warn if queue timeout > client timeout.
Warn if multiple pools appear to bind the same channel/model.
Warn if similar URLs are not bound together.
```

## 19. Failure Modes and Safeguards

| Failure | Safeguard |
|---|---|
| Request cancelled while waiting | Remove from queue in cleanup. |
| Request cancelled while streaming | Drop guard and release slot. |
| Gateway instance crashes | Redis lease expires running entry. |
| Queue grows too large | `max_queue_size` hard cap. |
| Wait too long | `queue_timeout_ms`. |
| Pool mis-bound by URL | Explicit bindings, URL only suggests. |
| Multiple gateway instances | Redis backend. |
| Metrics table grows too large | Retention policy and aggregation. |
| Admin reduces max_inflight below current running | Do not kill running requests; only stop new dispatch until running drops. |
| Admin disables pool | Existing running requests continue; new acquire rejects or passes according to policy. |

## 20. Implementation Roadmap

### Phase 1: Single-instance MVP

- Add Flow Pool and Binding models.
- Add admin APIs.
- Add memory backend.
- Add acquire/release around normal relay.
- Add stream-safe release.
- Add queue length and timeout.
- Add real-time status API.
- Add basic UI in channel edit drawer.

### Phase 2: Metrics and Dashboard

- Add minute-level metrics aggregation.
- Add flow pool list and detail page.
- Add in-flight and queue trend charts.
- Add reject/timeout event list.
- Add channel table flow-status indicator.

### Phase 3: Redis Production Backend

- Add Redis Lua scripts.
- Add distributed running lease.
- Add waiting queue and wakeup mechanism.
- Add stream heartbeat lease renewal.
- Add crash recovery tests.

### Phase 4: Advanced Routing

- Add `fallback` and `fallback_then_queue`.
- Make channel selection aware of pool load.
- Add pool utilization to routing decision.
- Add optional VIP priority.

### Phase 5: Token/Context Enhancements

- Add max in-flight context tokens/chars.
- Add TPM-like token window if needed.
- Add per-model or per-group overrides inside a pool.

## 21. Test Plan

### 21.1 Unit Tests

- Acquire dispatches immediately when capacity exists.
- Acquire queues when capacity full.
- Queue full rejects.
- Queue timeout removes waiting request.
- Cancellation removes waiting request.
- Release dispatches next request.
- Admin lowering max_inflight does not corrupt state.
- Context-exceeded request rejects immediately.

### 21.2 Integration Tests

- 100 concurrent requests with `max_inflight = 60` never dispatch more than 60 upstream calls.
- Stream request holds slot until stream ends.
- Client disconnect releases slot.
- Queue order is FIFO.
- Metrics record running max and queued max correctly.
- Retry/fallback policies behave as configured.

### 21.3 Redis Tests

- Multiple processes share the same max_inflight.
- Running lease expires after simulated crash.
- Heartbeat keeps long stream alive.
- Release wakes queued requests.
- Timeout removes waiting request atomically.

### 21.4 UI Tests

- Create Flow Pool from channel drawer.
- Bind channel to existing Flow Pool.
- Bind channel + upstream model to Flow Pool.
- Suggested similar channels are shown but not auto-bound.
- Trend chart renders when metrics exist.
- Validation warnings appear for risky queue values.

## 22. Open Questions for Review

1. Should the default when no binding exists be "no flow control" or "auto independent channel pool"?
   - Recommendation: no flow control unless explicitly enabled.

2. Should queue timeout return 429 or 503?
   - Recommendation: 429 for flow-control pressure, 503 for system overload.

3. Should async task slots be released on submit or task finish?
   - Recommendation: make it configurable by pool/channel.

4. Should `max_context_tokens` use estimated prompt tokens or raw input chars in v1?
   - Recommendation: start with input chars or estimated prompt tokens already available in relay; refine later.

5. Should Redis backend be required when Redis is enabled globally?
   - Recommendation: yes, if Redis is enabled use Redis backend for flow control.

6. Should VIP priority be included in v1?
   - Recommendation: not in MVP unless there is an immediate product requirement.

7. Should flow pool config live in DB tables or channel JSON settings?
   - Recommendation: DB tables, because shared pools cannot be safely represented by per-channel JSON.

## 23. Recommended Decision

Implement channel flow control as a first-class Flow Pool feature.

Do not expose raw `pool_id` as a user-filled field. The admin creates/selects a Flow Pool by name, binds channels and optional upstream models, and the backend generates a stable runtime `pool_key`.

Use explicit bindings as the source of truth. Use URL/upstream model fingerprints only for suggestions and warnings.

For the first usable release, implement:

```text
Flow Pool CRUD
Channel/model bindings
max_inflight
max_queue_size
queue_timeout_ms
FIFO queue
normal and stream release
real-time status
minute trend metrics
basic dashboard charts
```

For production safety, add Redis backend before recommending this for multi-instance deployments.

## 24. Reviewer Checklist

Use this checklist when reviewing the design:

- Does the design protect a 96-GPU upstream with a strict 60-concurrency cap?
- Does it avoid relying on URL-only inference?
- Is the origin of pool identity clear?
- Can multiple channels share the same upstream capacity pool?
- Is the queue bounded?
- Is queue timeout configurable?
- Does stream/WebSocket release happen at the correct time?
- Does the design work in multi-instance deployments?
- Can administrators configure it from the web UI without editing raw JSON?
- Can administrators see in-flight and queued trends?
- Can operators trace queue-full and queue-timeout events?
- Are DB changes compatible with SQLite, MySQL, and PostgreSQL?
