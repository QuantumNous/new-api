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
import type { CellContext, ColumnDef } from '@tanstack/react-table'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, expect, it } from 'vitest'

import type { Channel } from '../../types'
import { useChannelsColumns } from '../channels-columns'
import { ChannelsProvider } from '../channels-provider'

afterEach(() => {
  cleanup()
})

function Providers(props: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, enabled: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>
      <ChannelsProvider>{props.children}</ChannelsProvider>
    </QueryClientProvider>
  )
}

it('pulls the response time badge toward the inline start, so it lines up with its header on a right-to-left page', () => {
  const { result } = renderHook(() => useChannelsColumns(), {
    wrapper: Providers,
  })
  const column = result.current.find(
    (item) => 'accessorKey' in item && item.accessorKey === 'response_time'
  ) as ColumnDef<Channel> & { cell: (context: unknown) => ReactNode }
  const context = {
    row: { getValue: () => 456, original: { id: 1 } },
  } as unknown as CellContext<Channel, unknown>

  render(<div dir='rtl'>{column.cell(context)}</div>)

  const badge = screen.getByText('456ms').closest('[class*="-m"]')
  expect(badge).toHaveClass('-ms-1.5')
  expect(badge).not.toHaveClass('-ml-1.5')
})
