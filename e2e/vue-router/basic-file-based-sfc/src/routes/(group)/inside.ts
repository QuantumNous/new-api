import { createFileRoute } from '@tanstack/vue-router'
import { z } from 'zod'

export const Route = createFileRoute('/(group)/inside')({
  validateSearch: z.object({ hello: z.string().optional() }),
})
