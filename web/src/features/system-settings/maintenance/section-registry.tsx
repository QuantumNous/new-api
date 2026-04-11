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
import { PerformanceSection } from './performance-section'
import { SidebarModulesSection } from './sidebar-modules-section'
import { UpdateCheckerSection } from './update-checker-section'

const MAINTENANCE_SECTIONS = [
  {
    id: 'update-checker',
    titleKey: 'System maintenance',
    descriptionKey: 'Check for system updates',
    build: (
      _settings: MaintenanceSettings,
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
    titleKey: 'System Notice',
    descriptionKey: 'Configure system maintenance notice',
    build: (settings: MaintenanceSettings) => (
      <NoticeSection defaultValue={settings.Notice ?? ''} />
    ),
  },
  {
    id: 'logs',
    titleKey: 'Log Maintenance',
    descriptionKey: 'Configure log consumption settings',
    build: (settings: MaintenanceSettings) => (
      <LogSettingsSection
        defaultEnabled={Boolean(settings.LogConsumeEnabled)}
      />
    ),
  },
  {
    id: 'header-navigation',
    titleKey: 'Header navigation',
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
    titleKey: 'Sidebar modules',
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
  {
    id: 'performance',
    titleKey: 'Performance',
    descriptionKey: 'Disk cache, system monitoring and performance stats',
    build: (settings: MaintenanceSettings) => (
      <PerformanceSection
        defaultValues={{
          'performance_setting.disk_cache_enabled':
            settings['performance_setting.disk_cache_enabled'] ?? false,
          'performance_setting.disk_cache_threshold_mb':
            settings['performance_setting.disk_cache_threshold_mb'] ?? 10,
          'performance_setting.disk_cache_max_size_mb':
            settings['performance_setting.disk_cache_max_size_mb'] ?? 1024,
          'performance_setting.disk_cache_path':
            settings['performance_setting.disk_cache_path'] ?? '',
          'performance_setting.monitor_enabled':
            settings['performance_setting.monitor_enabled'] ?? false,
          'performance_setting.monitor_cpu_threshold':
            settings['performance_setting.monitor_cpu_threshold'] ?? 90,
          'performance_setting.monitor_memory_threshold':
            settings['performance_setting.monitor_memory_threshold'] ?? 90,
          'performance_setting.monitor_disk_threshold':
            settings['performance_setting.monitor_disk_threshold'] ?? 95,
        }}
      />
    ),
  },
] as const

export type MaintenanceSectionId = (typeof MAINTENANCE_SECTIONS)[number]['id']

const maintenanceRegistry = createSectionRegistry<
  MaintenanceSectionId,
  MaintenanceSettings,
  [string | null | undefined, number | null | undefined]
>({
  sections: MAINTENANCE_SECTIONS,
  defaultSection: 'update-checker',
  basePath: '/system-settings/maintenance',
  urlStyle: 'path',
})

export const MAINTENANCE_SECTION_IDS = maintenanceRegistry.sectionIds
export const MAINTENANCE_DEFAULT_SECTION = maintenanceRegistry.defaultSection
export const getMaintenanceSectionNavItems =
  maintenanceRegistry.getSectionNavItems
export const getMaintenanceSectionContent =
  maintenanceRegistry.getSectionContent
