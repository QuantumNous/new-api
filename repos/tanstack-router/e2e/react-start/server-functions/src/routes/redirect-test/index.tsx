import { useQuery } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn, useServerFn } from '@tanstack/react-start'
import { Suspense } from 'react'

const $redirectServerFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    throw redirect({ to: '/redirect-test/target' })
  },
)

export const Route = createFileRoute('/redirect-test/')({
  component: RouteComponent,
})

function RouteComponent() {
  const redirectFn = useServerFn($redirectServerFn)
  const query = useQuery({
    queryKey: ['redirect-test'],
    queryFn: () => redirectFn(),
  })

  return (
    <div>
      <h1 data-testid="redirect-source">Redirect Source</h1>
      <Suspense>
        <div>{JSON.stringify(query.data)}</div>
      </Suspense>
    </div>
  )
}
