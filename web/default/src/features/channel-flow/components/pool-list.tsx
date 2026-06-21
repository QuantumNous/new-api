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
import { Edit, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'
import type { ChannelFlowPool, ChannelFlowScheduleWindow } from '../types'

type PoolListProps = {
  pools: ChannelFlowPool[]
  selectedPoolId?: number
  loading: boolean
  onSelect: (pool: ChannelFlowPool) => void
  onEdit: (pool: ChannelFlowPool) => void
  onDelete: (pool: ChannelFlowPool) => void
}

export function PoolList(props: PoolListProps) {
  const { t } = useTranslation()

  const getPoolActivityLabel = (enabled: boolean, scheduleActive: boolean): string => {
    if (!enabled) return t('Disabled')
    if (scheduleActive) return t('Active now')
    return t('Inactive now')
  }

  const getOnLimitLabel = (onLimit: string): string => {
    if (onLimit === 'queue') return t('Queue on limit')
    if (onLimit === 'fallback') return t('Fallback on limit')
    return t('Reject on limit')
  }

  if (props.loading) {
    return (
      <div className='space-y-2'>
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className='h-24 rounded-lg' />
        ))}
      </div>
    )
  }

  if (props.pools.length === 0) {
    return (
      <div className='border-border/80 flex min-h-32 items-center justify-center rounded-lg border border-dashed px-4 text-center'>
        <span className='text-muted-foreground text-sm'>
          {t('No Flow Pools configured')}
        </span>
      </div>
    )
  }

  return (
    <div className='space-y-2 overflow-x-hidden'>
      {props.pools.map((pool) => {
        const isSelected = pool.id === props.selectedPoolId
        const isScheduleActive = isPoolScheduleActive(pool)
        const scheduleSummary = getPoolScheduleSummary(pool, t)
        const backendLabel =
          pool.backend === 'redis'
            ? t('Redis')
            : t('Memory')

        return (
          <div
            key={pool.id}
            role='button'
            tabIndex={0}
            className={cn(
              'group block w-full rounded-lg border bg-background p-3 text-left transition-colors',
              'hover:bg-muted/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none',
              isSelected && 'border-primary/60 bg-primary/5 shadow-sm'
            )}
            onClick={() => props.onSelect(pool)}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              props.onSelect(pool)
            }}
          >
            <div className='flex min-w-0 items-start gap-2'>
              <div className='min-w-0 flex-1'>
                <div className='truncate text-sm font-medium'>{pool.name}</div>
                <div className='text-muted-foreground mt-1 truncate text-xs'>
                  {pool.pool_key || t('Generated after save')}
                </div>
              </div>
              <div className='flex shrink-0 items-center gap-1'>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label={t('Edit Flow Pool')}
                  onClick={(event) => {
                    event.stopPropagation()
                    props.onEdit(pool)
                  }}
                >
                  <Edit className='size-4' />
                </Button>
                <Button
                  variant='ghost'
                  size='icon-sm'
                  aria-label={t('Delete Flow Pool')}
                  onClick={(event) => {
                    event.stopPropagation()
                    props.onDelete(pool)
                  }}
                >
                  <Trash2 className='size-4' />
                </Button>
              </div>
            </div>

            <div className='mt-3 rounded-md bg-muted/35 px-2.5 py-2'>
              <div className='flex min-w-0 items-center gap-2'>
                <span
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    pool.enabled && isScheduleActive
                      ? 'bg-emerald-500'
                      : 'bg-muted-foreground/45'
                  )}
                />
                <span className='truncate text-xs font-medium'>
                  {getPoolActivityLabel(pool.enabled, isScheduleActive)}
                </span>
              </div>
              <div
                className='text-muted-foreground mt-1 truncate text-xs'
                title={scheduleSummary}
              >
                {scheduleSummary}
              </div>
            </div>

            <div className='mt-3 flex flex-wrap gap-1.5'>
              <Badge variant={pool.enabled ? 'default' : 'secondary'}>
                {pool.enabled ? t('Enabled') : t('Disabled')}
              </Badge>
              <Badge variant={pool.backend === 'redis' ? 'outline' : 'secondary'}>
                {backendLabel}
              </Badge>
              <Badge variant='outline'>
                {getOnLimitLabel(pool.on_limit)}
              </Badge>
              <Badge variant='secondary'>
                {t('Capacity')} {formatLimit(pool.max_inflight)}+
                {formatLimit(pool.max_queue_size)}
              </Badge>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function formatLimit(value?: number): string {
  if (!value || value <= 0) return '∞'
  return String(value)
}

function getPoolScheduleSummary(
  pool: ChannelFlowPool,
  t: (key: string) => string
) {
  switch (pool.schedule_mode || 'always') {
    case 'datetime_range':
      return `${formatDateTime(pool.effective_start_time)} - ${formatDateTime(
        pool.effective_end_time
      )}`
    case 'weekly': {
      const window = parseScheduleWindows(pool.schedule_windows)[0]
      if (!window) return t('Weekly schedule')
      return `${formatWeekdays(window.weekdays, t)} ${formatMinute(
        window.start_minute
      )}-${formatMinute(window.end_minute)}`
    }
    default:
      return t('Always active')
  }
}

function formatDateTime(timestamp?: number) {
  if (!timestamp || timestamp <= 0) return '-'
  return dayjs(timestamp * 1000).format('YYYY-MM-DD HH:mm')
}

function parseScheduleWindows(raw?: string): ChannelFlowScheduleWindow[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is ChannelFlowScheduleWindow =>
        item &&
        Array.isArray(item.weekdays) &&
        Number.isInteger(item.start_minute) &&
        Number.isInteger(item.end_minute)
    )
  } catch {
    return []
  }
}

