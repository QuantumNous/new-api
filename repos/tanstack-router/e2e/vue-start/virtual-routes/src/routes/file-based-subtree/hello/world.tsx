import { createFileRoute } from '@tanstack/vue-router'

export const Route = createFileRoute('/classic/hello/world')({
  component: () => <div>Hello /classic/hello/world!</div>,
})
