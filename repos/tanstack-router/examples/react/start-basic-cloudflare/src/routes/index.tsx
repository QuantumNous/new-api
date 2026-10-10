import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

export const Route = createFileRoute('/')({
  loader: () => getData(),
  component: Home,
})

const getData = createServerFn().handler(() => {
  return {
    message: `Running in ${navigator.userAgent}`,
    myVar: env.MY_VAR,
  }
})

function Home() {
  const data = Route.useLoaderData()

  return (
    <div className="p-2">
      <h3>Welcome Home!!!</h3>
      <p>{data.message}</p>
      <p>{data.myVar}</p>
    </div>
  )
}
