---
id: no-client-code-in-server-component
title: Disallow client-only code in server components
---

TanStack Start defines React Server Component boundaries via RSC helpers like `renderServerComponent()` and `createCompositeComponent()`.

- `renderServerComponent(<Element />)` is a server boundary around the element.
- `createCompositeComponent((props) => <Element />)` is a server boundary around the callback.

Inside these boundaries (and anything rendered from them, unless it crosses a `'use client'` boundary) you must not use client-only code.

This rule detects common client-only patterns in server components:

- React client hooks (eg `useState`, `useEffect`)
- browser-only globals (eg `window`, `document`)
- React event handlers (`onClick`, etc.)
- function props (non-serializable across the server/client boundary)
- class components

## Rule Details

Examples of **incorrect** code for this rule:

```tsx
/* eslint "@tanstack/start/no-client-code-in-server-component": "error" */

import { createCompositeComponent } from '@tanstack/react-start/rsc'
import { useState } from 'react'

export const Server = createCompositeComponent(() => {
  const [count] = useState(0)
  return <div>{count}</div>
})
```

```tsx
/* eslint "@tanstack/start/no-client-code-in-server-component": "error" */

import { createCompositeComponent } from '@tanstack/react-start/rsc'

export const Server = createCompositeComponent(() => {
  return <div>{window.location.href}</div>
})
```

Examples of **correct** code for this rule:

```tsx
/* eslint "@tanstack/start/no-client-code-in-server-component": "error" */

import { renderServerComponent } from '@tanstack/react-start/rsc'

export const Server = renderServerComponent(
  (async () => {
    const msg = await Promise.resolve('ok')
    return <div>{msg}</div>
  })(),
)
```

## Attributes

- [x] ✅ Recommended
