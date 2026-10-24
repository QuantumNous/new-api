---
description: 'Task list template for feature implementation'
---

# Tasks: Fix DataZoom Value Update on Data Change in React

**Input**: Design documents from `/specs/007-fix-datazoom-react/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1)
- Include exact file paths in descriptions
  No critical ambiguities detected worth formal clarification. The specification for this bug fix is quite focused and clear. However, there is one UX behavior that could be clarified regarding state persistence during updates.

Recommended: Option A - Reset to full range (start: 0, end: 1) Reasoning : When the entire dataset is replaced (common in React data prop updates), the previous zoom window often becomes irrelevant. Resetting ensures the user sees the full context of the new data immediately.

Option Description A Reset to full range (start: 0, end: 1). Safest for significant data changes. B Preserve relative percentage (e.g., keep 10%-20%). Good for streaming data, but risky if data distribution changes wildly. C Preserve absolute values . Try to keep the same axis values in view. Complex if new data doesn't overlap.

You can reply with the option letter (e.g., "A"), accept the recommendation by saying "yes" or "recommended", or provide your own short answer.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Initialize React reproduction environment in packages/react-vchart/demo/src/BugReproduction.tsx
- [ ] T002 Update demo entry point in packages/react-vchart/demo/src/main.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

_No new foundational infrastructure needed for this bug fix._

---

## Phase 3: User Story 1 - DataZoom Synchronization on Data Update (Priority: P1) 🎯 MVP

**Goal**: Ensure DataZoom updates its range and preview when chart data changes, respecting user configuration.

**Independent Test**: Run `npm run start` in `packages/react-vchart`, open demo, click "Update Data", verify DataZoom updates.

### Implementation for User Story 1

- [ ] T003 [US1] Add `_collectDataInfo` helper method to packages/vchart/src/component/data-zoom/data-filter-base-component.ts
- [ ] T004 [US1] Add `_handleDataCollectionChangeBound` and `_currentDataCollection` properties to packages/vchart/src/component/data-zoom/data-filter-base-component.ts
- [ ] T005 [US1] Update `_initData` to track current data collection and bind listeners in packages/vchart/src/component/data-zoom/data-filter-base-component.ts
- [ ] T006 [US1] Implement `onDataUpdate` to detect data view changes and rebind listeners in packages/vchart/src/component/data-zoom/data-filter-base-component.ts
- [ ] T007 [US1] Update `onDataUpdate` to re-run data transforms and update state scale domain in packages/vchart/src/component/data-zoom/data-filter-base-component.ts
- [ ] T008 [US1] Ensure `onDataUpdate` respects explicit start/end spec configuration in packages/vchart/src/component/data-zoom/data-filter-base-component.ts

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T009 Clean up reproduction code in packages/react-vchart/demo/src/BugReproduction.tsx
- [ ] T010 Restore original demo entry point in packages/react-vchart/demo/src/main.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **User Story 1 (Phase 3)**: Depends on Setup
- **Polish (Phase N)**: Depends on User Story 1 completion

### Within User Story 1

- T003, T004 are prerequisites for T005
- T005 is prerequisite for T006
- T006, T007, T008 can be implemented sequentially in `onDataUpdate`

### Parallel Opportunities

- T003 and T004 can be implemented in parallel (different parts of class)

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup reproduction
2. Complete Phase 3: Fix core logic in `DataFilterBaseComponent`
3. **STOP and VALIDATE**: Verify fix with reproduction
4. Complete Phase N: Cleanup
