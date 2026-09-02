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
import { beforeEach, describe, expect, it } from 'vitest'

import { useSidebarData } from '@/hooks/use-sidebar-data'
import { useConsoleModeStore } from '@/stores/console-mode-store'

function getSidebarUrls() {
  const { result } = renderHook(() => useSidebarData())
  return result.current.navGroups.flatMap((group) =>
    group.items.flatMap((item) => {
      if (item.url) return [item.url]
      return item.items?.map((subItem) => subItem.url) ?? []
    })
  )
}

describe('console mode sidebar', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('keeps only everyday destinations in easy mode', () => {
    useConsoleModeStore.getState().setMode('easy')

    expect(getSidebarUrls()).toEqual([
      '/dashboard/overview',
      '/keys',
      '/pricing',
      '/guide',
      '/usage-logs/common',
      '/wallet',
    ])
  })

  it('restores technical workspaces in developer mode', () => {
    useConsoleModeStore.getState().setMode('developer')

    const urls = getSidebarUrls()
    expect(urls).toContain('/playground')
    expect(urls).toContain('/dashboard/models')
    expect(urls).toContain('/usage-logs/task')
    expect(urls).toContain('/channels')
  })
})
