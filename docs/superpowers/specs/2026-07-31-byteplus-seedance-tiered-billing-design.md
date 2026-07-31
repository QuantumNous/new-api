# BytePlus Seedance Tiered Billing Design

## Goal

Allow each public BytePlus Seedance model to use one administrator-configured
fixed per-call `ModelPrice`, while the task adapter automatically applies the
official relative rate for output resolution and whether `content[]` contains
a `video_url` input.

## Current Problem

`BytePlus.TaskAdaptor` embeds the Doubao adapter, so it inherits Doubao's
`EstimateBilling`. Task model mapping runs before billing estimation and changes
`info.UpstreamModelName` to the account-specific `ep-*` endpoint ID. Doubao's
price table is keyed by Doubao model names, so the lookup misses and no
`OtherRatios` entry is recorded.

The endpoint ID is private routing configuration and must not become a pricing
key. Pricing must instead follow the stable client-facing BytePlus model name in
`info.OriginModelName`.

## Considered Approaches

1. **BytePlus-local price table and `EstimateBilling` override (selected).**
   Key the table by `seedance-2.0`, `seedance-2.0-fast`, and
   `seedance-2.0-mini`. This keeps provider pricing independent from private
   endpoint IDs and avoids changing the shared task settlement path.
2. Add BytePlus aliases to Doubao's price table. This is smaller, but couples
   BytePlus product names and prices to a different provider's adapter.
3. Rewrite `UpstreamModelName` to a billing alias before estimation. This risks
   corrupting the endpoint ID required by the subsequent upstream request.

## Fixed Prices and Ratios

The administrator configures these no-video baseline prices in `ModelPrice`:

```json
{
  "seedance-2.0": 0.782,
  "seedance-2.0-fast": 0.629,
  "seedance-2.0-mini": 0.391
}
```

Do not configure these values in `ModelRatio`. `ModelPriceHelperPerCall` gives
fixed-price configuration priority and converts the selected model's price to
the base task quota. The adapter then returns
`video_input = scenarioUnits / baselineUnits`, and the existing task billing
pipeline multiplies that ratio into the fixed-price quota.

| Public model | Resolution | No video input | Video input |
| --- | --- | ---: | ---: |
| `seedance-2.0` | 480p/720p | `46/46` | `28/46` |
| `seedance-2.0` | 1080p | `51/46` | `31/46` |
| `seedance-2.0` | 4K | `26/46` | `16/46` |
| `seedance-2.0-fast` | any supported | `37/37` | `22/37` |
| `seedance-2.0-mini` | any supported | `23/23` | `14/23` |

Baseline ratio `1.0` produces no `OtherRatios` entry. Unknown models also
produce no entry.

At an effective group ratio of `1`, the resulting USD prices are:

| Public model | Scenario | Effective price |
| --- | --- | ---: |
| `seedance-2.0` | 480p/720p, no video | `$0.782` |
| `seedance-2.0` | 480p/720p, video | `$0.476` |
| `seedance-2.0` | 1080p, no video | `$0.867` |
| `seedance-2.0` | 1080p, video | `$0.527` |
| `seedance-2.0` | 4K, no video | `$0.442` |
| `seedance-2.0` | 4K, video | `$0.272` |
| `seedance-2.0-fast` | no video | `$0.629` |
| `seedance-2.0-fast` | video | `$0.374` |
| `seedance-2.0-mini` | no video | `$0.391` |
| `seedance-2.0-mini` | video | `$0.238` |

The effective group ratio is still applied after the model price. Configure it
as `1` for groups that must be charged the exact amounts above.
The legacy `TASK_PRICE_PATCH` environment variable must not list these models,
because that compatibility path intentionally skips `OtherRatios`.

## Data Flow

1. `ValidateRequestAndSetAction` binds and caches the shared Seedance request.
2. Channel model mapping resolves the private `ep-*` endpoint for upstream use.
3. `ModelPriceHelperPerCall` resolves the configured `ModelPrice` from
   `info.OriginModelName` and creates the base fixed-price quota.
4. BytePlus `EstimateBilling` reads the cached request, uses
   `info.OriginModelName`, `resolution`, and `Videos()` to select the ratio, and
   returns it as `video_input` when it differs from `1.0`.
5. Existing task orchestration multiplies `OtherRatios` into the fixed-price
   quota and stores the price, group ratio, and request ratios in the billing
   snapshot.
6. The billing snapshot is marked as per-call billing, so later task token usage
   does not replace the fixed scenario price with token-based reconciliation.

No schema, generic billing-expression, or settlement change is required. The
logic is request-local and stateless, so multi-node deployment adds no new
coordination requirement.

## Tests

- Reproduce the current `ep-*` lookup miss using a public origin model and a
  private upstream endpoint ID.
- Cover Seedance 2.0 resolution/video combinations.
- Cover Fast and Mini video-input ratios.
- Confirm baseline and unknown models do not add a multiplier.
- Configure only the three `ModelPrice` entries and confirm all three video
  scenarios produce the expected fixed-price quotas.
- Run the BytePlus and Doubao task-adapter test packages, then compile the
  affected packages.
