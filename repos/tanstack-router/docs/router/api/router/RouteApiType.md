---
id: RouteApiType
title: RouteApi Type
---

The `RouteApi` describes an instance that provides type-safe versions of common hooks like `useParams`, `useSearch`, `useRouteContext`, `useNavigate`, `useLoaderData`, and `useLoaderDeps` that are pre-bound to a specific route ID and corresponding registered route types.

## `RouteApi` properties and methods

The `RouteApi` has the following properties and methods:

### `useMatch` method

```tsx
  useMatch<TSelected = TAllContext>(opts?: {
    select?: (match: TAllContext) => TSelected
  }): TSelected
```

- A type-safe version of the [`useMatch`](./useMatchHook.md) hook that is pre-bound to the route ID that the `RouteApi` instance was created with.
- Options
  - `opts.select`
    - Optional
    - `(match: RouteMatch) => TSelected`
    - If supplied, this function will be called with the route match and the return value will be returned from `useMatch`. This value will also be used to determine if the hook should re-render its parent component using shallow equality checks.
  - `opts.structuralSharing`
    - Optional
    - `boolean`
    - Configures whether structural sharing is enabled for the value returned by `select`.
    - See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.
- Returns
  - If a `select` function is provided, the return value of the `select` function.
  - If no `select` function is provided, the `RouteMatch` object or a loosened version of the `RouteMatch` object if `opts.strict` is `false`.

### `useRouteContext` method

```tsx
  useRouteContext<TSelected = TAllContext>(opts?: {
    select?: (search: TAllContext) => TSelected
  }): TSelected
```

- A type-safe version of the [`useRouteContext`](./useRouteContextHook.md) hook that is pre-bound to the route ID that the `RouteApi` instance was created with.
- Options
  - `opts.select`
    - Optional
    - `(match: RouteContext) => TSelected`
    - If supplied, this function will be called with the route match and the return value will be returned from `useRouteContext`. This value will also be used to determine if the hook should re-render its parent component using shallow equality checks.
- Returns
  - If a `select` function is provided, the return value of the `select` function.
  - If no `select` function is provided, the `RouteContext` object or a loosened version of the `RouteContext` object if `opts.strict` is `false`.

### `useSearch` method

```tsx
  useSearch<TSelected = TFullSearchSchema>(opts?: {
    select?: (search: TFullSearchSchema) => TSelected
  }): TSelected
```

- A type-safe version of the [`useSearch`](./useSearchHook.md) hook that is pre-bound to the route ID that the `RouteApi` instance was created with.
- Options
  - `opts.select`
    - Optional
    - `(match: TFullSearchSchema) => TSelected`
    - If supplied, this function will be called with the route match and the return value will be returned from `useSearch`. This value will also be used to determine if the hook should re-render its parent component using shallow equality checks.
  - `opts.structuralSharing`
    - Optional
    - `boolean`
    - Configures whether structural sharing is enabled for the value returned by `select`.
    - See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.
- Returns
  - If a `select` function is provided, the return value of the `select` function.
  - If no `select` function is provided, the `TFullSearchSchema` object or a loosened version of the `TFullSearchSchema` object if `opts.strict` is `false`.

### `useParams` method

```tsx
  useParams<TSelected = TAllParams>(opts?: {
    select?: (params: TAllParams) => TSelected
  }): TSelected
```

- A type-safe version of the [`useParams`](./useParamsHook.md) hook that is pre-bound to the route ID that the `RouteApi` instance was created with.
- Options
  - `opts.select`
    - Optional
    - `(match: TAllParams) => TSelected`
    - If supplied, this function will be called with the route match and the return value will be returned from `useParams`. This value will also be used to determine if the hook should re-render its parent component using shallow equality checks.
  - `opts.structuralSharing`
    - Optional
    - `boolean`
    - Configures whether structural sharing is enabled for the value returned by `select`.
    - See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.
- Returns
  - If a `select` function is provided, the return value of the `select` function.
  - If no `select` function is provided, the `TAllParams` object or a loosened version of the `TAllParams` object if `opts.strict` is `false`.

### `useLoaderData` method

```tsx
  useLoaderData<TSelected = TLoaderData>(opts?: {
    select?: (search: TLoaderData) => TSelected
  }): TSelected
```

- A type-safe version of the [`useLoaderData`](./useLoaderDataHook.md) hook that is pre-bound to the route ID that the `RouteApi` instance was created with.
- Options
  - `opts.select`
    - Optional
    - `(match: TLoaderData) => TSelected`
    - If supplied, this function will be called with the route match and the return value will be returned from `useLoaderData`. This value will also be used to determine if the hook should re-render its parent component using shallow equality checks.
  - `opts.structuralSharing`
    - Optional
    - `boolean`
    - Configures whether structural sharing is enabled for the value returned by `select`.
    - See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.
- Returns
  - If a `select` function is provided, the return value of the `select` function.
  - If no `select` function is provided, the `TLoaderData` object or a loosened version of the `TLoaderData` object if `opts.strict` is `false`.

### `useLoaderDeps` method

```tsx
  useLoaderDeps<TSelected = TLoaderDeps>(opts?: {
    select?: (search: TLoaderDeps) => TSelected
  }): TSelected
```

- A type-safe version of the [`useLoaderDeps`](./useLoaderDepsHook.md) hook that is pre-bound to the route ID that the `RouteApi` instance was created with.
- Options
  - `opts.select`
    - Optional
    - `(match: TLoaderDeps) => TSelected`
    - If supplied, this function will be called with the route match and the return value will be returned from `useLoaderDeps`.
  - `opts.structuralSharing`
    - Optional
    - `boolean`
    - Configures whether structural sharing is enabled for the value returned by `select`.
    - See the [Render Optimizations guide](../../guide/render-optimizations.md) for more information.
- Returns
  - If a `select` function is provided, the return value of the `select` function.
  - If no `select` function is provided, the `TLoaderDeps` object.

### `useNavigate` method

```tsx
  useNavigate(): // navigate function
```

- A type-safe version of [`useNavigate`](./useNavigateHook.md) that is pre-bound to the route ID that the `RouteApi` instance was created with.

### `redirect` method

```tsx
  redirect(opts?: RedirectOptions): Redirect
```

- A type-safe version of the [`redirect`](./redirectFunction.md) function that is pre-bound to the route ID that the `RouteApi` instance was created with.
- The `from` parameter is automatically set to the route ID, enabling type-safe relative redirects.
- Options
  - All options from [`redirect`](./redirectFunction.md) except `from`, which is automatically provided.
- Returns
  - A `Redirect` object that can be thrown from `beforeLoad` or `loader` callbacks.

#### Example

```tsx
import { getRouteApi } from '@tanstack/react-router'

const routeApi = getRouteApi('/dashboard/settings')

export const Route = createFileRoute('/dashboard/settings')({
  beforeLoad: ({ context }) => {
    if (!context.user) {
      // Type-safe redirect - 'from' is automatically '/dashboard/settings'
      throw routeApi.redirect({
        to: '../login', // Relative path to sibling route
      })
    }
  },
})
```
