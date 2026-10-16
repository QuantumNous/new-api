import { createFileRoute } from '@tanstack/react-router'
export const Route = createFileRoute('/posts/$postId/')({
  validateSearch: () => ({
    indexSearch: 'search',
  }),
  component: () => <div>Hello /posts/$postId/!</div>,
})
