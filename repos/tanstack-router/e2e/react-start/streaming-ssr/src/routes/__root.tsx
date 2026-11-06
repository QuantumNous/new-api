import { useState } from 'react'
import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Streaming SSR Tests',
      },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

/**
 * Global hydration check component rendered in the root layout.
 * Tests can click the button and verify the status changes to confirm
 * that React has hydrated and the app is interactive.
 */
function HydrationCheck() {
  const [status, setStatus] = useState<'pending' | 'hydrated'>('pending')

  return (
    <div
      data-testid="hydration-check"
      style={{
        padding: '8px',
        backgroundColor: status === 'hydrated' ? '#d4edda' : '#f8f9fa',
        borderBottom: '1px solid #ccc',
      }}
    >
      <button
        data-testid="hydration-check-btn"
        onClick={() => setStatus('hydrated')}
      >
        {status === 'pending' ? 'Check Hydration' : 'Hydrated!'}
      </button>
      <span data-testid="hydration-status" style={{ marginLeft: '10px' }}>
        {status}
      </span>
    </div>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <head>
        <HeadContent />
      </head>
      <body>
        <HydrationCheck />
        <nav style={{ padding: '10px', borderBottom: '1px solid #ccc' }}>
          <Link to="/" style={{ marginRight: '10px' }}>
            Home
          </Link>
          <Link to="/sync-only" style={{ marginRight: '10px' }}>
            Sync Only
          </Link>
          <Link to="/deferred" style={{ marginRight: '10px' }}>
            Deferred
          </Link>
          <Link to="/deferred-rejection" style={{ marginRight: '10px' }}>
            Deferred Rejection
          </Link>
          <Link to="/stream" style={{ marginRight: '10px' }}>
            Stream
          </Link>
          <Link to="/fast-serial" style={{ marginRight: '10px' }}>
            Fast Serial
          </Link>
          <Link to="/slow-render" style={{ marginRight: '10px' }}>
            Slow Render
          </Link>
          <Link to="/nested-deferred" style={{ marginRight: '10px' }}>
            Nested Deferred
          </Link>
          <Link to="/many-promises" style={{ marginRight: '10px' }}>
            Many Promises
          </Link>
          <Link to="/query-heavy" style={{ marginRight: '10px' }}>
            Query Heavy
          </Link>
          <Link to="/concurrent" style={{ marginRight: '10px' }}>
            Concurrent
          </Link>
        </nav>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
