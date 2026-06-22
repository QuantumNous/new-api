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
import { Link } from '@tanstack/react-router'
import { Wallet } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuotaForCockpit } from './cockpit-display'
import {
  OVERVIEW_HEADER_PRIMARY_BUTTON_CLASS,
  OVERVIEW_QUOTA_TILE_CLASS,
} from './overview-reference-styles'

interface OverviewQuotaBannerProps {
  remainQuota: number
  usedQuota: number
  recentUsage: number
  runwayDays: number | null
  healthLabel: string
  healthDotClass: string
  healthLevel: 'healthy' | 'caution' | 'critical'
  loading?: boolean
}

export function OverviewQuotaBanner(props: OverviewQuotaBannerProps) {
  const { t } = useTranslation()

  const runwayLabel =
    props.runwayDays !== null
      ? props.runwayDays < 1
        ? t('Dashboard less than 1 day')
        : props.runwayDays > 999
          ? `999+ ${t('Dashboard days suffix')}`
          : `${props.runwayDays.toFixed(1)} ${t('Dashboard days suffix')}`
      : props.remainQuota <= 0
        ? t('Dashboard health critical')
        : t('Dashboard no recent usage')

  return (
    <article className={OVERVIEW_QUOTA_TILE_CLASS}>
      <div className='flex min-w-0 flex-1 flex-col justify-center gap-1'>
        <div className='flex items-center gap-1.5'>
          <span className='flex size-6 items-center justify-center rounded-md bg-[#F5F3FF]'>
            <Wallet className='size-3.5 text-[#7C3AED]' aria-hidden='true' />
          </span>
          <span className='text-[12px] text-[#6B7280]'>
            {t('Dashboard token balance label')}
          </span>
        </div>
        {props.loading ? (
          <Skeleton className='h-6 w-40' />
        ) : (
          <p className='font-[DIN,sans-serif] text-[20px] font-bold leading-none text-[#111827]'>
            {formatQuotaForCockpit(props.remainQuota)}
          </p>
        )}
        <p className='truncate text-[11px] text-[#9CA3AF]'>
          {t('Dashboard historical usage hint', {
            used: formatQuotaForCockpit(props.usedQuota),
          })}
        </p>
      </div>

      <div className='hidden shrink-0 flex-col justify-center gap-2 border-x border-[#F0F2F5] px-3 sm:flex'>
        <div>
          <p className='text-[11px] text-[#9CA3AF]'>{t('Dashboard token usage 24h')}</p>
          <p className='mt-0.5 text-[13px] font-semibold tabular-nums text-[#111827]'>
            {props.loading ? '—' : formatQuotaForCockpit(props.recentUsage)}
          </p>
        </div>
        <div>
          <p className='text-[11px] text-[#9CA3AF]'>{t('Dashboard runway label')}</p>
          <p
            className={cn(
              'mt-0.5 text-[13px] font-semibold tabular-nums',
              props.healthLevel === 'critical' && 'text-[#DC2626]',
              props.healthLevel === 'caution' && 'text-[#D97706]',
              props.healthLevel === 'healthy' && 'text-[#111827]'
            )}
          >
            {runwayLabel}
          </p>
        </div>
      </div>

      <div className='flex shrink-0 flex-col items-end justify-center gap-1.5'>
        <span className='inline-flex items-center gap-1.5 text-[12px] text-[#374151]'>
          <span className={cn('size-2 rounded-full', props.healthDotClass)} aria-hidden='true' />
          {props.healthLabel}
        </span>
        <Link to='/wallet' className={OVERVIEW_HEADER_PRIMARY_BUTTON_CLASS}>
          {t('Dashboard resource recharge')}
        </Link>
      </div>
    </article>
  )
}
