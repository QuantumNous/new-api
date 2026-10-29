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
import { cleanup, render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { BillingHistoryDialog } from '../dialogs/billing-history-dialog'

// Third page of 1234 records, ten per page.
vi.mock('../../hooks/use-billing-history', () => ({
  useBillingHistory: () => ({
    records: [
      {
        id: 1,
        user_id: 2,
        amount: 500_000,
        money: 1,
        trade_no: 'trade-1',
        payment_method: 'stripe',
        create_time: 1_750_000_000,
        status: 'success',
      },
    ],
    total: 1234,
    page: 3,
    pageSize: 10,
    keyword: '',
    loading: false,
    completing: false,
    isAdmin: false,
    handlePageChange: vi.fn(),
    handlePageSizeChange: vi.fn(),
    handleSearch: vi.fn(),
    handleCompleteOrder: vi.fn(),
  }),
}))

afterEach(async () => {
  cleanup()
  await i18next.changeLanguage('en')
})

describe('billing history pager', () => {
  it.each([
    {
      language: 'English',
      lng: 'en',
      range: 'Showing 21-30 of 1234',
      pages: ['3', '124'],
    },
    {
      language: 'Persian',
      lng: 'fa',
      range: 'Showing ۲۱-۳۰ of ۱۲۳۴',
      pages: ['۳', '۱۲۴'],
    },
  ])(
    'in $language, writes the shown range and the page counter in the interface digits',
    async ({ lng, range, pages }) => {
      await i18next.changeLanguage(lng)
      render(<BillingHistoryDialog open onOpenChange={() => undefined} />)
      expect(screen.getByText(range)).toBeInTheDocument()
      for (const page of pages) {
        expect(screen.getByText(page)).toBeInTheDocument()
      }
    }
  )
})
