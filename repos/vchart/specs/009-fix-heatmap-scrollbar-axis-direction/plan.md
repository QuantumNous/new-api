# Implementation Plan: Fix Heatmap Scrollbar Axis Direction

**Branch**: `009-fix-heatmap-scrollbar-axis-direction` | **Date**: 2026-03-23 | **Spec**: [/data00/home/lixuefei.1313/github/VChart/specs/009-fix-heatmap-scrollbar-axis-direction/spec.md](/data00/home/lixuefei.1313/github/VChart/specs/009-fix-heatmap-scrollbar-axis-direction/spec.md)
**Input**: Feature specification from `/specs/009-fix-heatmap-scrollbar-axis-direction/spec.md`

## Summary

Fix the heatmap scrollbar and left-axis direction mismatch by aligning `ScrollBar` with `DataZoom` when converting scrollbar state percentages back into domain values. Add a focused regression test covering a vertical reversed discrete axis, which is the path exercised by the heatmap reproduction.

## Technical Context

**Language/Version**: TypeScript 4.9.x  
**Primary Dependencies**: `@visactor/vscale`, `@visactor/vutils`, `@visactor/vrender-components`  
**Testing**: Jest 26 unit tests under `packages/vchart/__tests__`  
**Target Platform**: Browser and cross-platform cartesian chart runtime  
**Project Type**: Monorepo charting library package (`packages/vchart`)  
**Constraints**: Preserve existing `dataZoom` behavior; avoid changing axis range calculation; keep the fix scoped to scrollbar state-domain conversion

## Constitution Check

- Pass: The work is narrowly scoped to the documented bug.
- Pass: The change reuses an existing shared utility instead of introducing a new behavior branch.
- Pass: Regression coverage will be added for the user-visible bug path.

## Project Structure

```text
specs/009-fix-heatmap-scrollbar-axis-direction/
├── plan.md
├── spec.md
└── tasks.md
```

```text
packages/vchart/
├── src/component/data-zoom/scroll-bar/scroll-bar.ts
└── __tests__/unit/component/data-zoom/scroll-bar/scroll-bar.test.ts
```

## Implementation Strategy

1. Update `ScrollBar._handleChange` to derive `startValue` and `endValue` with `isReverse(axis, this._isHorizontal)`.
2. Add a regression test that mocks a reversed vertical band axis and asserts scrollbar state `0 -> 0.5` maps to the top half of the domain.
3. Run the focused Jest test file and inspect the diff for unintended churn.
