import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/_hello')({
  component: () => 'Hello API',
})
