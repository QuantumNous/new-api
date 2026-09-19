# Rule: `no-client-code-in-server-component`

## Overview

Disallow client-only code inside `createServerComponent()`.

This rule is meant to catch common "RSC boundary" mistakes in TanStack Start:

- calling React client hooks in server components
- referencing browser-only globals (eg `window`, `document`)
- using React event handlers (`onClick`, etc.)
- passing functions as props (non-serializable)
- using class components

## What counts as a "server component" here?

This rule treats the callback passed to `createServerComponent(...)` as server-only, and also treats any components rendered from within that callback as server-only unless they cross a `'use client'` boundary.

Supported call patterns:

- `createServerComponent(() => <div />)`
- `createServerComponent(async () => <div />)`
- `createServerComponent(MyComponent)` (direct reference)

## What counts as "client code"?

### React hooks

The rule flags common React hooks that require a client runtime (eg `useState`, `useEffect`).

Allowed hooks:

- `useId` is allowed by default.
- You can allow additional hooks via the `allowedServerHooks` option.

### Browser-only globals

Any global that exists in `globals.browser` but not `globals.node` is treated as browser-only and disallowed.

Examples:

- `window`
- `document`
- `navigator`

### Event handlers

JSX props that look like React event handlers (eg `onClick`, `onChange`, etc.) are disallowed in server components.

### Function props

Passing a function through props is disallowed because server-to-client serialization can’t serialize functions.

### Class components

Class components are disallowed because they rely on client-side lifecycle.

## Reporting location

- For direct violations inside a `createServerComponent` callback, the error is reported at the violating node.
- For transitive violations (server component → imports another file → reaches client code), the rule reports at:
  - the specific violating node (where possible) and
  - includes a "Triggered by rendering \"X\"" hint naming the entry component.

## Options

```ts
type Options = [
  {
    allowedServerHooks?: string[]
  },
]
```

### `allowedServerHooks`

Add additional hook names that should be allowed in server components.

Example:

```js
{
  rules: {
    '@tanstack/start/no-client-code-in-server-component': [
      'error',
      {
        allowedServerHooks: ['useMyServerSafeHook'],
      },
    ],
  },
}
```

## Examples

### Invalid: client hook in server component

```tsx
import { createServerComponent } from '@tanstack/react-start/rsc'
import { useState } from 'react'

export const Server = createServerComponent(() => {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
})
```

### Invalid: browser global access

```tsx
import { createServerComponent } from '@tanstack/react-start/rsc'

export const Server = createServerComponent(() => {
  return <div>{window.location.href}</div>
})
```

### Invalid: transitive client import

```tsx
// server.tsx
import { createServerComponent } from '@tanstack/react-start/rsc'
import { Middle } from './middle'

export const Server = createServerComponent(() => <Middle />)

// middle.tsx
import { ClientThing } from './client-thing'
export function Middle() {
  return <ClientThing />
}

// client-thing.tsx
export function ClientThing() {
  return <button onClick={() => {}}>Click</button>
}
```

### Valid: slot/prop boundary (pattern suggestion)

```tsx
import { createServerComponent } from '@tanstack/react-start/rsc'

export const Server = createServerComponent(({ ActionButton }) => {
  return (
    <div>
      <ActionButton />
    </div>
  )
})
```

## Implementation structure

```txt
src/rules/no-client-code-in-server-component/
  no-client-code-in-server-component.rule.ts
  transitive-analyzer.ts
  violation-detector.ts
  constants.ts
src/shared/
  use-client-resolver.ts
```
