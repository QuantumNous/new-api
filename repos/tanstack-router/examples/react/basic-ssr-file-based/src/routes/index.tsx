import { Await, createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

export const Route = createFileRoute('/')({
  loader: () => ({
    date: new Date(),
  }),
  component: IndexComponent,
})

function IndexComponent() {
  const data = Route.useLoaderData()

  return (
    <div className="p-2">
      <h3>Welcome Home!</h3>
      <p>Data: {data.date.getDate()}</p>
    </div>
  )
}
