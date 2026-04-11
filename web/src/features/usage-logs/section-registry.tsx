import { createSectionRegistry } from '@/features/system-settings/utils/section-registry'

/**
 * Usage logs page section definitions
 */
const USAGE_LOGS_SECTIONS = [
  {
    id: 'common',
    titleKey: 'Common Logs',
    descriptionKey: 'View and manage your API usage logs',
    build: () => null, // Content is rendered directly in the page component
  },
  {
    id: 'drawing',
    titleKey: 'Drawing Logs',
    descriptionKey: 'View and manage your drawing logs',
    build: () => null, // Content is rendered directly in the page component
  },
  {
    id: 'task',
    titleKey: 'Task Logs',
    descriptionKey: 'View and manage your task logs',
    build: () => null, // Content is rendered directly in the page component
  },
] as const

export type UsageLogsSectionId = (typeof USAGE_LOGS_SECTIONS)[number]['id']

const usageLogsRegistry = createSectionRegistry<
  UsageLogsSectionId,
  Record<string, never>,
  []
>({
  sections: USAGE_LOGS_SECTIONS,
  defaultSection: 'common',
  basePath: '/usage-logs',
  urlStyle: 'path',
})

export const USAGE_LOGS_SECTION_IDS = usageLogsRegistry.sectionIds
export const USAGE_LOGS_DEFAULT_SECTION = usageLogsRegistry.defaultSection

/** Type guard for validating section IDs without casting. Use with z.string().refine() or params checks. */
export function isUsageLogsSectionId(s: string): s is UsageLogsSectionId {
  return (USAGE_LOGS_SECTION_IDS as readonly string[]).includes(s)
}
export const getUsageLogsSectionNavItems = usageLogsRegistry.getSectionNavItems
