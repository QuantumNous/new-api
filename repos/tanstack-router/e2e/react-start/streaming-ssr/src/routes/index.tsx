import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div style={{ padding: '20px' }}>
      <h1 data-testid="index-title">Streaming SSR Test Scenarios</h1>
      <p>This e2e project tests various SSR streaming scenarios:</p>
      <ul>
        <li>
          <Link to="/sync-only" data-testid="link-sync-only">
            Sync Only
          </Link>{' '}
          - Tests synchronous serialization with no deferred/streaming data
        </li>
        <li>
          <Link to="/deferred" data-testid="link-deferred">
            Deferred Data
          </Link>{' '}
          - Tests deferred promises resolving after initial render
        </li>
        <li>
          <Link to="/deferred-rejection" data-testid="link-deferred-rejection">
            Deferred Rejection
          </Link>{' '}
          - Tests deferred promise rejections render through the error boundary
        </li>
        <li>
          <Link to="/stream" data-testid="link-stream">
            ReadableStream
          </Link>{' '}
          - Tests streaming data via ReadableStream
        </li>
        <li>
          <Link to="/fast-serial" data-testid="link-fast-serial">
            Fast Serialization
          </Link>{' '}
          - Tests when serialization completes before render finishes
        </li>
        <li>
          <Link to="/slow-render" data-testid="link-slow-render">
            Slow Render
          </Link>{' '}
          - Tests when render takes longer than serialization
        </li>
        <li>
          <Link to="/nested-deferred" data-testid="link-nested-deferred">
            Nested Deferred
          </Link>{' '}
          - Tests nested components with deferred data
        </li>
      </ul>
    </div>
  )
}
