# Video Seconds Billing Design

## Goal

Add a new top-level billing mode for video generation models: `video_seconds`.

This billing mode should be a peer of the existing modes:

- ratio-based billing
- per-call billing
- expression / tiered billing

The new mode is designed for official video model price tables that are quoted in `yuan per second` or equivalent `price per generated second`, with optional pricing differences by:

- output tier (`720p`, `1080p`, and future tiers)
- audio enabled or disabled

This design must support current Ali video task models such as HappyHorse and Bailian Kling, while staying generic enough for future video-task providers.

## Problem

The current task billing path can price video models in two imperfect ways:

1. fixed per-call price
2. base model ratio plus `OtherRatios` such as duration or resolution multipliers

That is not a good fit for official video provider price tables like:

- `720P`: `0.9 / second`
- `1080P`: `1.2 / second`
- `720P silent`: `0.6 / second`
- `1080P silent`: `0.8 / second`

The current approach has several problems:

- it treats duration as a multiplier instead of the core billable quantity
- it cannot naturally represent per-second prices by resolution tier
- it cannot cleanly express optional audio-sensitive pricing
- different providers encode billing-relevant request fields differently
  - HappyHorse uses `resolution`
  - Kling uses `mode=std/pro`
  - future models may use different fields

Trying to force all of this into `ModelRatio`, `ModelPrice`, or a generic request multiplier system would make pricing hard to configure and easy to misread.

## Recommendation

Introduce a dedicated billing mode: `video_seconds`.

This mode should:

- be configured per model
- bill directly by `unit price per second * duration seconds`
- support standardized tier keys such as `480p`, `720p`, `1080p`, `2k`, `4k`, and future higher resolutions
- support optional audio-specific variants
- rely on model-specific converters that normalize incoming task requests into a shared billing parameter structure

This is the clearest and safest design because:

- the billing semantics match official video pricing tables
- admin-side configuration remains understandable
- task billing logic becomes explicit instead of multiplier-driven
- provider-specific request quirks stay isolated inside converters

## Alternatives Considered

### Approach A: Keep using ratio-based task billing

Use `ModelRatio` or `OtherRatios` to simulate per-second video prices.

Pros:

- minimal new billing infrastructure

Cons:

- wrong abstraction for official per-second pricing
- difficult to configure and reason about
- poor support for audio-sensitive pricing
- likely to become inconsistent across providers

Rejected.

### Approach B: Extend `TaskConditionPrice`

Reuse the existing task conditional price mechanism and add more video dimensions.

Pros:

- partial reuse of existing conditional-price plumbing

Cons:

- current semantics are oriented around special-case task pricing, especially input-side conditions
- the naming does not match per-second billing semantics
- likely to create long-term confusion between token-priced tasks and per-second video tasks

Rejected.

### Approach C: Use `billing_expr` for video price tables

Encode duration, tier, and audio state into expressions.

Pros:

- highly flexible

Cons:

- overkill for fixed provider price tables
- significantly worse admin ergonomics
- harder validation and weaker discoverability in `/api/pricing`

Rejected as the default path.

## Billing Mode Definition

Add a new billing mode constant:

- `video_seconds`

This mode applies only to video-task models.

When a model uses `video_seconds`, billing should not use the existing generic task ratio multiplication path as the source of truth. Instead, it should resolve a normalized video billing parameter set and calculate quota directly from a configured per-second price.

## Standardized Billing Parameters

Add a normalized billing parameter structure for video tasks.

Example:

```go
type VideoBillingParams struct {
    Tier            string
    DurationSeconds int
    AudioEnabled    bool
}
```

Semantics:

- `Tier`
  - standardized output price tier such as `480p`, `720p`, `1080p`, `2k`, `4k`
- `DurationSeconds`
  - final duration used for pricing
- `AudioEnabled`
  - whether billing should treat the output as audio-enabled

This structure is intentionally small. It captures only what the pricing layer needs, and keeps provider-specific request fields out of core billing code.

## Model-Level Price Configuration

Use model-level pricing configuration for `video_seconds`.

