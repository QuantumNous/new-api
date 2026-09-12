---
title: Type Safety
---

TanStack Router is built to be as type-safe as possible within the limits of the TypeScript compiler and runtime. This means that it's not only written in TypeScript, but that it also **fully infers the types it's provided and tenaciously pipes them through the entire routing experience**.

Ultimately, this means that you write **less types as a developer** and have **more confidence in your code** as it evolves.

## Route Definitions

### File-based Routing

Routes are hierarchical, and so are their definitions. If you're using file-based routing, much of the type-safety is already taken care of for you.

### Code-based Routing

If you're using the `Route` class directly, you'll need to be aware of how to ensure your routes are typed properly using the `Route`'s `getParentRoute` option. This is because child routes need to be aware of **all** of their parent routes types. Without this, those precious search params you parsed out of your _layout_ and _pathless layout_ routes, 3 levels up, would be lost to the JS void.

So, don't forget to pass the parent route to your child routes!

```tsx
const parentRoute = createRoute({
  getParentRoute: () => parentRoute,
})
```

## Exported Hooks, Components, and Utilities

For the types of your router to work with top-level exports like `Link`, `useNavigate`, `useParams`, etc. they must permeate the TypeScript module boundary and be registered right into the library. To do this, we use declaration merging on the exported `Register` interface.

<!-- ::start:framework -->

# React

```ts
const router = createRouter({
  // ...
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

# Solid

```ts
const router = createRouter({
  // ...
})

declare module '@tanstack/solid-router' {
  interface Register {
    router: typeof router
  }
}
```

<!-- ::end:framework -->

By registering your router with the module, you can now use the exported hooks, components, and utilities with your router's exact types.

## Fixing the Component Context Problem

Component context is a wonderful tool in React and other frameworks for providing dependencies to components. However, if that context is changing types as it moves throughout your component hierarchy, it becomes impossible for TypeScript to know how to infer those changes. To get around this, context-based hooks and components require that you give them a hint on how and where they are being used.

```tsx
export const Route = createFileRoute('/posts')({
  component: PostsComponent,
})

function PostsComponent() {
  // Each route has type-safe versions of most of the built-in hooks from TanStack Router
  const params = Route.useParams()
  const search = Route.useSearch()

  // Some hooks require context from the *entire* router, not just the current route. To achieve type-safety here,
  // we must pass the `from` param to tell the hook our relative position in the route hierarchy.
  const navigate = useNavigate({ from: Route.fullPath })
  // ... etc
}
```

Every hook and component that requires a context hint will have a `from` param where you can pass the ID or path of the route you are rendering within.

> 🧠 Quick tip: If your component is code-split, you can use the [getRouteApi function](./code-splitting.md#manually-accessing-route-apis-in-other-files-with-the-getrouteapi-helper) to avoid having to pass in the `Route.fullPath` to get access to the typed `useParams()` and `useSearch()` hooks.

### What if I don't know the route? What if it's a shared component?

The `from` property is optional, which means if you don't pass it, you'll get the router's best guess on what types will be available. Usually, that means you'll get a union of all of the types of all of the routes in the router.

### What if I pass the wrong `from` path?

It's technically possible to pass a `from` that satisfies TypeScript, but may not match the actual route you are rendering within at runtime. In this case, each hook and component that supports `from` will detect if your expectations don't match the actual route you are rendering within, and will throw a runtime error.

### What if I don't know the route, or it's a shared component, and I can't pass `from`?

If you are rendering a component that is shared across multiple routes, or you are rendering a component that is not within a route, you can pass `strict: false` instead of a `from` option. This will not only silence the runtime error, but will also give you relaxed, but accurate types for the potential hook you are calling. A good example of this is calling `useSearch` from a shared component:

```tsx
function MyComponent() {
  const search = useSearch({ strict: false })
}
```

In this case, the `search` variable will be typed as a union of all possible search params from all routes in the router.

## Router Context

Router context is so extremely useful as it's the ultimate hierarchical dependency injection. You can supply context to the router and to each and every route it renders. As you build up this context, TanStack Router will merge it down with the hierarchy of routes, so that each route has access to the context of all of its parents.

The `createRootRouteWithContext` factory creates a new router with the instantiated type, which then creates a requirement for you to fulfill the same type contract to your router, and will also ensure that your context is properly typed throughout the entire route tree.

```tsx
const rootRoute = createRootRouteWithContext<{ whateverYouWant: true }>()({
  component: App,
})

const routeTree = rootRoute.addChildren([
  // ... all child routes will have access to `whateverYouWant` in their context
])

const router = createRouter({
  routeTree,
  context: {
    // This will be required to be passed now
    whateverYouWant: true,
  },
})
```

## Performance Recommendations

As your application scales, TypeScript check times will naturally increase. There are a few things to keep in mind when your application scales to keep your TS check times down.

### Only infer types you need

A great pattern with client side data caches (TanStack Query, etc.) is to prefetch data. For example with TanStack Query you might have a route which calls `queryClient.ensureQueryData` in a `loader`.

```tsx
export const Route = createFileRoute('/posts/$postId/deep')({
  loader: ({ context: { queryClient }, params: { postId } }) =>
    queryClient.ensureQueryData(postQueryOptions(postId)),
  component: PostDeepComponent,
})

