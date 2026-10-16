import { createFileRoute, notFound } from '@tanstack/react-router'

export const Route = createFileRoute('/missing/$id')({
  loader: () => {
    throw notFound()
  },
  notFoundComponent: MissingNotFoundComponent,
  component: MissingComponent,
})

function MissingNotFoundComponent() {
  return (
    <main data-bench="not-found-boundary">error-paths-not-found-boundary</main>
  )
}

function MissingComponent() {
  return null
}
