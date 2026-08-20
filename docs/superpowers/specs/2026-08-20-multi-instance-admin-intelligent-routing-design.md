# Multi-Instance Administrator Intelligent Routing Backend Design

## Status

- Date: 2026-08-20
- Scope: administrator control plane, shared runtime state, observability, and operations for intelligent routing
- Runtime: Go, Gin, GORM, Redis
- Database compatibility: SQLite, MySQL 5.7.8+, PostgreSQL 9.6+

## Objective

Turn the existing intelligent-routing execution core into a production-ready administrator subsystem that works consistently across multiple backend instances.

The subsystem must let an administrator:

1. create, validate, publish, stage, and roll back immutable routing policies;
2. run shadow or live policies for selected user groups, token groups, and deterministic traffic percentages;
3. inspect shared channel health, model-task quality, route outcomes, real costs, and savings;
4. simulate a request against a draft policy and replay bounded historical samples before publication;
5. isolate or restore a channel and clear shared runtime state;
6. query and acknowledge operational events;
7. retain stable routing behavior when Redis or a database dependency is unavailable.

The design preserves the current request-facing contract: clients continue to see their requested model, while billing uses the successful execution model and routing details remain administrator-only.

## Existing System

The repository already contains:

- deterministic task classification and candidate planning;
- capability, context, quality, health, and cost filtering;
- bounded multi-attempt execution and response validation;
- in-process health, quality, stickiness, and planning metrics;
- per-request routing detail under `other.admin_info.intelligent_routing`;
- a global `intelligent_routing_setting` configuration object;
- shadow/live execution controlled by global settings.

The missing production controls are policy history, scoped rollout, multi-instance state, administrator query APIs, manual operations, durable events, actual-cost reporting, and safe dependency degradation.

## Architecture

The subsystem is divided into four packages with narrow responsibilities.

### Policy Control

Policy Control owns drafts, validation, immutable published versions, rollout targeting, and rollback. It stores durable state in the primary database and publishes invalidation messages through Redis after a successful database commit.

Each backend instance keeps a read-only in-memory snapshot of the active rollout and referenced policy. Instances refresh the snapshot when they receive an invalidation message and also poll the active revision periodically. Pub/Sub is only an acceleration mechanism; correctness does not depend on receiving every message.

### Runtime State

Runtime State owns request-path health windows, quality counters, session stickiness, deterministic rollout assignment, manual isolation, and short-lived metric counters.

Redis is authoritative for shared transient state when intelligent routing is enabled in multi-instance mode. Updates use atomic Redis commands or bounded Lua scripts. The implementation retains the current in-memory stores behind the same interfaces for tests and explicitly configured single-instance operation.

### Telemetry

Telemetry records per-request routing facts in the existing consume-log path and accumulates short-window counters in Redis. Queries combine Redis for current windows with database logs for historical windows.

Actual savings are calculated only after settlement:

```text
actual_saving = max(0, requested_model_baseline_charge - execution_model_charge)
```

The baseline uses the same token counts and billing conversion rules as settlement. Missing or invalid baseline pricing produces an unavailable saving value rather than a fabricated zero or negative credit.

### Admin Operations

Admin Operations exposes stable DTO-based APIs for policy management, simulation, replay, health control, quality inspection, metrics, and operational events. Every mutating endpoint requires root authorization and writes the existing operation audit record.

## Durable Data Model

All migrations use GORM and portable scalar columns. JSON documents use `TEXT`; no database-specific JSON operators are required.

### `intelligent_routing_policies`

| Field | Purpose |
|---|---|
| `id` | GORM-managed primary key |
| `version` | Unique, monotonically increasing published version; null or zero for drafts |
| `status` | `draft`, `active`, or `archived` |
| `config` | Canonical policy JSON stored as text |
| `checksum` | SHA-256 of canonical policy content |
| `source_version` | Version copied or rolled back from, when applicable |
| `change_note` | Administrator-supplied publication note |
| `created_by` | Administrator user ID |
| `published_by` | Publishing administrator user ID |
| `created_at` | Creation time |
| `updated_at` | Last draft update time |
| `published_at` | Publication time |

