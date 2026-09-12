# Implementation Plan: Size Legend Handler Text Layout

**Branch**: `008-fix-size-legend-handler-text` | **Date**: 2026-03-20 | **Spec**: [/data00/home/lixuefei.1313/github/VChart/specs/008-fix-size-legend-handler-text/spec.md](/data00/home/lixuefei.1313/github/VChart/specs/008-fix-size-legend-handler-text/spec.md)
**Input**: Feature specification from `/specs/008-fix-size-legend-handler-text/spec.md`

## Summary

Allow size legend `handlerText.style` to accept function-based values in the same way other legend style hooks already do, and add regression coverage proving the style callback is preserved through continuous legend attribute transformation. This gives chart authors a supported way to adjust handler text positioning dynamically and avoid overlap during handler movement.

## Technical Context

**Language/Version**: TypeScript 4.9.x  
**Primary Dependencies**: `@visactor/vutils`, `@visactor/vutils-extension`, `@visactor/vrender-components`  
**Storage**: N/A  
**Testing**: Jest 26 unit tests under `packages/vchart/__tests__`  
**Target Platform**: Cross-platform chart runtime for browser and mini-app wrappers
**Project Type**: Monorepo charting library package (`packages/vchart`)  
**Performance Goals**: Preserve existing continuous legend interaction performance and stay within the constitution target for high-frequency interactions (<16ms budget)  
**Constraints**: Keep backward compatibility for existing static `handlerText` config; avoid changing unrelated legend layout behavior; keep type/schema generation compatible with current public spec model  
**Scale/Scope**: One public legend configuration path, one transformation utility, and focused unit regression coverage in `packages/vchart`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Pass: Change is specification-driven and limited to the bug scope documented in the feature spec.
- Pass: Work stays inside `@visactor/vchart` package boundaries and does not introduce new cross-package coupling.
- Pass: The fix is a backward-compatible bug fix, aligned with patch-level behavior.
- Pass: A regression test will be added for the transformed continuous legend attributes, satisfying the constitution requirement for bug-fix coverage.
- Pass: No new runtime dependency or license review is required.

## Project Structure

### Documentation (this feature)

```text
specs/008-fix-size-legend-handler-text/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── handler-text-style.md
└── tasks.md
```

### Source Code (repository root)

```text
packages/vchart/
├── src/
│   ├── component/legend/continuous/
│   │   ├── interface.ts
│   │   └── util.ts
│   └── util/
│       └── style.ts
└── __tests__/
    └── unit/
        └── component/
            └── legend/
                └── continuous-legend.test.ts
```

**Structure Decision**: Implement the fix in `packages/vchart/src/component/legend/continuous/interface.ts` and verify behavior with a focused unit test under `packages/vchart/__tests__/unit/component/legend/`. Existing transformation logic in `packages/vchart/src/util/style.ts` is reused rather than duplicated.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None | N/A | N/A |