function formatWeekdays(weekdays: number[], t: (key: string) => string) {
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const normalized = [...new Set(weekdays)]
    .filter((weekday) => weekday >= 0 && weekday <= 6)
    .sort((a, b) => a - b)
  if (normalized.length === 0) return t('Weekly schedule')
  if (normalized.join(',') === '1,2,3,4,5') return `${t('Mon')}-${t('Fri')}`
  if (normalized.join(',') === '0,6') return `${t('Sun')}, ${t('Sat')}`
  return normalized.map((weekday) => t(labels[weekday])).join(', ')
}

function formatMinute(minute: number) {
  const clamped = Math.max(0, Math.min(1440, Number.isFinite(minute) ? minute : 0))
  if (clamped === 1440) return '24:00'
  const hours = Math.floor(clamped / 60)
  const minutes = clamped % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function isPoolScheduleActive(pool: ChannelFlowPool) {
  if (!pool.enabled) return false
  switch (pool.schedule_mode || 'always') {
    case 'datetime_range': {
      const now = Math.floor(Date.now() / 1000)
      return (
        pool.effective_start_time > 0 &&
        pool.effective_end_time > 0 &&
        pool.effective_start_time <= now &&
        now < pool.effective_end_time
      )
    }
    case 'weekly': {
      const windows = parseScheduleWindows(pool.schedule_windows)
      if (windows.length === 0) return false
      const localNow = getTimePartsInTimezone(
        new Date(),
        pool.schedule_timezone || 'Asia/Shanghai'
      )
      return windows.some((window) =>
        scheduleWindowContains(window, localNow.weekday, localNow.minute)
      )
    }
    default:
      return true
  }
}

function getTimePartsInTimezone(date: Date, timeZone: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date)
    const weekdayText = parts.find((part) => part.type === 'weekday')?.value
    const hourText = parts.find((part) => part.type === 'hour')?.value
    const minuteText = parts.find((part) => part.type === 'minute')?.value
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(
      weekdayText || ''
    )
    const hour = Number(hourText)
    const minute = Number(minuteText)
    return {
      weekday: weekday >= 0 ? weekday : date.getDay(),
      minute:
        (Number.isFinite(hour) ? hour % 24 : date.getHours()) * 60 +
        (Number.isFinite(minute) ? minute : date.getMinutes()),
    }
  } catch {
    return {
      weekday: date.getDay(),
      minute: date.getHours() * 60 + date.getMinutes(),
    }
  }
}

function scheduleWindowContains(
  window: ChannelFlowScheduleWindow,
  currentWeekday: number,
  currentMinute: number
) {
  if (window.start_minute < window.end_minute) {
    return (
      window.weekdays.includes(currentWeekday) &&
      currentMinute >= window.start_minute &&
      currentMinute < window.end_minute
    )
  }
  const previousWeekday = currentWeekday === 0 ? 6 : currentWeekday - 1
  return (
    (window.weekdays.includes(currentWeekday) &&
      currentMinute >= window.start_minute) ||
    (window.weekdays.includes(previousWeekday) &&
      currentMinute < window.end_minute)
  )
}
