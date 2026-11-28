import { createFileRoute } from '@tanstack/react-router'

// This just exists to validate types are working
export const Route = createFileRoute('/anotherRoute')({
  validateSearch: () => ({}) as { foo: string; bar: number },
})
