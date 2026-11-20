import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/_inner')({
  component: () => 'Inner Layout',
})
