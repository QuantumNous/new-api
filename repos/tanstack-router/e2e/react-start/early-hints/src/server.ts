import handler from '@tanstack/react-start/server-entry'
import type { ServerRequest } from 'srvx'

export default {
  fetch(request: Request) {
    // Cast to ServerRequest to access Node.js runtime
    const serverRequest = request as ServerRequest

    return handler.fetch(request, {
      responseLinkHeader: true,
      onEarlyHints: ({ allLinks, phase }) => {
        if (phase !== 'dynamic') return

        // Access native Node.js response via srvx's runtime context
        const nodeRes = serverRequest.runtime?.node?.res

        if (nodeRes?.writeEarlyHints && allLinks.length) {
          nodeRes.writeEarlyHints({ link: allLinks })
        }
      },
    })
  },
}
