import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'

import { SurfaceThemeContext } from '@/context/surface-theme-context'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../dropdown-menu'
import { Popover, PopoverContent } from '../popover'

test('open portaled menus follow the local surface without changing the page theme', () => {
  const content = (
    <>
      <DropdownMenu open>
        <DropdownMenuContent>
          <DropdownMenuItem>Language choice</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Popover open>
        <PopoverContent>Notifications panel</PopoverContent>
      </Popover>
    </>
  )
  const { rerender, container } = render(
    <SurfaceThemeContext value='dark'>{content}</SurfaceThemeContext>
  )
  const menu = screen.getByRole('menuitem', { name: 'Language choice' })
  const panel = screen.getByText('Notifications panel')
  expect(container).not.toContainElement(menu)
  expect(menu.closest('.dark')).not.toBeNull()
  expect(panel.closest('.dark')).not.toBeNull()
  expect(document.documentElement).not.toHaveClass('dark')
  rerender(
    <SurfaceThemeContext value={undefined}>{content}</SurfaceThemeContext>
  )
  expect(menu.closest('.dark')).toBeNull()
  expect(panel.closest('.dark')).toBeNull()
})
