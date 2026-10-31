import { createFileRoute } from '@tanstack/vue-router'
import { z } from 'zod'

export const Route = createFileRoute('/(group)/lazyinside')({
  validateSearch: z.object({ hello: z.string().optional() }),
})
