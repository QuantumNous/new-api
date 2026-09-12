# Tasks: Heatmap Scrollbar Axis Direction

**Input**: Design documents from `/specs/009-fix-heatmap-scrollbar-axis-direction/`
**Prerequisites**: plan.md, spec.md

**Tests**: Include focused unit regression coverage for the reversed vertical axis path.

## Phase 1: Setup

- [x] T001 Inspect scrollbar reverse-mapping logic and compare it with `dataZoom`

## Phase 2: User Story 1 - Keep Vertical Scroll Direction Consistent (Priority: P1)

**Goal**: Make right-side heatmap scrollbar movement and left-axis viewport order move in the same direction

### Tests for User Story 1

- [x] T002 [US1] Add a scrollbar regression test for reversed vertical axis mapping in `packages/vchart/__tests__/unit/component/data-zoom/scroll-bar/scroll-bar.test.ts`

### Implementation for User Story 1

- [x] T003 [US1] Reuse shared reverse-axis detection in `packages/vchart/src/component/data-zoom/scroll-bar/scroll-bar.ts`

## Phase 3: Polish

- [ ] T004 Run the focused Jest test for scrollbar regressions
- [x] T005 Update task tracking after implementation
