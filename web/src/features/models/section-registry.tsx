import { createSectionRegistry } from '@/features/system-settings/utils/section-registry'

/**
 * Models page section definitions
 */
const MODELS_SECTIONS = [
  {
    id: 'metadata',
    titleKey: 'Metadata',
    descriptionKey: 'Manage model metadata and configuration',
    build: () => null, // Content is rendered directly in the page component
  },
  {
    id: 'deployments',
    titleKey: 'Deployments',
    descriptionKey: 'Manage model deployments',
    build: () => null, // Content is rendered directly in the page component
  },
] as const

export type ModelsSectionId = (typeof MODELS_SECTIONS)[number]['id']

const modelsRegistry = createSectionRegistry<
  ModelsSectionId,
  Record<string, never>,
  []
>({
  sections: MODELS_SECTIONS,
  defaultSection: 'metadata',
  basePath: '/models',
  urlStyle: 'path',
})

export const MODELS_SECTION_IDS = modelsRegistry.sectionIds
export const MODELS_DEFAULT_SECTION = modelsRegistry.defaultSection
export const getModelsSectionNavItems = modelsRegistry.getSectionNavItems
