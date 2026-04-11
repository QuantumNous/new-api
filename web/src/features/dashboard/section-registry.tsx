import { createSectionRegistry } from '@/features/system-settings/utils/section-registry'

/**
 * Dashboard page section definitions
 */
const DASHBOARD_SECTIONS = [
  {
    id: 'overview',
    titleKey: 'Overview',
    descriptionKey: 'View dashboard overview and statistics',
    build: () => null, // Content is rendered directly in the page component
  },
  {
    id: 'models',
    titleKey: 'Models',
    descriptionKey: 'View model statistics and charts',
    build: () => null, // Content is rendered directly in the page component
  },
] as const

export type DashboardSectionId = (typeof DASHBOARD_SECTIONS)[number]['id']

const dashboardRegistry = createSectionRegistry<
  DashboardSectionId,
  Record<string, never>,
  []
>({
  sections: DASHBOARD_SECTIONS,
  defaultSection: 'overview',
  basePath: '/dashboard',
  urlStyle: 'path',
})

export const DASHBOARD_SECTION_IDS = dashboardRegistry.sectionIds
export const DASHBOARD_DEFAULT_SECTION = dashboardRegistry.defaultSection
export const getDashboardSectionNavItems = dashboardRegistry.getSectionNavItems
