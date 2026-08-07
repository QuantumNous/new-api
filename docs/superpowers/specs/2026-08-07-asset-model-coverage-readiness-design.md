# Asset Model Coverage Readiness Design

Date: 2026-08-07

Status: Approved for implementation planning

## Problem

The public asset status currently describes only whether the Flatkey/GCS source
file is available. Video task creation uses a stricter condition: every
referenced asset must also be materialized in an upstream namespace reachable by
the requested model. This allows an asset query to return `Active` while the next
generation task fails with `asset_channel_unavailable`.

The status cannot be defined by one particular channel. A token group may expose
several asset-capable models and each model may have different candidate
channels. The required guarantee is model coverage: for every asset-capable model
available to the current API key, Flatkey must have at least one verified route
that can consume the asset during a later task submission.

## Goals

1. Let clients upload and query assets without supplying a model or channel.
2. Derive the required model set from the authenticated API key's effective
   routing scope.
3. Return `Active` only when every required model has at least one verified
   upstream asset route.
4. Make later task routing use the same verified route represented by the public
   status.
5. Preserve a common route for multiple `Active` assets used in one request.
6. Treat provider throttling and other transient failures as preparation work,
   not as false success or an immediate terminal failure.
7. Keep provider identities, channel IDs, credentials, and upstream asset IDs
   private.
8. Remain correct when several router instances prepare or query the same asset.

## Non-goals

1. Uploading every asset to every eligible channel.
2. Letting the client select a provider, channel, or model during asset upload.
3. Guaranteeing that an external provider can never become unavailable after an
   `Active` observation.
4. Exposing internal readiness rows or provider errors in the public response.
5. Replacing the existing asynchronous video-task preparation and refund flow.

## Public Contract

Asset upload and status endpoints do not require `model`:

```http
POST /v1/assets
POST /v1/assets/upload
POST /v1/assets/uploads
POST /v1/assets/uploads/{upload_id}/complete
GET  /v1/assets/{asset_id}
```

The existing optional `model` request field remains accepted for compatibility,
but it does not choose the readiness target and new clients do not need to send
it. The authenticated token group, token model allowlist, specific-channel
constraint, and `auto`-group expansion are the authoritative routing scope.

The existing top-level status values retain their wire shape but gain stricter
meaning:

| Status | Meaning |
| --- | --- |
| `Creating` | The Flatkey source upload has not completed. |
| `Processing` | The source is valid, but at least one required model does not yet have verified coverage. Preparation or retry is in progress. |
| `Active` | Every required asset-capable model in the current key scope has a verified upstream route for this asset. |
| `Failed` | The source failed, or at least one required model exhausted every eligible coverage route without a recoverable result. |
| `Expired` | The recoverable source expired and no still-eligible verified coverage remains. |

`Active` is an observed guarantee under the current routing configuration. Task
submission revalidates it. If a channel is disabled or a credential changes
between the status read and task creation, the task returns to asset preparation
and attempts another eligible route instead of exposing a stale binding error.

## Effective Model Set

Flatkey derives the model set on the server for every asset status evaluation and
preparation reconciliation:

1. Resolve the token's effective group exactly as generation routing does,
   including `auto` group expansion.
2. Enumerate enabled abilities in that scope.
3. Intersect the abilities with the token model allowlist when model limits are
   enabled.
4. Keep only models with at least one enabled channel that supports reusable
   assets of the uploaded asset type.
5. Respect a token-specific channel constraint when present.

Models unrelated to the reusable asset library do not affect asset status. A
configuration error where a model is advertised as asset-capable but has no
eligible materializer is terminal coverage failure for that model and must not
produce `Active`. An empty required-model set also does not satisfy coverage
vacuously; the asset is `Failed` for that key scope because no later asset task
can be routed successfully.

## Model Coverage Target

Flatkey maintains one internal coverage target for each effective routing scope
and model. A target identifies a channel and, where required, the credential and
mapped-model binding scope. It is never returned to the client.

All assets prepared for the same scope and model converge on the same current
coverage target. This is stronger than allowing each asset to succeed on an
arbitrary channel: two independently `Active` assets then share a route and can
be used together in one generation request.

Target selection uses the normal routing eligibility rules and the following
additional constraints:

1. The channel has a registered asset materializer.
2. The channel can consume every reusable asset type admitted by the public
   model contract, not only the type of the first uploaded asset.
3. The requested public model maps to a valid upstream model.
4. At least one enabled credential scope can create and later reference the
   upstream asset.
5. Existing verified bindings are preferred over new provider writes.

A target is rotated only after it becomes ineligible or definitively unusable.
Rotation creates a new target generation. Assets remain `Processing` for that
model until their binding is active on the new generation. A still-enabled old
target may continue serving tasks until the replacement is ready.