Recommended config shape:

```json
{
  "happyhorse-1.1-r2v": {
    "720p": {
      "default": 0.9,
      "silent": 0.6
    },
    "1080p": {
      "default": 1.2,
      "silent": 0.8
    }
  },
  "kling/kling-v3-video-generation": {
    "720p": {
      "default": 0.9,
      "silent": 0.6
    },
    "1080p": {
      "default": 1.2,
      "silent": 0.8
    }
  }
}
```

### Price Key Semantics

Each tier entry supports:

- `default`
  - required
  - the baseline price for the model’s default audio behavior
- `silent`
  - optional
  - used when billing should treat the request as explicitly no-audio
- `audio`
  - optional
  - used when billing should treat the request as explicitly audio-enabled

Resolution tier keys should be normalized strings:

- `720p`
- `1080p`

Future tiers can be added later without changing the billing mode itself.

## Audio Pricing Rule

Audio should be treated as an optional pricing dimension.

Design rule:

- if audio-specific prices are not configured, billing should fall back to `default`
- models are not required to define both `audio` and `silent`
- pricing behavior should respect the model’s actual request semantics and defaults

Recommended price selection order:

1. if `AudioEnabled == false` and `silent` is configured, use `silent`
2. if `AudioEnabled == true` and `audio` is configured, use `audio`
3. otherwise use `default`

This lets admins model both patterns:

- models whose default experience is audio-enabled, with optional silent discount
- models whose default experience is silent, with optional audio premium

## Converter Layer

Different video models expose billing-relevant fields differently, so billing should not parse raw request fields directly inside the core billing engine.

Instead, introduce a converter layer that transforms provider/model-specific request data into `VideoBillingParams`.

Suggested interface:

```go
type VideoBillingParamsConverter interface {
    ConvertVideoBillingParams(info *relaycommon.RelayInfo, req relaycommon.TaskSubmitReq) (*types.VideoBillingParams, error)
}
```

Or a function-based registry:

```go
type VideoBillingParamsConverter func(info *relaycommon.RelayInfo, req relaycommon.TaskSubmitReq) (*types.VideoBillingParams, error)
```

### Why a converter layer is necessary

- HappyHorse pricing tier comes from `resolution`
- Kling pricing tier comes from `mode`
- future providers may derive price tier from different request fields
- some models may imply audio defaults rather than passing `audio` explicitly

The converter layer isolates those differences cleanly.

## Initial Converter Rules

### HappyHorse converter

For HappyHorse models:

- tier source:
  - request `resolution`
  - default to model default if missing
- mapping:
  - `720P -> 720p`
  - `1080P -> 1080p`
- duration source:
  - resolved task duration after existing request normalization
- audio source:
  - use explicit request-side signal if the model supports it
  - otherwise use model default behavior

Note:

Current HappyHorse request support does not introduce a general `audio` request field like Kling. The converter should therefore determine audio behavior conservatively from model behavior and explicit metadata only where supported.

### Bailian Kling converter

For Kling models:

- tier source:
  - `mode`
- mapping:
  - `std -> 720p`
  - `pro -> 1080p`
  - empty `mode -> pro -> 1080p` because that is the upstream default
- duration source:
  - resolved task duration
- audio source:
  - `audio=false` means silent
  - if not specified, use upstream model default behavior

This matches Kling’s upstream semantics better than pretending Kling exposes `resolution`.

## Billing Calculation

For models using `video_seconds`, use this formula:

```text
quota = unit_price_per_second * duration_seconds * QuotaPerUnit * group_ratio
```

Where:

- `unit_price_per_second` comes from the resolved model/tier/audio price
- `duration_seconds` comes from normalized video billing params
- `QuotaPerUnit` is the existing quota conversion factor
- `group_ratio` is the existing group multiplier

This should become the primary calculation path for that billing mode.

## Integration Point

The most natural place to apply this is inside task price resolution before generic `OtherRatios` multiplication is used as the final source of truth.

High-level flow:

