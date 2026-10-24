# Tasks: Size Legend Handler Text Layout

**Input**: Design documents from `/specs/008-fix-size-legend-handler-text/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Include focused unit regression coverage because this is a bug fix.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm the feature scope and target files before code changes

- [x] T001 Inspect continuous legend interfaces and existing style transformation flow in packages/vchart/src/component/legend/continuous/interface.ts and packages/vchart/src/component/legend/continuous/util.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Establish the callback contract reused by the implementation and tests

- [x] T002 Inspect existing callback-capable legend style types for reuse in packages/vchart/src/component/legend/discrete/interface.ts

**Checkpoint**: Callback contract choice is settled and user story work can proceed

---

## Phase 3: User Story 1 - Render Handler Text Without Overlap (Priority: P1) 🎯 MVP

**Goal**: Preserve a supported path for dynamic handler text positioning so authors can keep size legend handler text readable during drag interactions

**Independent Test**: Build continuous legend attributes from a size legend spec whose `handlerText.style` is a callback and confirm the callback survives transformation with returned offsets/styles converted correctly

### Tests for User Story 1

- [x] T003 [P] [US1] Add continuous legend regression tests for static and callback `handlerText.style` in packages/vchart/__tests__/unit/component/legend/continuous-legend.test.ts

### Implementation for User Story 1

- [x] T004 [US1] Extend continuous legend handler text style typings to accept callbacks in packages/vchart/src/component/legend/continuous/interface.ts
- [x] T005 [US1] Verify continuous legend attribute transformation preserves callback-based handler text styles in packages/vchart/src/component/legend/continuous/util.ts

**Checkpoint**: Size legend handler text supports callback styling and the regression test proves the transform path

---

## Phase 4: User Story 2 - Use Dynamic Handler Text Styling (Priority: P2)

**Goal**: Keep the public configuration contract explicit and documented for function-based handler text styles

**Independent Test**: Review the feature contract and ensure the public type now matches the supported runtime behavior

### Implementation for User Story 2

- [x] T006 [US2] Update the feature contract notes to reflect callback-based `handlerText.style` support in specs/008-fix-size-legend-handler-text/contracts/handler-text-style.md

**Checkpoint**: Public contract and implementation are aligned

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Validate the finished change and sync task tracking

- [ ] T007 Run the focused Jest regression for continuous legend handler text support
- [x] T008 Mark completed tasks in specs/008-fix-size-legend-handler-text/tasks.md after implementation and verification

---

## Dependencies & Execution Order

- T001 -> T002 -> T003/T004/T005
- T003 should be written before or alongside T004/T005 and must validate the user-facing behavior
- T006 depends on implementation decisions from T004/T005
- T007 depends on T003-T006
- T008 depends on all prior tasks completing

## Parallel Opportunities

- T003 can be prepared while T004 is being implemented, but both touch the same feature and should stay tightly coordinated

## Implementation Strategy

### MVP First

1. Complete T001-T002 to lock the callback contract.
2. Complete T003-T005 to support callback-based `handlerText.style`.
3. Run T007 to verify the regression path.
4. Complete T006 and T008 to finish documentation and task tracking.
