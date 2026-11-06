# Implementation Plan: Fix Map Roam Drag in Pointer-Only Mobile Browsers

**Branch**: `009-fix-map-roam-pointer-drag` | **Date**: 2026-03-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/009-fix-map-roam-pointer-drag/spec.md`

## Summary

This plan fixes a map roam drag bug where mobile browsers lose stable vertical dragging after `supportsTouchEvents` is forced to `false`, because the browser's default touch gesture handling interrupts pointer-based drag sequences for geo roam regions.

## Technical Context

**Language/Version**: TypeScript 4.x  
**Primary Dependencies**:
- `@visactor/vrender-core`: Provides stage, canvas access, and global environment capability flags.
- `@visactor/vutils`: Provides utility helpers already used by the compiler layer.  
**Storage**: N/A  
**Testing**: No new automated test is required for this change.  
**Target Platform**: Browser rendering, especially mobile browsers using pointer events without touch events.  
**Project Type**: Visualization Library (Monorepo)  
**Performance Goals**: No regression in render or interaction performance.  
**Constraints**: Must only affect geo roam drag scenarios and must not globally disable page scroll for unrelated charts.  
**Scale/Scope**: Compiler-level canvas style adjustment for map roam interaction.

## Constitution Check

- [x] Quality First: Fix is isolated to the browser interaction environment for the affected scenario.
- [x] User Experience-Driven: Removes a broken drag path in a valid mobile embedding scenario.
- [x] SDD: Uses specs as the semantic source for delivery artifacts.
- [x] Unit Tests: Not required for this change by request.
- [x] Compatibility: Non-breaking fix (PATCH).

## Project Structure

### Documentation (this feature)

```text
specs/009-fix-map-roam-pointer-drag/
├── plan.md
├── spec.md
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
packages/vchart/
├── src/
│   └── compile/
│       └── compiler.ts
└── specs/
    └── 009-fix-map-roam-pointer-drag/
        ├── plan.md
        ├── spec.md
        └── checklists/
            └── requirements.md
```

**Structure Decision**: Update the compiler canvas style handling in `packages/vchart/src/compile/compiler.ts` and describe the change in a dedicated spec directory for downstream changelog, commit, and PR generation.
