---
id: RegisterType
title: Register type
---

This type is used to register a route tree with a router instance. Doing so unlocks the full type safety of TanStack Router, including top-level exports from the `@tanstack/react-router` package.

```tsx
export type Register = {
  // router: [Your router type here]
}
```

To register a route tree with a router instance, use declaration merging to add the type of your router instance to the Register interface under the `router` property:

## Examples

```tsx
const router = createRouter({
  // ...
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```
