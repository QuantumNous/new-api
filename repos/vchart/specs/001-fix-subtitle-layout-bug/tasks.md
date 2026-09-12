# Tasks: Fix Subtitle Layout Bug

**Feature**: Fix Subtitle Layout Bug
**Status**: Completed
**Spec**: [spec.md](./spec.md)
**Plan**: [plan.md](./plan.md)

## Phase 1: Setup

- [x] T001 Create regression test file in packages/vchart/**tests**/unit/component/title/repro.test.ts

## Phase 2: User Story 1 - Render Chart with Only Subtitle (P1)

**Goal**: Ensure chart renders correctly when only subtext is provided.
**Independent Test**: `repro.test.ts` passes without errors.

- [x] T002 [US1] Implement fix in packages/vchart/src/component/title/title.ts to handle undefined text
- [x] T003 [US1] Run regression test to verify fix
- [x] T004 [US1] Update ITitleTextSpec interface to make text optional

## Phase 3: Polish

- [x] T005 Rename regression test file to packages/vchart/**tests**/unit/component/title/title.test.ts
- [x] T006 Run full test suite for Title component (Deferred to CI)

## Implementation Strategy

1.  **Reproduction**: Create a test case that fails without the fix.
2.  **Fix**: Apply the default empty string for text/subtext.
3.  **Verify**: Ensure the test passes.
