import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_main')({
  component: () => 'Layout',
})
