import { createFileRoute } from '@tanstack/react-router'
import { ContentSettings } from '@/features/system-settings/content'
import {
  CONTENT_DEFAULT_SECTION,
  CONTENT_SECTION_IDS,
} from '@/features/system-settings/content/section-registry.tsx'
import { createSettingsRouteConfig } from '@/features/system-settings/utils/route-config'

export const Route = createFileRoute('/_authenticated/system-settings/content')(
  createSettingsRouteConfig({
    sectionIds: CONTENT_SECTION_IDS,
    defaultSection: CONTENT_DEFAULT_SECTION,
    component: ContentSettings,
    routePath: '/system-settings/content',
  })
)
