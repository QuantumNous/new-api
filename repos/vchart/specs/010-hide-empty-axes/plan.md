# Implementation Plan: Hide Axes For Empty Series

**Branch**: `010-hide-empty-axes` | **Date**: 2026-03-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/010-hide-empty-axes/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Add an opt-in `hideWhenEmpty` axis option for cartesian axes. The axis should hide when its bound series produce no collected axis data, while preserving existing behavior by default. The implementation will separate user-configured visibility from runtime empty-data visibility so the axis can auto-hide and reappear after `updateData` or `updateSpec` without requiring chart remake.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: TypeScript 4.9.5  
**Primary Dependencies**: `@visactor/vchart`, `@visactor/vutils`, `@visactor/vrender-components`  
**Storage**: N/A  
**Testing**: Jest  
**Target Platform**: Web and cross-terminal chart runtimes supported by VChart  
**Project Type**: Monorepo / Chart library  
**Performance Goals**: No noticeable render or update regression; axis visibility recalculation should stay within existing axis domain update flow  
**Constraints**: Cartesian axes only for this scope; must support runtime auto hide/show after data updates; must preserve existing behavior when option is unset  
**Scale/Scope**: Public axis spec in `packages/vchart` and `packages/vchart-types`, axis runtime behavior in cartesian axis base flow, targeted unit regression coverage

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Quality First**: The change is localized to existing axis infrastructure and includes regression tests.
- [x] **UX Driven**: Empty axes are hidden only when explicitly requested, reducing visual noise without breaking defaults.
- [x] **SDD**: Spec, plan, research, data model, contracts, and tasks are captured before implementation.
- [x] **Monorepo Boundaries**: Public type changes stay in `packages/vchart` and `packages/vchart-types`; runtime logic stays in `packages/vchart`.
- [x] **Testing & Regression**: Add unit coverage for initial empty render, mixed axis visibility, and runtime data updates.

## Project Structure

### Documentation (this feature)

```text
specs/010-hide-empty-axes/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
└── tasks.md
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
packages/vchart/src/component/axis/
├── base-axis.ts                         # Common axis runtime behavior
├── interface/spec.ts                    # Shared public axis spec source
├── cartesian/interface/spec.ts          # Cartesian axis spec source
└── cartesian/axis.ts                    # Cartesian axis layout/update behavior

packages/vchart-types/types/component/axis/
├── interface/spec.d.ts                  # Shared public axis type declarations
└── cartesian/interface/spec.d.ts        # Cartesian axis declaration exports

packages/vchart/__tests__/unit/
└── component/cartesian/axis/            # Axis runtime regression tests
```

**Structure Decision**: Extend the existing cartesian axis runtime instead of introducing a new chart-level visibility mechanism. This keeps the behavior close to axis data collection and minimizes cross-package impact.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | | |
