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
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useMemo } from 'react'
import { assert, expect, test } from 'vitest'

import { aggregateChannelsByTag, type TagRow } from '../../lib/channel-utils'
import { channelSchema, type Channel } from '../../types'
import { useChannelsColumns } from '../channels-columns'
import { ChannelsProvider } from '../channels-provider'

function ExampleStatusCell(props: { channel: Channel }) {
  const data = useMemo(() => [props.channel], [props.channel])
  const table = useReactTable({
    data,
    columns: useChannelsColumns({ enableSelection: false }),
    getCoreRowModel: getCoreRowModel(),
  })
  const cell = table
    .getRowModel()
    .rows[0]?.getAllCells()
    .find((item) => item.column.id === 'status')

  return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null
}

test('keeps the long string inside the status tooltip is wrapped when show', async () => {
  const reason = '114514'.repeat(40)
  const channelItem = channelSchema.parse({
    id: 1,
    type: 1,
    key: 'test-key',
    name: 'Test-Channel-Item',
    status: 3,
    created_time: 1,
    test_time: 0,
    response_time: 0,
    balance_updated_time: 0,
    other_info: JSON.stringify({ status_reason: reason }),
  })
  const queryClient = new QueryClient()
  const user = userEvent.setup()

  render(
    <QueryClientProvider client={queryClient}>
      <ChannelsProvider>
        <ExampleStatusCell channel={channelItem} />
      </ChannelsProvider>
    </QueryClientProvider>
  )

  await user.hover(screen.getByText('Auto Disabled'))

  expect(await screen.findByText(reason, { exact: false })).toHaveClass(
    'wrap-anywhere'
  )
})

function tagRow(statuses: number[]): TagRow {
  const channel = channelSchema.parse({
    id: 1,
    type: 1,
    key: '',
    name: 'Test channel',
    tag: 'Test tag',
    status: 0,
    created_time: 0,
    test_time: 0,
    response_time: 0,
    balance_updated_time: 0,
  })
  const channels = statuses.map((status, index) => ({
    ...channel,
    id: index + 1,
    status,
  }))
  const row = aggregateChannelsByTag(channels)[0]
  assert(row && 'children' in row)
  return row
}

test.each([
  {
    scenario: 'all enabled channels',
    statuses: [1, 1],
    label: 'Active (2)',
    counts: [2, 2, 0, 0],
  },
  {
    scenario: 'mixed channel statuses',
    statuses: [2, 3, 1, 1, 3],
    label: 'Active (2)',
    counts: [5, 2, 1, 2],
  },
  {
    scenario: 'mixed disabled channels',
    statuses: [2, 3],
    label: 'Inactive (2)',
    counts: [2, 0, 1, 1],
  },
])(
  'shows the enabled count or fully disabled total',
  async ({ statuses, label, counts }) => {
    const user = userEvent.setup()
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ChannelsProvider>
          <ExampleStatusCell channel={tagRow(statuses)} />
        </ChannelsProvider>
      </QueryClientProvider>
    )

    expect(screen.getByTitle(label).textContent).toBe(label)
    expect(screen.getByTitle(label)).toHaveClass(
      label.startsWith('Inactive') ? 'text-destructive' : 'text-success'
    )
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    await user.hover(screen.getByText(label))
    const tooltip = await screen.findByRole('tooltip')
    expect(
      within(tooltip)
        .getAllByRole('term')
        .map((item) => item.textContent)
    ).toEqual(['Total', 'Enabled', 'Disabled', 'Auto Disabled'])
    expect(
      within(tooltip)
        .getAllByRole('definition')
        .map((item) => item.textContent)
    ).toEqual(counts.map(String))
  }
)

test('updates the badge count when refreshed channels become enabled or disabled', async () => {
  const user = userEvent.setup()
  const client = new QueryClient()
  const view = (statuses: number[]) => (
    <QueryClientProvider client={client}>
      <ChannelsProvider>
        <ExampleStatusCell channel={tagRow(statuses)} />
      </ChannelsProvider>
    </QueryClientProvider>
  )
  const { rerender } = render(view([1, 2, 3]))
  expect(screen.getByText('Active (1)')).toBeVisible()
  await user.hover(screen.getByText('Active (1)'))
  const tooltip = await screen.findByRole('tooltip')
  expect(
    within(tooltip)
      .getAllByRole('definition')
      .map((item) => item.textContent)
  ).toEqual(['3', '1', '1', '1'])

  rerender(view([2, 2, 3, 3]))
  expect(screen.getByText('Inactive (4)')).toBeVisible()
  const disabledTooltip = screen.getByRole('tooltip')
  expect(
    within(disabledTooltip)
      .getAllByRole('definition')
      .map((item) => item.textContent)
  ).toEqual(['4', '0', '2', '2'])

  rerender(view([1, 1, 2, 3]))
  expect(screen.getByText('Active (2)')).toBeVisible()
  const enabledTooltip = screen.getByRole('tooltip')
  expect(
    within(enabledTooltip)
      .getAllByRole('definition')
      .map((item) => item.textContent)
  ).toEqual(['4', '2', '1', '1'])
})

test('opens the group status breakdown with keyboard focus', async () => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChannelsProvider>
        <ExampleStatusCell channel={tagRow([1, 2, 3])} />
      </ChannelsProvider>
    </QueryClientProvider>
  )

  await user.tab()

  expect(await screen.findByRole('tooltip')).toBeVisible()
  expect(document.activeElement).toHaveAccessibleDescription(
    'Total 3 Enabled 1 Disabled 1 Auto Disabled 1'
  )

  await user.keyboard('{Escape}')
  await waitFor(() =>
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  )
})

test('aligns hovered group status labels and right-aligned counts in two columns', async () => {
  const user = userEvent.setup()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ChannelsProvider>
        <ExampleStatusCell channel={tagRow([1, 2, 3])} />
      </ChannelsProvider>
    </QueryClientProvider>
  )

  await user.hover(screen.getByText('Active (1)'))

  const tooltip = await screen.findByRole('tooltip')
  expect(tooltip.querySelector('dl')).toHaveClass(
    'grid',
    'grid-cols-[max-content_minmax(0,1fr)]'
  )
  for (const definition of within(tooltip).getAllByRole('definition')) {
    expect(definition).toHaveClass('text-right')
  }
})
