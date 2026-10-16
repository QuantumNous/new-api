# @tanstack/virtual-file-routes — Skill Spec

Programmatic route tree building as an alternative to filesystem conventions. Provides helper functions for explicit route control.

## Domains

| Domain                      | Description                                           | Skills              |
| --------------------------- | ----------------------------------------------------- | ------------------- |
| Virtual Route Configuration | Programmatic route trees, mixing virtual and physical | virtual-file-routes |

## Skill Inventory

| Skill               | Type | Domain               | What it covers                                             | Failure modes |
| ------------------- | ---- | -------------------- | ---------------------------------------------------------- | ------------- |
| virtual-file-routes | core | virtual-route-config | rootRoute, index, route, layout, physical, subtree configs | 2             |

## Failure Mode Inventory

### virtual-file-routes (2 failure modes)

| #   | Mistake                                 | Priority | Source      |
| --- | --------------------------------------- | -------- | ----------- |
| 1   | Forgetting rootRoute wrapper            | HIGH     | source/docs |
| 2   | Using physical() path outside routesDir | MEDIUM   | source/docs |
