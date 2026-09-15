import { Await, createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

/**
 * Tests streaming with many (15+) deferred promises resolving in various orders.
 * This stresses the serialization system with concurrent promise resolutions.
 */

// Helper to create a promise with a specific delay and value
function createDelayedPromise<T>(value: T, delayMs: number): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), delayMs))
}

export const Route = createFileRoute('/many-promises')({
  loader: async () => {
    // Create 15 promises with varying delays to test ordering
    // Some resolve quickly, some slowly, some at similar times
    return {
      // Immediate/very fast (0-50ms)
      immediate1: createDelayedPromise('immediate-1', 0),
      immediate2: createDelayedPromise('immediate-2', 10),
      immediate3: createDelayedPromise('immediate-3', 20),

      // Fast (50-150ms)
      fast1: createDelayedPromise('fast-1', 50),
      fast2: createDelayedPromise('fast-2', 75),
      fast3: createDelayedPromise('fast-3', 100),
      fast4: createDelayedPromise('fast-4', 125),

      // Medium (150-300ms)
      medium1: createDelayedPromise('medium-1', 150),
      medium2: createDelayedPromise('medium-2', 200),
      medium3: createDelayedPromise('medium-3', 250),

      // Slow (300-600ms)
      slow1: createDelayedPromise('slow-1', 300),
      slow2: createDelayedPromise('slow-2', 400),
      slow3: createDelayedPromise('slow-3', 500),

      // Very slow (600ms+)
      verySlow1: createDelayedPromise('very-slow-1', 600),
      verySlow2: createDelayedPromise('very-slow-2', 800),
    }
  },
  component: ManyPromises,
})

function PromiseItem({
  promise,
  testId,
  label,
}: {
  promise: Promise<string>
  testId: string
  label: string
}) {
  return (
    <Suspense
      fallback={<div data-testid={`${testId}-loading`}>Loading {label}...</div>}
    >
      <Await
        promise={promise}
        children={(data) => (
          <div data-testid={testId}>
            {label}: {data}
          </div>
        )}
      />
    </Suspense>
  )
}

function ManyPromises() {
  const data = Route.useLoaderData()

  return (
    <div style={{ padding: '20px' }}>
      <h2>Many Promises Test (15 deferred)</h2>
      <p>Tests streaming with many concurrent deferred promises.</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
        }}
      >
        {/* Immediate group */}
        <div>
          <h3>Immediate (0-20ms)</h3>
          <PromiseItem
            promise={data.immediate1}
            testId="immediate-1"
            label="Immediate 1"
          />
          <PromiseItem
            promise={data.immediate2}
            testId="immediate-2"
            label="Immediate 2"
          />
          <PromiseItem
            promise={data.immediate3}
            testId="immediate-3"
            label="Immediate 3"
          />
        </div>

        {/* Fast group */}
        <div>
          <h3>Fast (50-125ms)</h3>
          <PromiseItem promise={data.fast1} testId="fast-1" label="Fast 1" />
          <PromiseItem promise={data.fast2} testId="fast-2" label="Fast 2" />
          <PromiseItem promise={data.fast3} testId="fast-3" label="Fast 3" />
          <PromiseItem promise={data.fast4} testId="fast-4" label="Fast 4" />
        </div>

        {/* Medium group */}
        <div>
          <h3>Medium (150-250ms)</h3>
          <PromiseItem
            promise={data.medium1}
            testId="medium-1"
            label="Medium 1"
          />
          <PromiseItem
            promise={data.medium2}
            testId="medium-2"
            label="Medium 2"
          />
          <PromiseItem
            promise={data.medium3}
            testId="medium-3"
            label="Medium 3"
          />
        </div>

        {/* Slow group */}
        <div>
          <h3>Slow (300-500ms)</h3>
          <PromiseItem promise={data.slow1} testId="slow-1" label="Slow 1" />
          <PromiseItem promise={data.slow2} testId="slow-2" label="Slow 2" />
          <PromiseItem promise={data.slow3} testId="slow-3" label="Slow 3" />
        </div>

        {/* Very slow group */}
        <div>
          <h3>Very Slow (600-800ms)</h3>
          <PromiseItem
            promise={data.verySlow1}
            testId="very-slow-1"
            label="Very Slow 1"
          />
          <PromiseItem
            promise={data.verySlow2}
            testId="very-slow-2"
            label="Very Slow 2"
          />
        </div>
      </div>
    </div>
  )
}
