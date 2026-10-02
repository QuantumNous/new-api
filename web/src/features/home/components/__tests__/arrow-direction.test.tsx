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
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it } from 'vitest'

import { HeroButtons } from '../hero-buttons'
import { CTA } from '../sections/cta'

afterEach(() => {
  cleanup()
})

async function renderWithRouter(content: ReactNode) {
  const router = createRouter({
    routeTree: createRootRoute({ component: () => content }),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  await router.load()
  return render(<RouterProvider router={router} />)
}

it('points the hero call-to-action arrows forward in both directions', async () => {
  await renderWithRouter(<HeroButtons isAuthenticated={false} />)

  const arrow = (await screen.findByText('Get Started'))
    .closest('a')
    ?.querySelector('svg')
  expect(arrow).toHaveClass('ms-2', 'rtl:rotate-180')
  expect(arrow).not.toHaveClass('ml-2')
})

it('points the dashboard link arrow forward in both directions', async () => {
  await renderWithRouter(<HeroButtons isAuthenticated />)

  const arrow = (await screen.findByText('Go to Dashboard'))
    .closest('a')
    ?.querySelector('svg')
  expect(arrow).toHaveClass('ms-2', 'rtl:rotate-180')
})

it('moves the closing call-to-action arrow forward on hover in both directions', async () => {
  await renderWithRouter(<CTA />)

  const arrow = (await screen.findByText('Get Started'))
    .closest('a')
    ?.querySelector('svg')
  expect(arrow).toHaveClass(
    'ms-1',
    'group-hover:translate-x-0.5',
    'rtl:rotate-180',
    'rtl:group-hover:-translate-x-0.5'
  )
})
