import { createFileRoute, notFound } from '@tanstack/solid-router'

export const Route = createFileRoute('/missing/$id')({
  loader: () => {
    throw notFound()
  },
  component: MissingComponent,
})

function MissingComponent() {
  return null
}
