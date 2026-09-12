// DO NOT DELETE THIS FILE!!!
// This file is a good smoke test to make sure the custom server entry is working
import handler from '@tanstack/react-start/server-entry'

console.log("[server-entry]: using custom server entry in 'src/server.ts'")

export default {
  fetch(request: Request) {
    return handler.fetch(request)
  },
}
