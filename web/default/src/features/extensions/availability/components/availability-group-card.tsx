/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
    70|but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

import type { AvailabilityGroup } from '../api'
import {
  formatSuccessRatePercent,
  formatUseTimeSeconds,
} from '../lib/status'
import { HeartbeatBars } from './heartbeat-bars'

type AvailabilityGroupCardProps = {
  group: AvailabilityGroup
  refreshHint?: string
}

function badgeForStatus(status: AvailabilityGroup['status']): {
  labelKey: string
  variant: 'success' | 'warning' | 'danger'
} {
  if (status === 'warn') {
    return { labelKey: 'Warning', variant: 'warning' }
  }
  if (status === 'error') {
    return { labelKey: 'Abnormal', variant: 'danger' }
  }
  return { labelKey: 'Normal', variant: 'success' }
}

export function AvailabilityGroupCard(props: AvailabilityGroupCardProps) {
  const { t } = useTranslation()
  const badge = badgeForStatus(props.group.status)

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-3 space-y-0 pb-3'>
        <div className='min-w-0 space-y-1'>
          <CardTitle className='truncate text-base'>
            {props.group.group}
          </CardTitle>
          <p className='text-muted-foreground text-xs'>
            {t('Recent {{count}} records', {
              count: props.group.total,
            })}
            {props.refreshHint ? ` · ${props.refreshHint}` : null}
          </p>
        </div>
        <StatusBadge
          label={t(badge.labelKey)}
          variant={badge.variant}
          copyable={false}
        />
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-2 gap-3'>
          <div className='bg-muted/40 rounded-lg px-3 py-2'>
            <p className='text-muted-foreground text-xs'>
              {t('Avg latency')}
            </p>
            <p className='text-lg font-semibold tabular-nums'>
              {props.group.success_count > 0
                ? formatUseTimeSeconds(props.group.avg_use_time)
                : '—'}
            </p>
          </div>
          <div className='bg-muted/40 rounded-lg px-3 py-2'>
            <p className='text-muted-foreground text-xs'>
              {t('Availability')}
            </p>
            <p className='text-lg font-semibold tabular-nums'>
              {formatSuccessRatePercent(
                props.group.success_rate,
                props.group.total
              )}
            </p>
          </div>
        </div>
        <HeartbeatBars records={props.group.records} />
      </CardContent>
    </Card>
  )
}
