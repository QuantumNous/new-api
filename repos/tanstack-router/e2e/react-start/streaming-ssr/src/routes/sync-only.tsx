import { createFileRoute } from '@tanstack/react-router'

/**
 * This route tests synchronous serialization - no deferred data, no streaming.
 * The loader returns data synchronously (awaited), so crossSerializeStream
 * completes immediately and all bootstrap scripts should be in the initial HTML.
 */
export const Route = createFileRoute('/sync-only')({
  loader: async () => {
    // Simulate a fast synchronous data fetch
    // This data is awaited, not deferred, so serialization completes synchronously
    return {
      message: 'Hello from sync loader!',
      timestamp: Date.now(),
      items: ['item-1', 'item-2', 'item-3'],
      // Track where this data came from - should always be 'server' if SSR works
      source: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  component: SyncOnly,
})

function SyncOnly() {
  const data = Route.useLoaderData()

  return (
    <div style={{ padding: '20px' }}>
      <h1 data-testid="sync-title">Synchronous Serialization Test</h1>
      <p data-testid="sync-message">{data.message}</p>
      <p data-testid="sync-timestamp">Loaded at: {data.timestamp}</p>
      <p data-testid="sync-source">Source: {data.source}</p>
      <ul data-testid="sync-items">
        {data.items.map((item) => (
          <li key={item} data-testid={`sync-item-${item}`}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}
