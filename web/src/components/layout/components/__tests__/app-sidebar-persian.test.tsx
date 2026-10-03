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
import { act, render } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'
import { DirectionProvider } from '@/context/direction-provider'
import { LayoutProvider } from '@/context/layout-provider'

import { AppSidebar } from '../app-sidebar'

// The navigation tree depends on the router; this test only covers placement.
vi.mock('@/hooks/use-sidebar-view', () => ({
  useSidebarView: () => ({ key: 'root', view: null, navGroups: [] }),
}))

function renderSidebar() {
  return render(
    <DirectionProvider>
      <LayoutProvider>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </LayoutProvider>
    </DirectionProvider>
  )
}

describe('AppSidebar in Persian', () => {
  afterEach(async () => {
    await i18next.changeLanguage('en')
    document.documentElement.removeAttribute('dir')
  })

  it('docks the sidebar on the right after switching to Persian', async () => {
    await i18next.changeLanguage('en')
    const { container } = renderSidebar()

    await act(async () => {
      await i18next.changeLanguage('fa')
    })

    expect(container.querySelector('[data-side="right"]')).not.toBeNull()
    expect(container.querySelector('[data-side="left"]')).toBeNull()
  })
})
