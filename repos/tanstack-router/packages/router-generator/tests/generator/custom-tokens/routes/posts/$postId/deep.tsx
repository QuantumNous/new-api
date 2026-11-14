import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/posts/$postId/deep')({
  component: () => <div>Hello /posts/$postId/deep!</div>,
})
