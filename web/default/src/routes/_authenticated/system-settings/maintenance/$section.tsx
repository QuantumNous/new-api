import { createFileRoute, redirect } from '@tanstack/react-router'
import { MaintenanceSettings } from '@/features/system-settings/maintenance'
import {
  MAINTENANCE_DEFAULT_SECTION,
  MAINTENANCE_SECTION_IDS,
} from '@/features/system-settings/maintenance/section-registry.tsx'

export const Route = createFileRoute(
  '/_authenticated/system-settings/maintenance/$section'
)({
  beforeLoad: ({ params }) => {
    const validSections = MAINTENANCE_SECTION_IDS as unknown as string[]
    if (!validSections.includes(params.section)) {
      throw redirect({
        to: '/system-settings/maintenance/$section',
        params: { section: MAINTENANCE_DEFAULT_SECTION },
      })
    }
  },
  component: MaintenanceSettings,
})
