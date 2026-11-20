# Rule: `no-async-client-component`

## Overview

Disallow async components in client context. Async components are only valid inside `createServerComponent()`.

## Problem

In React Server Components:

- Async components can only be awaited on the server
- Client components cannot be async (React throws at runtime)
- Components become "client" when:
  1. Referenced by `createFileRoute()` or `createRootRoute()` options (`component`, `pendingComponent`, etc.)
  2. Inside a `'use client'` file
  3. Rendered by another client component (transitively)

## Detection Algorithm

### Phase 1: Build Render Graph (whole-program)

Using TypeScript program from ESLint parser services:

```
For each file in program:
  1. Index component definitions
     - PascalCase exported function or const assigned to function/arrow
     - async-ness from TS node flags
  2. Find JSX usages (<Component />)
  3. Build edges: callerComponent -> calleeComponent
  4. Mark "server roots":
     - the createServerComponent() callback itself
     - components referenced from within that callback's JSX tree
  5. Mark "client roots":
     - createFileRoute()({ component, pendingComponent, errorComponent, notFoundComponent, ... })
     - createRootRoute()({ component, pendingComponent, errorComponent, notFoundComponent, ... })
     - Files with 'use client' directive

Notes:
- `createRootRoute`/`createFileRoute` refer to `@tanstack/react-router` APIs.
- `createLazyFileRoute` is intentionally out of scope.
- Prefer TS symbol resolution (e.g. aliases/re-exports via `checker.getAliasedSymbol`).
```

### Phase 2: Propagate Context

```
1. Mark all server roots as "server context"
2. Walk render graph from server roots; mark descendants as "server context"
   - STOP at a 'use client' boundary (descendants become client)
3. Mark all client roots as "client context"
4. Walk render graph from client roots; mark descendants as "client context"
5. Any component reachable from BOTH contexts is "tainted" (client wins)
6. Any component not reachable from server context is "client context"

Note: if the program has no server roots (no createServerComponent usage),
then all components end up in client context and async components are always invalid.
```

### Phase 3: Report Violations

```
For each async component:
  If component is in client context:
    Report error at:
      1. The async component definition (primary)
      2. Each JSX usage site where the *caller component* is in client context (secondary)
```

## Error Messages

**At definition site:**

```
Async component "MyComponent" cannot be used in client context. Async components
are only valid inside createServerComponent(). Either remove 'async' or ensure
this component is only rendered within server components.
```

**At usage site:**

```
Async component "MyComponent" is rendered in client context here. Async components
are only valid inside createServerComponent(). Move this to a server component or
use a non-async version.
```

## Implementation Structure

```
src/rules/no-async-client-component/
  no-async-client-component.rule.ts  -- Main ESLint rule
  render-graph-builder.ts            -- Build component render graph
  context-analyzer.ts                -- Propagate server/client context
  async-component-detector.ts        -- Find async function components
  constants.ts                       -- Route option names, etc.
```

## Key Types

```typescript
interface ComponentInfo {
  name: string
  fileName: string
  node: ts.Node
  isAsync: boolean
  line: number
}

interface RenderEdge {
  fromFile: string
  fromComponent: string
  toFile: string
  toComponent: string
  jsxNode: ts.Node // For reporting at usage site
}

interface ComponentContext {
  component: ComponentInfo
  isServerContext: boolean
  isClientContext: boolean
  // If client, why?
  clientReason?:
    | { type: 'use-client' }
    | { type: 'route-option'; routeFile: string; option: string }
    | { type: 'rendered-by-client'; parentComponent: string }
}

type RenderGraph = {
  components: Map<string, ComponentInfo> // key: "file:ComponentName"
  edges: Array<RenderEdge>
  serverRoots: Set<string> // Components inside createServerComponent
  clientRoots: Set<string> // Components in route options or 'use client'
}
```

## Route Options to Track

From `createFileRoute()` and `createRootRoute()` (component-ish keys only):

```typescript
const ROUTE_COMPONENT_OPTION_NAMES = [
  'component',
  'pendingComponent',
  'errorComponent',
  'notFoundComponent',
]
```

Only analyze these keys, and only when the value resolves to a function/component reference (identifier, inline function, etc.).

## Edge Cases

### 1. Component used in both server and client

