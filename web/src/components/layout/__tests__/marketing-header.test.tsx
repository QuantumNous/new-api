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
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ThemeProvider } from '@/context/theme-provider'

import { MarketingHeader } from '../components/marketing-header'

type CurrentPage = 'home' | 'client' | 'activity'

async function renderHeader(currentPage: CurrentPage) {
  const root = createRootRoute({
    component: () => (
      <ThemeProvider>
        <MarketingHeader isAuthenticated={false} currentPage={currentPage} />
        <Outlet />
      </ThemeProvider>
    ),
  })
  const routeTree = root.addChildren(
    ['/', '/client', '/activity'].map((path) =>
      createRoute({ getParentRoute: () => root, path })
    )
  )
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  render(<RouterProvider router={router} />)
  await screen.findByRole('navigation')
}

afterEach(() => {
  cleanup()
})

describe('MarketingHeader models link', () => {
  it.each<CurrentPage>(['home', 'client', 'activity'])(
    'links to the home models section on the %s page',
    async (currentPage) => {
      await renderHeader(currentPage)
      const nav = within(screen.getByRole('navigation'))

      expect(nav.getByRole('link', { name: 'Models' })).toHaveAttribute(
        'href',
        '/#models'
      )
    }
  )
})

describe('MarketingHeader logo', () => {
  it('stacks the Latin name under the Chinese name in the home link', async () => {
    await renderHeader('client')

    const logo = screen.getByRole('link', { name: '野菜 home' })
    expect(logo).toHaveTextContent('野菜')
    expect(within(logo).getByText('YesChoy')).toHaveClass('ci-markLatin')
  })
})
