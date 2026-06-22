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
import { ChevronDown, Clock3, RefreshCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { OPS_DATA_REFETCH_INTERVAL_MS } from '@/lib/query-polling'
import {
  OVERVIEW_HEADER_CONTROL_BUTTON_CLASS,
  OVERVIEW_HEADER_CONTROL_SELECT_CLASS,
  OVERVIEW_HEADER_STATUS_PILL_CLASS,
} from './overview-reference-styles'

interface CockpitHeaderProps {
  quotaHealthLabel: string
  quotaHealthDotClass: string
  dataWindowLabel?: string
  dataAsOfLabel?: string
}

export function CockpitHeader(props: CockpitHeaderProps) {
  const { t } = useTranslation()
  const refreshSeconds = Math.round(OPS_DATA_REFETCH_INTERVAL_MS / 1000)

  return (
    <header className='flex flex-col gap-0'>
      <div className='flex flex-wrap items-center justify-between gap-x-3 gap-y-1'>
        <div className='flex min-w-0 flex-nowrap items-baseline gap-2'>
          <h1 className='shrink-0 text-lg font-semibold leading-none text-[#111827]'>
            {t('Dashboard Operations Console')}
          </h1>
          <span className='min-w-0 text-xs leading-snug text-slate-500'>
            {t('Dashboard overview page subtitle')}
          </span>
        </div>

        <div className='flex shrink-0 flex-nowrap items-center gap-1.5'>
          <span className={OVERVIEW_HEADER_CONTROL_SELECT_CLASS}>
            <Clock3 className='size-3 text-[#2563EB]' aria-hidden='true' />
            {t('Dashboard time range 24h')}
            <ChevronDown className='size-3 text-[#9CA3AF]' aria-hidden='true' />
          </span>
          <button type='button' className={OVERVIEW_HEADER_CONTROL_BUTTON_CLASS}>
            <RefreshCw className='size-3 text-[#6B7280]' aria-hidden='true' />
            {t('Dashboard auto refresh label', { seconds: refreshSeconds })}
          </button>
          <span className={OVERVIEW_HEADER_STATUS_PILL_CLASS}>
            <span
              className={cn('size-1.5 rounded-full', props.quotaHealthDotClass)}
              aria-hidden='true'
            />
            {props.quotaHealthLabel}
          </span>
        </div>
      </div>

      {props.dataWindowLabel || props.dataAsOfLabel ? (
        <p className='mt-0.5 text-[11px] leading-none text-[#9CA3AF]'>
          {[props.dataWindowLabel, props.dataAsOfLabel]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
    </header>
  )
}
