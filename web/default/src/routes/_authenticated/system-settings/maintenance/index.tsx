import { createFileRoute, redirect } from '@tanstack/react-router'
import { MAINTENANCE_DEFAULT_SECTION } from '@/features/system-settings/maintenance/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/maintenance/'
)({
  beforeLoad: () => {
    throw redirect({
      to: '/system-settings/maintenance/$section',
      params: { section: MAINTENANCE_DEFAULT_SECTION },
    })
  },
})
