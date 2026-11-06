# @tanstack/vue-start — Skill Spec

Vue bindings for TanStack Start. useServerFn hook, tanstackStart Vite plugin, Html/Body SSR shell, Vue-specific setup.

## Domains

| Domain             | Description                                                 | Skills    |
| ------------------ | ----------------------------------------------------------- | --------- |
| Vue Start Bindings | Vue full-stack bindings, server functions, Vite plugin, SSR | vue-start |

## Skill Inventory

| Skill     | Type      | Domain             | What it covers                                               | Failure modes |
| --------- | --------- | ------------------ | ------------------------------------------------------------ | ------------- |
| vue-start | framework | vue-start-bindings | useServerFn, tanstackStart Vite plugin, Html/Body SSR, setup | 2             |

## Failure Mode Inventory

### vue-start (2 failure modes)

| #   | Mistake                               | Priority | Source      |
| --- | ------------------------------------- | -------- | ----------- |
| 1   | Using react-start APIs in Vue context | HIGH     | source/docs |
| 2   | Missing Html/Body SSR shell setup     | MEDIUM   | source/docs |