Published rows are immutable. Editing a published policy creates a new draft. Rollback creates and publishes a new version whose content matches the selected historical version; it never mutates history.

Publication uses a database transaction and `lockForUpdate(tx)` where a row lock is required. It archives the prior active policy, assigns the next version, activates the new policy, updates rollout references when requested, and commits before cache invalidation.

### `intelligent_routing_rollouts`

| Field | Purpose |
|---|---|
| `id` | GORM-managed primary key |
| `revision` | Monotonic optimistic-concurrency revision |
| `policy_version` | Published policy used by the rollout |
| `enabled` | Master rollout switch |
| `mode` | `shadow` or `live` |
| `traffic_percent` | Integer from 0 through 100 |
| `user_groups` | Canonical JSON string array |
| `token_groups` | Canonical JSON string array |
| `updated_by` | Administrator user ID |
| `started_at` | Activation time |
| `ended_at` | Disable time |
| `created_at` | Creation time |
| `updated_at` | Modification time |

Only one current rollout is active. Updates require the caller's last observed revision to prevent one administrator from overwriting another administrator's change.

### `intelligent_routing_events`

| Field | Purpose |
|---|---|
| `id` | GORM-managed primary key |
| `event_type` | Stable event identifier |
| `severity` | `info`, `warning`, or `critical` |
| `policy_version` | Associated version, if any |
| `channel_id` | Associated channel, if any |
| `dedupe_key` | Stable key for bounded event coalescing |
| `summary` | Short administrator-facing fallback text |
| `details` | Bounded JSON details stored as text |
| `occurrence_count` | Number of coalesced occurrences |
| `first_seen_at` | First occurrence |
| `last_seen_at` | Latest occurrence |
| `acknowledged_by` | Administrator user ID |
| `acknowledged_at` | Acknowledgement time |
| `resolved_at` | Resolution time |
| `created_at` | Creation time |
| `updated_at` | Modification time |

Events cover policy publication and rollback, automatic circuit opening and recovery, manual isolation and recovery, repeated no-route or budget exhaustion, Redis degradation, configuration refresh failure, and alert state changes.

## Policy Document

The durable policy extends the existing normalized routing configuration. It contains:

- policy version metadata;
- execution budgets and maximum attempts;
- task-specific quality thresholds;
- model policies and capabilities;
- alert thresholds;
- Redis failure behavior;
- telemetry retention limits.

Validation rejects:

- unknown task or capability identifiers;
- duplicate or empty model names;
- invalid tiers, prices, context limits, probabilities, durations, attempt counts, or multipliers;
- a live policy with no eligible candidate model;
- models missing compatible billing configuration;
- rollout percentages outside 0 through 100;
- group names that do not exist at validation time;
- documents exceeding the configured maximum serialized size.

Validation returns structured errors with field paths and stable codes so the frontend does not parse error strings.

## Rollout Resolution

For each supported request:

1. load the local immutable rollout snapshot;
2. stop if the rollout is disabled;
3. require a match when user-group or token-group allowlists are non-empty;
4. compute a stable bucket from deployment salt, account ID, token ID, and policy version;
5. include buckets lower than `traffic_percent`;
6. plan in shadow or live mode according to the rollout;
7. record the rollout revision and policy version in administrator audit data.

The stable bucket prevents requests from the same account and token from oscillating between treatment and control. Changing the policy version intentionally reassigns buckets, while rollout-only edits preserve assignments when the version is unchanged.

## Redis State

Redis keys are namespaced by deployment identifier and schema version. Raw session identifiers, prompts, token values, and user content are never embedded in keys.

### Channel health

Each channel stores a bounded rolling outcome window plus manual isolation metadata. Recording and pruning are atomic. Snapshots return tier, sample count, success count, failure rate, window bounds, isolation state, and last transition time.

Automatic circuit transitions emit a coalesced durable event asynchronously. Manual isolation always overrides automatic health until an administrator restores the channel.

### Model-task quality

Each model-task pair stores bounded successes and samples. Counts have an expiry and are periodically compacted to prevent unbounded keys. Predictions preserve the current cold-start prior and beta smoothing contract.

### Session stickiness

