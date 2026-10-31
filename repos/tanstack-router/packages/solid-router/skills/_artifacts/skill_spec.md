# @tanstack/solid-router — Skill Spec

Solid bindings for TanStack Router. Accessor<T> returns, Solid primitives, createLink, @solidjs/meta head management.

## Domains

| Domain                | Description                                                | Skills       |
| --------------------- | ---------------------------------------------------------- | ------------ |
| Solid Router Bindings | Solid components, hooks, Accessor returns, meta management | solid-router |

## Skill Inventory

| Skill        | Type      | Domain                | What it covers                                                   | Failure modes |
| ------------ | --------- | --------------------- | ---------------------------------------------------------------- | ------------- |
| solid-router | framework | solid-router-bindings | Accessor<T> returns, createLink, Solid primitives, @solidjs/meta | 2             |

## Failure Mode Inventory

### solid-router (2 failure modes)

| #   | Mistake                                              | Priority | Source      |
| --- | ---------------------------------------------------- | -------- | ----------- |
| 1   | Unwrapping accessors incorrectly                     | HIGH     | source/docs |
| 2   | Using React Router APIs instead of Solid equivalents | MEDIUM   | source/docs |
