import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_api/$id')({
  component: () => 'API Id',
})
