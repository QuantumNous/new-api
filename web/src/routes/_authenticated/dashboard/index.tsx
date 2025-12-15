import z from 'zod'
import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '@/features/dashboard'

export const dashboardSearchSchema = z.object({
  tab: z.enum(['overview', 'models']).optional(),
})

export const Route = createFileRoute('/_authenticated/dashboard/')({
  validateSearch: dashboardSearchSchema,
  component: Dashboard,
})
