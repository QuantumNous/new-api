import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/blog')({
  component: () => <div>Hello /blog!</div>,
})
