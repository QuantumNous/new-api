import type { ReactNode } from 'react'
import type { TFunction } from 'i18next'

/**
 * Section definition for settings pages
 */
export type SectionDefinition<TSettings, TExtraArgs extends unknown[] = []> = {
  id: string
  titleKey: string
  descriptionKey: string
  build: (settings: TSettings, ...extraArgs: TExtraArgs) => ReactNode
}

/**
 * Section registry configuration
 */
export type SectionRegistryConfig<
  TSectionId extends string,
  TSettings,
  TExtraArgs extends unknown[] = [],
> = {
  sections: readonly SectionDefinition<TSettings, TExtraArgs>[]
  defaultSection: TSectionId
  basePath: string
  /** 'query' = `${basePath}?section=${id}`, 'path' = `${basePath}/${id}` */
  urlStyle?: 'query' | 'path'
}

/**
 * Create a section registry with helper functions
 */
export function createSectionRegistry<
  TSectionId extends string,
  TSettings,
  TExtraArgs extends unknown[] = [],
>(config: SectionRegistryConfig<TSectionId, TSettings, TExtraArgs>) {
  const { sections, defaultSection, basePath, urlStyle = 'query' } = config

  type SectionId = TSectionId

  const sectionIds = sections.map((section) => section.id) as [
    SectionId,
    ...SectionId[],
  ]

  /**
   * Get navigation items for sidebar
   */
  function getSectionNavItems(t: TFunction) {
    return sections.map((section) => ({
      title: t(section.titleKey),
      url:
        urlStyle === 'path'
          ? `${basePath}/${section.id}`
          : `${basePath}?section=${section.id}`,
    }))
  }

  /**
   * Get section content by section ID
   */
  function getSectionContent(
    sectionId: SectionId,
    settings: TSettings,
    ...extraArgs: TExtraArgs
  ) {
    const section =
      sections.find((item) => item.id === sectionId) ?? sections[0]
    return section.build(settings, ...extraArgs)
  }

  return {
    sectionIds,
    defaultSection,
    getSectionNavItems,
    getSectionContent,
  }
}
