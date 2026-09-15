import { createFileRoute } from '@tanstack/solid-router'

export const Route = createFileRoute('/search-params')({
  beforeLoad: async () => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    return { hello: 'world' as string }
  },
})