Sticky entries store model, channel, task, policy version, expected cost, validation failures, and expiry. Policy-version mismatch invalidates the entry. Two consecutive validation failures remove it atomically.

### Metrics

Time-bucketed hashes record planned routes, no-route outcomes, attempts, first-route successes, fallbacks, final failures, validation failures, estimated cost, actual charge, baseline charge, actual savings, and latency aggregates. Cardinality is bounded to approved dimensions: policy version, task, model, channel, outcome, and failure-code family.

## Dependency Failure Behavior

Correctness takes priority over routing optimization.

### Redis unavailable

- New requests do not execute live intelligent routing in multi-instance mode.
- Requests immediately use the existing channel selector and billing path.
- Shadow planning may run only when it cannot affect execution or billing.
- The instance emits a rate-limited warning and a durable event when the database is available.
- Recovery requires successful Redis health checks and a fresh policy snapshot before live routing resumes.

The system does not silently switch to per-instance health or stickiness because divergent instance state would make behavior inconsistent.

### Database unavailable

- Existing immutable policy snapshots remain usable for a bounded stale interval.
- No publication, rollout mutation, rollback, event acknowledgement, or manual channel operation succeeds.
- After the stale interval, live intelligent routing falls back to the existing selector.

### Configuration invalidation missed

Periodic revision polling detects a stale instance. An instance never applies an unvalidated policy document received from Redis.

## Administrator API

All routes are placed under `/api/intelligent-routing` and protected by `RootAuth()`.

### Overview and metrics

```text
GET /api/intelligent-routing/overview
GET /api/intelligent-routing/metrics
```

Overview returns active policy, rollout, dependency health, current alert count, route success summary, actual savings summary, and unhealthy channels. Metrics supports bounded time ranges and filters for policy version, mode, task, model, channel, outcome, and failure family.

### Policies

```text
GET    /api/intelligent-routing/policies
GET    /api/intelligent-routing/policies/:id
POST   /api/intelligent-routing/policies
PUT    /api/intelligent-routing/policies/:id
POST   /api/intelligent-routing/policies/:id/validate
POST   /api/intelligent-routing/policies/:id/publish
POST   /api/intelligent-routing/policies/:version/rollback
```

Draft updates use optimistic concurrency. Publication and rollback require a non-empty change note.

### Rollout

```text
GET /api/intelligent-routing/rollout
PUT /api/intelligent-routing/rollout
```

The update request includes the last observed revision. Enabling live mode requires a published policy and a successful current validation result.

### Simulation and replay

```text
POST /api/intelligent-routing/simulate
POST /api/intelligent-routing/replay
GET  /api/intelligent-routing/replay/:job_id
```

Simulation accepts a bounded request feature fixture and a draft or published policy identifier. It performs classification and planning without contacting an upstream provider or changing runtime statistics.

Replay creates a bounded asynchronous job over administrator-visible historical log samples. It returns aggregate eligibility, candidate choice, expected saving, and policy-difference results. It does not reconstruct or expose prompt content.

### Health and quality

```text
GET    /api/intelligent-routing/channels/health
POST   /api/intelligent-routing/channels/:id/isolate
POST   /api/intelligent-routing/channels/:id/recover
DELETE /api/intelligent-routing/channels/:id/state
GET    /api/intelligent-routing/quality
DELETE /api/intelligent-routing/quality/:model/:task
```

Manual operations require a reason and create both operation-audit and routing-event records.

### Events

```text
GET  /api/intelligent-routing/events
POST /api/intelligent-routing/events/:id/acknowledge
```

The list supports pagination, severity, type, acknowledgement state, policy version, channel, and time filters.

## API Response Rules

- Responses use explicit DTOs rather than database models or Redis structures.
- Validation errors include a stable `code`, `field`, and localized fallback message key.
- List endpoints enforce maximum page size and maximum time range.
- Model names and event detail strings are length-bounded.
- Redis keys, raw prompts, session fingerprints, tokens, and provider credentials are never returned.
- Mutations are idempotent where practical and reject stale revisions with HTTP 409.

## Audit

Existing administrator operation audit gains stable actions:

