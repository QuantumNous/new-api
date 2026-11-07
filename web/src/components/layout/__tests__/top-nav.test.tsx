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
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

async function openDrawer() {
  const user = userEvent.setup()
  const trigger = screen.getByRole('button', { name: 'Open navigation menu' })
  await user.click(trigger)
  const drawer = await screen.findByRole('dialog')
  return { user, trigger, drawer }
}

describe('top navigation responsiveness', () => {
  it('shows a hamburger that opens a drawer containing every link', async () => {
    await renderTopNav()

    const { drawer } = await openDrawer()

    for (const link of LINKS) {
      expect(within(drawer).getByRole('link', { name: link.title })).toBeTruthy()
    }
  })

  it('marks the hamburger as expanded while the drawer is open', async () => {
    await renderTopNav()

    const { trigger } = await openDrawer()

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes the drawer after a destination is chosen', async () => {
    await renderTopNav()

    const { user, drawer } = await openDrawer()
    await user.click(within(drawer).getByRole('link', { name: 'Home' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('keeps the inline link row for wide viewports', async () => {
    await renderTopNav()

    const inlineNav = screen
      .getAllByRole('navigation')
      .find((element) => element.textContent?.includes('Models Workspace'))

    expect(inlineNav?.className).toContain('lg:flex')
    expect(inlineNav?.querySelectorAll('a')).toHaveLength(LINKS.length)
  })

  it('opens the drawer from the start edge in a right-to-left layout', async () => {
    await renderTopNav('rtl')

    const { drawer } = await openDrawer()

    expect(drawer).toHaveAttribute('data-side', 'right')
  })
})
