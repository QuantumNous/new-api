import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_layout/__nested2')({
  component: () => 'Nested Double Underscore Layout',
})
