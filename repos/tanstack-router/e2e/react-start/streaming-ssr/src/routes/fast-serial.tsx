import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'

// Server function that returns immediately with minimal data
const getSmallData = createServerFn({ method: 'GET' }).handler(() => {
  return {
    value: 'small-data',
    timestamp: Date.now(),
    // Track where this data came from - should always be 'server' if SSR works
    source: 'server' as const,
  }
})

export const Route = createFileRoute('/fast-serial')({
  loader: async () => {
    // All data is awaited immediately - serialization should complete quickly
    const data = await getSmallData()
    return {
      serverData: data,
      staticData: 'This is static data',
      timestamp: Date.now(),
      // Track where loader ran - should always be 'server' if SSR works
      loaderSource: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  component: FastSerial,
})

function FastSerial() {
  const { serverData, staticData, timestamp, loaderSource } =
    Route.useLoaderData()

  return (
    <div style={{ padding: '20px' }}>
      <h2>Fast Serialization Test</h2>
      <p>This route tests when serialization completes before render.</p>

      <div data-testid="server-data">
        Server: {serverData.value} @ {serverData.timestamp}
      </div>

      <div data-testid="server-fn-source">
        Server function source: {serverData.source}
      </div>

      <div data-testid="loader-source">Loader source: {loaderSource}</div>

      <div data-testid="static-data">Static: {staticData}</div>

      <div data-testid="loader-timestamp">Loader timestamp: {timestamp}</div>
    </div>
  )
}
