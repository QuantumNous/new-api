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

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { StatusCard } from '../types'
import { RecentBar } from './recent-bar'

type GroupStatusCardProps = {
  card: StatusCard
}

const statusBadgeVariant: Record<
  StatusCard['status'],
  { className: string; label: string }
> = {
  normal: {
    className:
      'bg-emerald-500/15 text-emerald-700 border-emerald-500/40 dark:text-emerald-300',
    label: '正常',
  },
  degraded: {
    className:
      'bg-amber-500/15 text-amber-700 border-amber-500/40 dark:text-amber-300',
    label: '降级',
  },
  error: {
    className:
      'bg-red-500/15 text-red-700 border-red-500/40 dark:text-red-300',
    label: '异常',
  },
  unknown: {
    className:
      'bg-muted text-muted-foreground border-muted-foreground/30',
    label: '等待探测',
  },
}

function formatLatency(ms: number | null): string {
  if (ms === null || ms === undefined || ms <= 0) return '-'
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`
  return `${ms}ms`
}

function formatAvailability(ratio: number | null): string {
  if (ratio === null || ratio === undefined) return '-'
  return `${(ratio * 100).toFixed(2)}%`
}

export function GroupStatusCard({ card }: GroupStatusCardProps) {
  const { t } = useTranslation()
  const badge = statusBadgeVariant[card.status] ?? statusBadgeVariant.error
  const label = card.status_label || badge.label

  return (
    <Card className='h-full'>
      <CardHeader className='pb-3'>
        <div className='flex items-start justify-between gap-3'>
          <div className='min-w-0'>
            <CardTitle className='truncate text-base font-semibold'>
              {card.name}
            </CardTitle>
            <CardDescription className='mt-1 flex flex-wrap gap-1.5'>
              {card.provider ? (
                <span className='text-muted-foreground text-xs'>
                  {card.provider}
                </span>
              ) : null}
              {card.model ? (
                <span className='text-muted-foreground text-xs'>
                  · {card.model}
                </span>
              ) : null}
            </CardDescription>
          </div>
          <Badge
            variant='outline'
            className={cn('shrink-0 rounded-full text-xs', badge.className)}
          >
            {label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className='space-y-4'>
        <div className='grid grid-cols-3 gap-3 text-sm'>
          <MetricBlock
            label={t('对话延迟')}
            value={formatLatency(card.latency_ms)}
          />
          {card.ping_ms !== null && card.ping_ms !== undefined ? (
            <MetricBlock
              label={t('端点 PING')}
              value={formatLatency(card.ping_ms)}
            />
          ) : (
            <MetricBlock label={t('端点 PING')} value='-' />
          )}
          <MetricBlock
            label={t('可用性 · 7 天')}
            value={formatAvailability(card.availability_7d)}
          />
        </div>

        <div className='space-y-1.5'>
          <div className='text-muted-foreground flex items-center justify-between text-xs'>
            <span>{t('PAST')}</span>
            <span>
              {card.available_channels}/{card.total_channels}{' '}
              {t('渠道可用')}
            </span>
            <span>{t('NOW')}</span>
          </div>
          <RecentBar recent={card.recent} limit={card.recent_limit || 60} />
        </div>
      </CardContent>
    </Card>
  )
}

type MetricBlockProps = {
  label: string
  value: string
}

function MetricBlock({ label, value }: MetricBlockProps) {
  return (
    <div className='space-y-0.5'>
      <div className='text-muted-foreground text-xs'>{label}</div>
      <div className='truncate text-sm font-medium tabular-nums'>{value}</div>
    </div>
  )
}
