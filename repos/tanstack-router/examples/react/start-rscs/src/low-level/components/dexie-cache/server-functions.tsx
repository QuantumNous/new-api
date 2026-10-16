import { createServerFn } from '@tanstack/react-start'
import { renderToReadableStream } from '@tanstack/react-start/rsc'

// Colors for the counter-based RSC
const counterColors = [
  { bg: 'from-red-500 to-orange-500', text: 'text-red-100', name: 'Warm' },
  { bg: 'from-blue-500 to-cyan-500', text: 'text-blue-100', name: 'Cool' },
  {
    bg: 'from-green-500 to-emerald-500',
    text: 'text-green-100',
    name: 'Nature',
  },
  { bg: 'from-purple-500 to-pink-500', text: 'text-purple-100', name: 'Royal' },
  {
    bg: 'from-amber-500 to-yellow-500',
    text: 'text-amber-100',
    name: 'Golden',
  },
]

// Server component for counter-based RSC
function CounterCard({ count }: { count: number }) {
  const colorIndex = count % counterColors.length
  const color = counterColors[colorIndex]
  const timestamp = new Date().toISOString()
  const randomValue = Math.floor(Math.random() * 10000)

  console.log(`[Server] Rendering CounterCard for count: ${count}`)

  return (
    <div
      className={`p-6 bg-linear-to-r ${color.bg} rounded-lg text-white shadow-lg`}
    >
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-2xl font-bold">Counter #{count}</h2>
          <p className={`${color.text} text-sm mt-1`}>Theme: {color.name}</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-mono font-bold">{randomValue}</div>
          <div className={`${color.text} text-xs`}>Random Value</div>
        </div>
      </div>
      <div className={`${color.text} text-xs mt-4 font-mono`}>
        Generated: {timestamp}
      </div>
    </div>
  )
}

// Server function that returns Flight payload as a string for caching
export const getCounterRscPayload = createServerFn()
  .validator((data: { count: number }) => data)
  .handler(async ({ data }) => {
    console.log(`[Server] Creating Flight payload for count: ${data.count}`)

    const stream = await renderToReadableStream(
      <CounterCard count={data.count} />,
    )

    // Convert stream to string for caching
    const reader = stream.getReader()
    const chunks: Array<string> = []
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(decoder.decode(value, { stream: true }))
    }

    const payload = chunks.join('')
    console.log(`[Server] Flight payload size: ${payload.length} bytes`)

    return { payload, count: data.count }
  })
