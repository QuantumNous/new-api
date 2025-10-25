import { useMemo } from 'react'
import { useStatus } from '@/hooks/use-status'
import type { NavGroup, NavItem } from '@/components/layout/types'

type SidebarSectionConfig = {
  enabled: boolean
  [key: string]: boolean
}

type SidebarModulesAdminConfig = Record<string, SidebarSectionConfig>

// Default configuration
const DEFAULT_SIDEBAR_MODULES: SidebarModulesAdminConfig = {
  console: {
    enabled: true,
    detail: true,
    token: true,
    log: true,
    midjourney: true,
    task: true,
  },
  personal: {
    enabled: true,
    topup: true,
    personal: true,
  },
  admin: {
    enabled: true,
    channel: true,
    models: true,
    redemption: true,
    user: true,
    setting: true,
  },
}

// Mapping from URL to configuration keys
const URL_TO_CONFIG_MAP: Record<string, { section: string; module: string }> = {
  '/dashboard': { section: 'console', module: 'detail' },
  '/keys': { section: 'console', module: 'token' },
  '/usage-logs': { section: 'console', module: 'log' },
  '/wallet': { section: 'personal', module: 'topup' },
  '/profile': { section: 'personal', module: 'personal' },
  '/channels': { section: 'admin', module: 'channel' },
  '/models': { section: 'admin', module: 'models' },
  '/users': { section: 'admin', module: 'user' },
  '/redemption-codes': { section: 'admin', module: 'redemption' },
}

/**
 * Parse backend SidebarModulesAdmin configuration
 */
function parseSidebarConfig(
  value: string | null | undefined
): SidebarModulesAdminConfig {
  // If empty string, null, or undefined, use default config
  if (!value || value.trim() === '') {
    return DEFAULT_SIDEBAR_MODULES
  }

  try {
    return JSON.parse(value) as SidebarModulesAdminConfig
  } catch {
    console.error('Failed to parse sidebar modules configuration')
    return DEFAULT_SIDEBAR_MODULES
  }
}

/**
 * Check if navigation item should be visible
 */
function isNavItemVisible(
  item: NavItem,
  config: SidebarModulesAdminConfig
): boolean {
  // Handle NavLink type (direct link)
  if ('url' in item && item.url) {
    const mapping = URL_TO_CONFIG_MAP[item.url as string]
    if (!mapping) {
      // If no mapping config, default to visible (e.g., system settings and new features)
      return true
    }

    const { section, module } = mapping
    const sectionConfig = config[section]

    // Check if section is enabled
    if (!sectionConfig || !sectionConfig.enabled) {
      return false
    }

    // Check if module is enabled
    return sectionConfig[module] === true
  }

  // Handle NavCollapsible type (collapsible with sub-items)
  if ('items' in item && item.items) {
    // If has sub-items, show this collapsible item if at least one sub-item is visible
    return item.items.some((subItem) => {
      const mapping = URL_TO_CONFIG_MAP[subItem.url as string]
      if (!mapping) return true

      const { section, module } = mapping
      const sectionConfig = config[section]

      if (!sectionConfig || !sectionConfig.enabled) {
        return false
      }

      return sectionConfig[module] === true
    })
  }

  return true
}

/**
 * Filter navigation items
 */
function filterNavItems(
  items: NavItem[],
  config: SidebarModulesAdminConfig
): NavItem[] {
  return items
    .map((item) => {
      // If collapsible item, also filter its sub-items
      if ('items' in item && item.items) {
        const filteredSubItems = item.items.filter((subItem) => {
          const mapping = URL_TO_CONFIG_MAP[subItem.url as string]
          if (!mapping) return true

          const { section, module } = mapping
          const sectionConfig = config[section]

          if (!sectionConfig || !sectionConfig.enabled) {
            return false
          }

          return sectionConfig[module] === true
        })

        return {
          ...item,
          items: filteredSubItems,
        }
      }
      return item
    })
    .filter((item) => isNavItemVisible(item, config))
}

/**
 * Filter sidebar navigation groups based on backend SidebarModulesAdmin configuration
 */
export function useSidebarConfig(navGroups: NavGroup[]): NavGroup[] {
  const { status } = useStatus()

  const config = useMemo(() => {
    return parseSidebarConfig(status?.SidebarModulesAdmin)
  }, [status?.SidebarModulesAdmin])

  const filteredNavGroups = useMemo(() => {
    return navGroups
      .map((group) => ({
        ...group,
        items: filterNavItems(group.items, config),
      }))
      .filter((group) => group.items.length > 0) // Only show navigation groups with visible items
  }, [navGroups, config])

  return filteredNavGroups
}
