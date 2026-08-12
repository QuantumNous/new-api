import { createFileRoute } from '@tanstack/vue-router'
import { z } from 'zod'

export const Route = createFileRoute('/search-params/default')({
  validateSearch: z.object({
    default: z.string().default('d1'),
  }),
  beforeLoad: ({ context }) => {
    if (context.hello !== 'world') {
      throw new Error('Context hello is not "world"')
    }
  },
  loader: ({ context }) => {
    if (context.hello !== 'world') {
      throw new Error('Context hello is not "world"')
    }
  },
  component: () => {
    const search = Route.useSearch()
    const context = Route.useRouteContext()
    return (
      <>
        <div data-testid="search-default">{search.value.default}</div>
        <div data-testid="context-hello">{context.value.hello}</div>
      </>
    )
  },
})
