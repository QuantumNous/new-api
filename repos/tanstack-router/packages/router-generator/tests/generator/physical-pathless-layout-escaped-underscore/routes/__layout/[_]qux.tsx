import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/__layout/_qux')({
  component: () => 'Qux',
})
