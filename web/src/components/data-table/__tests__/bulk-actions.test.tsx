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
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import { describe, expect, test } from 'vitest'

import { DataTableBulkActions } from '../toolbar/bulk-actions'

// Regression tests for issue #6885: with tag mode + batch mode enabled on the
// channels table, selecting channels never showed the bulk-actions toolbar.
// Tag mode turns the data into a tree (tag rows on top, channels as subRows)
// and tag rows are not selectable, so every selected row is a subRow. The
// toolbar must count selected subRows too, not only selected top-level rows.

type TreeRow = {
  id: string
  label: string
  children?: TreeRow[]
}

const columns: ColumnDef<TreeRow>[] = [
  { id: 'label', accessorFn: (row) => row.label },
]

function Harness({
  data,
  initialSelection,
}: {
  data: TreeRow[]
  initialSelection: RowSelectionState
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    // Mirrors the channels table in tag mode: aggregate (parent) rows are not
    // selectable, leaf rows are. See channels-table.tsx enableRowSelection.
    enableRowSelection: (row: Row<TreeRow>) =>
      !Array.isArray(row.original.children),
    initialState: { rowSelection: initialSelection },
  })

  return (
    <DataTableBulkActions table={table} entityName='channel'>
      <button type='button'>bulk action</button>
    </DataTableBulkActions>
  )
}

const treeData: TreeRow[] = [
  {
    id: 'tag:alpha',
    label: 'alpha',
    children: [
      { id: 'channel:1', label: 'channel one' },
      { id: 'channel:2', label: 'channel two' },
    ],
  },
]

const flatData: TreeRow[] = [
  { id: 'channel:1', label: 'channel one' },
  { id: 'channel:2', label: 'channel two' },
]

describe('DataTableBulkActions selection counting', () => {
  test('shows the toolbar when only a subRow of a tree table is selected (issue #6885)', () => {
    render(<Harness data={treeData} initialSelection={{ 'channel:1': true }} />)

    const toolbar = screen.getByRole('toolbar')
    expect(toolbar).toHaveAccessibleName('Bulk actions for 1 selected channel')
  })

  test('still shows the toolbar for a selected top-level row in a flat table', () => {
    render(<Harness data={flatData} initialSelection={{ 'channel:1': true }} />)

    const toolbar = screen.getByRole('toolbar')
    expect(toolbar).toHaveAccessibleName('Bulk actions for 1 selected channel')
  })

  test('renders nothing when no row is selected', () => {
    render(<Harness data={treeData} initialSelection={{}} />)

    expect(screen.queryByRole('toolbar')).toBeNull()
  })
})
