import { createFileRoute } from '@tanstack/vue-router'
import { makeRichSerializationData } from '../../../shared-data'

export const Route = createFileRoute('/rich/$id')({
  loader: ({ params }) => makeRichSerializationData(params.id),
  component: RichComponent,
})

function RichComponent() {
  const data = Route.useLoaderData()

  return (
    <section>
      <h1>{data.value.label}</h1>
      <p>{data.value.createdAt.toISOString()}</p>
      <p>{data.value.lookup.get('k0')?.label}</p>
      <p>{Array.from(data.value.tags)[0]}</p>
      <p>{data.value.count.toString()}</p>
      <p>{data.value.nested[0]?.id}</p>
      <p>{data.value.points[0]?.label}</p>
      <p>{data.value.problem.message}</p>
    </section>
  )
}
