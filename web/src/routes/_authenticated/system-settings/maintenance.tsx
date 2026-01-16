import { createFileRoute } from '@tanstack/react-router'
import { MaintenanceSettings } from '@/features/system-settings/maintenance'
import {
  MAINTENANCE_DEFAULT_SECTION,
  MAINTENANCE_SECTION_IDS,
} from '@/features/system-settings/maintenance/section-registry.tsx'
import { createSettingsRouteConfig } from '@/features/system-settings/utils/route-config'

export const Route = createFileRoute(
  '/_authenticated/system-settings/maintenance'
)(
  createSettingsRouteConfig({
    sectionIds: MAINTENANCE_SECTION_IDS,
    defaultSection: MAINTENANCE_DEFAULT_SECTION,
    component: MaintenanceSettings,
    routePath: '/system-settings/maintenance',
  })
)
