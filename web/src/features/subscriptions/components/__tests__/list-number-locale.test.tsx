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
import type { CellContext, ColumnDef } from '@tanstack/react-table'
import { cleanup, render, renderHook, screen } from '@testing-library/react'
import i18next from 'i18next'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import type { PlanRecord } from '../../types'
import { useSubscriptionsColumns } from '../subscriptions-columns'

const record = {
  plan: {
    id: 1,
    title: 'Pro',
    price_amount: 9.9,
    duration_unit: 'month',
    duration_value: 1,
    sort_order: 10,
    enabled: true,
  },
} as unknown as PlanRecord

function renderCell(id: string) {
  const { result } = renderHook(() => useSubscriptionsColumns())
  const column = result.current.find(
    (item) => item.id === id
  ) as ColumnDef<PlanRecord> & {
    cell: (context: unknown) => ReactNode
  }
  const context = { row: { original: record } } as unknown as CellContext<
    PlanRecord,
    unknown
  >
  render(<>{column.cell(context)}</>)
}

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('subscriptions list numbers', () => {
  it('in English, keeps the price, validity and priority as before', async () => {
    await i18next.changeLanguage('en')
    renderCell('price')
    renderCell('duration')
    renderCell('sort_order')

    expect(screen.getByText('$9.90')).toBeInTheDocument()
    expect(screen.getByText('1 months')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('in Persian, writes the price, validity and priority with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    renderCell('price')
    renderCell('duration')
    renderCell('sort_order')

    expect(screen.getByText('$۹٫۹۰')).toBeInTheDocument()
    expect(screen.getByText('۱ months')).toBeInTheDocument()
    expect(screen.getByText('۱۰')).toBeInTheDocument()
  })
})
