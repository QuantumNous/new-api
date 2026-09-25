// Test: A different component imported from TanStack should NOT be transformed
// even if aliased to "ClientOnly" - we check the original import name
import { Link as ClientOnly } from '@tanstack/react-router'

export function MyComponent() {
  return (
    <div>
      <ClientOnly to="/about">Go to About</ClientOnly>
    </div>
  )
}
