import { useQuery } from '@tanstack/solid-query'
import { createFileRoute, redirect } from '@tanstack/solid-router'
import { createServerFn, useServerFn } from '@tanstack/solid-start'
import { Suspense } from 'solid-js'

const $redirectServerFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    throw redirect({ to: '/redirect-test/target' })
  },
)

export const Route = createFileRoute('/redirect-test/')({
  component: RouteComponent,
  ssr: 'data-only',
})

function RouteComponent() {
  const redirectFn = useServerFn($redirectServerFn)
  const query = useQuery(() => ({
    queryKey: ['redirect-test'],
    queryFn: () => redirectFn(),
  }))

  return (
    <div>
      <h1 data-testid="redirect-source">Redirect Source</h1>
      <Suspense>
        <div>{JSON.stringify(query.data)}</div>
      </Suspense>
    </div>
  )
}
