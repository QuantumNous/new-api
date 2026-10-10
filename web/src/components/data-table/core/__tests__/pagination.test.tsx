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
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import i18next from 'i18next'
import { afterEach, expect, it } from 'vitest'

import { DataTablePagination } from '../pagination'

const rows = [{ id: 1 }, { id: 2 }, { id: 3 }]
const emptyRows: { id: number }[] = []
const manyRows = Array.from({ length: 2468 }, (_, index) => ({ id: index }))

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

function Fixture(props: {
  empty?: boolean
  compact?: boolean
  many?: boolean
  pageSize?: number
}) {
  let data = rows
  if (props.empty) data = emptyRows
  if (props.many) data = manyRows
  const table = useReactTable({
    data,
    columns: [{ accessorKey: 'id' }],
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageIndex: 0, pageSize: props.pageSize ?? 2 },
    },
  })
  return <DataTablePagination table={table} compact={props.compact} />
}
it('moves between pages in compact mode and disables the boundary actions', async () => {
  const user = userEvent.setup()
  render(<Fixture compact />)
  expect(screen.getByText('1 / 2')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Go to previous page' })
  ).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Go to next page' }))
  expect(screen.getByText('2 / 2')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled()
  await user.click(screen.getByRole('button', { name: 'Go to previous page' }))
  expect(screen.getByText('1 / 2')).toBeVisible()
})
it('shows a valid empty page with navigation disabled', () => {
  render(<Fixture empty compact />)
  expect(screen.getByText('1 / 1')).toBeVisible()
  expect(
    screen.getByRole('button', { name: 'Go to previous page' })
  ).toBeDisabled()
  expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled()
})
it('keeps page size selection available in the default layout', () => {
  render(<Fixture />)
  expect(screen.getByRole('combobox')).toBeVisible()
})
it('in English, keeps the compact page counter as plain digits without grouping', async () => {
  await i18next.changeLanguage('en')
  render(<Fixture compact many />)
  expect(screen.getByText('1 / 1234')).toBeVisible()
})
it('in Persian, writes the compact page counter with Persian digits', async () => {
  await i18next.changeLanguage('fa')
  render(<Fixture compact many />)
  expect(screen.getByText('۱ / ۱۲۳۴')).toBeVisible()
})
it.each([
  { layout: 'compact', compact: true },
  { layout: 'default', compact: false },
])(
  'in English, keeps the $layout row total grouped as before',
  async ({ compact }) => {
    await i18next.changeLanguage('en')
    render(<Fixture compact={compact} many />)
    expect(screen.getByText(/(^| )2,468$/)).toBeVisible()
  }
)
it.each([
  { layout: 'compact', compact: true },
  { layout: 'default', compact: false },
])(
  'in Persian, writes the $layout row total with Persian digits',
  async ({ compact }) => {
    await i18next.changeLanguage('fa')
    render(<Fixture compact={compact} many />)
    expect(screen.getByText(/(^| )۲٬۴۶۸$/)).toBeVisible()
  }
)
it.each([
  { language: 'English', lng: 'en', pages: ['1', '2', '247'] },
  { language: 'Persian', lng: 'fa', pages: ['۱', '۲', '۲۴۷'] },
])(
  'in $language, writes the default layout page buttons and their screen-reader text with the same digits',
  async ({ lng, pages }) => {
    await i18next.changeLanguage(lng)
    render(<Fixture many pageSize={10} />)
    for (const page of pages) {
      const button = screen.getByText(page, { selector: 'button' })
      expect(button).toBeVisible()
      expect(within(button).getByText(`Go to page ${page}`)).toBeInTheDocument()
    }
  }
)
it.each([
  {
    language: 'English',
    lng: 'en',
    sizes: ['10', '20', '30', '40', '50', '100'],
  },
  {
    language: 'Persian',
    lng: 'fa',
    sizes: ['۱۰', '۲۰', '۳۰', '۴۰', '۵۰', '۱۰۰'],
  },
])(
  'in $language, writes the selected page size and the page size options with the interface digits',
  async ({ lng, sizes }) => {
    const user = userEvent.setup()
    await i18next.changeLanguage(lng)
    render(<Fixture many pageSize={10} />)
    const select = screen.getByRole('combobox')
    expect(select).toHaveTextContent(sizes[0])
    await user.click(select)
    for (const size of sizes) {
      expect(await screen.findByRole('option', { name: size })).toBeVisible()
    }
  }
)
it('in Persian, sets the numeric page size when a Persian page size option is chosen', async () => {
  const user = userEvent.setup()
  await i18next.changeLanguage('fa')
  render(<Fixture many pageSize={10} />)
  await user.click(screen.getByRole('combobox'))
  await user.click(await screen.findByRole('option', { name: '۵۰' }))
  expect(screen.getByRole('combobox')).toHaveTextContent('۵۰')
  expect(screen.getByText('۵۰', { selector: 'button' })).toBeVisible()
})
