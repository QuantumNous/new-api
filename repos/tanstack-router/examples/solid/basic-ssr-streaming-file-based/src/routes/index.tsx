import { Await, createFileRoute } from '@tanstack/solid-router'
import { Suspense } from 'solid-js'

export const Route = createFileRoute('/')({
  loader: () => ({
    date: new Date(),
    deferred: new Promise<{ date: Date }>((r) =>
      setTimeout(() => r({ date: new Date() }), 1000),
    ),
  }),
  component: Home,
})

function Home() {
  const data = Route.useLoaderData()

  return (
    <div class="p-2">
      <h3>Welcome Home!</h3>
      <p>Data: {data().date.getDate()}</p>
      <Suspense fallback={<div>Loading...</div>}>
        <Await promise={data().deferred}>
          {(data) => <p>Deferred: {new Date(data.date).getDate()}</p>}
        </Await>
      </Suspense>
    </div>
  )
}
