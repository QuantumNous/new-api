import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/__double-index/$id')({
  component: () => 'Double Id',
})
