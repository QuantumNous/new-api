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
ignores `total_tokens`. Therefore the three exact Seedance `ModelPrice` entries
must be removed before token settlement can take effect.

`TASK_PRICE_PATCH` is a second, independent way to mark a task as per-call.
Production rollout must verify that none of the three public model names is in
that environment setting.

The original BytePlus adapter problem is separate and remains correctly fixed:
task model mapping changes `info.UpstreamModelName` to a private `ep-*` endpoint,
but pricing must use the stable client-facing name in `info.OriginModelName`.

## Configuration Contract

The raw `ModelRatio` option must contain these values:

```json
{
  "seedance-2.0": 0.391,
  "seedance-2.0-fast": 0.3145,
  "seedance-2.0-mini": 0.1955
}
```

With NewAPI's default `QuotaPerUnit = 500000`, the pricing editor converts
between raw model ratio and displayed input price using:

```text
displayed USD per 1M tokens = ModelRatio * 2
```

Consequently, the visual editor displays or accepts these baseline prices:

| Public model | Raw `ModelRatio` | Displayed baseline price |
| --- | ---: | ---: |
| `seedance-2.0` | `0.391` | `$0.782 / 1M tokens` |
| `seedance-2.0-fast` | `0.3145` | `$0.629 / 1M tokens` |
| `seedance-2.0-mini` | `0.1955` | `$0.391 / 1M tokens` |

The displayed dollar values must not be copied into the raw `ModelRatio` JSON;
doing so would double the intended per-token charge.

Production configuration must also satisfy all of these rules:

- Delete only the exact `seedance-2.0`, `seedance-2.0-fast`, and
  `seedance-2.0-mini` keys from `ModelPrice`.
- Add or replace only those same three keys in `ModelRatio`.
- Preserve every unrelated `ModelPrice` and `ModelRatio` entry, including
  `bytedance/seedance-*` and Doubao models.
- Do not change `GroupRatio`; it continues to apply normally.
- Before changing settings, read-only verify that none of the three exact model
  names is in production `TASK_PRICE_PATCH`.
- Do not change `TASK_PRICE_PATCH` or any deployment environment variable as
  part of the settings-only correction. If the preflight check finds a match,
  stop and handle it as a separately authorized deployment change.

If the settings UI cannot save both maps atomically, add the three
`ModelRatio` entries first and then delete the three `ModelPrice` entries. The
existing `ModelPrice` continues to win during the brief transition, avoiding a
window with no billing configuration.

## Seedance Scenario Ratios

The adapter returns `video_input = scenarioUnits / baselineUnits`. Baseline
ratio `1.0` produces no `OtherRatios` entry. Unknown models also produce no
entry.

| Public model | Resolution | No video input | Video input |
| --- | --- | ---: | ---: |
| `seedance-2.0` | 480p/720p | `46/46` | `28/46` |
| `seedance-2.0` | 1080p | `51/46` | `31/46` |
| `seedance-2.0` | 4K | `26/46` | `16/46` |
| `seedance-2.0-fast` | any supported | `37/37` | `22/37` |
| `seedance-2.0-mini` | any supported | `23/23` | `14/23` |

At effective `GroupRatio = 1`, these produce the following rates per million
reported tokens. The actual request charge is the applicable rate multiplied
by `total_tokens / 1,000,000`.

| Public model | Scenario | Effective rate |
| --- | --- | ---: |
| `seedance-2.0` | 480p/720p, no video | `$0.782 / 1M tokens` |
| `seedance-2.0` | 480p/720p, video | `$0.476 / 1M tokens` |
| `seedance-2.0` | 1080p, no video | `$0.867 / 1M tokens` |
| `seedance-2.0` | 1080p, video | `$0.527 / 1M tokens` |
| `seedance-2.0` | 4K, no video | `$0.442 / 1M tokens` |
| `seedance-2.0` | 4K, video | `$0.272 / 1M tokens` |
| `seedance-2.0-fast` | no video | `$0.629 / 1M tokens` |
| `seedance-2.0-fast` | video | `$0.374 / 1M tokens` |
| `seedance-2.0-mini` | no video | `$0.391 / 1M tokens` |
| `seedance-2.0-mini` | video | `$0.238 / 1M tokens` |

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
   settlement calculates the authoritative quota with the formula above and
   charges or refunds the difference from pre-consumption.

No schema change and no generic settlement change are required. BytePlus's
model table and `EstimateBilling` override stay request-local and stateless, so
multi-node deployment adds no coordination requirement.

## Implementation Scope

- Keep the BytePlus public-model scenario-unit table, `EstimateBilling`
  override, and endpoint-mapping regression coverage introduced by PR #618.
- Replace the fixed-`ModelPrice` regression test with a `ModelRatio` contract
  test for all three public models.
- Add settlement coverage proving a positive `total_tokens` value is combined
  with the snapshotted Seedance scenario ratio and is not skipped as per-call
  billing.
- Keep generic `ModelPrice` behavior unchanged for unrelated task models.
- Do not seed global default prices or ratios; the three values remain
  administrator configuration.

## Verification and Rollout

1. Run targeted BytePlus adapter, relay billing, and task-settlement tests.
2. Run formatting, diff checks, and affected-package tests.
3. Read-only verify that production `TASK_PRICE_PATCH` does not contain any of
   the three public model names; stop for separate authorization if it does.
4. In production, back up both complete settings maps before editing.
5. Apply the three `ModelRatio` additions and three exact `ModelPrice`
   deletions without replacing either full map with a three-entry object.
6. Save, refresh, and read back both maps to verify the values and preservation
   of unrelated entries.
7. Verify a completed Seedance task records `total_tokens`, remains non-per-call,
   and settles to the formula in this design.

Rollback restores the backed-up `ModelPrice` and `ModelRatio` maps. It does not
require a code rollback because the same runtime supports both configuration
modes.
