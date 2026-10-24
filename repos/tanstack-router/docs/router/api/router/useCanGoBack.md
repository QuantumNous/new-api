---
id: useCanGoBack
title: useCanGoBack hook
---

The `useCanGoBack` hook returns a boolean representing if the router history can safely go back without exiting the application.

> ⚠️ The following new `useCanGoBack` API is currently _experimental_.

## useCanGoBack returns

- If the router history is not at index `0`, `true`.
- If the router history is at index `0`, `false`.

## Limitations

The router history index is reset after a navigation with [`reloadDocument`](./NavigateOptionsType.md#reloaddocument) set as `true`. This causes the router history to consider the new location as the initial one and will cause `useCanGoBack` to return `false`.

## Examples

### Showing a back button

```tsx
import { useRouter, useCanGoBack } from '@tanstack/react-router'

function Component() {
  const router = useRouter()
  const canGoBack = useCanGoBack()

  return (
    <div>
      {canGoBack ? (
        <button onClick={() => router.history.back()}>Go back</button>
      ) : null}

      {/* ... */}
    </div>
  )
}
```
