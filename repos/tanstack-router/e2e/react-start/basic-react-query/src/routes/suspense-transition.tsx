import { queryOptions, useQuery } from '@tanstack/react-query'
import { Link, createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

const doubleQueryOptions = (n: number) =>
  queryOptions({
    queryKey: ['double', n],
    queryFn: async () => {
      // Add a delay to make the transition observable
      await new Promise((r) => setTimeout(r, 500))
      return n * 2
    },
  })

export const Route = createFileRoute('/suspense-transition')({
  validateSearch: (search: { n?: number }) => ({ n: search.n ?? 1 }),
  component: SuspenseTransitionComponent,
  ssr: false, // Disable SSR to avoid suspense issues during initial load
})

function SuspenseTransitionComponent() {
  return (
    <div className="p-2">
      <h1 data-testid="suspense-transition-title">Suspense Transition Test</h1>

      <div className="flex gap-2 my-4">
        <Link
          data-testid="increase-button"
          className="border bg-gray-50 px-3 py-1"
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
  const doubleQuery = useQuery(doubleQueryOptions(search.n))

  return (
    <div className="mt-2 border p-4">
      {/* This manual Suspense boundary should transition, not immediately show fallback */}
      <Suspense
        fallback={<div data-testid="suspense-fallback">Loading...</div>}
      >
        <div data-testid="suspense-content">
          <div>
            n: <span data-testid="n-value">{search.n}</span>
          </div>
          <div>
            double: <span data-testid="double-value">{doubleQuery.data}</span>
          </div>
        </div>
      </Suspense>
    </div>
  )
}
