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
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { DirectionProvider } from '@/components/ui/direction'
import {
  Sidebar,
  SidebarContent,
  SidebarProvider,
  SidebarResizeHandle,
} from '@/components/ui/sidebar'

const STORAGE_KEY = 'sidebar_width'

function renderSidebar(direction: 'ltr' | 'rtl' = 'ltr') {
  const { container } = render(
    <DirectionProvider direction={direction}>
      <SidebarProvider>
        <Sidebar>
          <SidebarContent>
            <SidebarResizeHandle label='Resize sidebar' />
          </SidebarContent>
        </Sidebar>
      </SidebarProvider>
    </DirectionProvider>
  )

  const wrapper = container.querySelector<HTMLElement>(
    '[data-slot="sidebar-wrapper"]'
  )
  if (!wrapper) throw new Error('sidebar wrapper was not rendered')

  return {
    wrapper,
    handle: screen.getByRole('separator', { name: 'Resize sidebar' }),
  }
}

function widthOf(wrapper: HTMLElement): number {
  return Number.parseFloat(wrapper.style.getPropertyValue('--sidebar-width'))
}

function drag(handle: HTMLElement, fromX: number, toX: number) {
  fireEvent(
    handle,
    new MouseEvent('pointerdown', { bubbles: true, clientX: fromX, button: 0 })
  )
  fireEvent(handle, new MouseEvent('pointermove', { bubbles: true, clientX: toX }))
  fireEvent(handle, new MouseEvent('pointerup', { bubbles: true, clientX: toX }))
}

beforeEach(() => {
  localStorage.clear()
})

describe('sidebar width', () => {
  it('starts wider than the previous fixed width so long labels fit', () => {
    const { wrapper } = renderSidebar()

    expect(widthOf(wrapper)).toBe(240)
  })

  it('widens the sidebar with the right arrow key in a left-to-right layout', () => {
    const { wrapper, handle } = renderSidebar()

    fireEvent.keyDown(handle, { key: 'ArrowRight' })

    expect(widthOf(wrapper)).toBe(256)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('256')
  })

  it('widens the sidebar with the left arrow key in a right-to-left layout', () => {
    const { wrapper, handle } = renderSidebar('rtl')

    fireEvent.keyDown(handle, { key: 'ArrowLeft' })

    expect(widthOf(wrapper)).toBe(256)
  })

  it('grows when the handle is dragged towards the page edge in a left-to-right layout', () => {
    const { wrapper, handle } = renderSidebar()

    drag(handle, 200, 260)

    expect(widthOf(wrapper)).toBe(300)
  })

  it('grows when the handle is dragged towards the start edge in a right-to-left layout', () => {
    const { wrapper, handle } = renderSidebar('rtl')

    drag(handle, 200, 140)

    expect(widthOf(wrapper)).toBe(300)
  })

  it('clamps the width to the supported range', () => {
    const { wrapper, handle } = renderSidebar()

    drag(handle, 200, 2000)
    expect(widthOf(wrapper)).toBe(416)

    fireEvent.keyDown(handle, { key: 'Home' })
    expect(widthOf(wrapper)).toBe(208)
  })

  it('restores the default width on double click', () => {
    const { wrapper, handle } = renderSidebar()

    drag(handle, 200, 300)
    expect(widthOf(wrapper)).toBe(340)

    fireEvent.doubleClick(handle)

    expect(widthOf(wrapper)).toBe(240)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('240')
  })

  it('restores the width saved by a previous session', () => {
    localStorage.setItem(STORAGE_KEY, '320')

    const { wrapper } = renderSidebar()

    expect(widthOf(wrapper)).toBe(320)
  })

  it('ignores a stored width outside the supported range', () => {
    localStorage.setItem(STORAGE_KEY, '9999')

    const { wrapper } = renderSidebar()

    expect(widthOf(wrapper)).toBe(416)
  })
})
