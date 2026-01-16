import { createFileRoute } from '@tanstack/react-router'
import { IntegrationSettings } from '@/features/system-settings/integrations'
import {
  INTEGRATIONS_DEFAULT_SECTION,
  INTEGRATIONS_SECTION_IDS,
} from '@/features/system-settings/integrations/section-registry.tsx'
import { createSettingsRouteConfig } from '@/features/system-settings/utils/route-config'

export const Route = createFileRoute(
  '/_authenticated/system-settings/integrations'
)(
  createSettingsRouteConfig({
    sectionIds: INTEGRATIONS_SECTION_IDS,
    defaultSection: INTEGRATIONS_DEFAULT_SECTION,
    component: IntegrationSettings,
    routePath: '/system-settings/integrations',
  })
)
