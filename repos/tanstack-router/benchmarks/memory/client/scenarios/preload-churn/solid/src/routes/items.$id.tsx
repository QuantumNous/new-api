import { createFileRoute } from '@tanstack/solid-router'
import { createItemPayload, trackItemLoaderCall } from '../../../item-payload'

export const Route = createFileRoute('/items/$id')({
  loader: ({ params }) => {
    trackItemLoaderCall(params.id)
    return createItemPayload(params.id)
  },
  component: ItemComponent,
})

function ItemComponent() {
  const data = Route.useLoaderData()

  return (
    <main data-bench-id={data().id} data-bench-page="item">
      {`${data().id}:${data().byteLength}`}
    </main>
  )
}
