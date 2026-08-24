# Asset review follow-up hardening design

## Goal

Close the confirmed follow-up findings on PR #670 without weakening the public contract: an asset is `Active` only when every required model has a verified active binding, and `available_models` lists only models whose current target has such a binding.

## Confirmed findings

1. TechMobi upload may return `Processing` plus an opaque asset URI, but the production `GetAsset` implementation only validates the URI and then reports `Active`. That is not an upstream readiness check.
2. Target rotation silently starts at candidate zero when the persisted target no longer matches the current candidate set. Temporary target/configuration problems also share the same terminal path as proven candidate exhaustion.
3. Strict status and `available_models` independently query the same binding once per model.

## Decisions

### TechMobi readiness

TechMobi must never promote an opaque asset URI to `Active` based only on syntax. The published upstream documentation describes `POST /v1/assets/upload` as returning a ready asset URL and does not document an asset-status lookup endpoint. Therefore a `Processing` upload response remains a retryable materialization result and its URI is not persisted as a pollable binding. The existing stable binding idempotency key makes subsequent materialization retries safe while preserving truthful local status. If TechMobi later publishes a status endpoint, `GetAsset` can be changed to poll it and `Processing + assetUrl` can be persisted again in the same change.

### Worker rotation reasons

Rotation receives an explicit reason:

- definitive provider failure and an exhausted five-minute generation window may advance to the next candidate and may terminally fail after the final candidate;
- target drift, temporary ineligibility, or target-option resolution failure does not prove candidate exhaustion and must release/schedule the readiness row for retry without marking the target unavailable;
- a persisted target that is absent from the current candidate set is treated as drift, never as an implicit request to retry candidate zero.

This preserves the bounded terminal behavior for genuinely exhausted candidates while preventing configuration drift from replaying an already failed route or prematurely failing the only route.

### Binding projection

`ReconcileAssetForScope` loads active, non-empty bindings for all distinct current `(channel_id, binding_scope)` target keys in one query. Both strict status projection and `available_models` consume the same in-memory key set. The compound key is mandatory because TechMobi credentials on one channel have independent binding scopes.

## Compatibility and safety

- No public field is removed or renamed.
- `available_models` remains an empty array when no model is verified.
- Provider identifiers and binding scopes remain internal.
- TechMobi may remain `Processing` longer when the upstream responds asynchronously; this is intentional and safer than a false `Active`.
- No full `go test ./service` run is required on Windows; focused tests, build, vet, and diff checks are the verification gates.

## Acceptance criteria

- A TechMobi `Processing + assetUrl` response cannot make a binding Active through the production `GetAsset` path.
- A real TechMobi Active upload response remains usable.
- Target drift and temporary target failures schedule retry without candidate-zero replay or target unavailability.
- Definitive/five-minute-window exhaustion still advances candidates and fails after the final candidate.
- Status and `available_models` share one batched binding lookup and preserve existing projection results.
