import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/device/$id')({
  component: () => 'Device Detail',
})
