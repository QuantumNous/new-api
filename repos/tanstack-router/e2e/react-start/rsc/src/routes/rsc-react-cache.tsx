import * as React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderServerComponent } from '@tanstack/react-start/rsc'
import {
  serverBox,
  serverBadge,
  serverHeader,
  timestamp,
} from '~/utils/serverStyles'
import { pageStyles, formatTime } from '~/utils/styles'

// ============================================================================
// React.cache Demo - Memoizing expensive computations within a render pass
// ============================================================================

// Inner async component for the cache demo content
async function ReactCacheContent({
  testCache,
  serverTimestamp,
}: {
  testCache: boolean
  serverTimestamp: number
}) {
  // Keep all test state request-scoped to avoid flakiness from module-level state.
  let cacheFnCount = 0
  let nonCacheFnCount = 0

  const cachedFn = React.cache(async (arg: string) => {
    cacheFnCount++
    // Simulate expensive operation
    await new Promise((resolve) => setTimeout(resolve, 10))
    return {
      arg,
      callNumber: cacheFnCount,
      randomValue: Math.random().toString(36).slice(2, 8),
    }
  })

  const nonCachedFn = async (arg: string) => {
    nonCacheFnCount++
    await new Promise((resolve) => setTimeout(resolve, 10))
    return {
      arg,
      callNumber: nonCacheFnCount,
      randomValue: Math.random().toString(36).slice(2, 8),
    }
  }

  // Only run the test calls when testCache is true
  // This pattern matches the vite-plugin-rsc example
  let cachedResults: Array<{
    arg: string
    callNumber: number
    randomValue: string
  }> = []
  let nonCachedResults: Array<{
    arg: string
    callNumber: number
    randomValue: string
  }> = []

  if (testCache) {
    // Call cachedFn with same and different arguments
    // 'test1' -> cache miss (call 1)
    // 'test2' -> cache miss (call 2)
    // 'test1' -> cache HIT (no call, returns cached result)
    const cached1 = await cachedFn('test1')
    const cached2 = await cachedFn('test2')
    const cached3 = await cachedFn('test1') // should hit cache
    cachedResults = [cached1, cached2, cached3]

    // Call nonCachedFn for comparison - all calls run
    const nonCached1 = await nonCachedFn('test1')
    const nonCached2 = await nonCachedFn('test2')
    const nonCached3 = await nonCachedFn('test1')
    nonCachedResults = [nonCached1, nonCached2, nonCached3]
  }

  // cacheFnCount should be 2 (only 2 unique args)
  // nonCacheFnCount should be 3 (all calls run)
  const cacheWorking = cacheFnCount === 2 && nonCacheFnCount === 3

  // Styles for the visualization
  const callBoxStyle = (isHit: boolean, _isCached: boolean) => ({
    padding: '12px',
    borderRadius: '8px',
    border: `2px solid ${isHit ? '#7c3aed' : '#0284c7'}`,
    backgroundColor: isHit ? '#f5f3ff' : '#f0f9ff',
    marginBottom: '8px',
  })

  const argBadgeStyle = (arg: string) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: arg === 'test1' ? '#dbeafe' : '#fef3c7',
    color: arg === 'test1' ? '#1e40af' : '#92400e',
    fontFamily: 'monospace',
    fontSize: '13px',
    fontWeight: 'bold' as const,
  })

  const statusBadgeStyle = (isHit: boolean) => ({
    display: 'inline-block',
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: isHit ? '#ede9fe' : '#e0f2fe',
    color: isHit ? '#6d28d9' : '#0369a1',
    fontSize: '11px',
    fontWeight: 'bold' as const,
    marginLeft: '8px',
  })

  return (
    <div style={serverBox} data-testid="rsc-react-cache-content">
      <div style={serverHeader}>
        <span style={serverBadge}>REACT.CACHE DEMO</span>
        <span style={timestamp} data-testid="rsc-server-timestamp">
          Rendered: {formatTime(serverTimestamp)}
        </span>
      </div>

      {!testCache ? (
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <div
            style={{
              fontSize: '14px',
              color: '#475569',
              marginBottom: '16px',
            }}
          >
            This demo shows how <code>React.cache</code> deduplicates function
            calls with identical arguments within a single server render.
          </div>
          <a
            href="?test-cache"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#0284c7',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: 'bold',
            }}
            data-testid="test-cache-link"
          >
            Run the Test
          </a>
        </div>
      ) : (
        <>
          {/* Status Banner */}
          <div
            style={{
              padding: '16px',
              backgroundColor: cacheWorking ? '#dbeafe' : '#fee2e2',
              borderRadius: '8px',
              border: cacheWorking ? '2px solid #3b82f6' : '2px solid #ef4444',
              marginBottom: '20px',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: '18px',
                fontWeight: 'bold',
                color: cacheWorking ? '#1d4ed8' : '#dc2626',
              }}
              data-testid="cache-status"
            >
              {cacheWorking ? 'React.cache is working!' : 'Cache was not used'}
            </div>
            <div
              style={{
                fontSize: '13px',
                color: cacheWorking ? '#3b82f6' : '#ef4444',
                marginTop: '4px',
              }}
            >
              {cacheWorking
                ? 'The cached function ran only 2 times for 3 calls (1 cache hit)'
                : 'Expected 2 cached calls but got ' + cacheFnCount}
            </div>
          </div>

          {/* The Experiment */}
          <div
            style={{
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
            }}
          >
            <div
              style={{
                fontWeight: 'bold',
                color: '#1e293b',
                marginBottom: '12px',
                fontSize: '14px',
              }}
            >
              The Experiment
            </div>
            <div
              style={{
                fontFamily: 'monospace',
                fontSize: '13px',
                backgroundColor: '#1e293b',
                color: '#e2e8f0',
                padding: '12px',
                borderRadius: '6px',
                lineHeight: '1.6',
              }}
            >
              <div style={{ color: '#94a3b8' }}>
                // Call the same function 3 times:
              </div>
              <div>
                await cachedFn(
                <span style={{ color: '#93c5fd' }}>'test1'</span>)
                <span style={{ color: '#94a3b8' }}> // unique arg #1</span>
              </div>
              <div>
                await cachedFn(
                <span style={{ color: '#fcd34d' }}>'test2'</span>)
                <span style={{ color: '#94a3b8' }}> // unique arg #2</span>
              </div>
              <div>
                await cachedFn(
                <span style={{ color: '#93c5fd' }}>'test1'</span>)
                <span style={{ color: '#94a3b8' }}>
                  {' '}
                  // same as #1 = CACHE HIT
                </span>
              </div>
            </div>
          </div>

          {/* Side by side comparison */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '20px',
            }}
          >
            {/* With React.cache */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    backgroundColor: '#0284c7',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  WITH React.cache
                </span>
              </div>

              {cachedResults.map((result, index) => {
                const isHit = index === 2 // 3rd call is a cache hit
                return (
                  <div
                    key={index}
                    style={callBoxStyle(isHit, true)}
                    data-testid={`cached-result-${index + 1}`}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span
                          style={{
                            fontSize: '12px',
                            color: '#64748b',
                            marginRight: '8px',
                          }}
                        >
                          Call {index + 1}:
                        </span>
                        <span style={argBadgeStyle(result.arg)}>
                          "{result.arg}"
                        </span>
                        <span style={statusBadgeStyle(isHit)}>
                          {isHit ? 'CACHE HIT' : 'executed'}
                        </span>
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: '8px',
                        fontSize: '12px',
                        color: '#64748b',
                      }}
                    >
                      Result ID:{' '}
                      <code
                        style={{ color: '#0369a1' }}
                        data-testid={`random-value-${index + 1}`}
                      >
                        {result.randomValue}
                      </code>
                      {isHit && (
                        <span style={{ color: '#7c3aed', marginLeft: '8px' }}>
                          (same as Call 1)
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}

              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#dbeafe',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{ fontSize: '12px', color: '#64748b' }}
                  data-testid="cache-fn-count"
                >
                  Function executed{' '}
                  <strong style={{ color: '#1d4ed8', fontSize: '16px' }}>
                    {cacheFnCount}
                  </strong>{' '}
                  times
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  (1 call was served from cache)
                </div>
              </div>
            </div>

            {/* Without React.cache */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px',
                }}
              >
                <span
                  style={{
                    backgroundColor: '#64748b',
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                  }}
                >
                  WITHOUT React.cache
                </span>
              </div>

              {nonCachedResults.map((result, index) => (
                <div
                  key={index}
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    border: '2px solid #cbd5e1',
                    backgroundColor: '#f8fafc',
                    marginBottom: '8px',
                  }}
                  data-testid={`non-cached-result-${index + 1}`}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <span
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginRight: '8px',
                        }}
                      >
                        Call {index + 1}:
                      </span>
                      <span style={argBadgeStyle(result.arg)}>
                        "{result.arg}"
                      </span>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          marginLeft: '8px',
                        }}
                      >
                        executed
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      color: '#64748b',
                    }}
                  >
                    Result ID:{' '}
                    <code style={{ color: '#475569' }}>
                      {result.randomValue}
                    </code>
                    <span style={{ color: '#94a3b8', marginLeft: '8px' }}>
                      (unique each time)
                    </span>
                  </div>
                </div>
              ))}

              <div
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#f1f5f9',
                  borderRadius: '6px',
                  textAlign: 'center',
                }}
              >
                <div
                  style={{ fontSize: '12px', color: '#64748b' }}
                  data-testid="non-cache-fn-count"
                >
                  Function executed{' '}
                  <strong style={{ color: '#475569', fontSize: '16px' }}>
                    {nonCacheFnCount}
                  </strong>{' '}
                  times
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  (every call runs the function)
                </div>
              </div>
            </div>
          </div>

          {/* Raw counts for testing */}
          <div
            data-testid="test-react-cache-result"
            style={{
              padding: '12px',
              backgroundColor: '#f1f5f9',
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '12px',
              color: '#64748b',
              textAlign: 'center',
            }}
          >
            (cacheFnCount = {cacheFnCount}, nonCacheFnCount = {nonCacheFnCount})
          </div>

          <div style={{ marginTop: '16px', textAlign: 'center' }}>
            <a
              href="/rsc-react-cache"
              style={{
                display: 'inline-block',
                padding: '8px 16px',
                backgroundColor: '#e2e8f0',
                color: '#334155',
                borderRadius: '6px',
                textDecoration: 'none',
                fontSize: '13px',
              }}
              data-testid="reset-link"
            >
              Reset & Run Again
            </a>
          </div>
        </>
      )}
    </div>
  )
}

