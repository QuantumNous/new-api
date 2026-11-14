import { createFileRoute, redirect } from '@tanstack/vue-router'

export const Route = createFileRoute('/hop2')({
  staleTime: 0,
  gcTime: 0,
  loader: () => {
    throw redirect({ to: '/target' })
  },
})
