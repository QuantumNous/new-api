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

import dayjs from 'dayjs'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { ChannelMonitorResult, ChannelMonitorStatus } from '../types'

type MonitorStatusBadgeProps = {
  status: ChannelMonitorStatus
}

export function MonitorStatusBadge(props: MonitorStatusBadgeProps) {
  const { t } = useTranslation()

  if (props.status === 'success') {
    return (
      <Badge
        variant='outline'
        className='border-success/30 bg-success/10 text-success'
      >
        {t('Operational')}
      </Badge>
    )
  }
  if (props.status === 'failed') {
    return <Badge variant='destructive'>{t('Failed')}</Badge>
  }
  return <Badge variant='secondary'>{t('Not tested')}</Badge>
}

type MonitorHistoryBarsProps = {
  results: ChannelMonitorResult[]
  compact?: boolean
}

export function MonitorHistoryBars(props: MonitorHistoryBarsProps) {
  const { t } = useTranslation()
  const recent = props.results.slice(-30)
  const padded: Array<ChannelMonitorResult | null> = [
    ...Array<null>(Math.max(0, 30 - recent.length)).fill(null),
    ...recent,
  ]

  return (
    <div
      className={cn(
        'grid w-full grid-cols-[repeat(30,minmax(3px,1fr))] items-end gap-1',
        props.compact ? 'h-5' : 'h-7'
      )}
      aria-label={t('Latest 30 test results')}
    >
      {padded.map((result, index) => {
        let title = t('No test result')
        if (result) {
          title = `${result.success ? t('Success') : t('Failed')} · ${dayjs.unix(result.checked_at).format('YYYY-MM-DD HH:mm:ss')}`
        }
        return (
          <span
            key={result?.id ?? `empty-${index}`}
            title={title}
            className={cn(
              'w-full rounded-[2px]',
              props.compact ? 'max-h-4' : 'max-h-6',
              !result && 'bg-muted h-2',
              result?.success && 'bg-success h-full',
              result && !result.success && 'bg-destructive h-2.5'
            )}
          />
        )
      })}
    </div>
  )
}
