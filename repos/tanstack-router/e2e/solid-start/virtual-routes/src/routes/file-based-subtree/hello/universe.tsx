import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/classic/hello/universe')({
  component: () => <div>Hello /classic/hello/universe!</div>,
})