## Data Model

### `asset_model_coverage_targets`

One row represents the private coverage route for an effective scope and model.

| Field | Purpose |
| --- | --- |
| `scope_key` | Stable hash of the effective group and specific-channel constraint |
| `model_name` | Public model covered by this target |
| `channel_id` | Internal selected channel |
| `binding_scope` | Credential and mapped-model namespace fingerprint |
| `generation` | Monotonic target version used as a fencing token |
| `status` | `Selecting`, `Active`, `Rotating`, or `Unavailable` |
| `lease_owner`, `lease_expires_at` | Multi-node target-selection lease |
| timestamps | Selection and refresh times |

The unique key is `(scope_key, model_name)`. Channel configuration changes bump
the target generation rather than mutating readiness rows in place without a
fence.

### `asset_model_readiness`

One row represents one asset's readiness on the current target generation.

| Field | Purpose |
| --- | --- |
| `asset_id` | Flatkey asset identity |
| `scope_key` | Effective routing scope |
| `model_name` | Public model being prepared |
| `target_generation` | Coverage target generation used for this attempt |
| `channel_id` | Internal target channel snapshot |
| `binding_scope` | Exact upstream namespace snapshot |
| `status` | `Pending`, `Processing`, `RetryWaiting`, `Active`, or `Failed` |
| `error_class` | Sanitized retryable or definitive category |
| `attempt_count` | Provider-write attempts for this generation |
| `next_retry_at` | Database-backed retry schedule |
| `lease_owner`, `lease_expires_at` | Multi-node preparation lease |
| timestamps | Creation and last observation times |

The unique key is `(asset_id, scope_key, model_name)`. A readiness row is valid
only when its `target_generation`, channel, binding scope, and active
`asset_bindings` row all match the current coverage target.

Existing `assets.status` remains the source lifecycle field. The public status
is projected from source lifecycle plus the current key's model-readiness rows;
one key's aggregation must not overwrite the stored source status seen by a
different key scope.

## Upload And Preparation Flow

1. Upload or copy the media into GCS and validate its type, size, and checksum.
2. Mark the source available without returning public `Active` solely because
   GCS succeeded.
3. Derive the effective model set from the authenticated key scope.
4. Insert missing model-readiness rows idempotently in `Pending`.
5. Return `Processing` while the database-backed preparation worker runs.
6. For each model, resolve or claim its coverage target.
7. Reuse an exact active `asset_bindings` row when one exists.
8. Otherwise create or refresh the upstream asset binding under the existing
   binding lease and target-generation fence.
9. Mark the model readiness `Active` only after the upstream reports `Active`
   and the binding namespace matches the target.
10. Project the asset as public `Active` only when all required model rows are
    `Active` for their current targets.

Direct-upload completion follows the same preparation flow. Existing assets are
enrolled lazily when queried or referenced and by a bounded reconciliation job;
they do not require re-uploading.

## Task Creation Flow

1. Parse the task's model and `asset://` references.
2. Derive the same effective routing scope used by asset readiness.
3. Load the current coverage target and readiness row for every referenced
   asset.
4. If all assets are active on the same current target, rank or pin that target
   ahead of unprepared candidates and rewrite all references with its exact
   upstream binding scope.
5. If any readiness row is missing, stale, or retrying, keep the local task in
   `preparing_assets`; do not synchronously return a misleading binding error.
6. The worker prepares all referenced assets on one target and submits the video
   immediately after they become active.
7. If the target becomes definitively unusable before upstream video acceptance,
   rotate or select another candidate and repeat within the existing preparation
   deadline.
8. After upstream video acceptance, task polling and billing remain pinned to
   that submitted channel.

This preserves the existing local-task-first behavior while making public asset
`Active` a sufficient readiness condition for normal task submission.

## Failure Classification And Retry

Provider failures are retained internally with HTTP status, stable upstream
error code, `Retry-After`, and request ID where available. Public responses stay
white-labelled.

Retryable examples include throttling, timeouts, upstream 5xx responses, and an
upstream asset that remains `Processing`. `QuotaWriteQPMExceeded` is explicitly
retryable and must not immediately mark an asset or binding `Failed`.

The initial retry schedule is 5, 15, 30, and 60 seconds, capped by a five-minute
preparation window for one target generation. A retryable failure keeps public
status `Processing`. After the window, target rotation is attempted when another
eligible route exists. Public `Failed` is reached only after every eligible
candidate has either produced a definitive failure or exhausted its retry
window.

