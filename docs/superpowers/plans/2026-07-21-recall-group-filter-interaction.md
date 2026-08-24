# Recall Group Filter Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Disable and clear the recall user-group input when no group filtering is selected.

**Architecture:** Add one pure normalization helper and call it from the existing group-mode change handler. Keep the existing form layout and payload contract unchanged, and cover both state normalization and rendered disabled state.

**Tech Stack:** React 19, react-hook-form, TypeScript, Bun test, server-side React test rendering.

---

### Task 1: Normalize the group filter state

**Files:**
- Modify: `web/default/src/features/recall-campaigns/helpers.ts`
- Test: `web/default/src/features/recall-campaigns/helpers.test.ts`

- [ ] **Step 1: Write the failing normalization test**

Add assertions that a no-filter mode returns an empty group array and allow/block modes preserve the supplied group array.

- [ ] **Step 2: Verify the test fails**

Run: `bun test src/features/recall-campaigns/helpers.test.ts`

Expected: FAIL because `normalizeRecallGroupsForMode` does not exist.

- [ ] **Step 3: Implement the minimal helper**

```ts
export function normalizeRecallGroupsForMode(
  groups: string[],
  mode: RecallGroupMode
): string[] {
  return mode === '' ? [] : groups
}
```

- [ ] **Step 4: Verify the helper tests pass**

Run: `bun test src/features/recall-campaigns/helpers.test.ts`

Expected: all helper tests pass.

### Task 2: Disable and clear the editor field

**Files:**
- Modify: `web/default/src/features/recall-campaigns/components/campaign-editor.tsx`
- Test: `web/default/src/features/recall-campaigns/components/campaign-editor.test.tsx`

- [ ] **Step 1: Write the failing editor test**

Render drafts with `group_mode: ''` and `group_mode: 'allow'`. Assert the input with `id="recall-groups"` is visible and disabled only in the no-filter draft.

- [ ] **Step 2: Verify the test fails**

Run: `bun test src/features/recall-campaigns/components/campaign-editor.test.tsx`

Expected: FAIL because the group input has no stable ID and is not disabled for no-filter mode.

- [ ] **Step 3: Implement the minimal editor behavior**

Watch `audience_config.group_mode`, associate the label with `recall-groups`, disable the input for empty mode, and replace the inline mode setter with a handler that also stores `normalizeRecallGroupsForMode(currentGroups, mode)`.

- [ ] **Step 4: Verify the editor and recall tests pass**

Run: `bun test src/features/recall-campaigns`

Expected: all recall campaign tests pass with zero failures.

- [ ] **Step 5: Run static checks**

Run: `bun run typecheck`, `bun x eslint src/features/recall-campaigns`, `bun x prettier --check src/features/recall-campaigns`, and `git diff --check`.

Expected: every command exits successfully with no errors.

