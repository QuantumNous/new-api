import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/missing/$id')({
  loader: () => {
    throw notFound()
  },
  component: MissingComponent,
})

function MissingComponent() {
  return null
}
