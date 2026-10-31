# Implementation Plan: Fix DataZoom Value Update on Data Change in React

**Branch**: `007-fix-datazoom-react` | **Date**: 2025-02-09 | **Spec**: [specs/007-fix-datazoom-react/spec.md](../spec.md)
**Input**: Feature specification from `specs/007-fix-datazoom-react/spec.md`

## Summary

The `DataZoom` component in ReactVChart currently fails to update when the chart data source changes (Issue #4185). The primary requirement is to ensure `DataZoom` detects data updates, unbinds from old DataViews, binds to new ones, and correctly re-renders its preview and applies any explicit range configurations (start/end) from the spec.

## Technical Context

**Language/Version**: TypeScript 4.x+ (Project uses TS)
**Primary Dependencies**: `@visactor/vchart` (Core logic), `@visactor/react-vchart` (React wrapper)
**Storage**: N/A (In-memory chart state)
**Testing**: Jest (Unit tests), Manual verification via demo
**Target Platform**: Web (React environment)
**Project Type**: Monorepo (Rush.js managed)
**Performance Goals**: Update should happen within a single render cycle; no noticeable lag (<16ms ideal for interaction, update <100ms).
**Constraints**: Must maintain backward compatibility; must not introduce memory leaks (listener cleanup).
**Scale/Scope**: Affects all VChart users using DataZoom in React with dynamic data.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Quality First**: Fix addresses a functional bug and prevents memory leaks (listener cleanup).
- [x] **User Experience-Driven**: Ensures UI reflects data state accurately.
- [x] **Specification-Driven Development**: Follows SDD process (Spec -> Plan -> Tasks).
- [x] **Openness & Collaboration**: Code will be reviewed via PR.
- [x] **Monorepo/Rush Governance**: Changes will be in `packages/vchart` (core logic) and `packages/react-vchart` (if needed for prop handling, though core fix likely sufficient).
- [x] **TypeScript**: Strict typing required.
- [x] **Testing**: Unit tests required for new logic.

## Project Structure

### Documentation (this feature)

```text
specs/007-fix-datazoom-react/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (N/A for this fix)
├── quickstart.md        # Phase 1 output (N/A)
├── contracts/           # Phase 1 output (N/A)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
packages/
├── vchart/
│   └── src/
│       └── component/
│           └── data-zoom/
│               └── data-filter-base-component.ts  # Core logic modification target
└── react-vchart/
    └── demo/
        └── src/
            └── BugReproduction.tsx                # Verification demo
```

**Structure Decision**: Modification is primarily in `@visactor/vchart` core component logic to robustly handle data view changes.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| None      |            |                                     |
