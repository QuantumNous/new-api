# @tanstack/vue-router — Skill Spec

Vue bindings for TanStack Router. Ref<T> returns, defineComponent, h() render functions, provide/inject, Html/Body components.

## Domains

| Domain              | Description                                                   | Skills     |
| ------------------- | ------------------------------------------------------------- | ---------- |
| Vue Router Bindings | Vue components, composables, Ref returns, provide/inject, SSR | vue-router |

## Skill Inventory

| Skill      | Type      | Domain              | What it covers                                                  | Failure modes |
| ---------- | --------- | ------------------- | --------------------------------------------------------------- | ------------- |
| vue-router | framework | vue-router-bindings | Ref<T> returns, defineComponent, h(), provide/inject, Html/Body | 2             |

## Failure Mode Inventory

### vue-router (2 failure modes)

| #   | Mistake                                         | Priority | Source      |
| --- | ----------------------------------------------- | -------- | ----------- |
| 1   | Not unwrapping Ref values in templates          | HIGH     | source/docs |
| 2   | Missing provide/inject setup for router context | MEDIUM   | source/docs |