1. validate and normalize request
2. resolve model name
3. if model billing mode is `video_seconds`
4. resolve video billing params using a registered converter
5. look up model-level per-second price
6. compute final task quota directly
7. store normalized billing metadata for logs and later inspection

For `video_seconds` models:

- `OtherRatios` may still be populated for observability if useful
- but final billing must not depend on generic multiplier composition

## Configuration Storage

Add a new option-backed configuration entry similar to existing pricing settings.

Suggested option key:

- `VideoSecondsPrice`

Suggested Go type:

```go
type VideoSecondsPriceMap map[string]map[string]map[string]float64
```

Shape:

- model name
  - tier key
    - price key (`default`, `silent`, `audio`)

Example lookup helper:

```go
func GetVideoSecondsPrice(modelName, tier string, audioEnabled bool) (float64, bool)
```

This helper should:

- normalize model name using the same matching strategy as existing pricing helpers
- normalize tier keys to lowercase canonical values
- apply the audio selection order described above

## `/api/pricing` Exposure

`/api/pricing` should expose `video_seconds` pricing explicitly.

Suggested response extension:

```json
{
  "model_name": "happyhorse-1.1-r2v",
  "billing_mode": "video_seconds",
  "video_seconds_price": {
    "720p": {
      "default": 0.9,
      "silent": 0.6
    },
    "1080p": {
      "default": 1.2,
      "silent": 0.8
    }
  }
}
```

This is preferable to forcing the frontend to infer pricing from ratios or hard-coded provider knowledge.

## Logging And Persistence

Task billing logs should preserve the normalized video billing inputs used during calculation.

Recommended persisted metadata:

- billing mode
- resolved tier
- resolved duration seconds
- resolved audio-enabled state
- resolved unit price per second

This should be recorded anywhere the system already persists pricing context for task billing so that auditability stays strong.

## Backward Compatibility

This feature should not change behavior for models that do not opt into `video_seconds`.

Compatibility rules:

- existing `ModelPrice` models remain unchanged
- existing `ModelRatio` models remain unchanged
- existing `tiered_expr` models remain unchanged
- Ali Wan legacy task billing remains unchanged unless later migrated explicitly

This keeps rollout risk contained.

## Failure Behavior

If a model is configured with `billing_mode=video_seconds` but pricing cannot be resolved, the request should fail clearly instead of silently falling back to unrelated billing logic.

Typical failure conditions:

- converter not registered for the model
- duration missing or invalid
- tier cannot be determined
- model has no configured `video_seconds` prices
- resolved tier has no `default` price

This is safer than accidental underbilling or overbilling.

## Testing Strategy

Minimum tests should cover:

- price lookup by model and tier
- `default` / `silent` / `audio` selection rules
- HappyHorse converter:
  - `resolution=720P`
  - `resolution=1080P`
- Kling converter:
  - `mode=std`
  - `mode=pro`
  - missing `mode`
- duration-based quota calculation
- missing config failure behavior
- `/api/pricing` exposure
- no regression for non-`video_seconds` models

## Rollout Plan

Phase 1:

- add `video_seconds` billing mode
- add config store and lookup helpers
- add converter interface and Ali converters
- use it for HappyHorse and Kling

Phase 2:

- expose prices in `/api/pricing`
- add admin-side configuration UI if needed

Phase 3:

- migrate additional video-task providers when useful

## Open Questions Resolved

### Q: Should this be model-level or model-family-level?

Resolved:

- model-level

### Q: Should audio be mandatory in config?

Resolved:

- no
- audio is an optional pricing dimension

### Q: Should Kling use `resolution` or `mode` for pricing tier?

Resolved:

- `mode`
- `std -> 720p`
- `pro or empty -> 1080p`

### Q: Should provider-specific request parsing live in billing core?

Resolved:

- no
- use per-model video billing converters

## Recommendation Summary

Implement `video_seconds` as a first-class billing mode with model-level pricing and per-model converters that normalize request data into:

- billing tier
- duration seconds
- audio state

This keeps official video pricing accurate, provider-specific parsing isolated, and the admin pricing model understandable.
