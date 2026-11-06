import { createFileRoute } from '@tanstack/solid-router'
import { makeRichSerializationData } from '../../../shared-data'

export const Route = createFileRoute('/rich/$id')({
  loader: ({ params }) => makeRichSerializationData(params.id),
  component: RichComponent,
})

function RichComponent() {
  const data = Route.useLoaderData()
  const firstMapEntry = () => data().lookup.get('k0')
  const firstTag = () => Array.from(data().tags)[0]

  return (
    <section>
      <h1>{data().label}</h1>
      <p>{data().createdAt.toISOString()}</p>
      <p>{firstMapEntry()?.label}</p>
      <p>{firstTag()}</p>
      <p>{data().count.toString()}</p>
      <p>{data().nested[0]?.id}</p>
      <p>{data().points[0]?.label}</p>
      <p>{data().problem.message}</p>
    </section>
  )
}
