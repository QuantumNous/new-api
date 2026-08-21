import { createFileRoute } from '@tanstack/solid-router'

import { z } from 'zod'

const search = z.object({
  rootSearch: z.number(),
})

export const Route = createFileRoute('/search')({
  component: () => <div>Hello /search!</div>,
  validateSearch: search,
})
