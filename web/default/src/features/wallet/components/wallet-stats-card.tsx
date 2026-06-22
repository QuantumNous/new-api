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
import { Activity, BarChart3, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTokenQuotaDisplay } from '@/lib/ops-billing-display'
import { Skeleton } from '@/components/ui/skeleton'
import type { UserWalletData } from '../types'

interface WalletStatsCardProps {
  user: UserWalletData | null
  loading?: boolean
}

export function WalletStatsCard(props: WalletStatsCardProps) {
  const { t } = useTranslation()
  if (props.loading) {
    return (
      <div className='overflow-hidden rounded-lg border border-[#DBEAFE] bg-white'>
        <div className='divide-[#DBEAFE]/80 grid grid-cols-3 divide-x'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className='px-3 py-3 sm:px-5 sm:py-4'>
              <Skeleton className='h-4 w-24' />
              <Skeleton className='mt-2.5 h-8 w-32' />
              <Skeleton className='mt-2 h-3.5 w-28' />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const stats = [
    {
      label: t('wallet.stats.current_quota'),
      value: formatTokenQuotaDisplay(props.user?.quota ?? 0),
      description: t('wallet.stats.remaining_desc'),
      icon: WalletCards,
    },
    {
      label: t('wallet.stats.total_usage'),
      value: formatTokenQuotaDisplay(props.user?.used_quota ?? 0),
      description: t('wallet.stats.usage_desc'),
      icon: BarChart3,
    },
    {
      label: t('wallet.stats.api_requests'),
      value: (props.user?.request_count ?? 0).toLocaleString(),
      description: t('wallet.stats.api_requests_desc'),
      icon: Activity,
    },
  ]

  return (
    <div className='overflow-hidden rounded-lg border border-[#DBEAFE] bg-white'>
      <div className='divide-[#DBEAFE]/80 grid grid-cols-3 divide-x'>
        {stats.map((item) => (
          <div key={item.label} className='px-3 py-3.5 sm:px-5 sm:py-4'>
            <div className='flex items-center gap-2'>
              <item.icon className='size-4 shrink-0 text-slate-500' />
              <div className='truncate text-xs font-semibold tracking-wide text-slate-500 uppercase sm:text-sm'>
                {item.label}
              </div>
            </div>

            <div className='mt-2 font-mono text-lg font-bold tracking-tight break-all text-slate-900 tabular-nums sm:mt-2.5 sm:text-2xl'>
              {item.value}
            </div>
            <div className='mt-1.5 hidden text-xs leading-relaxed text-slate-500 md:block'>
              {item.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
