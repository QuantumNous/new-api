import { createFileRoute } from '@tanstack/solid-router'
import { queryOptions, useQuery } from '@tanstack/solid-query'
import { Suspense, createSignal } from 'solid-js'

const deferredQueryOptions = () =>
  queryOptions({
    queryKey: ['deferred'],
    queryFn: async () => {
      await new Promise((r) => setTimeout(r, 3000))
      return {
        message: `Hello deferred from the server!`,
        status: 'success',
        time: new Date(),
      }
    },
  })

export const Route = createFileRoute('/deferred')({
  loader: ({ context }) => {
    // Kick off loading as early as possible!
    context.queryClient.prefetchQuery(deferredQueryOptions())
  },
  component: Deferred,
})

function Deferred() {
  const [count, setCount] = createSignal(0)

  return (
    <div class="p-2">
      <Suspense fallback="Loading Middleman...">
        <DeferredQuery />
      </Suspense>
      <div>Count: {count()}</div>
      <div>
        <button onClick={() => setCount(count() + 1)}>Increment</button>
      </div>
    </div>
  )
}

function DeferredQuery() {
  const deferredQuery = useQuery(() => deferredQueryOptions())

  return (
    <div>
      <h1>Deferred Query</h1>
      <div>Status: {deferredQuery.data?.status}</div>
      <div>Message: {deferredQuery.data?.message}</div>
      <div>Time: {deferredQuery.data?.time.toISOString()}</div>
    </div>
  )
}
