import { createFileRoute } from '@tanstack/solid-router'
import { redirect } from '@tanstack/solid-router'

export const Route = createFileRoute('/params-ps/wildcard/')({
  beforeLoad: () => {
    throw redirect({ to: '/params-ps' })
  },
})
