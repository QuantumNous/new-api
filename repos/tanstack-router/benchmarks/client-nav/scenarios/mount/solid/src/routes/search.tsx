import { createFileRoute } from '@tanstack/solid-router'
import { normalizePage, normalizeQuery } from '../../../shared'

export const Route = createFileRoute('/search')({
  validateSearch: (search: Record<string, unknown>) => ({
    q: normalizeQuery(search.q),
    page: normalizePage(search.page),
  }),
  component: SearchPage,
})

function SearchPage() {
  const search = Route.useSearch()

  return <p>{`Results for "${search().q}" page ${search().page}`}</p>
}
