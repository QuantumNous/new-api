import { Await, createFileRoute } from '@tanstack/react-router'
import { Suspense } from 'react'

/**
 * Tests concurrent promise resolution - multiple promises resolving at the exact same time.
 * This can stress the serialization system and reveal race conditions.
 */

// Shared delay function that resolves multiple promises at the same instant
function createConcurrentPromises(
  count: number,
  delayMs: number,
): Array<Promise<string>> {
  const sharedPromise = new Promise<void>((resolve) =>
    setTimeout(resolve, delayMs),
  )
  return Array.from({ length: count }, (_, i) =>
    sharedPromise.then(() => `concurrent-${i + 1}`),
  )
}

export const Route = createFileRoute('/concurrent')({
  loader: async () => {
    // Create fresh batches of concurrent promises for each request
    const batch1 = createConcurrentPromises(5, 100) // 5 promises resolving at 100ms
    const batch2 = createConcurrentPromises(5, 200) // 5 promises resolving at 200ms
    const batch3 = createConcurrentPromises(5, 300) // 5 promises resolving at 300ms

    return {
      // Batch 1: 5 promises resolving at exactly the same time (100ms)
      concurrent1_1: batch1[0],
      concurrent1_2: batch1[1],
      concurrent1_3: batch1[2],
      concurrent1_4: batch1[3],
      concurrent1_5: batch1[4],

      // Batch 2: 5 promises resolving at exactly the same time (200ms)
      concurrent2_1: batch2[0],
      concurrent2_2: batch2[1],
      concurrent2_3: batch2[2],
      concurrent2_4: batch2[3],
      concurrent2_5: batch2[4],

      // Batch 3: 5 promises resolving at exactly the same time (300ms)
      concurrent3_1: batch3[0],
      concurrent3_2: batch3[1],
      concurrent3_3: batch3[2],
      concurrent3_4: batch3[3],
      concurrent3_5: batch3[4],
    }
  },
  component: Concurrent,
})

function PromiseItem({
  promise,
  testId,
}: {
  promise: Promise<string>
  testId: string
}) {
  return (
    <Suspense
      fallback={<div data-testid={`${testId}-loading`}>Loading...</div>}
    >
      <Await
        promise={promise}
        children={(data) => <div data-testid={testId}>{data}</div>}
      />
    </Suspense>
  )
}

function Concurrent() {
  const data = Route.useLoaderData()

  return (
    <div style={{ padding: '20px' }}>
      <h2>Concurrent Resolution Test (15 promises in 3 batches)</h2>
      <p>Tests multiple promises resolving at the exact same instant.</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '20px',
        }}
      >
        {/* Batch 1: 100ms */}
        <div>
          <h3>Batch 1 (100ms)</h3>
          <PromiseItem promise={data.concurrent1_1} testId="concurrent-1-1" />
          <PromiseItem promise={data.concurrent1_2} testId="concurrent-1-2" />
          <PromiseItem promise={data.concurrent1_3} testId="concurrent-1-3" />
          <PromiseItem promise={data.concurrent1_4} testId="concurrent-1-4" />
          <PromiseItem promise={data.concurrent1_5} testId="concurrent-1-5" />
        </div>

        {/* Batch 2: 200ms */}
        <div>
          <h3>Batch 2 (200ms)</h3>
          <PromiseItem promise={data.concurrent2_1} testId="concurrent-2-1" />
          <PromiseItem promise={data.concurrent2_2} testId="concurrent-2-2" />
          <PromiseItem promise={data.concurrent2_3} testId="concurrent-2-3" />
          <PromiseItem promise={data.concurrent2_4} testId="concurrent-2-4" />
          <PromiseItem promise={data.concurrent2_5} testId="concurrent-2-5" />
        </div>

        {/* Batch 3: 300ms */}
        <div>
          <h3>Batch 3 (300ms)</h3>
          <PromiseItem promise={data.concurrent3_1} testId="concurrent-3-1" />
          <PromiseItem promise={data.concurrent3_2} testId="concurrent-3-2" />
          <PromiseItem promise={data.concurrent3_3} testId="concurrent-3-3" />
          <PromiseItem promise={data.concurrent3_4} testId="concurrent-3-4" />
          <PromiseItem promise={data.concurrent3_5} testId="concurrent-3-5" />
        </div>
      </div>
    </div>
  )
}
