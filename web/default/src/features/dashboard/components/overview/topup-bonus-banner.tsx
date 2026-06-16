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
import { Link } from '@tanstack/react-router'
import { Zap } from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import { formatQuota } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { trackAdsFunnelEvent } from '@/lib/analytics/gtag'

const QUOTA_PER_UNIT = 500000 // 500k quota = $1
// Show the "running low → top up, 50% bonus" banner only when balance is low
// enough that the user is about to hit the wall (and thus most likely to top
// up). Hidden once they have a meaningful balance.
const LOW_BALANCE_QUOTA = 0.5 * QUOTA_PER_UNIT // < $0.50

/**
 * Activation banner: catches the "trial running out → continue with Claude/GPT"
 * moment with the recharge bonus + the cheaper-than-official value, turning a
 * stalled signup into a paying customer. Shows only for low-balance users.
 */
export function TopupBonusBanner() {
  const { t } = useTranslation()
  const remainQuota = Number(
    useAuthStore((s) => s.auth.user?.quota) ?? 0
  )

  if (remainQuota >= LOW_BALANCE_QUOTA) return null

  const balanceLabel = formatQuota(remainQuota)

  return (
    <div className='flex flex-wrap items-center gap-4 rounded-2xl border border-amber-300/60 bg-gradient-to-r from-amber-50 to-card p-4 sm:p-5 dark:border-amber-400/25 dark:from-amber-400/[0.06] dark:to-card'>
      <div className='flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300'>
        <Zap className='size-5' />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='text-[15px] font-bold'>
          {t('Only {{balance}} left — keep using Claude / GPT?', {
            balance: balanceLabel,
          })}
        </div>
        <div className='text-muted-foreground mt-0.5 text-[13px]'>
          {t('Top up and')}{' '}
          <b className='text-emerald-600 dark:text-emerald-400'>
            {t('get a 50% bonus')}
          </b>{' '}
          {t('— the same models already cost 30–50% less than official.')}
        </div>
      </div>
      <Button
        size='lg'
        className='shrink-0 bg-violet-600 text-white hover:bg-violet-500'
        render={
          <Link
            to='/wallet'
            onClick={() =>
              trackAdsFunnelEvent('flatkey_topup_banner_click', {
                balance_quota: remainQuota,
              })
            }
          />
        }
      >
        {t('Top up, get 50% →')}
      </Button>
    </div>
  )
}
