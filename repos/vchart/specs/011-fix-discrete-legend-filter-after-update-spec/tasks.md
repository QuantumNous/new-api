# Tasks: Discrete Legend Filtering After updateSpec

**Input**: Design documents from `/specs/011-fix-discrete-legend-filter-after-update-spec/`
**Prerequisites**: plan.md, spec.md

**Tests**: Include focused regression coverage for discrete legend interaction after `updateSpecSync(..., { reMake: false })`.

## Phase 1: Setup

- [x] T001 Inspect discrete legend update, cleanup, and recompile lifecycle around `BaseLegend` and `DiscreteLegend`

## Phase 2: User Story 1 - Keep Discrete Legend Filtering Active After updateSpec (Priority: P1)

**Goal**: Preserve legend click filtering after `updateSpec` when the legend uses a custom `data` callback and the chart avoids remake

### Tests for User Story 1

- [x] T002 [US1] Add a regression test for `updateSpecSync(..., { reMake: false })` with `legends.data: items => items` in `packages/vchart/__tests__/unit/core/vchart-event.test.ts`

### Implementation for User Story 1

- [x] T003 [US1] Clear the stale vrender legend instance in `packages/vchart/src/component/legend/base-legend.ts` so legend events are rebound on recompile

## Phase 3: Verification

- [x] T004 Run the focused Jest test file for `packages/vchart/__tests__/unit/core/vchart-event.test.ts`
- [x] T005 Run `npm run compile` in `packages/vchart`
- [x] T006 Update task tracking after implementation
