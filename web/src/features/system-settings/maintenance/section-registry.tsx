import type { MaintenanceSettings } from '../types'
import { createSectionRegistry } from '../utils/section-registry'
import {
  parseHeaderNavModules,
  parseSidebarModulesAdmin,
  serializeHeaderNavModules,
  serializeSidebarModulesAdmin,
} from './config'
import { HeaderNavigationSection } from './header-navigation-section'
import { LogSettingsSection } from './log-settings-section'
import { NoticeSection } from './notice-section'
import { SidebarModulesSection } from './sidebar-modules-section'
import { UpdateCheckerSection } from './update-checker-section'

const MAINTENANCE_SECTIONS = [
  {
    id: 'update-checker',
    titleKey: 'Update Checker',
    descriptionKey: 'Check for system updates',
    build: (
      settings: MaintenanceSettings,
      currentVersion?: string | null,
      startTime?: number | null
    ) => (
      <UpdateCheckerSection
        currentVersion={currentVersion}
        startTime={startTime}
      />
    ),
  },
  {
    id: 'notice',
    titleKey: 'Notice',
    descriptionKey: 'Configure system maintenance notice',
    build: (settings: MaintenanceSettings) => (
      <NoticeSection defaultValue={settings.Notice ?? ''} />
    ),
  },
  {
    id: 'logs',
    titleKey: 'Log Settings',
    descriptionKey: 'Configure log consumption settings',
    build: (settings: MaintenanceSettings) => (
      <LogSettingsSection
        defaultEnabled={Boolean(settings.LogConsumeEnabled)}
      />
    ),
  },
  {
    id: 'header-navigation',
    titleKey: 'Header Navigation',
    descriptionKey: 'Configure header navigation modules',
    build: (settings: MaintenanceSettings) => {
      const headerNavConfig = parseHeaderNavModules(settings.HeaderNavModules)
      const headerNavSerialized = serializeHeaderNavModules(headerNavConfig)
      return (
        <HeaderNavigationSection
          config={headerNavConfig}
          initialSerialized={headerNavSerialized}
        />
      )
    },
  },
  {
    id: 'sidebar-modules',
    titleKey: 'Sidebar Modules',
    descriptionKey: 'Configure sidebar modules for admin',
    build: (settings: MaintenanceSettings) => {
      const sidebarConfig = parseSidebarModulesAdmin(
        settings.SidebarModulesAdmin
      )
      const sidebarSerialized = serializeSidebarModulesAdmin(sidebarConfig)
      return (
        <SidebarModulesSection
          config={sidebarConfig}
          initialSerialized={sidebarSerialized}
        />
      )
    },
  },
] as const

export type MaintenanceSectionId =
  (typeof MAINTENANCE_SECTIONS)[number]['id']

const maintenanceRegistry = createSectionRegistry<
  MaintenanceSectionId,
  MaintenanceSettings,
  [string | null | undefined, number | null | undefined]
>({
  sections: MAINTENANCE_SECTIONS,
  defaultSection: 'update-checker',
  basePath: '/system-settings/maintenance',
})

export const MAINTENANCE_SECTION_IDS = maintenanceRegistry.sectionIds
export const MAINTENANCE_DEFAULT_SECTION = maintenanceRegistry.defaultSection
export const getMaintenanceSectionNavItems =
  maintenanceRegistry.getSectionNavItems
export const getMaintenanceSectionContent =
  maintenanceRegistry.getSectionContent
