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
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { NavGroup } from '@/components/layout/types'

const statusMock = vi.hoisted(() => ({ current: {} as Record<string, string> }))

vi.mock('@/hooks/use-status', () => ({
  useStatus: () => ({
    status: statusMock.current,
    isLoading: false,
    error: null,
  }),
}))

const { useIsSidebarModuleVisible, useSidebarConfig } =
  await import('../use-sidebar-config')
const { useAuthStore } = await import('@/stores/auth-store')

const navGroups: NavGroup[] = [
  {
    title: 'Chat',
    items: [{ title: 'Playground', url: '/playground' }],
  },
  {
    title: 'Console',
    items: [{ title: 'Keys', url: '/keys' }],
  },
]

function setAdminConfig(config: Record<string, Record<string, boolean>>) {
  statusMock.current = { SidebarModulesAdmin: JSON.stringify(config) }
}

describe('useSidebarConfig', () => {
  beforeEach(() => {
    statusMock.current = {}
    useAuthStore.getState().auth.setUser(null)
  })

  it('keeps every group visible with the default configuration', () => {
    const { result } = renderHook(() => useSidebarConfig(navGroups))

    expect(result.current.map((group) => group.title)).toEqual([
      'Chat',
      'Console',
    ])
  })

  it('hides a module the admin disabled', () => {
    setAdminConfig({ chat: { enabled: true, playground: false, chat: true } })

    const { result } = renderHook(() => useSidebarConfig(navGroups))

    expect(result.current.map((group) => group.title)).toEqual(['Console'])
  })

  it('hides every module of a section the admin disabled', () => {
    setAdminConfig({ console: { enabled: false } })

    const { result } = renderHook(() => useSidebarConfig(navGroups))

    expect(result.current.map((group) => group.title)).toEqual(['Chat'])
  })

  it('ignores a user sidebar_modules override that re-enables a disabled module', () => {
    setAdminConfig({ chat: { enabled: true, playground: false, chat: true } })
    useAuthStore.getState().auth.setUser({
      id: 1,
      username: 'user',
      role: 1,
      sidebar_modules: JSON.stringify({
        chat: { enabled: true, playground: true },
      }),
    })

    const { result } = renderHook(() => useSidebarConfig(navGroups))

    expect(result.current.map((group) => group.title)).toEqual(['Console'])
  })
})

describe('useIsSidebarModuleVisible', () => {
  beforeEach(() => {
    statusMock.current = {}
  })

  it('reports an admin disabled route as hidden', () => {
    setAdminConfig({ personal: { enabled: true, topup: false } })

    const { result } = renderHook(() => useIsSidebarModuleVisible('/wallet'))

    expect(result.current).toBe(false)
  })

  it('reports unmapped routes as visible', () => {
    const { result } = renderHook(() => useIsSidebarModuleVisible('/unknown'))

    expect(result.current).toBe(true)
  })
})
