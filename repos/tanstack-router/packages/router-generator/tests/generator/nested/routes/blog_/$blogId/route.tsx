import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/blog_/$blogId')({
  component: () => <div>Hello /blog_/$blogId/route!</div>,
})
