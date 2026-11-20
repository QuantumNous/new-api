import { createFileRoute } from '@tanstack/solid-router'
import { makePlainSerializationData } from '../../../shared-data'

export const Route = createFileRoute('/plain/$id')({
  loader: ({ params }) => makePlainSerializationData(params.id),
  component: PlainComponent,
})

function PlainComponent() {
  const data = Route.useLoaderData()
  const firstMapEntry = () => data().lookup[0]?.[1]
  const firstTag = () => data().tags[0]

  return (
    <section>
      <h1>{data().label}</h1>
      <p>{data().createdAt}</p>
      <p>{firstMapEntry()?.label}</p>
      <p>{firstTag()}</p>
      <p>{data().count}</p>
      <p>{data().nested[0]?.id}</p>
      <p>{data().points[0]?.label}</p>
      <p>{data().problem.message}</p>
    </section>
  )
}
