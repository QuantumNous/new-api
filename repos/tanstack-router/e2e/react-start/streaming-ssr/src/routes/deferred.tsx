import { Await, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Suspense } from 'react'

// Server function that returns immediately
const getImmediateData = createServerFn({ method: 'GET' })
  .validator((data: { name: string }) => data)
  .handler(({ data }) => {
    return {
      name: data.name,
      timestamp: Date.now(),
      // Track where this data came from - should always be 'server' if SSR works
      source: 'server' as const,
    }
  })

// Server function that takes time to complete
const getSlowData = createServerFn({ method: 'GET' })
  .validator((data: { name: string; delay: number }) => data)
  .handler(async ({ data }) => {
    await new Promise((r) => setTimeout(r, data.delay))
    return {
      name: data.name,
      timestamp: Date.now(),
      // Track where this data came from - should always be 'server' if SSR works
      source: 'server' as const,
    }
  })

export const Route = createFileRoute('/deferred')({
  loader: async () => {
    return {
      // Deferred promise that resolves after 1 second
      deferredData: new Promise<{ message: string; source: string }>((r) =>
        setTimeout(
          () =>
            r({
              message: 'Deferred data loaded!',
              // Track where this data came from - should always be 'server' if SSR works
              source: typeof window === 'undefined' ? 'server' : 'client',
            }),
          1000,
        ),
      ),
      // Deferred server function call
      deferredServerData: getSlowData({
        data: { name: 'Slow User', delay: 800 },
      }),
      // Immediate data (awaited)
      immediateData: await getImmediateData({ data: { name: 'Fast User' } }),
      // Track where loader ran - should always be 'server' if SSR works
      loaderSource: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  component: Deferred,
})

function Deferred() {
  const { deferredData, deferredServerData, immediateData, loaderSource } =
    Route.useLoaderData()

  return (
    <div style={{ padding: '20px' }}>
      <h2>Deferred Data Test</h2>

      {/* Immediate data should be available right away */}
      <div data-testid="immediate-data">
        Immediate: {immediateData.name} @ {immediateData.timestamp}
      </div>

      <div data-testid="immediate-source">
        Immediate source: {immediateData.source}
      </div>

      <div data-testid="loader-source">Loader source: {loaderSource}</div>

      {/* Deferred promise */}
      <Suspense
        fallback={<div data-testid="deferred-loading">Loading deferred...</div>}
      >
        <Await
          promise={deferredData}
          children={(data) => (
            <div data-testid="deferred-data">
              {data.message} (source: {data.source})
            </div>
          )}
        />
      </Suspense>

      {/* Deferred server function */}
      <Suspense
        fallback={
          <div data-testid="server-loading">Loading server data...</div>
        }
      >
        <Await
          promise={deferredServerData}
          children={(data) => (
            <div data-testid="deferred-server-data">
              Server: {data.name} @ {data.timestamp} (source: {data.source})
            </div>
          )}
        />
      </Suspense>
    </div>
  )
}
