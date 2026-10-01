# Implementation Plan: Fix Discrete Legend Filtering After updateSpec

**Branch**: `011-fix-discrete-legend-filter-after-update-spec` | **Date**: 2026-04-21 | **Spec**: [/Users/bytedance/Documents/GitHub/VChart3/specs/011-fix-discrete-legend-filter-after-update-spec/spec.md](/Users/bytedance/Documents/GitHub/VChart3/specs/011-fix-discrete-legend-filter-after-update-spec/spec.md)
**Input**: Feature specification from `/specs/011-fix-discrete-legend-filter-after-update-spec/spec.md`

## Summary

Fix the discrete legend regression reported in issue #4566 by clearing the stale vrender legend instance during `BaseLegend.clear()`. The root cause is that the `reCompile` path releases the old legend component but leaves `_legendComponent` populated, so the next layout pass reuses a dead instance and skips the event-binding path that connects legend clicks back into VChart filtering. Add a focused regression test that reproduces `updateSpecSync(..., { reMake: false })` with `legends.data: items => items`.

## Technical Context

**Language/Version**: TypeScript 4.9.x  
**Primary Dependencies**: `@visactor/vrender-components`, `@visactor/vutils`, `@visactor/vdataset`  
**Testing**: Jest 26 unit tests under `packages/vchart/__tests__`, plus `tsc --noEmit`  
**Target Platform**: Browser and cross-platform chart runtime  
**Project Type**: Monorepo charting library package (`packages/vchart`)  
**Constraints**: Keep the fix scoped to legend lifecycle cleanup; avoid changing discrete legend filtering semantics; preserve existing `reMake: true` behavior

## Constitution Check

- Pass: The change is narrowly scoped to the documented bug path.
- Pass: The fix reuses the existing legend rebuild path instead of adding a new special-case update branch.
- Pass: Regression coverage is added for the exact user-visible interaction.

## Project Structure

```text
specs/011-fix-discrete-legend-filter-after-update-spec/
├── plan.md
├── spec.md
└── tasks.md
```

```text
packages/vchart/
├── src/component/legend/base-legend.ts
└── __tests__/unit/core/vchart-event.test.ts
```

## Implementation Strategy

1. Reproduce the regression with a focused event test that uses a discrete legend `data` callback and `updateSpecSync(..., { reMake: false })`.
2. Fix legend lifecycle cleanup by nulling `_legendComponent` after releasing the old vrender component so the next compile path recreates and rebinds it.
3. Run the focused Jest test file and TypeScript compile check to verify the regression and avoid collateral breakage.