- `intelligent_routing.policy.create`
- `intelligent_routing.policy.update`
- `intelligent_routing.policy.publish`
- `intelligent_routing.policy.rollback`
- `intelligent_routing.rollout.update`
- `intelligent_routing.channel.isolate`
- `intelligent_routing.channel.recover`
- `intelligent_routing.channel.reset`
- `intelligent_routing.quality.reset`
- `intelligent_routing.event.acknowledge`

Audit parameters contain identifiers, versions, revisions, percentages, modes, affected groups, and administrator reasons. They do not contain secrets or request content.

## Security and Limits

- Every endpoint requires root authorization.
- All request bodies have explicit size limits.
- Replay concurrency, sample count, and date range are bounded.
- Simulation cannot invoke upstream providers.
- Mutation endpoints use optimistic concurrency and database transactions.
- Operational event details use an allowlisted schema and bounded strings.
- Redis Lua scripts receive typed scalar arguments and do not interpolate user input into script source.
- Metric cardinality excludes user ID, token ID, session ID, and arbitrary error text.

## Testing

### Unit tests

- policy normalization, canonicalization, checksum, and structured validation;
- stable rollout bucketing and group matching;
- Redis key construction and state serialization;
- health transitions, manual isolation precedence, expiry, and recovery;
- quality smoothing and atomic validation-failure invalidation;
- actual savings computation through checked quota helpers;
- DTO filtering, pagination bounds, and failure-code normalization.

New Go tests use `require` for setup and fatal assertions and `assert` for value checks.

### Database integration tests

- draft creation and optimistic update;
- concurrent publication permits only one active version;
- rollback creates a new immutable version;
- rollout revision conflicts return 409;
- event coalescing and acknowledgement;
- migrations and repository behavior on SQLite, MySQL, and PostgreSQL-compatible SQL paths.

### Redis integration tests

- two service instances observe shared health, quality, isolation, and stickiness;
- atomic rolling-window updates under concurrent writers;
- expiry and bounded-memory behavior;
- Pub/Sub loss is repaired by revision polling;
- Redis outage disables live intelligent routing and recovery restores it only after refresh.

### Controller tests

- root authorization on every route;
- exact success and validation-error DTOs;
- stale revisions, unknown IDs, unavailable dependencies, and bounded query parameters;
- mutation audit records;
- simulation has no upstream or runtime-state side effects.

### End-to-end verification

- publish a shadow policy, collect shared metrics, switch a deterministic cohort live, force a channel circuit open, restore it, and roll back;
- verify actual execution-model billing and non-negative savings;
- restart one instance and then all instances without losing durable policy state;
- verify the existing selector handles traffic during Redis failure;
- run the complete root-module test suite and independently build `relaykit` with `GOWORK=off`.

## Delivery Order

1. Durable policy, rollout, and event models with migrations and repositories.
2. Policy validation, publication, rollback, and local snapshot refresh.
3. Redis-backed runtime-state interfaces with explicit degradation behavior.
4. Request-path rollout resolution and shared health, quality, and stickiness integration.
5. Settlement-time actual cost and savings telemetry.
6. Administrator policy, rollout, overview, health, quality, and event APIs.
7. Simulation, bounded replay jobs, alert evaluation, and operational documentation.
8. Full multi-instance, database compatibility, regression, build, and rollback verification.

Each stage remains independently testable and preserves the existing routing behavior until an administrator publishes and enables a rollout.

## Rollback

The operational rollback is to disable the active rollout. Existing channel selection resumes without removing policy history or routing audit records.

The deployment rollback keeps new tables intact, stops new writers, and allows the prior binary to ignore them. Redis keys are versioned and expire naturally; rollback does not require destructive key deletion.

## Acceptance Criteria

- Two or more backend instances make rollout, health, quality, and stickiness decisions from shared state.
- Administrators can validate, publish, stage, observe, and roll back policies through stable APIs.
- Live routing stops safely when shared state is unavailable and existing routing continues.
- Published policies and operational events survive process and Redis restarts.
- Actual charges and actual savings are auditable without producing negative credits.
- All mutations are root-authorized, concurrency-safe, and operation-audited.
- SQLite, MySQL, PostgreSQL, the root Go module, and independent `relaykit` builds remain supported.
