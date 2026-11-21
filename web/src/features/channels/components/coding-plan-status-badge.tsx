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

import { StatusBadge } from '@/components/status-badge'
import { formatTimestampToDate } from '@/lib/format'

import type { Channel } from '../types'

export function CodingPlanStatusBadge(props: {
  status: NonNullable<Channel['coding_plan_status']>
}) {
  const { t } = useTranslation()
  if (props.status.state === 'available') {
    return null
  }

  if (props.status.state === 'recovering') {
    return (
      <StatusBadge
        label={t('Plan recovery check')}
        variant='warning'
        copyable={false}
      />
    )
  }

  return (
    <div className='flex flex-col items-start gap-1'>
      <StatusBadge
        label={
          props.status.state === 'cooldown'
            ? t('Plan temporarily unavailable')
            : t('Plan quota exhausted')
        }
        variant='warning'
        copyable={false}
      />
      {props.status.retry_at ? (
        <span className='text-muted-foreground text-xs'>
          {t('Retry after {{time}}', {
            time: formatTimestampToDate(props.status.retry_at),
          })}
        </span>
      ) : null}
    </div>
  )
}
