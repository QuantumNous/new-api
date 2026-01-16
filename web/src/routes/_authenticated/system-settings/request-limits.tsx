import { createFileRoute } from '@tanstack/react-router'
import { RequestLimitsSettings } from '@/features/system-settings/request-limits'
import {
  REQUEST_LIMITS_DEFAULT_SECTION,
  REQUEST_LIMITS_SECTION_IDS,
} from '@/features/system-settings/request-limits/section-registry.tsx'
import { createSettingsRouteConfig } from '@/features/system-settings/utils/route-config'

export const Route = createFileRoute(
  '/_authenticated/system-settings/request-limits'
)(
  createSettingsRouteConfig({
    sectionIds: REQUEST_LIMITS_SECTION_IDS,
    defaultSection: REQUEST_LIMITS_DEFAULT_SECTION,
    component: RequestLimitsSettings,
    routePath: '/system-settings/request-limits',
  })
)
