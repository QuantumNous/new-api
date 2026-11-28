import { queryOptions, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

/**
 * Tests multiple useSuspenseQuery calls on a single route.
 * Some queries have synchronous queryFn (return immediately),
 * some have async queryFn with various delays.
 *
 * This stresses the SSR query streaming integration.
 */

// Synchronous query - returns immediately (no await)
const syncQuery1 = queryOptions({
  queryKey: ['sync', 1],
  queryFn: () => {
    // Synchronous return - no Promise delay
    return {
      type: 'sync',
      id: 1,
      value: 'sync-value-1',
      source: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  staleTime: Infinity,
})

const syncQuery2 = queryOptions({
  queryKey: ['sync', 2],
  queryFn: () => {
    return {
      type: 'sync',
      id: 2,
      value: 'sync-value-2',
      source: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  staleTime: Infinity,
})

const syncQuery3 = queryOptions({
  queryKey: ['sync', 3],
  queryFn: () => {
    return {
      type: 'sync',
      id: 3,
      value: 'sync-value-3',
      source: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  staleTime: Infinity,
})

// Fast async queries (50-100ms)
const fastAsyncQuery1 = queryOptions({
  queryKey: ['fast-async', 1],
  queryFn: async () => {
    await new Promise((r) => setTimeout(r, 50))
    return {
      type: 'fast-async',
      id: 1,
      value: 'fast-async-1',
      source: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  staleTime: Infinity,
})

const fastAsyncQuery2 = queryOptions({
  queryKey: ['fast-async', 2],
  queryFn: async () => {
    await new Promise((r) => setTimeout(r, 75))
    return {
      type: 'fast-async',
      id: 2,
      value: 'fast-async-2',
      source: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  staleTime: Infinity,
})

const fastAsyncQuery3 = queryOptions({
  queryKey: ['fast-async', 3],
  queryFn: async () => {
    await new Promise((r) => setTimeout(r, 100))
    return {
      type: 'fast-async',
      id: 3,
      value: 'fast-async-3',
      source: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  staleTime: Infinity,
})

// Slow async queries (200-400ms)
const slowAsyncQuery1 = queryOptions({
  queryKey: ['slow-async', 1],
  queryFn: async () => {
    await new Promise((r) => setTimeout(r, 200))
    return {
      type: 'slow-async',
      id: 1,
      value: 'slow-async-1',
      source: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  staleTime: Infinity,
})

const slowAsyncQuery2 = queryOptions({
  queryKey: ['slow-async', 2],
  queryFn: async () => {
    await new Promise((r) => setTimeout(r, 300))
    return {
      type: 'slow-async',
      id: 2,
      value: 'slow-async-2',
      source: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  staleTime: Infinity,
})

const slowAsyncQuery3 = queryOptions({
  queryKey: ['slow-async', 3],
  queryFn: async () => {
    await new Promise((r) => setTimeout(r, 400))
    return {
      type: 'slow-async',
      id: 3,
      value: 'slow-async-3',
      source: typeof window === 'undefined' ? 'server' : 'client',
    }
  },
  staleTime: Infinity,
})

export const Route = createFileRoute('/query-heavy')({
  component: QueryHeavy,
})

// Individual query components to test Suspense boundaries
function SyncQueryDisplay({
  queryOpts,
  testId,
}: {
  queryOpts: typeof syncQuery1
  testId: string
}) {
  const { data } = useSuspenseQuery(queryOpts)
  return (
    <div data-testid={testId}>
      {data.value} (source: {data.source})
    </div>
  )
}

function AsyncQueryDisplay({
  queryOpts,
  testId,
}: {
  queryOpts: typeof fastAsyncQuery1
  testId: string
}) {
  const { data } = useSuspenseQuery(queryOpts)
  return (
    <div data-testid={testId}>
      {data.value} (source: {data.source})
    </div>
  )
}

function QueryHeavy() {
  return (
    <div style={{ padding: '20px' }}>
      <h2>Query Heavy Test (9 useSuspenseQuery calls)</h2>
      <p>Tests multiple useSuspenseQuery with mixed sync/async queryFn.</p>
      <p>
        All queries should show "source: server" if SSR streaming works
        correctly.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
          marginTop: '20px',
        }}
      >
        {/* Sync queries - should resolve immediately */}
        <div>
          <h3>Sync Queries (immediate)</h3>
          <Suspense
            fallback={<div data-testid="sync-1-loading">Loading sync 1...</div>}
          >
            <SyncQueryDisplay queryOpts={syncQuery1} testId="sync-query-1" />
          </Suspense>
          <Suspense
            fallback={<div data-testid="sync-2-loading">Loading sync 2...</div>}
          >
            <SyncQueryDisplay queryOpts={syncQuery2} testId="sync-query-2" />
          </Suspense>
          <Suspense
            fallback={<div data-testid="sync-3-loading">Loading sync 3...</div>}
          >
            <SyncQueryDisplay queryOpts={syncQuery3} testId="sync-query-3" />
          </Suspense>
        </div>

        {/* Fast async queries */}
        <div>
          <h3>Fast Async Queries (50-100ms)</h3>
          <Suspense
            fallback={
              <div data-testid="fast-async-1-loading">Loading fast 1...</div>
            }
          >
            <AsyncQueryDisplay
              queryOpts={fastAsyncQuery1}
              testId="fast-async-query-1"
            />
          </Suspense>
          <Suspense
            fallback={
              <div data-testid="fast-async-2-loading">Loading fast 2...</div>
            }
          >
            <AsyncQueryDisplay
              queryOpts={fastAsyncQuery2}
              testId="fast-async-query-2"
            />
          </Suspense>
          <Suspense
            fallback={
              <div data-testid="fast-async-3-loading">Loading fast 3...</div>
            }
          >
            <AsyncQueryDisplay
              queryOpts={fastAsyncQuery3}
              testId="fast-async-query-3"
            />
          </Suspense>
        </div>

        {/* Slow async queries */}
        <div>
          <h3>Slow Async Queries (200-400ms)</h3>
          <Suspense
            fallback={
              <div data-testid="slow-async-1-loading">Loading slow 1...</div>
            }
          >
            <AsyncQueryDisplay
              queryOpts={slowAsyncQuery1}
              testId="slow-async-query-1"
            />
          </Suspense>
          <Suspense
            fallback={
              <div data-testid="slow-async-2-loading">Loading slow 2...</div>
            }
          >
            <AsyncQueryDisplay
              queryOpts={slowAsyncQuery2}
              testId="slow-async-query-2"
            />
          </Suspense>
          <Suspense
            fallback={
              <div data-testid="slow-async-3-loading">Loading slow 3...</div>
            }
          >
            <AsyncQueryDisplay
              queryOpts={slowAsyncQuery3}
              testId="slow-async-query-3"
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
