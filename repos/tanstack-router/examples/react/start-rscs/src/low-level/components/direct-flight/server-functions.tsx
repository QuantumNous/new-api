import { createServerFn } from '@tanstack/react-start'
import { renderToReadableStream } from '@tanstack/react-start/rsc'

// Server Component that will be rendered to a Flight stream
function ServerGreeting({
  name,
  timestamp,
}: {
  name: string
  timestamp: string
}) {
  console.log('[Server] Rendering ServerGreeting:', name)
  return (
    <div className="p-4 bg-linear-to-r from-purple-500 to-indigo-600 rounded-lg text-white">
      <h2 className="text-xl font-bold">Hello, {name}!</h2>
      <p className="text-purple-100 text-sm mt-1">
        Rendered on the server at: {timestamp}
      </p>
    </div>
  )
}

// Server function using low-level renderToReadableStream
export const getFlightStreamDirect = createServerFn({ method: 'GET' }).handler(
  async () => {
    const stream = await renderToReadableStream(
      <ServerGreeting
        name="Flight Stream User"
        timestamp={new Date().toISOString()}
      />,
    )
    return stream
  },
)
