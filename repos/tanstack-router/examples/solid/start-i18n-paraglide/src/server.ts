import { paraglideMiddleware } from './paraglide/server.js'
import handler from '@tanstack/solid-start/server-entry'

export default {
  fetch(req: Request): Promise<Response> {
    return paraglideMiddleware(req, () => handler.fetch(req))
  },
}
