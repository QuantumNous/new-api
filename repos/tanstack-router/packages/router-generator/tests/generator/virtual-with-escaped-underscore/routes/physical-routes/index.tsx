import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/')({
  component: () => 'API Index',
})
