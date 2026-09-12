import { createFileRoute } from '@tanstack/solid-router'
import { Suspense, createResource } from 'solid-js'

export const Route = createFileRoute('/transition/typing/create-resource')({
  validateSearch: (search: { query?: string }) => ({
    query: search.query ?? '',
  }),
  component: Home,
  ssr: true,
})

function Home() {
  const searchQuery = Route.useSearch()
  const navigate = Route.useNavigate()

  const [asyncResult] = createResource(
    () => searchQuery().query,
    async (query) => {
      await new Promise((r) => setTimeout(r, 1000))
      return query
    },
  )

  return (
    <div class="p-2">
      <div class="mt-2">
        <input
          class="border bg-gray-50 text-black px-3 py-1"
          value={''}
          placeholder="Type to search..."
          onInput={(e) => {
            navigate({ search: { query: e.currentTarget.value } })
          }}
        />
        <br />
        <Suspense fallback="Loading...">
          Query: {searchQuery().query}
          <br />
          Result: {asyncResult()}
        </Suspense>{' '}
      </div>
    </div>
  )
}
