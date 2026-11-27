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
import { act, cleanup, render, screen } from '@testing-library/react'
import { createInstance } from 'i18next'
import { useMemo } from 'react'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SubscriptionPlansCard } from '@/features/wallet/components/subscription-plans-card'
import en from '@/i18n/locales/en.json'
import zh from '@/i18n/locales/zh.json'
import { api } from '@/lib/api'

import type { PlanRecord } from '../../types'
import { SubscriptionPurchaseDialog } from '../dialogs/subscription-purchase-dialog'
import { useSubscriptionsColumns } from '../subscriptions-columns'

const i18n = createInstance()
let queryClient: QueryClient

type Surface = 'wallet card' | 'purchase dialog' | 'plan columns'

function PlanColumns(props: { plan: PlanRecord }) {
  const allColumns = useSubscriptionsColumns()
  const columns = useMemo(
    () =>
      allColumns.filter((column) =>
        ['total_amount', 'upgrade_group', 'quota_usable_groups'].includes(
          column.id ?? ''
        )
      ),
    [allColumns]
  )
  const data = useMemo(() => [props.plan], [props.plan])
  const table = useReactTable({
    columns,
    data,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((group) => (
          <tr key={group.id}>
            {group.headers.map((header) => (
              <th key={header.id}>
                {flexRender(
                  header.column.columnDef.header,
                  header.getContext()
                )}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map((row) => (
          <tr key={row.id}>
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

function renderPlan(surface: Surface, quotaUsableGroups?: string) {
  const plan: PlanRecord = {
    plan: {
      id: 1,
      title: 'Monthly subscription',
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
      total_amount: 500000,
      upgrade_group: 'premium-access',
      quota_usable_groups: quotaUsableGroups,
    },
  }
  vi.spyOn(api, 'get').mockImplementation(async (url) => {
    if (url === '/api/subscription/plans') {
      return { data: { success: true, data: [plan] } }
    }
    if (url === '/api/subscription/self') {
      return {
        data: {
          success: true,
          data: {
            billing_preference: 'subscription_first',
            subscriptions: [],
            all_subscriptions: [],
          },
        },
      }
    }
    throw new Error(`Unexpected request: ${url}`)
  })

  let content = <PlanColumns plan={plan} />
  if (surface === 'wallet card') {
    content = <SubscriptionPlansCard topupInfo={null} />
  } else if (surface === 'purchase dialog') {
    content = (
      <SubscriptionPurchaseDialog open onOpenChange={vi.fn()} plan={plan} />
    )
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{content}</I18nextProvider>
    </QueryClientProvider>
  )
}

beforeEach(async () => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  await i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: false,
    nsSeparator: false,
    resources: { en, zh },
    interpolation: { escapeValue: false },
  })
})

afterEach(() => {
  cleanup()
  queryClient.clear()
})

describe.each<Surface>(['wallet card', 'purchase dialog', 'plan columns'])(
  '%s quota usable groups',
  (surface) => {
    it.each([
      { name: 'missing', value: undefined, expected: ['All Groups'] },
      { name: 'empty', value: '', expected: ['All Groups'] },
      { name: 'whitespace only', value: ' \t\n ', expected: ['All Groups'] },
      {
        name: 'empty comma entries',
        value: ', ,\t,',
        expected: ['All Groups'],
      },
      { name: 'single group', value: 'default', expected: ['default'] },
      {
        name: 'multiple groups',
        value: 'default,vip,research',
        expected: ['default', 'vip', 'research'],
      },
      {
        name: 'padded groups and empty entries',
        value: ' default , , team east ,\t vip \n',
        expected: ['default', 'team east', 'vip'],
      },
    ])(
      'shows every usable group for $name without confusing upgrade access',
      async ({ value, expected }) => {
        renderPlan(surface, value)

        expect(await screen.findByText(/^Quota Usable Groups:?$/)).toBeVisible()
        for (const label of expected) {
          expect(screen.getByText(label, { exact: true })).toBeVisible()
        }
        expect(screen.getByText(/premium-access/)).toBeVisible()
        expect(
          screen.queryByText('User Group', { exact: true })
        ).not.toBeInTheDocument()
        expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument()
        if (expected[0] !== 'All Groups') {
          expect(screen.queryByText('All Groups')).not.toBeInTheDocument()
        }
      }
    )

    it('keeps long unbroken names complete and allows badges to wrap within available width', async () => {
      const longName = 'enterpriseproductionrestrictedgroupname'.repeat(6)
      renderPlan(surface, `${longName},research`)

      const label = await screen.findByText(longName, { exact: true })
      expect(label).toBeVisible()
      expect(label).toHaveClass('wrap-anywhere')
      expect(label).not.toHaveClass('truncate')
      const badge = label.closest('[data-slot="status-badge"]')
      expect(badge).toHaveClass('max-w-full', 'h-auto', 'whitespace-normal')
      expect(badge?.parentElement).toHaveClass('min-w-0', 'flex-wrap')
      expect(screen.getByText('research')).toBeVisible()
    })

    it('updates the scope label and unrestricted fallback when the language changes', async () => {
      renderPlan(surface, ' ')
      expect(await screen.findByText('All Groups')).toBeVisible()

      await act(() => i18n.changeLanguage('zh'))

      expect(
        screen.getByText(
          new RegExp(`^${zh.translation['Quota Usable Groups']}:?$`)
        )
      ).toBeVisible()
      expect(screen.getByText(zh.translation['All Groups'])).toBeVisible()
      expect(screen.queryByText('All Groups')).not.toBeInTheDocument()
    })
  }
)
