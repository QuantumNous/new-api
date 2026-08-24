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
import { Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useComputeBalance } from '../use-compute-balance'

/** Compact balance chip + top-up CTA shown in the compute page header. */
export function BalanceBar() {
  const { t } = useTranslation()
  const { display } = useComputeBalance()
  return (
    <div className='flex items-center gap-2'>
      <span className='bg-muted text-muted-foreground rounded-md px-3 py-1.5 text-sm'>
        {t('Balance')}:{' '}
        <span className='text-foreground font-semibold tabular-nums'>
          {display}
        </span>
      </span>
      <Button variant='outline' size='sm' render={<Link to='/wallet' />}>
        <Wallet className='size-4' />
        {t('Top up')}
      </Button>
    </div>
  )
}

/**
 * Guidance banner shown before deploy when the balance can't cover usage.
 * Compute consumption is billed from the same flatkey balance as every other
 * model, so an empty balance blocks calls — steer the user to top up.
 */
export function LowBalanceNotice(props: { estimateUsd?: string }) {
  const { t } = useTranslation()
  const { isEmpty } = useComputeBalance()
  if (!isEmpty) return null
  return (
    <div className='bg-warning/10 border-warning/30 flex flex-wrap items-center justify-between gap-3 rounded-md border p-3 text-sm'>
      <div className='flex items-center gap-2'>
        <Wallet className='text-warning size-4 shrink-0' />
        <span>
          {t(
            'Your balance is empty. Compute is billed from your flatkey balance — top up to deploy and run.'
          )}
          {props.estimateUsd ? ` ${t('Estimated')}: ${props.estimateUsd}` : ''}
        </span>
      </div>
      <Button size='sm' render={<Link to='/wallet' />}>
        <Wallet className='size-4' />
        {t('Top up')}
      </Button>
    </div>
  )
}
