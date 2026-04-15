import { createFileRoute, redirect } from '@tanstack/react-router'
import { DASHBOARD_DEFAULT_SECTION } from '@/features/dashboard/section-registry'

export const Route = createFileRoute('/_authenticated/dashboard/')({
  beforeLoad: () => {
    throw redirect({
      to: '/dashboard/$section',
      params: { section: DASHBOARD_DEFAULT_SECTION },
    })
  },
})
