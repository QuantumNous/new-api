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
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TopNav } from '@/components/layout/components/top-nav'
import { DirectionProvider } from '@/components/ui/direction'

const LINKS = [
  { title: 'Home', href: '/' },
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Models Workspace', href: '/pricing' },
  { title: 'Categories', href: '/rankings' },
  { title: 'Docs', href: 'https://docs.example.com', external: true },
]

async function renderTopNav(direction: 'ltr' | 'rtl' = 'ltr') {
  const router = createRouter({
    routeTree: createRootRoute({
      component: () => (
        <DirectionProvider direction={direction}>
          <TopNav links={LINKS} />
        </DirectionProvider>
      ),
    }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
}

describe('top navigation', () => {
  it('renders every link inline from the lg breakpoint up', async () => {
    await renderTopNav()

    const nav = screen.getByRole('navigation')
    expect(nav.className).toContain('lg:flex')
    expect(nav.className).toContain('hidden')

    for (const link of LINKS) {
      expect(within(nav).getByRole('link', { name: link.title })).toBeTruthy()
    }
  })

  it('does not render a mobile drawer trigger or dialog', async () => {
    await renderTopNav()

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(
      screen.queryByRole('button', { name: /navigation menu/i })
    ).toBeNull()
  })

  it('keeps the same links in a right-to-left layout', async () => {
    await renderTopNav('rtl')

    const nav = screen.getByRole('navigation')
    expect(within(nav).getAllByRole('link')).toHaveLength(LINKS.length)
  })
})
