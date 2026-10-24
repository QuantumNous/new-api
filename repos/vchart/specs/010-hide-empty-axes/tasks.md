# Tasks: Hide Axes For Empty Series

## Phase 1: Setup

- [x] T001 Review existing cartesian axis visibility and data collection flow in `packages/vchart/src/component/axis/base-axis.ts` and `packages/vchart/src/component/axis/cartesian/axis.ts`

## Phase 2: Foundational

- [x] T002 Add the public `hideWhenEmpty` axis option in `packages/vchart/src/component/axis/interface/spec.ts`
- [x] T003 Add the declaration for `hideWhenEmpty` in `packages/vchart-types/types/component/axis/interface/spec.d.ts`

## Phase 3: User Story 1 - Suppress Empty Axes

**Goal**: Hide a cartesian axis when its bound series do not produce any collected axis data.

**Independent Test**: Render a chart with `hideWhenEmpty: true` on a cartesian axis and empty bound series data, then verify the axis does not render or consume layout space.

- [x] T004 [US1] Implement runtime empty-axis visibility evaluation in `packages/vchart/src/component/axis/base-axis.ts`
- [x] T005 [US1] Update cartesian axis layout/render flow to honor runtime empty-axis visibility in `packages/vchart/src/component/axis/cartesian/axis.ts`
- [x] T006 [US1] Add regression coverage for initial empty-axis hiding in `packages/vchart/__tests__/unit/component/cartesian/axis/hide-when-empty.test.ts`

## Phase 4: User Story 2 - Preserve Existing Defaults

**Goal**: Keep current behavior unchanged when `hideWhenEmpty` is not enabled.

**Independent Test**: Render an existing chart without `hideWhenEmpty` and verify the axis behavior matches current output.

- [x] T007 [US2] Ensure default axis behavior remains unchanged when `hideWhenEmpty` is unset in `packages/vchart/src/component/axis/base-axis.ts`
- [x] T008 [US2] Add regression coverage for unchanged default behavior in `packages/vchart/__tests__/unit/component/cartesian/axis/hide-when-empty.test.ts`

## Phase 5: User Story 3 - Mixed Axis Visibility And Runtime Updates

**Goal**: Hide only empty axes and restore visibility automatically when data appears later.

**Independent Test**: Render a chart with multiple cartesian axes, confirm only empty axes are hidden, then update data and verify hidden axes reappear automatically.

- [x] T009 [US3] Support runtime axis visibility toggling after data/spec updates in `packages/vchart/src/component/axis/base-axis.ts`
- [x] T010 [US3] [P] Add mixed-axis and runtime update coverage in `packages/vchart/__tests__/unit/component/cartesian/axis/hide-when-empty.test.ts`

## Final Phase: Polish & Cross-Cutting Concerns

- [ ] T011 Run targeted unit tests for axis visibility regressions
- [x] T012 Mark completed tasks and confirm implementation matches `specs/010-hide-empty-axes/spec.md`
