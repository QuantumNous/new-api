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
import {
  createRootRoute,
  createMemoryHistory,
  createRouter,
  RouterContextProvider,
} from '@tanstack/react-router'
import { renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useSidebarData } from '@/hooks/use-sidebar-data'
import { useConsoleModeStore } from '@/stores/console-mode-store'

async function getSidebarUrls() {
  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  const { result } = renderHook(() => useSidebarData(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <RouterContextProvider router={router}>{children}</RouterContextProvider>
    ),
  })
  return result.current.navGroups.flatMap((group) =>
    group.items.flatMap((item) => {
      if (item.url) return [item.url]
      return item.items?.map((subItem) => subItem.url) ?? []
    })
  )
}

const previousMode = useConsoleModeStore.getState().mode
afterEach(() => {
  useConsoleModeStore.getState().setMode(previousMode)
})

describe('console mode sidebar', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('keeps only everyday destinations in easy mode', async () => {
    useConsoleModeStore.getState().setMode('easy')

    expect(await getSidebarUrls()).toEqual([
      '/dashboard/overview',
      '/keys',
      '/pricing',
      '/beginner-guide',
      '/usage-logs/common',
      '/wallet',
    ])
  })

  it('restores technical workspaces in developer mode', async () => {
    useConsoleModeStore.getState().setMode('developer')

    const urls = await getSidebarUrls()
    expect(urls).toContain('/playground')
    expect(urls).toContain('/guide')
    expect(urls).toContain('/dashboard/models')
    expect(urls).toContain('/usage-logs/task')
    expect(urls).toContain('/channels')
  })
})
