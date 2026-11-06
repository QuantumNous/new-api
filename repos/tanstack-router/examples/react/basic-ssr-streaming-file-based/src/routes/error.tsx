import { Await, createFileRoute } from '@tanstack/react-router'
import * as React from 'react'

async function loadData() {
  await new Promise((r) => setTimeout(r, 2000))
  if (Math.random() > 0.5) throw new Error('Random error in streaming!')
  return 'Hello!'
}

export const Route = createFileRoute('/error')({
  component: ErrorComponent,
  loader: () => {
    if (Math.random() > 0.5) throw new Error('Random error!')
    return {
      deferredData: loadData(),
    }
  },
  pendingComponent: () => <p>Loading..</p>,
  wrapInSuspense: true,
  errorComponent: ({ error }) => {
    return (
      <div className="p-2">
        <h3>Caught: {error.message}</h3>
        <p>(This page has a 75% chance of throwing an error)</p>
      </div>
    )
  },
})

function ErrorComponent() {
  return (
    <div className="p-2">
      <h3>
        The loader of this page will have a 75% chance of throwing an error!
      </h3>

      <Await promise={Route.useLoaderData().deferredData}>
        {(data) => <p>Streaming data loaded successfully: {data}</p>}
      </Await>
    </div>
  )
}
