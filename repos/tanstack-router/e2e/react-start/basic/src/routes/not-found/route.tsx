import { createFileRoute } from '@tanstack/react-router'
import z from 'zod'

export const Route = createFileRoute('/not-found')({
  validateSearch: z.object({
    preload: z.literal(false).optional(),
  }),
})
