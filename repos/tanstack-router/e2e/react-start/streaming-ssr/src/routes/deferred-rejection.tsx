import { Await, createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

const deferredErrorMessage = 'Error in deferred object'

export const Route = createFileRoute('/deferred-rejection')({
  loader: async () => {
    return {
      deferredData: new Promise<string>((_resolve, reject) => {
        setTimeout(() => {
          reject(new Error(deferredErrorMessage))
        }, 1000)
      }),
    }
  },
  errorComponent: ({ error }) => (
    <div data-testid="deferred-error-boundary">{error.message}</div>
  ),
  component: DeferredRejection,
})

function DeferredRejection() {
  const { deferredData } = Route.useLoaderData()

  return (
    <div style={{ padding: '20px' }}>
      <h2>Deferred Rejection Test</h2>
      <Suspense
        fallback={<div data-testid="deferred-loading">Loading deferred...</div>}
      >
        <Await
          promise={deferredData}
          children={(data) => <div data-testid="deferred-data">{data}</div>}
        />
      </Suspense>
    </div>
  )
}
