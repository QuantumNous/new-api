import { createFileRoute } from '@tanstack/solid-router'
export const Route = createFileRoute('/without-loader')({
  component: () => <div>Hello /without-loader!</div>,
})
