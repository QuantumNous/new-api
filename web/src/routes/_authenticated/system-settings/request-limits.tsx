import { createFileRoute } from '@tanstack/react-router'
import { RequestLimitsSettings } from '@/features/system-settings/request-limits'

export const Route = createFileRoute(
  '/_authenticated/system-settings/request-limits'
)({
  component: RequestLimitsSettings,
})
