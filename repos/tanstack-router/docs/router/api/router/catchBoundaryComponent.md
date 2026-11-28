---
id: catchBoundaryComponent
title: CatchBoundary component
---

The `CatchBoundary` component is a component that catches errors thrown by its children, renders an error component and optionally calls the `onCatch` callback. It also accepts a `getResetKey` function that can be used to declaratively reset the component's state when the key changes.

## CatchBoundary props

The `CatchBoundary` component accepts the following props:

### `props.getResetKey` prop

- Type: `() => string`
- Required
- A function that returns a string that will be used to reset the component's state when the key changes.

### `props.children` prop

- Type: `React.ReactNode`
- Required
- The component's children to render when there is no error

### `props.errorComponent` prop

- Type: `React.ReactNode`
- Optional - [`default: ErrorComponent`](./errorComponentComponent.md)
- The component to render when there is an error.

### `props.onCatch` prop

- Type: `(error: any) => void`
- Optional
- A callback that will be called with the error that was thrown by the component's children.

## CatchBoundary returns

- Returns the component's children if there is no error.
- Returns the `errorComponent` if there is an error.

## Examples

```tsx
import { CatchBoundary } from '@tanstack/react-router'

function Component() {
  return (
    <CatchBoundary
      getResetKey={() => 'reset'}
      onCatch={(error) => console.error(error)}
    >
      <div>My Component</div>
    </CatchBoundary>
  )
}
```
