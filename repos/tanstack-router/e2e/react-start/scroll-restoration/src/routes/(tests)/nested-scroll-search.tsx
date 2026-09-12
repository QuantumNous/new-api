import { Link, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/(tests)/nested-scroll-search')({
  validateSearch: z.object({
    query: z.string().optional(),
  }),
  component: Component,
})

function Component() {
  const search = Route.useSearch()
  const query = search.query ?? 'none'

  return (
    <div className="grid gap-4 p-2">
      <h3>nested-scroll-search</h3>
      <p data-testid="nested-scroll-search-query">query: {query}</p>
      <div className="flex gap-2">
        <Link
          to="/nested-scroll-search"
          search={{ query: 'xyz' }}
          data-testid="nested-scroll-search-link"
        >
          Set query
        </Link>
        <Link to="/nested-scroll-away" data-testid="nested-scroll-away-link">
          Away
        </Link>
      </div>
      <div
        data-scroll-restoration-id="nested-scroll-search-container"
        data-testid="nested-scroll-search-container"
        className="h-24 overflow-auto rounded border p-2"
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <div key={i}>
            Query {query} row {i}
          </div>
        ))}
      </div>
    </div>
  )
}
