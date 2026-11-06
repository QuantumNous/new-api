import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/device/$id/history/$filename')({
  component: () => 'Device History',
})
