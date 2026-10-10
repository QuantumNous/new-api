import { Await, createFileRoute } from '@tanstack/solid-router'
import { Suspense } from 'solid-js'
import { makeBigPayload, sleep0 } from '../../../shared-data'

export const Route = createFileRoute('/stream/$id')({
  loader: ({ params }) => ({
    fast: { label: `fast-${params.id}` },
    slowSmall: sleep0().then(() => ({ label: `slow-small-${params.id}` })),
    slowBig: sleep0().then(() => makeBigPayload(params.id)),
  }),
  component: StreamComponent,
})

function StreamComponent() {
  const data = Route.useLoaderData()

  return (
    <>
      <p>{data().fast.label}</p>
      <p>loading-small</p>
      <Suspense fallback={null}>
        <Await promise={data().slowSmall}>{(d) => <p>{d.label}</p>}</Await>
      </Suspense>
      <p>loading-big</p>
      <Suspense fallback={null}>
        <Await promise={data().slowBig}>
          {(d) => (
            <section>
              <h2>{d.label}</h2>
              {d.chunks.map((chunk) => (
                <p>{chunk.value}</p>
              ))}
            </section>
          )}
        </Await>
      </Suspense>
    </>
  )
}
