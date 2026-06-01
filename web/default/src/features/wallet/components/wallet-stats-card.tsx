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
import { WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatQuota } from '@/lib/format'
import { Skeleton } from '@/components/ui/skeleton'
import { GLASS_CARD_CLS } from '../constants'
import type { UserWalletData } from '../types'

interface WalletStatsCardProps {
  user: UserWalletData | null
  loading?: boolean
}

export function WalletStatsCard({ user, loading }: WalletStatsCardProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div className={`${GLASS_CARD_CLS} flex items-center gap-4 px-5 py-4`}>
        <Skeleton className='size-11 shrink-0 rounded-xl' />
        <div>
          <Skeleton className='h-3.5 w-20' />
          <Skeleton className='mt-2 h-8 w-32' />
        </div>
      </div>
    )
  }

  return (
    <div className={`${GLASS_CARD_CLS} flex items-center gap-4 px-5 py-4`}>
      <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30'>
        <WalletCards className='size-5 text-green-600' />
      </div>
      <div>
        <div className='text-muted-foreground text-xs font-medium'>
          {t('Current Balance')}
        </div>
        <div className='mt-0.5 font-mono text-2xl font-bold tabular-nums tracking-tight'>
          {formatQuota(user?.quota ?? 0)}
        </div>
      </div>
    </div>
  )
}
