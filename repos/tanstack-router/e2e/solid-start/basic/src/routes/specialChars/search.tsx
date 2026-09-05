import { createFileRoute } from '@tanstack/solid-router'
import z from 'zod'

export const Route = createFileRoute('/specialChars/search')({
  validateSearch: z.object({
    searchParam: z.string(),
  }),
  component: RouteComponent,
})

function RouteComponent() {
  const search = Route.useSearch()

  return (
    <div>
      Hello "/specialChars/search"!
      <span data-testid={'special-search-param'}>{search().searchParam}</span>
    </div>
  )
}
