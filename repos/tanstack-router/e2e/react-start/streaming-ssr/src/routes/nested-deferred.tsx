import { Await, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Suspense } from 'react'

// Multiple server functions with different delays
const getLevel1Data = createServerFn({ method: 'GET' }).handler(async () => {
  await new Promise((r) => setTimeout(r, 200))
  return { level: 1, timestamp: Date.now() }
})

const getLevel2Data = createServerFn({ method: 'GET' }).handler(async () => {
  await new Promise((r) => setTimeout(r, 400))
  return { level: 2, timestamp: Date.now() }
})

const getLevel3Data = createServerFn({ method: 'GET' }).handler(async () => {
  await new Promise((r) => setTimeout(r, 600))
  return { level: 3, timestamp: Date.now() }
})

export const Route = createFileRoute('/nested-deferred')({
  loader: async () => {
    return {
      // Multiple deferred promises that resolve at different times
      level1: getLevel1Data(),
      level2: getLevel2Data(),
      level3: getLevel3Data(),
      // Also a plain deferred promise
      plainDeferred: new Promise<string>((r) =>
        setTimeout(() => r('Plain deferred resolved!'), 300),
      ),
    }
  },
  component: NestedDeferred,
})

// Nested component that renders more Await components
function Level1Content({
  level2,
  level3,
}: {
  level2: Promise<{ level: number; timestamp: number }>
  level3: Promise<{ level: number; timestamp: number }>
}) {
  return (
    <div
      style={{
        marginLeft: '20px',
        borderLeft: '2px solid #ccc',
        paddingLeft: '10px',
      }}
    >
      <Suspense
        fallback={<div data-testid="level2-loading">Loading level 2...</div>}
      >
        <Await
          promise={level2}
          children={(data) => (
            <div data-testid="level2-data">
              Level 2: {data.level} @ {data.timestamp}
              <Level2Content level3={level3} />
            </div>
          )}
        />
      </Suspense>
    </div>
  )
}

function Level2Content({
  level3,
}: {
  level3: Promise<{ level: number; timestamp: number }>
}) {
  return (
    <div
      style={{
        marginLeft: '20px',
        borderLeft: '2px solid #999',
        paddingLeft: '10px',
      }}
    >
      <Suspense
        fallback={<div data-testid="level3-loading">Loading level 3...</div>}
      >
        <Await
          promise={level3}
          children={(data) => (
            <div data-testid="level3-data">
              Level 3: {data.level} @ {data.timestamp}
            </div>
          )}
        />
      </Suspense>
    </div>
  )
}

function NestedDeferred() {
  const { level1, level2, level3, plainDeferred } = Route.useLoaderData()

  return (
    <div style={{ padding: '20px' }}>
      <h2>Nested Deferred Test</h2>
      <p>
        Tests multiple nested deferred promises resolving at different times.
      </p>

      {/* Plain deferred */}
      <Suspense
        fallback={<div data-testid="plain-loading">Loading plain...</div>}
      >
        <Await
          promise={plainDeferred}
          children={(data) => <div data-testid="plain-deferred">{data}</div>}
        />
      </Suspense>

      {/* Nested structure */}
      <div style={{ marginTop: '20px' }}>
        <Suspense
          fallback={<div data-testid="level1-loading">Loading level 1...</div>}
        >
          <Await
            promise={level1}
            children={(data) => (
              <div data-testid="level1-data">
                Level 1: {data.level} @ {data.timestamp}
                <Level1Content level2={level2} level3={level3} />
              </div>
            )}
          />
        </Suspense>
      </div>
    </div>
  )
}
