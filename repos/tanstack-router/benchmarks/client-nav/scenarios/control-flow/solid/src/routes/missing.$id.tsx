import { createFileRoute, notFound } from '@tanstack/solid-router'

export const Route = createFileRoute('/missing/$id')({
  staleTime: 0,
  gcTime: 0,
  loader: ({ params }) => {
    if (params.id === 'gone') {
      throw notFound()
    }
    return { id: params.id }
  },
  component: MissingPage,
  notFoundComponent: MissingNotFound,
})

function MissingPage() {
  const data = Route.useLoaderData()
  return <div data-testid="missing-state">{data().id}</div>
}

function MissingNotFound() {
  return <div data-testid="not-found-state">missing not found</div>
}
