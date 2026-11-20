import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/_nested-index/$id')({
  component: () => 'Nested Id',
})
