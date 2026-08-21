import { Link, createFileRoute } from '@tanstack/solid-router'
import { Suspense, createResource } from 'solid-js'
import { z } from 'zod'

export const Route = createFileRoute('/transition/count/create-resource')({
  validateSearch: z.object({
    n: z.number().default(1),
  }),
  component: Home,
})

function Home() {
  return (
    <div class="p-2">
      <Link
        data-testid="increase-button"
        class="border bg-gray-50 px-3 py-1"
        from="/transition/count/create-resource"
        search={(s) => ({ n: s.n + 1 })}
      >
        Increase
      </Link>

      <Result />
    </div>
  )
}

function Result() {
  const searchQuery = Route.useSearch()

  const [doubleQuery] = createResource(
    () => searchQuery().n,
    async (n) => {
      await new Promise((r) => setTimeout(r, 1000))
      return n * 2
    },
  )

  return (
    <div class="mt-2">
      <Suspense fallback="Loading...">
        <div data-testid="n-value">n: {searchQuery().n}</div>
        <div data-testid="double-value">double: {doubleQuery()}</div>
      </Suspense>
    </div>
  )
}
