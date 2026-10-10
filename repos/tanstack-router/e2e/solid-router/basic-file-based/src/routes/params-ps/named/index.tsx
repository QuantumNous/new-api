import { createFileRoute, redirect } from '@tanstack/solid-router'

export const Route = createFileRoute('/params-ps/named/')({
  beforeLoad: () => {
    throw redirect({ to: '/params-ps' })
  },
})