One model's failure prevents the aggregate public status from becoming
`Active`, but it does not delete successful bindings for other models. A later
configuration change, scheduled transient-failure retry cycle, or task-triggered
revalidation can reopen the failed row as `Pending` without requiring a new
upload.

## Configuration Changes

Readiness is evaluated against current channel state, model mapping, credentials,
and group abilities. Disabling a target channel, rotating a credential, changing
a model mapping, or adding a newly required asset-capable model invalidates the
affected coverage generation.

The next status read immediately projects `Processing` when current coverage is
missing or stale. A database-backed reconciliation worker creates the new target
and readiness work. No in-memory cache or single router instance is authoritative
for the transition.

## Concurrency And Idempotency

Production is multi-node. Correctness relies on database constraints, leases,
and generation fences:

- Coverage targets are unique by `(scope_key, model_name)`.
- Model readiness is unique by `(asset_id, scope_key, model_name)`.
- Provider bindings retain their existing unique channel and binding-scope key.
- Only the current lease owner and target generation may publish a readiness
  transition.
- A stale worker may not activate a row after target rotation.
- Concurrent assets and tasks may share a target but create each exact provider
  binding at most once.
- Retry scheduling uses `next_retry_at` in the database, not process-local
  timers.

## Security And Privacy

- Every asset lookup remains scoped by owner user ID.
- Effective model enumeration comes from authenticated server context, never a
  client-supplied model list.
- Public responses do not expose provider names, channel IDs, credentials,
  binding scopes, upstream request IDs, or upstream asset IDs.
- Signed GCS URLs remain short-lived and are not stored in readiness rows or task
  payloads.
- Internal errors are sanitized before entering public task or asset responses.

## Observability

Restricted logs and metrics record:

- preparation latency from source-ready to aggregate `Active`
- readiness counts by public model and internal error class
- coverage-target selection and rotation counts
- provider binding cache hits and writes
- throttling retries and retry-window exhaustion
- tasks that used an already-ready coverage target
- tasks that had to re-enter preparation after a stale status observation

Logs correlate Flatkey asset and task IDs without including credentials or signed
source URLs.

## Test Strategy

1. Controller tests prove upload and query require no client `model` and do not
   expose internal coverage fields.
2. Service tests derive the correct model set from group abilities, token model
   limits, `auto` expansion, asset type, and specific-channel constraints.
3. Projection tests prove GCS source availability alone returns `Processing`.
4. Aggregation tests prove `Active` requires every in-scope asset model to be
   active on its current target generation.
5. Multi-asset tests prove two independently `Active` assets share a model target
   and can be rewritten for one task channel.
6. Retry tests prove 429 and 5xx responses remain `Processing`, respect backoff,
   and try another candidate before terminal failure.
7. Rotation tests prove stale target generations cannot reactivate readiness.
8. Multi-node tests prove only one worker creates an exact provider binding.
9. Task-worker tests prove a stale or processing readiness row queues the task,
   while an active row submits immediately through the verified target.
10. Compatibility tests prove existing optional `model` fields remain accepted
    but do not control readiness selection.

## Rollout

1. Add the coverage-target and model-readiness tables with SQLite, MySQL, and
   PostgreSQL-compatible migrations.
2. Deploy code with readiness projection disabled and backfill rows for recently
   used assets.
3. Enable preparation and metrics in staging; test the production-equivalent
   multi-channel group with two fresh assets per model.
4. Enable strict public projection in staging and verify that no source-only
   asset reports `Active`.
5. Deploy router nodes in production and enable strict projection behind a
   runtime flag.
6. Monitor preparation latency, QPM retries, target rotations, and task
   preparation failures before removing the compatibility flag.

Router deployment is required because this changes `/v1/assets`, channel
selection, asset binding, and video-task submission behavior. The console and
public website are not required unless a later change adds readiness detail to a
UI. No Terraform change is required for the database-backed design.

## Acceptance Criteria

1. A client uploads and queries an asset without sending `model`.
2. A valid GCS source does not by itself produce public `Active`.
3. The server automatically derives all asset-capable models available to the
   current API key scope.
4. Public `Active` means every derived model has one verified current coverage
   route.
5. Two `Active` assets used together have a common verified target for the
   requested model.
6. Task creation prefers that verified target and does not return an immediate
   `asset_channel_unavailable` for an `Active` asset under unchanged routing
   configuration.
7. Throttling and upstream 5xx responses remain retryable and never create false
   `Active` state.
8. A disabled channel or rotated credential invalidates stale readiness and
   triggers preparation without requiring a new upload.
9. Concurrent router instances cannot create duplicate exact bindings or publish
   readiness for a stale target generation.
10. Public responses remain provider-neutral and contain no internal routing or
    credential details.
