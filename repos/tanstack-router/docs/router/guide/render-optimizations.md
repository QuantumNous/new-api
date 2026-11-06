---
title: Render Optimizations
---

TanStack Router includes several optimizations to ensure your components only re-render when necessary. These optimizations include:

## structural sharing

TanStack Router uses a technique called "structural sharing" to preserve as many references as possible between re-renders, which is particularly useful for state stored in the URL, such as search parameters.

For example, consider a `details` route with two search parameters, `foo` and `bar`, accessed like this:

```tsx
const search = Route.useSearch()
```

When only `bar` is changed by navigating from `/details?foo=f1&bar=b1` to `/details?foo=f1&bar=b2`, `search.foo` will be referentially stable and only `search.bar` will be replaced.

## fine-grained selectors

You can access and subscribe to the router state using various hooks like `useRouterState`, `useSearch`, and others. If you only want a specific component to re-render when a particular subset of the router state such as a subset of the search parameters changes, you can use partial subscriptions with the `select` property.

```tsx
// component won't re-render when `bar` changes
const foo = Route.useSearch({ select: ({ foo }) => foo })
```

### structural sharing with fine-grained selectors

The `select` function can perform various calculations on the router state, allowing you to return different types of values, such as objects. For example:

```tsx
const result = Route.useSearch({
  select: (search) => {
    return {
      foo: search.foo,
      hello: `hello ${search.foo}`,
    }
  },
})
```

Although this works, it will cause your component to re-render each time, since `select` is now returning a new object each time it’s called.

You can avoid this re-rendering issue by using "structural sharing" as described above. By default, structural sharing is turned off to maintain backward compatibility, but this may change in v2.

To enable structural sharing for fine grained selectors, you have two options:

#### Enable it by default in the router options:

```tsx
const router = createRouter({
  routeTree,
  defaultStructuralSharing: true,
})
```

#### Enable it per hook usage as shown here:

```tsx
const result = Route.useSearch({
  select: (search) => {
    return {
      foo: search.foo,
      hello: `hello ${search.foo}`,
    }
  },
  structuralSharing: true,
})
```

> [!IMPORTANT]
> Structural sharing only works with JSON-compatible data. This means you cannot use `select` to return items like class instances if structural sharing is enabled.

In line with TanStack Router's type-safe design, TypeScript will raise an error if you attempt the following:

```tsx
const result = Route.useSearch({
  select: (search) => {
    return {
      date: new Date(),
    }
  },
  structuralSharing: true,
})
```

If structural sharing is enabled by default in the router options, you can prevent this error by setting `structuralSharing: false`.
