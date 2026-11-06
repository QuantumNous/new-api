import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/headers/$id')({
  headers: ({ params }) => ({
    'x-bench-route-header': `route-header-${params.id}`,
    'x-bench-route-static': 'control-flow-route-headers',
  }),
  component: HeadersComponent,
})

function HeadersComponent() {
  const params = Route.useParams()

  return <main>{`headers-${params().id}`}</main>
}
