import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Dashboard } from '@/features/dashboard'
import {
  DASHBOARD_SECTION_IDS,
  DASHBOARD_DEFAULT_SECTION,
} from '@/features/dashboard/section-registry'

export const dashboardSearchSchema = z.object({
  section: z
    .enum(DASHBOARD_SECTION_IDS as unknown as [string, ...string[]])
    .optional()
    .catch(DASHBOARD_DEFAULT_SECTION),
})

export const Route = createFileRoute('/_authenticated/dashboard/')({
  beforeLoad: ({ search }) => {
    // Redirect to default section if no section is provided
    if (!search?.section) {
      throw redirect({
        to: '/dashboard',
        search: { section: DASHBOARD_DEFAULT_SECTION },
      })
    }
  },
  validateSearch: dashboardSearchSchema,
  component: Dashboard,
})
