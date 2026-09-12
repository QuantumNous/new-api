import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/blog_/$blogId/$slug')({
  component: () => <div>Hello /blog_/$blogId/$slug/route!</div>,
})
