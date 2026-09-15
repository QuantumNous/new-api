import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/hop2')({
  staleTime: 0,
  gcTime: 0,
  loader: () => {
    throw redirect({ to: '/target' })
  },
})
