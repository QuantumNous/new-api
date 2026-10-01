import { Await, createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'

const promise = createServerFn().handler(async () => {
  await new Promise((r) => setTimeout(r, 3000))
  return crypto.randomUUID()
})

export const Route = createFileRoute('/deferred-without-suspense')({
  component: RouteComponent,
  loader() {
    return { promise: promise() }
  },
})

function RouteComponent() {
  const data = Route.useLoaderData()
  return (
    <>
      data{' '}
      <Await
        fallback={
          <p data-testid="deferred-without-suspense-loading">Loading...</p>
        }
        promise={data().promise}
      >
        {(data) => (
          <span data-testid="deferred-without-suspense-data">{data}</span>
        )}
      </Await>
    </>
  )
}
