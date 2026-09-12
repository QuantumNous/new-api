import { Await, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Suspense } from 'react'

// Server function that completes quickly
const getQuickData = createServerFn({ method: 'GET' }).handler(() => {
  return {
    name: 'Quick data',
    timestamp: Date.now(),
    // Track where this data came from - should always be 'server' if SSR works
    source: 'server' as const,
  }
})

// Simulate a slow component render by doing work during render
function SlowComponent({ data, index }: { data: string; index: number }) {
  // This simulates a component that takes time to render
  const startTime = Date.now()
  while (Date.now() - startTime < 100) {
    // Blocking loop to simulate slow render
  }
  return <div data-testid={`slow-component-${index}`}>{data}</div>
}

export const Route = createFileRoute('/slow-render')({
  loader: async () => {
    // All data loads quickly
    const quickData = await getQuickData()
    return {
      quickData,
      // Deferred data that resolves before render might complete
      deferredData: new Promise<{ message: string; source: string }>((r) =>
        setTimeout(
          () =>
            r({
              message: 'Deferred resolved!',
              // Track where this data came from - should always be 'server' if SSR works
              source: typeof window === 'undefined' ? 'server' : 'client',
            }),
          50,
        ),
      ),
      // Track where loader ran - should always be 'server' if SSR works
      loaderSource: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  component: SlowRender,
})

function SlowRender() {
  const { quickData, deferredData, loaderSource } = Route.useLoaderData()

  return (
    <div style={{ padding: '20px' }}>
      <h2>Slow Render Test</h2>
      <p>Tests when render takes longer than serialization.</p>

      <div data-testid="quick-data">
        Quick: {quickData.name} @ {quickData.timestamp}
      </div>

      <div data-testid="quick-source">
        Quick data source: {quickData.source}
      </div>

      <div data-testid="loader-source">Loader source: {loaderSource}</div>

      <Suspense fallback={<div data-testid="deferred-loading">Loading...</div>}>
        <Await
          promise={deferredData}
          children={(data) => (
            <div data-testid="deferred-resolved">
              {data.message} (source: {data.source})
            </div>
          )}
        />
      </Suspense>

      {/* Multiple slow components to extend render time */}
      <SlowComponent data="Slow component 1" index={1} />
      <SlowComponent data="Slow component 2" index={2} />
      <SlowComponent data="Slow component 3" index={3} />
    </div>
  )
}
