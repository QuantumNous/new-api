import { createFileRoute } from '@tanstack/vue-router'
import { makeSerializationPayload } from '../../../serialization-payload'

export const Route = createFileRoute('/data/$id')({
  loader: ({ params }) => makeSerializationPayload(params.id),
  component: DataComponent,
})

function DataComponent() {
  const data = Route.useLoaderData()

  return (
    <main data-bench="serialization-payload">
      Map size: {data.value.lookup.size}
    </main>
  )
}
