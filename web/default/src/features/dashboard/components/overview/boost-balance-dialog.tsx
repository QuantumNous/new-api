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
import { Plus, UserPlus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface BoostBalanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Formatted balance, already rendered in the display currency. */
  balanceDisplay: string
  loading?: boolean
}

/** Where each action sends the user. Exported so tests assert the real values. */
export const BOOST_TOPUP_ROUTE = '/wallet'
export const BOOST_EARN_ROUTE = '/invite'

/**
 * The overview's "boost balance" prompt: it restates the current balance so
 * the user does not have to remember the card behind the dialog, then offers
 * the two ways to raise it — paying for credit, or earning it by referral.
 */
export function BoostBalanceDialog(props: BoostBalanceDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className='sm:max-w-md'>
        <BoostBalanceContent
          balanceDisplay={props.balanceDisplay}
          loading={props.loading}
          onNavigate={() => props.onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

/**
 * The dialog body, split out so it can be rendered (and asserted on) without
 * Base UI's portal — which produces no markup at all under SSR.
 */
export function BoostBalanceContent(props: {
  balanceDisplay: string
  loading?: boolean
  onNavigate: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <DialogHeader>
        <span className='text-primary text-xs font-bold tracking-[0.1em] uppercase'>
          {t('Boost your balance')}
        </span>
        <DialogTitle className='text-xl leading-tight font-semibold'>
          {t('Keep your balance ready whenever you need it')}
        </DialogTitle>
      </DialogHeader>

      <div className='bg-primary/5 border-primary/20 flex items-center justify-between gap-3 rounded-xl border p-4'>
        <div className='flex min-w-0 flex-col gap-1'>
          <span className='text-muted-foreground text-xs font-medium'>
            {t('Current available balance')}
          </span>
          <span className='text-primary font-mono text-3xl font-semibold tracking-tight break-all tabular-nums'>
            {props.loading ? '—' : props.balanceDisplay}
          </span>
        </div>
        <Badge variant='secondary' className='shrink-0'>
          {t('Available')}
        </Badge>
      </div>

      <DialogDescription>
        {t(
          'A healthy balance keeps your work and API calls from being interrupted. Top up now, or invite friends to earn reward credits, so you can keep building with costs under control.'
        )}
      </DialogDescription>

      <div className='grid gap-2 sm:grid-cols-2'>
        <Button
          variant='outline'
          className='h-11'
          onClick={props.onNavigate}
          render={<Link to={BOOST_TOPUP_ROUTE} />}
        >
          <Plus data-icon='inline-start' />
          {t('Quick top-up')}
        </Button>
        <Button
          variant='outline'
          className='h-11'
          onClick={props.onNavigate}
          render={<Link to={BOOST_EARN_ROUTE} />}
        >
          <UserPlus data-icon='inline-start' />
          {t('Earn credits')}
        </Button>
      </div>
    </>
  )
}
