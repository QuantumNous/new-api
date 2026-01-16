import { createFileRoute } from '@tanstack/react-router'
import { ModelSettings } from '@/features/system-settings/models'
import {
  MODELS_DEFAULT_SECTION,
  MODELS_SECTION_IDS,
} from '@/features/system-settings/models/section-registry.tsx'
import { createSettingsRouteConfig } from '@/features/system-settings/utils/route-config'

export const Route = createFileRoute('/_authenticated/system-settings/models')(
  createSettingsRouteConfig({
    sectionIds: MODELS_SECTION_IDS,
    defaultSection: MODELS_DEFAULT_SECTION,
    component: ModelSettings,
    routePath: '/system-settings/models',
  })
)
