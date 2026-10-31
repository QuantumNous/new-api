import { createServerFn } from '@tanstack/react-start'
import { renderToReadableStream } from '@tanstack/react-start/rsc'

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Helper to convert stream to string
async function streamToString(
  stream: ReadableStream<Uint8Array>,
): Promise<string> {
  const reader = stream.getReader()
  const chunks: Array<string> = []
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(decoder.decode(value, { stream: true }))
  }

  return chunks.join('')
}

// Server component for each ticker item
function TickerItemCard({
  id,
  timestamp,
  variant,
}: {
  id: number
  timestamp: string
  variant: 'info' | 'success' | 'warning'
}) {
  const tickerColors = {
    info: 'from-blue-500 to-cyan-500',
    success: 'from-green-500 to-emerald-500',
    warning: 'from-amber-500 to-orange-500',
  }

  const formattedTime = new Date(timestamp).toLocaleTimeString()

  return (
    <div
      className={`p-3 bg-linear-to-r ${tickerColors[variant]} rounded-lg text-white shadow-md`}
    >
      <div className="flex justify-between items-start">
        <div className="font-bold">Server Update #{id + 1}</div>
        <div
          className={`text-xs px-2 py-0.5 rounded-full bg-white/20 ${
            variant === 'info'
              ? 'text-blue-100'
              : variant === 'success'
                ? 'text-green-100'
                : 'text-amber-100'
          }`}
        >
          {variant}
        </div>
      </div>
      <div className="text-xs opacity-80 mt-1 font-mono">
        Generated: {formattedTime}
      </div>
    </div>
  )
}

// Server function that streams RSC Flight payloads
export const streamTickerRscs = createServerFn().handler(async function* () {
  const variants = ['info', 'success', 'warning'] as const

  for (let i = 0; i < 15; i++) {
    await sleep(800)

    console.log(`[Server] Rendering ticker item #${i + 1}`)

    // Render the server component to a Flight stream
    const stream = await renderToReadableStream(
      <TickerItemCard
        id={i}
        timestamp={new Date().toISOString()}
        variant={variants[i % 3]}
      />,
    )

    // Convert stream to string for yielding
    const payload = await streamToString(stream)

    yield { id: i, payload }
  }
})
