import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/search-params/loader-throws-redirect')({
  validateSearch: z.object({
    step: z.enum(['a', 'b', 'c']).optional(),
  }),
  loaderDeps: ({ search: { step } }) => ({ step }),
  loader: ({ deps: { step } }) => {
    if (step === undefined) {
      throw redirect({
        to: '/search-params/loader-throws-redirect',
        search: { step: 'a' },
      })
    }
  },
  component: () => {
    const search = Route.useSearch()
    return (
      <div>
        <h1>SearchParams</h1>
        <div data-testid="search-param">{search.step}</div>
      </div>
    )
  },
})
