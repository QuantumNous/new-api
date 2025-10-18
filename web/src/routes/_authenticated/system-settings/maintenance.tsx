import { createFileRoute } from '@tanstack/react-router'
import { MaintenanceSettings } from '@/features/system-settings/maintenance'

export const Route = createFileRoute(
  '/_authenticated/system-settings/maintenance'
)({
  component: MaintenanceSettings,
})
