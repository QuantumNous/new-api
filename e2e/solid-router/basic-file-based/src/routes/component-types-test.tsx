import { createFileRoute } from '@tanstack/solid-router'

// Test route for type safety of different component types
// This test should
// - check that `false` can be set on the `errorComponent`
// ...without causing build-time TypeScript errors
export const Route = createFileRoute('/component-types-test')({
  component: () => <div>Testing test types</div>,
  errorComponent: false, // Should not cause TypeScript error
  pendingComponent: undefined, // Should not cause TypeScript error
  notFoundComponent: undefined, // Should not cause TypeScript error
})