// Server component that demonstrates React.cache
const getReactCacheServerComponent = createServerFn({ method: 'GET' })
  .validator((data: { testCache: boolean }) => data)
  .handler(async ({ data }) => {
    const serverTimestamp = Date.now()

    return renderServerComponent(
      <ReactCacheContent
        testCache={data.testCache}
        serverTimestamp={serverTimestamp}
      />,
    )
  })

export const Route = createFileRoute('/rsc-react-cache')({
  loaderDeps: ({ search }) => ({
    testCache: 'test-cache' in (search as Record<string, unknown>),
  }),
  loader: async ({ deps }) => {
    const Server = await getReactCacheServerComponent({
      data: { testCache: deps.testCache },
    })
    return {
      Server,
      loaderTimestamp: Date.now(),
    }
  },
  component: RscReactCacheComponent,
})

function RscReactCacheComponent() {
  const { Server, loaderTimestamp } = Route.useLoaderData()

  return (
    <div style={pageStyles.container}>
      <h1 data-testid="rsc-react-cache-title" style={pageStyles.title}>
        React.cache Demo
      </h1>
      <p style={pageStyles.description}>
        <code>React.cache</code> memoizes function results within a single
        server render. When you call a cached function multiple times with the
        same arguments, React returns the cached result instead of running the
        function again.
      </p>

      <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
        <span data-testid="loader-timestamp" style={{ display: 'none' }}>
          {loaderTimestamp}
        </span>
        Route loaded at: {formatTime(loaderTimestamp)}
      </div>

      {Server}

      <div
        style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: '#f8fafc',
          borderRadius: '8px',
          fontSize: '13px',
          color: '#64748b',
        }}
      >
        <strong>When to use React.cache:</strong>
        <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
          <li>
            Fetching the same data in multiple components without prop drilling
          </li>
          <li>Expensive computations that may be called with same arguments</li>
          <li>Database queries that might be duplicated across components</li>
          <li>
            Note: Cache is request-scoped - each request gets a fresh cache
          </li>
        </ul>
      </div>
    </div>
  )
}
