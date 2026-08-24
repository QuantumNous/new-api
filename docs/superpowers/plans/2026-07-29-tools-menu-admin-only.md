# Tools Menu Admin-Only Visibility Implementation Plan

**Goal:** Hide the root sidebar `tools` group from regular users while keeping it visible to Admin and Root users without changing the existing `admin` group behavior.

**Architecture:** Keep static menu construction unchanged. Add a small pure `filterToolsGroupByRole` function beside `useSidebarView`, apply it before the existing `admin` group filter, and test the pure tools filter directly so Bun test files do not leak module mocks into unrelated suites.

**Rejected test approach:** Hook-level testing with `mock.module` was rejected after verification showed Bun keeps those partial module replacements process-wide across test files. The mock-heavy hook test contaminated later suites by replacing `react`, `@tanstack/react-router`, and `@/stores/auth-store`, causing failures such as missing `React.createContext`, missing router exports, and `useAuthStore.getState is not a function`.

**Tech Stack:** React 19, TypeScript 6, Bun test, Zustand role state

---

### Task 1: Add role visibility regression coverage

**Files:**
- Create: `web/default/src/hooks/use-sidebar-view.test.ts`
- Modify: `web/default/src/hooks/use-sidebar-view.ts`

- [x] **Step 1: Write the tools-filter behavior test**

Create `web/default/src/hooks/use-sidebar-view.test.ts` without `mock.module`, mutable role state, or dynamic hook imports. Statically import `filterToolsGroupByRole`, `ROLE`, and `NavGroup`, then verify the tools-specific filter against root groups in order `[general, tools, admin]`:

```ts
import { describe, expect, test } from 'bun:test'
import type { NavGroup } from '@/components/layout/types'
import { ROLE } from '@/lib/roles'
import { filterToolsGroupByRole } from './use-sidebar-view'

const navGroups: NavGroup[] = [
  { id: 'general', title: 'General', items: [] },
  { id: 'tools', title: 'Tools', items: [] },
  { id: 'admin', title: 'Admin', items: [] },
]

describe('filterToolsGroupByRole', () => {
  test.each([
    [ROLE.USER, ['general', 'admin']],
    [ROLE.ADMIN, ['general', 'tools', 'admin']],
    [ROLE.SUPER_ADMIN, ['general', 'tools', 'admin']],
    [undefined, ['general', 'admin']],
  ] as const)(
    'filters only the tools group for role %p',
    (role, expectedGroupIds) => {
      expect(
        filterToolsGroupByRole(navGroups, role).map((group) => group.id)
      ).toEqual(expectedGroupIds)
    }
  )
})
```

The regular-user and missing-role expectations intentionally keep `admin` in the helper output. That proves this helper removes only `tools`; the existing independent admin filter remains responsible for admin group visibility.

- [x] **Step 2: Implement the isolated tools-group filter**

Export the pure helper above `useSidebarView` in `web/default/src/hooks/use-sidebar-view.ts`:

```ts
export function filterToolsGroupByRole(
  navGroups: NavGroup[],
  userRole: number | undefined
): NavGroup[] {
  const canViewTools = userRole !== undefined && userRole >= ROLE.ADMIN
  return navGroups.filter((group) =>
    group.id === 'tools' ? canViewTools : true
  )
}
```

Apply it inside the existing `rootNavGroups` memo before the unchanged `admin` filter:

```ts
const rootNavGroups = useMemo<NavGroup[]>(() => {
  const isAdmin = userRole !== undefined && userRole >= ROLE.ADMIN
  const toolsFilteredRoot = filterToolsGroupByRole(
    configFilteredRoot,
    userRole
  )
  return toolsFilteredRoot.filter((group) =>
    group.id === 'admin' ? isAdmin : true
  )
}, [configFilteredRoot, userRole])
```

Update the hook comment from `admin-only group visibility` to `admin and tools group visibility (role-based)` so the documented behavior matches the code.

- [x] **Step 3: Prove mock contamination is fixed**

Run from `web/default`:

```powershell
bun test src/hooks/use-sidebar-view.test.ts src/stores/auth-store.test.ts
```

Expected: 6 pass, 0 fail. This proves the sidebar test no longer replaces the global auth store module for the following auth-store test file.

- [x] **Step 4: Run the focused sidebar tests**

Run from `web/default`:

```powershell
bun test src/hooks/use-sidebar-view.test.ts src/hooks/use-sidebar-data.test.ts
```

Expected: all role-visibility tests and all existing sidebar-data tests pass with zero failures.

- [x] **Step 5: Run static validation and full-suite regression**

Run from `web/default`:

```powershell
bun test
bun run typecheck
bun x eslint src/hooks/use-sidebar-view.ts src/hooks/use-sidebar-view.test.ts
bun x prettier --check src/hooks/use-sidebar-view.ts src/hooks/use-sidebar-view.test.ts
```

Expected: the contamination signatures from the removed mocks do not recur. Any remaining full-suite failures must be reported separately and not fixed outside the scoped files.

- [x] **Step 6: Verify the diff is limited to the requested behavior**

Run from the repository root:

```powershell
git diff --check
git diff -- web/default/src/hooks/use-sidebar-view.ts web/default/src/hooks/use-sidebar-view.test.ts docs/superpowers/plans/2026-07-29-tools-menu-admin-only.md
git status --short
```

Expected: no whitespace errors; production changes are limited to exporting and using `filterToolsGroupByRole`; the test has no module mocks.

- [x] **Step 7: Amend the implementation commit**

```powershell
git add -- web/default/src/hooks/use-sidebar-view.ts web/default/src/hooks/use-sidebar-view.test.ts
git add -f -- docs/superpowers/plans/2026-07-29-tools-menu-admin-only.md
git commit --amend --no-edit
```
