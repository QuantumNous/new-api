/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useMemo } from 'react'

import type { NavGroup, NavItem } from '@/components/layout/types'
import { useStatus } from '@/hooks/use-status'

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
    subscription: true,
  },
}

const mergeWithDefaultSidebarModules = (
  config: SidebarModulesAdminConfig
): SidebarModulesAdminConfig => {
  const merged: SidebarModulesAdminConfig = { ...config }

  Object.entries(DEFAULT_SIDEBAR_MODULES).forEach(
    ([sectionKey, defaultSection]) => {
      const existingSection = merged[sectionKey]
      if (!existingSection) {
        merged[sectionKey] = { ...defaultSection }
        return
      }

      merged[sectionKey] = { ...defaultSection, ...existingSection }
      Object.keys(defaultSection).forEach((moduleKey) => {
        if (merged[sectionKey][moduleKey] === undefined) {
          merged[sectionKey][moduleKey] = defaultSection[moduleKey]
        }
      })
    }
  )

  return merged
}

/**
 * Mapping from URL to configuration keys
 */
const URL_TO_CONFIG_MAP: Record<string, { section: string; module: string }> = {
  '/playground': { section: 'chat', module: 'playground' },
  '/dashboard': { section: 'console', module: 'detail' },
  '/dashboard/overview': { section: 'console', module: 'detail' },
  '/dashboard/models': { section: 'console', module: 'detail' },
  '/dashboard/users': { section: 'console', module: 'detail' },
  '/keys': { section: 'console', module: 'token' },
  '/usage-logs': { section: 'console', module: 'log' },
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
  '/subscriptions': { section: 'admin', module: 'subscription' },
  '/system-settings': { section: 'admin', module: 'setting' },
  '/system-settings/site': { section: 'admin', module: 'setting' },
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
    return mergeWithDefaultSidebarModules(parsed)
  } catch {
    // eslint-disable-next-line no-console
    console.error('Failed to parse sidebar modules configuration')
    return DEFAULT_SIDEBAR_MODULES
  }
}

/**
 * Check if a module is enabled. Admin config is the only layer: if admin
 * disables a section/module it is hidden for everyone.
 */
function isModuleEnabled(
  url: string,
  adminConfig: SidebarModulesAdminConfig
): boolean {
  const mapping = URL_TO_CONFIG_MAP[url]
  if (!mapping) {
    // No mapping config, default to visible (e.g. system settings and new features)
    return true
  }

  const { section, module } = mapping
  const adminSection = adminConfig[section]

  return Boolean(
    adminSection && adminSection.enabled && adminSection[module] === true
  )
}

/**
 * Check if a navigation item should be visible
 */
function isNavItemVisible(
  item: NavItem,
  adminConfig: SidebarModulesAdminConfig
): boolean {
  // Handle dynamic chat presets type
  if ('type' in item && item.type === 'chat-presets') {
    const adminChat = adminConfig.chat
    return Boolean(adminChat?.enabled && adminChat.chat === true)
  }

  // Handle direct link type
  if ('url' in item && item.url) {
    const configUrls = item.configUrls ?? [item.url]
    return configUrls.some((url) => isModuleEnabled(url as string, adminConfig))
  }

  // Handle collapsible type (with sub-items)
  if ('items' in item && item.items) {
    // If has sub-items, show this collapsible item if at least one sub-item is visible
    return item.items.some((subItem) =>
      isModuleEnabled(subItem.url as string, adminConfig)
    )
  }

  return true
}

/**
 * Filter navigation items
 */
function filterNavItems(
  items: NavItem[],
  adminConfig: SidebarModulesAdminConfig
): NavItem[] {
  return items
    .map((item) => {
      // If collapsible item, also filter its sub-items
      if ('items' in item && item.items) {
        const filteredSubItems = item.items.filter((subItem) =>
          isModuleEnabled(subItem.url as string, adminConfig)
        )

        return {
          ...item,
          items: filteredSubItems,
        }
      }
      return item
    })
    .filter((item) => isNavItemVisible(item, adminConfig))
}

/**
 * Filter sidebar navigation groups by the admin sidebar_modules config
 * (status.SidebarModulesAdmin). It is the only layer: it falls back to
 * DEFAULT_SIDEBAR_MODULES when empty/invalid, and disabling an entry there
 * hides it for everyone — users cannot restore it.
 */
export function useSidebarConfig(navGroups: NavGroup[]): NavGroup[] {
  const { status } = useStatus()

  const adminConfig = useMemo(
    () =>
      parseSidebarConfig(
        status?.SidebarModulesAdmin as string | null | undefined
      ),
    [status?.SidebarModulesAdmin]
  )

  const filteredNavGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: filterNavItems(group.items, adminConfig),
        }))
        .filter((group) => group.items.length > 0), // Only show navigation groups with visible items
    [navGroups, adminConfig]
  )

  return filteredNavGroups
}

/**
 * Check whether a single route is visible under the current sidebar_modules
 * config. Used by entries living outside the sidebar (e.g. the profile
 * dropdown's wallet link) so they honour the same "wallet display" toggle.
 */
export function useIsSidebarModuleVisible(url: string): boolean {
  const { status } = useStatus()

  const adminConfig = parseSidebarConfig(
    status?.SidebarModulesAdmin as string | null | undefined
  )

  return isModuleEnabled(url, adminConfig)
}
