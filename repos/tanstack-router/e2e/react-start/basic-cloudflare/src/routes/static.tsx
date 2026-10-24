import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

export const Route = createFileRoute('/static')({
  loader: () => getData(),
  component: StaticPage,
})

const getData = createServerFn().handler(() => {
  return {
    myVar: env.MY_VAR,
  }
})

function StaticPage() {
  const data = Route.useLoaderData()

  return (
    <div>
      <h1 data-testid="static-heading">Static Page</h1>
      <p data-testid="static-content">The value is {data.myVar}</p>
    </div>
  )
}
