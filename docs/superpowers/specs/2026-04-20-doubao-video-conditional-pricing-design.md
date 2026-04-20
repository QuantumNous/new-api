# Doubao Video Conditional Pricing Design

## Goal

Add a configurable pricing system for Doubao video generation models where the input token price is determined by:

- whether the request input contains video
- the output video resolution

This pricing must be:

- editable from the admin WebUI
- used by actual task billing
- displayed correctly in the public model pricing plaza

This phase only applies to Doubao video task models and only supports the official fixed resolution set:

- `480p`
- `720p`
- `1080p`

## Current Problem

The existing `TaskConditionRatio.video_input` option only represents a multiplier. That is not sufficient for the required official pricing model.

Required pricing semantics are absolute conditional prices, not multipliers.

Example:

- `480p` / `720p`
  - input without video: `46 USD / 1M tokens`
  - input with video: `28 USD / 1M tokens`
- `1080p`
  - input without video: `51 USD / 1M tokens`
  - input with video: `31 USD / 1M tokens`

The current pricing plaza also cannot display this correctly because `/api/pricing` only exposes base `model_ratio` and related ratios. The frontend then derives price from those fields and has no concept of conditional task prices.

## Constraints

- Do not overload `TaskConditionRatio` with absolute-price semantics.
- Do not change existing non-video billing behavior.
- Do not attempt a generic pricing rules engine in this phase.
- Keep scope limited to Doubao video task models.
- Keep the UI simple and visual.

## Approaches

### Approach A: Keep using conditional multipliers

Use `TaskConditionRatio` and add resolution-specific multiplier entries.

#### Pros

- smallest backend delta
- reuses existing storage pattern

#### Cons

- wrong semantics for the user requirement
- admin must manually reverse-calculate multipliers from official prices
- pricing plaza still needs special handling
- high risk of confusion because the field label says "price" but storage means "ratio"

#### Verdict

Not recommended.

### Approach B: Add a dedicated conditional price option

Add a new option key storing absolute conditional token prices in `USD / 1M tokens`.

Backend billing uses this option directly when the request matches a supported condition.

#### Pros

- matches official pricing language exactly
- WebUI can edit real prices instead of hidden multipliers
- pricing plaza can display the same source of truth
- future conditional price types can be added without disturbing ratio-based billing

#### Cons

- more code than ratio reuse
- requires `/api/pricing` response extension

#### Verdict

Recommended.

### Approach C: Hard-code Doubao official pricing in the adaptor

Put a resolution-and-input-aware price table in Go code.

#### Pros

- fastest to ship

#### Cons

- not configurable
- not suitable for operational maintenance
- WebUI still cannot edit or explain it cleanly

#### Verdict

Not acceptable for this use case.

## Recommended Design

Use Approach B.

Introduce a new option key:

- `TaskConditionPrice`

This option stores absolute conditional prices for Doubao video models. It is the source of truth for:

- async task billing
- admin-side price editing
- pricing plaza display

The existing `TaskConditionRatio` remains supported for backward compatibility, but the new billing path should prefer `TaskConditionPrice` when present.

## Data Model

### Option key

- `TaskConditionPrice`

### JSON shape

```json
{
  "doubao-seedance-2-0": {
    "720p": {
      "input_text_only": 46,
      "input_with_video": 28
    },
    "1080p": {
      "input_text_only": 51,
      "input_with_video": 31
    }
  }
}
```

### Resolution rules

- Accepted values in this phase: `480p`, `720p`, `1080p`
- `480p` should resolve to the `720p` pricing bucket unless a dedicated `480p` entry is added in a future phase
- Unknown or missing resolution should fall back to:
  1. `720p` if available
  2. existing base pricing path

### Condition keys inside a resolution bucket

- `input_text_only`
- `input_with_video`

Both values are absolute prices in `USD / 1M input tokens`.

## Billing Behavior

### Supported scope

Only Doubao video task models use this logic in this phase.

### Matching flow

1. Detect whether the current task is a Doubao video task.
2. Read normalized output resolution from request metadata.
3. Normalize `480p` to `720p`.
4. Detect whether request metadata content contains video input.
5. Query `TaskConditionPrice[model][resolution][condition]`.
6. If matched, use the returned absolute input token price for billing.
7. If not matched, fall back in this order:
   - existing `TaskConditionRatio.video_input`
   - existing `ModelRatio` / `ModelPrice` path

