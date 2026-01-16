import { createFileRoute } from '@tanstack/react-router'
import { GeneralSettings } from '@/features/system-settings/general'
import {
  GENERAL_DEFAULT_SECTION,
  GENERAL_SECTION_IDS,
} from '@/features/system-settings/general/section-registry.tsx'
import { createSettingsRouteConfig } from '@/features/system-settings/utils/route-config'

export const Route = createFileRoute('/_authenticated/system-settings/general')(
  createSettingsRouteConfig({
    sectionIds: GENERAL_SECTION_IDS,
    defaultSection: GENERAL_DEFAULT_SECTION,
    component: GeneralSettings,
    routePath: '/system-settings/general',
    redirectToDefault: true,
  })
)
