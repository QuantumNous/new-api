import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/posts/inception/')({
  component: () => <div>Hello /posts/inception/!</div>,
})
