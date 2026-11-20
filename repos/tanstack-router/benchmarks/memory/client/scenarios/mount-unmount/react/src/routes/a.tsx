import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/a')({
  loader: () => ({ id: 'a' }),
  component: AComponent,
})

function AComponent() {
  const data = Route.useLoaderData()

  return <main data-bench-page={data.id}>{data.id}</main>
}
