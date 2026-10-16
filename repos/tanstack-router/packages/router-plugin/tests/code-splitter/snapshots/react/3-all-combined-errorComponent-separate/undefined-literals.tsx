import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/undefined-test')({
  component: undefined,
  errorComponent: undefined,
  pendingComponent: undefined,
  notFoundComponent: undefined,
})
