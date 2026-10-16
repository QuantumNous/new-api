import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/redirect')({
  beforeLoad: () => {
    throw redirect({
      to: '/posts',
    })
  },
})
