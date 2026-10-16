import { createFileRoute } from '@tanstack/vue-router'
import { getSlowLoaderDeferred } from '../../../slow-loaders'

export const Route = createFileRoute('/slow/$id')({
  loader: async ({ params }: { params: { id: string } }) => {
    const deferred = getSlowLoaderDeferred(params.id)

    return await deferred.promise
  },
  component: SlowComponent,
})

function SlowComponent() {
  const data = Route.useLoaderData()

  return (
    <main data-bench-id={data.value.id} data-bench-page="slow">
      {`${data.value.kind}:${data.value.id}:${data.value.ts}`}
    </main>
  )
}
