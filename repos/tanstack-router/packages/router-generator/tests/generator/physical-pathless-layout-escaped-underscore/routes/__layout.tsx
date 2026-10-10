import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/__layout')({
  component: () => 'Double Underscore Layout',
})
