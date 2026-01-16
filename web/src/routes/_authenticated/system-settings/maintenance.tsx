import { createFileRoute } from '@tanstack/react-router'
import { MaintenanceSettings } from '@/features/system-settings/maintenance'
import {
  MAINTENANCE_DEFAULT_SECTION,
  MAINTENANCE_SECTION_IDS,
} from '@/features/system-settings/maintenance/section-registry.tsx'
import { createSectionSearchSchema } from '@/features/system-settings/utils/route-config'

const maintenanceSearchSchema = createSectionSearchSchema(
  MAINTENANCE_SECTION_IDS,
  MAINTENANCE_DEFAULT_SECTION
)

export const Route = createFileRoute(
  '/_authenticated/system-settings/maintenance'
)({
  validateSearch: maintenanceSearchSchema,
  component: MaintenanceSettings,
})
