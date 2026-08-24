# Tools Menu Admin-Only Visibility Design

## Goal

Hide the root sidebar `tools` group from regular users while keeping it visible to Admin and Root users.

## Scope

- Apply role-based visibility only to the `tools` group.
- Keep the existing `admin` group visibility rule unchanged.
- Keep the `Get Started` and `API Marketplace` menu entries unchanged for Admin and Root users.
- Keep `/quickstart` and `/api-marketplace` routes and backend behavior unchanged.

## Current Behavior

`buildSidebarData` always creates the `tools` group. `useSidebarView` currently applies an Admin-or-higher role check only when `group.id === 'admin'`, so regular users still receive the `tools` group in the rendered root sidebar.

## Considered Approaches

1. Add a second centralized role rule in the root sidebar visibility filter. This is the selected approach because role visibility remains in one place and the existing `admin` condition can remain unchanged.
2. Conditionally construct the `tools` group in `buildSidebarData`. Rejected because the data builder does not currently receive a role and would mix navigation definition with session authorization state.
3. Add a configurable sidebar-module switch for `tools`. Rejected because the request is a fixed role rule, not a configurable product setting.

## Design

Extract the root role-filtering logic into a small pure function used by `useSidebarView`. The function will:

- return `isAdmin` for the existing `admin` group without changing its behavior;
- return `isAdmin` for the `tools` group as a separate condition;
- return `true` for all other groups.

`isAdmin` remains defined by the existing project rule: the authenticated role is defined and is greater than or equal to `ROLE.ADMIN`. This includes Root users.

## Behavior Matrix

| Role | `tools` group | `admin` group | Other groups |
| --- | --- | --- | --- |
| Unauthenticated / missing role | Hidden | Existing behavior: hidden | Visible subject to existing sidebar configuration |
| Regular user | Hidden | Existing behavior: hidden | Visible subject to existing sidebar configuration |
| Admin | Visible | Existing behavior: visible | Visible subject to existing sidebar configuration |
| Root | Visible | Existing behavior: visible | Visible subject to existing sidebar configuration |

## Testing

Add focused unit tests for the pure role filter to prove:

- a regular user cannot see `tools`;
- an Admin can see `tools`;
- a Root user can see `tools`;
- the existing `admin` group behavior is unchanged;
- unrelated groups remain visible.

The existing sidebar-data test continues to prove that the Admin-visible `tools` group still contains `Get Started` and `API Marketplace` with their existing routes.

## Non-Goals

- No route guards or API authorization changes.
- No menu text, ordering, icons, or translation changes.
- No sidebar configuration schema changes.
- No refactoring of the existing `admin` group definition or its role threshold.
