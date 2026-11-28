import { createFileRoute, notFound } from '@tanstack/react-router'
import type { NotFoundRouteProps } from '@tanstack/react-router'

export const Route = createFileRoute('/not-found/deep/b/c/d')({
  loaderDeps: ({ search }) => ({
    throwAt: search.throwAt,
  }),
  beforeLoad: ({ search }) => {
    if (search.throwAt === 'd') {
      throw notFound({
        data: { source: 'd-beforeLoad' },
      })
    }
  },
  loader: ({ deps }) => {
    if (deps.throwAt === 'c') {
      throw new Error('d-loader-should-not-run-when-c-beforeLoad-throws')
    }
    return { ready: true }
  },
  component: RouteComponent,
  notFoundComponent: (props: NotFoundRouteProps) => (
    <div data-testid="deep-d-notFound-component">
      Not Found at /not-found/deep/b/c/d (
      {(props.data as { source?: string })?.source ?? 'unknown'})
    </div>
  ),
})

function RouteComponent() {
  return (
    <div data-testid="deep-d-route-component">
      Hello "/not-found/deep/b/c/d"!
    </div>
  )
}
