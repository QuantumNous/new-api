import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_api/')({
  component: () => 'API Index',
})
