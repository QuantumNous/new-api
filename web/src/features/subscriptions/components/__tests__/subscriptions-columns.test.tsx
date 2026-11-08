/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { render, screen } from '@testing-library/react'
import { expect, it } from 'vitest'

import type { PlanRecord } from '../../types'
import { useSubscriptionsColumns } from '../subscriptions-columns'

function PlanTitleCell(props: { plan: PlanRecord; column?: string }) {
  const table = useReactTable({
    data: [props.plan],
    columns: useSubscriptionsColumns().filter(
      (column) => column.id === (props.column || 'title')
    ),
    getCoreRowModel: getCoreRowModel(),
  })
  const cell = table.getRowModel().rows[0]?.getAllCells()[0]
  return cell ? flexRender(cell.column.columnDef.cell, cell.getContext()) : null
}

it('shows the current plan version beneath the plan title', () => {
  render(
    <PlanTitleCell
      plan={{
        version: 4,
        plan: {
          id: 10,
          title: 'Weekly plan',
          price_amount: 10,
          currency: 'USD',
          duration_unit: 'month',
          duration_value: 1,
          quota_reset_period: 'never',
          enabled: true,
          sort_order: 0,
          allow_balance_pay: true,
          allow_wallet_overflow: true,
          max_purchase_per_user: 0,
          total_amount: 500_000,
          window_amount: 0,
          quota_model_version: 1,
        },
      }}
    />
  )

  expect(screen.getByText('Weekly plan')).toBeInTheDocument()
  expect(screen.getByText(/Version 4/)).toBeInTheDocument()
})

it('uses the legacy cycle limit as the window quota', () => {
  render(<PlanTitleCell column='total_amount' plan={{ plan: {
    id: 10, title: 'Legacy', price_amount: 10, currency: 'USD',
    duration_unit: 'month', duration_value: 1, quota_reset_period: 'weekly',
    enabled: true, sort_order: 0, allow_balance_pay: true,
    allow_wallet_overflow: true, max_purchase_per_user: 0,
    total_amount: 500_000, window_amount: 0, quota_model_version: 0,
  } }} />)
  expect(screen.getByText(/Window quota/)).toHaveTextContent('$1 / Window quota: $1')
})
