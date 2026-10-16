import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/params')({
  component: () => <div>Hello /params!</div>,
})
