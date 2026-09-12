import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_main/posts')({
  component: () => 'Posts List',
})
