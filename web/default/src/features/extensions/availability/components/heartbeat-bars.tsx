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

import { cn } from '@/lib/utils'

import type { AvailabilityRecord } from '../api'
import { formatUseTimeSeconds } from '../lib/status'

type HeartbeatBarsProps = {
  records: AvailabilityRecord[]
}

const MIN_HEIGHT_PCT = 18
const MAX_HEIGHT_PCT = 100
const FAIL_HEIGHT_PCT = 28

export function HeartbeatBars(props: HeartbeatBarsProps) {
  const { t } = useTranslation()
  const maxUseTime = props.records.reduce((max, record) => {
    if (!record.ok) return max
    return Math.max(max, record.use_time)
  }, 0)

  return (
    <div className='space-y-2'>
      <div className='flex h-16 items-end gap-px'>
        {props.records.length === 0 ? (
          <p className='text-muted-foreground w-full self-center text-center text-xs'>
            {t('No recent requests for this group.')}
          </p>
        ) : (
          props.records.map((record) => {
            let heightPct = FAIL_HEIGHT_PCT
            if (record.ok) {
              if (maxUseTime <= 0) {
                heightPct = MIN_HEIGHT_PCT
              } else {
                heightPct =
                  MIN_HEIGHT_PCT +
                  (record.use_time / maxUseTime) *
                    (MAX_HEIGHT_PCT - MIN_HEIGHT_PCT)
              }
            }
            const title = record.ok
              ? formatUseTimeSeconds(record.use_time)
              : t('Failed')
            return (
              <div
                key={`${record.created_at}-${record.use_time}-${record.ok ? 'ok' : 'err'}`}
                title={title}
                className={cn(
                  'min-w-0 flex-1 rounded-sm transition-colors',
                  record.ok ? 'bg-emerald-500/80' : 'bg-red-500/80'
                )}
                style={{ height: `${heightPct}%` }}
              />
            )
          })
        )}
      </div>
      <div className='text-muted-foreground flex justify-between text-[10px] tracking-wide uppercase'>
        <span>{t('Past')}</span>
        <span>{t('Now')}</span>
      </div>
    </div>
  )
}