```tsx
// ServerPage.tsx
createServerComponent(() => <SharedComponent />) // Server usage

// ClientPage.tsx
createFileRoute('/')({ component: () => <SharedComponent /> }) // Client usage
```

**Result**: Error - SharedComponent is tainted (used in client context)

### 2. Conditional rendering

```tsx
createServerComponent(() => {
  if (condition) return <AsyncComponent /> // Valid
  return <SyncComponent />
})
```

**Result**: AsyncComponent is in server context, valid

### 3. Dynamic imports

```tsx
const LazyComponent = lazy(() => import('./AsyncComponent'))
```

**Result**: Out of scope initially (non-trivial to resolve statically).

### 4. Component passed as prop

```tsx
createServerComponent(({ ActionButton }) => {
  return (
    <div>
      <ActionButton />
    </div>
  ) // ActionButton comes from client
})
```

**Result**: ActionButton is a slot from client, tracked separately

### 5. Re-exports

```tsx
// components/index.ts
export { MyComponent } from './MyComponent'
```

**Result**: Follow re-exports via TS symbol resolution (alias symbols).

## Performance Considerations

1. **Use TypeScript program** from parser services (already built)
2. **Cache render graph** per program instance
3. **Incremental updates** if possible (watch mode)
4. **Early termination** - once a component is proven client, stop analyzing

## Rule Options

```typescript
interface RuleOptions {
  /**
   * Additional file patterns to treat as client entry points
   * @default []
   */
  additionalClientPatterns?: string[]

  /**
   * File patterns to ignore
   * @default []
   */
  ignorePatterns?: string[]
}
```

## Test Cases

### Valid (should NOT report)

```tsx
// Async inside createServerComponent
createServerComponent(async () => {
  const data = await fetch()
  return <div>{data}</div>
})

// Async component rendered by server component
// AsyncData.tsx
export async function AsyncData() {
  return <div>{await getData()}</div>
}
// ServerPage.tsx
createServerComponent(() => <AsyncData />)

// Sync component in client context (OK)
createFileRoute('/')({ component: SyncComponent })
```

### Invalid (should report)

```tsx
// Async component as route component
export async function Page() {
  return <div />
}
createFileRoute('/')({ component: Page }) // Error at both locations

// Async component rendered by client
// AsyncWidget.tsx
export async function AsyncWidget() {
  return <div />
}
// ClientPage.tsx
createFileRoute('/')({
  component: () => <AsyncWidget />, // Error: AsyncWidget is async
})

// Async in 'use client' file
;('use client')
export async function ClientComponent() {
  return <div />
} // Error

// Async component rendered by 'use client' file
// Widget.tsx
export async function Widget() {
  return <div />
}
// ClientWrapper.tsx
;('use client')
import { Widget } from './Widget'
export function Wrapper() {
  return <Widget />
} // Error at usage
// Widget.tsx also gets error at definition

// Transitive client context
// AsyncDeep.tsx
export async function AsyncDeep() {
  return <div />
}
// Middle.tsx
export function Middle() {
  return <AsyncDeep />
}
// ClientPage.tsx
createFileRoute('/')({ component: () => <Middle /> })
// Error: AsyncDeep rendered transitively in client context
```

## Implementation Steps

1. **Create async-component-detector.ts**
   - Find all async function components in a file
   - Detect: `export async function Foo()`, `export const Foo = async () => {}`
   - Component heuristic: PascalCase name (avoid deep return/CFG analysis initially)

2. **Create render-graph-builder.ts**
   - Walk all files in TypeScript program
   - Build component -> component edges from JSX
   - Identify server roots (createServerComponent callbacks)
   - Identify client roots (route options, 'use client')

3. **Create context-analyzer.ts**
   - Propagate server context from server roots
   - Propagate client context from client roots
   - Handle 'use client' boundaries
   - Determine final context for each component

4. **Create no-async-client-component.rule.ts**
   - Build/cache render graph on Program node
   - For each file, find async components
   - Check context, report violations
   - Report at both definition and usage sites

5. **Add tests**
   - Valid cases (async in server context)
   - Invalid cases (async in client context)
   - Edge cases (mixed, transitive, re-exports)

6. **Update plugin exports**
   - Add to rules.ts
   - Add to index.ts

## Dependencies

- Reuses `use-client-resolver.ts` from existing rule
- Uses TypeScript program from ESLint parser services
- No new external dependencies
