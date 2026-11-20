import { createFileRoute } from '@tanstack/solid-router'
import { createServerFn } from '@tanstack/solid-start'

export const Route = createFileRoute('/')({
  loader: () => getData(),
  component: Home,
})

const getData = createServerFn().handler(() => {
  return {
    message: `Running in ${navigator.userAgent}`,
  }
})

function Home() {
  const data = Route.useLoaderData()

  return (
    <div class="p-2">
      <h3>Welcome Home!!!</h3>
      <p>{data().message}</p>
    </div>
  )
}
