import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/_nested/$id')({
  component: () => 'Nested Id',
})
