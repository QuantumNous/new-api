import { createFileRoute } from '@tanstack/react-router'
import { getSlowLoaderDeferred } from '../../../slow-loaders'

export const Route = createFileRoute('/slow/$id')({
  loader: async ({ params }) => {
    const deferred = getSlowLoaderDeferred(params.id)

    return await deferred.promise
  },
  component: SlowComponent,
})

function SlowComponent() {
  const data = Route.useLoaderData()

  return (
    <main data-bench-id={data.id} data-bench-page="slow">
      {`${data.kind}:${data.id}:${data.ts}`}
    </main>
  )
}
