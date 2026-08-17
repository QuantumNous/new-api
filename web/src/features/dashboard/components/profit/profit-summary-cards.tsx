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
import { useTranslation } from 'react-i18next'

import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'

import type { ChannelProfitSummary } from '@/features/dashboard/types'

type ProfitCardTone = 'default' | 'success' | 'danger'

function ProfitCard(props: {
  label: string
  value: string
  tone?: ProfitCardTone
  loading?: boolean
}) {
  return (
    <div className='bg-card overflow-hidden rounded-2xl border p-3 shadow-xs sm:p-5'>
      <div className='text-muted-foreground text-xs font-medium'>
        {props.label}
      </div>
      {props.loading ? (
        <Skeleton className='mt-2 h-6 w-24 sm:h-7' />
      ) : (
        <div
          className={cn(
            'text-foreground mt-1.5 font-mono text-lg font-semibold tracking-tight tabular-nums sm:text-2xl',
            props.tone === 'success' && 'text-success',
            props.tone === 'danger' && 'text-destructive'
          )}
        >
          {props.value}
        </div>
      )}
    </div>
  )
}

export function ProfitSummaryCards(props: {
  summary?: ChannelProfitSummary
  loading?: boolean
}) {
  const { t } = useTranslation()
  const { summary, loading } = props
  const profit = summary ? summary.profit : 0
  const costEnabled = Boolean(summary?.cost_enabled)
  let profitTone: ProfitCardTone = 'default'
  if (costEnabled) {
    if (profit > 0) {
      profitTone = 'success'
    } else if (profit < 0) {
      profitTone = 'danger'
    }
  }
  const topupConcession = summary ? summary.topup_concession : 0

  return (
    <div className='grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5'>
      <ProfitCard
        label={t('Total Revenue')}
        value={summary ? formatQuota(summary.revenue) : '-'}
        loading={loading}
      />
      <ProfitCard
        label={t('Total Cost')}
        value={summary ? (costEnabled ? formatQuota(summary.cost) : '-') : '-'}
        loading={loading}
      />
      <ProfitCard
        label={t('Total Profit')}
        value={
          summary
            ? costEnabled
              ? (profit >= 0 ? '+' : '') + formatQuota(profit)
              : '-'
            : '-'
        }
        tone={profitTone}
        loading={loading}
      />
      <ProfitCard
        label={t('Profit Rate')}
        value={
          summary
            ? costEnabled
              ? `${(summary.profit_rate * 100).toFixed(1)}%`
              : '-'
            : '-'
        }
        loading={loading}
      />
      <ProfitCard
        label={t('Topup Concession')}
        value={
          summary
            ? topupConcession > 0
              ? `-${formatQuota(topupConcession)}`
              : '0'
            : '-'
        }
        tone={topupConcession > 0 ? 'danger' : 'default'}
        loading={loading}
      />
    </div>
  )
}
