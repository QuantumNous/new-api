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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '../context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '../dropdown-menu'
import { SidebarMenuButton, SidebarProvider } from '../sidebar'

// Sub-menus and the collapsed sidebar's tooltips open beside their trigger,
// towards the reading direction: to the right in LTR, to the left in RTL.
// JSDOM has no layout, so the trigger box and the viewport are stubbed and
// the real positioning code places the popup.
const TRIGGER = { x: 400, y: 100, width: 200, height: 30 }

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: Element) {
      return this.matches('[data-testid="anchor"]')
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

async function sideOfTrigger(popup: Element): Promise<'left' | 'right'> {
  const positioner = popup.parentElement as HTMLElement
  // The positioner sits at the origin until the popup has been placed.
  await waitFor(() =>
    expect(positioner.style.transform).not.toBe('translate(0px, 0px)')
  )
  const x = Number(
    /translate\((-?[\d.]+)px/.exec(positioner.style.transform)?.[1]
  )
  return x < TRIGGER.x + TRIGGER.width / 2 ? 'left' : 'right'
}

const DIRECTIONS = [
  ['ltr', 'right'],
  ['rtl', 'left'],
] as const

describe('dropdown sub-menu side', () => {
  function renderSubMenu(dir: 'ltr' | 'rtl') {
    render(
      <DirectionProvider direction={dir}>
        <DropdownMenu open>
          <DropdownMenuContent>
            <DropdownMenuSub open>
              <DropdownMenuSubTrigger data-testid='anchor'>
                Export
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>CSV</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </DirectionProvider>
    )
    return screen.getByRole('menuitem', { name: 'CSV' }).closest('[role=menu]')!
  }

  it.each(DIRECTIONS)(
    'opens the sub-menu towards the reading direction in %s, to the %s',
    async (dir, expected) => {
      expect(await sideOfTrigger(renderSubMenu(dir))).toBe(expected)
    }
  )

  it('slides the sub-menu in from its trigger in both directions', () => {
    expect(renderSubMenu('rtl')).toHaveClass(
      'rtl:data-[side=inline-end]:slide-in-from-right-2',
      'rtl:data-[side=inline-start]:slide-in-from-left-2'
    )
  })
})

describe('context sub-menu side', () => {
  function renderSubMenu(dir: 'ltr' | 'rtl') {
    render(
      <DirectionProvider direction={dir}>
        <ContextMenu open>
          <ContextMenuContent>
            <ContextMenuSub open>
              <ContextMenuSubTrigger data-testid='anchor'>
                Export
              </ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem>CSV</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuContent>
        </ContextMenu>
      </DirectionProvider>
    )
    return screen.getByRole('menuitem', { name: 'CSV' }).closest('[role=menu]')!
  }

  it.each(DIRECTIONS)(
    'opens the sub-menu towards the reading direction in %s, to the %s',
    async (dir, expected) => {
      expect(await sideOfTrigger(renderSubMenu(dir))).toBe(expected)
    }
  )

  it('slides the sub-menu in from its trigger in both directions', () => {
    expect(renderSubMenu('rtl')).toHaveClass(
      'rtl:data-[side=inline-end]:slide-in-from-right-2',
      'rtl:data-[side=inline-start]:slide-in-from-left-2'
    )
  })
})

describe('collapsed sidebar tooltip side', () => {
  async function hoverMenuButton(dir: 'ltr' | 'rtl') {
    render(
      <DirectionProvider direction={dir}>
        <SidebarProvider defaultOpen={false}>
          <SidebarMenuButton tooltip='Channels' data-testid='anchor'>
            <span>Channels</span>
          </SidebarMenuButton>
        </SidebarProvider>
      </DirectionProvider>
    )
    await userEvent.hover(screen.getByRole('button', { name: 'Channels' }))
    return (await screen.findByText('Channels', {
      selector: '[data-slot="tooltip-content"]',
    }))!
  }

  it.each(DIRECTIONS)(
    'shows the tooltip towards the reading direction in %s, to the %s',
    async (dir, expected) => {
      expect(await sideOfTrigger(await hoverMenuButton(dir))).toBe(expected)
    }
  )

  it('slides the tooltip in from its trigger in both directions', async () => {
    expect(await hoverMenuButton('rtl')).toHaveClass(
      'rtl:data-[side=inline-end]:slide-in-from-right-2',
      'rtl:data-[side=inline-start]:slide-in-from-left-2'
    )
  })
})
