import { createFileRoute, useNavigate } from '@tanstack/solid-router'
import { z } from 'zod'

export const Route = createFileRoute('/relative/useNavigate/with-search/')({
  component: RouteComponent,
  validateSearch: z.object({
    searchParam: z.string().default('1'),
  }),
})

function RouteComponent() {
  const navigate = useNavigate()
  const searchParams = Route.useSearch()

  return (
    <>
      <div data-testid="relative-useNavigate-withSearch-header">
        Hello "/relative/useNavigate/with-search/" searchParam:{' '}
        {searchParams().searchParam}!
      </div>
      <hr />
      <button
        onClick={() =>
          navigate({
            to: '.',
            search: { searchParam: '2' },
          })
        }
        data-testid="relative-useNavigate-withSearch-update-param"
      >
        Update Search
      </button>
    </>
  )
}
