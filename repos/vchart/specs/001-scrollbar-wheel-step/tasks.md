# Tasks: Scrollbar Fixed Step & Min Height

**Feature**: Scrollbar Fixed Step & Min Height
**Status**: Completed
**Spec**: [spec.md](spec.md)
**Plan**: [plan.md](plan.md)

## Phase 1: Setup

- [x] T001 Verify development environment and dependencies are installed

## Phase 2: Foundational

- [x] T002 Update `IScrollBarSpec` interface in `packages/vchart-types/types/component/data-zoom/scroll-bar/interface.d.ts` and `packages/vchart/src/component/data-zoom/scroll-bar/interface.ts` to include `scrollStep` and `minSliderSize`

## Phase 3: User Story 1 - Fixed Step Scrolling (P1)

**Goal**: Enable fixed pixel distance scrolling when using mouse wheel.

- [x] T003 [US1] Implement fixed step scrolling logic in `packages/vchart/src/component/data-zoom/data-filter-event.ts`
- [x] T004 [US1] Add unit tests for fixed step scrolling behavior in `packages/vchart/__tests__/unit/component/data-zoom/data-filter-event.test.ts` (create if needed)

## Phase 4: User Story 2 - Minimum Slider Visibility (P1)

**Goal**: Ensure scrollbar slider maintains a minimum size for visibility.

- [x] T005 [US2] Implement minimum slider size calculation in `packages/vchart/src/component/data-zoom/scroll-bar/scroll-bar.ts`
- [x] T006 [US2] Add unit tests for slider size calculation in `packages/vchart/__tests__/unit/component/data-zoom/scroll-bar/scroll-bar.test.ts` (create if needed)

## Final Phase: Polish & Cross-Cutting

- [x] T007 Verify cross-platform behavior (Desktop vs H5) and interaction consistency
- [x] T008 Update API documentation and add examples for `scrollStep` and `minSliderSize`

## Dependencies

1. **Foundational** (T002) blocks **US1** and **US2**.
2. **US1** (T003, T004) and **US2** (T005, T006) are independent and can be executed in parallel.

## Implementation Strategy

1. **MVP**: Complete Phase 2 (Types) and Phase 3 (US1 - Fixed Step) first as it involves interaction logic changes.
2. **Follow-up**: Complete Phase 4 (US2 - Min Size) which is primarily a rendering adjustment.
3. **Verification**: Ensure no regression in existing percentage-based scrolling or default slider behavior.
