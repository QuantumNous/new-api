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
  Boxes,
  Building2,
  Coins,
  Gauge,
  Layers,
  Trophy,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { formatNumber, formatQuota } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import {
  calculateDashboardModelInsights,
  getDashboardProviderLabelKey,
} from '@/features/dashboard/lib'
import type { QuotaDataItem } from '@/features/dashboard/types'

interface ModelInsightCardsProps {
  data: QuotaDataItem[]
  loading?: boolean
  showProviderInsights?: boolean
}

export function ModelInsightCards(props: ModelInsightCardsProps) {
  const { t } = useTranslation()
  const insights = useMemo(
    () => calculateDashboardModelInsights(props.data),
    [props.data]
  )

  const items = [
    {
      title: t('Active Models'),
      value: formatNumber(insights.activeModelCount),
      desc: t('Models after filters'),
      icon: Boxes,
    },
    {
      title: t('Top Model'),
      value: insights.topModelName,
      desc: formatQuota(insights.topModelQuota),
      icon: Trophy,
      mono: true,
    },
    ...(props.showProviderInsights
      ? [
          {
            title: t('Top Provider'),
            value:
              insights.activeProviderCount > 0
                ? t(getDashboardProviderLabelKey(insights.topProvider))
                : '-',
            desc: formatQuota(insights.topProviderQuota),
            icon: Building2,
          },
        ]
      : []),
    {
      title: t('Avg Tokens / Call'),
      value: formatNumber(insights.avgTokensPerCall),
      desc: t('Token density'),
      icon: Layers,
    },
    {
      title: t('Avg Quota / Call'),
      value: formatQuota(insights.avgQuotaPerCall),
      desc: t('Cost density'),
      icon: Coins,
    },
    {
      title: t('Top 3 Share'),
      value: `${formatNumber(insights.topThreeQuotaShare)}%`,
      desc: t('Consumption concentration'),
      icon: Gauge,
    },
  ]

  return (
    <div
      className={cn(
        'grid gap-2 sm:grid-cols-2 lg:grid-cols-3',
        props.showProviderInsights ? '2xl:grid-cols-6' : '2xl:grid-cols-5'
      )}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <div key={item.title} className='rounded-lg border px-3 py-2.5'>
            <div className='flex items-center gap-2'>
              <Icon className='text-muted-foreground/60 size-3.5 shrink-0' />
              <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
                {item.title}
              </div>
            </div>
            {props.loading ? (
              <div className='mt-2 flex flex-col gap-1.5'>
                <Skeleton className='h-5 w-20' />
                <Skeleton className='h-3 w-16' />
              </div>
            ) : (
              <>
                <div
                  className={cn(
                    'text-foreground mt-1.5 truncate text-lg font-semibold tracking-tight',
                    item.mono ? 'font-mono' : 'font-sans'
                  )}
                  title={item.value}
                >
                  {item.value}
                </div>
                <div className='text-muted-foreground/60 mt-0.5 truncate text-xs'>
                  {item.desc}
                </div>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
