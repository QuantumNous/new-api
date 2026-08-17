# Asset Binding Atomic Readiness Design

Date: 2026-08-17

Status: Approved for implementation planning

## Problem

Reusable asset materialization is already deduplicated by exact upstream binding:
`(asset_id, channel_id, binding_scope)`. Model readiness is not. The readiness
worker processes one `(asset_id, scope_key, model_name)` row at a time and marks
only that row `Active`, even when several model targets share the same already
active binding.

This creates a user-visible delay after the provider binding has completed. In a
production Seedance Overseas test, one model appeared after about 7.1 seconds
while the complete model set appeared around 9 seconds. The extra interval is
local readiness convergence; it is not a second provider upload or binding.

## Goals

1. When one exact asset binding becomes active, activate every current model
   readiness row that is proven by that same binding in one database transaction.
2. Make models sharing an exact binding visible together on the next asset-status
   read.
3. Preserve target-generation fencing, lease safety, and multi-node correctness.
4. Leave models on another channel or binding scope independent.
5. Avoid schema migrations, public API changes, and provider-specific logic.

## Non-goals

1. Hiding partial results while readiness still converges.
2. Treating every model in a token group as one binding unit.
3. Activating models whose targets require a different channel or binding scope.
4. Changing provider upload latency, retry schedules, or target selection.
5. Canonicalizing public model aliases as part of this change.

## Atomic Boundary

The atomic unit is:

```text
(asset_id, scope_key, channel_id, binding_scope)
```

`channel_id` alone is insufficient because one channel may use distinct
credential or mapped-model namespaces. `scope_key` is required because the same
asset may be evaluated under different token routing scopes. Models sharing all
four values can reuse one active `asset_bindings` row and therefore have the same
materialization proof.

If two model targets differ on `channel_id` or `binding_scope`, their readiness
may still become visible at different times. That reflects real upstream work
and must not be collapsed.

## Design

### Transactional fan-out

Replace the single-row activation at the successful end of
`PrepareAssetModelReadiness` with a model-layer operation that performs the
following transaction:

1. Apply the existing lease-owner, attempt-count, lease-expiry, target-generation,
   channel, and binding-scope CAS to the driving readiness row.
2. If the driving CAS affects no row, return without changing any sibling rows.
   This fences stale workers and expired leases.
3. Load current `Active` coverage targets in the same `scope_key` whose
   `channel_id` and `binding_scope` exactly match the proven binding.
4. For each matching target, update the corresponding readiness row only when
   its stored target generation, channel, and binding scope still match that
   current target.
5. Promote `Pending`, `Processing`, and `RetryWaiting` sibling rows to `Active`,
   clear retry/lease fields, and preserve terminal `Failed` rows.
6. Commit all promotions together. Readers observe either the previous state or
   the complete matching binding set, never an intermediate subset from this
   activation.

The driving row is included in the same transaction. The transaction returns the
number of rows activated for observability and testing.

### Multi-node behavior

The database transaction is the coordination boundary. No process-local lock or
worker ordering is required.

- A stale worker fails the driving-row CAS and cannot activate siblings.
- A sibling worker whose lease is cleared by the fan-out later fails its own old
  lease CAS harmlessly.
- Target rotation changes the generation or binding identity, so the fan-out
  predicates skip stale rows.
- Concurrent successful workers for the same binding are idempotent; the first
  commit activates the set and later transactions make no incorrect transition.

The implementation uses GORM transactions and predicates supported by SQLite,
MySQL, and PostgreSQL. It does not depend on database-specific update joins.

### Public behavior

The `/v1/assets/{asset_id}` response shape and status aggregation remain
unchanged. The optimization changes when matching readiness rows become active,
not how the response hides or filters them.

For a channel-level Seedance binding with an empty shared `binding_scope`, the
first verified binding activates every current model target on that same channel
and scope in one commit. Both Pro model IDs, when configured as distinct public
abilities on the same binding, are activated together; alias cleanup remains a
separate concern.

## Failure Handling

- No sibling row is activated unless the driving row still owns a valid lease
  and matches its current target snapshot.
- A database error rolls back the complete transaction, including the driving
  row, so the worker can retry normally.
- `Failed` sibling rows remain failed and continue to control aggregate status.
- Rows with missing, selecting, rotating, unavailable, or mismatched targets are
  not promoted.
- The existing active `asset_bindings` validation remains required before the
  transactional activation is called.

## Code Shape

Expected implementation surface:

- `model/asset_model_readiness.go`
  - Add a transactional binding-set activation function.
  - Keep the existing single-row activation helper for callers and tests that
    need its current semantics.
- `model/asset_model_readiness_test.go`
  - Cover sibling activation, atomic rollback/CAS behavior, target fencing, and
    separation by channel and binding scope.
- `service/asset_model_worker.go`
  - Call binding-set activation after exact active-binding validation.
- `service/asset_model_worker_test.go`
  - Prove one successful binding activates all matching model readiness rows.
- `service/asset_model_status_test.go`
  - Prove the public projection returns the complete matching model set after
    one binding completion while preserving partial readiness across genuinely
    different bindings.

No migration, environment flag, controller change, or frontend change is
required.

## Test Strategy

Development follows red-green TDD:

1. Add a failing model test with one driving row and multiple sibling models on
   the same current binding; expect all matching rows to become `Active`.
2. Add a failing stale-CAS test; expect no sibling mutation.
3. Add boundary tests showing different channel, binding scope, generation, and
   `Failed` rows are unchanged.
4. Add a service integration test proving `PrepareAssetModelReadiness` fans out
   after one real active binding is reused or created.
5. Run existing projection, worker lease, rotation, and cross-database-safe model
   tests to prevent regressions.
6. In staging, upload a fresh Seedance Overseas asset and poll once per second;
   models sharing the selected binding must first appear as one complete set.

## Performance Expectation

This change does not reduce the approximately five seconds spent establishing
the upstream binding. It removes the local per-model convergence interval after
that binding is active. At database level, the first-to-last activation gap for
models sharing the binding becomes one transaction commit. Client-observed time
then depends only on the next status poll and normal request latency.

## Rollout

1. Run focused model and service tests on SQLite during development.
2. Run the full affected Go package tests and build.
3. Promote the verified feature commit to `staging` only when explicitly
   requested, then repeat the fresh-asset timing probe.
4. Review production readiness after staging validation; do not merge or push
   `main` from this workflow.

Router deployment is required because the worker and `/v1/assets` readiness data
path execute on router nodes. No console, website, Terraform, or database
migration deployment is required.

## Acceptance Criteria

1. A valid driving-row CAS activates all non-failed readiness rows sharing the
   same current `(asset_id, scope_key, channel_id, binding_scope)` in one commit.
2. A stale driving worker activates no rows.
3. Different channels, binding scopes, target generations, and failed rows are
   unaffected.
4. Existing retry, rotation, and single-binding idempotency behavior remains
   intact.
5. A fresh Seedance Overseas asset never exposes a one-model subset when all
   configured models share the selected exact binding and none has reached a
   terminal failure.
6. No public response field, database schema, or provider adapter changes.
