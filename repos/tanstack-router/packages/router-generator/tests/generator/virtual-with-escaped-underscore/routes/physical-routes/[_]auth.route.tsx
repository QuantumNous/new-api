import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/_auth')({
  component: () => 'Auth Route',
})