### Why keep fallback

This avoids breaking existing deployments that already configured `TaskConditionRatio`.

## Backend Changes

### Ratio/price setting layer

Add a new setting package component parallel to the current conditional ratio support:

- parse and store `TaskConditionPrice`
- expose helpers similar to:
  - `GetTaskConditionalInputPrice(model, resolution, hasVideoInput) (float64, bool)`
  - `TaskConditionPrice2JSONString() string`
  - `UpdateTaskConditionPriceByJSONString(jsonStr string) error`

### Option persistence

Wire `TaskConditionPrice` through:

- option initialization
- option update switch
- `/api/option`

### Doubao adaptor / task billing

Extend the Doubao task pricing path so the resolved price data can carry an absolute conditional input price in addition to ratio-based metadata.

Recommended implementation shape:

- keep condition detection in the Doubao task adaptor
- resolve conditional absolute price there
- attach it to the task price data in a dedicated field
- let final billing prefer the explicit conditional price over derived ratio multiplication

Do not fake an absolute price by converting it back into a multiplier at the last minute unless the billing pipeline strictly requires it. The preferred design is to preserve the semantics clearly in code.

### Pricing API

Extend `/api/pricing` records with Doubao-video-specific conditional pricing fields.

Recommended payload shape:

```json
{
  "task_condition_price": {
    "720p": {
      "input_text_only": 46,
      "input_with_video": 28
    },
    "1080p": {
      "input_text_only": 51,
      "input_with_video": 31
    }
  }
}
```

Only include this field for models where it exists.

This avoids teaching the plaza to infer conditional pricing from unrelated fields.

## WebUI Design

### Admin pricing editor

Add a visual editor section for Doubao video conditional input prices.

For this phase the UI should expose four fields:

- `720p text-only input price`
- `720p video-input price`
- `1080p text-only input price`
- `1080p video-input price`

Notes:

- `480p` is not shown as a separate editable field in this phase because it shares the `720p` bucket
- field unit should be explicit: `USD / 1M tokens`
- only show this section for applicable video-task pricing entries or always show it in the model pricing editor with empty defaults; either is acceptable, but the UI copy must clearly state that only Doubao video task models currently use it

### Manual JSON editor

Expose `TaskConditionPrice` as a dedicated advanced option alongside the visual editor.

### Save behavior

Visual editing must round-trip cleanly into `TaskConditionPrice` JSON without disturbing unrelated option keys.

## Pricing Plaza Design

The plaza must stop pretending that every token-billed model can be explained only through `model_ratio`.

For models with `task_condition_price`, display conditional prices explicitly.

### Card / table behavior

For affected models show:

- `720p: $46 / $28`
- `1080p: $51 / $31`

where the first price is text-only input and the second is video input.

The exact label text can be refined in implementation, but the information hierarchy must be obvious.

### Detail behavior

If a model detail modal exists, it should present the full conditional price breakdown instead of only the base derived token price.

### Fallback behavior

For models without `task_condition_price`, continue using the existing display logic.

## Testing

### Backend tests

- parse and update `TaskConditionPrice`
- resolution normalization behavior
- Doubao conditional price lookup
- billing prefers explicit conditional price when present
- fallback to old ratio/base pricing when missing

### Frontend tests

- visual editor state load/save for `TaskConditionPrice`
- conditional pricing display formatting in the pricing plaza
- no regression for non-video models

### Manual verification

- edit a Doubao video model in WebUI
- save `720p` and `1080p` conditional prices
- confirm `/api/option` and `/api/pricing` return expected data
- confirm the plaza shows the same values
- submit test tasks with and without video input and verify billing

## Migration and Compatibility

- no forced migration is required
- existing deployments can continue using `TaskConditionRatio`
- if both `TaskConditionPrice` and `TaskConditionRatio` exist, `TaskConditionPrice` wins for supported Doubao video cases
- non-Doubao models remain unchanged

## Open Decision Settled In This Design

The first implementation supports:

- Doubao video task models only
- fixed official resolution set only
- visual WebUI editing
- correct pricing plaza display

It does not attempt:

- arbitrary resolution strings
- generic multi-provider task-condition pricing
- output-side conditional billing beyond the specified input token price matrix
