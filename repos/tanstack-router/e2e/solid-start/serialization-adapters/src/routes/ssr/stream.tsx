import { Await, createFileRoute } from '@tanstack/solid-router'
import { Suspense } from 'solid-js'
import { RenderData, makeData } from '~/data'

export const Route = createFileRoute('/ssr/stream')({
  loader: () => {
    const dataPromise = new Promise<ReturnType<typeof makeData>>((r) =>
      setTimeout(() => r(makeData()), 1000),
    )
    return {
      someString: 'hello world',
      dataPromise,
    }
  },

  errorComponent: (e) => <div>{e.error.message} </div>,
  component: RouteComponent,
})

function RouteComponent() {
  const loaderData = Route.useLoaderData()
  return (
    <div>
      <h3 data-testid="stream-heading">Stream</h3>
      <div data-testid="some-data">{loaderData().someString}</div>
      <Suspense fallback={<div>Loading...</div>}>
        <Await promise={loaderData().dataPromise}>
          {(data) => <RenderData id="stream" data={data} />}
        </Await>
      </Suspense>
    </div>
  )
}
