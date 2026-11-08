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
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { NavGroup } from '@/shared/components/layout/components/nav-group'
import { SidebarProvider } from '@/shared/components/ui/sidebar'

const TITLE = 'التنقل في الشريط العلوي'

function mockLabelWidths(scrollWidth: number, clientWidth: number) {
  Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
    configurable: true,
    get: () => scrollWidth,
  })
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    get: () => clientWidth,
  })
}

async function renderNavGroup() {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <SidebarProvider>
          <NavGroup title='Admin' items={[{ title: TITLE, url: '/admin' }]} />
        </SidebarProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/admin'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  return screen.findByText(TITLE)
}

afterEach(() => {
  delete (HTMLElement.prototype as { scrollWidth?: number }).scrollWidth
  delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth
})

describe('sidebar navigation labels', () => {
  it('wraps a label that does not fit in a tooltip trigger', async () => {
    mockLabelWidths(320, 120)

    const label = await renderNavGroup()

    await waitFor(() =>
      expect(label.closest('[data-slot="tooltip-trigger"]')).not.toBeNull()
    )
  })

  it('renders a fitting label without a tooltip trigger', async () => {
    mockLabelWidths(90, 120)

    const label = await renderNavGroup()

    expect(label.closest('[data-slot="tooltip-trigger"]')).toBeNull()
  })
})
