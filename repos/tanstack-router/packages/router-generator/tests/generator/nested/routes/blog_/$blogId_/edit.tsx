import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/blog_/$blogId_/edit')({
  component: () => <div>Hello /blog_/$blogId_/edit!</div>,
})
