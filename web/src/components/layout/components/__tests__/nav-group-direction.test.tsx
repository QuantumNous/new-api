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
import { DirectionProvider } from '@base-ui/react/direction-provider'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'

import { NavGroup } from '../nav-group'

vi.mock('@tanstack/react-router', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tanstack/react-router')>()),
  useLocation: (options?: {
    select?: (location: { href: string }) => unknown
  }) => options?.select?.({ href: '/console' }),
  Link: (props: ComponentProps<'a'> & { to: string }) => {
    const { to, ...anchorProps } = props
    return <a href={to} {...anchorProps} />
  },
}))

// With the sidebar collapsed, a group with sub-pages opens them in a menu
// beside its icon, towards the reading direction: to the right in LTR, to
// the left in RTL. JSDOM has no layout, so the trigger box and the viewport
// are stubbed and the real positioning code places the menu.
const TRIGGER = { x: 400, y: 100, width: 32, height: 32 }

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      return this.matches('[aria-haspopup="menu"]')
        ? DOMRect.fromRect(TRIGGER)
        : DOMRect.fromRect()
    }
  )
  Object.defineProperty(document.documentElement, 'clientWidth', {
    configurable: true,
    value: 1200,
  })
  Object.defineProperty(document.documentElement, 'clientHeight', {
    configurable: true,
    value: 800,
  })
})

afterEach(() => {
  Reflect.deleteProperty(document.documentElement, 'clientWidth')
  Reflect.deleteProperty(document.documentElement, 'clientHeight')
})

describe('collapsed sidebar group menu side', () => {
  it.each([
    ['ltr', 'right'],
    ['rtl', 'left'],
  ] as const)(
    'opens the sub-page menu towards the reading direction in %s, to the %s',
    async (dir, expected) => {
      render(
        <DirectionProvider direction={dir}>
          <SidebarProvider defaultOpen={false}>
            <NavGroup
              title='Console'
              items={[
                {
                  title: 'Channels',
                  items: [{ title: 'Channel list', url: '/console/channel' }],
                },
              ]}
            />
          </SidebarProvider>
        </DirectionProvider>
      )

      await userEvent.click(screen.getByRole('button', { name: 'Channels' }))
      const menu = await screen.findByRole('menu')
      const positioner = menu.parentElement as HTMLElement
      // The positioner sits at the origin until the menu has been placed.
      await waitFor(() =>
        expect(positioner.style.transform).not.toBe('translate(0px, 0px)')
      )
      const x = Number(
        /translate\((-?[\d.]+)px/.exec(positioner.style.transform)?.[1]
      )

      expect(x < TRIGGER.x + TRIGGER.width / 2 ? 'left' : 'right').toBe(
        expected
      )
    }
  )
})
