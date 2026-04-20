# Video Input Ratio Config Design

## Goal

Make the `video_input` conditional billing multiplier configurable from the NewAPI web UI.

This phase only exposes one conditional multiplier:

- `video_input`

The design should still avoid locking the backend into a one-off shape that becomes impossible to extend later.

## Current State

### Existing pricing layers

NewAPI currently has two main pricing configuration shapes:

1. Fixed model-level options stored in `options`
   - `ModelPrice`
   - `ModelRatio`
   - `CompletionRatio`
   - `ImageRatio`
   - `AudioRatio`
   - etc.

2. Runtime task-specific multipliers stored in `PriceData.OtherRatios`
   - built by task adaptors during request handling
   - examples: `seconds`, `resolution`, `video_input`

### Current `video_input` implementation

For Doubao/Seedance video tasks, `video_input` is currently:

- detected at runtime in the Doubao task adaptor
- mapped from a hard-coded Go constant table
- applied as an `OtherRatio`

This means:

- billing behavior works
- but it is not user-configurable
- and the web UI has no concept of conditional task multipliers

## Design Constraints

- Do not break the existing `ModelRatio` / `ModelPrice` editing workflow.
- Do not mix conditional task multipliers into fields that currently mean "static per-model pricing".
- Do not make the first version over-generalized in UI.
- Keep compatibility with the current task billing pipeline:
  - adaptor detects condition
  - condition key enters `OtherRatios`
  - final token recalculation multiplies by `otherMultiplier`

## Approaches

### Approach A: Reuse `ModelRatio`

Store `video_input` inside `ModelRatio` using a nested JSON shape.

Example:

```json
{
  "doubao-seedance-1-0-pro-250528": {
    "base": 100,
    "video_input": 0.5
  }
}
```

#### Pros

- no new option key
- everything appears under one pricing concept

#### Cons

- breaks the current `ModelRatio` contract: it is now `model -> float`, not `model -> object`
- requires invasive frontend/editor rewrites
- creates migration risk and ambiguous semantics
- high chance of hidden regressions in existing pricing code

#### Verdict

Not recommended.

### Approach B: Add a dedicated `VideoInputRatio` option

Add a new option key whose JSON shape is:

```json
{
  "doubao-seedance-1-0-pro-250528": 0.5,
  "doubao-seedance-2-0-260128": 0.6086956522
}
```

Task adaptors continue detecting whether the request contains video input. If true, they read the multiplier from `VideoInputRatio`.

#### Pros

- smallest implementation
- very clear semantics
- minimal frontend impact
- easy to explain to administrators

#### Cons

- only solves one condition type
- if future conditions are needed, more parallel options will appear
  - `SecondsRatio`
  - `ResolutionRatio`
  - `ImageInputRatio`
- configuration model becomes fragmented

#### Verdict

Good for a narrow tactical patch, but not the best long-term fit.

### Approach C: Add a generic task conditional ratio option, but expose only `video_input` in UI

Add a new option key:

- `TaskConditionRatio`

Backend JSON shape:

```json
{
  "video_input": {
    "doubao-seedance-1-0-pro-250528": 0.5,
    "doubao-seedance-2-0-260128": 0.6086956522,
    "doubao-seedance-2-0-fast-260128": 0.5945945946
  }
}
```

In this phase:

- backend supports the keyed structure
- frontend only edits `video_input`
- adaptors only read `video_input`

#### Pros

- first release remains simple in UI
- backend shape is future-safe
- no need to redesign storage later if `seconds` or `resolution` become configurable
- keeps static model pricing and conditional task pricing separate

#### Cons

- slightly more code than Approach B
- UI needs one small custom editor instead of reusing an existing textarea as-is

#### Verdict

Recommended.

## Recommended Design

Use Approach C.

### Why

This keeps the user-facing scope narrow while putting the persistence shape in the right place.

The separation becomes:

- `ModelRatio` / `ModelPrice`: static model pricing
- `TaskConditionRatio`: conditional task multipliers

That matches the actual billing architecture already present in the codebase.

## Proposed Backend Shape

### Option key

- `TaskConditionRatio`

### Stored JSON

```json
{
  "video_input": {
    "doubao-seedance-1-0-pro-250528": 0.5,
    "doubao-seedance-2-0-260128": 0.6086956522,
    "doubao-seedance-2-0-fast-260128": 0.5945945946
  }
}
```

