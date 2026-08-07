# BytePlus Seedance Token-Settled Tiered Billing Design

## Decision

BytePlus Seedance billing remains token-based. The upstream task result's
`total_tokens` is authoritative, and the final quota is:

```text
total_tokens * ModelRatio * GroupRatio * Seedance scenario ratio
```

The Seedance scenario ratio depends on the public model, output resolution, and
whether `content[]` contains a `video_url` input. It is not a fixed per-request
price.

## Goal

Allow each public BytePlus Seedance model to use one administrator-configured
token `ModelRatio`, while the BytePlus task adapter automatically applies the
official relative rate for resolution and video input. Preserve NewAPI's
existing pre-consumption and `total_tokens` difference-settlement flow.

## Root Cause of the Incorrect Per-Call Configuration

The first implementation correctly used `ModelRatio` and final token
settlement. A later clarification mistakenly interpreted the advertised dollar
figures as fixed prices and documented them under `ModelPrice`.

That changes runtime behavior because `ModelPriceHelperPerCall` gives
`ModelPrice` precedence over `ModelRatio`. When a matching `ModelPrice` exists,
the billing snapshot is marked as per-call and completion settlement deliberately
ignores `total_tokens`. Therefore any exact Seedance `ModelPrice` entry whose
name appears in the `ModelRatio` contract below must be removed before token
settlement can take effect. This includes canonical `seedance2.0-pro` and
legacy `Seedance2.0-pro` if either exists in production.

`TASK_PRICE_PATCH` is a second, independent way to mark a task as per-call.
Production rollout must verify that none of the exact Seedance names in the
`ModelRatio` contract below is in that environment setting.

The original BytePlus adapter problem is separate and remains correctly fixed:
task model mapping changes `info.UpstreamModelName` to a private `ep-*` endpoint,
but pricing must use the stable client-facing name in `info.OriginModelName`.

## Configuration Contract

BytePlus's official overseas pricing page is
<https://docs.byteplus.com/en/docs/ModelArk/1544106>. The official table labels
these as USD per million tokens. This design uses the same USD per 1M token unit
throughout:

| Public model | Resolution | No video input | Video input |
| --- | --- | ---: | ---: |
| `seedance-2.0` / `seedance2.0-pro` | 480p/720p | `$7.0 / 1M tokens` | `$4.3 / 1M tokens` |
| `seedance-2.0` / `seedance2.0-pro` | 1080p | `$7.7 / 1M tokens` | `$4.7 / 1M tokens` |
| `seedance-2.0` / `seedance2.0-pro` | 4K | `$4.0 / 1M tokens` | `$2.4 / 1M tokens` |
| `seedance-2.0-fast` | supported resolutions | `$5.6 / 1M tokens` | `$3.3 / 1M tokens` |
| `seedance-2.0-mini` | supported resolutions | `$3.5 / 1M tokens` | `$2.1 / 1M tokens` |

With NewAPI's default `QuotaPerUnit = 500000`, raw ratio `1` equals
`$2 / 1M tokens`. The global raw `ModelRatio` option must contain these values:

```json
{
  "seedance-2.0": 3.5,
  "seedance2.0-pro": 3.5,
  "Seedance2.0-pro": 3.5,
  "seedance-2.0-fast": 2.8,
  "seedance-2.0-mini": 1.75
}
```

Only the lowercase Pro alias, `seedance2.0-pro`, is public. The legacy
`Seedance2.0-pro` spelling remains only as a billing-compatible alias for
existing traffic and persisted data.

Production configuration must also satisfy all of these rules:

- Add or replace the five exact Seedance keys above in `ModelRatio`.
- Preserve every unrelated `ModelPrice` and `ModelRatio` entry, including
  `bytedance/seedance-*` and Doubao models.
- Do not add Seedance entries to `ModelPrice` or `TASK_PRICE_PATCH`; either
  path would change the task to per-call billing and bypass `total_tokens`
  reconciliation or alter `OtherRatios` behavior.
- Use `GroupRatio` as the only customer-specific price adjustment.
- Clear or normalize any persisted Seedance `GroupModelRatio` overrides before
  rollout. A Seedance-specific `GroupModelRatio` match overrides that
  group/model's effective group ratio, breaking the contract that only
  `GroupRatio` controls customer-specific pricing. Delete the override; if it
  cannot be deleted immediately, set it to the expected `GroupRatio` value.
- Before changing settings, read-only verify that none of the Seedance model
  names above is in production `TASK_PRICE_PATCH`.
- Persisted `ModelRatio` settings replace the full built-in map. Merge these
  five keys into the existing production map while preserving all unrelated
  entries; do not replace the persisted option with a five-key object.

## Seedance Scenario Ratios

The adapter returns `video_input = scenarioUnits / baselineUnits`. Baseline
ratio `1.0` produces no `OtherRatios` entry. Unknown models also produce no
entry. BytePlus uses an exact local alias map before scenario lookup:

```go
var pricingModelAliases = map[string]string{
    "seedance2.0-pro": "seedance-2.0",
    "Seedance2.0-pro": "seedance-2.0",
}
```

The scenario table stores official prices in tenths of USD per million tokens:

