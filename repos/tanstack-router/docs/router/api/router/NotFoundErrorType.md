---
id: NotFoundErrorType
title: NotFoundError
---

The `NotFoundError` type is used to represent a not-found error in TanStack Router.

```tsx
export type NotFoundError = {
  global?: boolean
  data?: any
  throw?: boolean
  routeId?: string
  headers?: HeadersInit
}
```

## NotFoundError properties

The `NotFoundError` object accepts/contains the following properties:

### `global` property (⚠️ deprecated, use `routeId: rootRouteId` instead)

- Type: `boolean`
- Optional - `default: false`
- If true, the not-found error will be handled by the `notFoundComponent` of the root route instead of bubbling up from the route that threw it. This has the same behavior as importing the root route and calling `RootRoute.notFound()`.

### `data` property

- Type: `any`
- Optional
- Custom data that is passed into `notFoundComponent` when the not-found error is handled

### `throw` property

- Type: `boolean`
- Optional - `default: false`
- If provided, will throw the not-found object instead of returning it. This can be useful in places where `throwing` in a function might cause it to have a return type of `never`. In that case, you can use `notFound({ throw: true })` to throw the not-found object instead of returning it.

### `routeId` property

- Type: `string`
- Optional
- The ID of the route that will attempt to handle the not-found error. If the route does not have a `notFoundComponent`, the error will bubble up to the parent route (and be handled by the root route if necessary). By default, TanStack Router will attempt to handle the not-found error with the route that threw it.

### `headers` property

- Type: `HeadersInit`
- Optional
- HTTP headers to be included when the not-found error is handled on the server side.
