import handler from '@tanstack/vue-start/server-entry'

export default {
  fetch(request: Request) {
    return handler.fetch(request)
  },
}
