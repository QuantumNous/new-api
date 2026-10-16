import { createFileRoute } from '@tanstack/router'

// Test errorComponent with false literal
export const Route = createFileRoute('/test')({
  component: () => <div>Test Component</div>,
  errorComponent: false,
  pendingComponent: null,
  loader: async () => ({ data: 'test' }),
})
