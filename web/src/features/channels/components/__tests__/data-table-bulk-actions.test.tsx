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
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type Row,
  type RowSelectionState,
} from '@tanstack/react-table'
import { fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { describe, expect, test, vi } from 'vitest'

import { handleBatchEnable } from '../../lib'
import { DataTableBulkActions } from '../data-table-bulk-actions'

vi.mock('../../lib', () => ({
  handleBatchDelete: vi.fn(),
  handleBatchDisable: vi.fn(),
  handleBatchEnable: vi.fn(),
  handleBatchSetTag: vi.fn(),
}))

// Regression test for issue #6885: in tag mode channels are subRows of tag
// rows, so batch actions must collect ids from flatRows — a selected nested
// channel id has to reach the batch handler, not just make the toolbar show.

type ChannelRow = {
  id?: number
  name: string
  children?: ChannelRow[]
}

const columns: ColumnDef<ChannelRow>[] = [
  { id: 'name', accessorFn: (row) => row.name },
]

function Harness({
  data,
  initialSelection,
}: {
  data: ChannelRow[]
  initialSelection: RowSelectionState
}): ReactElement {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) =>
      row.children ? `tag:${row.name}` : `channel:${row.id}`,
    getSubRows: (row) => row.children,
    // Mirrors the channels table in tag mode: tag (parent) rows are not
    // selectable, channel (leaf) rows are.
    enableRowSelection: (row: Row<ChannelRow>) =>
      !Array.isArray(row.original.children),
    initialState: { rowSelection: initialSelection },
  })

  return <DataTableBulkActions table={table} />
}

const treeData: ChannelRow[] = [
  {
    name: 'alpha',
    children: [
      { id: 42, name: 'channel one' },
      { id: 43, name: 'channel two' },
    ],
  },
]

describe('channels DataTableBulkActions', () => {
  test('batch enable receives the id of a channel selected as a subRow (issue #6885)', () => {
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <Harness
          data={treeData}
          initialSelection={{ 'channel:42': true }}
        />
      </QueryClientProvider>
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Enable selected channels' })
    )

    expect(handleBatchEnable).toHaveBeenCalledTimes(1)
    expect(handleBatchEnable).toHaveBeenCalledWith(
      [42],
      queryClient,
      expect.any(Function)
    )
  })
})
