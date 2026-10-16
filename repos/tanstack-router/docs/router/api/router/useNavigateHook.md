---
id: useNavigateHook
title: useNavigate hook
---

The `useNavigate` hook is a hook that returns a `navigate` function that can be used to navigate to a new location. This includes changes to the pathname, search params, hash, and location state.

## useNavigate options

The `useNavigate` hook accepts a single argument, an `options` object.

### `opts.from` option

- Type: `string`
- Optional
- Description: The location to navigate from. This is useful when you want to navigate to a new location from a specific location, rather than the current location.

## useNavigate returns

- A `navigate` function that can be used to navigate to a new location.

## navigate function

The `navigate` function is a function that can be used to navigate to a new location.

### navigate function options

The `navigate` function accepts a single argument, an `options` object.

- Type: [`NavigateOptions`](./NavigateOptionsType.md)

### navigate function returns

- A `Promise` that resolves when the navigation is complete

## Examples

```tsx
import { useNavigate } from '@tanstack/react-router'

function PostsPage() {
  const navigate = useNavigate({ from: '/posts' })
  const handleClick = () => navigate({ search: { page: 2 } })
  // ...
}

function Component() {
  const navigate = useNavigate()
  return (
    <div>
      <button
        onClick={() =>
          navigate({
            to: '/posts',
          })
        }
      >
        Posts
      </button>
      <button
        onClick={() =>
          navigate({
            to: '/posts',
            search: { page: 2 },
          })
        }
      >
        Posts (Page 2)
      </button>
      <button
        onClick={() =>
          navigate({
            to: '/posts',
            hash: 'my-hash',
          })
        }
      >
        Posts (Hash)
      </button>
      <button
        onClick={() =>
          navigate({
            to: '/posts',
            state: { from: 'home' },
          })
        }
      >
        Posts (State)
      </button>
    </div>
  )
}
```
