import { redirect, createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/redirect')({
  beforeLoad: async () => {
    throw redirect({
      to: '/posts',
    })
  },
})
