import { createFileRoute } from '@tanstack/vue-router'
import { queryOptions, useQuery } from '@tanstack/vue-query'
import { Suspense, defineComponent, ref } from 'vue'

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

const Deferred = defineComponent({
  setup() {
    const count = ref(0)

    return () => (
      <div class="p-2">
        <Suspense>
          {{
            default: () => <DeferredQuery />,
            fallback: () => 'Loading Middleman...',
          }}
        </Suspense>
        <div>Count: {count.value}</div>
        <div>
          <button onClick={() => (count.value += 1)}>Increment</button>
        </div>
      </div>
    )
  },
})

const DeferredQuery = defineComponent({
  async setup() {
    const deferredQuery = useQuery(deferredQueryOptions())
    await deferredQuery.suspense()

    return () => {
      const data = deferredQuery.data.value

      return (
        <div>
          <h1>Deferred Query</h1>
          <div>Status: {data?.status ?? 'loading...'}</div>
          <div>Message: {data?.message ?? ''}</div>
          <div>Time: {data ? new Date(data.time).toISOString() : ''}</div>
        </div>
      )
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
