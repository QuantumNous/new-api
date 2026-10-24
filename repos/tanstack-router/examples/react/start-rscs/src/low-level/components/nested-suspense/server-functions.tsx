import { Suspense } from 'react'
import { createServerFn } from '@tanstack/react-start'
import { renderToReadableStream } from '@tanstack/react-start/rsc'

// Server Component with async data
async function ServerDataCard({ delay }: { delay: number }) {
  console.log('[Server] Starting ServerDataCard with delay:', delay)
  await new Promise((resolve) => setTimeout(resolve, delay))
  const data = {
    value: Math.floor(Math.random() * 1000),
    computedAt: new Date().toISOString(),
  }
  console.log('[Server] Finished ServerDataCard:', data)

  return (
    <div className="p-4 bg-white rounded-lg shadow-md border border-gray-200">
      <div className="text-2xl font-bold text-gray-900">{data.value}</div>
      <div className="text-xs text-gray-500 mt-1">
        Computed at: {data.computedAt}
      </div>
      <div className="text-xs text-indigo-600 mt-1">Delay: {delay}ms</div>
    </div>
  )
}

function LoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="p-4 bg-gray-100 rounded-lg animate-pulse">
      <div className="h-6 bg-gray-300 rounded w-20 mb-2" />
      <div className="h-3 bg-gray-200 rounded w-32" />
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  )
}

// Server function returning a nested server component structure
export const getNestedServerComponent = createServerFn({
  method: 'GET',
}).handler(async () => {
  const stream = await renderToReadableStream(
    <div className="space-y-4">
      <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
        <h3 className="font-bold text-amber-900">Nested Server Component</h3>
        <p className="text-amber-700 text-sm mt-1">
          This entire tree is rendered on the server
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Suspense fallback={<LoadingSkeleton label="Card 1" />}>
          <ServerDataCard delay={300} />
        </Suspense>
        <Suspense fallback={<LoadingSkeleton label="Card 2" />}>
          <ServerDataCard delay={600} />
        </Suspense>
      </div>
    </div>,
  )
  return stream
})
