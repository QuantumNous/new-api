import { createFileRoute, Link } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/relative/link/with-search/')({
  component: RouteComponent,
  validateSearch: z.object({
    searchParam: z.string().default('1'),
  }),
})

function RouteComponent() {
  const { searchParam } = Route.useSearch()
  return (
    <>
      <div data-testid="relative-link-withSearch-header">
        Hello "/relative/link/with-search/" searchParam: {searchParam}!
      </div>
      <hr />
      <Link
        to="."
        data-testid="relative-link-withSearch-update-param"
        search={{ searchParam: '2' }}
      >
        Update Search
      </Link>
    </>
  )
}
