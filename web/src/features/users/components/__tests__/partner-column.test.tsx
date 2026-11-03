/*
Copyright (C) 2023-2026 QuantumNous
*/
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen, within } from '@testing-library/react'
import { expect, it } from 'vitest'

import type { User } from '../../types'
import { useUsersColumns } from '../users-columns'

const baseUser = {
  display_name: '',
  role: 1,
  status: 1,
  quota: 0,
  used_quota: 0,
  request_count: 0,
  group: 'default',
}

function PartnerColumn(props: { users: User[] }) {
  const columns = useUsersColumns().filter((column) => column.id === 'partner')
  const table = useReactTable({
    columns,
    data: props.users,
    getCoreRowModel: getCoreRowModel(),
  })
  return (
    <table>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id} data-testid={row.original.username}>
            {row.getVisibleCells().map((cell) => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

it('marks a partner sub-account with its partner name and leaves other users blank', () => {
  render(
    <PartnerColumn
      users={[
        {
          ...baseUser,
          id: 1,
          username: 'pa_subaccount',
          partner_client_id: 'pc_0123456789abcdef0123456789abcdef',
          partner_client_name: 'Kede Finance',
        } as User,
        { ...baseUser, id: 2, username: 'regular-user' } as User,
      ]}
    />
  )

  const badge = within(screen.getByTestId('pa_subaccount')).getByText(
    'Kede Finance'
  )
  expect(badge).toBeVisible()
  expect(badge.closest('[title]')).toHaveAttribute(
    'title',
    'Partner sub-account'
  )
  expect(screen.getByTestId('regular-user')).toHaveTextContent('')
})
