import { createFileRoute, redirect } from '@tanstack/solid-router'

export const Route = createFileRoute('/hop1')({
  staleTime: 0,
  gcTime: 0,
  loader: () => {
    throw redirect({ to: '/hop2' })
  },
})
