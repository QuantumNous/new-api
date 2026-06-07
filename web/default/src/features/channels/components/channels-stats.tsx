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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ListOrdered,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import type { Channel } from '../types'
import { CHANNEL_STATUS } from '../constants'

interface ChannelsStatsProps {
  channels: Channel[]
  total: number
  isLoading: boolean
}

export function ChannelsStats({ channels, total, isLoading }: ChannelsStatsProps) {
  const { t } = useTranslation()

  const stats = useMemo(() => {
    if (!channels.length && !total) {
      return {
        total: 0,
        healthy: 0,
        warning: 0,
        disabled: 0,
        avgResponse: 0,
        successRate: '0.00',
      }
    }

    const healthy = channels.filter(
      (c) => c.status === CHANNEL_STATUS.ENABLED
    ).length
    const warning = channels.filter(
      (c) => c.status === CHANNEL_STATUS.AUTO_DISABLED
    ).length
    const disabled = channels.filter(
      (c) => c.status === CHANNEL_STATUS.MANUAL_DISABLED
    ).length
    const validResponseTimes = channels
      .filter((c) => c.response_time > 0)
      .map((c) => c.response_time)
    const avgResponse =
      validResponseTimes.length > 0
        ? Math.round(
            validResponseTimes.reduce((a, b) => a + b, 0) /
              validResponseTimes.length
          )
        : 0
    const successRate =
      total > 0 ? ((healthy / total) * 100).toFixed(2) : '0.00'

    return {
      total,
      healthy,
      warning,
      disabled,
      avgResponse,
      successRate,
    }
  }, [channels, total])

  const cards = [
    {
      label: t('Total Channels'),
      value: stats.total,
      icon: ListOrdered,
      tone: 'blue' as const,
      sub: null,
    },
    {
      label: t('Healthy'),
      value: stats.healthy,
      icon: CheckCircle2,
      tone: 'green' as const,
      sub:
        total > 0
          ? `${((stats.healthy / total) * 100).toFixed(1)}% ${t('channels normal')}`
          : null,
    },
    {
      label: t('Warning'),
      value: stats.warning,
      icon: AlertTriangle,
      tone: 'amber' as const,
      sub: null,
    },
    {
      label: t('Disabled'),
      value: stats.disabled,
      icon: XCircle,
      tone: 'red' as const,
      sub: null,
    },
    {
      label: t('Avg Response'),
      value: stats.avgResponse,
      suffix: 'ms',
      icon: Clock,
      tone: 'blue' as const,
      sub: null,
    },
    {
      label: t('Success Rate'),
      value: stats.successRate,
      suffix: '%',
      icon: Activity,
      tone: 'green' as const,
      sub: null,
    },
  ]

  if (isLoading) {
    return (
      <div className='grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4'>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className='bg-card border border-border rounded-lg p-5'
          >
            <Skeleton className='h-8 w-8 rounded-sm mb-3' />
            <Skeleton className='h-4 w-20 mb-2' />
            <Skeleton className='h-8 w-16' />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className='grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4'>
      {cards.map((card) => {
        const Icon = card.icon
        const toneClasses = {
          blue: 'bg-accent text-accent-foreground',
          green: 'bg-success/15 text-success',
          amber: 'bg-warning/15 text-warning',
          red: 'bg-destructive/15 text-destructive',
        }
        return (
          <div
            key={card.label}
            className='bg-card border border-border rounded-lg p-5'
          >
            <div
              className={cn(
                'w-8 h-8 rounded-sm grid place-items-center mb-3',
                toneClasses[card.tone]
              )}
            >
              <Icon className='w-[18px] h-[18px]' strokeWidth={2} />
            </div>
            <div className='text-sm text-muted-foreground mb-2'>
              {card.label}
            </div>
            <div className='text-[28px] font-semibold tracking-tight text-foreground'>
              {card.value}
              {card.suffix && (
                <span className='text-sm font-normal text-muted-foreground ml-1'>
                  {card.suffix}
                </span>
              )}
            </div>
            {card.sub && (
              <div className='text-[11px] text-muted-foreground mt-1'>
                {card.sub}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
