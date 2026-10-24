---
id: RedirectType
title: Redirect type
---

The `Redirect` type is used to represent a redirect action in TanStack Router.

```tsx
export type Redirect = {
  statusCode?: number
  throw?: any
  headers?: HeadersInit
} & NavigateOptions
```

- [`NavigateOptions`](./NavigateOptionsType.md)

## Redirect properties

The `Redirect` object accepts/contains the following properties:

### `statusCode` property

- Type: `number`
- Optional
- The HTTP status code to use when redirecting

### `throw` property

- Type: `any`
- Optional
- If provided, will throw the redirect object instead of returning it. This can be useful in places where `throwing` in a function might cause it to have a return type of `never`. In that case, you can use `redirect({ throw: true })` to throw the redirect object instead of returning it.

### `headers` property

- Type: `HeadersInit`
- Optional
- The HTTP headers to use when redirecting.

### Navigation Properties

Since `Redirect` extends `NavigateOptions`, it also supports navigation properties:

- **`to`**: Use for internal application routes (e.g., `/dashboard`, `../profile`)
- **`href`**: Use for external URLs (e.g., `https://example.com`, `https://authprovider.com`)

> **Important**: For external URLs, always use the `href` property instead of `to`. The `to` property is designed for internal navigation within your application.
