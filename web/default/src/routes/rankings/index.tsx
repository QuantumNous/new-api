import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Rankings } from '@/features/rankings'

const rankingsSearchSchema = z.object({
  period: z
    .enum(['today', 'week', 'month', 'year', 'all'])
    .optional()
    .catch(undefined),
})

export const Route = createFileRoute('/rankings/')({
  validateSearch: rankingsSearchSchema,
  component: Rankings,
})
