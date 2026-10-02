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
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Dialog, DialogContent, DialogTitle } from '../dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../sheet'
import { Switch } from '../switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../table'

// The close buttons are absolutely positioned over the header. A physical
// `right-*` offset puts them on top of a right-aligned RTL title.
describe('close button placement in right-to-left layouts', () => {
  it('pins the sheet close button to the inline end so it clears an RTL title', () => {
    render(
      <div dir='rtl'>
        <Sheet open>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Theme Settings</SheetTitle>
            </SheetHeader>
          </SheetContent>
        </Sheet>
      </div>
    )

    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveClass('end-3')
    expect(close).not.toHaveClass('right-3')
  })

  it('pins the dialog close button to the inline end', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Confirm</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    const close = screen.getByRole('button', { name: 'Close' })
    expect(close).toHaveClass('end-2')
    expect(close).not.toHaveClass('right-2')
  })
})

// A physical `text-left` header sits at the far side of its column in RTL,
// away from the cells below it, which start at the right.
describe('table header alignment in right-to-left layouts', () => {
  it('aligns header cells to the inline start and clears checkbox padding at the inline end', () => {
    render(
      <div dir='rtl'>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Group name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>default</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    )

    const header = screen.getByRole('columnheader', { name: 'Group name' })
    expect(header).toHaveClass('text-start')
    expect(header).not.toHaveClass('text-left')
    expect(header.className).toContain('[&:has([role=checkbox])]:pe-0')
    expect(screen.getByRole('cell', { name: 'default' }).className).toContain(
      '[&:has([role=checkbox])]:pe-0'
    )
  })
})

// The thumb of a checked switch moves along the x axis. A physical positive
// translation pushes it out of the track in RTL, where it starts at the right.
describe('switch thumb in right-to-left layouts', () => {
  it.each(['default', 'sm'] as const)(
    'moves the %s checked thumb towards the inline end in RTL',
    (size) => {
      render(
        <div dir='rtl'>
          <Switch size={size} defaultChecked aria-label='Enable filtering' />
        </div>
      )

      const thumb = screen
        .getByRole('switch', { name: 'Enable filtering' })
        .querySelector('[data-slot="switch-thumb"]')
      expect(thumb).toHaveClass(
        `group-data-[size=${size}]/switch:data-checked:translate-x-[calc(100%-2px)]`,
        `group-data-[size=${size}]/switch:data-checked:rtl:-translate-x-[calc(100%-2px)]`
      )
    }
  )
})
