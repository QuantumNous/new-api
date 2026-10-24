import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/search-params')({
  beforeLoad: async () => {
    await new Promise((resolve) => setTimeout(resolve, 100))
    return { hello: 'world' as string }
  },
})
