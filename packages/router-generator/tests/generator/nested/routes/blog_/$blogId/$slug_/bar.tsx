import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/blog_/$blogId/$slug_/bar')({
  component: () => <div>Hello /blog_/$blogId/$slug_/bar!</div>,
})
