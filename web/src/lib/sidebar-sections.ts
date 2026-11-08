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
import type { NavGroup, NavItem } from '@/components/layout/types'

/**
 * Console sections an administrator can grant or revoke for an individual user.
 * The keys mirror the server-side canonical list in `model/user.go`; keep both
 * in sync so the allow-list filter and the API guard agree.
 */
export const SIDEBAR_SECTIONS = [
  'dashboard',
  'chat',
  'playground',
  'api_keys',
  'usage_logs',
  'task_logs',
  'drawing_logs',
  'audit_logs',
  'wallet',
  'profile',
  'security',
  'channels',
  'models',
  'users',
  'redemption',
  'subscriptions',
  'system_settings',
  'system_info',
  'task_plugins',
] as const

export type SidebarSection = (typeof SIDEBAR_SECTIONS)[number]

// Longest/most specific prefixes must precede their broader parents so that
// `/usage-logs/common` resolves to `usage_logs` before the generic `/usage-logs`.
const URL_SECTION_PREFIXES: { prefix: string; section: SidebarSection }[] = [
  { prefix: '/dashboard', section: 'dashboard' },
  { prefix: '/admin/overview', section: 'dashboard' },
  { prefix: '/playground', section: 'playground' },
  { prefix: '/keys', section: 'api_keys' },
  { prefix: '/usage-logs/common', section: 'usage_logs' },
  { prefix: '/usage-logs/task', section: 'task_logs' },
  { prefix: '/usage-logs/drawing', section: 'drawing_logs' },
  { prefix: '/usage-logs/audit', section: 'audit_logs' },
  { prefix: '/usage-logs', section: 'usage_logs' },
  { prefix: '/wallet', section: 'wallet' },
  { prefix: '/profile', section: 'profile' },
  { prefix: '/security', section: 'security' },
  { prefix: '/channels', section: 'channels' },
  { prefix: '/models', section: 'models' },
  { prefix: '/users', section: 'users' },
  { prefix: '/redemption-codes', section: 'redemption' },
  { prefix: '/subscriptions', section: 'subscriptions' },
  { prefix: '/system-settings', section: 'system_settings' },
  { prefix: '/system-info', section: 'system_info' },
  { prefix: '/task-plugins', section: 'task_plugins' },
]

/** Resolve a sidebar URL to its section key, or undefined when unmapped. */
export function resolveSectionForUrl(url: string): SidebarSection | undefined {
  const path = url.split('?')[0]
  for (const entry of URL_SECTION_PREFIXES) {
    if (path === entry.prefix || path.startsWith(`${entry.prefix}/`)) {
      return entry.section
    }
  }
  return undefined
}

/**
 * Whether a section is visible under an allow-list.
 *
 * An empty or absent allow-list means "unrestricted" (backward compatible), and
 * an unmapped URL is always visible so new features are not hidden by default.
 */
export function isSectionVisible(
  sections: readonly string[] | null | undefined,
  section: SidebarSection | undefined
): boolean {
  if (!sections || sections.length === 0) return true
  if (!section) return true
  return sections.includes(section)
}

function isNavItemAllowed(item: NavItem, sections: readonly string[]): boolean {
  if ('type' in item && item.type === 'chat-presets') {
    return isSectionVisible(sections, 'chat')
  }
  if ('url' in item && item.url) {
    const urls = item.configUrls?.length ? item.configUrls : [item.url]
    return urls.some((url) =>
      isSectionVisible(sections, resolveSectionForUrl(String(url)))
    )
  }
  if ('items' in item && item.items) {
    if (item.configUrls?.length) {
      return item.configUrls.some((url) =>
        isSectionVisible(sections, resolveSectionForUrl(String(url)))
      )
    }
    return item.items.some((subItem) =>
      isSectionVisible(sections, resolveSectionForUrl(String(subItem.url)))
    )
  }
  return true
}

/**
 * Narrow sidebar navigation to the administrator-managed allow-list. An empty
 * or absent list leaves the navigation untouched.
 */
export function filterNavGroupsByVisibleSections(
  navGroups: NavGroup[],
  sections: readonly string[] | null | undefined
): NavGroup[] {
  if (!sections || sections.length === 0) return navGroups

  return navGroups
    .map((group) => {
      const items = group.items
        .map((item): NavItem | null => {
          if ('items' in item && item.items) {
            const allowedChildren = item.items.filter((subItem) =>
              isSectionVisible(
                sections,
                resolveSectionForUrl(String(subItem.url))
              )
            )
            if (allowedChildren.length === 0) return null
            if (allowedChildren.length === item.items.length) return item
            return { ...item, items: allowedChildren }
          }
          return isNavItemAllowed(item, sections) ? item : null
        })
        .filter((item): item is NavItem => item !== null)
      return { ...group, items }
    })
    .filter((group) => group.items.length > 0)
}
