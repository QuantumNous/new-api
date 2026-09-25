import { createFileRoute } from '@tanstack/vue-router'
import { createItemPayload, trackItemLoaderCall } from '../../../item-payload'

export const Route = createFileRoute('/items/$id')({
  loader: ({ params }: { params: { id: string } }) => {
    trackItemLoaderCall(params.id)
    return createItemPayload(params.id)
  },
  component: ItemComponent,
})

function ItemComponent() {
  const data = Route.useLoaderData()

  return (
    <main data-bench-id={data.value.id} data-bench-page="item">
      {`${data.value.id}:${data.value.byteLength}`}
    </main>
  )
}