| Pricing key | Resolution | No video input units | Video input units |
| --- | --- | ---: | ---: |
| `seedance-2.0` | 480p/720p | `70` | `43` |
| `seedance-2.0` | 1080p | `77` | `47` |
| `seedance-2.0` | 4K | `40` | `24` |
| `seedance-2.0-fast` | supported resolutions | `56` | `33` |
| `seedance-2.0-mini` | supported resolutions | `35` | `21` |

At effective `GroupRatio = 1`, these produce the following rates per million
reported tokens. The actual request charge is the applicable rate multiplied
by `total_tokens / 1,000,000`.

| Public model | Scenario | Effective rate |
| --- | --- | ---: |
| `seedance-2.0` / `seedance2.0-pro` | 480p/720p, no video | `$7.0 / 1M tokens` |
| `seedance-2.0` / `seedance2.0-pro` | 480p/720p, video | `$4.3 / 1M tokens` |
| `seedance-2.0` / `seedance2.0-pro` | 1080p, no video | `$7.7 / 1M tokens` |
| `seedance-2.0` / `seedance2.0-pro` | 1080p, video | `$4.7 / 1M tokens` |
| `seedance-2.0` / `seedance2.0-pro` | 4K, no video | `$4.0 / 1M tokens` |
| `seedance-2.0` / `seedance2.0-pro` | 4K, video | `$2.4 / 1M tokens` |
| `seedance-2.0-fast` | no video | `$5.6 / 1M tokens` |
| `seedance-2.0-fast` | video | `$3.3 / 1M tokens` |
| `seedance-2.0-mini` | no video | `$3.5 / 1M tokens` |
| `seedance-2.0-mini` | video | `$2.1 / 1M tokens` |

## Data Flow

1. `ValidateRequestAndSetAction` binds and caches the shared Seedance request.
2. Channel model mapping resolves the private `ep-*` endpoint for upstream use
   without changing the public pricing key in `info.OriginModelName`.
3. With no matching `ModelPrice`, `ModelPriceHelperPerCall` resolves the public
   model's `ModelRatio`, produces an estimated pre-consumption quota, and leaves
   `UsePrice` disabled. Provided the model is also absent from
   `TASK_PRICE_PATCH`, the stored billing context remains non-per-call.
4. BytePlus `EstimateBilling` reads the cached request and selects the scenario
   ratio from the public model, resolution, and `Videos()` result.
5. Task submission applies that ratio to pre-consumption and stores
   `ModelRatio`, `GroupRatio`, and `OtherRatios` in the billing snapshot.
6. When the completed task reports a positive `total_tokens`, existing task
   settlement reloads the currently configured public-model `ModelRatio`,
   combines it with the snapshotted `GroupRatio` and `OtherRatios`, calculates
   the authoritative quota with the formula above, and charges or refunds the
   difference from pre-consumption. Operationally, an in-flight task settles
   with the `ModelRatio` effective at completion.

No schema change and no generic settlement change are required. BytePlus's
model table and `EstimateBilling` override stay request-local and stateless, so
multi-node deployment adds no coordination requirement.

## Implementation Scope

- Keep the BytePlus public-model scenario-unit table, `EstimateBilling`
  override, and endpoint-mapping regression coverage introduced by PR #618.
- Replace the fixed-`ModelPrice` regression test with a global `ModelRatio`
  contract test for all five active and compatibility keys.
- Add settlement coverage proving a positive `total_tokens` value is combined
  with the snapshotted Seedance scenario ratio and is not skipped as per-call
  billing.
- Add BytePlus channel default-model coverage in the default console so the
  canonical Pro alias is advertised and the legacy case alias is not.
- Keep generic `ModelPrice` behavior unchanged for unrelated task models.
- Keep Doubao/VolcEngine's domestic Seedance price table unchanged.

## Verification and Rollout

1. Run targeted BytePlus adapter, relay billing, and task-settlement tests.
2. Run default-console channel configuration regression tests.
3. Run formatting, diff checks, and affected-package tests.
4. Read-only verify that production `TASK_PRICE_PATCH` does not contain any of
   the Seedance model names above; stop for separate authorization if it does.
5. In production, back up the complete `ModelRatio`, `ModelPrice`, and
   `GroupModelRatio` maps before editing.
6. Merge the five Seedance `ModelRatio` entries into the existing production
   map, remove any exact Seedance `ModelPrice` entries whose names appear in
   the `ModelRatio` contract, and delete Seedance `GroupModelRatio` overrides
   without replacing unrelated keys. If an override cannot be deleted
   immediately, set it to that group's expected `GroupRatio` value.
7. Save, refresh, and read back all affected maps to verify the values and
   preservation of unrelated entries.
8. Deploy the router/backend, then deploy the default console because the
   BytePlus default model list now includes canonical Pro.
9. Verify a completed Seedance task records `total_tokens`, remains non-per-call,
   and settles to the formula in this design.

Rollback restores the backed-up `ModelPrice`, `ModelRatio`, and
`GroupModelRatio` maps. Code rollback also removes canonical Pro from the
default console's built-in BytePlus channel configuration.
