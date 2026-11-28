import { createFileRoute } from '@tanstack/solid-router'
import { formEcho, rawResp, streamOut } from '../fns'

export const Route = createFileRoute('/api/fn-urls')({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          form: formEcho.url,
          raw: rawResp.url,
          stream: streamOut.url,
        }),
    },
  },
})
