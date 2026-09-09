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
} from '@tanstack/react-table'
import { render, renderHook, screen } from '@testing-library/react'
import { createElement } from 'react'
import { expect, test } from 'vitest'

import { UsageLogsMobileList } from '../components/usage-logs-mobile-card'

test('task mobile summary displays each available field', () => {
  const row = {
    submit_time: '2026-09-09 12:00',
    user: 'alice',
    plugin: 'video-plugin',
    channel_id: 'channel-42',
    duration: '12 seconds',
    progress: '100%',
    artifacts: 'video.mp4',
  }
  const { result } = renderHook(() =>
    useReactTable<typeof row>({
      data: [row],
      columns: Object.keys(row).map<ColumnDef<typeof row>>((accessorKey) => ({
        accessorKey,
        cell: (context) => context.getValue<string>(),
      })),
      getCoreRowModel: getCoreRowModel(),
    })
  )

  render(
    createElement(UsageLogsMobileList<typeof row>, {
      table: result.current,
      logCategory: 'task',
    })
  )

  for (const value of Object.values(row)) {
    expect(screen.getByText(value)).toBeVisible()
  }
})
