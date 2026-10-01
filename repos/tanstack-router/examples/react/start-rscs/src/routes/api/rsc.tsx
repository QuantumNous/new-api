import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderToReadableStream } from '@tanstack/react-start/rsc'

// Server component to render
function ApiServerComponent() {
  const timestamp = new Date().toISOString()

  return (
    <div className="p-4 bg-linear-to-r from-emerald-500 to-teal-600 rounded-lg text-white">
      <h2 className="text-xl font-bold">API Route RSC</h2>
      <p className="text-emerald-100 text-sm mt-1">
        This component was streamed from /api/rsc
      </p>
      <p className="text-emerald-200 text-xs mt-2 font-mono">
        Timestamp: {timestamp}
      </p>
    </div>
  )
}

// Server function to render the RSC
const getFlightStream = createServerFn({ method: 'GET' }).handler(async () => {
  console.log('[API] Rendering Flight stream for /api/rsc')
  return renderToReadableStream(<ApiServerComponent />)
})

export const Route = createFileRoute('/api/rsc')({
  server: {
    handlers: {
      GET: async () => {
        const stream = await getFlightStream()

        return new Response(stream, {
          headers: {
            'Content-Type': 'text/x-component',
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