function PostDeepComponent() {
  const params = Route.useParams()
  const data = useSuspenseQuery(postQueryOptions(params.postId))

  return <></>
}
```

This may look fine and for small route trees and you may not notice any TS performance issues. However in this case TS has to infer the loader's return type, despite it never being used in your route. If the loader data is a complex type with many routes that prefetch in this manner, it can slow down editor performance. In this case, the change is quite simple and let typescript infer Promise<void>.

```tsx
export const Route = createFileRoute('/posts/$postId/deep')({
  loader: async ({ context: { queryClient }, params: { postId } }) => {
    await queryClient.ensureQueryData(postQueryOptions(postId))
  },
  component: PostDeepComponent,
})

function PostDeepComponent() {
  const params = Route.useParams()
  const data = useSuspenseQuery(postQueryOptions(params.postId))

  return <></>
}
```

This way the loader data is never inferred and it moves the inference out of the route tree to the first time you use `useSuspenseQuery`.

### Narrow to relevant routes as much as you possibly can

Consider the following usage of `Link`

```tsx
<Link to=".." search={{ page: 0 }} />
<Link to="." search={{ page: 0 }} />
```

**These examples are bad for TS performance**. That's because `search` resolves to a union of all `search` params for all routes and TS has to check whatever you pass to the `search` prop against this potentially big union. As your application grows, this check time will increase linearly to number of routes and search params. We have done our best to optimize for this case (TypeScript will typically do this work once and cache it) but the initial check against this large union is expensive. This also applies to `params` and other API's such as `useSearch`, `useParams`, `useNavigate` etc.

Instead you should try to narrow to relevant routes with `from` or `to`.

```tsx
<Link from={Route.fullPath} to=".." search={{page: 0}} />
<Link from="/posts" to=".." search={{page: 0}} />
```

Remember you can always pass a union to `to` or `from` to narrow the routes you're interested in.

```tsx
const from: '/posts/$postId/deep' | '/posts/' = '/posts/'
<Link from={from} to='..' />
```

You can also pass branches to `from` to only resolve `search` or `params` to be from any descendants of that branch:

```tsx
const from = '/posts'
<Link from={from} to='..' />
```

`/posts` could be a branch with many descendants which share the same `search` or `params`

### Consider using the object syntax of `addChildren`

It's typical of routes to have `params` `search`, `loaders` or `context` that can even reference external dependencies which are also heavy on TS inference. For such applications, using objects for creating the route tree can be more performant than tuples.

`createChildren` also can accept an object. For large route trees with complex routes and external libraries, objects can be much faster for TS to type check as opposed to large tuples. The performance gains depend on your project, what external dependencies you have and how the types for those libraries are written

```tsx
const routeTree = rootRoute.addChildren({
  postsRoute: postsRoute.addChildren({ postRoute, postsIndexRoute }),
  indexRoute,
})
```

Note this syntax is more verbose but has better TS performance. With file based routing, the route tree is generated for you so a verbose route tree is not a concern

### Avoid internal types without narrowing

It's common you might want to re-use types exposed. For example you might be tempted to use `LinkProps` like so

```tsx
const props: LinkProps = {
  to: '/posts/',
}

return (
  <Link {...props}>
)
```

**This is VERY bad for TS Performance**. The problem here is `LinkProps` has no type arguments and is therefore an extremely large type. It includes `search` which is a union of all `search` params, it contains `params` which is a union of all `params`. When merging this object with `Link` it will do a structural comparison of this huge type.

Instead you can use `as const satisfies` to infer a precise type and not `LinkProps` directly to avoid the huge check

```tsx
const props = {
  to: '/posts/',
} as const satisfies LinkProps

return (
  <Link {...props}>
)
```

As `props` is not of type `LinkProps` and therefore this check is cheaper because the type is much more precise. You can also improve type checking further by narrowing `LinkProps`

```tsx
const props = {
  to: '/posts/',
} as const satisfies LinkProps<RegisteredRouter, string '/posts/'>

return (
  <Link {...props}>
)
```

This is even faster as we're checking against the narrowed `LinkProps` type.

You can also use this to narrow the type of `LinkProps` to a specific type to be used as a prop or parameter to a function

```tsx
export const myLinkProps = [
  {
    to: '/posts',
  },
  {
    to: '/posts/$postId',
    params: { postId: 'postId' },
  },
] as const satisfies ReadonlyArray<LinkProps>

export type MyLinkProps = (typeof myLinkProps)[number]

const MyComponent = (props: { linkProps: MyLinkProps }) => {
  return <Link {...props.linkProps} />
}
```

This is faster than using `LinkProps` directly in a component because `MyLinkProps` is a much more precise type

Another solution is not to use `LinkProps` and to provide inversion of control to render a `Link` component narrowed to a specific route. Render props are a good method of inverting control to the user of a component

```tsx
export interface MyComponentProps {
  readonly renderLink: () => React.ReactNode
}

const MyComponent = (props: MyComponentProps) => {
  return <div>{props.renderLink()}</div>
}

const Page = () => {
  return <MyComponent renderLink={() => <Link to="/absolute" />} />
}
```

This particular example is very fast as we've inverted control of where we're navigating to the user of the component. The `Link` is narrowed to the exact route
we want to navigate to
