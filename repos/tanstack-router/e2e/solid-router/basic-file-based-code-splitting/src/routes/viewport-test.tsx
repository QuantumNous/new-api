import { createFileRoute } from '@tanstack/solid-router'
export const Route = createFileRoute('/viewport-test')({
  component: () => <div>Hello /viewport-test!</div>,
})
