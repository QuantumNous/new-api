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
import { useQuery } from '@tanstack/react-query'
import { HandCoins } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTimestamp } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getSelfAffiliateCommissions,
  getSelfAffiliateSummary,
} from '@/features/affiliate-commissions/api'

function formatMicros(micros: number | undefined, currency?: string) {
  const value = ((micros || 0) / 1_000_000).toFixed(2)
  return `${value} ${currency || ''}`.trim()
}

export function AffiliateCommissionsCard() {
  const { t } = useTranslation()
  const summaryQuery = useQuery({
    queryKey: ['self-affiliate-summary'],
    queryFn: getSelfAffiliateSummary,
  })
  const commissionsQuery = useQuery({
    queryKey: ['self-affiliate-commissions'],
    queryFn: () => getSelfAffiliateCommissions({ p: 1, page_size: 5 }),
  })

  const summary = summaryQuery.data?.data
  const rows = commissionsQuery.data?.data?.items || []
  const loading = summaryQuery.isLoading || commissionsQuery.isLoading

  return (
    <Card className='bg-muted/20 py-0'>
      <CardContent className='space-y-4 p-3 sm:p-4'>
        <div className='flex min-w-0 items-center gap-2.5'>
          <div className='bg-background flex size-8 shrink-0 items-center justify-center rounded-lg border'>
            <HandCoins className='text-muted-foreground size-4' />
          </div>
          <div className='min-w-0'>
            <h3 className='truncate text-sm font-semibold'>
              {t('Top-up Commission Ledger')}
            </h3>
            <p className='text-muted-foreground line-clamp-1 text-xs'>
              {t(
                'Top-up commissions are settled offline by admins through PayPal.'
              )}
            </p>
          </div>
        </div>

        <div className='grid gap-2 sm:grid-cols-3'>
          {[
            [
              t('Pending'),
              formatMicros(summary?.pending_amount_micros, summary?.currency),
            ],
            [
              t('Settled'),
              formatMicros(summary?.settled_amount_micros, summary?.currency),
            ],
            [
              t('Total'),
              formatMicros(summary?.total_amount_micros, summary?.currency),
            ],
          ].map(([label, value]) => (
            <div key={label} className='bg-background rounded-lg border p-3'>
              <div className='text-muted-foreground text-xs font-medium'>
                {label}
              </div>
              {loading ? (
                <Skeleton className='mt-2 h-5 w-24' />
              ) : (
                <div className='mt-1 text-sm font-semibold tabular-nums'>
                  {value}
                </div>
              )}
            </div>
          ))}
        </div>

        <div className='bg-background divide-y rounded-lg border'>
          {loading ? (
            Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className='flex items-center gap-3 p-3'>
                <Skeleton className='h-4 w-20' />
                <Skeleton className='h-4 flex-1' />
                <Skeleton className='h-4 w-16' />
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className='text-muted-foreground p-3 text-sm'>
              {t('No commission records')}
            </div>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className='grid gap-2 p-3 text-sm sm:grid-cols-[90px_minmax(0,1fr)_120px_92px] sm:items-center'
              >
                <Badge
                  variant={row.status === 'pending' ? 'secondary' : 'outline'}
                >
                  {row.status === 'pending' ? t('Pending') : t('Settled')}
                </Badge>
                <div className='min-w-0'>
                  <div className='truncate font-mono text-xs'>
                    {row.trade_no}
                  </div>
                  <div className='text-muted-foreground text-xs'>
                    {row.level === 1 ? t('Level 1') : t('Level 2')}
                  </div>
                </div>
                <div className='font-medium tabular-nums'>
                  {formatMicros(row.commission_amount_micros, row.currency)}
                </div>
                <div className='text-muted-foreground text-xs'>
                  {formatTimestamp(row.created_at)}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
