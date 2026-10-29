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
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePagination } from '@/components/data-table'
import { PaginationFrame } from '@/components/pagination-frame'
import { StatusBadge } from '@/components/status-badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { SubscriptionQuotaSummary } from '@/features/subscriptions/components/subscription-quota-summary'
import type { UserSubscriptionRecord } from '@/features/subscriptions/types'
import { toIntlLocale } from '@/i18n/languages'

const subscriptionColumns: ColumnDef<UserSubscriptionRecord>[] = []

type Props = {
  subscriptions: UserSubscriptionRecord[]
  planTitles: Map<number, string>
}

export function WalletSubscriptionsList(props: Props) {
  const { t, i18n } = useTranslation()
  const now = Date.now() / 1000
  const subscriptions = useMemo(() => {
    const currentTime = Date.now() / 1000
    return [...props.subscriptions].sort(
      (a, b) =>
        Number(
          b.subscription.status === 'active' &&
            b.subscription.end_time > currentTime
        ) -
        Number(
          a.subscription.status === 'active' &&
            a.subscription.end_time > currentTime
        )
    )
  }, [props.subscriptions])
  const table = useReactTable({
    data: subscriptions,
    columns: subscriptionColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => String(row.subscription.id),
    initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
  })
  const formatter = new Intl.DateTimeFormat(
    toIntlLocale(i18n.resolvedLanguage || i18n.language),
    {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }
  )
  return (
    <PaginationFrame
      resetKey={subscriptions}
      pageIndex={table.getState().pagination.pageIndex}
      pagination={
        table.getPageCount() > 1 && (
          <div role='navigation' aria-label={t('My Subscriptions')}>
            <DataTablePagination table={table} compact />
          </div>
        )
      }
    >
      <Accordion
        key={table.getState().pagination.pageIndex}
        multiple={false}
        defaultValue={
          subscriptions.length === 1
            ? [String(subscriptions[0].subscription.id)]
            : []
        }
      >
        {table.getRowModel().rows.map(({ original: record }) => {
          const sub = record.subscription
          const active = sub.status === 'active' && sub.end_time > now
          const cancelled = sub.status === 'cancelled'
          const nextResetTime = sub.next_reset_time ?? 0
          const title = props.planTitles.get(sub.plan_id)
          const total = sub.amount_total
          const used = sub.amount_used
          let status = t('Expired')
          let endLabel = t('Expired at')
          if (active) {
            status = t('Active')
            endLabel = t('Expires at')
          } else if (cancelled) {
            status = t('Cancelled')
            endLabel = t('Cancelled at')
          }
          const subscriptionLabel = `${t('Subscription')} #${sub.id}`
          const remainingLabel = active
            ? t('{{count}} days remaining', {
                count: Math.max(0, Math.ceil((sub.end_time - now) / 86400)),
              })
            : ''
          const accessibleLabel = [
            title,
            subscriptionLabel,
            status,
            remainingLabel,
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <AccordionItem key={sub.id} value={String(sub.id)}>
              <AccordionTrigger
                aria-label={accessibleLabel}
                className='min-w-0 items-center gap-2 py-3 hover:no-underline'
              >
                <span className='flex min-w-0 flex-1 items-center gap-2'>
                  <span className='flex min-w-0 flex-1 items-center gap-1.5'>
                    <span
                      data-slot='subscription-name'
                      className='min-w-0 truncate text-sm leading-5 font-medium'
                    >
                      {title || t('Subscription')}
                    </span>
                    <span className='text-muted-foreground shrink-0 text-xs leading-4 tabular-nums'>
                      #{sub.id}
                    </span>
                  </span>
                  <StatusBadge
                    label={status}
                    variant={active ? 'success' : 'neutral'}
                    copyable={false}
                    className='shrink-0'
                  />
                  {active && (
                    <span className='text-muted-foreground shrink-0 text-xs leading-4 whitespace-nowrap tabular-nums'>
                      {remainingLabel}
                    </span>
                  )}
                </span>
              </AccordionTrigger>
              <AccordionContent className='pb-4'>
                <div className='min-w-0 space-y-3'>
                  <dl className='grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-xs'>
                    <dt className='text-muted-foreground'>{endLabel}</dt>
                    <dd className='text-muted-foreground text-right tabular-nums'>
                      <time
                        dateTime={new Date(sub.end_time * 1000).toISOString()}
                      >
                        {formatter.format(new Date(sub.end_time * 1000))}
                      </time>
                    </dd>
                  </dl>
                  <SubscriptionQuotaSummary
                    total={{
                      limit: total,
                      used,
                      reset_at:
                        active && nextResetTime > 0 ? nextResetTime : undefined,
                    }}
                    windows={sub.quota_windows}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          )
        })}
      </Accordion>
    </PaginationFrame>
  )
}
