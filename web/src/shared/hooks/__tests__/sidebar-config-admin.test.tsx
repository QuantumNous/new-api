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
import { renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAuthStore } from '@/shared/stores/auth-store'

import { useIsSidebarModuleVisible } from '../use-sidebar-config'

const state = vi.hoisted(() => ({ adminConfig: '' }))

vi.mock('@/shared/hooks/use-status', () => ({
  useStatus: () => ({
    status: { SidebarModulesAdmin: state.adminConfig },
    loading: false,
    error: null,
  }),
}))

const ADMIN_URLS = [
  '/admin/overview',
  '/admin/payments',
  '/admin/system-info',
  '/admin/task-plugins',
]

function isVisible(url: string): boolean {
  return renderHook(() => useIsSidebarModuleVisible(url)).result.current
}

afterEach(() => {
  state.adminConfig = ''
  useAuthStore.getState().auth.reset('idle')
})

describe('admin sidebar module configuration', () => {
  it('keeps every mapped admin entry visible by default', () => {
    for (const url of ADMIN_URLS) {
      expect(isVisible(url)).toBe(true)
    }
  })

  it('hides payment logs when the payment module is disabled', () => {
    state.adminConfig = JSON.stringify({
      admin: { enabled: true, payment: false },
    })

    expect(isVisible('/admin/payments')).toBe(false)
    expect(isVisible('/admin/overview')).toBe(true)
  })

  it('hides every mapped admin entry when the admin section is disabled', () => {
    state.adminConfig = JSON.stringify({ admin: { enabled: false } })

    for (const url of ADMIN_URLS) {
      expect(isVisible(url)).toBe(false)
    }
  })
})
