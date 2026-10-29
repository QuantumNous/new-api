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
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { Table } from '@/components/ui/table'

import { useDataTable } from '../../hooks/use-data-table'
import { DataTableHeader } from '../data-table-header'

type Row = { name: string }

const rows: Row[] = [{ name: 'alpha' }]

function Fixture() {
  const { table } = useDataTable<Row>({
    data: rows,
    columns: [{ accessorKey: 'name', header: 'Name', size: 150 }],
    enableColumnResizing: true,
  })
  return (
    <Table>
      <DataTableHeader table={table} applyHeaderSize />
    </Table>
  )
}

function renderHeader(direction: 'ltr' | 'rtl') {
  render(
    <DirectionProvider direction={direction}>
      <div dir={direction}>
        <Fixture />
      </div>
    </DirectionProvider>
  )
  return {
    resizer: screen.getByRole('separator', { name: 'Resize column' }),
    header: screen.getByRole('columnheader', { name: /Name/ }),
  }
}

describe('column resizing direction', () => {
  it('widens a column with ArrowRight in a left-to-right layout', async () => {
    const user = userEvent.setup()
    const { resizer, header } = renderHeader('ltr')

    resizer.focus()
    await user.keyboard('{ArrowRight}')

    expect(header).toHaveStyle({ width: '160px' })
  })

  it('widens a column with ArrowLeft in a right-to-left layout, where the resizer is on the left edge', async () => {
    const user = userEvent.setup()
    const { resizer, header } = renderHeader('rtl')

    resizer.focus()
    await user.keyboard('{ArrowLeft}')

    expect(header).toHaveStyle({ width: '160px' })
    expect(resizer).toHaveClass('end-0')
    expect(resizer).not.toHaveClass('right-0')
  })

  it('narrows a column with ArrowRight in a right-to-left layout', async () => {
    const user = userEvent.setup()
    const { resizer, header } = renderHeader('rtl')

    resizer.focus()
    await user.keyboard('{ArrowRight}')

    expect(header).toHaveStyle({ width: '140px' })
  })
})
