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

import type { Redemption } from '../../types'
import { useRedemptionsColumns } from '../redemptions-columns'

// Persian currency amounts from Intl start with a left-to-right mark.
const LRM = '‎'

// 500000 quota units are $1 with the default currency settings.
const quota = 1_000_000

function renderQuotaCell(): void {
  const { result } = renderHook(() => useRedemptionsColumns())
  const column = result.current.find(
    (item) => 'accessorKey' in item && item.accessorKey === 'quota'
  ) as ColumnDef<Redemption> & { cell: (context: unknown) => ReactNode }
  const context = {
    row: { getValue: () => quota },
  } as unknown as CellContext<Redemption, unknown>
  render(<>{column.cell(context)}</>)
}

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('redemption code quota', () => {
  it('in English, keeps the quota amount as before', async () => {
    await i18next.changeLanguage('en')
    renderQuotaCell()
    expect(screen.getByText('$2')).toBeInTheDocument()
  })

  it('in Persian, writes the quota amount with Persian digits', async () => {
    await i18next.changeLanguage('fa')
    renderQuotaCell()
    expect(screen.getByText(`${LRM}$۲`)).toBeInTheDocument()
  })
})
