---
title: Creating a Router
---

## The `createRouter` function

When you're ready to start using your router, you'll need to create a new `Router` instance. The router instance is the core brains of TanStack Router and is responsible for managing the route tree, matching routes, and coordinating navigations and route transitions. It also serves as a place to configure router-wide settings.

<!-- ::start:framework -->

# React

```tsx title="src/router.tsx"
import { createRouter } from '@tanstack/react-router'

const router = createRouter({
  // ...
})
```

# Solid

```tsx title="src/router.tsx"
import { createRouter } from '@tanstack/solid-router'

const router = createRouter({
  // ...
})
```

<!-- ::end:framework -->

## Route Tree

You'll probably notice quickly that the `Router` constructor requires a `routeTree` option. This is the route tree that the router will use to match routes and render components.

Whether you used [file-based routing](../routing/file-based-routing.md) or [code-based routing](../routing/code-based-routing.md), you'll need to pass your route tree to the `createRouter` function:

### Filesystem Route Tree

If you used our recommended file-based routing, then it's likely your generated route tree file was created at the default `src/routeTree.gen.ts` location. If you used a custom location, then you'll need to import your route tree from that location.

```tsx
import { routeTree } from './routeTree.gen'
```

### Code-Based Route Tree

If you used code-based routing, then you likely created your route tree manually using the root route's `addChildren` method:

```tsx
const routeTree = rootRoute.addChildren([
  // ...
])
```

## Router Type Safety

> [!IMPORTANT]
> DO NOT SKIP THIS SECTION! ⚠️

TanStack Router provides amazing support for TypeScript, even for things you wouldn't expect like bare imports straight from the library! To make this possible, you must register your router's types using TypeScripts' [Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html) feature. This is done by extending the `Register` interface on `@tanstack/react-router` with a `router` property that has the type of your `router` instance:

<!-- ::start:framework -->

# React

```tsx title="src/router.tsx"
declare module '@tanstack/react-router' {
  interface Register {
    // This infers the type of our router and registers it across your entire project
    router: typeof router
  }
}
```

# Solid

```tsx title="src/router.tsx"
declare module '@tanstack/solid-router' {
  interface Register {
    // This infers the type of our router and registers it across your entire project
    router: typeof router
  }
}
```

<!-- ::end:framework -->

With your router registered, you'll now get type-safety across your entire project for anything related to routing.

## 404 Not Found Route

As promised in earlier guides, we'll now cover the `notFoundRoute` option. This option is used to configure a route that will render when no other suitable match is found. This is useful for rendering a 404 page or redirecting to a default route.

If you are using either file-based or code-based routing, then you'll need to add a `notFoundComponent` key to `createRootRoute`:

```tsx
export const Route = createRootRoute({
  component: () => (
    // ...
  ),
  notFoundComponent: () => <div>404 Not Found</div>,
});
```

## Other Options

There are many other options that can be passed to the `Router` constructor. You can find a full list of them in the [API Reference](../api/router/RouterOptionsType.md).
