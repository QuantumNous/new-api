import { Await, createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

export const Route = createFileRoute('/')({
  loader: () => ({
    date: new Date(),
    deferred: new Promise<{ date: Date }>((r) =>
      setTimeout(() => r({ date: new Date() }), 1000),
    ),
  }),
  component: IndexComponent,
})

function IndexComponent() {
  const data = Route.useLoaderData()

  return (
    <div className="p-2">
      <h3>Welcome Home!</h3>
      <p>Data: {data.date.getDate()}</p>
      <Await promise={data.deferred} fallback="Loading...">
        {(data) => <p>Deferred: {new Date(data.date).getDate()}</p>}
      </Await>
    </div>
  )
}
