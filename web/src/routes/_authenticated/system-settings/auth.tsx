import { createFileRoute } from '@tanstack/react-router'
import { AuthSettings } from '@/features/system-settings/auth'
import {
  AUTH_DEFAULT_SECTION,
  AUTH_SECTION_IDS,
} from '@/features/system-settings/auth/section-registry.tsx'
import { createSettingsRouteConfig } from '@/features/system-settings/utils/route-config'

export const Route = createFileRoute('/_authenticated/system-settings/auth')(
  createSettingsRouteConfig({
    sectionIds: AUTH_SECTION_IDS,
    defaultSection: AUTH_DEFAULT_SECTION,
    component: AuthSettings,
    routePath: '/system-settings/auth',
  })
)
