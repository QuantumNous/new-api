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
import { describe, expect, it } from 'vitest'

import type { NavGroup, NavItem } from '@/shared/components/layout/types'
import {
  filterNavGroupsByVisibleSections,
  isSectionVisible,
  resolveSectionForUrl,
} from '@/shared/lib/sidebar-sections'

function groups(): NavGroup[] {
  const items: NavItem[] = [
    { title: 'Dashboard', url: '/app/workspace/overview' },
    { title: 'Chat', type: 'chat-presets' },
    { title: 'API Keys', url: '/app/keys' },
    { title: 'Usage Logs', url: '/app/usage-logs/common' },
  ]
  return [{ id: 'dashboard', title: 'Dash', items }]
}

describe('resolveSectionForUrl', () => {
  it('maps the most specific usage-log path to its own section', () => {
    expect(resolveSectionForUrl('/app/usage-logs/common')).toBe('usage_logs')
    expect(resolveSectionForUrl('/app/usage-logs/task')).toBe('task_logs')
    expect(resolveSectionForUrl('/app/usage-logs/drawing')).toBe('drawing_logs')
    expect(resolveSectionForUrl('/admin/audit-logs')).toBe('audit_logs')
  })

  it('ignores query strings when resolving a section', () => {
    expect(resolveSectionForUrl('/app/keys?page=2')).toBe('api_keys')
  })

  it('returns undefined for an unmapped path', () => {
    expect(resolveSectionForUrl('/unknown-page')).toBeUndefined()
  })
})

describe('isSectionVisible', () => {
  it('treats an absent or empty allow-list as unrestricted', () => {
    expect(isSectionVisible(undefined, 'usage_logs')).toBe(true)
    expect(isSectionVisible([], 'usage_logs')).toBe(true)
  })

  it('hides a section that is not in the allow-list', () => {
    expect(isSectionVisible(['dashboard'], 'usage_logs')).toBe(false)
    expect(isSectionVisible(['dashboard', 'usage_logs'], 'usage_logs')).toBe(
      true
    )
  })
})

describe('filterNavGroupsByVisibleSections', () => {
  it('leaves navigation untouched when no allow-list is set', () => {
    const input = groups()
    expect(filterNavGroupsByVisibleSections(input, undefined)).toEqual(input)
    expect(filterNavGroupsByVisibleSections(input, [])).toEqual(input)
  })

  it('removes links for sections that are not granted', () => {
    const filtered = filterNavGroupsByVisibleSections(groups(), ['dashboard'])
    const items = filtered[0].items
    expect(items.map((item) => item.title)).toEqual(['Dashboard'])
  })

  it('hides the chat entry when the chat section is not granted', () => {
    const filtered = filterNavGroupsByVisibleSections(groups(), ['api_keys'])
    const titles = filtered[0].items.map((item) => item.title)
    expect(titles).toContain('API Keys')
    expect(titles).not.toContain('Chat')
  })

  it('drops a group that has no granted items', () => {
    const filtered = filterNavGroupsByVisibleSections(groups(), ['wallet'])
    expect(filtered).toEqual([])
  })
})
