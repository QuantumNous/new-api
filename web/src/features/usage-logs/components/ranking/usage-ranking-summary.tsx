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
  Activity01Icon,
  Coins01Icon,
  TokenCircleIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompactNumber, formatQuota } from '@/lib/format'

import type { UsageRankingSummary as UsageRankingSummaryData } from '../../types'

interface UsageRankingSummaryProps {
  summary: UsageRankingSummaryData
  loading: boolean
}

export function UsageRankingSummary(props: UsageRankingSummaryProps) {
  const { t } = useTranslation()
  const items = [
    {
      label: t('Consumed Quota'),
      value: formatQuota(props.summary.quota),
      icon: Coins01Icon,
    },
    {
      label: t('Request Count'),
      value: formatCompactNumber(props.summary.request_count),
      icon: Activity01Icon,
    },
    {
      label: t('Total Tokens'),
      value: formatCompactNumber(props.summary.total_tokens),
      icon: TokenCircleIcon,
    },
    {
      label: t('Active Users'),
      value: formatCompactNumber(props.summary.active_user_count),
      icon: UserGroupIcon,
    },
  ]

  return (
    <section
      aria-label={t('Usage Ranking Summary')}
      className='grid grid-cols-2 gap-2 lg:grid-cols-4'
    >
      {items.map((item) => (
        <Card key={item.label} size='sm'>
          <CardHeader className='grid grid-cols-[1fr_auto] items-center'>
            <div>
              <CardDescription>{item.label}</CardDescription>
              <CardTitle className='mt-1 text-lg tabular-nums'>
                {props.loading ? <Skeleton className='h-6 w-20' /> : item.value}
              </CardTitle>
            </div>
            <div className='bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg'>
              <HugeiconsIcon icon={item.icon} className='size-5' />
            </div>
          </CardHeader>
          <CardContent className='sr-only'>{item.value}</CardContent>
        </Card>
      ))}
    </section>
  )
}
