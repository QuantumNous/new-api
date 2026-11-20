import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/blog_/stats')({
  component: () => <div>Hello /blog/stats!</div>,
})
