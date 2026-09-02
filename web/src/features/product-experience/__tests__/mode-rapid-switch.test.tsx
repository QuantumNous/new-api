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
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { useSidebarData } from '@/hooks/use-sidebar-data'
import { useConsoleModeStore } from '@/stores/console-mode-store'

function readUrls() {
  const { result } = renderHook(() => useSidebarData())
  return result.current.navGroups.flatMap((group) =>
    group.items.flatMap((item) =>
      item.url ? [item.url] : (item.items?.map((entry) => entry.url) ?? [])
    )
  )
}

describe('rapid mode switching', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useConsoleModeStore.getState().setMode('easy')
  })

  it('resolves to the last choice without losing or duplicating actions', () => {
    act(() => {
      const store = useConsoleModeStore.getState()
      store.setMode('developer')
      store.setMode('easy')
      store.setMode('developer')
    })

    expect(useConsoleModeStore.getState().mode).toBe('developer')
    expect(window.localStorage.getItem('yecai_console_mode')).toBe('developer')

    const urls = readUrls()
    expect(new Set(urls).size).toBe(urls.length)
    expect(urls).toContain('/dashboard/overview')
    expect(urls).toContain('/keys')
    expect(urls).toContain('/usage-logs/common')
  })
})
