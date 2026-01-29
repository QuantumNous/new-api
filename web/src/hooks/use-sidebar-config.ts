import { useMemo } from 'react'
import { useStatus } from '@/hooks/use-status'
import type { NavGroup, NavItem } from '@/components/layout/types'

type SidebarSectionConfig = {
  enabled: boolean
  [key: string]: boolean
}

type SidebarModulesAdminConfig = Record<string, SidebarSectionConfig>

/**
 * Default sidebar modules configuration
 */
const DEFAULT_SIDEBAR_MODULES: SidebarModulesAdminConfig = {
  chat: {
    enabled: true,
    playground: true,
    chat: true,
  },
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

/**
 * Mapping from URL to configuration keys
 */
const URL_TO_CONFIG_MAP: Record<string, { section: string; module: string }> = {
  '/playground': { section: 'chat', module: 'playground' },
  '/dashboard': { section: 'console', module: 'detail' },
  '/dashboard/overview': { section: 'console', module: 'detail' },
  '/dashboard/models': { section: 'console', module: 'detail' },
  '/keys': { section: 'console', module: 'token' },
  '/usage-logs/common': { section: 'console', module: 'log' },
  '/usage-logs/drawing': { section: 'console', module: 'midjourney' },
  '/usage-logs/task': { section: 'console', module: 'task' },
  '/wallet': { section: 'personal', module: 'topup' },
  '/profile': { section: 'personal', module: 'personal' },
  '/channels': { section: 'admin', module: 'channel' },
  '/models': { section: 'admin', module: 'models' },
  '/models/metadata': { section: 'admin', module: 'models' },
  '/models/deployments': { section: 'admin', module: 'models' },
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
    const parsed = JSON.parse(value) as SidebarModulesAdminConfig
    // Ensure chat section and its modules are correctly initialized if missing
    if (!parsed.chat) {
      parsed.chat = { enabled: true, playground: true, chat: true }
    } else {
      if (parsed.chat.enabled === undefined) parsed.chat.enabled = true
      if (parsed.chat.playground === undefined) parsed.chat.playground = true
      if (parsed.chat.chat === undefined) parsed.chat.chat = true
    }
    return parsed
  } catch {
    console.error('Failed to parse sidebar modules configuration')
    return DEFAULT_SIDEBAR_MODULES
  }
}

/**
 * Check if a module is enabled
 */
function isModuleEnabled(
  url: string,
  config: SidebarModulesAdminConfig
): boolean {
  const mapping = URL_TO_CONFIG_MAP[url]
  if (!mapping) {
    // No mapping config, default to visible (e.g. system settings and new features)
    return true
  }

  const { section, module } = mapping
  const sectionConfig = config[section]

  // Check if both section and module are enabled
  return Boolean(
    sectionConfig && sectionConfig.enabled && sectionConfig[module] === true
  )
}

/**
 * Check if a navigation item should be visible
 */
function isNavItemVisible(
  item: NavItem,
  config: SidebarModulesAdminConfig
): boolean {
  // Handle dynamic chat presets type
  if ('type' in item && item.type === 'chat-presets') {
    const chatConfig = config.chat
    return Boolean(chatConfig?.enabled && chatConfig.chat === true)
  }

  // Handle direct link type
  if ('url' in item && item.url) {
    return isModuleEnabled(item.url as string, config)
  }

  // Handle collapsible type (with sub-items)
  if ('items' in item && item.items) {
    // If has sub-items, show this collapsible item if at least one sub-item is visible
    return item.items.some((subItem) =>
      isModuleEnabled(subItem.url as string, config)
    )
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
        const filteredSubItems = item.items.filter((subItem) =>
          isModuleEnabled(subItem.url as string, config)
        )

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

  const config = useMemo(
    () => parseSidebarConfig(status?.SidebarModulesAdmin),
    [status?.SidebarModulesAdmin]
  )

  const filteredNavGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: filterNavItems(group.items, config),
        }))
        .filter((group) => group.items.length > 0), // Only show navigation groups with visible items
    [navGroups, config]
  )

  return filteredNavGroups
}
