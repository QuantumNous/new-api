import { createFileRoute, redirect } from '@tanstack/solid-router'

export const Route = createFileRoute('/redirect')({
  beforeLoad: () => {
    throw redirect({
      to: '/posts',
    })
  },
})
