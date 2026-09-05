# Implementation Plan: Fix mark state issue during updateSpec

## Summary
Fix an issue where mark states were not properly cleared when `updateSpec` was called, causing incorrect state persistence.

## Technical Context
The `updateSpec` process re-initializes marks but previous state information was lingering.
Changes include:
- Added `clearAllStateInfo` method to `IMarkStateManager` interface and implementation.
- Added `clearBeforeReInit` method to `IMarkRaw` interface and implementation.
- Invoked `clearBeforeReInit` in `BaseMark` during re-initialization.
- Updated `BaseSeries` to handle state cleanup during spec updates.

### Source Code (repository root)
```
packages/vchart/src/compile/mark/interface.ts
packages/vchart/src/compile/mark/mark-state-manager.ts
packages/vchart/src/mark/base/base-mark.ts
packages/vchart/src/mark/interface/common.ts
packages/vchart/src/series/base/base-series.ts
```

## Verification Plan
- Verify that mark states (e.g., hover, select) are reset correctly after `updateSpec`.
- Ensure no regression in normal state interactions.
