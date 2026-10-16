import { createFileRoute, redirect } from '@tanstack/vue-router'

export const Route = createFileRoute('/redirect/throw-it')({
  beforeLoad: () => {
    throw redirect({
      to: '/posts/$postId',
      params: { postId: '1' },
    })
  },
})
