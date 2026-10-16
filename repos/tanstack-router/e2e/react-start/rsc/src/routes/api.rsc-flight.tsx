import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { renderToReadableStream } from '@tanstack/react-start/rsc'
import { serverStyles, formatTime } from '~/utils/styles'

// Server function that returns a raw ReadableStream (not wrapped in Response)
// This runs in RSC context where renderToReadableStream is available
const getFlightStream = createServerFn({ method: 'GET' }).handler(async () => {
  return renderToReadableStream(
    <div style={serverStyles.container} data-testid="api-flight-content">
      <div style={serverStyles.header}>
        <span style={serverStyles.badge}>API ROUTE RSC</span>
        <span style={serverStyles.timestamp}>{formatTime(Date.now())}</span>
      </div>
      <p style={serverStyles.text}>
        This content was rendered via API route Flight stream
      </p>
    </div>,
  )
})

// API route handler wraps the ReadableStream in a Response
export const Route = createFileRoute('/api/rsc-flight')({
  server: {
    handlers: {
      GET: async () => {
        const stream = await getFlightStream()

        return new Response(stream, {
          headers: { 'Content-Type': 'text/x-component' },
        })
      },
    },
  },
})
