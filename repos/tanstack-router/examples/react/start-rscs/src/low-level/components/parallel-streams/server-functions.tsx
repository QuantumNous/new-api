import { createServerFn } from '@tanstack/react-start'
import { renderToReadableStream } from '@tanstack/react-start/rsc'

// Server Component with async data (used for parallel and nested demos)
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

// Server function that returns multiple streams for parallel loading
export const getParallelStreams = createServerFn({ method: 'GET' }).handler(
  async () => {
    // Create three independent streams with different delays
    const [stream1, stream2, stream3] = await Promise.all([
      renderToReadableStream(<ServerDataCard delay={500} />),
      renderToReadableStream(<ServerDataCard delay={1000} />),
      renderToReadableStream(<ServerDataCard delay={1500} />),
    ])

    return { stream1, stream2, stream3 }
  },
)