### Runtime API

Add a small ratio-setting accessor layer:

- load and cache `TaskConditionRatio`
- expose helper methods such as:
  - `GetTaskConditionRatio(condition, modelName) (float64, bool)`

### Adaptor behavior

Doubao task adaptor stays responsible for condition detection:

- if metadata contains video input
- ask config layer for `("video_input", modelName)`
- if configured, return `{"video_input": ratio}`
- if not configured, fall back to current hard-coded defaults for backward compatibility

This fallback is important for upgrade safety.

## Proposed Frontend Shape

### Scope of first release

Only one editable section is added:

- `视频输入倍率 / Video Input Ratio`

### UI placement

Add it to the existing Ratio settings area, but as an independent section rather than mixing it into `ModelRatio`.

Recommended UI shape:

- a dedicated JSON textarea in the short term
- label explains: "only used when the task request contains video input"

First-release payload example:

```json
{
  "doubao-seedance-1-0-pro-250528": 0.5,
  "doubao-seedance-2-0-260128": 0.6086956522
}
```

Frontend translates this to backend option format:

```json
{
  "video_input": {
    "doubao-seedance-1-0-pro-250528": 0.5,
    "doubao-seedance-2-0-260128": 0.6086956522
  }
}
```

This keeps phase 1 simple while preserving the future backend shape.

## Data Flow

### Save flow

1. Admin edits `Video Input Ratio` in web UI.
2. Frontend wraps the edited map into:
   - `{ "video_input": { ... } }`
3. Frontend calls `PUT /api/option/` with key `TaskConditionRatio`.
4. Backend validates JSON and refreshes cache.

### Billing flow

1. User submits video task.
2. Task adaptor detects whether request includes video input.
3. Adaptor calls config accessor for `video_input`.
4. If found, adaptor returns `OtherRatios["video_input"] = configuredRatio`.
5. Submit pre-charge uses that multiplier.
6. Completion token recalculation reuses stored `OtherRatios`.

## Validation Rules

- only positive numbers greater than `0`
- `1.0` means no discount / no change
- empty JSON means no configured overrides
- unknown model names are allowed, consistent with existing ratio settings
- invalid JSON rejects save

## Backward Compatibility

- Existing deployments continue working without setting `TaskConditionRatio`.
- Current hard-coded Doubao defaults remain as fallback until explicitly overridden in config.
- No migration is needed for existing `ModelRatio` / `ModelPrice`.

## Risks

### Risk 1: Configuration ambiguity

Admins may misunderstand whether they should put the base no-video price into `ModelRatio` or directly into `TaskConditionRatio`.

Mitigation:

- UI help text must explicitly state:
  - `ModelRatio` stores the base no-video-input price
  - `Video Input Ratio` stores the multiplier applied only when input contains video

### Risk 2: Future expansion pressure

If `seconds` and `resolution` later become admin-configurable, the first-release textarea may not scale well.

Mitigation:

- backend already uses the generic keyed shape
- a richer UI can be added later without storage migration

### Risk 3: Divergence between defaults and config

Some models may exist in hard-coded defaults but not in UI config.

Mitigation:

- always document fallback precedence:
  - configured override
  - hard-coded adaptor default
  - no multiplier

## Testing Plan

### Backend

- parsing and validation for `TaskConditionRatio`
- accessor tests for `GetTaskConditionRatio`
- adaptor tests:
  - video input present + configured ratio
  - video input present + no configured ratio + fallback default
  - no video input

### Frontend

- save/load of the new option
- invalid JSON rejection
- payload wrapping to backend shape

### Integration

- create Seedance task without video input
- create Seedance task with video input
- verify `OtherRatios.video_input`
- verify final quota recalculation matches configured multiplier

## Implementation Boundary

This design only covers:

- storage for conditional task ratio config
- backend accessor and fallback
- one admin UI section for `video_input`

It does not include:

- generic visual rule builder
- `seconds` / `resolution` config UI
- migration of all task adaptors to a generic condition registry

## Recommendation Summary

Implement a new option key:

- `TaskConditionRatio`

Use a future-safe backend shape:

```json
{
  "video_input": {
    "model-a": 0.5
  }
}
```

Expose only one first-phase admin editor:

- `Video Input Ratio`

Keep hard-coded Doubao defaults as fallback until admins override them in UI.
