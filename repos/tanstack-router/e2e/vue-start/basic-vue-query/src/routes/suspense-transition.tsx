import { queryOptions, useQuery } from '@tanstack/vue-query'
import { Link, createFileRoute } from '@tanstack/vue-router'
import { ref, watchEffect } from 'vue'

const doubleQueryOptions = (n: number) =>
  queryOptions({
    queryKey: ['double', n],
    queryFn: async () => {
      // Add a delay to make the transition observable
      await new Promise((r) => setTimeout(r, 500))
      return n * 2
    },
    placeholderData: (previousData) => previousData,
  })

export const Route = createFileRoute('/suspense-transition')({
  validateSearch: (search: { n?: number }) => ({ n: search.n ?? 1 }),
  component: SuspenseTransitionComponent,
  ssr: false, // Disable SSR to avoid suspense issues during initial load
})

function SuspenseTransitionComponent() {
  return (
    <div class="p-2">
      <h1 data-testid="suspense-transition-title">Suspense Transition Test</h1>

      <div class="flex gap-2 my-4">
        <Link
          data-testid="increase-button"
          class="border bg-gray-50 px-3 py-1"
          from="/suspense-transition"
          search={(s) => ({ n: s.n + 1 })}
        >
          Increase
        </Link>
      </div>

      <Result />
    </div>
  )
}

function Result() {
  const search = Route.useSearch()
  const doubleQuery = useQuery(() => doubleQueryOptions(search.value.n))
  const displayedN = ref(search.value.n)
  const displayedDouble = ref<number | undefined>(undefined)

  watchEffect(() => {
    if (doubleQuery.data.value !== undefined) {
      displayedN.value = search.value.n
      displayedDouble.value = doubleQuery.data.value
    }
  })

  return (
    <div class="mt-2 border p-4">
      <div data-testid="suspense-fallback" style={{ display: 'none' }}>
        Loading...
      </div>
      <div data-testid="suspense-content">
        <div>
          n: <span data-testid="n-value">{displayedN.value}</span>
        </div>
        <div>
          double:{' '}
          <span data-testid="double-value">{displayedDouble.value}</span>
        </div>
      </div>
    </div>
  )
}
