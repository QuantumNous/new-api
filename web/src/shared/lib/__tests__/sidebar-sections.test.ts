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

import {
  firstVisibleClientPath,
  resolveSectionForUrl,
} from '../sidebar-sections'

describe('sidebar section URL mapping', () => {
  it('maps admin pages to their console sections', () => {
    expect(resolveSectionForUrl('/admin/overview')).toBe('dashboard')
    expect(resolveSectionForUrl('/admin/system-info')).toBe('system_info')
    expect(resolveSectionForUrl('/admin/task-plugins')).toBe('task_plugins')
  })

  it('maps payment logs to the wallet section enforced by the server', () => {
    // /api/admin/payments uses RequireVisibleSection("wallet"); an unmapped
    // frontend route would stay visible under a restrictive allow-list.
    expect(resolveSectionForUrl('/admin/payments')).toBe('wallet')
  })

  it('maps chat destinations to the chat section', () => {
    expect(resolveSectionForUrl('/app/chat2link')).toBe('chat')
    expect(resolveSectionForUrl('/app/chat/42')).toBe('chat')
  })
})

describe('first permitted client path', () => {
  it('returns the first granted client page in sidebar order', () => {
    expect(firstVisibleClientPath(['wallet'])).toBe('/app/wallet')
    expect(firstVisibleClientPath(['usage_logs'])).toBe(
      '/app/usage-logs/common'
    )
  })

  it('returns null when only administrative sections are granted', () => {
    expect(firstVisibleClientPath(['users', 'channels'])).toBeNull()
  })
})
