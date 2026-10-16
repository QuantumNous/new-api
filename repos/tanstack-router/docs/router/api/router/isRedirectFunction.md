---
id: isRedirectFunction
title: isRedirect function
---

The `isRedirect` function can be used to determine if an object is a redirect object.

## isRedirect options

The `isRedirect` function accepts a single argument, an `input`.

#### `input`

- Type: `unknown`
- Required
- An object to check if it is a redirect object

## isRedirect returns

- Type: `boolean`
- `true` if the object is a redirect object
- `false` if the object is not a redirect object

## Examples

```tsx
import { isRedirect } from '@tanstack/react-router'

function somewhere(obj: unknown) {
  if (isRedirect(obj)) {
    // ...
  }
}
```
