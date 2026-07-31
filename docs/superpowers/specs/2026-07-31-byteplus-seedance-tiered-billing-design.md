# BytePlus Seedance Tiered Billing Design

## Goal

Allow each public BytePlus Seedance model to use one administrator-configured
token `ModelRatio`, while the task adapter automatically applies the official
relative rate for output resolution and whether `content[]` contains a
`video_url` input.

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

## Price Ratios

The administrator configures the no-video baseline price for each model. The
adapter returns `video_input = scenarioPrice / baselinePrice`; the existing task
billing pipeline multiplies this value into both pre-consumption and final
token reconciliation.

| Public model | Resolution | No video input | Video input |
| --- | --- | ---: | ---: |
| `seedance-2.0` | 480p/720p | `46/46` | `28/46` |
| `seedance-2.0` | 1080p | `51/46` | `31/46` |
| `seedance-2.0` | 4K | `26/46` | `16/46` |
| `seedance-2.0-fast` | any supported | `37/37` | `22/37` |
| `seedance-2.0-mini` | any supported | `23/23` | `14/23` |

Baseline ratio `1.0` produces no `OtherRatios` entry. Unknown models also
produce no entry.

## Data Flow

1. `ValidateRequestAndSetAction` binds and caches the shared Seedance request.
2. Channel model mapping resolves the private `ep-*` endpoint for upstream use.
3. BytePlus `EstimateBilling` reads the cached request, uses
   `info.OriginModelName`, `resolution`, and `Videos()` to select the ratio, and
   returns it as `video_input` when it differs from `1.0`.
4. Existing task orchestration stores the ratio in the billing snapshot.
5. Existing completion settlement calculates
   `totalTokens * ModelRatio * GroupRatio * OtherRatios`.

No schema, generic billing-expression, or settlement change is required. The
logic is request-local and stateless, so multi-node deployment adds no new
coordination requirement.

## Tests

- Reproduce the current `ep-*` lookup miss using a public origin model and a
  private upstream endpoint ID.
- Cover Seedance 2.0 resolution/video combinations.
- Cover Fast and Mini video-input ratios.
- Confirm baseline and unknown models do not add a multiplier.
- Run the BytePlus and Doubao task-adapter test packages, then compile the
  affected packages.
