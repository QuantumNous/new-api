# @tanstack/solid-start — Skill Spec

Solid bindings for TanStack Start. useServerFn hook, tanstackStart Vite plugin, Solid-specific setup.

## Domains

| Domain               | Description                                              | Skills      |
| -------------------- | -------------------------------------------------------- | ----------- |
| Solid Start Bindings | Solid full-stack bindings, server functions, Vite plugin | solid-start |

## Skill Inventory

| Skill       | Type      | Domain               | What it covers                                      | Failure modes |
| ----------- | --------- | -------------------- | --------------------------------------------------- | ------------- |
| solid-start | framework | solid-start-bindings | useServerFn, tanstackStart Vite plugin, Solid setup | 2             |

## Failure Mode Inventory

### solid-start (2 failure modes)

| #   | Mistake                                 | Priority | Source      |
| --- | --------------------------------------- | -------- | ----------- |
| 1   | Using react-start APIs in Solid context | HIGH     | source/docs |
| 2   | Missing tanstackStart Vite plugin       | MEDIUM   | source/docs |
